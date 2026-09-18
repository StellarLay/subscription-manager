import { randomBytes } from 'node:crypto';

import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { type User, UserStatus } from '../generated/prisma/client';
import { DEMO_USER_EMAIL } from './auth.constants';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { hashSessionToken } from './session-token';
import { type TelegramUser, validateTelegramInitData } from './telegram-init-data';

interface AuthResult {
  expiresAt: Date;
  token: string;
  user: AuthUserResponseDto;
}

type UserRecord = User;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async authenticateWithTelegram(initData: string): Promise<AuthResult> {
    const isDevBypass = this.config.get<boolean>('TELEGRAM_AUTH_DEV_BYPASS') ?? false;
    let user: UserRecord;

    if (isDevBypass && !initData) {
      user = await this.prisma.user.upsert({
        where: { email: DEMO_USER_EMAIL },
        update: {},
        create: { displayName: 'Demo User', email: DEMO_USER_EMAIL },
      });
    } else {
      const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN')?.trim();
      if (!botToken) throw new UnauthorizedException('Telegram authentication is not configured');

      const telegramUser = validateTelegramInitData(
        initData,
        botToken,
        this.config.get<number>('TELEGRAM_AUTH_MAX_AGE_SECONDS') ?? 600,
      );
      user = await this.upsertTelegramUser(telegramUser);
    }

    if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException('User is blocked');

    return this.createSession(user);
  }

  async getCurrentUser(userId: string): Promise<AuthUserResponseDto> {
    return this.toResponse(await this.findUserById(userId));
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId, userId } });
  }

  private async upsertTelegramUser(telegramUser: TelegramUser): Promise<UserRecord> {
    const telegramId = BigInt(telegramUser.id);
    const displayName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ');

    return this.prisma.user.upsert({
      where: { telegramId },
      update: { displayName },
      create: { displayName, telegramId },
    });
  }

  private async createSession(user: UserRecord): Promise<AuthResult> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + (this.config.get<number>('SESSION_TTL_DAYS') ?? 30) * 24 * 60 * 60 * 1000,
    );

    await this.prisma.$transaction([
      this.prisma.session.deleteMany({
        where: { expiresAt: { lte: new Date() }, userId: user.id },
      }),
      this.prisma.session.create({
        data: { expiresAt, tokenHash: hashSessionToken(token), userId: user.id },
      }),
    ]);

    return { expiresAt, token, user: this.toResponse(user) };
  }

  private findUserById(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  private toResponse(user: UserRecord): AuthUserResponseDto {
    return {
      displayName: user.displayName,
      id: user.id,
      telegramId: user.telegramId?.toString() ?? null,
    };
  }
}
