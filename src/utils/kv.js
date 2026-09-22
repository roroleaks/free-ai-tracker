import { Redis } from '@upstash/redis';

const memory = new Map(); // string keys
const memorySets = new Map(); // set keys

function hasUpstashEnv() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

const redis = hasUpstashEnv() ? Redis.fromEnv() : null;

function memoryWarning(key) {
  console.warn(`[kv] Redis not configured — using in-memory store for "${key}"`);
}

export const kv = {
  async set(key, value) {
    if (redis) {
      await redis.set(key, value);
    } else {
      memory.set(key, value);
      memoryWarning(key);
    }
  },
  async get(key) {
    if (redis) {
      return await redis.get(key);
    }
    return memory.get(key) ?? null;
  },
  async sadd(key, value) {
    if (redis) {
      return await redis.sadd(key, value);
    }
    if (!memorySets.has(key)) memorySets.set(key, new Set());
    const set = memorySets.get(key);
    const wasPresent = set.has(value);
    set.add(value);
    memoryWarning(key);
    return wasPresent ? 0 : 1;
  },
  async smembers(key) {
    if (redis) {
      return await redis.smembers(key);
    }
    return memorySets.get(key) ? [...memorySets.get(key)] : [];
  },
  async srem(key, value) {
    if (redis) {
      return await redis.srem(key, value);
    }
    if (memorySets.has(key)) {
      memorySets.get(key).delete(value);
    }
    memoryWarning(key);
    return 1;
  },
  async sismember(key, value) {
    if (redis) {
      return await redis.sismember(key, value);
    }
    return memorySets.has(key) ? (memorySets.get(key).has(value) ? 1 : 0) : 0;
  },
  async scard(key) {
    if (redis) {
      return await redis.scard(key);
    }
    return memorySets.has(key) ? memorySets.get(key).size : 0;
  },
};

export { redis };