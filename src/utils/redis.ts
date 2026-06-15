import Redis, { type RedisOptions } from 'ioredis';
import { env } from '../config/env';

export const redisConnectionOptions: RedisOptions = {
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  ...(env.redis.host.includes('upstash.io') || process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
};

const redisClientOptions: RedisOptions = {
  ...redisConnectionOptions,
  connectTimeout: 1000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
};

let redisClient: Redis | null = null;

const attachRedisLogging = (client: Redis, label: string) => {
  client.on('error', (error) => {
    console.error(`[Redis:${label}] Connection error:`, error.message);
  });

  client.on('connect', () => {
    console.log(`[Redis:${label}] Connected`);
  });
};

export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = new Redis({
      ...redisClientOptions,
      connectionName: 'app-shared',
    });
    attachRedisLogging(redisClient, 'app-shared');
  }

  return redisClient;
};

export const createRedisConnection = (connectionName: string) => {
  const client = new Redis({
    ...redisConnectionOptions,
    connectionName,
  });
  attachRedisLogging(client, connectionName);
  return client;
};
