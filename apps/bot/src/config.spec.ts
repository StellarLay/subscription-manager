import { describe, expect, it } from 'vitest';

import { validateBotEnvironment } from './config.js';

describe('validateBotEnvironment', () => {
  it('supports a disabled local bot without secrets', () => {
    expect(validateBotEnvironment({})).toEqual({
      TELEGRAM_BOT_USERNAME: 'SubsioAppBot',
    });
  });

  it('normalizes the public username and accepts an HTTPS Mini App URL', () => {
    expect(
      validateBotEnvironment({
        TELEGRAM_BOT_TOKEN: '123456:secret',
        TELEGRAM_BOT_USERNAME: '@SubsioAppBot',
        TELEGRAM_MINI_APP_URL: 'https://app.subsio.ru',
      }),
    ).toEqual({
      TELEGRAM_BOT_TOKEN: '123456:secret',
      TELEGRAM_BOT_USERNAME: 'SubsioAppBot',
      TELEGRAM_MINI_APP_URL: 'https://app.subsio.ru',
    });
  });

  it('rejects an insecure Mini App URL', () => {
    expect(() =>
      validateBotEnvironment({ TELEGRAM_MINI_APP_URL: 'http://app.subsio.ru' }),
    ).toThrow();
  });
});
