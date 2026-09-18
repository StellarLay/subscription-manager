import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export enum CategoryIcon {
  CLOUD = 'CLOUD',
  EDUCATION = 'EDUCATION',
  ENTERTAINMENT = 'ENTERTAINMENT',
  FINANCE = 'FINANCE',
  HEALTH = 'HEALTH',
  OTHER = 'OTHER',
  WORK = 'WORK',
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'Развлечения', maxLength: 64, minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: '#ff9b66', pattern: '^#[0-9A-Fa-f]{6}$', type: String })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color!: string;

  @ApiProperty({ enum: CategoryIcon, example: CategoryIcon.ENTERTAINMENT, type: String })
  @IsEnum(CategoryIcon)
  icon!: CategoryIcon;
}
