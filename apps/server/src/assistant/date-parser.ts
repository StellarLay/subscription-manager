export interface ParsedUserDate {
  date: string | null;
  mentioned: boolean;
}

function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateKey(year: number, month: number, day: number): string | null {
  const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return validDate(value) ? value : null;
}

function upcomingDate(day: number, month: number, today: string): string | null {
  const currentYear = Number(today.slice(0, 4));
  for (let year = currentYear; year <= currentYear + 8; year += 1) {
    const candidate = dateKey(year, month, day);
    if (candidate && candidate >= today) return candidate;
  }
  return null;
}

export function nextDateForDay(day: number, today: string): string | null {
  if (!Number.isInteger(day) || day < 1 || day > 31 || !validDate(today)) return null;
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  for (let offset = 0; offset < 24; offset += 1) {
    const candidateMonth = new Date(Date.UTC(year, month - 1 + offset, 1));
    const candidate = dateKey(
      candidateMonth.getUTCFullYear(),
      candidateMonth.getUTCMonth() + 1,
      day,
    );
    if (candidate && candidate >= today) return candidate;
  }
  return null;
}

function addDays(today: string, days: number): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const monthPrefixes = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май|мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

function monthFromWord(word: string): number | null {
  const normalized = word.toLowerCase().replace(/ё/gu, 'е');
  const index = monthPrefixes.findIndex((prefixes) =>
    prefixes.split('|').some((prefix) => normalized.startsWith(prefix)),
  );
  return index < 0 ? null : index + 1;
}

export function parseUserDate(message: string, today: string): ParsedUserDate {
  if (!validDate(today)) return { date: null, mentioned: false };
  const text = message.trim().toLowerCase();
  const iso = text.match(/(?:^|\D)(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?=\D|$)/u);
  if (iso) {
    const date = dateKey(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return { date: date && date >= today ? date : null, mentioned: true };
  }

  const numeric = text.match(/(?:^|\D)(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?(?=\D|$)/u);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const rawYear = numeric[3];
    const year = rawYear
      ? rawYear.length === 2
        ? Math.floor(Number(today.slice(0, 4)) / 100) * 100 + Number(rawYear)
        : Number(rawYear)
      : null;
    const date = year ? dateKey(year, month, day) : upcomingDate(day, month, today);
    return { date: date && date >= today ? date : null, mentioned: true };
  }

  const namedMonth = text.match(
    /(?:^|\D)(\d{1,2})(?:-го|-е)?\s+([а-яё]{3,12})\.?(?:\s+(\d{4}))?/iu,
  );
  if (namedMonth) {
    const month = monthFromWord(namedMonth[2] ?? '');
    if (month) {
      const day = Number(namedMonth[1]);
      const date = namedMonth[3]
        ? dateKey(Number(namedMonth[3]), month, day)
        : upcomingDate(day, month, today);
      return { date: date && date >= today ? date : null, mentioned: true };
    }
  }

  if (/послезавтра/iu.test(text)) return { date: addDays(today, 2), mentioned: true };
  if (/завтра/iu.test(text)) return { date: addDays(today, 1), mentioned: true };
  if (/сегодня/iu.test(text)) return { date: today, mentioned: true };
  const inDays = text.match(/через\s+(\d{1,3})\s+д(?:ень|ня|ней)/iu);
  if (inDays) return { date: addDays(today, Number(inDays[1])), mentioned: true };

  const chargeDay =
    text.match(
      /(?:списан[а-яё]*|оплат[а-яё]*|каждого)\s+(?:каждого\s+)?(\d{1,2})(?:-го|-е)?(?=\s|$|[,.;!?])/iu,
    ) ?? text.match(/^(\d{1,2})(?:-го|-е)?$/iu);
  if (chargeDay) return { date: nextDateForDay(Number(chargeDay[1]), today), mentioned: true };
  return { date: null, mentioned: false };
}

export function isStandaloneDate(message: string): boolean {
  const text = message
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/u, '')
    .trim();
  return /^(?:(?:списание|дата)\s+(?:на\s+)?)?(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}(?:-го|-е)?(?:[./-]\d{1,2}(?:[./-]\d{2,4})?|\s+[а-яё]{3,12}(?:\s+\d{4})?)?|сегодня|завтра|послезавтра|через\s+\d{1,3}\s+д(?:ень|ня|ней))$/iu.test(
    text,
  );
}
