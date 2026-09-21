import { Redis } from '@upstash/redis';

const memory = new Map();

function hasUpstashEnv() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

const redis = hasUpstashEnv() ? Redis.fromEnv() : null;

export const kv = {
  async set(key, value) {
    if (redis) {
      await redis.set(key, value);
    } else {
      memory.set(key, value);
      console.warn(`[kv] Redis not configured — using in-memory store for "${key}"`);
    }
  },
  async get(key) {
    if (redis) {
      return await redis.get(key);
    }
    return memory.get(key) ?? null;
  },
};

export { redis };