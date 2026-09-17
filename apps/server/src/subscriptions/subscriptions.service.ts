import { BadRequestException, Injectable } from '@nestjs/common';

import { NotificationChannel, Prisma, RecurringPaymentStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CurrentUserService } from '../users/current-user.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

type SubscriptionRecord = Prisma.RecurringPaymentGetPayload<{
  include: { paymentMethod: true };
}>;

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
  ) {}

  async findAll(): Promise<SubscriptionResponseDto[]> {
    const userId = await this.currentUser.getId();
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
    const userId = await this.currentUser.getId();

    if (input.paymentMethodId) {
      const paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: {
          id: input.paymentMethodId,
          userId,
          archivedAt: null,
        },
        select: { id: true },
      });

      if (!paymentMethod) {
        throw new BadRequestException('Payment method not found');
      }
    }

    const subscription = await this.prisma.recurringPayment.create({
      data: {
        userId,
        name: input.name.trim(),
        amount: input.amount.toFixed(2),
        currency: input.currency,
        billingPeriod: input.billingPeriod,
        nextChargeDate: new Date(`${input.nextChargeDate}T00:00:00.000Z`),
        category: input.category?.trim() || null,
        paymentMethodId: input.paymentMethodId || null,
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
            type: subscription.paymentMethod.type,
            color: subscription.paymentMethod.color,
          }
        : null,
      createdAt: subscription.createdAt.toISOString(),
    };
  }
}
