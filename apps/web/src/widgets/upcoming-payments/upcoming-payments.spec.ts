import type { SubscriptionResponseDto } from '@subscription-manager/api-client';
import { describe, expect, it } from 'vitest';

import { getDaysUntilCharge, getLocalDateKey, groupUpcomingPayments } from './upcoming-payments';

function createSubscription(
  id: string,
  nextChargeDate: string,
  status: SubscriptionResponseDto['status'] = 'ACTIVE',
): SubscriptionResponseDto {
  return {
    id,
    name: id,
    amount: '100.00',
    currency: 'RUB',
    billingPeriod: 'MONTH',
    interval: 1,
    nextChargeDate,
    status,
    createdAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('upcoming payments', () => {
  const today = new Date(2026, 8, 18, 18, 30);

  it('creates a local date key without shifting the calendar day', () => {
    expect(getLocalDateKey(today)).toBe('2026-09-18');
  });

  it('calculates calendar-day distance', () => {
    expect(getDaysUntilCharge('2026-09-17', today)).toBe(-1);
    expect(getDaysUntilCharge('2026-09-18', today)).toBe(0);
    expect(getDaysUntilCharge('2026-09-25', today)).toBe(7);
  });

  it('groups active subscriptions by urgency and sorts each group by date', () => {
    const subscriptions = [
      createSubscription('later', '2026-10-01'),
      createSubscription('week-second', '2026-09-25'),
      createSubscription('overdue', '2026-09-12'),
      createSubscription('today', '2026-09-18'),
      createSubscription('week-first', '2026-09-19'),
      createSubscription('archived', '2026-09-18', 'ARCHIVED'),
    ];

    const groups = groupUpcomingPayments(subscriptions, today);

    expect(
      Object.fromEntries(
        groups.map((group) => [
          group.id,
          group.subscriptions.map((subscription) => subscription.id),
        ]),
      ),
    ).toEqual({
      overdue: ['overdue'],
      today: ['today'],
      week: ['week-first', 'week-second'],
      later: ['later'],
    });
    expect(subscriptions.map(({ id }) => id)).toEqual([
      'later',
      'week-second',
      'overdue',
      'today',
      'week-first',
      'archived',
    ]);
  });
});
