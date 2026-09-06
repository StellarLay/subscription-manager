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
      DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
      WEB_ORIGIN: 'http://localhost:5173',
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
});
