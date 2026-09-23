import { describe, expect, it } from 'vitest';

import { isStandaloneDate, nextDateForDay, parseUserDate } from './date-parser';

const today = '2026-09-22';

describe('parseUserDate', () => {
  it.each([
    ['26 октября', '2026-10-26'],
    ['26-го октября', '2026-10-26'],
    ['26 окт.', '2026-10-26'],
    ['26.10', '2026-10-26'],
    ['26/10/2026', '2026-10-26'],
    ['26-10-26', '2026-10-26'],
    ['2026-10-26', '2026-10-26'],
    ['списание 15-го', '2026-10-15'],
    ['26-го', '2026-09-26'],
    ['завтра', '2026-09-23'],
    ['через 5 дней', '2026-09-27'],
    ['1 января', '2027-01-01'],
    ['29 февраля', '2028-02-29'],
  ])('understands %s', (input, expected) => {
    expect(parseUserDate(input, today)).toEqual({ date: expected, mentioned: true });
  });

  it('asks again for impossible or past explicit dates', () => {
    expect(parseUserDate('31.02', today)).toEqual({ date: null, mentioned: true });
    expect(parseUserDate('26.10.2025', today)).toEqual({ date: null, mentioned: true });
  });

  it('can read a past purchase date without accepting it as a future charge', () => {
    expect(parseUserDate('купил 20.09.26', '2026-09-23', true)).toEqual({
      date: '2026-09-20',
      mentioned: true,
    });
    expect(parseUserDate('купил 20.09.26', '2026-09-23')).toEqual({
      date: null,
      mentioned: true,
    });
  });

  it('does not invent a date when none is present', () => {
    expect(parseUserDate('Добавь Netflix за 799 ₽', today)).toEqual({
      date: null,
      mentioned: false,
    });
  });

  it('recognizes short date-only answers without treating a full request as one', () => {
    expect(isStandaloneDate('26 октября')).toBe(true);
    expect(isStandaloneDate('26.10')).toBe(true);
    expect(isStandaloneDate('списание 26 октября')).toBe(true);
    expect(isStandaloneDate('Добавь Netflix за 799 ₽, списание 26 октября')).toBe(false);
  });
});

describe('nextDateForDay', () => {
  it('rolls day-only dates and skips months without that day', () => {
    expect(nextDateForDay(15, today)).toBe('2026-10-15');
    expect(nextDateForDay(31, '2026-04-01')).toBe('2026-05-31');
    expect(nextDateForDay(29, '2027-02-01')).toBe('2027-03-29');
  });
});
