// Simple in-process cache for dev / no-Redis fallback.
// When UPSTASH_REDIS_REST_URL is set, uses Upstash Redis instead.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

async function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (redis) {
    const val = await redis.get<T>(key);
    return val ?? null;
  }
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.value;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.set(key, value, { ex: ttlSeconds });
    return;
  }
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached != null) return cached;
  const fresh = await fn();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}
