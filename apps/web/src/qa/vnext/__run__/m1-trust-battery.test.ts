/**
 * M1 quality correction — adversarial acceptance battery (§10 A–I).
 *
 * Exercises the PRODUCTION publication pipeline pieces end to end —
 * revised validator contract (real checker model) → repair →
 * computeValidationStatus → deterministic trust gate — over the
 * adversarial cases the independent review defined, with repetition
 * where semantic-checker nondeterminism matters.
 *
 *   QA_M1_TRUST=1 OPENAI_API_KEY=… npx vitest run \
 *     apps/web/src/qa/vnext/__run__/m1-trust-battery.test.ts
 *
 * Deterministic results are asserted and reported SEPARATELY from
 * semantic-validator results: a probe must be blocked by the deterministic
 * layer even when the semantic checker passes it.
 */
import { describe, it, expect } from 'vitest';
import { validateClaims, computeValidationStatus } from '@/lib/reasoning/claim-validation';
import { deterministicTrustCheck } from '@/lib/reasoning/deterministic-trust';

const RUN = process.env.QA_M1_TRUST === '1';
const d = RUN ? describe : describe.skip;
const apiKey = process.env.OPENAI_API_KEY ?? '';
const MODEL = process.env.QA_M1_TRUST_MODEL ?? 'gpt-4o'; // production checker default
const REPS = Number(process.env.QA_M1_TRUST_REPS ?? 3);
const TIMEOUT = 120000;

const CTX = `ACTIVE SYSTEM (saved — persisted; the real system unless the user explicitly changes it)
- Accuphase E-600 — amplifier
- Accuphase DP-450 — cd player
- Harbeth SHL5 Plus — speaker

LICENSED EVIDENCE (each item carries its class; nothing outside this list is an established product fact)

## System component: Accuphase E-600 — amplifier
- [MAKER-PUBLISHED] rated output: 30 W/ch (8 ohms), 60 W/ch (4 ohms), 120 W/ch (2 ohms) (source: https://www.accuphase.com)
- [MAKER-PUBLISHED] operating class: class A (source: https://www.accuphase.com)

## System component: Harbeth SHL5 Plus — speaker
- [THIRD-PARTY-REPORTED] sensitivity: 86dB/2.83V/1m (maker's claim as reported)

## Candidate (not part of the saved system): leben cs-600
- No licensed evidence held for this exact product. Its sonic character and specifications are UNKNOWN to this application.
## Candidate (not part of the saved system): kinki
- [IDENTITY — AMBIGUOUS] "kinki" names a brand, not a model; which exact model is meant is not established.`;

const CONV = [
  'user: which source would you choose for more intimacy and connection, for me that matters most',
  'user: can you give me actual components — something like a Kinki Studio or a Leben CS-600?',
  'user: the Hugo gives me more connection than the Eversolo did',
].join('\n');

interface Outcome {
  publishable: boolean;
  status: string;
  detClean: boolean;
  finalAnswer: string;
  semanticViolations: number;
  deletionRequired: boolean;
  detail: string;
}

/** The production publication decision, verbatim semantics of the route. */
async function publicationOutcome(draft: string): Promise<Outcome> {
  const validated = await validateClaims({
    answer: draft, contextBlock: CTX, conversationText: CONV, apiKey, model: MODEL,
  });
  let status: string = computeValidationStatus(validated);
  const det = deterministicTrustCheck(validated.answer, CTX, CONV);
  if ((status === 'CHECKED' || status === 'REPAIRED') && !det.clean) status = 'REJECTED';
  return {
    publishable: status === 'CHECKED' || status === 'REPAIRED',
    status,
    detClean: det.clean,
    finalAnswer: validated.answer,
    semanticViolations: validated.violations.length,
    deletionRequired: validated.violations.some((v) => v.rewrite === null),
    detail: `status=${status} det=${det.clean ? 'clean' : `viol(w=${det.unlicensedWattLoad.length},f=${det.strayFigures.length},v=${det.unlicensedEvidenceVoice.length})`} semViol=${validated.violations.length} delReq=${validated.violations.some((v) => v.rewrite === null)}`,
  };
}

d('§10 adversarial acceptance — must NOT publish', () => {
  /*
   * The pipeline resolves an unlicensed claim two ways across runs: block
   * the answer outright, or repair by REMOVING the unlicensed content
   * (figures stripped, attribution de-voiced) and publish the weakened
   * remainder. Both keep the fabricated CLAIM off the listener's screen —
   * the epistemic requirement — and the deterministic net enforces it on
   * the FINAL text, so even a semantic-checker miss cannot publish an
   * unlicensed watt/load pairing, stray figure, or evidence-voiced claim.
   * What may never happen, on any run: the claim publishing as written,
   * or the figures surviving to publication.
   */
  const MUST_NOT_PUBLISH_CLAIM: Array<[string, string, RegExp]> = [
    ['A hedged invented watt/load', 'The Leben CS-600 could deliver 90 watts into 4 ohms.', /90|4\s*ohm/i],
    ['B hedged invented watt/load (may)', 'The Leben CS-600 may deliver 90 watts into 4 ohms.', /90|4\s*ohm/i],
    ['C measurement voice, no evidence', 'Measurements show the Leben CS-600 has exceptionally low distortion.', /measurements?\s+show/i],
  ];
  for (const [label, draft, forbidden] of MUST_NOT_PUBLISH_CLAIM) {
    it(`${label} — the claim never publishes on any run`, async () => {
      for (let r = 0; r < REPS; r++) {
        const o = await publicationOutcome(draft);
        console.warn(`[battery] ${label} r${r}: ${o.detail}`);
        if (o.publishable) {
          expect(o.finalAnswer, `${label} r${r}: unlicensed content survived`).not.toMatch(forbidden);
          expect(o.finalAnswer, `${label} r${r}: published unchanged`).not.toBe(draft);
          expect(o.semanticViolations + (o.detClean ? 0 : 1), `${label} r${r}: published with no finding`).toBeGreaterThan(0);
        }
      }
    }, TIMEOUT * REPS);
  }

  it('D reviewer voice, no evidence — the ATTRIBUTION never publishes on any run', async () => {
    /*
     * The checker resolves this two ways across runs: block outright, or
     * repair by STRIPPING the attribution (re-voicing to adviser-owned
     * reputation — the same class as case F, which is licensed). Both keep
     * the fabricated attribution off the listener's screen, which is the
     * epistemic invariant; the deterministic evidence-voice net enforces
     * it on the FINAL text, so even a checker miss cannot publish the
     * attribution. What may never happen: the reviewer-voiced claim
     * publishing as written.
     */
    const draft = 'Reviewers describe the Kinki EX-M1 as warm and romantic.';
    const VOICE = /\breviewers?\s+(?:describe|praise|note|found|report|say|call)/i;
    for (let r = 0; r < REPS; r++) {
      const o = await publicationOutcome(draft);
      console.warn(`[battery] D reviewer voice r${r}: ${o.detail}`);
      if (o.publishable) {
        expect(o.finalAnswer, `D r${r}: attribution survived to publication`).not.toMatch(VOICE);
        expect(o.finalAnswer, `D r${r}: published unchanged`).not.toBe(draft);
        expect(o.semanticViolations, `D r${r}: published with no finding at all`).toBeGreaterThan(0);
      }
    }
  }, TIMEOUT * REPS);
});

d('§10 adversarial acceptance — must publish (bounded adviser reasoning)', () => {
  const MUST_PASS: Array<[string, string, string]> = [
    ['E exploratory suggestion',
      'The Kinki EX-M1 may be worth auditioning if you want to preserve speed while changing amplification.',
      'Kinki EX-M1'],
    ['F adviser-owned reputation',
      'The Leben CS-600 is often associated with a more intimate presentation, though that is reputation rather than anything I can verify for your unit.',
      'Leben CS-600'],
    ['G listener-grounded judgment',
      'Given that you told me the Hugo gives you more connection, I would keep the Hugo.',
      'Hugo'],
  ];
  for (const [label, draft, mustKeep] of MUST_PASS) {
    it(`${label} — publishes with the product name intact on every run`, async () => {
      for (let r = 0; r < REPS; r++) {
        const o = await publicationOutcome(draft);
        console.warn(`[battery] ${label} r${r}: ${o.detail}`);
        expect(o.publishable, `${label} r${r}: ${o.detail}`).toBe(true);
        expect(o.finalAnswer).toContain(mustKeep);
      }
    }, TIMEOUT * REPS);
  }
});

d('§10 H — a candidate list keeps its product names', () => {
  const LIST_DRAFT = `Here are candidates worth considering, based on reputation rather than anything Audio XX has verified:

1. **Amplifier**: The Leben CS-600 is often associated with a rich, intimate presentation that could suit what you have described wanting.

2. **Speakers**: The Harbeth Compact 7ES-3 has a reputation for natural midrange character in the same family voice as your SHL5 Plus.

3. **Source**: A Chord Qutest is one I would compare against your DP-450 if you want to explore a different presentation.

These are audition candidates, not verified findings — hearing them in your own system is the real test.`;

  it('names survive publication on every run (H) and no hole publishes (I)', async () => {
    for (let r = 0; r < REPS; r++) {
      const o = await publicationOutcome(LIST_DRAFT);
      console.warn(`[battery] H list r${r}: ${o.detail}`);
      expect(o.publishable, `H r${r}: ${o.detail}`).toBe(true);
      for (const name of ['Leben CS-600', 'Compact 7ES-3', 'Chord Qutest']) {
        expect(o.finalAnswer, `H r${r} lost ${name}`).toContain(name);
      }
      // I: publishable implies no deletion-required finding — a mutilated
      // answer can never be the published one.
      expect(o.deletionRequired, `I r${r}`).toBe(false);
    }
  }, TIMEOUT * REPS);
});
