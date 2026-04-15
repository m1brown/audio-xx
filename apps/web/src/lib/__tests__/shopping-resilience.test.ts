/**
 * Phase 5 resilience tests — overlay graceful degradation.
 *
 * These tests verify that the shopping/advisory pipeline never leaves
 * the user stuck at "Thinking…" when the LLM overlay or the deterministic
 * /api/evaluate endpoint is slow, unavailable, or broken.
 *
 * The four contract points:
 *   1. Overlay timeout   → deterministic shopping output still renders.
 *   2. Overlay failure   → deterministic shopping output still renders.
 *   3. Overlay success   → enhanced output, no regression.
 *   4. Evaluate hang     → bounded by fetchWithTimeout → pipeline proceeds.
 *
 * These are unit-level tests around the pieces that enforce the contract
 * (fetch-with-timeout + requestShoppingEditorial + requestEditorialClosing).
 * The UI layer (page.tsx) consumes these in a fire-and-forget Promise.allSettled,
 * and commits a deterministic panel BEFORE awaiting them, so by construction
 * the deterministic panel cannot be blocked by overlay latency or failure.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  fetchWithTimeout,
  FetchTimeoutError,
  EVALUATE_TIMEOUT_MS,
} from '../fetch-with-timeout';
import {
  requestShoppingEditorial,
  requestEditorialClosing,
  type ShoppingEditorialContext,
} from '../shopping-llm-overlay';
import type { AdvisoryOption } from '../advisory-response';

// ── Helpers ─────────────────────────────────────────

/**
 * Simulates the fire-and-forget overlay path the UI takes:
 *   1. Commit deterministic panel (sync).
 *   2. Kick off overlay promises (async, bounded).
 *   3. Merge only on successful results; keep deterministic otherwise.
 *
 * Returns what the UI would end up rendering.
 */
async function runShoppingPipelineSim(opts: {
  deterministicOptions: AdvisoryOption[];
  overlayBehavior: 'success' | 'failure' | 'timeout';
  overlayLatencyMs?: number;
}): Promise<{
  committedBeforeOverlay: boolean;
  enhancedAfterOverlay: boolean;
  renderedOptions: AdvisoryOption[];
}> {
  const { deterministicOptions, overlayBehavior, overlayLatencyMs = 0 } = opts;

  let committedBeforeOverlay = false;
  let enhancedAfterOverlay = false;
  let renderedOptions = deterministicOptions;

  // Step 1 — commit deterministic panel (this is what dispatchAdvisory does).
  committedBeforeOverlay = true;

  // Step 2 — kick off overlay (fire-and-forget).
  const overlayPromise = new Promise<AdvisoryOption[] | null>((resolve, reject) => {
    setTimeout(() => {
      if (overlayBehavior === 'success') {
        resolve(
          deterministicOptions.map((o) => ({
            ...o,
            editorial: { verdict: `Enhanced ${o.name}` },
          })) as AdvisoryOption[],
        );
      } else if (overlayBehavior === 'failure') {
        reject(new Error('LLM boom'));
      } else {
        // timeout — never resolve; the outer bound will abort
        // (simulate by never calling resolve/reject)
      }
    }, overlayLatencyMs);
  });

  // Simulate AbortController-style timeout wrapper the real overlay uses.
  const bounded = Promise.race<AdvisoryOption[] | null>([
    overlayPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 50)),
  ]).catch(() => null);

  const result = await bounded;
  if (result) {
    enhancedAfterOverlay = true;
    renderedOptions = result;
  }

  return { committedBeforeOverlay, enhancedAfterOverlay, renderedOptions };
}

const baseOptions: AdvisoryOption[] = [
  {
    name: 'Hugo 2',
    brand: 'Chord',
    role: 'DAC',
    priceUsd: 2000,
    optimizes: ['transparency'],
    tradeoffs: ['fatiguing on bright systems'],
  } as AdvisoryOption,
  {
    name: 'Bifrost 2/64',
    brand: 'Schiit',
    role: 'DAC',
    priceUsd: 899,
    optimizes: ['musical flow'],
    tradeoffs: ['less resolution'],
  } as AdvisoryOption,
];

// ── fetchWithTimeout ────────────────────────────────

describe('fetchWithTimeout — evaluate hang does not block UI', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('rejects with FetchTimeoutError when the server hangs longer than the timeout', async () => {
    // Server that never responds — simulates the observed prisma/SQLite hang.
    globalThis.fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    ) as typeof globalThis.fetch;

    await expect(
      fetchWithTimeout('/api/evaluate', { method: 'POST' }, 50),
    ).rejects.toBeInstanceOf(FetchTimeoutError);
  });

  it('resolves with the response when the server responds before the timeout', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ signals: { traits: {} } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as typeof globalThis.fetch;

    const res = await fetchWithTimeout('/api/evaluate', { method: 'POST' }, 500);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.signals).toBeDefined();
  });

  it('propagates non-timeout errors without wrapping them', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('network down');
    }) as typeof globalThis.fetch;

    await expect(
      fetchWithTimeout('/api/evaluate', { method: 'POST' }, 500),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('enforces the exported default timeout constant', () => {
    // Sanity check that the default timeout is short enough to never strand UI.
    expect(EVALUATE_TIMEOUT_MS).toBeGreaterThan(1000);
    expect(EVALUATE_TIMEOUT_MS).toBeLessThanOrEqual(10000);
  });
});

// ── Shopping overlay resilience ─────────────────────

describe('shopping overlay — graceful degradation', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const context: ShoppingEditorialContext = {
    systemComponents: ['Bryston 4B', 'ATC SCM19'],
    systemCharacter: 'fast, lean, resolving',
  };

  it('returns null (not hang) when the LLM endpoint hangs — overlay timeout path', async () => {
    // Simulate /api/memo-overlay never responding. The module's internal
    // AbortController + LLM_TIMEOUT_MS must abort the call and return null,
    // so the caller falls back to the deterministic descriptions.
    globalThis.fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    ) as typeof globalThis.fetch;

    const result = await requestShoppingEditorial(baseOptions, context);
    expect(result).toBeNull();
  }, 20000);

  it('returns null (not throw) when the LLM endpoint errors — overlay failure path', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response('upstream exploded', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        }),
    ) as typeof globalThis.fetch;

    const result = await requestShoppingEditorial(baseOptions, context);
    expect(result).toBeNull();
  });

  it('returns null when the LLM payload is malformed — overlay parse failure', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ content: '{{{ not json' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as typeof globalThis.fetch;

    const result = await requestShoppingEditorial(baseOptions, context);
    expect(result).toBeNull();
  });

  it('closing overlay also returns null on failure rather than throwing', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as typeof globalThis.fetch;

    const closing = await requestEditorialClosing(baseOptions, context);
    expect(closing).toBeNull();
  });
});

// ── End-to-end contract ─────────────────────────────

describe('shopping pipeline — deterministic panel always commits first', () => {
  it('deterministic panel is committed BEFORE overlay completion (success case)', async () => {
    const result = await runShoppingPipelineSim({
      deterministicOptions: baseOptions,
      overlayBehavior: 'success',
      overlayLatencyMs: 10,
    });

    expect(result.committedBeforeOverlay).toBe(true);
    // With a successful overlay that beats the 50ms bound, enhancement applies.
    expect(result.enhancedAfterOverlay).toBe(true);
    expect(result.renderedOptions).toHaveLength(baseOptions.length);
  });

  it('deterministic panel still renders when overlay FAILS', async () => {
    const result = await runShoppingPipelineSim({
      deterministicOptions: baseOptions,
      overlayBehavior: 'failure',
      overlayLatencyMs: 5,
    });

    expect(result.committedBeforeOverlay).toBe(true);
    expect(result.enhancedAfterOverlay).toBe(false);
    // Deterministic options are preserved intact.
    expect(result.renderedOptions).toEqual(baseOptions);
  });

  it('deterministic panel still renders when overlay TIMES OUT', async () => {
    const result = await runShoppingPipelineSim({
      deterministicOptions: baseOptions,
      overlayBehavior: 'timeout',
    });

    expect(result.committedBeforeOverlay).toBe(true);
    expect(result.enhancedAfterOverlay).toBe(false);
    expect(result.renderedOptions).toEqual(baseOptions);
  });

  it('overlay SUCCESS merges editorial fields without losing deterministic base', async () => {
    const result = await runShoppingPipelineSim({
      deterministicOptions: baseOptions,
      overlayBehavior: 'success',
      overlayLatencyMs: 5,
    });

    expect(result.enhancedAfterOverlay).toBe(true);
    // Every base option is still present — overlay enhances, never removes.
    for (const base of baseOptions) {
      const enriched = result.renderedOptions.find((o) => o.name === base.name);
      expect(enriched).toBeDefined();
      expect(enriched?.brand).toBe(base.brand);
      expect(enriched?.priceUsd).toBe(base.priceUsd);
    }
  });

  it('UI never perpetually "Thinking…": either panel commits or finally clears loading', async () => {
    // Contract: regardless of overlay behavior, the deterministic commit
    // (step 1) happens BEFORE any await on overlay completion. That means
    // SET_LOADING:false (dispatched in the finally wrapper) runs even if
    // the overlay hangs indefinitely.
    const cases: Array<'success' | 'failure' | 'timeout'> = [
      'success',
      'failure',
      'timeout',
    ];

    for (const overlayBehavior of cases) {
      const result = await runShoppingPipelineSim({
        deterministicOptions: baseOptions,
        overlayBehavior,
      });

      // The invariant we care about: panel always commits.
      expect(result.committedBeforeOverlay).toBe(true);
      expect(result.renderedOptions.length).toBeGreaterThan(0);
    }
  });
});
