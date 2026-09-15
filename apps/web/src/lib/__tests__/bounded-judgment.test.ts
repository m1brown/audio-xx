/**
 * Bounded system judgment — capability pins (2026-09-15).
 *
 * Two real beta listeners received trustworthy but inert assessments: Audio
 * XX treated "I cannot assert the missing fact" as "I cannot reason around
 * the missing fact". These pins hold the licensing line of the repair:
 * bracketing published figures license bounded reasoning (never an
 * interpolated wattage), and a listener may not be asked to research
 * published specifications.
 */
import { describe, it, expect } from 'vitest';
import {
  statedPowerEntries, statedPowerBracket, wattsAtStatedLoad,
} from '../artifact/interface-conclusions';
import { questionViolations } from '../relational-explain';

const ACCUPHASE_LADDER =
  '30W/ch into 8 ohms; 60W/ch into 4 ohms; 120W/ch into 2 ohms; 150W/ch into 1 ohm (music signals)';

describe('stated power ladder — the bracket is derived, the rung is not', () => {
  it('reads every stated load with its own figure', () => {
    expect(statedPowerEntries(ACCUPHASE_LADDER)).toEqual([
      { ohms: 8, watts: 30 }, { ohms: 4, watts: 60 },
      { ohms: 2, watts: 120 }, { ohms: 1, watts: 150 },
    ]);
  });

  it('brackets an unstated 6-ohm load with the neighbouring published rungs', () => {
    expect(statedPowerBracket(ACCUPHASE_LADDER, 6)).toEqual({
      above: { ohms: 8, watts: 30 }, below: { ohms: 4, watts: 60 },
    });
  });

  it('never yields a figure AT the unstated load — the bracket does not interpolate', () => {
    expect(wattsAtStatedLoad(ACCUPHASE_LADDER, 6)).toBeUndefined();
  });

  it('reports no bracket where the ladder does not actually straddle the load', () => {
    expect(statedPowerBracket(ACCUPHASE_LADDER, 16)).toBeUndefined();
    expect(statedPowerBracket('80W per channel into 8 ohms, continuous', 6)).toBeUndefined();
  });
});

describe('question validator — published specifications are never listener homework', () => {
  it('flags the real beta question that shipped', () => {
    const v = questionViolations(
      'What is the sensitivity and nominal impedance of the Dynaco A35 speakers as per their specifications?',
      'missing_evidence',
    );
    expect(v.some((x) => x.includes('published specifications'))).toBe(true);
  });

  it('flags datasheet/spec-sheet phrasings too', () => {
    for (const q of [
      'Could you check the spec sheet for the rated impedance?',
      'What is its published specification for power output?',
    ]) {
      expect(questionViolations(q, 'missing_evidence').length,
        q).toBeGreaterThan(0);
    }
  });

  it('passes listener-unique questions untouched', () => {
    for (const q of [
      'Are you running into any limit on volume or dynamic range at the levels you actually use?',
      'How far do you sit from the speakers, and how loud do you typically listen?',
      'Do loud passages harden or compress as you turn up?',
    ]) {
      expect(questionViolations(q, 'missing_evidence'), q).toEqual([]);
    }
  });
});
