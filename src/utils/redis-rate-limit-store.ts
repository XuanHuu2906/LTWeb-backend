import type {
  ClientRateLimitInfo,
  Options,
  Store,
} from 'express-rate-limit';
import { getRedisClient } from './redis';

export class RedisRateLimitStore implements Store {
  localKeys = false;
  prefix: string;
  private windowMs = 60_000;

  constructor(prefix: string) {
    this.prefix = prefix.replace(/:+$/, '');
  }

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const redis = getRedisClient();
    const redisKey = this.key(key);
    const [rawHits, ttlMs] = await Promise.all([
      redis.get(redisKey),
      redis.pttl(redisKey),
    ]);

    if (!rawHits) return undefined;

    return {
      totalHits: Number(rawHits),
      resetTime: this.resetTimeFromTtl(ttlMs),
    };
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const redis = getRedisClient();
    const redisKey = this.key(key);
    const result = await redis.eval(
      `
      local hits = redis.call("INCR", KEYS[1])
      if hits == 1 then
        redis.call("PEXPIRE", KEYS[1], ARGV[1])
      end
      local ttl = redis.call("PTTL", KEYS[1])
      return { hits, ttl }
      `,
      1,
      redisKey,
      String(this.windowMs),
    );

    const [hits, ttlMs] = result as [number, number];
    return {
      totalHits: Number(hits),
      resetTime: this.resetTimeFromTtl(Number(ttlMs)),
    };
  }

  async decrement(key: string): Promise<void> {
    const redis = getRedisClient();
    await redis.eval(
      `
      local hits = redis.call("GET", KEYS[1])
      if not hits then
        return 0
      end
      hits = tonumber(hits)
      if hits <= 1 then
        redis.call("DEL", KEYS[1])
        return 0
      end
      return redis.call("DECR", KEYS[1])
      `,
      1,
      this.key(key),
    );
  }

  async resetKey(key: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(this.key(key));
  }

  async resetAll(): Promise<void> {
    const redis = getRedisClient();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${this.prefix}:*`,
        'COUNT',
        100,
      );

      if (keys.length > 0) {
        await redis.del(...keys);
      }

      cursor = nextCursor;
    } while (cursor !== '0');
  }

  private key(key: string) {
    return `${this.prefix}:${key}`;
  }

  private resetTimeFromTtl(ttlMs: number) {
    const safeTtl = ttlMs > 0 ? ttlMs : this.windowMs;
    return new Date(Date.now() + safeTtl);
  }
}

export const createRedisRateLimitStore = (prefix: string) =>
  new RedisRateLimitStore(prefix);
