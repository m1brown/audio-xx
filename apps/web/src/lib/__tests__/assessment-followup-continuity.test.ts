/**
 * Assessment follow-up continuity (launch continuity, 2026-07-19).
 *
 * Pins the one-turn continuity behaviour: the FIRST follow-up after a
 * system assessment that asks for upgrade direction ("what would I
 * upgrade first?", "weakest link?") is answered from the assessment the
 * engine already ran — never with "what component are you looking to
 * change?". Scope is deliberately one turn; this is not a conversational
 * memory system, and the existing exits (shopping, diagnosis, component
 * accumulation) must be untouched.
 */
import { describe, it, expect } from 'vitest';
import { transition } from '../conversation-state';
import type { ConvState } from '../conversation-state';
import { detectIntent } from '../intent';
import { buildTurnContext } from '../turn-context';
import { buildSystemAssessment } from '../consultation';
import { composeAssessmentFollowUp, composeReviewAnchoredAnswer } from '../assessment-followup';
import type { AudioSessionState } from '../system-types';

const defaultCtx = (text: string) => {
  const { intent, subjectMatches } = detectIntent(text);
  return {
    hasSystem: true,
    subjectCount: subjectMatches.length,
    detectedIntent: intent,
  };
};

function readyState(overrides?: Record<string, unknown>): ConvState {
  return {
    mode: 'system_assessment',
    stage: 'ready_to_assess',
    facts: {
      hasSystem: true,
      systemComponents: ['Bluesound Node, Marantz PM8006, KEF R3'],
      systemAssessmentText: 'Bluesound Node, Marantz PM8006, KEF R3',
      ...overrides,
    },
  };
}

describe('state machine: first direction follow-up arms continuity', () => {
  const DIRECTION_QUESTIONS = [
    'If I ever did upgrade one thing, what would it be?',
    'What should I upgrade first?',
    "What's the weakest link?",
    'Where would you spend money to improve it?',
    'Which component would you change?',
  ];

  for (const q of DIRECTION_QUESTIONS) {
    it(`"${q}" stays in assessment and arms the follow-up flag`, () => {
      const t = transition(readyState(), q, defaultCtx(q));
      expect(t.state.mode).toBe('system_assessment');
      expect(t.state.stage).toBe('ready_to_assess');
      expect(t.state.facts.assessmentFollowUpTurn).toBe(true);
      expect(t.state.facts.assessmentContinuityUsed).toBe(true);
      expect(t.response).toEqual({ kind: 'proceed' });
      // The system text must stay clean — the question is not a component.
      expect(t.state.facts.systemAssessmentText).toBe('Bluesound Node, Marantz PM8006, KEF R3');
    });
  }

  it('scope is one turn: a second direction question takes the normal path', () => {
    const q = 'What should I upgrade first?';
    const t = transition(readyState({ assessmentContinuityUsed: true }), q, defaultCtx(q));
    expect(t.state.facts.assessmentFollowUpTurn).not.toBe(true);
  });

  it('explicit buying intent still exits to shopping', () => {
    const q = 'I want to buy a new DAC';
    const t = transition(readyState(), q, defaultCtx(q));
    expect(t.state.mode).toBe('shopping');
    expect(t.state.facts.assessmentFollowUpTurn).not.toBe(true);
  });

  it('symptom language still exits to diagnosis', () => {
    const q = 'something sounds off, the treble is fatiguing';
    const t = transition(readyState(), q, defaultCtx(q));
    expect(t.state.mode).toBe('diagnosis');
  });

  it('a substitution question about the system\'s OWN component arms continuity', () => {
    // "Would replacing the Eversolo with a much better external DAC be a
    // worthwhile upgrade?" names a product — the system's own — and was
    // being answered with a shopping budget intake. A direction question
    // about the standing assessment stays in the assessment.
    const q = 'Would replacing the Eversolo with a much better external DAC be a worthwhile upgrade?';
    const ctx = defaultCtx(q);
    const st = readyState();
    st.facts.systemAssessmentText = 'assess my system: Eversolo DMP-A6 streamer/dac '
      + '--> JOB Job integrated amp --> WLM Diva monitor speakers';
    const t = transition(st, q, ctx);
    expect(t.state.facts.assessmentFollowUpTurn).toBe(true);
  });

  it('"is the Butler holding the system back?" is a direction question, not diagnosis', () => {
    const q = 'Do you think the Butler is holding the system back?';
    const ctx = defaultCtx(q);
    const st = readyState();
    st.facts.systemAssessmentText = 'Assess my system: dCS Rossini Apex, ARC ref 5, Butler Monads, Acora QRC-2';
    const t = transition(st, q, ctx);
    expect(t.state.facts.assessmentFollowUpTurn).toBe(true);
  });

  it('a follow-up naming a specific product keeps accumulate-and-reassess', () => {
    const q = 'What if I swap out the Marantz PM8006 and change to a Hegel H120?';
    const ctx = defaultCtx(q);
    expect(ctx.subjectCount).toBeGreaterThan(0); // precondition for this guard
    const t = transition(readyState(), q, ctx);
    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.facts.assessmentFollowUpTurn).not.toBe(true);
  });
});

describe('review-anchored follow-up answers', () => {
  const REVIEW = [
    'This is an exceptionally ambitious, reference-oriented system.',
    'The open question is the amplifier \u2014 the Butler MONAD A100 is the least corroborated link in the chain, and the most informative place to experiment.',
    'If this were my system, I would leave the dCS Rossini Apex and the Acora Acoustics QRC-2 alone \u2014 they carry the strongest independent evidence in the chain.',
    'The one experiment worth running is the amplifier. Auditioning a modern reference amplifier against it would answer the most informative question this system can be asked.',
  ];
  it('the Butler question is answered from the review, verbatim', () => {
    const a = composeReviewAnchoredAnswer('Do you think the Butler is holding the system back?', REVIEW);
    expect(a).toBeTruthy();
    expect(a).toContain('least corroborated link');
    expect(a).toContain('experiment worth running');
  });
  it('a change-first question gets the experiment and leave-alone judgment', () => {
    const a = composeReviewAnchoredAnswer('What would you change first?', REVIEW);
    expect(a).toBeTruthy();
    expect(a).toContain('experiment worth running');
  });
  it('an unrelated question returns null and falls through', () => {
    expect(composeReviewAnchoredAnswer('How do room modes work?', REVIEW.slice(0, 1))).toBeNull();
  });
});

describe('composer: focused answer from existing findings', () => {
  const GUEST_AUDIO_STATE: AudioSessionState = {
    activeSystemRef: { kind: 'none' } as AudioSessionState['activeSystemRef'],
    savedSystems: [],
    draftSystem: null,
    loading: false,
    proposedSystem: null,
  };

  function findingsFor(systemText: string) {
    const turnCtx = buildTurnContext(systemText, GUEST_AUDIO_STATE, new Set(), undefined);
    const result = buildSystemAssessment(systemText, turnCtx.subjectMatches, turnCtx.activeSystem, turnCtx.desires);
    if (!result || result.kind !== 'assessment') return null;
    return result.findings;
  }

  it('mainstream chain: names a direction and never re-asks for the system', () => {
    const findings = findingsFor('Assess my system: Bluesound Node, Marantz PM8006, KEF R3');
    expect(findings).not.toBeNull();
    const answer = composeAssessmentFollowUp(findings!);
    expect(answer).toBeTruthy();
    // Must be an answer, not a question about their gear.
    expect(answer).not.toMatch(/looking to change|what component|can you name|what are the components/i);
    // Must commit to a direction — either a change target or an explicit stay-put verdict.
    expect(answer).toMatch(/change one thing|nothing/i);
  });

  it('documented coherent chain: answers consistently with the assessment verdict', () => {
    const findings = findingsFor('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96');
    expect(findings).not.toBeNull();
    const answer = composeAssessmentFollowUp(findings!);
    expect(answer).toBeTruthy();
    expect(answer).not.toMatch(/looking to change|what component|restate|can you name/i);
  });

  it('answers contain no internal taxonomy or implementation vocabulary', () => {
    for (const system of [
      'Assess my system: Bluesound Node, Marantz PM8006, KEF R3',
      'Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96',
    ]) {
      const findings = findingsFor(system);
      const answer = composeAssessmentFollowUp(findings!) ?? '';
      expect(answer).not.toMatch(/warm_bright|smooth_detailed|elastic_controlled|airy_closed|deterministic|ontology|catalog(?:ue)?\s+resolution|axis/i);
      expect(answer).not.toMatch(/undefined|null|NaN/);
    }
  });

  it('returns null on empty findings so the caller can fall back', () => {
    expect(composeAssessmentFollowUp(null as never)).toBeNull();
  });
});
