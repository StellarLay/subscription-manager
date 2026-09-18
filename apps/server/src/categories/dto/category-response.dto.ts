import { ApiProperty } from '@nestjs/swagger';

import { CategoryIcon } from './create-category.dto';

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ example: 'Развлечения', type: String })
  name!: string;

  @ApiProperty({ example: '#ff9b66', type: String })
  color!: string;

  @ApiProperty({ enum: CategoryIcon, type: String })
  icon!: CategoryIcon;

  @ApiProperty({ example: '2026-09-17T12:00:00.000Z', format: 'date-time', type: String })
  createdAt!: string;
}
