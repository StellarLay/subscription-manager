import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  displayName!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  telegramId!: string | null;
}
