import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
);

const optionalHttpsUrl = optionalString.pipe(
  z
    .url()
    .refine((value) => new URL(value).protocol === 'https:', 'Mini App URL must use HTTPS')
    .optional(),
);

const botEnvironmentSchema = z.object({
  DATABASE_URL: optionalString,
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_BOT_USERNAME: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ''))
    .pipe(z.string().regex(/^[A-Za-z0-9_]{5,32}$/))
    .default('SubsioAppBot'),
  TELEGRAM_MINI_APP_URL: optionalHttpsUrl,
});

export type BotEnvironment = z.infer<typeof botEnvironmentSchema>;

export function validateBotEnvironment(environment: Record<string, unknown>): BotEnvironment {
  return botEnvironmentSchema.parse(environment);
}

export function loadBotEnvironment(): BotEnvironment {
  loadDotenv({ path: resolve(process.cwd(), '../../.env'), quiet: true });

  return validateBotEnvironment(process.env);
}
