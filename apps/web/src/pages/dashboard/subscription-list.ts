import type { SubscriptionResponseDto } from '@subscription-manager/api-client';

export type SubscriptionSort = 'date-asc' | 'date-desc' | 'name-asc' | 'name-desc' | 'created-desc';

interface SubscriptionListOptions {
  categoryId: string | null;
  paymentMethodId: string | null;
  query: string;
  sort: SubscriptionSort;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase('ru-RU');
}

export function filterAndSortSubscriptions(
  subscriptions: SubscriptionResponseDto[],
  { categoryId, paymentMethodId, query, sort }: SubscriptionListOptions,
): SubscriptionResponseDto[] {
  const normalizedQuery = normalizeSearchValue(query);
  const filteredSubscriptions = subscriptions.filter((subscription) => {
    if (categoryId && subscription.category?.id !== categoryId) return false;
    if (paymentMethodId && subscription.paymentMethod?.id !== paymentMethodId) return false;
    if (!normalizedQuery) return true;

    return [
      subscription.name,
      subscription.category?.name,
      subscription.paymentMethod?.name,
      subscription.paymentMethod?.lastFour,
    ].some((value) => value && normalizeSearchValue(value).includes(normalizedQuery));
  });

  return filteredSubscriptions.sort((left, right) => {
    switch (sort) {
      case 'date-desc':
        return right.nextChargeDate.localeCompare(left.nextChargeDate);
      case 'name-asc':
        return left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' });
      case 'name-desc':
        return right.name.localeCompare(left.name, 'ru', { sensitivity: 'base' });
      case 'created-desc':
        return right.createdAt.localeCompare(left.createdAt);
      case 'date-asc':
      default:
        return left.nextChargeDate.localeCompare(right.nextChargeDate);
    }
  });
}
