/**
 * Stage 8.1 — rate-limit module unit tests.
 *
 * Verifies the per-IP in-memory limiter at the function level. The
 * /api/orchestrator route's wiring is a direct passthrough
 * (extract IP → checkRateLimit → 429 envelope on deny), so testing
 * the limiter logic + the envelope shape covers the production
 * contract without needing to burn the localhost IP counter on a
 * running dev server.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  checkRateLimit,
  getClientIp,
  getRateLimitConfig,
  _resetRateLimitForTests,
} from '../rate-limit';

// Snapshot + restore the env vars the module reads so each test
// gets a clean config and the rest of the test run isn't affected.
const ORIG_MAX = process.env.RATE_LIMIT_MAX;
const ORIG_WINDOW = process.env.RATE_LIMIT_WINDOW_MS;

beforeAll(() => {
  process.env.RATE_LIMIT_MAX = '3';
  process.env.RATE_LIMIT_WINDOW_MS = '2000';
});

afterAll(() => {
  if (ORIG_MAX === undefined) delete process.env.RATE_LIMIT_MAX;
  else process.env.RATE_LIMIT_MAX = ORIG_MAX;
  if (ORIG_WINDOW === undefined) delete process.env.RATE_LIMIT_WINDOW_MS;
  else process.env.RATE_LIMIT_WINDOW_MS = ORIG_WINDOW;
});

beforeEach(() => {
  _resetRateLimitForTests();
});

describe('rate-limit — config', () => {
  it('reads defaults when env vars are absent', () => {
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    const cfg = getRateLimitConfig();
    expect(cfg.max).toBe(30);
    expect(cfg.windowMs).toBe(5 * 60 * 1000);
    // Restore for subsequent tests in this describe block
    process.env.RATE_LIMIT_MAX = '3';
    process.env.RATE_LIMIT_WINDOW_MS = '2000';
  });

  it('reads overrides when env vars are set', () => {
    process.env.RATE_LIMIT_MAX = '7';
    process.env.RATE_LIMIT_WINDOW_MS = '1234';
    const cfg = getRateLimitConfig();
    expect(cfg.max).toBe(7);
    expect(cfg.windowMs).toBe(1234);
    process.env.RATE_LIMIT_MAX = '3';
    process.env.RATE_LIMIT_WINDOW_MS = '2000';
  });

  it('ignores non-numeric env values and falls back', () => {
    process.env.RATE_LIMIT_MAX = 'not-a-number';
    expect(getRateLimitConfig().max).toBe(30);
    process.env.RATE_LIMIT_MAX = '3';
  });
});

describe('rate-limit — checkRateLimit', () => {
  it('allows requests up to the limit and denies the next one', () => {
    const ip = '203.0.113.7';
    const a = checkRateLimit(ip);
    expect(a.allowed).toBe(true);
    expect(a.remaining).toBe(2);
    expect(a.limit).toBe(3);

    const b = checkRateLimit(ip);
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(1);

    const c = checkRateLimit(ip);
    expect(c.allowed).toBe(true);
    expect(c.remaining).toBe(0);

    const d = checkRateLimit(ip);
    expect(d.allowed).toBe(false);
    expect(d.remaining).toBe(0);
  });

  it('partitions counters by IP', () => {
    const a = '203.0.113.1';
    const b = '203.0.113.2';
    checkRateLimit(a);
    checkRateLimit(a);
    checkRateLimit(a);
    expect(checkRateLimit(a).allowed).toBe(false);
    // Different IP still has fresh budget — first call uses 1, leaves 2 remaining
    const firstB = checkRateLimit(b);
    expect(firstB.allowed).toBe(true);
    expect(firstB.remaining).toBe(2);
  });

  it('resets after the window expires', async () => {
    const ip = '203.0.113.99';
    checkRateLimit(ip);
    checkRateLimit(ip);
    checkRateLimit(ip);
    expect(checkRateLimit(ip).allowed).toBe(false);
    // Window is 2000ms in this test config; wait it out + small buffer
    await new Promise((r) => setTimeout(r, 2100));
    const fresh = checkRateLimit(ip);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(2);
  });

  it('reports resetAt in the future on the first request', () => {
    const before = Date.now();
    const r = checkRateLimit('203.0.113.50');
    expect(r.resetAt).toBeGreaterThan(before);
    expect(r.resetAt).toBeLessThanOrEqual(before + 2100);
  });
});

describe('rate-limit — getClientIp', () => {
  function headers(record: Record<string, string>): Headers {
    const h = new Headers();
    for (const [k, v] of Object.entries(record)) h.set(k, v);
    return h;
  }

  it('returns the first IP from x-forwarded-for', () => {
    const req = { headers: headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1, 10.0.0.2' }) };
    expect(getClientIp(req)).toBe('198.51.100.1');
  });

  it('trims whitespace in the x-forwarded-for first entry', () => {
    const req = { headers: headers({ 'x-forwarded-for': '   198.51.100.2   , 10.0.0.1' }) };
    expect(getClientIp(req)).toBe('198.51.100.2');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = { headers: headers({ 'x-real-ip': '198.51.100.3' }) };
    expect(getClientIp(req)).toBe('198.51.100.3');
  });

  it('returns "unknown" when no IP header is present', () => {
    const req = { headers: headers({}) };
    expect(getClientIp(req)).toBe('unknown');
  });

  it('prefers x-forwarded-for over x-real-ip when both are present', () => {
    const req = { headers: headers({
      'x-forwarded-for': '198.51.100.10',
      'x-real-ip': '198.51.100.99',
    }) };
    expect(getClientIp(req)).toBe('198.51.100.10');
  });
});

describe('rate-limit — orchestrator route envelope smoke', () => {
  // Direct invocation of the route handler so the test runs without
  // a live dev server and without burning the localhost counter for
  // the next 5 minutes. Verifies the 429 path returns the documented
  // { error, fallbackOutput } envelope with the calm-tone message.
  it('returns the 429 fallback envelope after the limit is exceeded', async () => {
    const { POST } = await import('../../app/api/orchestrator/route');
    const headersInit = { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.77' };
    const body = JSON.stringify({ mode: 'shopping' });
    // Burn the budget (limit is 3 in this test config)
    for (let i = 0; i < 3; i++) {
      await POST(new Request('http://localhost/api/orchestrator', { method: 'POST', headers: headersInit, body }) as never);
    }
    const denied = await POST(
      new Request('http://localhost/api/orchestrator', { method: 'POST', headers: headersInit, body }) as never,
    );
    expect(denied.status).toBe(429);
    expect(denied.headers.get('Retry-After')).toBeTruthy();
    expect(denied.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(denied.headers.get('X-RateLimit-Remaining')).toBe('0');
    const payload = await denied.json();
    expect(payload.error).toBe('rate_limited');
    expect(payload.fallbackOutput).toBeTruthy();
    expect(payload.fallbackOutput.responseText).toBe(
      "You're moving faster than I can think. Try again in a moment.",
    );
    expect(payload.fallbackOutput.debug.fallbackReason).toContain('rate_limited');
    expect(payload.fallbackOutput.debug.llmCalled).toBe(false);
  });

  it('still rate-limits when the JSON payload is malformed', async () => {
    const { POST } = await import('../../app/api/orchestrator/route');
    const headersInit = { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.78' };
    // Three valid-shape requests to burn the budget
    for (let i = 0; i < 3; i++) {
      await POST(new Request('http://localhost/api/orchestrator', {
        method: 'POST', headers: headersInit, body: JSON.stringify({ mode: 'shopping' }),
      }) as never);
    }
    // Fourth request with malformed JSON — still rate-limited (guard
    // runs before JSON parse so an attacker can't bypass via garbage
    // payloads).
    const denied = await POST(
      new Request('http://localhost/api/orchestrator', {
        method: 'POST', headers: headersInit, body: 'not-json',
      }) as never,
    );
    expect(denied.status).toBe(429);
  });
});
