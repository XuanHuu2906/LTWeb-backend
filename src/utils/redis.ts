import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis({
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on('error', (error) => {
  if (env.nodeEnv === 'development') {
    console.warn('[Redis] Cache unavailable:', error.message);
  }
});
