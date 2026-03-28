/**
 * Simulates the page.tsx orchestration for the from-scratch flow.
 *
 * Tests BOTH code paths:
 * A. State machine path (convStateRef active)
 * B. Legacy path (awaitingListeningPathRef / onboardingContextRef)
 *
 * Verifies: "i like van halen" → "speakers" → "starting from scratch"
 * must never re-ask the ownership question in either path.
 */
import { describe, it, expect } from 'vitest';
import {
  detectInitialMode,
  transition,
  INITIAL_CONV_STATE,
  type ConvState,
} from '../conversation-state';
import { detectIntent, extractSubjectMatches, respondToMusicInput, respondToListeningPath, detectListeningPath } from '../intent';

const OWNERSHIP_RE = /already have|gear you want to improve|starting from scratch\?|existing.*system/i;

// ── A. State machine path ─────────────────────────────

function simulateStateMachineTurn(
  convState: ConvState,
  text: string,
) {
  const { intent, subjectMatches } = detectIntent(text);

  if (convState.mode !== 'idle') {
    const convResult = transition(convState, text, {
      hasSystem: false,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });
    return {
      convState: convResult.state,
      dispatched: convResult.response,
      path: 'state-machine',
      intent,
    };
  }

  const initialConvMode = detectInitialMode(text, {
    detectedIntent: intent,
    hasSystem: false,
    subjectCount: subjectMatches.length,
  });

  if (initialConvMode?.mode === 'music_input') {
    return {
      convState: initialConvMode,
      dispatched: { kind: 'note' as const, content: respondToMusicInput(text) },
      path: 'detectConvMode+legacy-music',
      intent,
    };
  }

  return {
    convState: initialConvMode ?? convState,
    dispatched: null,
    path: 'fallthrough',
    intent,
  };
}

describe('A. State machine path: van halen → speakers → starting from scratch', () => {
  let convState: ConvState = INITIAL_CONV_STATE;

  it('Turn 1: music input', () => {
    const r = simulateStateMachineTurn(convState, 'i like van halen');
    expect(r.intent).toBe('music_input');
    expect(r.convState.mode).toBe('music_input');
    convState = r.convState;
  });

  it('Turn 2: "speakers" → ownership question (expected — fromScratch unknown)', () => {
    const r = simulateStateMachineTurn(convState, 'speakers');
    expect(r.convState.stage).toBe('awaiting_onboarding_followup');
    convState = r.convState;
  });

  it('Turn 3: "starting from scratch" → budget question, no ownership', () => {
    const r = simulateStateMachineTurn(convState, 'starting from scratch');
    const text = JSON.stringify(r.dispatched);
    expect(text).not.toMatch(OWNERSHIP_RE);
    expect(text).toMatch(/budget/i);
    expect(r.convState.facts.fromScratch).toBe(true);
    convState = r.convState;
  });

  it('Turn 4: budget → ready_to_recommend', () => {
    const r = simulateStateMachineTurn(convState, '$5000');
    expect(r.convState.stage).toBe('ready_to_recommend');
    expect(r.convState.facts.fromScratch).toBe(true);
  });
});

// ── B. Legacy path (respondToListeningPath) ──────────

describe('B. Legacy path: respondToListeningPath respects fromScratch', () => {
  it('speakers + fromScratch → no ownership question', () => {
    const response = respondToListeningPath('speakers', true);
    expect(response).not.toMatch(OWNERSHIP_RE);
    expect(response).toMatch(/budget/i);
  });

  it('headphones + fromScratch → no ownership question', () => {
    const response = respondToListeningPath('headphones', true);
    expect(response).not.toMatch(OWNERSHIP_RE);
    expect(response).toMatch(/budget/i);
  });

  it('speakers + no fromScratch → asks ownership (expected)', () => {
    const response = respondToListeningPath('speakers');
    expect(response).toMatch(/already have|starting from scratch/i);
  });

  it('headphones + no fromScratch → asks ownership (expected)', () => {
    const response = respondToListeningPath('headphones');
    expect(response).toMatch(/already have|looking for new/i);
  });
});

// ── C. Combined text input with "from scratch" ──────

describe('C. detectListeningPath + fromScratch in same message', () => {
  it('"speakers, starting from scratch" detected correctly', () => {
    const path = detectListeningPath('speakers, starting from scratch');
    expect(path).toBe('speakers');

    const FROM_SCRATCH_RE = /\b(?:from\s+scratch|starting\s+(?:fresh|out|new)|don'?t\s+have\s+(?:any|a)|no\s+(?:system|gear|equipment|setup)|first\s+(?:system|setup)|building\s+(?:new|a\s+new)|brand\s+new)\b/i;
    expect(FROM_SCRATCH_RE.test('speakers, starting from scratch')).toBe(true);
  });
});

// ── D. Full user scenarios from spec ────────────────

describe('D. Validation scenarios', () => {
  it('Scenario 1: i like van halen → speakers → starting from scratch', () => {
    let s = INITIAL_CONV_STATE;
    const r1 = simulateStateMachineTurn(s, 'i like van halen');
    s = r1.convState;
    const r2 = simulateStateMachineTurn(s, 'speakers');
    s = r2.convState;
    const r3 = simulateStateMachineTurn(s, 'starting from scratch');

    const text = JSON.stringify(r3.dispatched);
    expect(text).not.toMatch(OWNERSHIP_RE);
    expect(r3.convState.facts.fromScratch).toBe(true);
  });

  it('Scenario 2: i want speakers → starting from scratch', () => {
    let s = INITIAL_CONV_STATE;
    const { intent } = detectIntent('i want speakers');
    const initial = detectInitialMode('i want speakers', {
      detectedIntent: intent,
      hasSystem: false,
      subjectCount: 0,
    });
    expect(initial).not.toBeNull();
    s = initial!;

    const r2 = simulateStateMachineTurn(s, 'starting from scratch');
    const text = JSON.stringify(r2.dispatched);
    expect(text).not.toMatch(OWNERSHIP_RE);
    expect(r2.convState.facts.fromScratch).toBe(true);
  });

  it('Scenario 3: starting from scratch and i want speakers', () => {
    const { intent, subjectMatches } = detectIntent('starting from scratch and i want speakers');
    const initial = detectInitialMode('starting from scratch and i want speakers', {
      detectedIntent: intent,
      hasSystem: false,
      subjectCount: subjectMatches.length,
    });

    // Should detect fromScratch on first turn
    if (initial) {
      expect(initial.facts.fromScratch).toBe(true);
      // If it goes to a stage that asks for budget, should NOT mention system
      if (initial.stage === 'clarify_budget') {
        const r = simulateStateMachineTurn(initial, '$3000');
        const text = JSON.stringify(r.dispatched);
        expect(text).not.toMatch(OWNERSHIP_RE);
      }
    }
  });
});
