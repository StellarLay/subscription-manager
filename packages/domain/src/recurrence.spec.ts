import { describe, expect, it } from 'vitest';

import { calculateNextChargeDate } from './recurrence';

describe('calculateNextChargeDate', () => {
  it('adds weekly and custom day intervals across month boundaries', () => {
    expect(
      calculateNextChargeDate({
        currentDate: '2026-01-30',
        billingPeriod: 'WEEK',
        interval: 2,
      }),
    ).toBe('2026-02-13');
    expect(
      calculateNextChargeDate({
        currentDate: '2026-12-28',
        billingPeriod: 'CUSTOM',
        interval: 10,
      }),
    ).toBe('2027-01-07');
  });

  it('keeps the original billing day after a short month', () => {
    const february = calculateNextChargeDate({
      currentDate: '2026-01-31',
      billingPeriod: 'MONTH',
      anchorDay: 31,
    });
    const march = calculateNextChargeDate({
      currentDate: february,
      billingPeriod: 'MONTH',
      anchorDay: 31,
    });

    expect(february).toBe('2026-02-28');
    expect(march).toBe('2026-03-31');
  });

  it('uses February 29 in a leap year', () => {
    expect(
      calculateNextChargeDate({
        currentDate: '2028-01-31',
        billingPeriod: 'MONTH',
        anchorDay: 31,
      }),
    ).toBe('2028-02-29');
  });

  it('restores February 29 for annual subscriptions after a non-leap year', () => {
    const nonLeapYear = calculateNextChargeDate({
      currentDate: '2024-02-29',
      billingPeriod: 'YEAR',
      anchorDay: 29,
    });
    const nextLeapYear = calculateNextChargeDate({
      currentDate: '2027-02-28',
      billingPeriod: 'YEAR',
      anchorDay: 29,
    });

    expect(nonLeapYear).toBe('2025-02-28');
    expect(nextLeapYear).toBe('2028-02-29');
  });

  it('preserves the billing day for quarterly payments', () => {
    expect(
      calculateNextChargeDate({
        currentDate: '2026-11-30',
        billingPeriod: 'QUARTER',
        anchorDay: 30,
      }),
    ).toBe('2027-02-28');
  });

  it('rejects invalid calendar input', () => {
    expect(() =>
      calculateNextChargeDate({ currentDate: '2026-02-30', billingPeriod: 'MONTH' }),
    ).toThrow('Invalid calendar date');
    expect(() =>
      calculateNextChargeDate({
        currentDate: '2026-09-18',
        billingPeriod: 'MONTH',
        interval: 0,
      }),
    ).toThrow('positive integer');
    expect(() =>
      calculateNextChargeDate({
        currentDate: '2026-09-18',
        billingPeriod: 'MONTH',
        anchorDay: 32,
      }),
    ).toThrow('between 1 and 31');
  });
});
