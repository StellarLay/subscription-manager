import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';

import type { Environment } from '../config/env';
import { SESSION_COOKIE_NAME } from './auth.constants';
import type { AuthenticatedRequest } from './auth-request';
import { requireAuthContext } from './auth-request';
import { AuthService } from './auth.service';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { Public } from './public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Public()
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'authenticateWithTelegram',
    summary: 'Authenticate a Mini App user',
  })
  @ApiBody({ type: TelegramAuthDto })
  @ApiOkResponse({ type: AuthUserResponseDto })
  async authenticateWithTelegram(
    @Body() input: TelegramAuthDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthUserResponseDto> {
    const result = await this.authService.authenticateWithTelegram(input.initData);
    this.setSessionCookie(reply, result.token, result.expiresAt);

    return result.user;
  }

  @Get('me')
  @ApiOperation({ operationId: 'getCurrentUser', summary: 'Get the authenticated user' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  getCurrentUser(@Req() request: AuthenticatedRequest): Promise<AuthUserResponseDto> {
    return this.authService.getCurrentUser(requireAuthContext(request).userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'logout', summary: 'End the current session' })
  @ApiNoContentResponse()
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const { sessionId, userId } = requireAuthContext(request);
    await this.authService.logout(sessionId, userId);
    reply.header('Set-Cookie', this.serializeCookie('', new Date(0), 0));
  }

  private setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
    const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    reply.header('Set-Cookie', this.serializeCookie(token, expiresAt, maxAgeSeconds));
  }

  private serializeCookie(value: string, expiresAt: Date, maxAgeSeconds: number): string {
    const secure = this.config.get<boolean>('SESSION_COOKIE_SECURE') ? '; Secure' : '';

    return `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}; Expires=${expiresAt.toUTCString()}${secure}`;
  }
}
