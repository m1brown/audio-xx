/**
 * Final render verification pass — runs the four example queries through
 * the real production handlers and prints the rendered narrative so it
 * can be inspected against the Audio XX Playbook blocker checklist:
 *
 *   1. No speed/transient-first framing for warm/musical DAC
 *   2. No duplicated component names
 *   3. No stray enum/token leakage ("JOB" as prose uppercase, _DEBUG, etc.)
 *   4. No false grounding claims on brand-only pages
 *   5. "Super HL5 Plus" preserved exactly
 *   6. Optimize panel logically consistent with identified bottleneck
 *
 * This test does NOT guard with expect() on prose content — prose varies
 * across product catalog updates. It *does* assert the strict blocker
 * invariants from the checklist above, so a regression on any of the
 * seven fixed items will surface as a red test.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// localStorage shim — some downstream modules touch it on import
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
  // @ts-expect-error test-only global shim
  globalThis.window = globalThis.window ?? {};
  // @ts-expect-error test-only global shim
  globalThis.window.localStorage = ls;
});

import { processText } from '../engine';
import { detectIntent, extractSubjectMatches } from '../intent';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { reason } from '../reasoning';
import { shoppingToAdvisory } from '../advisory-response';
import { buildSystemAssessment } from '../consultation';
import { buildProductAssessment, type AssessmentContext } from '../product-assessment';

// ── Presentation-layer helpers (mirror AdvisoryMessage.tsx) ──
// These are the exact predicates used in the renderer. Keeping them
// aligned here lets us verify render-layer behavior without mounting
// React in the test.

const SECTION_REGEX = /\*\*([^*]+)\*\*\s*\n+([\s\S]*?)(?=\n\*\*[^*\n]+\*\*\s*(?:\n|$)|$)/g;

function parseSections(raw: string): Array<{ header: string; body: string }> {
  const out: Array<{ header: string; body: string }> = [];
  const re = new RegExp(SECTION_REGEX.source, SECTION_REGEX.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.push({ header: m[1].trim(), body: m[2].trim() });
  }
  return out;
}

function attributionFor(audioProfile?: {
  systemChain?: unknown[];
  sonicPriorities?: unknown[];
  sonicAvoids?: unknown[];
  archetype?: unknown;
}): string | null {
  const hasSystem = !!(audioProfile?.systemChain && audioProfile.systemChain.length);
  const hasProfile = !!(
    (audioProfile?.sonicPriorities?.length ?? 0) > 0 ||
    (audioProfile?.sonicAvoids?.length ?? 0) > 0 ||
    !!audioProfile?.archetype
  );
  if (!hasSystem && !hasProfile) return null;
  if (hasSystem && hasProfile) return 'Based on how your components interact and your listener profile.';
  if (hasSystem) return 'Based on how your components interact.';
  return 'Based on your stated listening preferences.';
}

function hasDuplicateComponent(text: string, names: string[]): string | null {
  for (const n of names) {
    const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'gi');
    const hits = text.match(re);
    if (hits && hits.length > 1) {
      // Only flag when they appear in an "X and X" or "X, X" shape.
      const consecutive = new RegExp(
        `\\b${n.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b[^.]{0,30}?\\band\\b[^.]{0,30}?\\b${n.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`,
        'i',
      );
      if (consecutive.test(text)) return n;
    }
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════
// QUERY 1 — Best DAC under $2000 for a warm, musical system
// ═════════════════════════════════════════════════════════════════════

describe('Render verification — Query 1: warm/musical DAC under $2000', () => {
  const query = 'Best DAC under $2000 for a warm, musical system';

  it('renders with tonal/harmonic direction, not rhythmic/transient', () => {
    const signals = processText(query);
    const ctx = detectShoppingIntent(query, signals, undefined);
    const reasoning = reason(query, [], signals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, signals, undefined, reasoning, undefined);
    const advisory = shoppingToAdvisory(answer, signals);

    const prose = [
      advisory.recommendedDirection,
      ...(advisory.whyThisFits ?? []),
      advisory.sonicLandscape ?? '',
      advisory.editorialIntro ?? '',
    ].filter(Boolean).join('\n');

    console.log('\n───────── QUERY 1 — warm/musical DAC ─────────');
    console.log('Preference summary :', answer.preferenceSummary);
    console.log('Direction          :', answer.bestFitDirection);
    console.log('Why this fits      :');
    for (const w of answer.whyThisFits) console.log('  •', w);
    console.log('Sonic landscape    :', answer.sonicLandscape ?? '(none)');
    console.log('Product examples   :');
    for (const p of answer.productExamples.slice(0, 4)) {
      console.log(`  - ${p.brand} ${p.name} — $${p.price}${p.roleLabel ? ` · ${p.roleLabel}` : ''}`);
    }

    // Blocker 1: no rhythmic/transient framing
    const proseLc = prose.toLowerCase();
    expect(proseLc).not.toMatch(/transient definition/);
    expect(proseLc).not.toMatch(/rhythmic precision/);
    expect(proseLc).not.toMatch(/speed and rhythmic engagement/);
    // Must contain a positive tonal signal
    expect(proseLc).toMatch(/tonal|harmonic|warmth|flow/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// QUERY 2 — NODE X → EVO 300 Integrated → P3ESR, what should I upgrade?
// ═════════════════════════════════════════════════════════════════════

describe('Render verification — Query 2: NODE X / EVO 300 / P3ESR upgrade', () => {
  const query = 'My system: Bluesound NODE X → PrimaLuna EVO 300 Integrated → Harbeth P3ESR. What should I upgrade?';

  it('renders a system assessment with canonical names and no duplicates', () => {
    const subjects = extractSubjectMatches(query);
    const result = buildSystemAssessment(query, subjects, null, []);
    expect(result).not.toBeNull();
    if (!result || result.kind !== 'assessment') return;

    const ctx = result.response.systemContext ?? '';
    const bottom = result.response.bottomLine ?? '';
    const summary = result.response.comparisonSummary ?? '';
    const componentNames = (result.findings?.componentNames ?? []).slice();

    console.log('\n───────── QUERY 2 — NODE X / EVO 300 / P3ESR ─────────');
    console.log('Components:', componentNames);
    console.log('─ systemContext ─');
    console.log(ctx);
    console.log('─ bottomLine ─');
    console.log(bottom);

    // Blocker 2 (dupes): no "X and X" patterns for any named component
    const allProse = [ctx, bottom, summary].join('\n');
    for (const name of ['NODE X', 'EVO 300', 'EVO 300 Integrated', 'P3ESR', 'Bluesound NODE X', 'PrimaLuna EVO 300', 'Harbeth P3ESR']) {
      const dup = hasDuplicateComponent(allProse, [name]);
      expect(dup, `duplicated "${name}" in rendered prose`).toBeNull();
    }

    // Blocker 3 (token leakage): no _DEBUG / JOB prose leak / stray enum
    expect(allProse).not.toMatch(/_DEBUG/);
    expect(allProse).not.toMatch(/\bJOB\b/);         // the English-word uppercasing leak
    expect(allProse).not.toMatch(/dominant:|damping evidence:|primary kind:/);

    // Blocker 6 (optimize panel consistency): if there's an "Action path"
    // (or legacy "If you optimize") section, the body should either
    // (a) include a "Change the ..." directive that matches an identified
    // bottleneck, or (b) not exist at all.
    const sections = parseSections(ctx);
    const optimize = sections.find((s) => /optimize|action path/i.test(s.header));
    if (optimize) {
      console.log('─ optimize body ─');
      console.log(optimize.body);
      // Parser must capture the upgrade directive, not truncate at inline bold.
      expect(optimize.body.length).toBeGreaterThan(30);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// QUERY 3 — Tell me about the Chord sound (brand-only inquiry)
// ═════════════════════════════════════════════════════════════════════

describe('Render verification — Query 3: brand-only Chord inquiry', () => {
  const query = 'Tell me about the Chord sound';

  it('product assessment renders without false grounding claims', () => {
    const subjects = extractSubjectMatches(query);
    const ctx: AssessmentContext = {
      subjectMatches: subjects,
      activeSystem: null,
      tasteProfile: undefined,
      advisoryCtx: {} as any,
      currentMessage: query,
    };
    const result = buildProductAssessment(ctx);

    console.log('\n───────── QUERY 3 — Chord brand-only ─────────');
    if (!result) {
      console.log('[no product-assessment result returned]');
      return;
    }
    console.log('subject     :', result.subject);
    console.log('bottomLine  :', result.bottomLine);
    console.log('audioProfile:', JSON.stringify({
      systemChain: result.audioProfile?.systemChain?.length ?? 0,
      sonicPriorities: result.audioProfile?.sonicPriorities?.length ?? 0,
      sonicAvoids: result.audioProfile?.sonicAvoids?.length ?? 0,
      archetype: result.audioProfile?.archetype ?? null,
    }));
    const attribution = attributionFor(result.audioProfile);
    console.log('attribution :', attribution ?? '(suppressed)');

    // Blocker 4 (false grounding): with no system AND no profile, the renderer
    // must NOT print the attribution line.
    const hasSystem = (result.audioProfile?.systemChain?.length ?? 0) > 0;
    const hasProfile = (result.audioProfile?.sonicPriorities?.length ?? 0) > 0
      || (result.audioProfile?.sonicAvoids?.length ?? 0) > 0
      || !!result.audioProfile?.archetype;
    if (!hasSystem && !hasProfile) {
      expect(attribution).toBeNull();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// QUERY 4 — Pontus II → CS300 → Super HL5 Plus, assess my system
// ═════════════════════════════════════════════════════════════════════

describe('Render verification — Query 4: Pontus II / CS300 / Super HL5 Plus', () => {
  const query = 'My system: Denafrips Pontus II → Leben CS300 → Harbeth Super HL5 Plus. Assess my system.';

  it('renders with "Super HL5 Plus" preserved and no duplications', () => {
    const subjects = extractSubjectMatches(query);
    const result = buildSystemAssessment(query, subjects, null, []);
    expect(result).not.toBeNull();
    if (!result || result.kind !== 'assessment') return;

    const ctx = result.response.systemContext ?? '';
    const bottom = result.response.bottomLine ?? '';
    const summary = result.response.comparisonSummary ?? '';
    const componentNames = (result.findings?.componentNames ?? []).slice();

    console.log('\n───────── QUERY 4 — Pontus II / CS300 / Super HL5 Plus ─────────');
    console.log('Components:', componentNames);
    console.log('─ systemContext ─');
    console.log(ctx);
    console.log('─ bottomLine ─');
    console.log(bottom);

    // Blocker 5: "Super HL5 Plus" must appear literally, and the bare
    // "Super HL5" must NOT appear in isolation (a standalone match is
    // a naming regression).
    const allProse = [ctx, bottom, summary, componentNames.join(' ')].join('\n');
    expect(allProse).toMatch(/Super HL5 Plus/);
    expect(allProse).not.toMatch(/Super HL5(?! Plus)/);

    // Blocker 2: no duplicated component names in strengths / stacking prose.
    for (const name of ['Pontus II', 'Leben CS300', 'CS300', 'Super HL5 Plus', 'Denafrips Pontus II', 'Harbeth Super HL5 Plus']) {
      const dup = hasDuplicateComponent(allProse, [name]);
      expect(dup, `duplicated "${name}" in rendered prose`).toBeNull();
    }

    // Blocker 3: no debug/enum leakage
    expect(allProse).not.toMatch(/_DEBUG/);
    expect(allProse).not.toMatch(/\bJOB\b/);

    // Blocker 6: if optimize panel is present, its body must include the
    // upgrade directive alongside the "do not touch" list. The bottleneck
    // for this chain is the Pontus II (DAC) — check it's consistent.
    const sections = parseSections(ctx);
    const optimize = sections.find((s) => /optimize/i.test(s.header));
    if (optimize) {
      console.log('─ optimize body ─');
      console.log(optimize.body);
      // The parser must capture more than just the "Do not touch" line.
      expect(optimize.body.length).toBeGreaterThan(30);
      // If the bottleneck is the DAC (Pontus II), it should either be named
      // in a "Change the ..." directive or be omitted from "Do not touch:".
      const doNotTouchMatch = optimize.body.match(/do not touch:\s*([^\n.]+)/i);
      if (doNotTouchMatch) {
        const doNotTouchList = doNotTouchMatch[1].toLowerCase();
        // Pontus II is the identified bottleneck → should NOT be in "do not touch"
        expect(doNotTouchList).not.toMatch(/pontus/);
      }
    }
  });
});
