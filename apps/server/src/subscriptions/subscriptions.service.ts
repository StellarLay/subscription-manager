import { Injectable } from '@nestjs/common';

import { NotificationChannel, Prisma, RecurringPaymentStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

const DEMO_USER_EMAIL = 'demo@subscription-manager.local';

type SubscriptionRecord = Prisma.RecurringPaymentGetPayload<{
  include: { paymentMethod: true };
}>;

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<SubscriptionResponseDto[]> {
    const userId = await this.getDemoUserId();
    const subscriptions = await this.prisma.recurringPayment.findMany({
      where: {
        userId,
        status: { not: RecurringPaymentStatus.ARCHIVED },
      },
      include: { paymentMethod: true },
      orderBy: [{ nextChargeDate: 'asc' }, { createdAt: 'desc' }],
    });

    return subscriptions.map((subscription) => this.toResponse(subscription));
  }

  async create(input: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    const userId = await this.getDemoUserId();
    const subscription = await this.prisma.recurringPayment.create({
      data: {
        userId,
        name: input.name.trim(),
        amount: input.amount.toFixed(2),
        currency: input.currency,
        billingPeriod: input.billingPeriod,
        nextChargeDate: new Date(`${input.nextChargeDate}T00:00:00.000Z`),
        category: input.category?.trim() || null,
        reminderRules: {
          create: {
            channel: NotificationChannel.EMAIL,
            daysBefore: 1,
            timeOfDayMinutes: 600,
          },
        },
      },
      include: { paymentMethod: true },
    });

    return this.toResponse(subscription);
  }

  private async getDemoUserId(): Promise<string> {
    const user = await this.prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      update: {},
      create: {
        email: DEMO_USER_EMAIL,
        displayName: 'Demo User',
      },
      select: { id: true },
    });

    return user.id;
  }

  private toResponse(subscription: SubscriptionRecord): SubscriptionResponseDto {
    return {
      id: subscription.id,
      name: subscription.name,
      category: subscription.category,
      amount: subscription.amount.toFixed(2),
      currency: subscription.currency,
      billingPeriod: subscription.billingPeriod,
      nextChargeDate: subscription.nextChargeDate.toISOString().slice(0, 10),
      status: subscription.status,
      paymentMethod: subscription.paymentMethod
        ? {
            id: subscription.paymentMethod.id,
            name: subscription.paymentMethod.name,
            lastFour: subscription.paymentMethod.lastFour,
          }
        : null,
      createdAt: subscription.createdAt.toISOString(),
    };
  }
}
