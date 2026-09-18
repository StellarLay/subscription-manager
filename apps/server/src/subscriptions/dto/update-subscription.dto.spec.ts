import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateSubscriptionDto } from './update-subscription.dto';

describe('UpdateSubscriptionDto', () => {
  it('accepts a partial subscription update', async () => {
    const input = plainToInstance(UpdateSubscriptionDto, {
      name: 'Spotify Family',
      amount: 349,
      paymentMethodId: null,
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects invalid optional values', async () => {
    const input = plainToInstance(UpdateSubscriptionDto, {
      amount: 0,
      interval: 0,
      paymentMethodId: 'not-a-uuid',
    });

    const errors = await validate(input);

    expect(errors.map(({ property }) => property).sort()).toEqual([
      'amount',
      'interval',
      'paymentMethodId',
    ]);
  });
});
