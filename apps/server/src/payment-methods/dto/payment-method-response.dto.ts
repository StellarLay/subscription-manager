import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PaymentMethodType } from '../../generated/prisma/client';

export class PaymentMethodResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ example: 'Тинькофф Black', type: String })
  name!: string;

  @ApiProperty({ enum: PaymentMethodType, type: String })
  type!: PaymentMethodType;

  @ApiPropertyOptional({ example: '4242', nullable: true, type: String })
  lastFour!: string | null;

  @ApiPropertyOptional({ example: '#73ff5b', nullable: true, type: String })
  color!: string | null;

  @ApiProperty({ example: '2026-09-17T12:00:00.000Z', format: 'date-time', type: String })
  createdAt!: string;
}
