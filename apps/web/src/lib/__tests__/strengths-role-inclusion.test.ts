/**
 * Role-based inclusion in the "What the system is doing well" section.
 *
 * Regression: for a 3-component chain (DAC → amp → speakers), the
 * previous selection logic capped strength bullets at 2, which silently
 * dropped one core role — typically the source. The fix replaces the
 * top-N cap with role-based inclusion (source, amp, listener).
 *
 * This test is narrowly scoped to the selection behavior; it does not
 * assert on prose wording (that is covered by narrative-rewrite-e2e).
 */

import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  // @ts-expect-error - test-only global shim
  globalThis.window = globalThis.window ?? {};
  // @ts-expect-error - test-only global shim
  globalThis.window.localStorage = ls;
});

import { buildSystemAssessment } from '../consultation';
import { extractSubjectMatches } from '../intent';

function strengthsSection(ctx: string): string {
  // Support both old and new section header names.
  let i = ctx.indexOf('**What the system does well**');
  if (i < 0) i = ctx.indexOf('**What the system is doing well**');
  if (i < 0) return '';
  let j = ctx.indexOf('**Where the system is constrained**', i);
  if (j < 0) j = ctx.indexOf('**Listener alignment**', i);
  return ctx.slice(i, j < 0 ? undefined : j);
}

describe('system-review strengths — role-based inclusion', () => {
  it('3-component chain (DAC + amp + speakers) surfaces all three roles', () => {
    const synthetic = 'chord hugo, job integrated, wlm diva monitor';
    const subjects = extractSubjectMatches(synthetic);
    const result = buildSystemAssessment(synthetic, subjects, null, []);
    if (!result || result.kind !== 'assessment') return;

    const ctx = result.response.systemContext ?? '';
    const strengths = strengthsSection(ctx);

    // The source component (DAC) must no longer be dropped by the
    // previous 2-cap. Name matches are case-insensitive because the
    // renderer may normalize display names.
    const s = strengths.toLowerCase();
    expect(s).toContain('chord hugo'.toLowerCase());
    expect(s).toContain('job integrated'.toLowerCase());
    expect(s).toContain('wlm diva'.toLowerCase());
  });
});
