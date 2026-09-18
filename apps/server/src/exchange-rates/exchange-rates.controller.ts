import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/public.decorator';
import { ExchangeRatesResponseDto } from './dto/exchange-rates-response.dto';
import { ExchangeRatesService } from './exchange-rates.service';

@ApiTags('Exchange rates')
@Public()
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
