export type BillingPeriod = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';

export interface NextChargeDateInput {
  currentDate: string;
  billingPeriod: BillingPeriod;
  interval?: number;
  anchorDay?: number;
}

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(dateKey: string): Date {
  if (!dateKeyPattern.test(dateKey)) {
    throw new Error(`Invalid calendar date: ${dateKey}`);
  }

  const [year, month, day] = dateKey.split('-').map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid calendar date: ${dateKey}`);
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${dateKey}`);
  }

  return date;
}

function formatDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);

  return result;
}

function addMonths(date: Date, months: number, anchorDay: number): Date {
  const targetMonthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return new Date(Date.UTC(targetYear, targetMonth, Math.min(anchorDay, lastDayOfTargetMonth)));
}

export function calculateNextChargeDate({
  currentDate,
  billingPeriod,
  interval = 1,
  anchorDay,
}: NextChargeDateInput): string {
  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error('Billing interval must be a positive integer');
  }

  const date = parseDateKey(currentDate);
  const resolvedAnchorDay = anchorDay ?? date.getUTCDate();

  if (!Number.isInteger(resolvedAnchorDay) || resolvedAnchorDay < 1 || resolvedAnchorDay > 31) {
    throw new Error('Billing anchor day must be between 1 and 31');
  }

  switch (billingPeriod) {
    case 'WEEK':
      return formatDateKey(addDays(date, interval * 7));
    case 'MONTH':
      return formatDateKey(addMonths(date, interval, resolvedAnchorDay));
    case 'QUARTER':
      return formatDateKey(addMonths(date, interval * 3, resolvedAnchorDay));
    case 'YEAR':
      return formatDateKey(addMonths(date, interval * 12, resolvedAnchorDay));
    case 'CUSTOM':
      return formatDateKey(addDays(date, interval));
    default: {
      const exhaustiveCheck: never = billingPeriod;
      void exhaustiveCheck;
      throw new Error('Unsupported billing period');
    }
  }
}
