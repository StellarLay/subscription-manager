import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { PaymentMethodType } from '../../generated/prisma/client';

export class CreatePaymentMethodDto {
  @ApiProperty({ example: 'Тинькофф Black', maxLength: 100, minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: PaymentMethodType, example: PaymentMethodType.CARD, type: String })
  @IsEnum(PaymentMethodType)
  type!: PaymentMethodType;

  @ApiPropertyOptional({ example: '4242', pattern: '^\\d{4}$', type: String })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  lastFour?: string;

  @ApiPropertyOptional({ example: '#73ff5b', pattern: '^#[0-9A-Fa-f]{6}$', type: String })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;
}
