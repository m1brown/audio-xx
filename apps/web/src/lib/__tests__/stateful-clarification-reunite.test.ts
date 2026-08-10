import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { detectChurnSignal } from '../churn-avoidance';
import { SYSTEM_COMPONENTS_QUESTION, SYSTEM_JUDGMENT_REQUEST } from '../clarification';
import { transition } from '../conversation-state';

/**
 * Mission 4 — stateful clarification (2026-08-10).
 *
 * Root cause across three Mission 3 families: a clarification question was
 * dispatched with NO pending state, so the answering turn re-entered the
 * pipeline cold. Live reproduction on production (audio-xx-hpo505vce):
 *
 *   "feliks envy + klipsch cornwall iv — is my system balanced?"
 *   → "What components are in your system?"                       (asked)
 *   "amp is a feliks audio envy, speakers are klipsch cornwall iv,
 *    source is a bluesound node"
 *   → "Got it — let's figure out what's going on with your
 *      amplifier. Is it distorting, running hot…"                 (invented problem)
 *
 * The repair (page.tsx): pendingClarificationRef is armed at every
 * system-components / churn-reflection ask, and the next turn's text is
 * reunited with the original request — `${answer}. ${originalRequest}` —
 * before extraction and routing. These tests pin the deterministic
 * composition the wiring relies on. The wiring itself is verified live.
 */

const reunite = (answer: string, original: string) => `${answer}. ${original}`;

describe('reunited answers route to system assessment', () => {
  const ORIGINALS = [
    'is my system balanced',
    'weakest link in my setup?',
    'does anything need changing in my setup',
    'feliks envy + klipsch cornwall iv — is my system balanced?',
  ];
  const ANSWER =
    'amp is a feliks audio envy, speakers are klipsch cornwall iv, source is a bluesound node';

  for (const original of ORIGINALS) {
    it(`answer + "${original}" → system_assessment`, () => {
      expect(detectIntent(reunite(ANSWER, original)).intent).toBe('system_assessment');
    });
  }

  it('the answer ALONE does not reach assessment — this is why reuniting is required', () => {
    // Cold classification of the bare component list: this is the defect
    // the state repairs. If this ever becomes system_assessment on its own,
    // the reunite is no longer load-bearing (fine) — but it must never
    // become 'diagnosis', which is what produced the invented amp problem.
    expect(detectIntent(ANSWER).intent).not.toBe('system_assessment');
    expect(detectIntent(ANSWER).intent).not.toBe('diagnosis');
  });
});

describe('reunited churn answers carry the symptom into diagnosis', () => {
  it('churn question fires for the original, and the reunited answer routes by its content', () => {
    const original = 'should i upgrade my dac';
    expect(detectChurnSignal(original).detected).toBe(true);
    // The user answers the reflective question with an actual symptom —
    // the reunited turn must route to diagnosis, with the symptom present.
    const reunited = reunite('well, it does sound a bit thin and flat lately', original);
    expect(detectIntent(reunited).intent).toBe('diagnosis');
  });
});

describe('pivot guard — standalone requests are honoured, not contaminated', () => {
  // The consuming side skips the reunite when the raw answer classifies as
  // a standalone intent. These inputs pin the intents the guard relies on.
  it('a shopping pivot classifies as shopping on its own', () => {
    expect(detectIntent('actually, just recommend speakers under $2000').intent).toBe('shopping');
  });
  it('a comparison pivot classifies as comparison on its own', () => {
    expect(detectIntent('hegel h95 vs naim nait xs 3').intent).toBe('comparison');
  });
});

describe('the armed question is the exported constant', () => {
  it('SYSTEM_COMPONENTS_QUESTION is the A2 system ask', () => {
    expect(SYSTEM_COMPONENTS_QUESTION).toMatch(/^What components are in your system\?/);
  });
});

describe('chain-segment counting — partially resolvable chains reach assessment', () => {
  // Mission 4 re-probe 1: "feliks audio envy + klipsch cornwall iv — what
  // do you think of this system?" resolved only ONE subject (the brand
  // "klipsch"), so the assessment gate (which counted resolved subjects)
  // never fired and the brand-consultation path answered with Klipsch's
  // representative product — a confident Heresy IV essay, prices, reviews
  // and buy links, for a user who asked about the Cornwall IV. Counting
  // chain SEGMENTS routes the message into buildSystemAssessment, whose
  // validation machinery handles unresolved components honestly.
  it('the Cornwall probe routes to system_assessment', () => {
    expect(detectIntent(
      'feliks audio envy + klipsch cornwall iv — what do you think of this system?',
    ).intent).toBe('system_assessment');
  });

  it('control: fully-resolvable chains keep routing to assessment', () => {
    expect(detectIntent(
      'denafrips pontus ii + leben cs600 + harbeth 30.2 — what do you think of this system?',
    ).intent).toBe('system_assessment');
  });

  it('control: a single product with assessment language is not a system', () => {
    expect(detectIntent('what do you think of the pontus ii?').intent)
      .not.toBe('system_assessment');
  });
});

describe('judgment requests are not hijacked by component troubleshooting', () => {
  // Mission 4B: "my system: shiit modius dac, luxmann l-505z, wharfdale
  // linton — how does it hang together?" (three brand misspellings, zero
  // resolvable subjects) was answered with "let's figure out what's going
  // on with your DAC" — the component-troubleshooting map fires before the
  // system ask for any diagnosis-routed message naming a category word.
  // page.tsx skips the map when SYSTEM_JUDGMENT_REQUEST matches with no
  // symptoms; these pin the discriminator inputs.
  it('the misspelled judgment request matches the judgment pattern', () => {
    expect(SYSTEM_JUDGMENT_REQUEST.test(
      'my system: shiit modius dac, luxmann l-505z, wharfdale linton — how does it hang together?',
    )).toBe(true);
  });
  it('genuine component complaints do not match (troubleshooting keeps them)', () => {
    expect(SYSTEM_JUDGMENT_REQUEST.test('I want to fix my amp')).toBe(false);
    expect(SYSTEM_JUDGMENT_REQUEST.test('my dac is acting up')).toBe(false);
  });
});

describe('verdict challenges are assessment follow-ups', () => {
  // Mission 4B: "are you sure?" after "Nothing here needs changing" was
  // answered by the knowledge lane with a generic essay about how the
  // advisor works. Challenges must take the assessment-continuity path
  // and be answered FROM the assessment.
  const readyState = { mode: 'system_assessment', stage: 'ready_to_assess', facts: {} } as const;
  const ctx = { hasSystem: true, subjectCount: 0, detectedIntent: 'audio_knowledge' } as const;

  for (const challenge of ['are you sure?', 'how do you know that?', 'really?', 'why?', 'convince me']) {
    it(`"${challenge}" proceeds as an assessment follow-up`, () => {
      const r = transition({ ...readyState, facts: {} } as never, challenge, ctx as never);
      expect(r.response?.kind).toBe('proceed');
      expect((r.state.facts as { assessmentFollowUpTurn?: boolean }).assessmentFollowUpTurn).toBe(true);
    });
  }

  it('component additions still accumulate instead of proceeding', () => {
    const r = transition({ ...readyState, facts: {} } as never, 'also i have a rel t5x sub', { ...ctx, subjectCount: 1 } as never);
    expect((r.state.facts as { assessmentFollowUpTurn?: boolean }).assessmentFollowUpTurn).not.toBe(true);
  });
});
