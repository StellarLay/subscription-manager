import { describe, expect, it } from 'vitest';

import { formatSubscriptionPeriod, getMonthlyBillingFactor } from './subscription-schedule';

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
});
