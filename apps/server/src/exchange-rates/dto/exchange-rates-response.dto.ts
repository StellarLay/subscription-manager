import { ApiProperty } from '@nestjs/swagger';

export class ExchangeRatesResponseDto {
  @ApiProperty({ example: 'RUB', type: String })
  baseCurrency!: 'RUB';

  @ApiProperty({
    additionalProperties: { type: 'number' },
    example: { EUR: 99.3304, RUB: 1, USD: 84.5093 },
    type: 'object',
  })
  rates!: Record<string, number>;

  @ApiProperty({ example: '2026-09-18', format: 'date', type: String })
  effectiveDate!: string;

  @ApiProperty({ example: '2026-09-18T09:00:00.000Z', format: 'date-time', type: String })
  fetchedAt!: string;

  @ApiProperty({ example: false, type: Boolean })
  stale!: boolean;

  @ApiProperty({ example: 'CBR', type: String })
  source!: 'CBR';
}
