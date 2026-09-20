import {
  calculateUpcomingChargeDate,
  dateTimeInTimeZoneToUtc,
  DEFAULT_TIMEZONE,
  formatDateKeyInTimeZone,
} from '@subscription-manager/domain';

import type { PrismaService } from '../database/prisma.service';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  RecurringPaymentStatus,
} from '../generated/prisma/client';

const MAX_ATTEMPTS = 5;
const PLANNING_HORIZON_DAYS = 35;

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatAmount(amount: string, currency: string): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(Number(amount));
}

function formatChargeDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

class TelegramSendError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

export class ReminderWorker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly botToken: string,
    private readonly miniAppUrl: string,
  ) {}

  async tick(now = new Date()): Promise<void> {
    await this.recoverStaleClaims(now);
    await this.planUpcoming(now);
    await this.sendDue(now);
  }

  private async recoverStaleClaims(now: Date): Promise<void> {
    await this.prisma.notificationDelivery.updateMany({
      where: {
        status: NotificationDeliveryStatus.PROCESSING,
        updatedAt: { lt: new Date(now.getTime() - 5 * 60_000) },
      },
      data: { status: NotificationDeliveryStatus.PENDING },
    });
  }

  private async planUpcoming(now: Date): Promise<void> {
    const subscriptions = await this.prisma.recurringPayment.findMany({
      where: {
        status: RecurringPaymentStatus.ACTIVE,
        archivedAt: null,
        user: {
          status: 'ACTIVE',
          notificationsEnabled: true,
          botStartedAt: { not: null },
          telegramId: { not: null },
        },
        reminderRules: { some: { channel: NotificationChannel.TELEGRAM, enabled: true } },
      },
      include: { user: true, reminderRules: true },
    });

    for (const subscription of subscriptions) {
      const timezone = subscription.user.timezone || DEFAULT_TIMEZONE;
      const today = formatDateKeyInTimeZone(now, timezone);
      const tomorrow = addDays(today, 1);
      const chargeDate = calculateUpcomingChargeDate({
        currentDate: dateKey(subscription.nextChargeDate),
        asOfDate: tomorrow,
        billingPeriod: subscription.billingPeriod,
        interval: subscription.interval,
        anchorDay: subscription.billingAnchorDay,
      });

      for (const rule of subscription.reminderRules) {
        if (!rule.enabled || rule.channel !== NotificationChannel.TELEGRAM) continue;
        const reminderDate = addDays(chargeDate, -rule.daysBefore);
        if (reminderDate < today || reminderDate > addDays(today, PLANNING_HORIZON_DAYS)) {
          continue;
        }

        const scheduledAt = dateTimeInTimeZoneToUtc(reminderDate, rule.timeOfDayMinutes, timezone);
        const occurrence = await this.prisma.paymentOccurrence.upsert({
          where: {
            recurringPaymentId_scheduledFor: {
              recurringPaymentId: subscription.id,
              scheduledFor: new Date(`${chargeDate}T00:00:00.000Z`),
            },
          },
          create: {
            recurringPaymentId: subscription.id,
            scheduledFor: new Date(`${chargeDate}T00:00:00.000Z`),
            amount: subscription.amount,
            currency: subscription.currency,
          },
          update: {},
        });
        const key = `${rule.id}:${chargeDate}`;
        const existing = await this.prisma.notificationDelivery.findUnique({
          where: { idempotencyKey: key },
          select: { status: true, attemptCount: true, scheduledAt: true },
        });
        if (!existing) {
          await this.prisma.notificationDelivery.upsert({
            where: { idempotencyKey: key },
            create: {
              reminderRuleId: rule.id,
              occurrenceId: occurrence.id,
              idempotencyKey: key,
              scheduledAt,
            },
            update: {},
          });
        } else if (
          existing.status === NotificationDeliveryStatus.PENDING &&
          existing.attemptCount === 0 &&
          existing.scheduledAt.getTime() !== scheduledAt.getTime()
        ) {
          await this.prisma.notificationDelivery.update({
            where: { idempotencyKey: key },
            data: { scheduledAt },
          });
        }
      }
    }
  }

  private async sendDue(now: Date): Promise<void> {
    const due = await this.prisma.notificationDelivery.findMany({
      where: {
        status: NotificationDeliveryStatus.PENDING,
        scheduledAt: { lte: now },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
      select: { id: true },
    });

    for (const { id } of due) {
      const claim = await this.prisma.notificationDelivery.updateMany({
        where: { id, status: NotificationDeliveryStatus.PENDING },
        data: { status: NotificationDeliveryStatus.PROCESSING, attemptCount: { increment: 1 } },
      });
      if (claim.count !== 1) continue;
      await this.sendOne(id, now);
    }
  }

  private async sendOne(id: string, now: Date): Promise<void> {
    const delivery = await this.prisma.notificationDelivery.findUniqueOrThrow({
      where: { id },
      include: {
        reminderRule: true,
        occurrence: {
          include: {
            recurringPayment: { include: { user: true, paymentMethod: true } },
          },
        },
      },
    });
    const rule = delivery.reminderRule;
    const occurrence = delivery.occurrence;
    const subscription = occurrence.recurringPayment;
    const user = subscription.user;
    const chargeDate = dateKey(occurrence.scheduledFor);
    const today = formatDateKeyInTimeZone(now, user.timezone || DEFAULT_TIMEZONE);
    const currentChargeDate = calculateUpcomingChargeDate({
      currentDate: dateKey(subscription.nextChargeDate),
      asOfDate: chargeDate,
      billingPeriod: subscription.billingPeriod,
      interval: subscription.interval,
      anchorDay: subscription.billingAnchorDay,
    });

    if (
      subscription.status !== RecurringPaymentStatus.ACTIVE ||
      subscription.archivedAt ||
      user.status !== 'ACTIVE' ||
      !user.notificationsEnabled ||
      !user.botStartedAt ||
      !user.telegramId ||
      !rule.enabled ||
      rule.channel !== NotificationChannel.TELEGRAM ||
      currentChargeDate !== chargeDate ||
      today >= chargeDate
    ) {
      await this.prisma.notificationDelivery.update({
        where: { id },
        data: { status: NotificationDeliveryStatus.CANCELLED },
      });
      return;
    }

    const expectedAt = dateTimeInTimeZoneToUtc(
      addDays(chargeDate, -rule.daysBefore),
      rule.timeOfDayMinutes,
      user.timezone || DEFAULT_TIMEZONE,
    );
    if (expectedAt > now) {
      await this.prisma.notificationDelivery.update({
        where: { id },
        data: { status: NotificationDeliveryStatus.PENDING, scheduledAt: expectedAt },
      });
      return;
    }

    const lead = rule.daysBefore === 1 ? 'Завтра' : `Через ${rule.daysBefore} дн.`;
    const paymentMethod = subscription.paymentMethod
      ? `\nСпособ оплаты: ${subscription.paymentMethod.name}${
          subscription.paymentMethod.lastFour ? ` • ${subscription.paymentMethod.lastFour}` : ''
        }`
      : '';
    const text = [
      `🔔 ${lead} запланировано списание`,
      '',
      `${subscription.name} — ${formatAmount(subscription.amount.toString(), subscription.currency)}`,
      `Дата: ${formatChargeDate(chargeDate)}${paymentMethod}`,
      '',
      'Это прогноз по твоим данным, не подтверждение платежа.',
    ].join('\n');

    try {
      await this.sendTelegramMessage(user.telegramId.toString(), text);
      await this.prisma.notificationDelivery.update({
        where: { id },
        data: {
          status: NotificationDeliveryStatus.SENT,
          sentAt: new Date(),
          nextAttemptAt: null,
          lastError: null,
        },
      });
      console.info(JSON.stringify({ event: 'reminder_sent', deliveryId: id }));
    } catch (error) {
      const telegramError = error instanceof TelegramSendError ? error : null;
      if (telegramError?.permanent) {
        await this.prisma.user.update({ where: { id: user.id }, data: { botStartedAt: null } });
      }
      const failed = Boolean(telegramError?.permanent || delivery.attemptCount >= MAX_ATTEMPTS);
      const delaySeconds = Math.max(
        telegramError?.retryAfterSeconds ?? 0,
        Math.min(3600, 30 * 2 ** (delivery.attemptCount - 1)),
      );
      await this.prisma.notificationDelivery.update({
        where: { id },
        data: {
          status: failed ? NotificationDeliveryStatus.FAILED : NotificationDeliveryStatus.PENDING,
          lastError: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
          nextAttemptAt: failed ? null : new Date(Date.now() + delaySeconds * 1000),
        },
      });
      console.error(
        JSON.stringify({ event: 'reminder_failed', deliveryId: id, permanent: failed }),
      );
    }
  }

  private async sendTelegramMessage(chatId: string, text: string): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: this.miniAppUrl
          ? { inline_keyboard: [[{ text: 'Открыть Subsio', web_app: { url: this.miniAppUrl } }]] }
          : undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = (await response.json()) as TelegramResponse;
    if (response.ok && result.ok) return;
    throw new TelegramSendError(
      `Telegram ${result.error_code ?? response.status}: ${result.description ?? 'Send failed'}`,
      response.status === 403,
      result.parameters?.retry_after,
    );
  }
}
