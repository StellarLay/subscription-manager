import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { BillingPeriod } from '../../generated/prisma/client';

export enum Currency {
  RUB = 'RUB',
  USD = 'USD',
  EUR = 'EUR',
}

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'YouTube Premium', maxLength: 160, minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 799, minimum: 0.01, multipleOf: 0.01, type: Number })
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: Currency, example: Currency.RUB, type: String })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiProperty({ enum: BillingPeriod, example: BillingPeriod.MONTH, type: String })
  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;

  @ApiProperty({ example: '2026-09-15', format: 'date', type: String })
  @IsDateString({ strict: true, strictSeparator: true })
  nextChargeDate!: string;

  @ApiPropertyOptional({ example: 'Развлечения', maxLength: 64, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;
}
