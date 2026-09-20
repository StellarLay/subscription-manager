export type BillingPeriod = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';

export interface NextChargeDateInput {
  currentDate: string;
  billingPeriod: BillingPeriod;
  interval?: number;
  anchorDay?: number;
}

export interface UpcomingChargeDateInput extends NextChargeDateInput {
  asOfDate: string;
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

export function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: 'year' | 'month' | 'day') => parts.find((item) => item.type === type)?.value;

  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function dateTimeInTimeZoneToUtc(
  dateKey: string,
  minutesAfterMidnight: number,
  timeZone: string,
): Date {
  const date = parseDateKey(dateKey);
  if (
    !Number.isInteger(minutesAfterMidnight) ||
    minutesAfterMidnight < 0 ||
    minutesAfterMidnight >= 1440
  ) {
    throw new Error('Time of day must be between 00:00 and 23:59');
  }

  const target = date.getTime() + minutesAfterMidnight * 60_000;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  let candidate = target;

  // Morning reminder times are unambiguous even in time zones with DST.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(candidate));
    const numberPart = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const observed = Date.UTC(
      numberPart('year'),
      numberPart('month') - 1,
      numberPart('day'),
      numberPart('hour'),
      numberPart('minute'),
    );
    const difference = target - observed;
    candidate += difference;
    if (difference === 0) break;
  }

  return new Date(candidate);
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

export function calculateUpcomingChargeDate({
  currentDate,
  asOfDate,
  billingPeriod,
  interval = 1,
  anchorDay,
}: UpcomingChargeDateInput): string {
  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error('Billing interval must be a positive integer');
  }

  const current = parseDateKey(currentDate);
  const asOf = parseDateKey(asOfDate);
  const resolvedAnchorDay = anchorDay ?? current.getUTCDate();

  if (!Number.isInteger(resolvedAnchorDay) || resolvedAnchorDay < 1 || resolvedAnchorDay > 31) {
    throw new Error('Billing anchor day must be between 1 and 31');
  }

  if (current >= asOf) return currentDate;

  if (billingPeriod === 'WEEK' || billingPeriod === 'CUSTOM') {
    const daysPerCycle = billingPeriod === 'WEEK' ? interval * 7 : interval;
    const elapsedDays = Math.floor((asOf.getTime() - current.getTime()) / 86_400_000);
    return formatDateKey(addDays(current, Math.ceil(elapsedDays / daysPerCycle) * daysPerCycle));
  }

  const monthsPerCycle =
    billingPeriod === 'MONTH'
      ? interval
      : billingPeriod === 'QUARTER'
        ? interval * 3
        : interval * 12;
  const elapsedMonths =
    (asOf.getUTCFullYear() - current.getUTCFullYear()) * 12 +
    asOf.getUTCMonth() -
    current.getUTCMonth();
  const cycles = Math.max(0, Math.floor(elapsedMonths / monthsPerCycle));
  let next = addMonths(current, cycles * monthsPerCycle, resolvedAnchorDay);

  if (next < asOf) {
    next = addMonths(current, (cycles + 1) * monthsPerCycle, resolvedAnchorDay);
  }

  return formatDateKey(next);
}
