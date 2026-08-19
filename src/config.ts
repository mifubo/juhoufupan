import { z } from 'zod';

const bool = z.string().transform((v) => v === 'true');
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3100),
  API_PREFIX: z.string().default('api/v1'),
  DATABASE_URL: z.string().url(),
  DATABASE_SYNC: bool.default(false),
  REDIS_URL: z.string().url(),
  STORAGE_DRIVER: z.enum(['local', 'cos']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('../.local-data/backend-storage'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  AI_PROVIDER: z.enum(['mock', 'kimi']).default('mock'),
  KIMI_API_KEY: z.string().optional(),
  KIMI_BASE_URL: z.string().url().default('https://api.moonshot.cn/v1'),
  KIMI_MODEL: z.string().optional(),
  OCR_PROVIDER: z.enum(['mock']).default('mock'),
  PAYMENT_PROVIDER: z.enum(['mock', 'wechat']).default('mock'),
  ALLOW_MOCK_PAYMENT: bool.default(true),
  WECHAT_PAY_MCH_ID: z.string().optional(),
  WECHAT_PAY_APP_ID: z.string().optional(),
  WECHAT_PAY_API_V3_KEY: z.string().optional(),
});
export type AppEnv = z.infer<typeof envSchema>;
export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const env = envSchema.parse(raw);
  if (
    env.NODE_ENV === 'production' &&
    (env.ALLOW_MOCK_PAYMENT || env.PAYMENT_PROVIDER === 'mock')
  ) {
    throw new Error('Production must not enable mock payment');
  }
  if (env.AI_PROVIDER === 'kimi' && (!env.KIMI_API_KEY || !env.KIMI_MODEL))
    throw new Error('Kimi configuration incomplete');
  return env;
}
