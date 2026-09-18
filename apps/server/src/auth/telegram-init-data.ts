import { createHmac, timingSafeEqual } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';

const telegramUserSchema = z
  .object({
    allows_write_to_pm: z.boolean().optional(),
    first_name: z.string().min(1).max(64),
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    is_premium: z.boolean().optional(),
    language_code: z.string().max(16).optional(),
    last_name: z.string().max(64).optional(),
    photo_url: z.string().url().max(2048).optional(),
    username: z.string().max(64).optional(),
  })
  .passthrough();

export type TelegramUser = z.infer<typeof telegramUserSchema>;

function rejectInitData(): never {
  throw new UnauthorizedException('Invalid Telegram authentication data');
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramUser {
  const params = new URLSearchParams(initData);
  const values = new Map<string, string>();

  for (const [key, value] of params.entries()) {
    if (values.has(key)) rejectInitData();
    values.set(key, value);
  }

  const receivedHash = values.get('hash');
  if (!receivedHash || !/^[a-f\d]{64}$/i.test(receivedHash)) rejectInitData();

  const dataCheckString = [...values.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const receivedHashBuffer = Buffer.from(receivedHash, 'hex');

  if (
    receivedHashBuffer.length !== expectedHash.length ||
    !timingSafeEqual(receivedHashBuffer, expectedHash)
  ) {
    rejectInitData();
  }

  const authDate = Number(values.get('auth_date'));
  if (
    !Number.isInteger(authDate) ||
    authDate > nowSeconds + 30 ||
    nowSeconds - authDate > maxAgeSeconds
  ) {
    rejectInitData();
  }

  const rawUser = values.get('user');
  if (!rawUser) rejectInitData();

  try {
    return telegramUserSchema.parse(JSON.parse(rawUser));
  } catch {
    return rejectInitData();
  }
}
