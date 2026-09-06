import { z } from 'zod';

const envSchema = z.object({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(environment: Record<string, unknown>): Environment {
  return envSchema.parse(environment);
}
