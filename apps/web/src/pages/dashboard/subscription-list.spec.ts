import type { SubscriptionResponseDto } from '@subscription-manager/api-client';
import { describe, expect, it } from 'vitest';

import { filterAndSortSubscriptions } from './subscription-list';

const subscriptions: SubscriptionResponseDto[] = [
  {
    id: 'cloud',
    name: 'Облачное хранилище',
    category: {
      id: 'category-cloud',
      name: 'Облака',
      color: '#5bd8ff',
      icon: 'CLOUD',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    amount: '699.00',
    currency: 'RUB',
    billingPeriod: 'MONTH',
    nextChargeDate: '2026-09-25',
    status: 'ACTIVE',
    paymentMethod: {
      id: 'main-card',
      name: 'Основная карта',
      lastFour: '4242',
      type: 'CARD',
      color: '#73ff5b',
    },
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'music',
    name: 'Музыка',
    category: {
      id: 'category-fun',
      name: 'Развлечения',
      color: '#ff6b8a',
      icon: 'ENTERTAINMENT',
      createdAt: '2026-09-02T00:00:00.000Z',
    },
    amount: '299.00',
    currency: 'RUB',
    billingPeriod: 'MONTH',
    nextChargeDate: '2026-09-20',
    status: 'ACTIVE',
    paymentMethod: null,
    createdAt: '2026-09-02T00:00:00.000Z',
  },
];

describe('filterAndSortSubscriptions', () => {
  it('searches by subscription, category, payment method and card digits', () => {
    for (const query of ['хранилище', 'облака', 'основная', '4242']) {
      const result = filterAndSortSubscriptions(subscriptions, {
        categoryId: null,
        paymentMethodId: null,
        query,
        sort: 'date-asc',
      });

      expect(result.map(({ id }) => id)).toEqual(['cloud']);
    }
  });

  it('combines filters and sorts without mutating the source list', () => {
    const sourceOrder = subscriptions.map(({ id }) => id);
    const result = filterAndSortSubscriptions(subscriptions, {
      categoryId: null,
      paymentMethodId: null,
      query: '',
      sort: 'date-asc',
    });

    expect(result.map(({ id }) => id)).toEqual(['music', 'cloud']);
    expect(subscriptions.map(({ id }) => id)).toEqual(sourceOrder);
  });

  it('filters by category and payment method', () => {
    expect(
      filterAndSortSubscriptions(subscriptions, {
        categoryId: 'category-cloud',
        paymentMethodId: 'main-card',
        query: '',
        sort: 'name-asc',
      }).map(({ id }) => id),
    ).toEqual(['cloud']);
  });
});
