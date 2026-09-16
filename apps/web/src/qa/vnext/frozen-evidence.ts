/**
 * vNext Phase 0 — frozen evidence snapshot.
 *
 * The bake-off compares REASONING, so retrieval variance must be zero: every
 * arm-B turn assembles its substrate over exactly this evidence, seeded into
 * the fact store's in-process tier at run start (no database writes, no
 * persistence side effects). In-repo authored facts (relationship-facts.ts)
 * and catalog records flow through the lane's own retrieval unchanged; this
 * module adds only the maker facts that live in the production store and are
 * therefore not visible to a local run. Values are the makers' published
 * figures, recorded with their source domains.
 *
 * SNAPSHOT DISCIPLINE: this file IS the snapshot. Any change to it is a new
 * snapshot id, and results across ids are not comparable.
 */
import { writeFacts } from '@/lib/evidence/manufacturer-fact-store';
import type { EvidenceItem } from '@/lib/evidence/evidence-types';

export const FROZEN_SNAPSHOT_ID = 'phase0-2026-09-15';

interface FrozenFact {
  productKey: string;
  field: string;
  value: string;
  sourceUrl: string;
  quotedText: string;
}

const FROZEN_FACTS: FrozenFact[] = [
  // ── Accuphase E-600 (production-store facts, maker page) ─────────────
  {
    productKey: 'accuphase e-600', field: 'power output',
    value: '30 W/ch (8 ohms), 60 W/ch (4 ohms), 120 W/ch (2 ohms), 150 W/ch (1 ohm, music signals)',
    sourceUrl: 'https://www.accuphase.com/model/e-600.html',
    quotedText: 'Continuous Average Output Power: 30 W/ch into 8 ohms, 60 W/ch into 4 ohms, 120 W/ch into 2 ohms, 150 W/ch into 1 ohm (music signals)',
  },
  {
    productKey: 'accuphase e-600', field: 'amplification class',
    value: 'Class A operation',
    sourceUrl: 'https://www.accuphase.com/model/e-600.html',
    quotedText: 'pure Class A operation',
  },
  // ── Harbeth SHL5 Plus (production-store facts, maker page) ───────────
  {
    productKey: 'harbeth shl5 plus', field: 'sensitivity',
    value: '86dB/2.83V/1m axial',
    sourceUrl: 'https://harbeth.co.uk/',
    quotedText: 'Sensitivity: 86dB/2.83V/1m',
  },
  {
    productKey: 'harbeth shl5 plus', field: 'nominal impedance',
    value: '6 ohms',
    sourceUrl: 'https://harbeth.co.uk/',
    quotedText: 'Impedance: 6 ohms — easy to drive',
  },
  {
    productKey: 'harbeth shl5 plus', field: 'maker load characterization',
    value: 'described by the maker as easy to drive',
    sourceUrl: 'https://harbeth.co.uk/',
    quotedText: 'easy to drive',
  },
  // ── Decware SE84UFO (maker page) ─────────────────────────────────────
  {
    productKey: 'decware se84ufo', field: 'power output',
    value: '2.3 watts per channel, single-ended triode',
    sourceUrl: 'https://www.decware.com/newsite/SE84UFO.html',
    quotedText: '2.3 watts per channel',
  },
  // ── Magnepan LRS+ (maker page) ───────────────────────────────────────
  {
    productKey: 'magnepan lrs+', field: 'sensitivity',
    value: '86dB / 500Hz / 2.83V',
    sourceUrl: 'https://www.magnepan.com/',
    quotedText: 'Sensitivity: 86dB/500Hz/2.83V',
  },
  {
    productKey: 'magnepan lrs+', field: 'nominal impedance',
    value: '4 ohms',
    sourceUrl: 'https://www.magnepan.com/',
    quotedText: 'Impedance: 4 Ohm',
  },
];

/** Seed the in-process fact tier. Idempotent; no database writes occur. */
export async function seedFrozenEvidence(now = Date.now()): Promise<void> {
  const byKey = new Map<string, FrozenFact[]>();
  for (const f of FROZEN_FACTS) {
    byKey.set(f.productKey, [...(byKey.get(f.productKey) ?? []), f]);
  }
  for (const [productKey, facts] of byKey) {
    const items = facts.map((f): EvidenceItem => ({
      productKey,
      evidenceClass: 'manufacturer',
      tier: 'manufacturer',
      scope: 'product',
      field: f.field,
      value: f.value,
      attribution: { sourceUrl: f.sourceUrl, quotedText: f.quotedText },
      retrievedAt: now,
    } as EvidenceItem));
    await writeFacts(items);
  }
}

// ── Experiment systems ─────────────────────────────────────────────────

export interface ExperimentSystem {
  id: string;
  holdout?: boolean;
  components: Array<{ displayName: string; role: string }>;
  /** How the listener states it on turn 1. */
  statement: string;
}

export const EXPERIMENT_SYSTEMS: ExperimentSystem[] = [
  {
    id: 'accuphase',
    components: [
      { displayName: 'Accuphase E-600', role: 'amplifier' },
      { displayName: 'Accuphase DP-450', role: 'cd player' },
      { displayName: 'Harbeth SHL5 Plus', role: 'speaker' },
    ],
    statement: 'Assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus.',
  },
  {
    id: 'nad',
    components: [
      { displayName: 'NAD AV716', role: 'receiver' },
      { displayName: 'Topping D70 Pro OCTO', role: 'dac' },
      { displayName: 'Dynaco A35', role: 'speaker' },
    ],
    statement: 'Assess my system: NAD AV716 receiver, Topping D70 Pro OCTO DAC, Dynaco A35 speakers.',
  },
  {
    id: 'job-boenicke',
    components: [
      { displayName: 'JOB INTegrated', role: 'amplifier' },
      { displayName: 'Boenicke W5', role: 'speaker' },
    ],
    statement: 'Assess my system: JOB INTegrated amplifier and Boenicke W5 speakers.',
  },
  {
    id: 'decware-magnepan',
    components: [
      { displayName: 'Decware SE84UFO', role: 'amplifier' },
      { displayName: 'Magnepan LRS+', role: 'speaker' },
    ],
    statement: 'Assess my system: Decware SE84UFO amplifier driving Magnepan LRS+ speakers.',
  },
  {
    id: 'nathan',
    components: [
      { displayName: 'dCS Rossini Apex', role: 'dac' },
      { displayName: 'ARC Reference 5', role: 'preamplifier' },
      { displayName: 'Butler Monads', role: 'amplifier' },
      { displayName: 'Acora QRC-2', role: 'speaker' },
    ],
    statement: 'Assess my system: dCS Rossini Apex, Audio Research Reference 5, Butler Monad monoblocks, Acora QRC-2.',
  },
  // ── Holdout: systems Audio XX has never been engineered around ───────
  {
    id: 'holdout-luxman',
    holdout: true,
    components: [
      { displayName: 'Luxman L-505Z', role: 'amplifier' },
      { displayName: 'Dynaudio Evoke 20', role: 'speaker' },
      { displayName: 'Bluesound Node', role: 'streamer' },
    ],
    statement: 'Assess my system: Luxman L-505Z, Dynaudio Evoke 20 and a Bluesound Node.',
  },
  {
    id: 'holdout-peachtree',
    holdout: true,
    components: [
      { displayName: 'Peachtree Nova 300', role: 'amplifier' },
      { displayName: 'Totem Arro', role: 'speaker' },
      { displayName: 'iFi Zen Stream', role: 'streamer' },
    ],
    statement: 'What do you think of my setup? Peachtree Nova 300, Totem Arro floorstanders, iFi Zen Stream.',
  },
  /*
   * CANDIDATE-SOLICITATION shape (M1 quality correction, 2026-09-16).
   * The Phase-0.1 corpus never asked the adviser to NAME candidate
   * products, so the validator's B1-era stripping of hedged bounded-
   * knowledge recommendations stayed invisible until a real founder
   * session hit it. Same frozen Accuphase evidence, different
   * conversation shape — see CONVERSATIONS['accuphase-candidates'].
   */
  {
    id: 'accuphase-candidates',
    components: [
      { displayName: 'Accuphase E-600', role: 'amplifier' },
      { displayName: 'Accuphase DP-450', role: 'cd player' },
      { displayName: 'Harbeth SHL5 Plus', role: 'speaker' },
    ],
    statement: 'Assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus.',
  },
];
