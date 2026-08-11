/**
 * Routing lane battery — intent-classifier regression gate.
 *
 * Runs detectIntent directly against a battery of queries spanning every
 * major lane, asserting the expected intent BOTH with and without an
 * active saved system. The saved-system dimension is the point: the
 * §1b evaluation shortcut in detectIntent routes evaluation phrasings to
 * system_assessment when a saved system is active, and historically that
 * shortcut over-claimed questions about named gear.
 *
 * Origin (founder, production, 2026-08-10): "What do you think of
 * Goldmund amps?" with the FRANCE system saved returned a full SYSTEM
 * ASSESSMENT of the saved system instead of a brand response. Pre-fix,
 * 7 of the 36 battery queries misrouted — all in the brand-opinion and
 * unknown-brand groups, all only when a saved system was present.
 *
 * Encoded rules:
 *   R1. A judgment phrase whose object is a NAMED brand or product is a
 *       question about that gear. Owning a system does not convert it
 *       into a question about the system (isSystemDirectedEvaluation).
 *   R2. Whether the catalog recognises a name must not change what the
 *       question is about — unknown brands go to the product-assessment
 *       clarification or the brand lane, never to an assessment of the
 *       saved system and never to diagnosis.
 *   R3. Objectless / pronoun-object judgments ("what do you think?",
 *       "what do you make of it?") with a saved system ARE about that
 *       system — the §1b shortcut must keep firing for them.
 *
 * Run with:
 *   npx vitest run apps/web/src/lib/__tests__/routing-lane-battery.test.ts
 */
import { describe, it, expect } from 'vitest';
import { detectIntent, type UserIntent } from '../intent';
import { transition, INITIAL_CONV_STATE, type ConvState } from '../conversation-state';

/**
 * One battery row.
 *  - `saved`: expected lane(s) when an active saved system is present.
 *  - `noSaved`: expected lane(s) with no saved system; defaults to `saved`.
 * Multiple lanes are allowed only where two lanes are equally correct
 * (e.g. unknown gear may resolve as product_assessment via the synthetic
 * candidate or gear_inquiry via a recognized brand word) — never to paper
 * over a wrong lane.
 */
interface Row {
  q: string;
  saved: UserIntent[];
  noSaved?: UserIntent[];
}

const BATTERY: Record<string, Row[]> = {
  'brand opinion questions': [
    { q: 'What do you think of Goldmund amps?', saved: ['gear_inquiry'] },
    { q: 'Are Shindo amps any good?', saved: ['gear_inquiry'] },
    { q: 'Thoughts on Chord DACs?', saved: ['gear_inquiry'] },
    { q: 'What do you think of Boenicke speakers?', saved: ['gear_inquiry'] },
    { q: 'Tell me about DeVore Fidelity', saved: ['gear_inquiry'] },
    { q: 'What do you think of Crayon Audio?', saved: ['gear_inquiry'] },
    { q: 'Tell me about H.H. Scott', saved: ['gear_inquiry'] },
    { q: 'opinions on Rega?', saved: ['gear_inquiry'] },
    { q: 'what do you think of pass labs', saved: ['gear_inquiry'] },
    { q: 'have you heard of WLM?', saved: ['gear_inquiry'] },
  ],
  'product questions': [
    { q: 'what do you think of the chord qutest', saved: ['product_assessment'] },
    { q: 'What do you think of the Scott 222B?', saved: ['product_assessment'] },
    { q: 'thoughts on the job integrated', saved: ['product_assessment'] },
    { q: 'is the rega planar 3 worth it?', saved: ['product_assessment'] },
    { q: 'tell me about the leben cs600', saved: ['product_assessment'] },
  ],
  'shopping / buy intent': [
    { q: 'best DAC under $1000', saved: ['shopping'] },
    { q: 'recommend an integrated amplifier around 2k', saved: ['shopping'] },
    { q: 'I want to buy new speakers', saved: ['shopping'] },
    { q: 'looking for a warm tube amp', saved: ['shopping'] },
  ],
  'system assessment': [
    // With no saved system, bare judgment phrasings have no system to
    // point at and fall to the intake / knowledge lanes — pinned here as
    // observed behavior so drift is visible, not as a design statement.
    // The saved-system column is the contract.
    { q: 'assess my system', saved: ['system_assessment'], noSaved: ['consultation_entry'] },
    { q: 'is this a good setup?', saved: ['system_assessment'], noSaved: ['audio_knowledge'] },
    { q: 'What do you think of my system?', saved: ['system_assessment'], noSaved: ['consultation_entry'] },
    { q: 'what do you think?', saved: ['system_assessment'], noSaved: ['audio_knowledge'] },
    { q: 'tell me what you think', saved: ['system_assessment'], noSaved: ['audio_knowledge'] },
    { q: 'what do you make of it?', saved: ['system_assessment'], noSaved: ['audio_knowledge'] },
    { q: 'evaluate the saved system', saved: ['system_assessment'], noSaved: ['audio_knowledge'] },
    { q: 'rate my rig', saved: ['system_assessment'], noSaved: ['consultation_entry'] },
    {
      q: 'review: Job integrated · WLM Diva monitor · Eversolo DMP-A6',
      saved: ['system_assessment'],
      noSaved: ['system_assessment'],
    },
    {
      q: 'chord hugo + job integrated + WLM Diva — what do you think of this system?',
      saved: ['system_assessment'],
      noSaved: ['system_assessment'],
    },
    {
      q: 'I have a chord hugo, job integrated, and WLM Diva — what do you think?',
      saved: ['system_assessment'],
      noSaved: ['system_assessment'],
    },
  ],
  'diagnosis complaints': [
    { q: 'my system sounds bright', saved: ['diagnosis'] },
    { q: 'everything sounds harsh and fatiguing', saved: ['diagnosis'] },
    {
      q: 'my pontus ii into leben cs600 sounds harsh — what do you make of it?',
      saved: ['diagnosis'],
    },
  ],
  'unknown-brand queries': [
    // R2: unresolvable names still belong to the gear lanes. Which lane
    // depends on capitalization/shape, and both are graceful — what is
    // forbidden is system_assessment or diagnosis of the saved system.
    { q: 'What do you think of Zorkendorfer amps?', saved: ['product_assessment', 'gear_inquiry'] },
    { q: 'what do you think of blorptronix amps?', saved: ['product_assessment', 'gear_inquiry'] },
    { q: 'Are Ossuary Audio speakers any good?', saved: ['product_assessment', 'gear_inquiry'] },
    { q: 'thoughts on the Buchardt A700', saved: ['product_assessment'] },
  ],
};

/** Class questions — descriptor + category noun is not a brand name.
 *  The lowercase-brand candidate rule must not synthesize subjects for
 *  these; they keep their pre-existing routing (knowledge / tuning
 *  default), which this suite pins only negatively. */
const CLASS_QUESTIONS = [
  'what do you think of tube amps?',
  'what do you think of cheap dacs?',
  'what do you think of vintage receivers?',
  'what do you think of warm amps?',
  'are bookshelf speakers any good?',
  'what do you think of class d amps?',
];

const SAVED = { hasActiveSavedSystem: true };

describe('routing lane battery — saved system present', () => {
  for (const [group, rows] of Object.entries(BATTERY)) {
    describe(group, () => {
      for (const { q, saved } of rows) {
        it(`"${q}" → ${saved.join(' | ')}`, () => {
          const result = detectIntent(q, SAVED);
          expect(saved, `got "${result.intent}"`).toContain(result.intent);
        });
      }
    });
  }
});

describe('routing lane battery — no saved system', () => {
  for (const [group, rows] of Object.entries(BATTERY)) {
    describe(group, () => {
      for (const { q, saved, noSaved } of rows) {
        const want = noSaved ?? saved;
        it(`"${q}" → ${want.join(' | ')}`, () => {
          const result = detectIntent(q);
          expect(want, `got "${result.intent}"`).toContain(result.intent);
        });
      }
    });
  }
});

describe('saved-system fallthrough never claims gear questions', () => {
  // The core invariant behind the Goldmund bug, asserted directly:
  // for every gear-directed group, the saved-system flag must not
  // change the outcome to a system lane.
  const gearGroups = [
    'brand opinion questions',
    'product questions',
    'unknown-brand queries',
  ] as const;
  for (const group of gearGroups) {
    for (const { q } of BATTERY[group]) {
      it(`"${q}" is not absorbed by the saved system`, () => {
        const withSaved = detectIntent(q, SAVED);
        expect(withSaved.intent).not.toBe('system_assessment');
        expect(withSaved.intent).not.toBe('diagnosis');
      });
    }
  }
});

describe('class questions do not synthesize product candidates', () => {
  for (const q of CLASS_QUESTIONS) {
    it(`"${q}" stays out of product_assessment`, () => {
      const result = detectIntent(q, SAVED);
      expect(result.intent).not.toBe('product_assessment');
      expect(result.subjectMatches).toHaveLength(0);
    });
  }
});

describe('mid-assessment gear questions break out of the state machine', () => {
  // Route B of the Goldmund bug: with the conversation state machine in
  // system_assessment/ready_to_assess, opinion questions about named
  // gear were absorbed by the accumulate-and-re-assess branch — the
  // question text was appended to the stored system description and the
  // turn answered with another assessment of the saved system.
  const assessed: ConvState = {
    mode: 'system_assessment',
    stage: 'ready_to_assess',
    facts: {
      hasSystem: true,
      systemAssessmentText: 'Eversolo DMP-A6, Job integrated, WLM Diva monitor',
    },
  };

  function turn(text: string, subjectCount: number) {
    return transition(assessed, text, {
      hasSystem: true,
      subjectCount,
      detectedIntent: detectIntent(text, SAVED).intent,
    });
  }

  it('"What do you think of Goldmund amps?" resets to idle (new topic)', () => {
    const t = turn('What do you think of Goldmund amps?', 1);
    expect(t.state).toEqual(INITIAL_CONV_STATE);
    expect(t.response).toBeNull();
  });

  it('"What do you think of my system?" stays in assessment', () => {
    const t = turn('What do you think of my system?', 3);
    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.stage).toBe('ready_to_assess');
  });

  it('direction follow-up ("what would you upgrade first?") stays in assessment', () => {
    const t = turn('what would you upgrade first?', 0);
    expect(t.state.mode).toBe('system_assessment');
  });

  it('component clarification ("the amp is a Job integrated") accumulates', () => {
    const t = turn('the amp is a Job integrated', 1);
    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.facts.systemAssessmentText).toContain('Job integrated');
  });

  it('gear question text is never accumulated into the system description', () => {
    const t = turn('What do you think of Goldmund amps?', 1);
    expect(t.state.facts.systemAssessmentText ?? '').not.toContain('Goldmund');
  });
});

describe('capability questions about owned gear reach the knowledge lane (D10)', () => {
  // Saturation cohort, 2026-08-11: "is my wiim amp actually limiting the
  // 3020i?" mid-shopping was absorbed into a speaker shopping list. The
  // concept gate covered "can my X drive Y" but not limiting/holding-back
  // phrasings. audio_knowledge is non-advisory, so it is exempt from the
  // shopping-mode lock by construction.
  const CASES = [
    'is my wiim amp actually limiting the 3020i?',
    'is the amp holding back my speakers?',
    'is my receiver bottlenecking the towers?',
  ];
  for (const q of CASES) {
    it(`"${q}" → audio_knowledge`, () => {
      expect(detectIntent(q, SAVED).intent).toBe('audio_knowledge');
      expect(detectIntent(q).intent).toBe('audio_knowledge');
    });
  }
});

describe('prose signal-path chains are system presentations (cohort)', () => {
  // "my rig is a bluesound node into a hegel h390 into kef r3" extracted
  // all three components yet asked "What components are in your system?".
  // Two prose connectors = a stated chain; ownership + chain + subjects
  // routes to assessment, where restraint can answer.
  it('"my rig is a bluesound node into a hegel h390 into kef r3" → system_assessment', () => {
    expect(detectIntent('my rig is a bluesound node into a hegel h390 into kef r3').intent)
      .toBe('system_assessment');
  });

  it('control: a single incidental "into" is not a chain', () => {
    expect(detectIntent("i'm into jazz and looking for a hegel amp").intent)
      .not.toBe('system_assessment');
  });
});
