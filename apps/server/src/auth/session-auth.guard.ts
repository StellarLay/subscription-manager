import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedRequest } from './auth-request';
import { IS_PUBLIC_ROUTE } from './public.decorator';
import { hashSessionToken, readSessionToken } from './session-token';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionToken(request.headers.cookie);
    if (!token) throw new UnauthorizedException('Authentication required');

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { select: { status: true } } },
    });

    if (!session || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Session is invalid or expired');
    }

    request.auth = { sessionId: session.id, userId: session.userId };

    return true;
  }
}
