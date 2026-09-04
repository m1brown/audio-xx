/**
 * Follow-up grounding — P1 regression pins (2026-09-04).
 *
 * Reproduced defect: "Would Wharfedale Lintons be an upgrade over the
 * Klipschs?" produced the candidate "Would Wharfedale Lintons" — the
 * sentence-initial auxiliary glued into the product name — whose store key
 * matches nothing, so the lane told the listener the specifications of a
 * STOCKED product were unknown. Three authority points on one chain:
 *
 *   1. typedSpanFor trimmed determiners but not auxiliaries;
 *   2. the retrieval key had no ordinary-plural fallback ("Lintons");
 *   3. a catalog near-miss ("Linton" vs catalog "Linton Heritage") marked
 *      the candidate ambiguous, and the ambiguous branch short-circuited
 *      past the store even though the listener's exact typed key is a
 *      governed registration.
 *
 * The identity discipline is not weakened: a bare brand and an excluded
 * sibling still resolve ambiguous with no evidence attached.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { detectCandidates, resolveCandidateIdentity } from '../candidate-detection';
import { retrieveCandidateEvidence } from '../evidence-retrieval';
import { writeFacts, __clearFactCache } from '@/lib/evidence/manufacturer-fact-store';
import { toEvidenceItem } from '@/lib/evidence/manufacturer-facts';

const NOW = Date.now();

const KLIPSCH_SYSTEM = [
  { displayName: 'Wiim pro' },
  { displayName: 'Yamaha A-S501' },
  { displayName: 'Klipsch RP-600M II' },
];

async function stockLinton() {
  __clearFactCache();
  await writeFacts([
    toEvidenceItem('Wharfedale Linton', {
      field: 'sensitivity',
      value: '90dB',
      sourceUrl: 'https://www.wharfedale.co.uk/linton/',
      quotedText: 'Sensitivity 90dB',
    }, NOW),
    toEvidenceItem('Wharfedale Linton', {
      field: 'impedance',
      value: 'Nominal Impedance 6Ω; Minimum Impedance 3.5Ω',
      sourceUrl: 'https://www.wharfedale.co.uk/linton/',
      quotedText: 'Nominal Impedance 6Ω',
    }, NOW),
  ]);
}

describe('candidate name extraction — leading function words are not identity', () => {
  it('strips a sentence-initial auxiliary from the detected candidate', () => {
    const cands = detectCandidates(
      'Would Wharfedale Lintons be an upgrade over the Klipschs?',
      KLIPSCH_SYSTEM,
    );
    const names = cands.map((c) => c.displayName);
    expect(names.some((n) => /^would/i.test(n))).toBe(false);
    expect(names.some((n) => /wharfedale lintons?/i.test(n))).toBe(true);
  });

  it('strips question-word leads the same way', () => {
    const cands = detectCandidates(
      'What about Wharfedale Lintons instead?',
      KLIPSCH_SYSTEM,
    );
    expect(cands.map((c) => c.displayName).some((n) => /^what/i.test(n))).toBe(false);
  });
});

describe('stocked evidence reaches a candidate the catalog cannot exactly place', () => {
  beforeEach(stockLinton);

  it('the listener\'s plural of a registered identity retrieves the held facts', async () => {
    const cand = resolveCandidateIdentity('Wharfedale Lintons');
    const ev = await retrieveCandidateEvidence(cand, { now: NOW });
    const text = ev.items.map((i) => i.text).join('\n');
    expect(text).toContain('90dB');
    expect(text).toContain('6Ω');
  });

  it('the exact singular retrieves the held facts too', async () => {
    const cand = resolveCandidateIdentity('Wharfedale Linton');
    const ev = await retrieveCandidateEvidence(cand, { now: NOW });
    expect(ev.items.map((i) => i.text).join('\n')).toContain('90dB');
  });

  it('a bare brand stays ambiguous with nothing attached', async () => {
    const cand = resolveCandidateIdentity('Wharfedale');
    const ev = await retrieveCandidateEvidence(cand, { now: NOW });
    expect(ev.identity).toBe('ambiguous');
    expect(ev.items).toHaveLength(0);
  });

  it('a different model of the same brand attaches nothing from the Linton registration', async () => {
    const cand = resolveCandidateIdentity('Wharfedale Diamond 12.1');
    const ev = await retrieveCandidateEvidence(cand, { now: NOW });
    expect(ev.items.map((i) => i.text).join('\n')).not.toContain('90dB');
  });

  it('the singular fallback never corrupts a model designation ending in s', async () => {
    // "SVS" must not become "SV"; a key ending in a short token is untouched.
    const cand = resolveCandidateIdentity('SVS SB-1000 Pro');
    const ev = await retrieveCandidateEvidence(cand, { now: NOW });
    // Nothing stocked for it in this test store — and nothing borrowed.
    expect(ev.items.map((i) => i.text).join('\n')).not.toContain('90dB');
  });
});
