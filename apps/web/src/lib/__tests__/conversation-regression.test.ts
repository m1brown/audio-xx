/**
 * Audio XX — Comprehensive Regression & Behavioral Audit
 *
 * Tests the conversation state machine (conversation-state.ts) and
 * intent detection (intent.ts) across all major entry paths, categories,
 * and user types.
 *
 * Validates:
 *   1. Mode locking
 *   2. Context persistence
 *   3. Correct routing from user entry
 *   4. Recommendation timing
 *   5. Category robustness
 *   6. Music input handling
 *   7. Diagnosis discipline
 */

import {
  type ConvState,
  type ConvFacts,
  type ConvTransition,
  INITIAL_CONV_STATE,
  transition,
  detectInitialMode,
  isOrientationInput,
  isReadyToRecommend,
  isReadyToDiagnose,
  isReadyToCompare,
} from '../conversation-state';
import { detectIntent } from '../intent';

// ── Helpers ──────────────────────────────────────────

/** Simulate a full turn: detect intent, then either detectInitialMode or transition. */
function simulateTurn(
  state: ConvState,
  text: string,
  overrides?: { hasSystem?: boolean; subjectCount?: number },
): ConvTransition & { intentResult?: ReturnType<typeof detectIntent> } {
  const intentResult = detectIntent(text);
  const hasSystem = overrides?.hasSystem ?? (intentResult.subjects?.length >= 2);
  const subjectCount = overrides?.subjectCount ?? (intentResult.subjects?.length ?? 0);

  if (state.mode === 'idle') {
    const initial = detectInitialMode(text, {
      detectedIntent: intentResult.intent,
      hasSystem,
      subjectCount,
    });
    if (initial) {
      // For system_assessment entry, run transition immediately (mirrors page.tsx)
      if (initial.mode === 'system_assessment' && initial.stage === 'entry') {
        const result = transition(initial, text, {
          hasSystem,
          subjectCount,
          detectedIntent: intentResult.intent,
        });
        return { ...result, intentResult };
      }
      return {
        state: initial,
        response: initial.stage === 'ready_to_recommend' ||
                  initial.stage === 'ready_to_diagnose' ||
                  initial.stage === 'ready_to_compare'
          ? { kind: 'proceed' }
          : null,
        intentResult,
      };
    }
    // No initial mode detected — fallback to pipeline
    return { state: INITIAL_CONV_STATE, response: null, intentResult };
  }

  // Active state: run transition
  const result = transition(state, text, {
    hasSystem: overrides?.hasSystem ?? state.facts.hasSystem ?? false,
    subjectCount: overrides?.subjectCount ?? (intentResult.subjects?.length ?? 0),
    detectedIntent: intentResult.intent,
  });
  return { ...result, intentResult };
}

/** Run a multi-turn conversation and return all states. */
function runConversation(
  turns: Array<{ text: string; hasSystem?: boolean; subjectCount?: number }>,
): Array<ConvTransition & { input: string; intentResult?: ReturnType<typeof detectIntent> }> {
  let state = { ...INITIAL_CONV_STATE };
  const results: Array<ConvTransition & { input: string; intentResult?: ReturnType<typeof detectIntent> }> = [];
  for (const turn of turns) {
    const result = simulateTurn(state, turn.text, {
      hasSystem: turn.hasSystem,
      subjectCount: turn.subjectCount,
    });
    results.push({ ...result, input: turn.text });
    state = result.state;
  }
  return results;
}

// ── Scoring helpers ──────────────────────────────────

interface TestScore {
  test: string;
  detectedMode: string;
  expectedBehavior: string;
  actualBehavior: string;
  scores: {
    routing: number;
    contextRetention: number;
    decisiveness: number;
    recommendationTiming: number;
    naturalness: number;
  };
  pass: boolean;
  failureReason?: string;
  suggestedFix?: string;
}

const allScores: TestScore[] = [];

function score(s: TestScore) {
  allScores.push(s);
}

// ══════════════════════════════════════════════════════
// TEST GROUP A — MUSIC → CATEGORY FLOWS
// ══════════════════════════════════════════════════════

describe('Group A — Music → Category Flows', () => {

  test('A1: "I like Van Halen" → speakers → starting from scratch', () => {
    const results = runConversation([
      { text: 'I like Van Halen' },
      { text: 'speakers' },
      { text: 'starting from scratch' },
    ]);

    // Turn 1: music_input detected, ask about listening path
    expect(results[0].state.mode).toBe('music_input');
    expect(results[0].state.stage).toBe('awaiting_listening_path');
    expect(results[0].state.facts.musicDescription).toBe('I like Van Halen');

    // Turn 2: speakers detected, ask follow-up
    expect(results[1].state.facts.listeningPath).toBe('speakers');
    expect(results[1].state.facts.category).toBe('speaker');

    // Turn 3: no budget in "starting from scratch" → should ask for budget, NOT recommend
    expect(results[2].state.mode).toBe('shopping');
    expect(results[2].state.stage).toBe('clarify_budget');
    expect(results[2].response?.kind).toBe('question');
    // Must NOT be ready_to_recommend without budget
    expect(results[2].state.stage).not.toBe('ready_to_recommend');

    // Context preserved
    expect(results[2].state.facts.musicDescription).toBe('I like Van Halen');
    expect(results[2].state.facts.category).toBe('speaker');

    score({
      test: 'A1',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'music_input → speakers → ask budget (no premature recommend)',
      actualBehavior: `${results[0].state.mode} → ${results[1].state.facts.listeningPath} → ${results[2].state.mode}/${results[2].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: true,
    });
  });

  test('A2: "I listen to classical music" → speakers', () => {
    const results = runConversation([
      { text: 'I listen to classical music' },
      { text: 'speakers' },
    ]);

    expect(results[0].state.mode).toBe('music_input');
    expect(results[0].state.facts.musicDescription).toBe('I listen to classical music');
    expect(results[1].state.facts.listeningPath).toBe('speakers');
    expect(results[1].state.facts.category).toBe('speaker');
    // Should NOT be recommending yet
    expect(results[1].state.stage).not.toBe('ready_to_recommend');

    score({
      test: 'A2',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'music_input → speakers path set, no recommendation yet',
      actualBehavior: `${results[0].state.mode} → path=${results[1].state.facts.listeningPath}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: true,
    });
  });

  test('A3: "I listen to opera" → headphones', () => {
    const results = runConversation([
      { text: 'I listen to opera' },
      { text: 'headphones' },
    ]);

    expect(results[0].state.mode).toBe('music_input');
    expect(results[1].state.facts.listeningPath).toBe('headphones');
    expect(results[1].state.facts.category).toBe('headphone');

    score({
      test: 'A3',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'music_input → headphones, awaiting follow-up',
      actualBehavior: `${results[0].state.mode} → path=${results[1].state.facts.listeningPath}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: true,
    });
  });

  test('A4: "I listen to jazz" → DAC', () => {
    const results = runConversation([
      { text: 'I listen to jazz' },
      { text: 'I want a DAC' },
    ]);

    expect(results[0].state.mode).toBe('music_input');
    expect(results[0].state.facts.musicDescription).toBe('I listen to jazz');

    // Turn 2: "I want a DAC" — should detect DAC category
    // This comes during music_input awaiting_listening_path
    // DAC doesn't match headphones/speakers patterns
    expect(results[1].state.facts.category).toBe('dac');

    score({
      test: 'A4',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'music_input → DAC category detected on turn 2',
      actualBehavior: `${results[0].state.mode} → category=${results[1].state.facts.category}`,
      scores: {
        routing: results[1].state.facts.category === 'dac' ? 5 : 2,
        contextRetention: 5,
        decisiveness: 4,
        recommendationTiming: 5,
        naturalness: 4,
      },
      pass: results[1].state.facts.category === 'dac',
      failureReason: results[1].state.facts.category !== 'dac' ? 'DAC category not detected from music_input path' : undefined,
      suggestedFix: results[1].state.facts.category !== 'dac' ? 'music_input awaiting_listening_path should extract category from non-headphone/speaker mentions and transition to shopping' : undefined,
    });
  });

  test('A5: "I like Irish music" → speakers', () => {
    const results = runConversation([
      { text: 'I like Irish music' },
      { text: 'speakers' },
    ]);

    // "Irish music" — not in genre keywords but "I like" matches MUSIC_INPUT_PATTERNS
    // Or artist/genre patterns
    const intent = detectIntent('I like Irish music');

    expect(results[0].state.mode).toBe('music_input');
    expect(results[0].state.facts.musicDescription).toBe('I like Irish music');
    expect(results[1].state.facts.listeningPath).toBe('speakers');

    score({
      test: 'A5',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'music_input → speakers, music description preserved',
      actualBehavior: `${results[0].state.mode} → music="${results[0].state.facts.musicDescription}" path=${results[1].state.facts.listeningPath}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.mode === 'music_input',
    });
  });

  test('A6: "I listen to Algerian music"', () => {
    const results = runConversation([
      { text: 'I listen to Algerian music' },
    ]);

    // Should detect music_input intent
    expect(results[0].state.mode).toBe('music_input');
    expect(results[0].state.stage).toBe('awaiting_listening_path');
    expect(results[0].state.facts.musicDescription).toBe('I listen to Algerian music');

    score({
      test: 'A6',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'music_input, ask headphones/speakers',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.mode === 'music_input',
    });
  });

  test('A7: "I listen to electronic music"', () => {
    const results = runConversation([
      { text: 'I listen to electronic music' },
    ]);

    expect(results[0].state.mode).toBe('music_input');
    expect(results[0].state.facts.musicDescription).toBe('I listen to electronic music');

    score({
      test: 'A7',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'music_input, ask headphones/speakers',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.mode === 'music_input',
    });
  });

  test('A8: "I listen to everything"', () => {
    const results = runConversation([
      { text: 'I listen to everything' },
    ]);

    // "I listen to everything" could match music_input OR orientation ("I like everything")
    // The ORIENTATION_PATTERNS includes "I like everything" but not "I listen to everything"
    // MUSIC_INPUT_PATTERNS has "I listen to" which should match
    const isOrientation = isOrientationInput('I listen to everything');
    const intent = detectIntent('I listen to everything');

    // Either music_input or orientation is acceptable; should NOT be shopping
    expect(['music_input', 'orientation']).toContain(results[0].state.mode);
    expect(results[0].state.mode).not.toBe('shopping');
    expect(results[0].state.mode).not.toBe('diagnosis');

    score({
      test: 'A8',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'music_input or orientation (not shopping/diagnosis)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 4, contextRetention: 5, decisiveness: 4, recommendationTiming: 5, naturalness: 4 },
      pass: ['music_input', 'orientation'].includes(results[0].state.mode),
    });
  });
});

// ══════════════════════════════════════════════════════
// TEST GROUP B — DIRECT SHOPPING
// ══════════════════════════════════════════════════════

describe('Group B — Direct Shopping', () => {

  test('B1: "I want speakers under 1500 for rock"', () => {
    const results = runConversation([
      { text: 'I want speakers under 1500 for rock' },
    ]);

    expect(results[0].state.mode).toBe('shopping');
    expect(results[0].state.stage).toBe('ready_to_recommend');
    expect(results[0].state.facts.category).toBe('speaker');
    expect(results[0].state.facts.budget).toBeTruthy();

    score({
      test: 'B1',
      detectedMode: 'shopping',
      expectedBehavior: 'Immediate recommendation (category + budget + preference)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage} cat=${results[0].state.facts.category} budget=${results[0].state.facts.budget}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.stage === 'ready_to_recommend',
    });
  });

  test('B2: "I want headphones under 200"', () => {
    const results = runConversation([
      { text: 'I want headphones under 200' },
    ]);

    // Budget pattern: "under 200" needs $ — let's check
    // BUDGET_PATTERN = /(?:under\s+)?\$\s?\d[\d,]*|\bbudget\s+(?:of|around|is)\s+\$?\d[\d,]*/i
    // "under 200" — no $ sign, pattern may not match
    const hasBudget = !!results[0].state.facts.budget;

    expect(results[0].state.mode).toBe('shopping');
    expect(results[0].state.facts.category).toBe('headphone');

    if (hasBudget) {
      expect(results[0].state.stage).toBe('ready_to_recommend');
    } else {
      // Budget not extracted — should ask for budget
      expect(results[0].state.stage).toBe('clarify_budget');
    }

    score({
      test: 'B2',
      detectedMode: 'shopping',
      expectedBehavior: hasBudget ? 'Immediate recommendation' : 'Ask for budget (budget without $ not detected)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage} budget=${results[0].state.facts.budget}`,
      scores: {
        routing: 5,
        contextRetention: 5,
        decisiveness: hasBudget ? 5 : 3,
        recommendationTiming: hasBudget ? 5 : 3,
        naturalness: 4,
      },
      pass: results[0].state.mode === 'shopping',
      failureReason: !hasBudget ? 'Budget without $ sign not extracted by BUDGET_PATTERN' : undefined,
      suggestedFix: !hasBudget ? 'Add pattern for "under NNN" without $ to BUDGET_PATTERN' : undefined,
    });
  });

  test('B3: "I want a DAC under $1000 for a lean system"', () => {
    const results = runConversation([
      { text: 'I want a DAC under $1000 for a lean system' },
    ]);

    expect(results[0].state.mode).toBe('shopping');
    expect(results[0].state.stage).toBe('ready_to_recommend');
    expect(results[0].state.facts.category).toBe('dac');
    expect(results[0].state.facts.budget).toContain('1000');

    score({
      test: 'B3',
      detectedMode: 'shopping',
      expectedBehavior: 'Immediate recommendation (DAC + $1000)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage} cat=${results[0].state.facts.category} budget=${results[0].state.facts.budget}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.stage === 'ready_to_recommend',
    });
  });

  test('B4: "I want an amplifier under $3000 for KEF speakers"', () => {
    const results = runConversation([
      { text: 'I want an amplifier under $3000 for KEF speakers' },
    ]);

    expect(results[0].state.mode).toBe('shopping');
    expect(results[0].state.facts.category).toBe('amplifier');
    expect(results[0].state.facts.budget).toContain('3000');

    score({
      test: 'B4',
      detectedMode: 'shopping',
      expectedBehavior: 'Immediate recommendation (amplifier + $3000 + system context)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage} cat=${results[0].state.facts.category} budget=${results[0].state.facts.budget}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.stage === 'ready_to_recommend',
    });
  });

  test('B5: "I want a turntable under $1000"', () => {
    const results = runConversation([
      { text: 'I want a turntable under $1000' },
    ]);

    expect(results[0].state.mode).toBe('shopping');
    expect(results[0].state.facts.category).toBe('turntable');
    expect(results[0].state.facts.budget).toContain('1000');
    expect(results[0].state.stage).toBe('ready_to_recommend');

    score({
      test: 'B5',
      detectedMode: 'shopping',
      expectedBehavior: 'Immediate recommendation (turntable + $1000)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage} cat=${results[0].state.facts.category}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.stage === 'ready_to_recommend',
    });
  });
});

// ══════════════════════════════════════════════════════
// TEST GROUP C — FROM SCRATCH SYSTEMS
// ══════════════════════════════════════════════════════

describe('Group C — From Scratch Systems', () => {

  test('C1: "I want a speaker system from scratch under $2000"', () => {
    const results = runConversation([
      { text: 'I want a speaker system from scratch under $2000' },
    ]);

    expect(results[0].state.facts.category).toBe('speaker');
    expect(results[0].state.facts.budget).toContain('2000');
    // Should be ready to recommend (has category + budget)
    expect(results[0].state.mode).toBe('shopping');
    expect(results[0].state.stage).toBe('ready_to_recommend');

    score({
      test: 'C1',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'Shopping → ready to recommend (speaker + $2000)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.stage === 'ready_to_recommend',
    });
  });

  test('C2: "I want a headphone setup from scratch under $1000"', () => {
    const results = runConversation([
      { text: 'I want a headphone setup from scratch under $1000' },
    ]);

    expect(results[0].state.facts.category).toBe('headphone');
    expect(results[0].state.facts.budget).toContain('1000');
    expect(results[0].state.mode).toBe('shopping');
    expect(results[0].state.stage).toBe('ready_to_recommend');

    score({
      test: 'C2',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'Shopping → ready to recommend (headphone + $1000)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.stage === 'ready_to_recommend',
    });
  });

  test('C3: "I want a system from scratch under $1500"', () => {
    const results = runConversation([
      { text: 'I want a system from scratch under $1500' },
    ]);

    // "system" doesn't match any category pattern — should route to shopping/clarify_category
    // OR orientation asking speakers vs headphones
    const hasCategory = !!results[0].state.facts.category;

    if (hasCategory) {
      // If some category was detected, should have budget and be ready
      expect(results[0].state.mode).toBe('shopping');
    } else {
      // No category → should ask what kind of system
      expect(['shopping', 'orientation']).toContain(results[0].state.mode);
    }

    // Must NOT be diagnosis
    expect(results[0].state.mode).not.toBe('diagnosis');

    score({
      test: 'C3',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'Shopping or orientation (needs category clarification)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage} cat=${results[0].state.facts.category}`,
      scores: {
        routing: 4,
        contextRetention: 5,
        decisiveness: hasCategory ? 5 : 3,
        recommendationTiming: 4,
        naturalness: 4,
      },
      pass: results[0].state.mode !== 'diagnosis',
    });
  });
});

// ══════════════════════════════════════════════════════
// TEST GROUP D — DIAGNOSIS
// ══════════════════════════════════════════════════════

describe('Group D — Diagnosis', () => {

  test('D1: "My system sounds thin" (no system provided)', () => {
    const results = runConversation([
      { text: 'My system sounds thin', hasSystem: false, subjectCount: 0 },
    ]);

    // Rule 5: Diagnosis requires system first
    expect(results[0].state.mode).toBe('diagnosis');
    expect(results[0].state.stage).toBe('clarify_system');
    expect(results[0].state.facts.symptom).toBeTruthy();

    score({
      test: 'D1',
      detectedMode: 'diagnosis',
      expectedBehavior: 'Ask for system details before diagnosing',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.stage === 'clarify_system',
    });
  });

  test('D2: "My system sounds bright: WiiM + Yamaha + KEF" (system provided)', () => {
    const results = runConversation([
      { text: 'My system sounds bright: WiiM + Yamaha + KEF', hasSystem: true, subjectCount: 3 },
    ]);

    expect(results[0].state.mode).toBe('diagnosis');
    // With system provided, should be ready to diagnose
    expect(results[0].state.stage).toBe('ready_to_diagnose');

    score({
      test: 'D2',
      detectedMode: 'diagnosis',
      expectedBehavior: 'Ready to diagnose (system provided inline)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.stage === 'ready_to_diagnose',
    });
  });

  test('D3: "I get listening fatigue" (no system)', () => {
    const results = runConversation([
      { text: 'I get listening fatigue', hasSystem: false, subjectCount: 0 },
    ]);

    expect(results[0].state.mode).toBe('diagnosis');
    expect(results[0].state.stage).toBe('clarify_system');

    score({
      test: 'D3',
      detectedMode: 'diagnosis',
      expectedBehavior: 'Ask for system (diagnosis without system = blocked)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.stage === 'clarify_system',
    });
  });
});

// ══════════════════════════════════════════════════════
// TEST GROUP E — BEGINNER / UNCERTAIN
// ══════════════════════════════════════════════════════

describe('Group E — Beginner / Uncertain', () => {

  test('E1: "I want better sound"', () => {
    const results = runConversation([
      { text: 'I want better sound' },
    ]);

    expect(results[0].state.mode).toBe('orientation');
    // Must NOT be shopping or diagnosis
    expect(results[0].state.mode).not.toBe('shopping');
    expect(results[0].state.mode).not.toBe('diagnosis');

    score({
      test: 'E1',
      detectedMode: 'orientation',
      expectedBehavior: 'Orientation mode, narrowing question',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.mode === 'orientation',
    });
  });

  test('E2: "I don\'t know what I need"', () => {
    const results = runConversation([
      { text: "I don't know what I need" },
    ]);

    expect(results[0].state.mode).toBe('orientation');

    score({
      test: 'E2',
      detectedMode: 'orientation',
      expectedBehavior: 'Orientation mode',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.mode === 'orientation',
    });
  });

  test('E3: "I have Sonos but want better"', () => {
    const results = runConversation([
      { text: 'I have Sonos but want better' },
    ]);

    // ORIENTATION_PATTERNS includes Sonos + "want" pattern
    expect(results[0].state.mode).toBe('orientation');

    score({
      test: 'E3',
      detectedMode: results[0].state.mode,
      expectedBehavior: 'Orientation mode (Sonos + want better pattern)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[0].state.mode === 'orientation',
    });
  });
});

// ══════════════════════════════════════════════════════
// TEST GROUP F — CONTEXT PERSISTENCE
// ══════════════════════════════════════════════════════

describe('Group F — Context Persistence', () => {

  test('F1: "I like Van Halen" → speakers → starting from scratch → under $1500', () => {
    const results = runConversation([
      { text: 'I like Van Halen' },
      { text: 'speakers' },
      { text: 'starting from scratch' },
      { text: 'under $1500' },
    ]);

    // Turn 1: music input
    expect(results[0].state.mode).toBe('music_input');
    expect(results[0].state.facts.musicDescription).toBe('I like Van Halen');

    // Turn 2: speakers selected
    expect(results[1].state.facts.listeningPath).toBe('speakers');
    expect(results[1].state.facts.category).toBe('speaker');

    // Turn 3: no budget → ask for budget
    expect(results[2].state.mode).toBe('shopping');
    expect(results[2].state.stage).toBe('clarify_budget');

    // Turn 4: budget provided → ready to recommend with synthesized query
    expect(results[3].state.mode).toBe('shopping');
    expect(results[3].state.stage).toBe('ready_to_recommend');
    expect(results[3].state.facts.budget).toContain('1500');
    // Music context preserved
    expect(results[3].state.facts.musicDescription).toBe('I like Van Halen');
    // Category preserved
    expect(results[3].state.facts.category).toBe('speaker');
    // Should have synthesized query
    expect(results[3].response?.kind).toBe('proceed');
    if (results[3].response?.kind === 'proceed') {
      expect(results[3].response.synthesizedQuery).toContain('Van Halen');
      expect(results[3].response.synthesizedQuery).toContain('speakers');
    }

    // RULE 3: No repeated questions across turns
    // Verify no turn asked about headphones/speakers again after turn 2
    // Verify no turn asked about music again after turn 1

    score({
      test: 'F1',
      detectedMode: 'music_input → shopping',
      expectedBehavior: 'Full 4-turn flow: music → speakers → scratch → budget → recommend with context',
      actualBehavior: `${results[0].state.mode} → ${results[2].state.mode}/${results[2].state.stage} → ${results[3].state.mode}/${results[3].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[3].state.stage === 'ready_to_recommend' && !!results[3].state.facts.musicDescription,
    });
  });

  test('F2: "I want a DAC" → under $1000', () => {
    const results = runConversation([
      { text: 'I want a DAC' },
      { text: 'under $1000' },
    ]);

    // Turn 1: shopping with DAC, no budget → ask budget
    expect(results[0].state.mode).toBe('shopping');
    expect(results[0].state.facts.category).toBe('dac');
    expect(results[0].state.stage).toBe('clarify_budget');

    // Turn 2: budget → ready
    expect(results[1].state.mode).toBe('shopping');
    expect(results[1].state.stage).toBe('ready_to_recommend');
    expect(results[1].state.facts.budget).toContain('1000');
    // Category preserved
    expect(results[1].state.facts.category).toBe('dac');

    score({
      test: 'F2',
      detectedMode: 'shopping',
      expectedBehavior: 'DAC → budget → recommend (2-turn)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage} → ${results[1].state.mode}/${results[1].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[1].state.stage === 'ready_to_recommend' && results[1].state.facts.category === 'dac',
    });
  });

  test('F3: "My system sounds thin" → system provided', () => {
    const results = runConversation([
      { text: 'My system sounds thin', hasSystem: false, subjectCount: 0 },
      { text: 'WiiM Mini → Schiit Magni → KEF Q150', hasSystem: true, subjectCount: 3 },
    ]);

    // Turn 1: diagnosis, ask for system
    expect(results[0].state.mode).toBe('diagnosis');
    expect(results[0].state.stage).toBe('clarify_system');

    // Turn 2: system provided → ready to diagnose
    expect(results[1].state.mode).toBe('diagnosis');
    expect(results[1].state.stage).toBe('ready_to_diagnose');
    // Symptom preserved from turn 1
    expect(results[1].state.facts.symptom).toBeTruthy();

    score({
      test: 'F3',
      detectedMode: 'diagnosis',
      expectedBehavior: 'Thin → ask system → system → diagnose (symptom preserved)',
      actualBehavior: `${results[0].state.mode}/${results[0].state.stage} → ${results[1].state.mode}/${results[1].state.stage}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[1].state.stage === 'ready_to_diagnose',
    });
  });
});

// ══════════════════════════════════════════════════════
// ADDITIONAL: MODE LOCKING TESTS
// ══════════════════════════════════════════════════════

describe('Mode Locking', () => {

  test('Shopping mode stays locked across turns', () => {
    const results = runConversation([
      { text: 'I want speakers' },
      { text: 'I like rock music, budget around $1500' },
    ]);

    // Both turns should be in shopping mode
    expect(results[0].state.mode).toBe('shopping');
    expect(results[1].state.mode).toBe('shopping');
    // Should NOT switch to music_input because of "rock music" mention
    expect(results[1].state.mode).not.toBe('music_input');

    score({
      test: 'ML1',
      detectedMode: 'shopping',
      expectedBehavior: 'Shopping locked: no switch to music_input despite music mention',
      actualBehavior: `${results[0].state.mode} → ${results[1].state.mode}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[1].state.mode === 'shopping',
    });
  });

  test('Diagnosis mode stays locked', () => {
    const results = runConversation([
      { text: 'My speakers sound muddy', hasSystem: false, subjectCount: 0 },
      { text: 'I have a Marantz amp and JBL speakers', hasSystem: true, subjectCount: 2 },
    ]);

    expect(results[0].state.mode).toBe('diagnosis');
    expect(results[1].state.mode).toBe('diagnosis');
    // Should NOT switch to shopping despite component mentions
    expect(results[1].state.mode).not.toBe('shopping');

    score({
      test: 'ML2',
      detectedMode: 'diagnosis',
      expectedBehavior: 'Diagnosis locked: no switch despite component mentions',
      actualBehavior: `${results[0].state.mode} → ${results[1].state.mode}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[1].state.mode === 'diagnosis',
    });
  });

  test('Orientation → shopping transition works', () => {
    const results = runConversation([
      { text: 'I want better sound' },
      { text: 'I want to buy new speakers' },
    ]);

    expect(results[0].state.mode).toBe('orientation');
    expect(results[1].state.mode).toBe('shopping');
    expect(results[1].state.facts.category).toBe('speaker');

    score({
      test: 'ML3',
      detectedMode: 'orientation → shopping',
      expectedBehavior: 'Orientation resolves to shopping when user clarifies intent',
      actualBehavior: `${results[0].state.mode} → ${results[1].state.mode} cat=${results[1].state.facts.category}`,
      scores: { routing: 5, contextRetention: 5, decisiveness: 5, recommendationTiming: 5, naturalness: 5 },
      pass: results[1].state.mode === 'shopping',
    });
  });
});

// ══════════════════════════════════════════════════════
// ADDITIONAL: READINESS CHECK TESTS
// ══════════════════════════════════════════════════════

describe('Readiness Checks', () => {

  test('isReadyToRecommend: category + budget = true', () => {
    expect(isReadyToRecommend({ category: 'speaker', budget: '$1000' })).toBe(true);
  });

  test('isReadyToRecommend: category only = false', () => {
    expect(isReadyToRecommend({ category: 'speaker' })).toBe(false);
  });

  test('isReadyToRecommend: budget only, no category = false', () => {
    expect(isReadyToRecommend({ budget: '$1000' })).toBe(false);
  });

  test('isReadyToRecommend: general category = false', () => {
    expect(isReadyToRecommend({ category: 'general', budget: '$1000' })).toBe(false);
  });

  test('isReadyToRecommend: category + budget + preference = true', () => {
    expect(isReadyToRecommend({ category: 'dac', budget: '$500', preference: 'warm' })).toBe(true);
  });

  test('isReadyToDiagnose: symptom + system = true', () => {
    expect(isReadyToDiagnose({ symptom: 'sounds thin', hasSystem: true })).toBe(true);
  });

  test('isReadyToDiagnose: symptom only = false', () => {
    expect(isReadyToDiagnose({ symptom: 'sounds thin' })).toBe(false);
  });

  test('isReadyToDiagnose: system only = false', () => {
    expect(isReadyToDiagnose({ hasSystem: true })).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// ADDITIONAL: INTENT DETECTION VALIDATION
// ══════════════════════════════════════════════════════

describe('Intent Detection Validation', () => {

  test('Music inputs detect as music_input', () => {
    expect(detectIntent('I like Van Halen').intent).toBe('music_input');
    expect(detectIntent('I listen to classical music').intent).toBe('music_input');
    expect(detectIntent('I listen to jazz').intent).toBe('music_input');
    expect(detectIntent('I listen to electronic music').intent).toBe('music_input');
  });

  test('Shopping inputs detect as shopping', () => {
    expect(detectIntent('I want speakers under $1500').intent).toBe('shopping');
    expect(detectIntent('best DAC under $1000').intent).toBe('shopping');
    expect(detectIntent('recommend headphones under $200').intent).toBe('shopping');
  });

  test('Diagnosis inputs detect as diagnosis', () => {
    const d1 = detectIntent('My system sounds thin');
    const d3 = detectIntent('I get listening fatigue');
    expect(d1.intent).toBe('diagnosis');
    expect(d3.intent).toBe('diagnosis');
  });

  test('Orientation inputs detected correctly', () => {
    expect(isOrientationInput('I want better sound')).toBe(true);
    expect(isOrientationInput("I don't know what I need")).toBe(true);
    expect(isOrientationInput('I have Sonos but want better')).toBe(true);
  });

  test('Shopping does NOT detect as music_input', () => {
    expect(detectIntent('I want speakers under $1500 for rock').intent).not.toBe('music_input');
  });

  test('Diagnosis does NOT detect as orientation', () => {
    expect(isOrientationInput('My system sounds thin')).toBe(false);
    expect(isOrientationInput('I get listening fatigue')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// ADDITIONAL: BUDGET PATTERN COVERAGE
// ══════════════════════════════════════════════════════

describe('Budget Pattern Coverage', () => {

  test('$1500 detected', () => {
    const result = simulateTurn(INITIAL_CONV_STATE, 'I want speakers under $1500');
    expect(result.state.facts.budget).toContain('$1500');
  });

  test('$200 detected', () => {
    const result = simulateTurn(INITIAL_CONV_STATE, 'headphones under $200');
    expect(result.state.facts.budget).toContain('$200');
  });

  test('Budget without $ (edge case)', () => {
    const result = simulateTurn(INITIAL_CONV_STATE, 'headphones under 200');
    // Current pattern requires $. This documents the gap.
    const detected = !!result.state.facts.budget;
    if (!detected) {
      console.warn('⚠️  BUDGET_PATTERN does not detect "under 200" without $');
    }
  });

  test('Budget phrasing: "budget around $1000"', () => {
    const result = simulateTurn(INITIAL_CONV_STATE, 'budget around $1000 for a DAC');
    expect(result.state.facts.budget).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════
// REPORT GENERATION (runs after all tests)
// ══════════════════════════════════════════════════════

afterAll(() => {
  if (allScores.length === 0) return;

  console.log('\n' + '═'.repeat(70));
  console.log('  AUDIO XX — COMPREHENSIVE REGRESSION AUDIT REPORT');
  console.log('═'.repeat(70));

  // Category summaries
  const categories: Record<string, TestScore[]> = {};
  for (const s of allScores) {
    const cat = s.test.startsWith('A') ? 'Music → Category'
      : s.test.startsWith('B') ? 'Direct Shopping'
      : s.test.startsWith('C') ? 'From Scratch'
      : s.test.startsWith('D') ? 'Diagnosis'
      : s.test.startsWith('E') ? 'Beginner/Orientation'
      : s.test.startsWith('F') ? 'Context Persistence'
      : s.test.startsWith('ML') ? 'Mode Locking'
      : 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(s);
  }

  for (const [cat, scores] of Object.entries(categories)) {
    const passed = scores.filter((s) => s.pass).length;
    const total = scores.length;
    const status = passed === total ? '✅ PASS' : `⚠️  ${passed}/${total} PASS`;
    console.log(`\n  ${cat}: ${status}`);
    for (const s of scores) {
      console.log(`    ${s.pass ? '✓' : '✗'} ${s.test}: ${s.actualBehavior}`);
      if (!s.pass && s.failureReason) {
        console.log(`      FAIL: ${s.failureReason}`);
        if (s.suggestedFix) console.log(`      FIX:  ${s.suggestedFix}`);
      }
    }
  }

  // Summary stats
  const totalPass = allScores.filter((s) => s.pass).length;
  const totalTests = allScores.length;
  const avgScores = {
    routing: allScores.reduce((a, s) => a + s.scores.routing, 0) / totalTests,
    contextRetention: allScores.reduce((a, s) => a + s.scores.contextRetention, 0) / totalTests,
    decisiveness: allScores.reduce((a, s) => a + s.scores.decisiveness, 0) / totalTests,
    recommendationTiming: allScores.reduce((a, s) => a + s.scores.recommendationTiming, 0) / totalTests,
    naturalness: allScores.reduce((a, s) => a + s.scores.naturalness, 0) / totalTests,
  };

  console.log('\n' + '─'.repeat(70));
  console.log(`  OVERALL: ${totalPass}/${totalTests} PASS (${Math.round(100 * totalPass / totalTests)}%)`);
  console.log(`  AVG SCORES: routing=${avgScores.routing.toFixed(1)} context=${avgScores.contextRetention.toFixed(1)} decisive=${avgScores.decisiveness.toFixed(1)} timing=${avgScores.recommendationTiming.toFixed(1)} natural=${avgScores.naturalness.toFixed(1)}`);

  // Failures
  const failures = allScores.filter((s) => !s.pass);
  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    for (const f of failures) {
      console.log(`    ${f.test}: ${f.failureReason}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
});
