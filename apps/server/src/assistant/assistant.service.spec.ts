import { describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { AssistantService } from './assistant.service';
import type { Environment } from '../config/env';
import type { PrismaService } from '../database/prisma.service';
import type { SubscriptionsService } from '../subscriptions/subscriptions.service';
import type { AiModelClient } from './model.client';

const userId = '83fad958-3011-47e3-8458-bb31ac549f7b';
const draftId = '257e16ef-1ee2-4a95-a8fb-1fec30a0bd08';
const enabledLimit = {
  get: () => false,
} as unknown as ConfigService<Environment, true>;

describe('AssistantService', () => {
  it.each([
    'Что умеешь?',
    'что ты можешь',
    'Чем можешь помочь?',
    'Что умеешь делать?',
    'Помощь',
    'как тобой пользоваться',
  ])('answers %s without a model call or daily quota', async (message) => {
    const queryRaw = vi.fn();
    const extract = vi.fn();
    const service = new AssistantService(
      {
        $queryRaw: queryRaw,
        assistantDraft: { findUnique: vi.fn().mockResolvedValue(null) },
      } as unknown as PrismaService,
      {} as SubscriptionsService,
      { available: true, extract } as unknown as AiModelClient,
      enabledLimit,
    );
    const reply = await service.message(userId, message);
    expect(reply.message).toContain('Я могу:');
    expect(reply.message).toContain('Сохраняю только после твоего подтверждения');
    expect(extract).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('keeps an unfinished draft visible after explaining capabilities', async () => {
    const prisma = {
      assistantDraft: {
        findUnique: vi.fn().mockResolvedValue({
          id: draftId,
          expiresAt: new Date('2099-01-01'),
          payload: {
            name: 'Netflix',
            amount: 799,
            currency: 'RUB',
            billingPeriod: 'MONTH',
            nextChargeDate: null,
            paymentMethodId: null,
          },
        }),
      },
    };
    const service = new AssistantService(
      prisma as unknown as PrismaService,
      {} as SubscriptionsService,
      { available: true } as AiModelClient,
      enabledLimit,
    );
    const reply = await service.message(userId, 'Что умеешь?');
    expect(reply.draft?.id).toBe(draftId);
    expect(reply.draft?.name).toBe('Netflix');
  });

  it('keeps creation behind confirmation and reuses the result on repeated confirmation', async () => {
    const payload = {
      name: 'Netflix',
      amount: 799,
      currency: 'RUB',
      billingPeriod: 'MONTH',
      nextChargeDate: '2099-10-15',
      paymentMethodId: null,
    };
    const saved = { id: draftId, userId, payload, expiresAt: new Date('2099-12-01') };
    const recurringFind = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
      userId,
      name: 'Netflix',
    });
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]),
      assistantDraft: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(saved),
        findFirst: vi.fn().mockResolvedValue(saved),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      paymentMethod: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findUnique: vi.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }) },
      recurringPayment: { findUnique: recurringFind },
    };
    const createForUser = vi.fn().mockResolvedValue({ name: 'Netflix' });
    const subscriptions = { createForUser };
    const model = {
      available: true,
      extract: vi.fn().mockResolvedValue({ intent: 'create', ...payload }),
    };
    const service = new AssistantService(
      prisma as unknown as PrismaService,
      subscriptions as unknown as SubscriptionsService,
      model as unknown as AiModelClient,
      enabledLimit,
    );

    const preview = await service.message(
      userId,
      'Netflix за 799 ₽ в месяц, списание 15 октября 2099',
    );
    expect(preview.kind).toBe('draft');
    expect(preview.draft?.id).toBe(draftId);
    expect(createForUser).not.toHaveBeenCalled();

    const confirmed = await service.confirm(userId, draftId);
    expect(confirmed.kind).toBe('created');
    expect(createForUser).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ name: 'Netflix', amount: 799 }),
      draftId,
    );

    const again = await service.confirm(userId, draftId);
    expect(again.kind).toBe('created');
    expect(createForUser).toHaveBeenCalledTimes(1);
  });

  it('does not confirm another user’s draft', async () => {
    const prisma = {
      recurringPayment: { findUnique: vi.fn().mockResolvedValue(null) },
      assistantDraft: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new AssistantService(
      prisma as unknown as PrismaService,
      {} as SubscriptionsService,
      {} as AiModelClient,
      enabledLimit,
    );
    await expect(service.confirm(userId, draftId)).rejects.toThrow('Черновик устарел');
  });

  it('does not accept a model-invented period or payment method', async () => {
    const methodId = 'f72f2555-b29b-46bc-8125-6ca9287689e7';
    const upsert = vi.fn().mockResolvedValue({ id: draftId });
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]),
      assistantDraft: { findUnique: vi.fn().mockResolvedValue(null), upsert },
      paymentMethod: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: methodId, name: 'Основная карта', lastFour: '4242' }]),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }) },
    };
    const model = {
      available: true,
      extract: vi.fn().mockResolvedValue({
        intent: 'create',
        name: 'Netflix',
        amount: 799,
        currency: 'RUB',
        billingPeriod: 'MONTH',
        paymentMethodId: methodId,
      }),
    };
    const service = new AssistantService(
      prisma as unknown as PrismaService,
      {} as SubscriptionsService,
      model as unknown as AiModelClient,
      enabledLimit,
    );

    const reply = await service.message(userId, 'Добавь Netflix за 799 ₽');
    expect(reply.message).toContain('Как часто списывают');
    expect(reply.draft?.billingPeriod).toBeNull();
    expect(reply.draft?.paymentMethodLabel).toBeNull();
  });

  it('accepts a date-only clarification without asking the model again', async () => {
    const previous = {
      name: 'Netflix',
      amount: 799,
      currency: 'RUB',
      billingPeriod: 'MONTH',
      nextChargeDate: null,
      paymentMethodId: null,
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]),
      assistantDraft: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ payload: previous, expiresAt: new Date('2099-01-01') }),
        upsert: vi.fn().mockResolvedValue({ id: draftId }),
      },
      paymentMethod: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findUnique: vi.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }) },
    };
    const extract = vi.fn();
    const service = new AssistantService(
      prisma as unknown as PrismaService,
      {} as SubscriptionsService,
      { available: true, extract } as unknown as AiModelClient,
      enabledLimit,
    );

    const reply = await service.message(userId, '26 октября');
    expect(reply.draft?.nextChargeDate).toMatch(/^\d{4}-10-26$/u);
    expect(reply.draft?.amount).toBe(799);
    expect(extract).not.toHaveBeenCalled();
  });

  it.each([
    ['Europe/Moscow', '2026-09-22T20:30:00.000Z', '2026-09-22', '2026-09-22T21:00:00.000Z'],
    ['Europe/Moscow', '2026-09-22T21:30:00.000Z', '2026-09-23', '2026-09-23T21:00:00.000Z'],
    ['America/New_York', '2026-03-08T04:30:00.000Z', '2026-03-07', '2026-03-08T05:00:00.000Z'],
  ])('resets the %s daily limit at local midnight', async (timezone, instant, day, resetAt) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    try {
      const queryRaw = vi.fn().mockResolvedValue([]);
      const extract = vi.fn();
      const service = new AssistantService(
        {
          $queryRaw: queryRaw,
          user: { findUnique: vi.fn().mockResolvedValue({ timezone }) },
        } as unknown as PrismaService,
        {} as SubscriptionsService,
        { available: true, extract } as unknown as AiModelClient,
        enabledLimit,
      );

      const error: unknown = await service
        .message(userId, 'Добавь Netflix')
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) throw new Error('Expected HttpException');
      expect(error.getStatus()).toBe(429);
      const response = error.getResponse();
      if (typeof response !== 'object' || !('message' in response) || !('resetAt' in response)) {
        throw new Error('Expected rate limit response');
      }
      expect(response.message).toContain('в 00:00');
      expect(response.resetAt).toBe(resetAt);
      const queryArgs = queryRaw.mock.calls[0] as unknown[] | undefined;
      expect(queryArgs?.[3]).toBe(day);
      expect(extract).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips the daily limit when the test flag is enabled', async () => {
    const queryRaw = vi.fn();
    const service = new AssistantService(
      {
        $queryRaw: queryRaw,
        assistantDraft: { findUnique: vi.fn().mockResolvedValue(null) },
        paymentMethod: { findMany: vi.fn().mockResolvedValue([]) },
        user: { findUnique: vi.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }) },
      } as unknown as PrismaService,
      {} as SubscriptionsService,
      {
        available: true,
        extract: vi.fn().mockResolvedValue({ intent: 'unknown' }),
      } as unknown as AiModelClient,
      { get: () => true } as unknown as ConfigService<Environment, true>,
    );

    const reply = await service.message(userId, 'Привет');
    expect(reply.kind).toBe('message');
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
