import { z } from 'zod';

const environmentBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

const envSchema = z.object({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_COOKIE_SECURE: environmentBoolean.default(false),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
  TELEGRAM_AUTH_DEV_BYPASS: environmentBoolean.default(false),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().max(86400).default(600),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_BASE_URL: z.string().url().default('https://api.timeweb.ai/v1'),
  ASSISTANT_DISABLE_DAILY_LIMIT: environmentBoolean.default(false),
  ASSISTANT_BOT_TOKEN: z.union([z.string().min(32), z.literal('')]).optional(),
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(environment: Record<string, unknown>): Environment {
  return envSchema.parse(environment);
}
