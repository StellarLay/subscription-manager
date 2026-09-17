import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto';
import { PaymentMethodsService } from './payment-methods.service';

@ApiTags('Payment methods')
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  @ApiOperation({ operationId: 'getPaymentMethods', summary: 'Get current user payment methods' })
  @ApiOkResponse({ isArray: true, type: PaymentMethodResponseDto })
  getPaymentMethods(): Promise<PaymentMethodResponseDto[]> {
    return this.paymentMethodsService.findAll();
  }

  @Post()
  @ApiOperation({ operationId: 'createPaymentMethod', summary: 'Create a payment method' })
  @ApiBody({ type: CreatePaymentMethodDto })
  @ApiCreatedResponse({ type: PaymentMethodResponseDto })
  createPaymentMethod(@Body() input: CreatePaymentMethodDto): Promise<PaymentMethodResponseDto> {
    return this.paymentMethodsService.create(input);
  }
}
