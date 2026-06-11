import { getRedisClient } from './redis';

export const getOrSetCache = async <T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> => {
  const redis = getRedisClient();

  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error: any) {
    console.error(`[Redis:cache] Failed to read key "${key}":`, error.message);
  }

  const fresh = await fetcher();

  try {
    await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
  } catch (error: any) {
    console.error(`[Redis:cache] Failed to write key "${key}":`, error.message);
  }

  return fresh;
};

export const deleteCacheByPattern = async (pattern: string) => {
  const redis = getRedisClient();
  let cursor = '0';

  try {
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );

      if (keys.length > 0) {
        await redis.del(...keys);
      }

      cursor = nextCursor;
    } while (cursor !== '0');
  } catch (error: any) {
    console.error(
      `[Redis:cache] Failed to delete pattern "${pattern}":`,
      error.message,
    );
  }
};

export const cache = {
  async getJson<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();

    try {
      const cached = await redis.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (error: any) {
      console.error(`[Redis:cache] Failed to read key "${key}":`, error.message);
      return null;
    }
  },

  async setJson(key: string, value: unknown, ttlSeconds: number) {
    const redis = getRedisClient();

    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error: any) {
      console.error(`[Redis:cache] Failed to write key "${key}":`, error.message);
    }
  },

  delByPattern: deleteCacheByPattern,
};
