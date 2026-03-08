import { describe, it, expect, beforeEach } from 'vitest';
import { loadRules, evaluate, clearCache } from '../engine';
import type { EvaluationContext } from '../types';
import { resolve } from 'path';

const RULES_PATH = resolve(__dirname, '../../rules.yaml');

beforeEach(() => {
  clearCache();
});

function eval_(ctx: Partial<EvaluationContext>) {
  const full: EvaluationContext = {
    symptoms: [],
    traits: {},
    archetypes: [],
    uncertainty_level: 0,
    has_improvement_signals: false,
    ...ctx,
  };
  const rules = loadRules(RULES_PATH);
  return evaluate(full, rules);
}

describe('Rule Engine', () => {
  // Test 3: "No purchase recommended" is returned when the system is performing well
  it('should return no-purchase-recommended when system is performing well', () => {
    const result = eval_({
      symptoms: ['improvement'],
      has_improvement_signals: true,
    });

    const noPurchase = result.fired_rules.find((r) => r.id === 'system-performing-well');
    expect(noPurchase).toBeDefined();
    expect(noPurchase!.outputs.verdict).toBe('no_purchase_recommended');
    expect(noPurchase!.outputs.suggestions).toHaveLength(0);
  });

  // Test 4: Conflicting archetypes produce explicit trade-off language
  it('should detect archetype conflict between engagement and composure', () => {
    const result = eval_({
      archetypes: ['engagement', 'composure'],
    });

    expect(result.archetype_conflict_detected).toBe(true);
    const conflictRule = result.fired_rules.find((r) => r.id === 'archetype-conflict');
    expect(conflictRule).toBeDefined();
    expect(conflictRule!.outputs.explanation).toContain('engagement');
    expect(conflictRule!.outputs.explanation).toContain('composure');
  });

  // Test 1: Low-volume listener triggers appropriate warnings
  it('should trigger low-volume thinness warning for low-volume listener with thinness', () => {
    const result = eval_({
      symptoms: ['thinness', 'thin_at_low_volume'],
      traits: { tonal_density: 'down' },
      archetypes: ['low_volume'],
    });

    const lowVolRule = result.fired_rules.find((r) => r.id === 'low-volume-thinness');
    expect(lowVolRule).toBeDefined();
    expect(lowVolRule!.outputs.archetype_note).toBeDefined();
    expect(lowVolRule!.outputs.archetype_note).toContain('low-volume');
  });

  // Test 5: Uncertainty markers increase conservatism
  it('should suppress rules at high uncertainty (level 3)', () => {
    const result = eval_({
      symptoms: ['brightness_harshness', 'fatigue'],
      traits: { fatigue_risk: 'up' },
      uncertainty_level: 3,
    });

    // At uncertainty 3, only conservative verdicts should fire
    for (const rule of result.fired_rules) {
      expect(['no_purchase_recommended', 'wait_recommended', 'revert_recommended']).toContain(
        rule.outputs.verdict
      );
    }
  });

  it('should limit to one rule at uncertainty level 2', () => {
    const result = eval_({
      symptoms: ['brightness_harshness', 'fatigue', 'thinness'],
      traits: { fatigue_risk: 'up', tonal_density: 'down' },
      uncertainty_level: 2,
    });

    expect(result.fired_rules.length).toBeLessThanOrEqual(1);
  });

  // Test: Regression rule fires on regression symptom
  it('should fire regression rule when regression is detected', () => {
    const result = eval_({
      symptoms: ['regression'],
      traits: { flow: 'down' },
    });

    const regressRule = result.fired_rules.find((r) => r.id === 'regression-detected');
    expect(regressRule).toBeDefined();
    expect(regressRule!.outputs.verdict).toBe('revert_recommended');
  });

  // Test: Engagement over-refinement warning
  it('should warn engagement listeners about over-refinement', () => {
    const result = eval_({
      symptoms: ['too_polite'],
      traits: { elasticity: 'down', dynamics: 'down' },
      archetypes: ['engagement'],
    });

    const engRule = result.fired_rules.find((r) => r.id === 'engagement-over-refinement');
    expect(engRule).toBeDefined();
    expect(engRule!.outputs.archetype_note).toContain('engagement');
  });

  // Test: Composure unnecessary intensity warning
  it('should warn composure listeners about unnecessary intensity', () => {
    const result = eval_({
      symptoms: ['too_forward'],
      traits: { composure: 'down', fatigue_risk: 'up' },
      archetypes: ['composure'],
    });

    const compRule = result.fired_rules.find((r) => r.id === 'composure-unnecessary-intensity');
    expect(compRule).toBeDefined();
    expect(compRule!.outputs.archetype_note).toContain('composure');
  });

  // Test: Fatigue/brightness rule
  it('should identify brightness/fatigue as upstream issue', () => {
    const result = eval_({
      symptoms: ['brightness_harshness'],
      traits: { fatigue_risk: 'up' },
    });

    const rule = result.fired_rules.find((r) => r.id === 'fatigue-brightness');
    expect(rule).toBeDefined();
    expect(rule!.outputs.suggestions.length).toBeGreaterThan(0);
    expect(rule!.outputs.suggestions.length).toBeLessThanOrEqual(2);
    expect(rule!.outputs.risks.length).toBeGreaterThan(0);
  });

  // Test: Every fired rule includes trade-offs and next steps
  it('should always include risks and next_step in outputs', () => {
    const rules = loadRules(RULES_PATH);
    for (const rule of rules) {
      expect(rule.outputs.risks.length).toBeGreaterThan(0);
      expect(rule.outputs.next_step.trim().length).toBeGreaterThan(0);
    }
  });

  // Test: Maximum 1-2 suggestions per rule
  it('should have at most 2 suggestions per rule', () => {
    const rules = loadRules(RULES_PATH);
    for (const rule of rules) {
      expect(rule.outputs.suggestions.length).toBeLessThanOrEqual(2);
    }
  });
});
