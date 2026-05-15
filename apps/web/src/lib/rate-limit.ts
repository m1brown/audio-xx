/**
 * Minimal in-memory per-IP rate limiter for the beta deploy.
 *
 * Defaults: 30 requests per 5 minutes per client IP. Configurable via
 * `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` env vars so the test
 * harness can run with a very short window without waiting 5 minutes.
 *
 * Scope and limits — read before reusing:
 *   - Single-instance process state. Vercel's serverless model spawns
 *     new Lambda containers under load; each container has its own
 *     `counters` map. For a low-volume friends/journalist beta this is
 *     fine: the financial risk we're guarding against is a single
 *     pathological client looping the endpoint, and that client's
 *     traffic generally lands on a small number of containers.
 *   - No persistence across deploys. A redeploy resets every counter.
 *   - No coordination across regions.
 *   - When real load arrives, swap for `@upstash/ratelimit` + Vercel
 *     KV. The function signature here (`checkRateLimit(ip)`) is the
 *     same shape that adapter would expose, so swapping is a one-file
 *     change at the call site.
 *
 * Logging is intentionally minimal: one structured `console.warn` per
 * deny event with `[rate-limit] ip=… count=… windowMs=…`. Allow events
 * are silent.
 */

interface Counter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, Counter>();

function readNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getRateLimitConfig() {
  return {
    max: readNumberEnv('RATE_LIMIT_MAX', 30),
    windowMs: readNumberEnv('RATE_LIMIT_WINDOW_MS', 5 * 60 * 1000),
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Increment the counter for `ip` and report whether the request is
 * allowed under the current window. Side effect: mutates `counters`.
 *
 * Stale entries — counters whose window has expired — are reset
 * lazily on access. There is no background sweep; the Map grows with
 * unique IPs seen since process start, then plateaus at the active set.
 * Acceptable at beta volume; revisit if memory pressure shows up.
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const { max, windowMs } = getRateLimitConfig();
  const now = Date.now();
  const existing = counters.get(ip);
  if (!existing || existing.resetAt <= now) {
    const fresh: Counter = { count: 1, resetAt: now + windowMs };
    counters.set(ip, fresh);
    return { allowed: true, remaining: max - 1, resetAt: fresh.resetAt, limit: max };
  }
  if (existing.count >= max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt, limit: max };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: max - existing.count,
    resetAt: existing.resetAt,
    limit: max,
  };
}

/**
 * Extract the client IP from a Next.js request. Prefers the
 * left-most entry of `x-forwarded-for` (the original client, when
 * the request has traversed Vercel's edge). Falls back to
 * `x-real-ip` and finally to a sentinel string so the counter still
 * partitions traffic even when no header is present (e.g., local
 * development against the dev server without a proxy).
 */
export function getClientIp(req: { headers: Headers }): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

/**
 * Test-only: reset all counters. NOT exported through any public
 * surface — used by the rate-limit Playwright spec via direct
 * import. Calling this in production has no security implication
 * (the next request just refills the bucket).
 */
export function _resetRateLimitForTests(): void {
  counters.clear();
}
