import { describe, expect, it } from 'vitest';

import { formatReminderTime } from './reminder-time.js';

describe('formatReminderTime', () => {
  it.each([
    [0, '00:00'],
    [600, '10:00'],
    [817, '13:37'],
    [1439, '23:59'],
  ])('formats minute %i as %s', (minutes, expected) => {
    expect(formatReminderTime(minutes)).toBe(expected);
  });
});
