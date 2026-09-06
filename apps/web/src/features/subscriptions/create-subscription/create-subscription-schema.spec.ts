import { CreateSubscriptionBody } from '@subscription-manager/api-client';
import { describe, expect, it } from 'vitest';

describe('CreateSubscriptionBody', () => {
  it('accepts values submitted by the subscription form', () => {
    const result = CreateSubscriptionBody.safeParse({
      name: 'YouTube Premium',
      amount: 799,
      currency: 'RUB',
      billingPeriod: 'MONTH',
      nextChargeDate: '2026-09-15',
      category: 'Развлечения',
    });

    expect(result.success).toBe(true);
  });

  it('rejects incomplete values before the request is sent', () => {
    const result = CreateSubscriptionBody.safeParse({
      name: '',
      amount: 0,
      currency: 'BTC',
      billingPeriod: 'MONTH',
      nextChargeDate: 'tomorrow',
    });

    expect(result.success).toBe(false);
  });
});
