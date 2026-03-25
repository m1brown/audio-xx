import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { detectInitialMode } from '../conversation-state';
import { detectShoppingIntent, getStatedGaps } from '../shopping-intent';
import type { ExtractedSignals, SignalDirection } from '../signal-types';

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {} as Record<string, SignalDirection>,
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

// ── Core DAC inputs (all four required variants) ────────────────

const DAC_INPUTS = [
  'I want to buy a DAC',
  'DAC',
  'looking for a DAC',
  'buy a DAC',
];

describe('DAC input routing', () => {
  for (const msg of DAC_INPUTS) {
    it(`"${msg}" → detectIntent returns shopping`, () => {
      const { intent } = detectIntent(msg);
      expect(intent).toBe('shopping');
    });
  }

  for (const msg of DAC_INPUTS) {
    it(`"${msg}" → detectInitialMode routes to shopping`, () => {
      const { intent } = detectIntent(msg);
      const state = detectInitialMode(msg, {
        detectedIntent: intent,
        hasSystem: false,
        subjectCount: 0,
      });
      expect(state).not.toBeNull();
      expect(state!.mode).toBe('shopping');
    });
  }

  for (const msg of DAC_INPUTS) {
    it(`"${msg}" → detectShoppingIntent finds DAC category, no system required`, () => {
      const ctx = detectShoppingIntent(msg, EMPTY_SIGNALS, undefined);
      expect(ctx.category).toBe('dac');
      expect(ctx.mode).not.toBe('system-required');
    });
  }

  for (const msg of DAC_INPUTS) {
    it(`"${msg}" → gaps include budget (not system)`, () => {
      const ctx = detectShoppingIntent(msg, EMPTY_SIGNALS, undefined);
      const gaps = getStatedGaps(ctx, EMPTY_SIGNALS);
      expect(gaps).toContain('budget');
      expect(gaps).not.toContain('system');
    });
  }
});

// ── Bare category names across all types ────────────────────────

const BARE_CATEGORIES: Array<[string, string]> = [
  ['DAC', 'dac'],
  ['speakers', 'speaker'],
  ['headphones', 'headphone'],
  ['amplifier', 'amplifier'],
  ['turntable', 'turntable'],
  ['streamer', 'streamer'],
];

describe('Bare category name → shopping routing', () => {
  for (const [input, expectedCategory] of BARE_CATEGORIES) {
    it(`"${input}" → shopping intent`, () => {
      const { intent } = detectIntent(input);
      expect(intent).toBe('shopping');
    });

    it(`"${input}" → category = ${expectedCategory}`, () => {
      const ctx = detectShoppingIntent(input, EMPTY_SIGNALS, undefined);
      expect(ctx.category).toBe(expectedCategory);
    });

    it(`"${input}" → no system gap`, () => {
      const ctx = detectShoppingIntent(input, EMPTY_SIGNALS, undefined);
      const gaps = getStatedGaps(ctx, EMPTY_SIGNALS);
      expect(gaps).not.toContain('system');
    });
  }
});

// ── Budget-bearing DAC inputs → ready to recommend ──────────────

const DAC_WITH_BUDGET = [
  'best DAC under $1000',
  'DAC under $2000',
  'recommend a DAC for $500',
];

describe('DAC with budget → ready to recommend', () => {
  for (const msg of DAC_WITH_BUDGET) {
    it(`"${msg}" → shopping intent + budget detected`, () => {
      const { intent } = detectIntent(msg);
      expect(intent).toBe('shopping');
      const ctx = detectShoppingIntent(msg, EMPTY_SIGNALS, undefined);
      expect(ctx.category).toBe('dac');
      expect(ctx.budgetMentioned).toBe(true);
    });
  }
});
