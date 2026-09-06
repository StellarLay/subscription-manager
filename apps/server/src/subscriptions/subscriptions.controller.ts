import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ operationId: 'getSubscriptions', summary: 'Get current user subscriptions' })
  @ApiOkResponse({ isArray: true, type: SubscriptionResponseDto })
  getSubscriptions(): Promise<SubscriptionResponseDto[]> {
    return this.subscriptionsService.findAll();
  }

  @Post()
  @ApiOperation({ operationId: 'createSubscription', summary: 'Create a subscription' })
  @ApiBody({ type: CreateSubscriptionDto })
  @ApiCreatedResponse({ type: SubscriptionResponseDto })
  createSubscription(@Body() input: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.create(input);
  }
}
