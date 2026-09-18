import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import type { AuthenticatedRequest } from '../auth/auth-request';

@Injectable({ scope: Scope.REQUEST })
export class CurrentUserService {
  constructor(@Inject(REQUEST) private readonly request: AuthenticatedRequest) {}

  getId(): Promise<string> {
    const userId = this.request.auth?.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');

    return Promise.resolve(userId);
  }
}
