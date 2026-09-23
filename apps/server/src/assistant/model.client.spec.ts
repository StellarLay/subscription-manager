import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiModelClient, parseModelIntent } from './model.client';

afterEach(() => vi.restoreAllMocks());

describe('parseModelIntent', () => {
  it('normalizes conversational values returned by YandexGPT Lite', () => {
    expect(
      parseModelIntent(
        '```json\n{"intent":"create","name":"Netflix","amount":"799","currency":"₽","billingPeriod":"месяц","nextChargeDate":"2026-09-15","paymentMethodId":null}\n```',
      ),
    ).toMatchObject({
      intent: 'create',
      amount: 799,
      currency: 'RUB',
      billingPeriod: 'MONTH',
      nextChargeDate: '2026-09-15',
    });
  });

  it('accepts a day of month and never fabricates a payment method', () => {
    expect(
      parseModelIntent('{"intent":"create","chargeDay":"15-го","paymentMethodId":"unknown"}'),
    ).toMatchObject({ chargeDay: 15, paymentMethodId: null });
  });

  it('retries a malformed provider response once', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'not JSON' } }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"intent":"list"}' } }] }), {
          status: 200,
        }),
      );
    const config = {
      get: (key: string) =>
        ({
          AI_API_KEY: 'test-key',
          AI_MODEL: 'test-model',
          AI_BASE_URL: 'https://example.test/v1',
        })[key as 'AI_API_KEY' | 'AI_MODEL' | 'AI_BASE_URL'],
    } as ConfigService;
    const client = new AiModelClient(config as never);

    await expect(
      client.extract({
        message: 'Покажи мои подписки',
        today: '2026-09-22',
        pending: null,
        paymentMethods: [],
      }),
    ).resolves.toMatchObject({ intent: 'list' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
