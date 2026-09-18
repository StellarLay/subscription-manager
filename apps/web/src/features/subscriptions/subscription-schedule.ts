import type { SubscriptionResponseDto } from '@subscription-manager/api-client';

type BillingPeriod = SubscriptionResponseDto['billingPeriod'];

const singlePeriodLabels: Record<BillingPeriod, string> = {
  WEEK: 'в неделю',
  MONTH: 'в месяц',
  QUARTER: 'в квартал',
  YEAR: 'в год',
  CUSTOM: 'каждый день',
};

const periodUnits: Record<BillingPeriod, [string, string, string]> = {
  WEEK: ['неделю', 'недели', 'недель'],
  MONTH: ['месяц', 'месяца', 'месяцев'],
  QUARTER: ['квартал', 'квартала', 'кварталов'],
  YEAR: ['год', 'года', 'лет'],
  CUSTOM: ['день', 'дня', 'дней'],
};

function pluralize(value: number, [one, few, many]: [string, string, string]): string {
  const lastTwoDigits = value % 100;
  const lastDigit = value % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return many;
  if (lastDigit === 1) return one;
  if (lastDigit >= 2 && lastDigit <= 4) return few;

  return many;
}

function normalizeInterval(interval: number): number {
  return Number.isInteger(interval) && interval > 0 ? interval : 1;
}

export function formatSubscriptionPeriod(period: BillingPeriod, interval: number): string {
  const normalizedInterval = normalizeInterval(interval);

  if (normalizedInterval === 1) return singlePeriodLabels[period];

  return `раз в ${normalizedInterval} ${pluralize(normalizedInterval, periodUnits[period])}`;
}

export function getMonthlyBillingFactor(period: BillingPeriod, interval: number): number {
  const normalizedInterval = normalizeInterval(interval);

  switch (period) {
    case 'WEEK':
      return 52 / 12 / normalizedInterval;
    case 'MONTH':
      return 1 / normalizedInterval;
    case 'QUARTER':
      return 1 / 3 / normalizedInterval;
    case 'YEAR':
      return 1 / 12 / normalizedInterval;
    case 'CUSTOM':
      return 365.2425 / 12 / normalizedInterval;
  }
}
