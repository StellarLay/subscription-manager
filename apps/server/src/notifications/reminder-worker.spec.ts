import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../database/prisma.service';
import { ReminderWorker } from './reminder-worker';

afterEach(() => {
  vi.unstubAllGlobals();
});

const now = new Date('2026-09-20T07:01:00.000Z');

function dueDelivery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'delivery-id',
    attemptCount: 1,
    reminderRule: {
      enabled: true,
      channel: 'TELEGRAM',
      daysBefore: 1,
      timeOfDayMinutes: 600,
    },
    occurrence: {
      scheduledFor: new Date('2026-09-21T00:00:00.000Z'),
      recurringPayment: {
        id: 'subscription-id',
        name: 'Облачное хранилище',
        amount: { toString: () => '799.00' },
        currency: 'RUB',
        status: 'ACTIVE',
        archivedAt: null,
        nextChargeDate: new Date('2026-09-21T00:00:00.000Z'),
        billingPeriod: 'MONTH',
        interval: 1,
        billingAnchorDay: 21,
        paymentMethod: { name: 'Основная карта', lastFour: '4242' },
        user: {
          id: 'user-id',
          status: 'ACTIVE',
          timezone: 'Europe/Moscow',
          notificationsEnabled: true,
          reminderTimeMinutes: 600,
          botStartedAt: new Date('2026-09-01T00:00:00.000Z'),
          telegramId: 12345n,
        },
      },
    },
    ...overrides,
  };
}

describe('ReminderWorker', () => {
  it('plans one Telegram reminder for tomorrow in the user timezone', async () => {
    const subscription = {
      id: 'subscription-id',
      amount: '799.00',
      currency: 'RUB',
      nextChargeDate: new Date('2026-09-21T00:00:00.000Z'),
      billingPeriod: 'MONTH',
      interval: 1,
      billingAnchorDay: 21,
      user: { timezone: 'Europe/Moscow', reminderTimeMinutes: 600 },
      reminderRules: [
        {
          id: 'rule-id',
          enabled: true,
          channel: 'TELEGRAM',
          daysBefore: 1,
          timeOfDayMinutes: 600,
        },
      ],
    };
    const upsertDelivery = vi.fn().mockResolvedValue({});
    const prisma = {
      recurringPayment: { findMany: vi.fn().mockResolvedValue([subscription]) },
      paymentOccurrence: { upsert: vi.fn().mockResolvedValue({ id: 'occurrence-id' }) },
      notificationDelivery: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: upsertDelivery,
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;

    await new ReminderWorker(prisma, 'test-token', 'https://subsio.ru').tick(now);

    const planned = upsertDelivery.mock.calls[0]?.[0] as {
      create: { idempotencyKey: string; scheduledAt: Date };
    };
    expect(planned.create.idempotencyKey).toBe('rule-id:2026-09-21');
    expect(planned.create.scheduledAt).toEqual(new Date('2026-09-20T07:00:00.000Z'));
  });

  it('moves an unsent reminder to the time selected in the bot', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      recurringPayment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'subscription-id',
            amount: '799.00',
            currency: 'RUB',
            nextChargeDate: new Date('2026-09-21T00:00:00.000Z'),
            billingPeriod: 'MONTH',
            interval: 1,
            billingAnchorDay: 21,
            user: { timezone: 'Europe/Moscow', reminderTimeMinutes: 817 },
            reminderRules: [
              {
                id: 'rule-id',
                enabled: true,
                channel: 'TELEGRAM',
                daysBefore: 1,
                timeOfDayMinutes: 600,
              },
            ],
          },
        ]),
      },
      paymentOccurrence: { upsert: vi.fn().mockResolvedValue({ id: 'occurrence-id' }) },
      notificationDelivery: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          status: 'PENDING',
          attemptCount: 0,
          scheduledAt: new Date('2026-09-20T07:00:00.000Z'),
        }),
        update,
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;

    await new ReminderWorker(prisma, 'test-token', 'https://subsio.ru').tick(now);

    expect(update).toHaveBeenCalledWith({
      where: { idempotencyKey: 'rule-id:2026-09-21' },
      data: { scheduledAt: new Date('2026-09-20T10:37:00.000Z') },
    });
  });

  it('sends a due reminder with Mini App button and marks it sent', async () => {
    const send = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal('fetch', send);
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      recurringPayment: { findMany: vi.fn().mockResolvedValue([]) },
      notificationDelivery: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: 'delivery-id' }]),
        findUniqueOrThrow: vi.fn().mockResolvedValue(dueDelivery()),
        update,
      },
    } as unknown as PrismaService;

    await new ReminderWorker(prisma, 'test-token', 'https://subsio.ru').tick(now);

    expect(send).toHaveBeenCalledOnce();
    const request = send.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      chat_id: '12345',
      reply_markup: {
        inline_keyboard: [[{ web_app: { url: 'https://subsio.ru' } }]],
      },
    });
    const sent = update.mock.calls.at(-1)?.[0] as { data: { status: string } };
    expect(sent.data.status).toBe('SENT');
  });

  it('cancels an outdated delivery after the subscription is archived', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    const update = vi.fn().mockResolvedValue({});
    const delivery = dueDelivery();
    delivery.occurrence.recurringPayment.status = 'ARCHIVED';
    const prisma = {
      recurringPayment: { findMany: vi.fn().mockResolvedValue([]) },
      notificationDelivery: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: 'delivery-id' }]),
        findUniqueOrThrow: vi.fn().mockResolvedValue(delivery),
        update,
      },
    } as unknown as PrismaService;

    await new ReminderWorker(prisma, 'test-token', 'https://subsio.ru').tick(now);

    expect(send).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CANCELLED' } }));
  });

  it('reschedules a rate-limited delivery using Telegram retry_after', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({ ok: false, error_code: 429, parameters: { retry_after: 120 } }),
      }),
    );
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      recurringPayment: { findMany: vi.fn().mockResolvedValue([]) },
      notificationDelivery: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: 'delivery-id' }]),
        findUniqueOrThrow: vi.fn().mockResolvedValue(dueDelivery()),
        update,
      },
    } as unknown as PrismaService;

    await new ReminderWorker(prisma, 'test-token', 'https://subsio.ru').tick(now);

    const retried = update.mock.calls.at(-1)?.[0] as {
      data: { status: string; nextAttemptAt: Date };
    };
    expect(retried.data.status).toBe('PENDING');
    expect(retried.data.nextAttemptAt).toBeInstanceOf(Date);
  });

  it('stops trying when the user blocks the bot until a new /start', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ ok: false, error_code: 403 }),
      }),
    );
    const update = vi.fn().mockResolvedValue({});
    const updateUser = vi.fn().mockResolvedValue({});
    const prisma = {
      recurringPayment: { findMany: vi.fn().mockResolvedValue([]) },
      notificationDelivery: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: 'delivery-id' }]),
        findUniqueOrThrow: vi.fn().mockResolvedValue(dueDelivery()),
        update,
      },
      user: { update: updateUser },
    } as unknown as PrismaService;

    await new ReminderWorker(prisma, 'test-token', 'https://subsio.ru').tick(now);

    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { botStartedAt: null },
    });
    const failed = update.mock.calls.at(-1)?.[0] as { data: { status: string } };
    expect(failed.data.status).toBe('FAILED');
  });
});
