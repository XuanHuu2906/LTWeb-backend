import { redis } from './redis';

export const cache = {
  async getJson<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  },

  async setJson(key: string, value: unknown, ttlSeconds = 300) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Cache is optional. Database remains the source of truth.
    }
  },

  async del(key: string) {
    try {
      await redis.del(key);
    } catch {
      // Ignore cache failures.
    }
  },

  async delByPattern(pattern: string) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // Ignore cache failures.
    }
  },
};
