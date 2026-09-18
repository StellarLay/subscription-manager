import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ExchangeRatesResponseDto } from './dto/exchange-rates-response.dto';
import { ExchangeRatesService } from './exchange-rates.service';

@ApiTags('Exchange rates')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Get()
  @ApiOperation({
    operationId: 'getExchangeRates',
    summary: 'Get RUB exchange rates from the Bank of Russia',
  })
  @ApiOkResponse({ type: ExchangeRatesResponseDto })
  getExchangeRates(): Promise<ExchangeRatesResponseDto> {
    return this.exchangeRatesService.getRates();
  }
}
