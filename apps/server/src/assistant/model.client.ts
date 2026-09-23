import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type { Environment } from '../config/env';

const extractionSchema = z.object({
  intent: z.enum(['list', 'create', 'cancel', 'unknown']),
  name: z.string().trim().min(1).max(160).nullable().optional(),
  amount: z.number().positive().max(999999999).nullable().optional(),
  currency: z.enum(['RUB', 'USD', 'EUR']).nullable().optional(),
  billingPeriod: z.enum(['WEEK', 'MONTH', 'QUARTER', 'YEAR']).nullable().optional(),
  nextChargeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  chargeDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentMethodId: z.string().uuid().nullable().optional(),
});

export type ExtractedIntent = z.infer<typeof extractionSchema>;

export interface ModelContext {
  message: string;
  today: string;
  pending: Record<string, unknown> | null;
  paymentMethods: Array<{ id: string; label: string }>;
}

function normalizeCurrency(value: unknown): 'RUB' | 'USD' | 'EUR' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (/^(rub|₽|р\.?|руб\.?|рубл(?:ь|я|ей)?)$/u.test(normalized)) return 'RUB';
  if (/^(usd|\$|доллар(?:ов|а)?)$/u.test(normalized)) return 'USD';
  if (/^(eur|€|евро)$/u.test(normalized)) return 'EUR';
  return null;
}

function normalizePeriod(value: unknown): 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (/^(week|недел[юяиь]|еженедельно)$/u.test(normalized)) return 'WEEK';
  if (/^(month|месяц[а]?|ежемесячно)$/u.test(normalized)) return 'MONTH';
  if (/^(quarter|квартал[а]?|ежеквартально)$/u.test(normalized)) return 'QUARTER';
  if (/^(year|год[а]?|ежегодно|раз в год)$/u.test(normalized)) return 'YEAR';
  return null;
}

export function parseModelIntent(content: string): ExtractedIntent {
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object');
  const raw = z.record(z.string(), z.unknown()).parse(JSON.parse(unfenced.slice(start, end + 1)));
  const amount =
    typeof raw.amount === 'number'
      ? raw.amount
      : typeof raw.amount === 'string'
        ? Number(
            raw.amount
              .replace(/\s|\u00a0/gu, '')
              .replace(',', '.')
              .replace(/[^\d.]/gu, ''),
          )
        : null;
  const day =
    typeof raw.chargeDay === 'number'
      ? raw.chargeDay
      : typeof raw.chargeDay === 'string'
        ? Number(raw.chargeDay.replace(/-го|-е/gu, ''))
        : null;
  return extractionSchema.parse({
    intent: raw.intent,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : null,
    amount: amount && Number.isFinite(amount) ? amount : null,
    currency: normalizeCurrency(raw.currency),
    billingPeriod: normalizePeriod(raw.billingPeriod),
    nextChargeDate:
      typeof raw.nextChargeDate === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(raw.nextChargeDate)
        ? raw.nextChargeDate
        : null,
    chargeDay: day && Number.isInteger(day) && day >= 1 && day <= 31 ? day : null,
    paymentMethodId:
      typeof raw.paymentMethodId === 'string' &&
      z.string().uuid().safeParse(raw.paymentMethodId).success
        ? raw.paymentMethodId
        : null,
  });
}

@Injectable()
export class AiModelClient {
  private readonly logger = new Logger(AiModelClient.name);

  constructor(private readonly config: ConfigService<Environment, true>) {}

  get available(): boolean {
    return Boolean(this.config.get<string>('AI_API_KEY') && this.config.get<string>('AI_MODEL'));
  }

  async extract(context: ModelContext): Promise<ExtractedIntent> {
    const key = this.config.get<string>('AI_API_KEY');
    const model = this.config.get<string>('AI_MODEL');
    if (!key || !model) throw new ServiceUnavailableException('Помощник пока не подключён');

    const baseUrl = this.config.get<string>('AI_BASE_URL').replace(/\/$/, '');
    const messages = [
      {
        role: 'system',
        content: [
          'Ты разбираешь русские сообщения для приложения учёта подписок.',
          'Верни только JSON-объект без Markdown.',
          'Поля: intent, name, amount, currency, billingPeriod, nextChargeDate, chargeDay, paymentMethodId.',
          'intent: list|create|cancel|unknown. amount — число. currency — RUB|USD|EUR. billingPeriod — WEEK|MONTH|QUARTER|YEAR.',
          'Не выдумывай недостающие название, цену, периодичность или дату.',
          'Если указан только день месяца, заполни chargeDay числом, а nextChargeDate оставь null. Если указана полная дата, заполни nextChargeDate как YYYY-MM-DD.',
          'Для продолжения черновика intent=create; передавай только поля, которые пользователь уточнил.',
          'paymentMethodId выбирай только если пользователь явно назвал способ оплаты из списка; иначе null.',
          'Никаких действий над базой данных ты не выполняешь.',
          'Пример для «Netflix за 799 ₽ в месяц, списание 15-го»: {"intent":"create","name":"Netflix","amount":799,"currency":"RUB","billingPeriod":"MONTH","chargeDay":15,"nextChargeDate":null,"paymentMethodId":null}.',
        ].join(' '),
      },
      { role: 'user', content: JSON.stringify(context) },
    ];
    let parseFailed = false;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: attempt === 1 ? 400 : 650,
            temperature: 0,
          }),
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        this.logger.warn(`AI Gateway connection failed (attempt ${attempt}/2)`);
        continue;
      }
      if (!response.ok) {
        this.logger.warn(`AI Gateway returned HTTP ${response.status} (attempt ${attempt}/2)`);
        if (response.status < 500 && response.status !== 429) break;
        continue;
      }
      try {
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        };
        const content = payload.choices?.[0]?.message?.content?.trim() ?? '';
        return parseModelIntent(content);
      } catch {
        parseFailed = true;
        this.logger.warn(`AI Gateway response was not valid intent JSON (attempt ${attempt}/2)`);
      }
    }
    throw new ServiceUnavailableException(
      parseFailed
        ? 'Не получилось разобрать ответ помощника. Попробуй ещё раз.'
        : 'Помощник сейчас не отвечает. Попробуй позже.',
    );
  }
}
