import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok'], example: 'ok', type: String })
  status!: 'ok';

  @ApiProperty({ enum: ['connected'], example: 'connected', type: String })
  database!: 'connected';

  @ApiProperty({
    example: '2026-09-06T12:00:00.000Z',
    format: 'date-time',
    type: String,
  })
  timestamp!: string;
}
