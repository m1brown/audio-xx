/**
 * Turn-0 governed assessment — adversarial fixtures + acceptance run.
 *
 *   QA_TURN0=1 OPENAI_API_KEY=… npx vitest run \
 *     apps/web/src/qa/golden/__run__/turn0-assessment.test.ts
 *
 * Exercises the REAL route handler (mode:'assessment') end-to-end: turn-0
 * input contract (identity status + topology sections), B2 rules +
 * assessment composition contract, validator, deterministic trust gate.
 * Local runs are lane-eligible by design (no VERCEL_ENV, no cohort).
 *
 * Five systems cover the §9 matrix: principal (Nathan with unresolved
 * "ARC ref"), strong licensed judgment (France II), sparse evidence
 * (Peachtree holdout), genuinely concerning interface (Decware SET into
 * Magnepan LRS+), compatibility-without-synergy (Accuphase/Harbeth).
 *
 * Deterministic adversarial assertions per output:
 *  - none of the banned Grok-style verdicts;
 *  - the unresolved "ARC ref" is never assigned a model or the REF 330M
 *    complement, and the Butler is never given a valve output stage;
 *  - the power-constrained pairing is not granted comfortable headroom;
 *  - the composition contract's shape (≤ 8 paragraphs, no headings).
 * Telemetry (latency, tokens, status) is written for the §7 measurements.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/reasoning-lane/route';

const RUN = process.env.QA_TURN0 === '1';
const OUT_DIR = join(__dirname, '..', 'results', `turn0-${new Date().toISOString().slice(0, 10)}`);

const BANNED = [
  /\boptimi[sz]ed\b/i, /\bwell[- ]matched\b/i, /\bperfectly\b/i,
  /\bno (?:listening )?fatigue\b/i, /\bnon-fatiguing\b/i, /\bfatigue-free\b/i,
  /\bwon.t fatigue\b/i, /\bbalanced and linear\b/i, /\blong-term keeper\b/i,
  // Affirmative guarantees only — "does not guarantee synergy" is the
  // discipline itself and must stay permitted.
  /\b(?:is|are) guaranteed\b|\bguaranteed to\b|\bI guarantee\b/i,
  // RESTRAINT RUNG (consolidation, 2026-09-20): at turn 0, absence of a
  // demonstrated problem licenses "no evidence a change is necessary" —
  // never an affirmative keep-everything / change-nothing recommendation.
  // ("I wouldn't change anything based on <licence>" is scoped and allowed;
  // these forms are the unscoped verdicts.)
  /\bchange nothing\b/i,
  /\bkeep (?:the )?(?:hardware|system|everything) (?:in place|as it is|unchanged|alone)\b/i,
  /\brecommendation is (?:therefore )?to keep\b/i,
];

interface Fixture {
  id: string;
  components: Array<{ displayName: string; role: string }>;
  query: string;
  /** Output must NOT match any of these. */
  forbid?: RegExp[];
  /** Output must match all of these (kept loose — behavior, not wording). */
  want?: RegExp[];
}

const FIXTURES: Fixture[] = [
  {
    id: 'nathan-arc-ref',
    components: [
      { displayName: 'dCS Rossini Apex', role: 'dac' },
      { displayName: 'ARC ref', role: 'preamplifier' },
      { displayName: 'Butler Monads', role: 'amplifier' },
      { displayName: 'Acora QRC-2', role: 'speaker' },
    ],
    query: 'Assess my system: dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2.',
    forbid: [
      /Reference 330M|REF ?330/i,
      /KT170/,
      /valve output stage(?!.*not)/i,
      // The unresolved preamp must not be silently resolved to a model.
      /your (?:ARC )?Reference 5\b/i,
      /unlikely to be this system.s limitation/i,
    ],
  },
  {
    id: 'france-ii',
    components: [
      { displayName: 'Eversolo DMP-A6', role: 'streamer' },
      { displayName: 'Chord Hugo', role: 'dac' },
      { displayName: 'JOB INTegrated', role: 'amplifier' },
      { displayName: 'WLM Diva Monitor', role: 'speaker' },
    ],
    query: 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB INTegrated, WLM Diva Monitor.',
  },
  {
    id: 'sparse-peachtree',
    components: [
      { displayName: 'Peachtree Nova 300', role: 'amplifier' },
      { displayName: 'Totem Arro', role: 'speaker' },
      { displayName: 'iFi Zen Stream', role: 'streamer' },
    ],
    query: 'What do you think of my setup? Peachtree Nova 300, Totem Arro floorstanders, iFi Zen Stream.',
  },
  {
    id: 'concerning-decware-lrs',
    components: [
      { displayName: 'Decware SE84UFO', role: 'amplifier' },
      { displayName: 'Magnepan LRS+', role: 'speaker' },
    ],
    query: 'Assess my system: Decware SE84UFO amplifier driving Magnepan LRS+ speakers.',
    forbid: [/headroom to spare/i, /power is not a concern/i],
    want: [/\b(?:power|watt|level|drive|demanding)\b/i],
  },
  {
    id: 'compat-not-synergy-accuphase',
    components: [
      { displayName: 'Accuphase E-600', role: 'amplifier' },
      { displayName: 'Accuphase DP-450', role: 'cd player' },
      { displayName: 'Harbeth SHL5 Plus', role: 'speaker' },
    ],
    query: 'Assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus.',
    forbid: [/synerg(?:y|istic)(?!.*not)/i],
  },
];

async function callAssessment(f: Fixture) {
  const req = new NextRequest('http://localhost/api/reasoning-lane', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'assessment',
      activeSystem: { components: f.components, source: 'stated' },
      currentHypothetical: null,
      question: f.query,
      recentTurns: [],
      userObservations: [],
    }),
  });
  const t0 = Date.now();
  const res = await POST(req);
  const j = await res.json();
  return { j, ms: Date.now() - t0, http: res.status };
}

describe.runIf(RUN)('turn-0 governed assessment — adversarial fixtures', () => {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const f of FIXTURES) {
    it.concurrent(`turn0 · ${f.id}`, async () => {
      const { j, ms, http } = await callAssessment(f);
      appendFileSync(join(OUT_DIR, 'runs.jsonl'), `${JSON.stringify({ id: f.id, http, ms, ...j })}\n`);
      expect(http).toBe(200);
      expect(['CHECKED', 'REPAIRED']).toContain(j.status);
      const answer: string = j.answer ?? '';
      expect(answer.length).toBeGreaterThan(200);

      // Composition shape: short, synthetic, no headings/markdown.
      const paras = answer.split(/\n{2,}/).filter((p: string) => p.trim());
      expect(paras.length, 'paragraph budget').toBeLessThanOrEqual(8);
      expect(answer).not.toMatch(/^#+\s/m);

      for (const re of BANNED) expect(answer, `banned: ${re}`).not.toMatch(re);
      for (const re of f.forbid ?? []) expect(answer, `forbidden: ${re}`).not.toMatch(re);
      for (const re of f.want ?? []) expect(answer, `expected: ${re}`).toMatch(re);
    }, 300000);
  }
});

describe.runIf(!RUN)('turn-0 assessment fixtures (gated off)', () => {
  it('set QA_TURN0=1 to run', () => { expect(true).toBe(true); });
});
