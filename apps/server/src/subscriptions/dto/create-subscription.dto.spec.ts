import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { BillingPeriod } from '../../generated/prisma/client';
import { CreateSubscriptionDto, Currency } from './create-subscription.dto';

describe('CreateSubscriptionDto', () => {
  it('accepts a valid subscription', async () => {
    const input = plainToInstance(CreateSubscriptionDto, {
      name: 'YouTube Premium',
      amount: 799,
      currency: Currency.RUB,
      billingPeriod: BillingPeriod.MONTH,
      interval: 2,
      nextChargeDate: '2026-09-15',
      categoryId: 'e6632ca7-bbed-4892-a8ef-efb824f51aa6',
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('accepts a custom day interval', async () => {
    const input = plainToInstance(CreateSubscriptionDto, {
      name: 'Filter replacement',
      amount: 1590,
      currency: Currency.RUB,
      billingPeriod: BillingPeriod.CUSTOM,
      interval: 45,
      nextChargeDate: '2026-10-01',
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects invalid money and date values', async () => {
    const input = plainToInstance(CreateSubscriptionDto, {
      name: '',
      amount: -1,
      currency: 'BTC',
      billingPeriod: 'FOREVER',
      nextChargeDate: 'tomorrow',
    });

    const errors = await validate(input);

    expect(errors.map(({ property }) => property).sort()).toEqual([
      'amount',
      'billingPeriod',
      'currency',
      'name',
      'nextChargeDate',
    ]);
  });

  it('rejects invalid intervals and timestamps instead of calendar dates', async () => {
    const input = plainToInstance(CreateSubscriptionDto, {
      name: 'Invalid schedule',
      amount: 100,
      currency: Currency.RUB,
      billingPeriod: BillingPeriod.CUSTOM,
      interval: 0,
      nextChargeDate: '2026-09-15T10:00:00.000Z',
    });

    const errors = await validate(input);

    expect(errors.map(({ property }) => property).sort()).toEqual(['interval', 'nextChargeDate']);
  });
});
