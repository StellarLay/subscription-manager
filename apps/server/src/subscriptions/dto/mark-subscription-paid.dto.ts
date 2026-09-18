import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class MarkSubscriptionPaidDto {
  @ApiProperty({ example: '2026-09-19', format: 'date', type: String })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true, strictSeparator: true })
  scheduledFor!: string;
}
