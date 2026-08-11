import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { buildSystemDiagnosis } from '../consultation';

/**
 * D7 (production hardening, 2026-08-11) — the restraint case must never
 * be answered with an invented complaint about mis-resolved components.
 *
 * Live repro (clean context, deterministic):
 *   "my system: denafrips pontus ii, leben cs600x, devore o/96.
 *    anything need changing?"
 *   → 'With Pontus Ii + CS300 + O/96 + Denafrips + DeVore, what you're
 *      hearing as "thin" is lacking bass weight…'
 *
 * Three defects in one output, on the founder-protected restraint case:
 *   1. INVENTED SYMPTOM: extractComplaint used substring matching, so
 *      'thin' matched inside "anyTHINg". Same class: 'lean' in
 *      "cleaner", 'hard' in "hardware", 'dry' in "laundry".
 *   2. SIBLING SUBSTITUTION: the component echo resolved "leben cs600x"
 *      via a brand-prefix product grab — the first Leben product in
 *      catalog order (CS300) replaced the stated CS600X; "pontus ii"
 *      failed exact-name matching entirely and its brand re-appeared as
 *      a phantom extra component.
 *   3. ROUTING: "anything need changing?" (without "does") missed
 *      SYSTEM_JUDGMENT_PATTERNS, so the turn never reached the
 *      assessment lane where restraint ("nothing needs changing") lives.
 */

const G1 = 'my system: denafrips pontus ii, leben cs600x, devore o/96. anything need changing?';

describe('no invented complaints (substring guard)', () => {
  it('"anything need changing?" produces NO diagnosis — no complaint exists', () => {
    const { subjectMatches } = detectIntent(G1);
    expect(buildSystemDiagnosis(G1, subjectMatches)).toBeNull();
  });

  const INNOCENT = [
    'my system: pontus ii, cs600x. anything else worth knowing?',
    'these need a cleaner rack layout, pontus ii + cs600x',
    'is new hardware needed? pontus ii + cs600x',
  ];
  for (const text of INNOCENT) {
    it(`"${text.slice(0, 44)}…" invents no complaint`, () => {
      const { subjectMatches } = detectIntent(text);
      const d = buildSystemDiagnosis(text, subjectMatches) as { prose?: string; philosophy?: string } | null;
      const rendered = JSON.stringify(d ?? '');
      expect(rendered).not.toMatch(/hearing as/);
    });
  }

  it('control: a real complaint still diagnoses', () => {
    const text = 'my system: denafrips pontus ii, leben cs600x, devore o/96. it sounds thin';
    const { subjectMatches } = detectIntent(text);
    const d = buildSystemDiagnosis(text, subjectMatches);
    expect(d).not.toBeNull();
  });
});

describe('component echo resolves the stated model, never a sibling', () => {
  it('CS600X stays CS600X in the diagnosis echo', () => {
    const text = 'my system: denafrips pontus ii, leben cs600x, devore o/96. it sounds thin';
    const { subjectMatches } = detectIntent(text);
    const d = buildSystemDiagnosis(text, subjectMatches);
    const rendered = JSON.stringify(d);
    expect(rendered).toContain('CS600X');
    expect(rendered).not.toContain('CS300');
    // Brands of resolved products must not re-appear as extra components.
    expect(rendered).not.toMatch(/\+ Denafrips\b/);
  });
});

describe('elliptical judgment phrasing routes to assessment', () => {
  it('"anything need changing?" with components is a system assessment', () => {
    expect(detectIntent(G1).intent).toBe('system_assessment');
  });

  it('bare "anything need changing?" without components stays out of assessment', () => {
    expect(detectIntent('anything need changing?').intent).not.toBe('system_assessment');
  });
});
