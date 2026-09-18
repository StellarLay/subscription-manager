import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class TelegramAuthDto {
  @ApiProperty({ description: 'Raw Telegram.WebApp.initData value', type: String })
  @IsString()
  @MaxLength(16_384)
  initData!: string;
}
