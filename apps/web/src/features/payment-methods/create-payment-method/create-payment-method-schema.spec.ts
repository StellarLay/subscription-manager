import { CreatePaymentMethodBody } from '@subscription-manager/api-client';
import { describe, expect, it } from 'vitest';

describe('CreatePaymentMethodBody', () => {
  it('accepts safe card metadata', () => {
    const result = CreatePaymentMethodBody.safeParse({
      name: 'Тинькофф Black',
      type: 'CARD',
      lastFour: '4242',
      color: '#73ff5b',
    });

    expect(result.success).toBe(true);
  });

  it('does not accept a full card number', () => {
    const result = CreatePaymentMethodBody.safeParse({
      name: 'Основная карта',
      type: 'CARD',
      lastFour: '2200123412341234',
      color: '#73ff5b',
    });

    expect(result.success).toBe(false);
  });
});
