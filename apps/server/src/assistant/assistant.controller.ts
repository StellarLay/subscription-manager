import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';

import { Public } from '../auth/public.decorator';
import type { Environment } from '../config/env';
import { CurrentUserService } from '../users/current-user.service';
import { AssistantService } from './assistant.service';
import {
  AssistantConfirmDto,
  AssistantMessageDto,
  AssistantReplyDto,
  AssistantStatusDto,
  TelegramAssistantConfirmDto,
  TelegramAssistantMessageDto,
} from './dto/assistant.dto';

@ApiTags('Assistant')
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly currentUser: CurrentUserService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Get('status')
  @ApiOperation({ operationId: 'getAssistantStatus' })
  @ApiOkResponse({ type: AssistantStatusDto })
  getStatus(): AssistantStatusDto {
    return { available: this.assistant.available };
  }

  @Post('message')
  @ApiOperation({ operationId: 'sendAssistantMessage' })
  @ApiBody({ type: AssistantMessageDto })
  @ApiOkResponse({ type: AssistantReplyDto })
  async sendMessage(@Body() input: AssistantMessageDto): Promise<AssistantReplyDto> {
    return this.assistant.message(await this.currentUser.getId(), input.message);
  }

  @Post('confirm')
  @ApiOperation({ operationId: 'confirmAssistantDraft' })
  @ApiBody({ type: AssistantConfirmDto })
  @ApiOkResponse({ type: AssistantReplyDto })
  async confirm(@Body() input: AssistantConfirmDto): Promise<AssistantReplyDto> {
    return this.assistant.confirm(await this.currentUser.getId(), input.draftId);
  }

  @Post('cancel')
  @ApiOperation({ operationId: 'cancelAssistantDraft' })
  @ApiBody({ type: AssistantConfirmDto })
  @ApiOkResponse({ type: AssistantReplyDto })
  async cancel(@Body() input: AssistantConfirmDto): Promise<AssistantReplyDto> {
    return this.assistant.cancel(await this.currentUser.getId(), input.draftId);
  }

  @Public()
  @Post('telegram/message')
  async telegramMessage(
    @Headers('x-subsio-internal-token') token: string | undefined,
    @Body() input: TelegramAssistantMessageDto,
  ): Promise<AssistantReplyDto> {
    this.requireBotToken(token);
    return this.assistant.message(
      await this.assistant.userIdForTelegram(input.telegramId),
      input.message,
    );
  }

  @Public()
  @Post('telegram/confirm')
  async telegramConfirm(
    @Headers('x-subsio-internal-token') token: string | undefined,
    @Body() input: TelegramAssistantConfirmDto,
  ): Promise<AssistantReplyDto> {
    this.requireBotToken(token);
    return this.assistant.confirm(
      await this.assistant.userIdForTelegram(input.telegramId),
      input.draftId,
    );
  }

  @Public()
  @Post('telegram/cancel')
  async telegramCancel(
    @Headers('x-subsio-internal-token') token: string | undefined,
    @Body() input: TelegramAssistantConfirmDto,
  ): Promise<AssistantReplyDto> {
    this.requireBotToken(token);
    return this.assistant.cancel(
      await this.assistant.userIdForTelegram(input.telegramId),
      input.draftId,
    );
  }

  private requireBotToken(token: string | undefined): void {
    const expected = this.config.get<string>('ASSISTANT_BOT_TOKEN');
    if (!token || !expected) throw new UnauthorizedException();
    const actualBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException();
    }
  }
}
