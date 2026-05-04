/**
 * Role-based inclusion in system logic rows.
 *
 * All components in the chain must appear in the System Logic section
 * as individual rows (component → behavior → system effect).
 *
 * Previously tested via the "What the system does well" strengths section
 * which has been replaced by the gold-standard output contract.
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

function systemLogicSection(ctx: string): string {
  const i = ctx.indexOf('**System logic**');
  if (i < 0) return '';
  const j = ctx.indexOf('**Primary leverage**', i);
  return ctx.slice(i, j < 0 ? undefined : j);
}

describe('system-review — role-based inclusion in system logic', () => {
  it('3-component chain (DAC + amp + speakers) surfaces all three in system logic', () => {
    const synthetic = 'chord hugo, job integrated, wlm diva monitor';
    const subjects = extractSubjectMatches(synthetic);
    const result = buildSystemAssessment(synthetic, subjects, null, []);
    if (!result || result.kind !== 'assessment') return;

    const ctx = result.response.systemContext ?? '';
    const logic = systemLogicSection(ctx);

    // All three components must appear as system logic rows.
    const s = logic.toLowerCase();
    expect(s).toContain('chord hugo'.toLowerCase());
    expect(s).toContain('job integrated'.toLowerCase());
    expect(s).toContain('wlm diva'.toLowerCase());
  });
});
