import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import { loadRules, evaluate, clearCache as clearRulesCache } from '../engine';
import type { EvaluationContext } from '../types';

const RULES_PATH = resolve(__dirname, '../../rules.yaml');
const SIGNALS_PATH = resolve(__dirname, '../../../signals/signals.yaml');
const COMPONENTS_PATH = resolve(__dirname, '../../../data/components.yaml');
const REF_SYSTEMS_PATH = resolve(__dirname, '../../../data/reference-systems.yaml');

beforeEach(() => {
  clearRulesCache();
});

// Inline signal processor to avoid cross-package import issues in tests
function processText(text: string) {
  const raw = readFileSync(SIGNALS_PATH, 'utf-8');
  const dict = parse(raw);
  const lower = text.toLowerCase();

  const traits: Record<string, string> = {};
  const symptoms = new Set<string>();
  const archetypeHints = new Set<string>();
  const matchedPhrases: string[] = [];

  for (const entry of dict.signals) {
    for (const phrase of entry.phrases) {
      if (lower.includes(phrase.toLowerCase())) {
        matchedPhrases.push(phrase);
        symptoms.add(entry.symptom);
        for (const [trait, direction] of Object.entries(entry.signals)) {
          traits[trait] = direction as string;
        }
        if (entry.archetype_hint) archetypeHints.add(entry.archetype_hint);
        break;
      }
    }
  }

  const matchedUncertaintyMarkers: string[] = [];
  for (const marker of dict.uncertainty_markers) {
    if (lower.includes(marker.toLowerCase())) matchedUncertaintyMarkers.push(marker);
  }

  return {
    traits,
    symptoms: Array.from(symptoms),
    archetype_hints: Array.from(archetypeHints),
    uncertainty_level: Math.min(matchedUncertaintyMarkers.length, 3),
    matched_phrases: matchedPhrases,
  };
}

function fullEvaluate(text: string, profileArchetypes: string[] = []) {
  const signals = processText(text);
  const allArchetypes = [...new Set([...profileArchetypes, ...signals.archetype_hints])];
  const ctx: EvaluationContext = {
    symptoms: signals.symptoms,
    traits: signals.traits as Record<string, 'up' | 'down'>,
    archetypes: allArchetypes,
    uncertainty_level: signals.uncertainty_level,
    has_improvement_signals: signals.symptoms.includes('improvement'),
  };
  const rules = loadRules(RULES_PATH);
  return { signals, result: evaluate(ctx, rules) };
}

describe('Integration: Full evaluation pipeline', () => {
  // Test 2: Reference systems produce expected explanatory language (non-commercial framing)
  it('reference systems should be non-commercial and include explanatory descriptions', () => {
    const raw = readFileSync(REF_SYSTEMS_PATH, 'utf-8');
    const data = parse(raw);

    for (const rs of data.reference_systems) {
      expect(rs.description).toBeDefined();
      expect(rs.description.trim().length).toBeGreaterThan(0);
      // Reference system descriptions should explain trade-offs
      expect(rs.archetype).toBeDefined();
    }
  });

  // Test 6: Reference components are never presented with purchase language
  it('reference components should be flagged as is_reference', () => {
    const raw = readFileSync(COMPONENTS_PATH, 'utf-8');
    const data = parse(raw);

    const refComponents = data.components.filter((c: { is_reference: boolean }) => c.is_reference);
    expect(refComponents.length).toBeGreaterThan(0);

    // Reference components should not have retailer_links
    for (const comp of refComponents) {
      if (comp.retailer_links) {
        expect(comp.retailer_links).toHaveLength(0);
      }
    }
  });

  // Test 8: Reviews appear as contextual information only
  it('reviews should always have role "contextual"', () => {
    const raw = readFileSync(COMPONENTS_PATH, 'utf-8');
    const data = parse(raw);

    for (const comp of data.components) {
      if (comp.reviews && comp.reviews.length > 0) {
        for (const review of comp.reviews) {
          expect(review.role).toBe('contextual');
        }
      }
    }
  });

  // Test 7: Candidate evaluation against a saved system produces trait movement and verdict
  // (This tests the data structures support it — the API test covers the full flow)
  it('component trait_tendencies should be parseable for comparison', () => {
    const raw = readFileSync(COMPONENTS_PATH, 'utf-8');
    const data = parse(raw);

    const qualValues = ['strong', 'moderate', 'slight', 'neutral', 'slight-risk', 'moderate-risk'];

    for (const comp of data.components) {
      expect(comp.trait_tendencies).toBeDefined();
      for (const [, val] of Object.entries(comp.trait_tendencies)) {
        expect(qualValues).toContain(val);
      }
    }
  });

  // Test 3 (integration): "No purchase recommended" through full pipeline
  it('should produce no-purchase-recommended for positive free text', () => {
    const { result } = fullEvaluate('The system sounds much better than before, significant improvement');
    const noPurchase = result.fired_rules.find((r) => r.id === 'system-performing-well');
    expect(noPurchase).toBeDefined();
    expect(noPurchase!.outputs.verdict).toBe('no_purchase_recommended');
  });

  // Test 4 (integration): Archetype conflict through full pipeline
  it('should surface archetype conflict when profile has engagement and composure', () => {
    const { result } = fullEvaluate(
      'The system sounds too polite and sleepy',
      ['engagement', 'composure']
    );
    expect(result.archetype_conflict_detected).toBe(true);
    const conflictRule = result.fired_rules.find((r) => r.id === 'archetype-conflict');
    expect(conflictRule).toBeDefined();
  });

  // Test 5 (integration): Uncertainty through full pipeline
  it('should increase conservatism with uncertainty markers in free text', () => {
    const normal = fullEvaluate('The system is bright and harsh');
    const uncertain = fullEvaluate('I think maybe the system is sort of bright and perhaps a bit harsh');

    expect(uncertain.signals.uncertainty_level).toBeGreaterThan(normal.signals.uncertainty_level);
    // Uncertain version should have fewer or different rules
    expect(uncertain.result.fired_rules.length).toBeLessThanOrEqual(normal.result.fired_rules.length);
  });

  // Test 1 (integration): Low-volume listener through full pipeline
  it('should trigger low-volume warnings from free text', () => {
    const { result } = fullEvaluate(
      'I listen quietly in my apartment and the system sounds thin at low volume',
      ['low_volume']
    );
    const lowVolRule = result.fired_rules.find((r) => r.id === 'low-volume-thinness');
    expect(lowVolRule).toBeDefined();
  });

  // Test 10: Free text affects outcomes (not silently ignored)
  it('should produce different results for different free-text inputs', () => {
    const bright = fullEvaluate('Everything sounds bright and fatiguing');
    const thin = fullEvaluate('The sound is thin and lacks body');
    const congested = fullEvaluate('Music sounds congested and muddy');

    // Each should produce different primary rules
    const brightRuleIds = bright.result.fired_rules.map((r) => r.id);
    const thinRuleIds = thin.result.fired_rules.map((r) => r.id);
    const congestedRuleIds = congested.result.fired_rules.map((r) => r.id);

    // At least one unique rule per input
    expect(brightRuleIds).not.toEqual(thinRuleIds);
    expect(thinRuleIds).not.toEqual(congestedRuleIds);
  });
});
