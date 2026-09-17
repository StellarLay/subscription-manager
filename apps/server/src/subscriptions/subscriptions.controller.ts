import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
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

  @Patch(':id')
  @ApiOperation({ operationId: 'updateSubscription', summary: 'Update a subscription' })
  @ApiParam({ format: 'uuid', name: 'id', type: String })
  @ApiBody({ type: UpdateSubscriptionDto })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  updateSubscription(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.update(id, input);
  }

  @Patch(':id/archive')
  @ApiOperation({ operationId: 'archiveSubscription', summary: 'Archive a subscription' })
  @ApiParam({ format: 'uuid', name: 'id', type: String })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  archiveSubscription(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.archive(id);
  }
}
