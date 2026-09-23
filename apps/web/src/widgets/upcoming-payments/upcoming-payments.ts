import type { SubscriptionResponseDto } from '@subscription-manager/api-client';

export type UpcomingPaymentGroupId = 'overdue' | 'today' | 'week' | 'later';

export interface UpcomingPaymentGroup {
  id: UpcomingPaymentGroupId;
  title: string;
  subscriptions: SubscriptionResponseDto[];
}

const dayInMilliseconds = 24 * 60 * 60 * 1000;

function dateKeyToDayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid calendar date: ${dateKey}`);
  }

  return Math.floor(Date.UTC(year, month - 1, day) / dayInMilliseconds);
}

export function getLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getDaysUntilCharge(nextChargeDate: string, today: Date): number {
  return dateKeyToDayNumber(nextChargeDate) - dateKeyToDayNumber(getLocalDateKey(today));
}

export function groupUpcomingPayments(
  subscriptions: SubscriptionResponseDto[],
  today: Date,
): UpcomingPaymentGroup[] {
  const groups: UpcomingPaymentGroup[] = [
    {
      id: 'overdue',
      title: 'Дата прошла',
      subscriptions: [],
    },
    {
      id: 'today',
      title: 'Сегодня',
      subscriptions: [],
    },
    {
      id: 'week',
      title: 'Следующие 7 дней',
      subscriptions: [],
    },
    {
      id: 'later',
      title: 'Позже',
      subscriptions: [],
    },
  ];

  const activeSubscriptions = subscriptions
    .filter(({ status }) => status === 'ACTIVE')
    .sort((left, right) => left.nextChargeDate.localeCompare(right.nextChargeDate));

  for (const subscription of activeSubscriptions) {
    const daysUntilCharge = getDaysUntilCharge(subscription.nextChargeDate, today);
    const groupId: UpcomingPaymentGroupId =
      daysUntilCharge < 0
        ? 'overdue'
        : daysUntilCharge === 0
          ? 'today'
          : daysUntilCharge <= 7
            ? 'week'
            : 'later';

    groups.find(({ id }) => id === groupId)?.subscriptions.push(subscription);
  }

  return groups;
}
