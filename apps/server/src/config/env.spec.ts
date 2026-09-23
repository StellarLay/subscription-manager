import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './env';

describe('validateEnvironment', () => {
  it('applies safe local defaults', () => {
    const environment = validateEnvironment({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
    });

    expect(environment).toEqual({
      API_HOST: '0.0.0.0',
      API_PORT: 3000,
      AI_BASE_URL: 'https://api.timeweb.ai/v1',
      ASSISTANT_DISABLE_DAILY_LIMIT: false,
      DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
      SESSION_COOKIE_SECURE: false,
      SESSION_TTL_DAYS: 30,
      TELEGRAM_AUTH_DEV_BYPASS: false,
      TELEGRAM_AUTH_MAX_AGE_SECONDS: 600,
      WEB_ORIGIN: 'http://localhost:5173',
    });
  });

  it('parses explicit authentication settings', () => {
    const environment = validateEnvironment({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
      SESSION_COOKIE_SECURE: 'true',
      SESSION_TTL_DAYS: '14',
      TELEGRAM_AUTH_DEV_BYPASS: 'true',
      TELEGRAM_AUTH_MAX_AGE_SECONDS: '300',
      TELEGRAM_BOT_TOKEN: '123456:secret',
    });

    expect(environment).toMatchObject({
      SESSION_COOKIE_SECURE: true,
      SESSION_TTL_DAYS: 14,
      TELEGRAM_AUTH_DEV_BYPASS: true,
      TELEGRAM_AUTH_MAX_AGE_SECONDS: 300,
      TELEGRAM_BOT_TOKEN: '123456:secret',
    });
  });

  it('rejects an invalid web origin', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
        WEB_ORIGIN: 'not-a-url',
      }),
    ).toThrow();
  });

  it('can explicitly disable the assistant limit for testing', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
        ASSISTANT_DISABLE_DAILY_LIMIT: 'true',
      }).ASSISTANT_DISABLE_DAILY_LIMIT,
    ).toBe(true);
  });
});
