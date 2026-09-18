import { createHmac } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { validateTelegramInitData } from './telegram-init-data';

const botToken = '123456:telegram-secret';
const nowSeconds = 1_789_700_000;

function signInitData(values: Record<string, string>): string {
  const dataCheckString = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const params = new URLSearchParams({ ...values, hash });

  return params.toString();
}

describe('validateTelegramInitData', () => {
  it('returns a Telegram user from correctly signed fresh data', () => {
    const user = { first_name: 'Vladislav', id: 279_058_397, username: 'stellarlay' };
    const initData = signInitData({
      auth_date: String(nowSeconds - 30),
      query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
      user: JSON.stringify(user),
    });

    expect(validateTelegramInitData(initData, botToken, 600, nowSeconds)).toMatchObject(user);
  });

  it('rejects tampered user data', () => {
    const initData = signInitData({
      auth_date: String(nowSeconds),
      user: JSON.stringify({ first_name: 'Vladislav', id: 279_058_397 }),
    }).replace('Vladislav', 'Attacker');

    expect(() => validateTelegramInitData(initData, botToken, 600, nowSeconds)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects expired and duplicated authentication fields', () => {
    const expired = signInitData({
      auth_date: String(nowSeconds - 601),
      user: JSON.stringify({ first_name: 'Vladislav', id: 279_058_397 }),
    });
    const duplicated = `${expired}&auth_date=${nowSeconds}`;

    expect(() => validateTelegramInitData(expired, botToken, 600, nowSeconds)).toThrow(
      UnauthorizedException,
    );
    expect(() => validateTelegramInitData(duplicated, botToken, 600, nowSeconds)).toThrow(
      UnauthorizedException,
    );
  });
});
