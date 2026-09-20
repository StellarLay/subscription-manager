import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../database/prisma.service';
import type { CurrentUserService } from '../users/current-user.service';
import { BillingPeriod } from '../generated/prisma/client';
import { Currency } from './dto/create-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

afterEach(() => {
  vi.useRealTimers();
});

describe('SubscriptionsService', () => {
  it('creates a Telegram reminder for each new subscription', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'subscription-id',
      name: 'Cloud storage',
      amount: { toFixed: () => '799.00' },
      currency: 'RUB',
      billingPeriod: 'MONTH',
      interval: 1,
      billingAnchorDay: 21,
      nextChargeDate: new Date('2026-09-21T00:00:00.000Z'),
      status: 'ACTIVE',
      category: null,
      paymentMethod: null,
      createdAt: new Date('2026-09-20T00:00:00.000Z'),
    });
    const service = new SubscriptionsService(
      { recurringPayment: { create } } as unknown as PrismaService,
      { getId: vi.fn().mockResolvedValue('user-id') } as unknown as CurrentUserService,
    );

    await service.create({
      name: 'Cloud storage',
      amount: 799,
      currency: Currency.RUB,
      billingPeriod: BillingPeriod.MONTH,
      nextChargeDate: '2026-09-21',
    });

    const input = create.mock.calls[0]?.[0] as {
      data: { reminderRules: { create: { channel: string; daysBefore: number } } };
    };
    expect(input.data.reminderRules.create).toMatchObject({ channel: 'TELEGRAM', daysBefore: 1 });
  });

  it('returns the next scheduled charge in the user timezone without changing payment data', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28T22:30:00.000Z'));

    const findUnique = vi.fn().mockResolvedValue({ timezone: 'Europe/Moscow' });
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'subscription-id',
        name: 'Cloud storage',
        amount: { toFixed: () => '799.00' },
        currency: 'RUB',
        billingPeriod: 'MONTH',
        interval: 1,
        billingAnchorDay: 31,
        nextChargeDate: new Date('2026-01-31T00:00:00.000Z'),
        status: 'ACTIVE',
        category: null,
        paymentMethod: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const prisma = {
      user: { findUnique },
      recurringPayment: { findMany },
    } as unknown as PrismaService;
    const currentUser = {
      getId: vi.fn().mockResolvedValue('user-id'),
    } as unknown as CurrentUserService;
    const service = new SubscriptionsService(prisma, currentUser);

    await expect(service.findAll()).resolves.toMatchObject([
      { id: 'subscription-id', nextChargeDate: '2026-03-31' },
    ]);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      select: { timezone: true },
    });
    expect(findMany).toHaveBeenCalledOnce();
  });
});
