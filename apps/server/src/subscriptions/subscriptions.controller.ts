import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { MarkSubscriptionPaidDto } from './dto/mark-subscription-paid.dto';
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

  @Get('archived')
  @ApiOperation({
    operationId: 'getArchivedSubscriptions',
    summary: 'Get archived subscriptions',
  })
  @ApiOkResponse({ isArray: true, type: SubscriptionResponseDto })
  getArchivedSubscriptions(): Promise<SubscriptionResponseDto[]> {
    return this.subscriptionsService.findArchived();
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

  @Post(':id/mark-paid')
  @ApiOperation({ operationId: 'markSubscriptionPaid', summary: 'Mark the current charge as paid' })
  @ApiParam({ format: 'uuid', name: 'id', type: String })
  @ApiBody({ type: MarkSubscriptionPaidDto })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  markSubscriptionPaid(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: MarkSubscriptionPaidDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.markPaid(id, input);
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

  @Patch(':id/restore')
  @ApiOperation({ operationId: 'restoreSubscription', summary: 'Restore a subscription' })
  @ApiParam({ format: 'uuid', name: 'id', type: String })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  restoreSubscription(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.restore(id);
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteSubscription', summary: 'Permanently delete a subscription' })
  @ApiParam({ format: 'uuid', name: 'id', type: String })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  deleteSubscription(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.remove(id);
  }
}
