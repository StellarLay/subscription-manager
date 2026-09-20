import { describe, expect, it } from 'vitest';

import {
  calculateNextChargeDate,
  calculateUpcomingChargeDate,
  formatDateKeyInTimeZone,
} from './recurrence';

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

describe('calculateUpcomingChargeDate', () => {
  it('uses the user calendar day rather than the server UTC day', () => {
    const instant = new Date('2026-09-20T22:30:00.000Z');

    expect(formatDateKeyInTimeZone(instant, 'UTC')).toBe('2026-09-20');
    expect(formatDateKeyInTimeZone(instant, 'Europe/Moscow')).toBe('2026-09-21');
  });
  it('keeps a charge due today and advances it the next day', () => {
    const input = { currentDate: '2026-09-20', billingPeriod: 'MONTH' as const };

    expect(calculateUpcomingChargeDate({ ...input, asOfDate: '2026-09-20' })).toBe('2026-09-20');
    expect(calculateUpcomingChargeDate({ ...input, asOfDate: '2026-09-21' })).toBe('2026-10-20');
  });

  it('skips missed cycles without losing the original end-of-month anchor', () => {
    expect(
      calculateUpcomingChargeDate({
        currentDate: '2026-01-31',
        asOfDate: '2026-02-28',
        billingPeriod: 'MONTH',
        anchorDay: 31,
      }),
    ).toBe('2026-02-28');
    expect(
      calculateUpcomingChargeDate({
        currentDate: '2026-01-31',
        asOfDate: '2026-03-01',
        billingPeriod: 'MONTH',
        anchorDay: 31,
      }),
    ).toBe('2026-03-31');
  });

  it('fast-forwards weekly, custom, quarterly and yearly schedules', () => {
    expect(
      calculateUpcomingChargeDate({
        currentDate: '2026-01-01',
        asOfDate: '2026-02-10',
        billingPeriod: 'WEEK',
        interval: 2,
      }),
    ).toBe('2026-02-12');
    expect(
      calculateUpcomingChargeDate({
        currentDate: '2026-01-01',
        asOfDate: '2026-01-11',
        billingPeriod: 'CUSTOM',
        interval: 5,
      }),
    ).toBe('2026-01-11');
    expect(
      calculateUpcomingChargeDate({
        currentDate: '2026-01-31',
        asOfDate: '2026-08-01',
        billingPeriod: 'QUARTER',
        anchorDay: 31,
      }),
    ).toBe('2026-10-31');
    expect(
      calculateUpcomingChargeDate({
        currentDate: '2024-02-29',
        asOfDate: '2027-03-01',
        billingPeriod: 'YEAR',
        anchorDay: 29,
      }),
    ).toBe('2028-02-29');
  });
});
