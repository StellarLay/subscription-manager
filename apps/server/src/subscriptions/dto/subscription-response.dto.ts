import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { CategoryResponseDto } from '../../categories/dto/category-response.dto';
import {
  BillingPeriod,
  PaymentMethodType,
  RecurringPaymentStatus,
} from '../../generated/prisma/client';

export class SubscriptionPaymentMethodDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ example: 'Основная карта', type: String })
  name!: string;

  @ApiPropertyOptional({ example: '4242', nullable: true, type: String })
  lastFour!: string | null;

  @ApiProperty({ enum: PaymentMethodType, type: String })
  type!: PaymentMethodType;

  @ApiPropertyOptional({ example: '#73ff5b', nullable: true, type: String })
  color!: string | null;
}

export class SubscriptionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ example: 'YouTube Premium', type: String })
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: () => CategoryResponseDto })
  category!: CategoryResponseDto | null;

  @ApiProperty({ example: '799.00', pattern: '^\\d+\\.\\d{2}$', type: String })
  amount!: string;

  @ApiProperty({ enum: ['RUB', 'USD', 'EUR'], example: 'RUB', type: String })
  currency!: string;

  @ApiProperty({ enum: BillingPeriod, type: String })
  billingPeriod!: BillingPeriod;

  @ApiProperty({ example: 1, minimum: 1, type: Number })
  interval!: number;

  @ApiProperty({
    description: 'Ближайшая дата по графику, а не подтверждение фактической оплаты',
    example: '2026-09-15',
    format: 'date',
    type: String,
  })
  nextChargeDate!: string;

  @ApiProperty({ enum: RecurringPaymentStatus, type: String })
  status!: RecurringPaymentStatus;

  @ApiPropertyOptional({ nullable: true, type: () => SubscriptionPaymentMethodDto })
  paymentMethod!: SubscriptionPaymentMethodDto | null;

  @ApiProperty({ example: '2026-09-06T12:00:00.000Z', format: 'date-time', type: String })
  createdAt!: string;
}
