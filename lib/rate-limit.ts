import prisma from "@/lib/prisma";

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * Extract client IP from headers.
 */
export function extractIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "127.0.0.1"
  );
}

// Memory fallback store (used only if database/redis are temporarily unreachable)
interface MemoryEntry {
  timestamps: number[];
}
const memoryFallbackStore = new Map<string, MemoryEntry>();

function checkMemoryFallback(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = memoryFallbackStore.get(key) ?? { timestamps: [] };
  const cutoff = now - options.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= options.limit) {
    const oldest = entry.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  entry.timestamps.push(now);
  memoryFallbackStore.set(key, entry);
  return { allowed: true, remaining: options.limit - entry.timestamps.length };
}

let tableInitialized = false;

/**
 * Ensures the PostgreSQL rate limits table exists.
 */
async function ensureRateLimitTable(): Promise<void> {
  if (tableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_rate_limits" (
        "key" VARCHAR(255) PRIMARY KEY,
        "count" INTEGER NOT NULL DEFAULT 1,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_rate_limits_expires_at" ON "_rate_limits"("expires_at");
    `);
    tableInitialized = true;
  } catch (err) {
    console.error("Failed to ensure _rate_limits table:", err);
  }
}

/**
 * Atomic PostgreSQL shared rate limiter across all application/serverless instances.
 */
async function checkPostgresRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  await ensureRateLimitTable();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + options.windowMs);

  // Single atomic UPSERT in PostgreSQL
  const rows = await prisma.$queryRawUnsafe<
    { count: number; expires_at: Date }[]
  >(
    `
    INSERT INTO "_rate_limits" ("key", "count", "expires_at")
    VALUES ($1, 1, $2)
    ON CONFLICT ("key") DO UPDATE
    SET "count" = CASE
        WHEN "_rate_limits"."expires_at" <= NOW() THEN 1
        ELSE "_rate_limits"."count" + 1
      END,
      "expires_at" = CASE
        WHEN "_rate_limits"."expires_at" <= NOW() THEN $2
        ELSE "_rate_limits"."expires_at"
      END
    RETURNING "count", "expires_at";
    `,
    key,
    expiresAt
  );

  if (!rows || rows.length === 0) {
    return checkMemoryFallback(key, options);
  }

  const { count, expires_at: rowExpiresAt } = rows[0];
  const expiryTime = new Date(rowExpiresAt).getTime();
  const remaining = Math.max(0, options.limit - count);

  if (count > options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((expiryTime - Date.now()) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, remaining };
}

/**
 * Optional Upstash Redis rate limiter (if credentials configured in environment).
 */
async function checkUpstashRateLimit(
  url: string,
  token: string,
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const windowSec = Math.max(1, Math.ceil(options.windowMs / 1000));
  const redisKey = `rate_limit:${key}`;

  // Upstash REST pipeline: INCR + EXPIRE (if new key)
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, windowSec, "NX"],
      ["TTL", redisKey],
    ]),
  });

  if (!res.ok) {
    throw new Error(`Upstash returned ${res.status}`);
  }

  const results = await res.json();
  const count = results[0]?.result as number;
  const ttl = (results[2]?.result as number) || windowSec;

  if (count > options.limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, ttl) };
  }

  return { allowed: true, remaining: Math.max(0, options.limit - count) };
}

/**
 * Production-ready distributed rate limit check.
 * - Uses Upstash Redis if configured in environment variables.
 * - Defaults to atomic PostgreSQL-backed rate limiting (shared across all instances).
 * - Gracefully falls back to local memory if database/network is temporarily unreachable.
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      return await checkUpstashRateLimit(upstashUrl, upstashToken, key, options);
    } catch (err) {
      console.warn("Upstash Redis rate limit failed, falling back to PostgreSQL:", err);
    }
  }

  try {
    return await checkPostgresRateLimit(key, options);
  } catch (dbErr) {
    console.warn("PostgreSQL rate limit failed, using memory fallback:", dbErr);
    return checkMemoryFallback(key, options);
  }
}
