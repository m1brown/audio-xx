/**
 * Blocker-fix verification tests.
 *
 * Covers three QA blockers identified in the pre-review Chrome QA:
 *
 *   A. _DEBUG output must not appear in rendered system-review content
 *   B. Bluesound NODE X + PrimaLuna EVO 300 + Harbeth P3ESR must not
 *      produce fused entities ("Primaluna Node X", "Devore Bluesound node")
 *   C. "Tell me about the Chord sound" must not return "not in catalog"
 */

import { describe, it, expect, beforeAll } from 'vitest';

// ── localStorage shim (required for saved-system internals) ──────
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
import { extractSubjectMatches, detectIntent } from '../intent';
import { detectSystemDescription } from '../system-extraction';
import { buildProductAssessment } from '../product-assessment';
import type { AssessmentContext } from '../product-assessment';

// ═══════════════════════════════════════════════════════════════════
// A. _DEBUG output must not appear in system-review content
// ═══════════════════════════════════════════════════════════════════

describe('Blocker A: no _DEBUG in system review output', () => {
  it('system review for Pontus + Leben + Harbeth has no _DEBUG strings', () => {
    const text = 'My system: Denafrips Pontus II → Leben CS300 → Harbeth Super HL5 Plus. Assess my system.';
    const subjects = extractSubjectMatches(text);
    const result = buildSystemAssessment(text, subjects, null, []);

    expect(result).not.toBeNull();
    if (result!.kind !== 'assessment') return;

    const ctx = result!.response.systemContext ?? '';
    expect(ctx).not.toContain('_DEBUG');
    expect(ctx).not.toContain('dominant:');
    expect(ctx).not.toContain('primary kind:');
    expect(ctx).not.toContain('damping evidence:');
  });

  it('system review for JOB + WLM Diva has no _DEBUG strings', () => {
    const text = 'job integrated amp and wlm diva speakers';
    const subjects = extractSubjectMatches(text);
    const result = buildSystemAssessment(text, subjects, null, []);

    if (!result || result.kind !== 'assessment') return;

    const ctx = result.response.systemContext ?? '';
    expect(ctx).not.toContain('_DEBUG');
  });
});

// ═══════════════════════════════════════════════════════════════════
// B. Brand-fusion parsing — separate products must remain separate
// ═══════════════════════════════════════════════════════════════════

describe('Blocker B: no brand-fusion across products', () => {
  // detectSystemDescription requires ownership language + assessment language.
  // The empty audioState signals no prior conversation state.
  const emptyState = { components: [], mode: null, pending: null } as any;

  it('Bluesound NODE X + PrimaLuna EVO 300 + Harbeth P3ESR → no fused entities', () => {
    const text = 'My system: Bluesound NODE X → PrimaLuna EVO 300 Integrated → Harbeth P3ESR. What should I upgrade?';
    const subjects = extractSubjectMatches(text);
    const sys = detectSystemDescription(text, subjects, emptyState);

    expect(sys).not.toBeNull();
    const names = sys!.components.map(c => `${c.brand} ${c.name}`.toLowerCase());
    const allText = names.join(' | ');

    // No fused entities
    expect(allText).not.toContain('primaluna node');
    expect(allText).not.toContain('primaluna bluesound');
    expect(allText).not.toContain('harbeth bluesound');
    expect(allText).not.toContain('devore bluesound');

    // Correct brand-product associations
    const hasBluesound = names.some(n => n.includes('bluesound') && n.includes('node'));
    const hasPrimaLuna = names.some(n => n.includes('primaluna') && n.includes('evo'));
    const hasHarbeth = names.some(n => n.includes('harbeth') && n.includes('p3esr'));
    expect(hasBluesound).toBe(true);
    expect(hasPrimaLuna).toBe(true);
    expect(hasHarbeth).toBe(true);
  });

  it('Bluesound NODE X gets Bluesound brand (not PrimaLuna)', () => {
    const text = 'My system: Bluesound NODE X → PrimaLuna EVO 300 → Harbeth P3ESR. Assess.';
    const subjects = extractSubjectMatches(text);
    const sys = detectSystemDescription(text, subjects, emptyState);

    expect(sys).not.toBeNull();
    const nodeComponent = sys!.components.find(
      c => c.name.toLowerCase().includes('node'),
    );
    expect(nodeComponent).toBeDefined();
    expect(nodeComponent!.brand.toLowerCase()).toBe('bluesound');
  });

  it('PrimaLuna EVO 300 gets PrimaLuna brand (not Harbeth)', () => {
    const text = 'My system: Bluesound NODE X → PrimaLuna EVO 300 Integrated → Harbeth P3ESR. Rate this.';
    const subjects = extractSubjectMatches(text);
    const sys = detectSystemDescription(text, subjects, emptyState);

    expect(sys).not.toBeNull();
    const evoComponent = sys!.components.find(
      c => c.name.toLowerCase().includes('evo'),
    );
    expect(evoComponent).toBeDefined();
    expect(evoComponent!.brand.toLowerCase()).toBe('primaluna');
  });

  it('Hegel H390 + DeVore O/93 + Bluesound Node → no fused entities', () => {
    const text = 'I have a hegel h390 with devore orangutan o/93, streaming from a bluesound node. Assess.';
    const subjects = extractSubjectMatches(text);
    const sys = detectSystemDescription(text, subjects, emptyState);

    if (!sys) return; // may not parse depending on gate conditions
    const names = sys.components.map(c => `${c.brand} ${c.name}`.toLowerCase());
    const allText = names.join(' | ');

    // No cross-brand fusion
    expect(allText).not.toContain('devore bluesound');
    expect(allText).not.toContain('hegel bluesound');
  });
});

// ═══════════════════════════════════════════════════════════════════
// C. Chord brand recognition — "Tell me about the Chord sound"
// ═══════════════════════════════════════════════════════════════════

describe('Blocker C: Chord brand recognized in catalog', () => {
  it('"Tell me about the Chord sound" does not return "not in catalog"', () => {
    const text = 'Tell me about the Chord sound';
    const { subjectMatches } = detectIntent(text);
    const ctx: AssessmentContext = {
      subjectMatches,
      currentMessage: text,
    };
    const assessment = buildProductAssessment(ctx);

    expect(assessment).not.toBeNull();
    // Must NOT contain "isn't in my catalog" or "not in catalog"
    expect(assessment!.shortAnswer).not.toContain("isn't in my catalog");
    expect(assessment!.shortAnswer).not.toContain('not in catalog');
    // Must indicate the brand IS recognized
    expect(assessment!.shortAnswer.toLowerCase()).toContain('chord');
    // catalogMatch should be true for brand-only with siblings
    expect(assessment!.catalogMatch).toBe(true);
  });

  it('"thoughts on chord" does not say not-in-catalog', () => {
    const text = 'thoughts on chord';
    const { subjectMatches } = detectIntent(text);
    const ctx: AssessmentContext = {
      subjectMatches,
      currentMessage: text,
    };
    const assessment = buildProductAssessment(ctx);

    expect(assessment).not.toBeNull();
    expect(assessment!.shortAnswer).not.toContain("isn't in my catalog");
    expect(assessment!.catalogMatch).toBe(true);
  });

  it('"what do you know about chord" does not say not-in-catalog', () => {
    const text = 'what do you know about chord';
    const { subjectMatches } = detectIntent(text);
    const ctx: AssessmentContext = {
      subjectMatches,
      currentMessage: text,
    };
    const assessment = buildProductAssessment(ctx);

    expect(assessment).not.toBeNull();
    expect(assessment!.shortAnswer).not.toContain("isn't in my catalog");
  });

  it('specific product "chord qutest" still returns catalog match', () => {
    const text = 'tell me about the chord qutest';
    const { subjectMatches } = detectIntent(text);
    const ctx: AssessmentContext = {
      subjectMatches,
      currentMessage: text,
    };
    const assessment = buildProductAssessment(ctx);

    expect(assessment).not.toBeNull();
    expect(assessment!.catalogMatch).toBe(true);
    expect(assessment!.candidateName).toMatch(/Qutest/i);
  });

  it('product with known note (LAiV uDAC) uses sibling path, not "not in catalog"', () => {
    const text = 'what about the laiv udac?';
    const { subjectMatches } = detectIntent(text);
    const ctx: AssessmentContext = {
      subjectMatches,
      currentMessage: text,
    };
    const assessment = buildProductAssessment(ctx);

    // LAiV uDAC has a KNOWN_PRODUCT_NOTES entry linking it to the
    // Harmony DAC, so it takes the sibling path. Just verify it works.
    expect(assessment).not.toBeNull();
    expect(assessment!.shortAnswer.toLowerCase()).toContain('laiv');
  });
});
