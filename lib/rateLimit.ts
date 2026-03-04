// ============================================================================
// Rate limiter for Next.js API routes.
//
// Strategy:
//   • Upstash Redis (preferred, production): shared state across all serverless
//     replicas/invocations. Requires UPSTASH_REDIS_REST_URL and
//     UPSTASH_REDIS_REST_TOKEN environment variables.
//   • In-memory fallback (local dev / no env vars): single-process only.
//     Effective for development but does NOT work on multi-replica or
//     serverless deployments where each invocation is a fresh process.
//
// Setup Upstash (one-time):
//   1. Create a free database at https://console.upstash.com
//   2. Copy the REST URL and token into your environment:
//        UPSTASH_REDIS_REST_URL=https://...upstash.io
//        UPSTASH_REDIS_REST_TOKEN=...
//   3. Add those same vars to Vercel → Project → Settings → Environment Variables.
//
// Usage (unchanged from previous API):
//   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
//   const result = await limiter.check(req);
//   if (!result.ok) return NextResponse.json(..., { status: 429 });
// ============================================================================

import type { NextRequest } from 'next/server';

interface RateLimiterOptions {
  /** Rolling window duration in milliseconds. Default: 60 000 (1 minute). */
  windowMs?: number;
  /** Maximum number of requests allowed within the window. Default: 20. */
  max?: number;
}

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number; // unix ms when the window resets
}

// ─── Client IP extraction (shared) ───────────────────────────────────────────

function getClientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return (
    (req as unknown as { socket?: { remoteAddress?: string } }).socket
      ?.remoteAddress ?? 'unknown'
  );
}

// ─── Upstash implementation ───────────────────────────────────────────────────

function createUpstashLimiter(windowMs: number, max: number) {
  // Lazy-initialize on first request so the client is never constructed at
  // build/module-evaluation time (which would fail with placeholder env vars).
  let ratelimit: import('@upstash/ratelimit').Ratelimit | null = null;

  function getRatelimit() {
    if (ratelimit) return ratelimit;
    const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
    const { Ratelimit } = require('@upstash/ratelimit') as typeof import('@upstash/ratelimit');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const windowSecs = Math.ceil(windowMs / 1000);
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowSecs} s`),
      analytics: false,
    });
    return ratelimit;
  }

  return {
    async check(req: NextRequest): Promise<RateLimitResult> {
      const key = getClientKey(req);
      const { success, remaining, reset } = await getRatelimit().limit(key);
      return { ok: success, remaining, resetAt: reset };
    },
  };
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

function createInMemoryLimiter(windowMs: number, max: number) {
  interface HitRecord { timestamps: number[] }
  const store = new Map<string, HitRecord>();

  return {
    async check(req: NextRequest): Promise<RateLimitResult> {
      const key = getClientKey(req);
      const now = Date.now();
      const cutoff = now - windowMs;

      const record = store.get(key) ?? { timestamps: [] };
      record.timestamps = record.timestamps.filter((t) => t > cutoff);

      if (record.timestamps.length >= max) {
        const resetAt = record.timestamps[0] + windowMs;
        store.set(key, record);
        return { ok: false, remaining: 0, resetAt };
      }

      record.timestamps.push(now);
      store.set(key, record);
      return { ok: true, remaining: max - record.timestamps.length, resetAt: now + windowMs };
    },
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 20;

  const hasUpstash =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (hasUpstash) {
    return createUpstashLimiter(windowMs, max);
  }

  if (process.env.NODE_ENV === 'production') {
    // Warn once at module load time so it appears in Vercel function logs.
    console.warn(
      '[rateLimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. ' +
      'Falling back to in-memory rate limiter — ineffective on serverless. ' +
      'Add Upstash env vars to enable distributed rate limiting.'
    );
  }

  return createInMemoryLimiter(windowMs, max);
}
