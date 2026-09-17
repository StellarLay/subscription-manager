import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { NotificationChannel, Prisma, RecurringPaymentStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CurrentUserService } from '../users/current-user.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

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

  async findArchived(): Promise<SubscriptionResponseDto[]> {
    const userId = await this.currentUser.getId();
    const subscriptions = await this.prisma.recurringPayment.findMany({
      where: {
        userId,
        status: RecurringPaymentStatus.ARCHIVED,
      },
      include: { paymentMethod: true },
      orderBy: [{ archivedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return subscriptions.map((subscription) => this.toResponse(subscription));
  }

  async create(input: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    const userId = await this.currentUser.getId();

    await this.ensurePaymentMethodOwned(input.paymentMethodId, userId);

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

  async update(id: string, input: UpdateSubscriptionDto): Promise<SubscriptionResponseDto> {
    const userId = await this.currentUser.getId();

    await this.ensureSubscriptionOwned(id, userId);
    await this.ensurePaymentMethodOwned(input.paymentMethodId, userId);

    const data: Prisma.RecurringPaymentUncheckedUpdateInput = {};

    if (input.name !== undefined) data.name = input.name.trim();
    if (input.amount !== undefined) data.amount = input.amount.toFixed(2);
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.billingPeriod !== undefined) data.billingPeriod = input.billingPeriod;
    if (input.nextChargeDate !== undefined) {
      data.nextChargeDate = new Date(`${input.nextChargeDate}T00:00:00.000Z`);
    }
    if (input.category !== undefined) data.category = input.category.trim() || null;
    if (input.paymentMethodId !== undefined) data.paymentMethodId = input.paymentMethodId;

    const subscription = await this.prisma.recurringPayment.update({
      where: { id },
      data,
      include: { paymentMethod: true },
    });

    return this.toResponse(subscription);
  }

  async archive(id: string): Promise<SubscriptionResponseDto> {
    const userId = await this.currentUser.getId();

    await this.ensureSubscriptionOwned(id, userId);

    const subscription = await this.prisma.recurringPayment.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        status: RecurringPaymentStatus.ARCHIVED,
      },
      include: { paymentMethod: true },
    });

    return this.toResponse(subscription);
  }

  async restore(id: string): Promise<SubscriptionResponseDto> {
    const userId = await this.currentUser.getId();

    await this.ensureArchivedSubscriptionOwned(id, userId);

    const subscription = await this.prisma.recurringPayment.update({
      where: { id },
      data: {
        archivedAt: null,
        status: RecurringPaymentStatus.ACTIVE,
      },
      include: { paymentMethod: true },
    });

    return this.toResponse(subscription);
  }

  async remove(id: string): Promise<SubscriptionResponseDto> {
    const userId = await this.currentUser.getId();
    const subscription = await this.prisma.recurringPayment.findFirst({
      where: { id, userId },
      include: { paymentMethod: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status !== RecurringPaymentStatus.ARCHIVED) {
      throw new BadRequestException('Archive subscription before deletion');
    }

    await this.prisma.recurringPayment.delete({ where: { id } });

    return this.toResponse(subscription);
  }

  private async ensureSubscriptionOwned(id: string, userId: string): Promise<void> {
    const subscription = await this.prisma.recurringPayment.findFirst({
      where: {
        id,
        userId,
        status: { not: RecurringPaymentStatus.ARCHIVED },
      },
      select: { id: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
  }

  private async ensureArchivedSubscriptionOwned(id: string, userId: string): Promise<void> {
    const subscription = await this.prisma.recurringPayment.findFirst({
      where: {
        id,
        userId,
        status: RecurringPaymentStatus.ARCHIVED,
      },
      select: { id: true },
    });

    if (!subscription) {
      throw new NotFoundException('Archived subscription not found');
    }
  }

  private async ensurePaymentMethodOwned(
    paymentMethodId: string | null | undefined,
    userId: string,
  ): Promise<void> {
    if (!paymentMethodId) return;

    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!paymentMethod) {
      throw new BadRequestException('Payment method not found');
    }
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
