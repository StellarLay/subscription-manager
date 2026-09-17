import { Injectable } from '@nestjs/common';

import type { PaymentMethod } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CurrentUserService } from '../users/current-user.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
  ) {}

  async findAll(): Promise<PaymentMethodResponseDto[]> {
    const userId = await this.currentUser.getId();
    const paymentMethods = await this.prisma.paymentMethod.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return paymentMethods.map((paymentMethod) => this.toResponse(paymentMethod));
  }

  async create(input: CreatePaymentMethodDto): Promise<PaymentMethodResponseDto> {
    const userId = await this.currentUser.getId();
    const paymentMethod = await this.prisma.paymentMethod.create({
      data: {
        userId,
        name: input.name.trim(),
        type: input.type,
        lastFour: input.lastFour || null,
        color: input.color || null,
      },
    });

    return this.toResponse(paymentMethod);
  }

  private toResponse(paymentMethod: PaymentMethod): PaymentMethodResponseDto {
    return {
      id: paymentMethod.id,
      name: paymentMethod.name,
      type: paymentMethod.type,
      lastFour: paymentMethod.lastFour,
      color: paymentMethod.color,
      createdAt: paymentMethod.createdAt.toISOString(),
    };
  }
}
