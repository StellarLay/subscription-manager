import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class AssistantMessageDto {
  @ApiProperty({ maxLength: 1000, minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;
}

export class AssistantConfirmDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  draftId!: string;
}

export class TelegramAssistantMessageDto extends AssistantMessageDto {
  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsInt()
  telegramId!: number;
}

export class TelegramAssistantConfirmDto extends AssistantConfirmDto {
  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsInt()
  telegramId!: number;
}

export class AssistantDraftDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  amount!: number | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  currency!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  billingPeriod!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  nextChargeDate!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  paymentMethodLabel!: string | null;
}

export class AssistantReplyDto {
  @ApiProperty({ enum: ['message', 'draft', 'created'], type: String })
  kind!: 'message' | 'draft' | 'created';

  @ApiProperty({ type: String })
  message!: string;

  @ApiPropertyOptional({ nullable: true, type: AssistantDraftDto })
  draft!: AssistantDraftDto | null;
}

export class AssistantStatusDto {
  @ApiProperty({ type: Boolean })
  available!: boolean;
}
