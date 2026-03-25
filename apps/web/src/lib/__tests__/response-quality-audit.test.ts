/**
 * Audio XX — Response Quality Audit
 *
 * Evaluates the ACTUAL TEXT users see at each conversation stage.
 * Tests the state machine routing + response generation to verify
 * responses are helpful, clear, decisive, and natural.
 *
 * Each test simulates a multi-turn flow and checks the exact response
 * text for quality signals.
 */

import {
  type ConvState,
  type ConvTransition,
  INITIAL_CONV_STATE,
  transition,
  detectInitialMode,
} from '../conversation-state';
import { detectIntent, respondToMusicInput, respondToListeningPath } from '../intent';

// ── Helpers ──────────────────────────────────────────

interface ResponseEval {
  text: string;
  wordCount: number;
  hasAcknowledge: boolean;
  hasQuestion: boolean;
  hasSynthesizedQuery: boolean;
  responseKind: string;
}

function simulateTurnResponse(
  state: ConvState,
  text: string,
  overrides?: { hasSystem?: boolean; subjectCount?: number },
): { nextState: ConvState; response: ResponseEval; raw: ConvTransition } {
  const intentResult = detectIntent(text);
  const hasSystem = overrides?.hasSystem ?? false;
  const subjectCount = overrides?.subjectCount ?? (intentResult.subjects?.length ?? 0);

  let result: ConvTransition;

  if (state.mode === 'idle') {
    const initial = detectInitialMode(text, {
      detectedIntent: intentResult.intent,
      hasSystem,
      subjectCount,
    });
    if (initial) {
      if (initial.mode === 'system_assessment' && initial.stage === 'entry') {
        result = transition(initial, text, { hasSystem, subjectCount, detectedIntent: intentResult.intent });
      } else if (initial.mode === 'music_input') {
        // Music input: the actual response comes from respondToMusicInput
        const musicResponse = respondToMusicInput(text);
        return {
          nextState: initial,
          response: {
            text: musicResponse,
            wordCount: musicResponse.split(/\s+/).length,
            hasAcknowledge: musicResponse.startsWith('Got it'),
            hasQuestion: musicResponse.includes('?'),
            hasSynthesizedQuery: false,
            responseKind: 'note',
          },
          raw: { state: initial, response: null },
        };
      } else {
        result = { state: initial, response: null };
      }
    } else {
      result = { state: INITIAL_CONV_STATE, response: null };
    }
  } else {
    result = transition(state, text, {
      hasSystem: overrides?.hasSystem ?? state.facts.hasSystem ?? false,
      subjectCount: overrides?.subjectCount ?? (intentResult.subjects?.length ?? 0),
      detectedIntent: intentResult.intent,
    });
  }

  // Handle music_input special responses
  if (result.state.mode === 'music_input' && result.state.stage === 'awaiting_listening_path') {
    const musicResponse = respondToMusicInput(text);
    return {
      nextState: result.state,
      response: {
        text: musicResponse,
        wordCount: musicResponse.split(/\s+/).length,
        hasAcknowledge: musicResponse.startsWith('Got it'),
        hasQuestion: musicResponse.includes('?'),
        hasSynthesizedQuery: false,
        responseKind: 'note',
      },
      raw: result,
    };
  }

  // Build response text from ConvResponse
  let responseText = '';
  let responseKind = 'none';
  if (result.response) {
    if (result.response.kind === 'question') {
      responseText = `${result.response.acknowledge}\n\n${result.response.question}`;
      responseKind = 'question';
    } else if (result.response.kind === 'note') {
      responseText = result.response.content;
      responseKind = 'note';
    } else if (result.response.kind === 'proceed') {
      responseText = result.response.synthesizedQuery ?? '[PROCEED TO PIPELINE]';
      responseKind = 'proceed';
    }
  }

  return {
    nextState: result.state,
    response: {
      text: responseText,
      wordCount: responseText.split(/\s+/).length,
      hasAcknowledge: /^got it|^great|^no problem|^sure/i.test(responseText),
      hasQuestion: responseText.includes('?'),
      hasSynthesizedQuery: result.response?.kind === 'proceed' && !!result.response.synthesizedQuery,
      responseKind,
    },
    raw: result,
  };
}

// ── Scoring ──────────────────────────────────────────

interface QualityScore {
  test: string;
  turn: number;
  userInput: string;
  responseText: string;
  responseKind: string;
  wordCount: number;
  usefulness: number;
  clarity: number;
  decisiveness: number;
  naturalness: number;
  issues: string[];
}

const allScores: QualityScore[] = [];

function evaluate(
  test: string,
  turn: number,
  userInput: string,
  resp: ResponseEval,
): QualityScore {
  const issues: string[] = [];
  let usefulness = 5;
  let clarity = 5;
  let decisiveness = 5;
  let naturalness = 5;

  // ── Generic/vague checks ──
  if (/balanced presentation|audio preferences|trait summar/i.test(resp.text)) {
    issues.push('Contains generic preference/trait language');
    usefulness -= 2;
    decisiveness -= 2;
  }

  // ── Too long for a clarification ──
  if (resp.responseKind === 'question' && resp.wordCount > 40) {
    issues.push(`Question response too long (${resp.wordCount} words)`);
    clarity -= 1;
    naturalness -= 1;
  }

  // ── No acknowledgment ──
  if (resp.responseKind === 'question' && !resp.hasAcknowledge) {
    issues.push('Missing acknowledgment before question');
    naturalness -= 1;
  }

  // ── No question when one is needed ──
  if (resp.responseKind === 'question' && !resp.hasQuestion) {
    issues.push('Marked as question but has no question mark');
    clarity -= 1;
  }

  // ── Empty or no response ──
  if (resp.text === '' && resp.responseKind !== 'proceed') {
    issues.push('Empty response (no text shown to user)');
    usefulness -= 3;
    clarity -= 3;
  }

  // ── System-generated feel ──
  if (/\b(processing|analyzing|computing|evaluating your)\b/i.test(resp.text)) {
    issues.push('Sounds system-generated, not human');
    naturalness -= 2;
  }

  // ── Redundant repetition of user's words ──
  if (resp.text.toLowerCase().includes(userInput.toLowerCase()) && resp.wordCount < 15) {
    // Just echo — not helpful
    issues.push('Response mostly echoes user input');
    usefulness -= 1;
  }

  // ── Moves toward a decision? ──
  if (resp.responseKind === 'question' && resp.hasQuestion) {
    // Good — asking for specific next info
    if (/budget|price|system|component|headphone|speaker/i.test(resp.text)) {
      // Asking about concrete details — good
    } else if (/tell me more|what are you looking for|what do you want/i.test(resp.text)) {
      issues.push('Question is too open-ended / not narrowing');
      decisiveness -= 1;
    }
  }

  // ── Music response quality ──
  if (resp.responseKind === 'note' && /Are you listening on/i.test(resp.text)) {
    // Music response — check if it characterizes the genre
    if (/energetic|warm|nuanced|atmospheric|layered|bass|rhythm|vocal/i.test(resp.text)) {
      // Good — shows understanding of the music
    } else if (/all kinds of music/i.test(resp.text)) {
      issues.push('Music response is generic fallback');
      usefulness -= 1;
      naturalness -= 1;
    }
  }

  // ── Proceed with synthesized query quality ──
  if (resp.hasSynthesizedQuery) {
    const q = resp.text;
    if (!/listen|music|looking for/i.test(q)) {
      issues.push('Synthesized query missing context');
      usefulness -= 1;
    }
  }

  const score: QualityScore = {
    test, turn, userInput,
    responseText: resp.text.substring(0, 120) + (resp.text.length > 120 ? '...' : ''),
    responseKind: resp.responseKind,
    wordCount: resp.wordCount,
    usefulness: Math.max(1, usefulness),
    clarity: Math.max(1, clarity),
    decisiveness: Math.max(1, decisiveness),
    naturalness: Math.max(1, naturalness),
    issues,
  };
  allScores.push(score);
  return score;
}

// ══════════════════════════════════════════════════════
// GROUP A — MUSIC → CATEGORY FLOWS
// ══════════════════════════════════════════════════════

describe('Response Quality: Group A — Music → Category', () => {

  test('A1: "I like Van Halen" → speakers → starting from scratch → $1500', () => {
    let state: ConvState = { ...INITIAL_CONV_STATE };

    // Turn 1: "I like Van Halen"
    const t1 = simulateTurnResponse(state, 'I like Van Halen');
    const s1 = evaluate('A1', 1, 'I like Van Halen', t1.response);
    expect(s1.naturalness).toBeGreaterThanOrEqual(4);
    expect(t1.response.text).toMatch(/energetic|hard-hitting/i);
    expect(t1.response.text).toMatch(/headphones.*speakers|speakers.*headphones/i);
    state = t1.nextState;

    // Turn 2: "speakers"
    const t2 = simulateTurnResponse(state, 'speakers');
    const s2 = evaluate('A1', 2, 'speakers', t2.response);
    expect(t2.response.text).toMatch(/speaker|gear|improve|scratch/i);
    state = t2.nextState;

    // Turn 3: "starting from scratch"
    const t3 = simulateTurnResponse(state, 'starting from scratch');
    const s3 = evaluate('A1', 3, 'starting from scratch', t3.response);
    expect(s3.decisiveness).toBeGreaterThanOrEqual(4);
    expect(t3.response.text).toMatch(/budget/i);
    // Should NOT contain generic preference language
    expect(t3.response.text).not.toMatch(/audio preferences|balanced presentation|trait/i);
    state = t3.nextState;

    // Turn 4: "under $1500"
    const t4 = simulateTurnResponse(state, 'under $1500');
    const s4 = evaluate('A1', 4, 'under $1500', t4.response);
    expect(t4.response.hasSynthesizedQuery).toBe(true);
    expect(t4.response.text).toMatch(/Van Halen/i);
    expect(t4.response.text).toMatch(/speakers/i);
  });

  test('A2: "I listen to classical music" → speakers', () => {
    let state: ConvState = { ...INITIAL_CONV_STATE };

    const t1 = simulateTurnResponse(state, 'I listen to classical music');
    const s1 = evaluate('A2', 1, 'I listen to classical music', t1.response);
    expect(t1.response.text).toMatch(/refined|nuanced|detail|delicate|orchestral|dynamic/i);
    expect(s1.naturalness).toBeGreaterThanOrEqual(4);
    state = t1.nextState;

    const t2 = simulateTurnResponse(state, 'speakers');
    const s2 = evaluate('A2', 2, 'speakers', t2.response);
    expect(t2.response.text).toMatch(/speaker|gear|scratch/i);
    expect(s2.clarity).toBeGreaterThanOrEqual(4);
  });

  test('A3: "I listen to opera" → headphones', () => {
    let state: ConvState = { ...INITIAL_CONV_STATE };

    const t1 = simulateTurnResponse(state, 'I listen to opera');
    const s1 = evaluate('A3', 1, 'I listen to opera', t1.response);
    // Opera should get a meaningful characterization
    expect(s1.usefulness).toBeGreaterThanOrEqual(3);
    state = t1.nextState;

    const t2 = simulateTurnResponse(state, 'headphones');
    const s2 = evaluate('A3', 2, 'headphones', t2.response);
    expect(t2.response.text).toMatch(/headphone/i);
  });

  test('A5: "I like Irish music" → speakers', () => {
    let state: ConvState = { ...INITIAL_CONV_STATE };

    const t1 = simulateTurnResponse(state, 'I like Irish music');
    const s1 = evaluate('A5', 1, 'I like Irish music', t1.response);
    // Irish music likely hits fallback — check if it's too generic
    state = t1.nextState;

    const t2 = simulateTurnResponse(state, 'speakers');
    evaluate('A5', 2, 'speakers', t2.response);
  });

  test('A6: "I listen to Algerian music"', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I listen to Algerian music');
    const s1 = evaluate('A6', 1, 'I listen to Algerian music', t1.response);
    // Will be fallback — check naturalness
    expect(s1.naturalness).toBeGreaterThanOrEqual(3);
  });

  test('A7: "I listen to electronic music"', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I listen to electronic music');
    const s1 = evaluate('A7', 1, 'I listen to electronic music', t1.response);
    expect(t1.response.text).toMatch(/bass|rhythm|electronic/i);
    expect(s1.naturalness).toBeGreaterThanOrEqual(4);
  });

  test('A8: "I listen to everything"', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I listen to everything');
    const s1 = evaluate('A8', 1, 'I listen to everything', t1.response);
    // Should handle gracefully, not be confused
    expect(s1.clarity).toBeGreaterThanOrEqual(3);
  });
});

// ══════════════════════════════════════════════════════
// GROUP B — DIRECT SHOPPING
// ══════════════════════════════════════════════════════

describe('Response Quality: Group B — Direct Shopping', () => {

  test('B1: "I want speakers under $1500 for rock" → immediate proceed', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I want speakers under $1500 for rock');
    const s1 = evaluate('B1', 1, 'I want speakers under $1500 for rock', t1.response);
    // Should proceed immediately, no unnecessary questions
    expect(t1.nextState.stage).toBe('ready_to_recommend');
    expect(s1.decisiveness).toBeGreaterThanOrEqual(4);
  });

  test('B2: "I want headphones under $200" → immediate proceed', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I want headphones under $200');
    evaluate('B2', 1, 'I want headphones under $200', t1.response);
    expect(t1.nextState.stage).toBe('ready_to_recommend');
  });

  test('B3: "I want a DAC under $1000 for a lean system" → immediate proceed', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I want a DAC under $1000 for a lean system');
    evaluate('B3', 1, 'I want a DAC under $1000 for a lean system', t1.response);
    expect(t1.nextState.stage).toBe('ready_to_recommend');
  });

  test('B4: "I want an amplifier under $3000 for KEF speakers" → immediate proceed', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I want an amplifier under $3000 for KEF speakers');
    evaluate('B4', 1, 'I want an amplifier under $3000 for KEF speakers', t1.response);
    expect(t1.nextState.stage).toBe('ready_to_recommend');
  });

  test('B5: "I want a turntable under $1000" → immediate proceed', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I want a turntable under $1000');
    evaluate('B5', 1, 'I want a turntable under $1000', t1.response);
    expect(t1.nextState.stage).toBe('ready_to_recommend');
  });
});

// ══════════════════════════════════════════════════════
// GROUP D — DIAGNOSIS
// ══════════════════════════════════════════════════════

describe('Response Quality: Group D — Diagnosis', () => {

  test('D1: "My system sounds thin" → proceed to diagnose (opportunistic)', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'My system sounds thin', { hasSystem: false, subjectCount: 0 });
    evaluate('D1', 1, 'My system sounds thin', t1.response);
    // Opportunistic diagnosis: symptom alone proceeds to ready_to_diagnose
    // No clarification text — actual diagnosis happens in page.tsx pipeline
    expect(t1.nextState.mode).toBe('diagnosis');
    expect(t1.nextState.stage).toBe('ready_to_diagnose');
  });

  test('D3: "I get listening fatigue" → proceed to diagnose (opportunistic)', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I get listening fatigue', { hasSystem: false, subjectCount: 0 });
    evaluate('D3', 1, 'I get listening fatigue', t1.response);
    // Opportunistic diagnosis: symptom alone proceeds to ready_to_diagnose
    expect(t1.nextState.mode).toBe('diagnosis');
    expect(t1.nextState.stage).toBe('ready_to_diagnose');
  });
});

// ══════════════════════════════════════════════════════
// GROUP E — BEGINNER / UNCERTAIN
// ══════════════════════════════════════════════════════

describe('Response Quality: Group E — Beginner/Uncertain', () => {

  test('E1: "I want better sound" → orientation question', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I want better sound');
    const s1 = evaluate('E1', 1, 'I want better sound', t1.response);
    // Orientation — should NOT immediately route to idle pipeline
    // The state machine sets mode=orientation but response is null (handled by page.tsx)
    // This is fine — page.tsx will generate the orientation question
    expect(t1.nextState.mode).toBe('orientation');
  });

  test('E2: "I don\'t know what I need" → orientation', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, "I don't know what I need");
    evaluate('E2', 1, "I don't know what I need", t1.response);
    expect(t1.nextState.mode).toBe('orientation');
  });

  test('E3: "I have Sonos but want better" → orientation', () => {
    const t1 = simulateTurnResponse(INITIAL_CONV_STATE, 'I have Sonos but want better');
    evaluate('E3', 1, 'I have Sonos but want better', t1.response);
    expect(t1.nextState.mode).toBe('orientation');
  });
});

// ══════════════════════════════════════════════════════
// GROUP F — FULL FLOW RESPONSE QUALITY
// ══════════════════════════════════════════════════════

describe('Response Quality: Group F — Full Flow', () => {

  test('F1: Van Halen → speakers → scratch → $1500', () => {
    let state: ConvState = { ...INITIAL_CONV_STATE };

    const t1 = simulateTurnResponse(state, 'I like Van Halen');
    evaluate('F1', 1, 'I like Van Halen', t1.response);
    state = t1.nextState;

    const t2 = simulateTurnResponse(state, 'speakers');
    evaluate('F1', 2, 'speakers', t2.response);
    state = t2.nextState;

    const t3 = simulateTurnResponse(state, 'starting from scratch');
    const s3 = evaluate('F1', 3, 'starting from scratch', t3.response);
    // The acknowledge should feel warm and natural
    expect(t3.response.text).toMatch(/budget/i);
    expect(s3.naturalness).toBeGreaterThanOrEqual(4);
    state = t3.nextState;

    const t4 = simulateTurnResponse(state, 'under $1500');
    const s4 = evaluate('F1', 4, 'under $1500', t4.response);
    expect(t4.response.hasSynthesizedQuery).toBe(true);
    // Synthesized query should carry full context
    expect(t4.response.text).toMatch(/Van Halen|speakers|1500/i);
  });

  test('F2: DAC → $1000', () => {
    let state: ConvState = { ...INITIAL_CONV_STATE };

    const t1 = simulateTurnResponse(state, 'I want a DAC');
    evaluate('F2', 1, 'I want a DAC', t1.response);
    // Shopping initial mode routes to shopping — actual budget question comes from page.tsx pipeline
    expect(t1.nextState.mode).toBe('shopping');
    expect(t1.nextState.facts.category).toBe('dac');
    state = t1.nextState;

    const t2 = simulateTurnResponse(state, 'under $1000');
    evaluate('F2', 2, 'under $1000', t2.response);
    expect(t2.nextState.stage).toBe('ready_to_recommend');
  });

  test('F3: "My system sounds thin" → WiiM + Schiit + KEF', () => {
    let state: ConvState = { ...INITIAL_CONV_STATE };

    const t1 = simulateTurnResponse(state, 'My system sounds thin', { hasSystem: false, subjectCount: 0 });
    evaluate('F3', 1, 'My system sounds thin', t1.response);
    // Opportunistic diagnosis: proceeds immediately, actual diagnosis in page.tsx
    expect(t1.nextState.mode).toBe('diagnosis');
    expect(t1.nextState.stage).toBe('ready_to_diagnose');
    state = t1.nextState;

    const t2 = simulateTurnResponse(state, 'WiiM Mini → Schiit Magni → KEF Q150', { hasSystem: true, subjectCount: 3 });
    evaluate('F3', 2, 'WiiM Mini → Schiit Magni → KEF Q150', t2.response);
    expect(t2.nextState.stage).toBe('ready_to_diagnose');
    expect(t2.nextState.facts.hasSystem).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// RESPONSE TEXT QUALITY — SPECIFIC CHECKS
// ══════════════════════════════════════════════════════

describe('Response Text Quality Checks', () => {

  test('Music responses characterize the genre, not just echo', () => {
    const genres = [
      { input: 'I listen to jazz', expect: /warm|nuanced|texture|space|acoustic/i },
      { input: 'I like Van Halen', expect: /energetic|hard-hitting|driving/i },
      { input: 'I listen to classical music', expect: /refined|nuanced|dynamic|delicate|orchestral/i },
      { input: 'I listen to electronic music', expect: /bass|rhythm|electronic/i },
      { input: 'I listen to hip hop', expect: /bass|rhythm/i },
    ];

    for (const g of genres) {
      const resp = respondToMusicInput(g.input);
      expect(resp).toMatch(g.expect);
      // Should not be longer than ~20 words
      expect(resp.split(/\s+/).length).toBeLessThan(25);
      // Should end with a question about listening path
      expect(resp).toMatch(/headphones.*speakers|speakers.*headphones/i);
    }
  });

  test('Listening path responses are specific and short', () => {
    const hp = respondToListeningPath('headphones');
    expect(hp).toMatch(/headphone/i);
    expect(hp.split(/\s+/).length).toBeLessThan(20);
    expect(hp).toMatch(/\?/);

    const sp = respondToListeningPath('speakers');
    expect(sp).toMatch(/speaker|gear/i);
    expect(sp.split(/\s+/).length).toBeLessThan(25);
    expect(sp).toMatch(/\?/);

    const unk = respondToListeningPath('unknown');
    expect(unk).toMatch(/headphones.*speakers|speakers.*headphones/i);
    expect(unk).toMatch(/\?/);
  });

  test('Shopping clarification questions are concrete, not vague', () => {
    // Shopping mode, clarify_budget
    const state: ConvState = { mode: 'shopping', stage: 'clarify_budget', facts: { category: 'speaker' } };
    const result = transition(state, 'I like warm sound', { hasSystem: false, subjectCount: 0, detectedIntent: 'shopping' });
    if (result.response?.kind === 'question') {
      expect(result.response.question).toMatch(/budget/i);
      expect(result.response.question.split(/\s+/).length).toBeLessThan(20);
    }
  });

  test('Diagnosis system request is clear and specific', () => {
    const state: ConvState = { mode: 'diagnosis', stage: 'clarify_system', facts: { symptom: 'sounds thin' } };
    const result = transition(state, 'WiiM Mini, Schiit Magni, KEF Q150', { hasSystem: true, subjectCount: 3, detectedIntent: 'diagnosis' });
    expect(result.state.stage).toBe('ready_to_diagnose');
    // Symptom should be preserved
    expect(result.state.facts.symptom).toBeTruthy();
  });

  test('Orientation follow-up questions are simple, not academic', () => {
    // After orientation entry, user says "buy new"
    const state: ConvState = { mode: 'orientation', stage: 'entry', facts: {} };
    const result = transition(state, 'I want to buy something new', { hasSystem: false, subjectCount: 0, detectedIntent: 'shopping' });
    if (result.response?.kind === 'question') {
      const q = result.response.question;
      expect(q.split(/\s+/).length).toBeLessThan(25);
      expect(q).not.toMatch(/psychoacoustic|topology|feedback|distortion/i);
      expect(q).toMatch(/speaker|headphone|DAC|amplifier|turntable|component|looking for/i);
    }
  });

  test('No response contains generic preference language', () => {
    const testCases = [
      { state: { mode: 'shopping' as const, stage: 'clarify_budget' as const, facts: { category: 'speaker' } }, input: '$1000' },
      { state: { mode: 'shopping' as const, stage: 'clarify_category' as const, facts: {} }, input: 'speakers' },
      { state: { mode: 'diagnosis' as const, stage: 'clarify_system' as const, facts: { symptom: 'bright' } }, input: 'I have a Topping DAC and Schiit amp' },
    ];

    for (const tc of testCases) {
      const result = transition(
        { ...tc.state, facts: { ...tc.state.facts } } as ConvState,
        tc.input,
        { hasSystem: false, subjectCount: 0, detectedIntent: 'shopping' },
      );
      if (result.response && (result.response.kind === 'question' || result.response.kind === 'note')) {
        const text = result.response.kind === 'question'
          ? `${result.response.acknowledge} ${result.response.question}`
          : result.response.content;
        expect(text).not.toMatch(/audio preferences/i);
        expect(text).not.toMatch(/balanced presentation/i);
        expect(text).not.toMatch(/trait summar/i);
      }
    }
  });
});

// ══════════════════════════════════════════════════════
// REPORT GENERATION
// ══════════════════════════════════════════════════════

afterAll(() => {
  if (allScores.length === 0) return;

  console.log('\n' + '═'.repeat(70));
  console.log('  AUDIO XX — RESPONSE QUALITY AUDIT');
  console.log('═'.repeat(70));

  // Group by test
  const byTest: Record<string, QualityScore[]> = {};
  for (const s of allScores) {
    if (!byTest[s.test]) byTest[s.test] = [];
    byTest[s.test].push(s);
  }

  for (const [test, scores] of Object.entries(byTest)) {
    console.log(`\n  ── ${test} ──`);
    for (const s of scores) {
      const avg = ((s.usefulness + s.clarity + s.decisiveness + s.naturalness) / 4).toFixed(1);
      console.log(`    Turn ${s.turn}: [${s.responseKind}] ${avg}/5.0 — "${s.responseText.substring(0, 80)}${s.responseText.length > 80 ? '...' : ''}"`);
      if (s.issues.length > 0) {
        for (const issue of s.issues) {
          console.log(`      ⚠️  ${issue}`);
        }
      }
    }
  }

  // Summary stats
  const total = allScores.length;
  const avg = {
    usefulness: allScores.reduce((a, s) => a + s.usefulness, 0) / total,
    clarity: allScores.reduce((a, s) => a + s.clarity, 0) / total,
    decisiveness: allScores.reduce((a, s) => a + s.decisiveness, 0) / total,
    naturalness: allScores.reduce((a, s) => a + s.naturalness, 0) / total,
  };

  console.log('\n' + '─'.repeat(70));
  console.log(`  RESPONSE QUALITY AVERAGES (${total} responses evaluated):`);
  console.log(`    Usefulness:    ${avg.usefulness.toFixed(1)}/5`);
  console.log(`    Clarity:       ${avg.clarity.toFixed(1)}/5`);
  console.log(`    Decisiveness:  ${avg.decisiveness.toFixed(1)}/5`);
  console.log(`    Naturalness:   ${avg.naturalness.toFixed(1)}/5`);

  // Issues summary
  const allIssues = allScores.flatMap((s) => s.issues);
  if (allIssues.length > 0) {
    const issueCounts: Record<string, number> = {};
    for (const i of allIssues) {
      issueCounts[i] = (issueCounts[i] || 0) + 1;
    }
    console.log('\n  ISSUES FOUND:');
    for (const [issue, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${count}x — ${issue}`);
    }
  } else {
    console.log('\n  ✅ No quality issues detected');
  }

  // Responses that feel generic
  const generic = allScores.filter((s) => s.issues.some((i) => /generic|fallback|echo/i.test(i)));
  if (generic.length > 0) {
    console.log('\n  GENERIC RESPONSES:');
    for (const g of generic) {
      console.log(`    ${g.test} T${g.turn}: "${g.responseText.substring(0, 60)}..." — ${g.issues.join('; ')}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
});
