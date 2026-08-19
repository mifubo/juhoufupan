import { describe, expect, it } from 'vitest';
import { validateEnv } from '../src/config';
const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};
describe('runtime configuration', () => {
  it('rejects mock payment in production', () =>
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', ALLOW_MOCK_PAYMENT: 'true' }),
    ).toThrow());
  it('requires Kimi secrets only when selected', () =>
    expect(() => validateEnv({ ...base, AI_PROVIDER: 'kimi' })).toThrow());
});
