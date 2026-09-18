import { createHash } from 'node:crypto';

import { SESSION_COOKIE_NAME } from './auth.constants';

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex < 0) continue;

    const name = cookie.slice(0, separatorIndex).trim();
    if (name !== SESSION_COOKIE_NAME) continue;

    return cookie.slice(separatorIndex + 1).trim() || null;
  }

  return null;
}
