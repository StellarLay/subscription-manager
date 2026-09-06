import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BillingPeriod, RecurringPaymentStatus } from '../../generated/prisma/client';

export class SubscriptionPaymentMethodDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ example: 'Основная карта', type: String })
  name!: string;

  @ApiPropertyOptional({ example: '4242', nullable: true, type: String })
  lastFour!: string | null;
}

export class SubscriptionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ example: 'YouTube Premium', type: String })
  name!: string;

  @ApiPropertyOptional({ example: 'Развлечения', nullable: true, type: String })
  category!: string | null;

  @ApiProperty({ example: '799.00', pattern: '^\\d+\\.\\d{2}$', type: String })
  amount!: string;

  @ApiProperty({ enum: ['RUB', 'USD', 'EUR'], example: 'RUB', type: String })
  currency!: string;

  @ApiProperty({ enum: BillingPeriod, type: String })
  billingPeriod!: BillingPeriod;

  @ApiProperty({ example: '2026-09-15', format: 'date', type: String })
  nextChargeDate!: string;

  @ApiProperty({ enum: RecurringPaymentStatus, type: String })
  status!: RecurringPaymentStatus;

  @ApiPropertyOptional({ nullable: true, type: () => SubscriptionPaymentMethodDto })
  paymentMethod!: SubscriptionPaymentMethodDto | null;

  @ApiProperty({ example: '2026-09-06T12:00:00.000Z', format: 'date-time', type: String })
  createdAt!: string;
}
