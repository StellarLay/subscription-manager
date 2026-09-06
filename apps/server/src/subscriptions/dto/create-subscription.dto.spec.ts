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
      nextChargeDate: '2026-09-15',
      category: 'Развлечения',
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
});
