import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  calculateNextChargeDate,
  calculateUpcomingChargeDate,
  DEFAULT_TIMEZONE,
  dateTimeInTimeZoneToUtc,
  formatDateKeyInTimeZone,
} from '@subscription-manager/domain';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import type { Environment } from '../config/env';
import { Currency, CreateSubscriptionDto } from '../subscriptions/dto/create-subscription.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AssistantDraftDto, AssistantReplyDto } from './dto/assistant.dto';
import { AiModelClient, type ExtractedIntent } from './model.client';
import { isStandaloneDate, nextDateForDay, parseUserDate } from './date-parser';

const draftSchema = z.object({
  name: z.string().min(1).max(160).nullable(),
  amount: z.number().positive().nullable(),
  currency: z.enum(['RUB', 'USD', 'EUR']).nullable(),
  billingPeriod: z.enum(['WEEK', 'MONTH', 'QUARTER', 'YEAR']).nullable(),
  nextChargeDate: z.string().nullable(),
  paymentMethodId: z.string().uuid().nullable(),
  purchaseDate: z.string().nullable().default(null),
});
type DraftPayload = z.infer<typeof draftSchema>;

const EMPTY_DRAFT: DraftPayload = {
  name: null,
  amount: null,
  currency: null,
  billingPeriod: null,
  nextChargeDate: null,
  paymentMethodId: null,
  purchaseDate: null,
};

const DAILY_MESSAGE_LIMIT = 40;

function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function periodFromMessage(message: string): DraftPayload['billingPeriod'] {
  if (/недел|еженедел|(?:^|[\s/])нед\.?($|[\s,;!?])/iu.test(message)) return 'WEEK';
  if (/квартал|каждые\s+3\s+месяц/iu.test(message)) return 'QUARTER';
  if (/месяц|ежемесяч|(?:^|[\s/])мес\.?($|[\s,;!?])/iu.test(message)) return 'MONTH';
  if (/год(?:а|овой|овые)?|ежегод/iu.test(message)) return 'YEAR';
  return null;
}

function currencyFromMessage(message: string): DraftPayload['currency'] {
  if (/₽|руб|\bRUB\b|\d[\s\u00a0]*р\.?(?=\/|[\s,;!?]|$)/iu.test(message)) return 'RUB';
  if (/\$|доллар|\bUSD\b/iu.test(message)) return 'USD';
  if (/€|евро|\bEUR\b/iu.test(message)) return 'EUR';
  return null;
}

function nameCorrection(message: string): string | null {
  const match = message.trim().match(/^(?:название|назови|имя подписки)\s*(?::|—|-)\s*(.+)$/iu);
  return match?.[1]?.trim() || null;
}

function nameBeforePrice(message: string, modelName: string | null | undefined): string | null {
  const match = message
    .trim()
    .match(
      /^(?:(?:добавь|запиши|оформи|подключил|купил|подписка)\s+)*(.+?)\s+\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:₽|р\.?|руб(?:лей)?|\$|€|usd|eur)(?=\/|[\s,;.!?]|$)/iu,
    );
  const candidate = match?.[1]?.trim() ?? null;
  if (!candidate) return null;
  if (/^(?:я|на|за|в|по|моя)\s/iu.test(candidate)) return null;
  if (!modelName) return candidate.split(/\s+/u).length >= 2 ? candidate : null;
  if (candidate.length <= modelName.length) return null;
  return candidate.toLowerCase().includes(modelName.trim().toLowerCase()) ? candidate : null;
}

function amountBeforeCurrency(message: string): number | null {
  const match = message.match(
    /(?:^|[^\d])(\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:₽|р\.?|руб(?:лей)?|\$|€|usd|eur)(?=\/|[\s,;.!?]|$)/iu,
  );
  const amount = match?.[1] ? Number(match[1].replace(/\s/gu, '').replace(',', '.')) : null;
  return amount && Number.isFinite(amount) && amount <= 999999999 ? amount : null;
}

function purchaseDateFromMessage(message: string, today: string): string | null {
  if (!/(?:купил|купила|оформил|оформила|подключил|подключила)(?=$|[\s,;.!?])/iu.test(message))
    return null;
  if (/следующ\w*\s+списан|списан\w*\s+(?:будет|ожида)/iu.test(message)) return null;
  const parsed = parseUserDate(message, today, true);
  return parsed.mentioned ? parsed.date : null;
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(amount);
}

const periodLabels: Record<string, string> = {
  WEEK: 'неделю',
  MONTH: 'месяц',
  QUARTER: 'квартал',
  YEAR: 'год',
};

const CAPABILITIES_MESSAGE = [
  'Я могу:',
  '• Показать подписки и даты списаний.',
  '• Собрать черновик новой подписки из твоего сообщения.',
  '• Уточнить детали или отменить черновик.',
  '',
  'Сохраняю только после твоего подтверждения.',
  'Например: «Netflix за 799 ₽ в месяц, списание 26 октября».',
].join('\n');

function asksAboutCapabilities(message: string): boolean {
  const normalized = message
    .trim()
    .toLowerCase()
    .replace(/[?!.,]+$/gu, '')
    .trim();
  return /^(?:что\s+(?:(?:ты|бот)\s+)?(?:умеешь(?:\s+делать)?|можешь(?:\s+сделать)?)|чем\s+(?:ты\s+)?можешь\s+помочь|что\s+умеет\s+бот|помощь|help|возможности|как\s+(?:тобой|этим|помощником)\s+пользоваться|расскажи\s+(?:о\s+)?(?:своих\s+)?возможностях)$/iu.test(
    normalized,
  );
}

function asksToListSubscriptions(message: string): boolean {
  const normalized = message
    .trim()
    .toLowerCase()
    .replace(/[?!.,]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  return /^(?:покажи(?: мне)?(?: все| мои| активные)? подписки|показать(?: мои)? подписки|выведи(?: мои| все)? подписки|перечисли(?: мои)? подписки|мои подписки|список(?: моих)? подписок|какие(?: у меня)? подписки)$/iu.test(
    normalized,
  );
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly model: AiModelClient,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  get available(): boolean {
    return this.model.available;
  }

  async userIdForTelegram(telegramId: number): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { id: true, status: true, botStartedAt: true },
    });
    if (!user || user.status !== 'ACTIVE' || !user.botStartedAt) {
      throw new NotFoundException('Сначала отправь /start боту Subsio.');
    }
    return user.id;
  }

  async message(userId: string, text: string): Promise<AssistantReplyDto> {
    if (!this.model.available) throw new ServiceUnavailableException('Помощник пока не подключён');
    if (asksToListSubscriptions(text)) return this.listSubscriptions(userId);
    if (asksAboutCapabilities(text)) {
      const saved = await this.prisma.assistantDraft.findUnique({ where: { userId } });
      const payload =
        saved && saved.expiresAt > new Date() ? draftSchema.safeParse(saved.payload) : null;
      if (!payload?.success || !saved) {
        return { kind: 'message', message: CAPABILITIES_MESSAGE, draft: null };
      }
      const paymentMethod = payload.data.paymentMethodId
        ? await this.prisma.paymentMethod.findFirst({
            where: { id: payload.data.paymentMethodId, userId },
            select: { id: true, name: true, lastFour: true },
          })
        : null;
      return {
        kind: 'message',
        message: CAPABILITIES_MESSAGE,
        draft: this.toDraftDto(
          saved.id,
          payload.data,
          paymentMethod
            ? [
                {
                  id: paymentMethod.id,
                  label: paymentMethod.lastFour
                    ? `${paymentMethod.name} • ${paymentMethod.lastFour}`
                    : paymentMethod.name,
                },
              ]
            : [],
        ),
      };
    }

    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const timeZone = user?.timezone ?? DEFAULT_TIMEZONE;
    const today = formatDateKeyInTimeZone(now, timeZone);

    if (!this.config.get<boolean>('ASSISTANT_DISABLE_DAILY_LIMIT')) {
      const used = await this.prisma.$queryRaw<Array<{ count: number }>>`
        INSERT INTO "AssistantUsage" ("id", "userId", "day", "count")
        VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${today}, 1)
        ON CONFLICT ("userId", "day")
        DO UPDATE SET "count" = "AssistantUsage"."count" + 1
        WHERE "AssistantUsage"."count" < ${DAILY_MESSAGE_LIMIT}
        RETURNING "count"
      `;
      if (!used.length) {
        const nextDay = new Date(`${today}T12:00:00.000Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        const resetAt = dateTimeInTimeZoneToUtc(nextDay.toISOString().slice(0, 10), 0, timeZone);
        throw new HttpException(
          {
            message: `Лимит ${DAILY_MESSAGE_LIMIT} сообщений на сегодня исчерпан. Обновится в 00:00 по времени профиля.`,
            resetAt: resetAt.toISOString(),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const [existing, paymentMethods] = await Promise.all([
      this.prisma.assistantDraft.findUnique({ where: { userId } }),
      this.prisma.paymentMethod.findMany({
        where: { userId, archivedAt: null },
        select: { id: true, name: true, lastFour: true },
      }),
    ]);
    const pending =
      existing && existing.expiresAt > new Date() ? draftSchema.safeParse(existing.payload) : null;
    const previous = pending?.success ? pending.data : null;
    const userDate = parseUserDate(text.trim(), today);
    const methods = paymentMethods.map((method) => ({
      id: method.id,
      label: method.lastFour ? `${method.name} • ${method.lastFour}` : method.name,
    }));
    const parsed: ExtractedIntent =
      previous && nameCorrection(text)
        ? { intent: 'create', name: nameCorrection(text) }
        : previous && userDate.mentioned && isStandaloneDate(text)
          ? { intent: 'create' }
          : await this.model.extract({
              message: text.trim(),
              today,
              pending: previous,
              paymentMethods: methods,
            });

    if (parsed.intent === 'list') {
      return this.listSubscriptions(userId, Boolean(existing));
    }

    if (parsed.intent === 'cancel') {
      await this.prisma.assistantDraft.deleteMany({ where: { userId } });
      return { kind: 'message', message: 'Черновик отменён.', draft: null };
    }
    const correctedName = previous ? nameCorrection(text) : null;
    const isDraftDetail = Boolean(
      previous &&
      (userDate.mentioned || periodFromMessage(text) || currencyFromMessage(text) || correctedName),
    );
    if (parsed.intent !== 'create' && !isDraftDetail) {
      return {
        kind: 'message',
        message:
          'Могу показать твои подписки или добавить новую. Например: «Netflix за 799 ₽ в месяц, списание 15-го».',
        draft: null,
      };
    }

    const parsedNameMentioned = Boolean(
      parsed.name && text.toLowerCase().includes(parsed.name.toLowerCase()),
    );
    const continuing =
      previous?.name &&
      parsed.name &&
      parsedNameMentioned &&
      !correctedName &&
      previous.name.toLowerCase() !== parsed.name.toLowerCase()
        ? null
        : previous;
    const payload = this.mergeDraft(continuing, parsed, methods, today, text.trim());
    const draftId = randomUUID();
    const saved = await this.prisma.assistantDraft.upsert({
      where: { userId },
      create: { id: draftId, userId, payload, expiresAt: new Date(Date.now() + 30 * 60_000) },
      update: { id: draftId, payload, expiresAt: new Date(Date.now() + 30 * 60_000) },
    });
    const draft = this.toDraftDto(saved.id, payload, methods);
    const missing = this.missingField(payload, today);
    if (missing) return { kind: 'draft', message: missing, draft };

    const payment = `\nСпособ оплаты: ${draft.paymentMethodLabel ?? 'не указан'}`;
    return {
      kind: 'draft',
      message: `Проверим перед созданием:\n${payload.name} — ${formatAmount(payload.amount!, payload.currency!)} за ${periodLabels[payload.billingPeriod!]}\nСледующее списание: ${payload.nextChargeDate}${payment}\nЕсли что-то не так, напиши, например: «Название: Бусти Рубильник» или «Списание 25 октября».`,
      draft,
    };
  }

  async confirm(userId: string, draftId: string): Promise<AssistantReplyDto> {
    const existing = await this.prisma.recurringPayment.findUnique({
      where: { assistantDraftId: draftId },
      select: { userId: true, name: true },
    });
    if (existing?.userId === userId) {
      return { kind: 'created', message: `${existing.name} уже добавлена.`, draft: null };
    }
    const saved = await this.prisma.assistantDraft.findFirst({ where: { id: draftId, userId } });
    if (!saved || saved.expiresAt <= new Date())
      throw new NotFoundException('Черновик устарел. Напиши запрос ещё раз.');
    const payload = draftSchema.parse(saved.payload);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const today = formatDateKeyInTimeZone(new Date(), user?.timezone ?? 'Europe/Moscow');
    if (this.missingField(payload, today)) {
      throw new NotFoundException('Черновик ещё не заполнен');
    }
    const input: CreateSubscriptionDto = {
      name: payload.name!,
      amount: payload.amount!,
      currency: payload.currency! as Currency,
      billingPeriod: payload.billingPeriod!,
      nextChargeDate: payload.nextChargeDate!,
      paymentMethodId: payload.paymentMethodId,
    };
    let created;
    try {
      created = await this.subscriptions.createForUser(userId, input, draftId);
    } catch (error) {
      // A second confirmation may race with the first one.
      const duplicate = await this.prisma.recurringPayment.findUnique({
        where: { assistantDraftId: draftId },
        select: { userId: true, name: true },
      });
      if (duplicate?.userId !== userId) throw error;
      await this.prisma.assistantDraft.deleteMany({ where: { id: draftId, userId } });
      return { kind: 'created', message: `${duplicate.name} уже добавлена.`, draft: null };
    }
    await this.prisma.assistantDraft.deleteMany({ where: { id: draftId, userId } });
    return { kind: 'created', message: `${created.name} добавлена в подписки.`, draft: null };
  }

  async cancel(userId: string, draftId: string): Promise<AssistantReplyDto> {
    await this.prisma.assistantDraft.deleteMany({ where: { id: draftId, userId } });
    return { kind: 'message', message: 'Черновик отменён.', draft: null };
  }

  private async listSubscriptions(userId: string, hasDraft = true): Promise<AssistantReplyDto> {
    if (hasDraft) await this.prisma.assistantDraft.deleteMany({ where: { userId } });
    const subscriptions = await this.subscriptions.findAllForUser(userId);
    const active = subscriptions.filter((subscription) => subscription.status === 'ACTIVE');
    if (!active.length)
      return { kind: 'message', message: 'Активных подписок пока нет.', draft: null };
    const lines = active
      .slice(0, 15)
      .map(
        (subscription) =>
          `• ${subscription.name} — ${formatAmount(Number(subscription.amount), subscription.currency)}, следующее списание ${subscription.nextChargeDate}`,
      );
    const suffix = active.length > 15 ? `\nИ ещё ${active.length - 15} в приложении.` : '';
    return {
      kind: 'message',
      message: `Твои активные подписки:\n${lines.join('\n')}${suffix}`,
      draft: null,
    };
  }

  private mergeDraft(
    current: DraftPayload | null,
    parsed: ExtractedIntent,
    methods: Array<{ id: string; label: string }>,
    today: string,
    message: string,
  ): DraftPayload {
    const next = { ...(current ?? EMPTY_DRAFT) };
    if (parsed.name && (!current || message.toLowerCase().includes(parsed.name.toLowerCase()))) {
      next.name = parsed.name;
    }
    if (parsed.amount !== null && parsed.amount !== undefined) next.amount = parsed.amount;
    const correctedName = current ? nameCorrection(message) : null;
    if (correctedName) next.name = correctedName;
    if (!current) next.name = nameBeforePrice(message, parsed.name) ?? next.name;
    if (!next.amount) next.amount = amountBeforeCurrency(message);
    const purchaseDate = purchaseDateFromMessage(message, today);
    if (purchaseDate) next.purchaseDate = purchaseDate;
    const userDate = parseUserDate(message, today);
    if (userDate.mentioned && !purchaseDate) {
      next.nextChargeDate = userDate.date;
      next.purchaseDate = null;
    } else if (parsed.chargeDay && !purchaseDate) {
      next.nextChargeDate = nextDateForDay(parsed.chargeDay, today);
      next.purchaseDate = null;
    } else if (
      !purchaseDate &&
      parsed.nextChargeDate &&
      /дата|списан|оплат|следующ|будет|числ|через|сегодня|завтра/iu.test(message)
    ) {
      next.nextChargeDate = parsed.nextChargeDate;
    }
    const mentionedCurrency = currencyFromMessage(message);
    if (mentionedCurrency) next.currency = mentionedCurrency;
    const mentionedPeriod = periodFromMessage(message);
    if (mentionedPeriod) next.billingPeriod = mentionedPeriod;
    if (
      next.purchaseDate &&
      next.billingPeriod &&
      (purchaseDate || mentionedPeriod || !next.nextChargeDate)
    ) {
      const firstRenewal = calculateNextChargeDate({
        currentDate: next.purchaseDate,
        billingPeriod: next.billingPeriod,
      });
      next.nextChargeDate = calculateUpcomingChargeDate({
        currentDate: firstRenewal,
        asOfDate: today,
        billingPeriod: next.billingPeriod,
        anchorDay: Number(next.purchaseDate.slice(-2)),
      });
    }
    const selectedMethod = methods.find((method) => method.id === parsed.paymentMethodId);
    const explicitMethodMention = selectedMethod?.label
      .split(' • ')
      .some((part) => part.length >= 4 && message.toLowerCase().includes(part.toLowerCase()));
    if (selectedMethod && explicitMethodMention) {
      next.paymentMethodId = selectedMethod.id;
    }
    if (next.amount) {
      const rounded = Math.round(next.amount * 100);
      next.amount = Math.abs(rounded - next.amount * 100) > 0.000001 ? null : rounded / 100;
    }
    if (next.nextChargeDate && (!validDate(next.nextChargeDate) || next.nextChargeDate < today)) {
      next.nextChargeDate = null;
    }
    return draftSchema.parse(next);
  }

  private missingField(payload: DraftPayload, today: string): string | null {
    if (!payload.name) return 'Как называется подписка?';
    if (!payload.amount) return 'Сколько стоит подписка?';
    if (!payload.currency) return 'В какой валюте списание — ₽, $ или €?';
    if (!payload.billingPeriod)
      return 'Как часто списывают — раз в неделю, месяц, квартал или год?';
    if (
      !payload.nextChargeDate ||
      !validDate(payload.nextChargeDate) ||
      payload.nextChargeDate < today
    ) {
      return 'Когда следующее списание? Напиши дату или день месяца.';
    }
    return null;
  }

  private toDraftDto(
    id: string,
    payload: DraftPayload,
    methods: Array<{ id: string; label: string }>,
  ): AssistantDraftDto {
    return {
      id,
      name: payload.name,
      amount: payload.amount,
      currency: payload.currency,
      billingPeriod: payload.billingPeriod,
      nextChargeDate: payload.nextChargeDate,
      paymentMethodLabel:
        methods.find((method) => method.id === payload.paymentMethodId)?.label ?? null,
    };
  }
}
