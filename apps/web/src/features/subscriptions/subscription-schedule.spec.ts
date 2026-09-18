import { describe, expect, it } from 'vitest';

import {
  calculateMonthlyRubTotal,
  formatSubscriptionPeriod,
  getMonthlyBillingFactor,
} from './subscription-schedule';

describe('subscription schedule presentation', () => {
  it('formats standard and custom intervals in Russian', () => {
    expect(formatSubscriptionPeriod('MONTH', 1)).toBe('в месяц');
    expect(formatSubscriptionPeriod('MONTH', 2)).toBe('раз в 2 месяца');
    expect(formatSubscriptionPeriod('CUSTOM', 21)).toBe('раз в 21 день');
    expect(formatSubscriptionPeriod('CUSTOM', 45)).toBe('раз в 45 дней');
  });

  it('uses the interval in the monthly forecast', () => {
    expect(getMonthlyBillingFactor('MONTH', 2)).toBe(0.5);
    expect(getMonthlyBillingFactor('CUSTOM', 30)).toBeCloseTo(1.0145625);
  });

  it('converts every subscription to rubles before calculating the total', () => {
    expect(
      calculateMonthlyRubTotal(
        [
          { amount: '699.00', billingPeriod: 'MONTH', currency: 'RUB', interval: 1 },
          { amount: '23.00', billingPeriod: 'MONTH', currency: 'USD', interval: 1 },
          { amount: '120.00', billingPeriod: 'YEAR', currency: 'EUR', interval: 1 },
        ],
        { EUR: 99.3304, RUB: 1, USD: 84.5093 },
      ),
    ).toBeCloseTo(3636.0179);
  });

  it('does not show a partial total when a required rate is missing', () => {
    expect(
      calculateMonthlyRubTotal(
        [{ amount: '23.00', billingPeriod: 'MONTH', currency: 'USD', interval: 1 }],
        { RUB: 1 },
      ),
    ).toBeNull();
  });
});
