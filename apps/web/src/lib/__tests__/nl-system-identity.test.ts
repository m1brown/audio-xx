/**
 * Natural-language system identity — P1 incident pins (2026-09-11).
 *
 * A real acquisition user entered:
 *
 *   "assess my system: NAD AV716 Reciever. TOPPING D70 Pro OCTO DAC.
 *    Dynaco A35 Speakers"
 *
 * and production represented their system as a phantom "Topping A3"
 * (speaker) — the curated name "a3" matched INSIDE "A35", took the nearest
 * brand token from another list item, and resolved to the Magico A3's
 * catalog axes — plus the entire remaining input as one malformed
 * component. The corrupted graph then received a confident system-character
 * thesis.
 *
 * The invariant these pins protect:
 *
 *   ORDINARY NATURAL-LANGUAGE SYSTEM DESCRIPTIONS MUST NOT SILENTLY
 *   MERGE, DROP, MANUFACTURE, OR MUTATE COMPONENT IDENTITIES.
 *   WHEN CONFIDENCE IS INSUFFICIENT: PRESERVE OR ASK. NEVER INVENT.
 *
 * And downstream: IDENTITY CONFIDENCE PRECEDES SYSTEM CONCLUSION LICENCE —
 * a chain containing an unestablished component licenses no system-character
 * signature.
 */
import { describe, it, expect } from 'vitest';
import { extractSubjectMatches } from '../intent';
import { detectSystemDescription } from '../system-extraction';
import { buildTurnContext } from '../turn-context';
import { buildSystemAssessment } from '../consultation';
import type { AudioSessionState } from '../system-types';

const GUEST = {
  activeSystemRef: { kind: 'none' },
  savedSystems: [],
  draftSystem: null,
  loading: false,
  proposedSystem: null,
} as unknown as AudioSessionState;

function parse(msg: string) {
  return detectSystemDescription(msg, extractSubjectMatches(msg), GUEST);
}
function ids(msg: string): string[] {
  const p = parse(msg);
  return (p?.components ?? []).map((c) => `${c.brand} ${c.name}`.trim().toLowerCase());
}

const SPECIMEN = 'assess my system: NAD AV716 Reciever. TOPPING D70 Pro OCTO DAC. Dynaco A35 Speakers';

describe('1 — the real-user specimen', () => {
  const p = parse(SPECIMEN);
  const components = p?.components ?? [];

  it('reads exactly three components', () => {
    expect(components).toHaveLength(3);
  });

  it('preserves each identity with its own brand and role', () => {
    const byName = Object.fromEntries(
      components.map((c) => [`${c.brand} ${c.name}`.trim().toLowerCase(), c]),
    );
    expect(byName['nad av716']?.category).toBe('integrated');
    expect(byName['topping d70 pro octo']?.category).toBe('dac');
    expect(byName['dynaco a35']?.category).toBe('speaker');
  });

  it('manufactures no phantom — "Topping A3" does not exist here', () => {
    for (const c of components) {
      expect(`${c.brand} ${c.name}`.toLowerCase()).not.toMatch(/topping a3\b/);
    }
  });

  it('swallows no multi-item blob', () => {
    for (const c of components) {
      expect(c.name).not.toMatch(/\.\s/);
      expect(c.name.length).toBeLessThan(40);
    }
  });
});

describe('2 — separator and phrasing robustness (identity preservation)', () => {
  const CASES: Array<[string, string[]]> = [
    ['assess my system: NAD AV716 receiver, Topping D70 Pro OCTO DAC, Dynaco A35 speakers',
      ['nad av716', 'topping d70 pro octo', 'dynaco a35']],
    ['assess my system: NAD AV716 / D70 Pro Octo / Dynaco A35',
      ['nad av716', 'd70 pro octo', 'dynaco a35']],
    ['assess my system: NAD AV716. Topping D70 Pro OCTO. Dynaco A35.',
      ['nad av716', 'topping d70 pro octo', 'dynaco a35']],
    ['assess my system: receiver is NAD AV716, DAC is Topping D70 Pro OCTO, speakers are Dynaco A35',
      ['nad av716', 'topping d70 pro octo', 'dynaco a35']],
    ['assess my system: nad av716 + topping d70 pro octo + dynaco a35',
      ['nad av716', 'topping d70 pro octo', 'dynaco a35']],
    ['My receiver is an NAD AV716. I use a Topping D70 Pro OCTO DAC and Dynaco A35 speakers.',
      ['nad av716', 'topping d70 pro octo', 'dynaco a35']],
  ];

  for (const [msg, expected] of CASES) {
    it(`preserves all identities: "${msg.slice(0, 60)}…"`, () => {
      const got = ids(msg);
      expect(got).toHaveLength(expected.length);
      for (const e of expected) {
        expect(got, `missing "${e}"`).toContain(e);
      }
    });
  }
});

describe('3 — generalization to unrelated systems', () => {
  it('catalog-perfect France-class entry is untouched', () => {
    const got = ids('Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, Boenicke W5');
    expect(got).toHaveLength(4);
    expect(got).toContain('eversolo dmp-a6');
    expect(got).toContain('chord hugo');
    expect(got).toContain('boenicke w5');
  });

  it('uncatalogued high-end components are preserved, never dropped (Nathan class)', () => {
    const got = ids('Assess my system: dCS Rossini Apex, ARC Reference 5, Butler MONAD A100, Acora QRC-2');
    expect(got).toHaveLength(4);
    expect(got).toContain('dcs rossini apex');
    expect(got).toContain('arc reference 5');
    expect(got).toContain('butler monad a100');
    expect(got).toContain('acora qrc-2');
  });

  it('semicolon list with subwoofer and variant designations survives whole', () => {
    const got = ids('Assess my system: Bluesound Node; NAD C316BEE V2; Wharfedale Linton 85; SVS SB-1000 Pro subwoofer');
    expect(got).toHaveLength(4);
    expect(got.join(' | ')).toMatch(/c316bee v2/);
    expect(got.join(' | ')).toMatch(/linton 85/);
    expect(got.join(' | ')).toMatch(/svs sb-1000 pro/);
  });

  it('the listener\'s exact designation outlives a shorter curated name (WiiM Pro Plus)', () => {
    const got = ids('assess my system: WiiM Pro Plus, Yamaha A-S501, Klipsch RP-600M II');
    expect(got).toHaveLength(3);
    expect(got.join(' | ')).toMatch(/wiim pro plus/);
  });

  it('wholly unknown brands with role words are preserved unresolved', () => {
    const got = ids('assess my system: Zorblax Q900 streamer, Framistat 22B amp, Unobtainium Nine speakers');
    expect(got).toEqual(expect.arrayContaining(['zorblax q900', 'framistat 22b', 'unobtainium nine']));
    expect(got).toHaveLength(3);
  });
});

describe('4 — the matcher cannot begin or end inside a digit run', () => {
  it('"a3" no longer matches inside "A35"', () => {
    const names = extractSubjectMatches('dynaco a35 speakers and a nad amp').map((m) => m.name);
    expect(names).not.toContain('a3');
  });

  it('a letter/digit edge still matches ("hugo2" finds the Hugo)', () => {
    const names = extractSubjectMatches('my chord hugo2 dac').map((m) => m.name);
    expect(names.some((n) => n.includes('hugo'))).toBe(true);
  });
});

describe('5a — power-scoped restraint requires a power finding', () => {
  const COMPONENTS = [
    { displayName: 'Topping D70 Pro OCTO', role: 'dac' },
    { displayName: 'Nad AV716', role: 'integrated' },
    { displayName: 'Dynaco A35', role: 'speaker' },
  ];

  it('a guard verdict in driveFinding licenses no amplifier-power advice', async () => {
    const { composeSystemReviewDetailed } = await import('../artifact/system-review');
    const d = composeSystemReviewDetailed({
      components: COMPONENTS,
      dossiers: [],
      driveFinding: 'No system-level interaction is established on the evidence held.',
    });
    const all = d.paragraphs.join('\n');
    expect(all).not.toMatch(/based on amplifier power/);
    expect(all).not.toMatch(/enough to settle the power question/);
  });

  it('an actual power finding still licenses the scoped restraint', async () => {
    const { composeSystemReviewDetailed } = await import('../artifact/system-review');
    const d = composeSystemReviewDetailed({
      components: COMPONENTS,
      dossiers: [],
      driveFinding: 'On the published figures, amplifier power is unlikely to be the constraint here.',
    });
    expect(d.paragraphs.join('\n')).toMatch(/I wouldn't make a change based on amplifier power\./);
  });
});

describe('5 — identity confidence precedes system conclusion licence', () => {
  it('an unestablished chain member silences the system-character signature', () => {
    const M = 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus, Zorblax Z9 streamer';
    const tc = buildTurnContext(M, GUEST, new Set(), undefined);
    const r = buildSystemAssessment(M, tc.subjectMatches, tc.activeSystem, []) as {
      kind?: string; response?: { systemSignature?: string };
    };
    expect(r?.response?.systemSignature ?? undefined).toBeUndefined();
  }, 30000);

  it('a fully resolved chain keeps its signature (guard does not overfire)', () => {
    const M = 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus';
    const tc = buildTurnContext(M, GUEST, new Set(), undefined);
    const r = buildSystemAssessment(M, tc.subjectMatches, tc.activeSystem, []) as {
      kind?: string; response?: { systemSignature?: string };
    };
    expect(r?.kind).toBe('assessment');
    expect(typeof r?.response?.systemSignature).toBe('string');
    expect((r?.response?.systemSignature ?? '').length).toBeGreaterThan(0);
  }, 30000);
});
