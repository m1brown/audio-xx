import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { authoritativeAssessment } from '../from-result';
import { snapshotFromProvisional } from '@/lib/artifact/snapshot';
import { extractSubjectMatches, detectIntent } from '@/lib/intent';
import { buildSystemAssessment } from '@/lib/consultation';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

/**
 * ONE ASSESSMENT, MANY SURFACES.
 *
 * Audio XX had two lanes that could each author user-visible claims, and the
 * one production showed was the unlicensed one. These are the six reference
 * controls the convergence has to satisfy simultaneously — each pins a
 * DIFFERENT correct outcome, because a gate that produces the same restrained
 * output everywhere has not converged the lanes, it has silenced one.
 */

const assess = (text: string, dossiers?: DossierView[]) => {
  const { desires } = detectIntent(text) as never as { desires: unknown };
  const raw = buildSystemAssessment(text, extractSubjectMatches(text), null, desires as never);
  return authoritativeAssessment(raw, { dossiers, createdAt: '2026-08-25T00:00:00.000Z' });
};

const prose = (s: { verdict?: string; standfirst?: string; recognition?: string;
  recommendation?: string; cost?: string; operatingCondition?: string;
  sections?: Array<{ paragraphs: string[] }>; systemReview?: string[] } | null) => [
  s?.verdict, s?.standfirst, s?.recognition, s?.recommendation, s?.cost,
  s?.operatingCondition,
  ...(s?.sections ?? []).flatMap((x) => x.paragraphs),
  ...(s?.systemReview ?? []),
].filter(Boolean).join('\n');

const d = (
  displayName: string, role: string,
  primary: Array<{ label: string; value: string }>,
  gaps: string[] = [],
): DossierView => ({
  displayName, role,
  primary: primary.map((l) => ({ ...l, sourceClass: 'maker_published' as const })),
  secondary: [], gaps, hasDetail: true,
} as never);

// ── CONTROL 1 — Leben/Cornwall: the failure that forced this ─────────
describe('LEBEN / CORNWALL — held evidence cannot support the old essay', () => {
  const s = assess('Assess my system: Amp: Leben CS600X Speakers: Klipsch Cornwall IV');

  it('publishes no unlicensed no-change verdict', () => {
    /*
     * The engine DOES establish something here: catalog power and sensitivity
     * figures give a power-match finding, and that is a legitimate evidence
     * class. What it does not give is a whole-system verdict.
     *
     * So the licensed outcome is the deliberately narrow one — a compatibility
     * finding reported as a compatibility finding — rather than "Nothing here
     * needs changing", which claims the system was examined and found sound.
     */
    expect(s!.verdict).toMatch(/establishes one compatibility finding/i);
    expect(s!.verdict).not.toMatch(/nothing here (obviously )?needs changing/i);
  });

  it('publishes no listening prediction', () => {
    // The exact sentences production served on 24 August 2026, while Audio XX
    // held ZERO manufacturer facts for the Leben.
    for (const canned of [
      /leading edges are clean and quick/i,
      /image extends wide without being pushed forward/i,
      /put on something with (air|body)/i,
      /over a long evening the character holds/i,
      /resolves cleanly/i,
      /keeps the result musical rather than analytical/i,
    ]) expect(prose(s), String(canned)).not.toMatch(canned);
  });

  it('publishes no axis-derived system character', () => {
    expect(s!.tonalSignature).toBeUndefined();
    expect(s!.recognition).toBeUndefined();
    expect(s!.recommendation).toBeUndefined();
  });
});

// ── CONTROL 2 — the licensed problem must still be stated ───────────
describe('FLAWED REFERENCE — a licensed problem is stated plainly', () => {
  // The product's own `flawed` preset, so this control tests the system a
  // reader can actually reach at /artifact?case=flawed.
  const s = assess('Assess my system: Holo May (KTE), Decware SE84UFO, Magnepan LRS+');

  it('does not fall silent on a diagnosed constraint', () => {
    // Restraint is refusing a claim the evidence does not support. Refusing a
    // claim it DOES support is a different failure wearing restraint's clothes.
    expect(s!.verdict).not.toMatch(/No system-level interaction is established/i);
    expect(prose(s)).toMatch(/drive|power|constraint|mismatch/i);
  });
});

// ── CONTROL 3 — Magnepan: constraint-bounded guidance survives ───────
describe('MAGNEPAN — a constraint licenses the guidance bounded by it', () => {
  const s = assess('Assess my system: Amp: Zorblax ZX1 5 watt SET Speakers: Magnepan LRS+');

  it('keeps the constraint verdict the engine established', () => {
    expect(s!.verdict).toMatch(/drive|power/i);
  });

  it('still publishes no tonal signature', () => {
    // A power constraint licenses guidance about power. It licenses nothing
    // about tonal character, so the graph goes regardless of the verdict.
    expect(s!.tonalSignature).toBeUndefined();
  });
});

// ── CONTROL 4 — Nathan: the rich causal review is preserved ──────────
describe('NATHAN — the Butler/Acora causal review survives intact', () => {
  // Nathan's components are UNCATALOGUED, so production takes the provisional
  // path. Testing him through the catalog path would test a journey no
  // listener with this system ever makes.
  const dossiers = [
    d('Butler Monads', 'amplifier', [{
      label: 'power output',
      value: 'Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms',
    }]),
    d('Acora QRC-2', 'speaker', [
      { label: 'impedance', value: '4 ohm' },
      { label: 'power handling', value: '10 W – 250 W' },
    ], ['the published sensitivity figure']),
  ];

  const s = snapshotFromProvisional({
    subject: 'Butler Monads, Acora QRC-2',
    systemSignature: 'Published figures put the Butler Monads at 200 watts into 4 ohms.',
    philosophy: 'Audio XX does not hold product-specific listening evidence for this chain.',
    actionVerdict: 'no_change',
    systemRelations: [{
      components: ['Butler Monads', 'Acora QRC-2'],
      axis: 'power_load', kind: 'reinforcement', tier: 'manufacturer',
    }],
  } as never, {
    engineVersion: 'test', createdAt: '2026-08-25T00:00:00.000Z',
    components: [
      { name: 'Butler Monads', role: 'amplifier' },
      { name: 'Acora QRC-2', role: 'speaker' },
    ],
    componentDossiers: dossiers,
  } as never);

  it('keeps the like-for-like scaling conclusion', () => {
    const text = prose(s);
    expect(text).toMatch(/128 watts into 8 ohms becomes 200 into 4/);
    expect(text).toMatch(/about 1\.6×/);
  });

  it('keeps the published-limits finding', () => {
    expect(prose(s)).toMatch(/within the limits both makers state/);
  });

  it('keeps its own licensed verdict rather than a generic one', () => {
    expect(s.verdict).toMatch(/200 watts into 4 ohms/);
  });

  it('names the missing figure rather than reporting a vague shortfall', () => {
    // This chain is two boxes, so it poses ONE interface and that interface is
    // partially explained, not unresolved: compatibility is settled and only
    // loudness is open. The reader is still told exactly which figure would
    // close it, which is the property that matters.
    expect(prose(s)).toMatch(/sensitivity/i);
    expect(prose(s)).not.toMatch(/insufficient evidence/i);
  });

  it('still refuses the difficulty claim', () => {
    for (const overclaim of [
      /demand for current rather than for voltage/i,
      /current[- ]hungry/i, /difficult load/i, /easy to drive/i,
    ]) expect(prose(s), String(overclaim)).not.toMatch(overclaim);
  });
});

// ── CONTROL 5 — a system with nothing held ──────────────────────────
describe('LISTENER-ONLY — missing evidence produces bounded uncertainty', () => {
  const s = assess('Assess my system: Amp: Blang 2 Speakers: Frooble X');

  it('either declines to assess or reports what is unestablished', () => {
    // An unrecognised chain may not resolve to an assessment at all, which is
    // itself correct. What must never happen is a confident reading of it.
    if (!s) return;
    expect(s.verdict).toMatch(/No system-level interaction is established/i);
    expect(prose(s)).not.toMatch(/leading edges|resolves cleanly|nothing here needs changing/i);
  });
});

// ── CONTROL 6 — the surfaces cannot diverge again ───────────────────
describe('no surface may author a user-visible assessment of its own', () => {
  const read = (f: string) => readFileSync(f, 'utf8');

  it('every user-visible surface renders the authoritative assessment', () => {
    for (const f of [
      'apps/web/src/components/advisory/AdvisoryMessage.tsx',
      'apps/web/src/app/artifact/page.tsx',
      'apps/web/src/app/systems/[id]/assessment/page.tsx',
    ]) expect(read(f), f).toMatch(/SnapshotArtifact/);
  });

  it('the conversation no longer renders the trait payload directly', () => {
    const src = read('apps/web/src/components/advisory/AdvisoryMessage.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/synthesizeArtifact\(/);
    expect(src).not.toMatch(/AssessmentArtifactV2/);
  });

  it('saving stores the licensed snapshot, not the payload', () => {
    const src = read('apps/web/src/product/save-system.ts');
    expect(src).toMatch(/freezeSnapshot\(licensed\)/);
    expect(src).not.toMatch(/JSON\.stringify\(rendered\.payload\)/);
  });

  it('the licence is applied where snapshots are CONSTRUCTED', () => {
    // A gate at the renderer is a gate the next surface forgets to call —
    // which is exactly how the trait lane reached production while the
    // evidence lane sat behind a link nobody surfaced.
    const src = read('apps/web/src/lib/artifact/snapshot.ts');
    expect([...src.matchAll(/return licenseAssessment\(/g)]).toHaveLength(2);
  });

  it('the listening-session generator cannot be reinstated', () => {
    const src = read('apps/web/src/lib/artifact/canonical.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/function composeListeningSession/);
  });
});
