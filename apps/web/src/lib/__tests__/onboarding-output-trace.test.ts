/**
 * Output trace: prints exact user-facing text for the from-scratch
 * onboarding flow across all categories and budget variants.
 */

import { describe, it, expect } from 'vitest';
import {
  type ConvState,
  INITIAL_CONV_STATE,
  transition,
  detectInitialMode,
} from '../conversation-state';
import { detectIntent, respondToMusicInput, respondToListeningPath, detectListeningPath } from '../intent';
import { detectShoppingIntent, buildShoppingAnswer, getStatedGaps, getShoppingClarification } from '../shopping-intent';
import type { ExtractedSignals } from '../signal-types';

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

function start(text: string): ConvState {
  const { intent } = detectIntent(text);
  return detectInitialMode(text, { detectedIntent: intent, hasSystem: false, subjectCount: 0 })!;
}

function next(state: ConvState, text: string) {
  const { intent } = detectIntent(text);
  return transition(state, text, { hasSystem: false, subjectCount: 0, detectedIntent: intent });
}

function responseText(result: ReturnType<typeof next>): string {
  if (!result.response) return '[null — falls through to pipeline]';
  if (result.response.kind === 'question') {
    return `${result.response.acknowledge}\n${result.response.question}`;
  }
  if (result.response.kind === 'note') {
    return result.response.content;
  }
  if (result.response.kind === 'proceed') {
    return result.response.synthesizedQuery
      ? `[PROCEED → shopping pipeline]\nSynthesized query: "${result.response.synthesizedQuery}"`
      : '[PROCEED → shopping pipeline, no synthesized query]';
  }
  return '[unknown response]';
}

describe('Output trace: speaker from-scratch flow', () => {
  it('prints full flow for speakers + all budget variants', () => {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  SPEAKER FROM-SCRATCH FLOW');
    console.log('══════════════════════════════════════════════════════\n');

    // Turn 1
    const musicResp = respondToMusicInput('i like van halen');
    console.log('USER: i like van halen');
    console.log(`SYSTEM: ${musicResp}`);
    const s1 = start('i like van halen');
    console.log(`  [state: ${s1.mode}/${s1.stage}]\n`);

    // Turn 2
    const t2 = next(s1, 'speakers');
    console.log('USER: speakers');
    console.log(`SYSTEM: ${responseText(t2)}`);
    console.log(`  [state: ${t2.state.mode}/${t2.state.stage}]\n`);

    // Turn 3
    const t3 = next(t2.state, 'starting from scratch');
    console.log('USER: starting from scratch');
    console.log(`SYSTEM: ${responseText(t3)}`);
    console.log(`  [state: ${t3.state.mode}/${t3.state.stage}, fromScratch: ${t3.state.facts.fromScratch}]\n`);

    // Turn 4 variants
    for (const budget of ['$5000', '5000', 'budget is 5000']) {
      const t4 = next(t3.state, budget);
      console.log(`USER: ${budget}`);
      console.log(`SYSTEM: ${responseText(t4)}`);
      console.log(`  [state: ${t4.state.mode}/${t4.state.stage}, budget: ${t4.state.facts.budget}]`);

      // Check downstream: does the synthesized query trigger build-a-system?
      if (t4.response?.kind === 'proceed' && t4.response.synthesizedQuery) {
        const ctx = detectShoppingIntent(t4.response.synthesizedQuery, EMPTY_SIGNALS, undefined);
        const gaps = getStatedGaps(ctx, EMPTY_SIGNALS);
        const clarification = getShoppingClarification(ctx, EMPTY_SIGNALS, 1, true);
        console.log(`  [shopping mode: ${ctx.mode}, gaps: [${gaps.join(', ')}], clarification: ${clarification ?? 'none'}]`);
      }
      console.log('');
    }

    console.log('══════════════════════════════════════════════════════\n');
    expect(true).toBe(true);
  });
});

describe('Output trace: headphones from-scratch flow', () => {
  it('prints full flow for headphones', () => {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  HEADPHONES FROM-SCRATCH FLOW');
    console.log('══════════════════════════════════════════════════════\n');

    const musicResp = respondToMusicInput('i listen to jazz');
    console.log('USER: i listen to jazz');
    console.log(`SYSTEM: ${musicResp}`);
    const s1 = start('i listen to jazz');
    console.log(`  [state: ${s1.mode}/${s1.stage}]\n`);

    const t2 = next(s1, 'headphones');
    console.log('USER: headphones');
    console.log(`SYSTEM: ${responseText(t2)}`);
    console.log(`  [state: ${t2.state.mode}/${t2.state.stage}]\n`);

    const t3 = next(t2.state, "don't have any");
    console.log("USER: don't have any");
    console.log(`SYSTEM: ${responseText(t3)}`);
    console.log(`  [state: ${t3.state.mode}/${t3.state.stage}, fromScratch: ${t3.state.facts.fromScratch}]\n`);

    const t4 = next(t3.state, '500');
    console.log('USER: 500');
    console.log(`SYSTEM: ${responseText(t4)}`);
    console.log(`  [state: ${t4.state.mode}/${t4.state.stage}, budget: ${t4.state.facts.budget}]`);
    if (t4.response?.kind === 'proceed' && t4.response.synthesizedQuery) {
      const ctx = detectShoppingIntent(t4.response.synthesizedQuery, EMPTY_SIGNALS, undefined);
      const gaps = getStatedGaps(ctx, EMPTY_SIGNALS);
      console.log(`  [shopping mode: ${ctx.mode}, gaps: [${gaps.join(', ')}]]`);
    }
    console.log('\n══════════════════════════════════════════════════════\n');
    expect(true).toBe(true);
  });
});

describe('Output trace: direct shopping entry (amplifier, DAC, speaker, turntable)', () => {
  const ENTRIES = [
    { text: 'I want to buy an amplifier', label: 'AMPLIFIER' },
    { text: 'looking to buy a DAC', label: 'DAC' },
    { text: 'I want to buy speakers', label: 'SPEAKERS' },
    { text: 'I want to buy a turntable', label: 'TURNTABLE' },
  ];

  for (const { text, label } of ENTRIES) {
    it(`prints flow for ${label}`, () => {
      console.log(`\n── ${label} ──`);

      const s1 = start(text);
      console.log(`USER: ${text}`);
      console.log(`  [state: ${s1.mode}/${s1.stage}, category: ${s1.facts.category}]`);

      if (s1.stage === 'ready_to_recommend') {
        console.log('  → Immediate recommendation (explicit purchase intent)');
        console.log('');
        return;
      }

      if (s1.stage === 'clarify_budget') {
        const t2 = next(s1, '5000');
        console.log(`USER: 5000`);
        console.log(`SYSTEM: ${responseText(t2)}`);
        console.log(`  [state: ${t2.state.mode}/${t2.state.stage}, budget: ${t2.state.facts.budget}]`);
      }
      console.log('');
      expect(s1.mode).toBe('shopping');
    });
  }
});
