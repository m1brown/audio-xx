import type { SignalDirection } from './signal-types';

export interface Rule {
  id: string;
  label: string;
  priority: number;
  conditions: RuleConditions;
  outputs: RuleOutputs;
}

export interface RuleConditions {
  symptoms_present?: string[];
  symptoms_present_any?: string[];
  symptoms_absent?: string[];
  traits?: Record<string, SignalDirection>;
  archetypes_include?: string[];
  has_improvement_signals?: boolean;
  archetype_conflict?: boolean;
  /**
   * Minimum number of SYMPTOMS the listener actually described before this
   * rule may fire.
   *
   * `symptoms_absent` is satisfied trivially by an empty symptom list, so a
   * rule conditioned only on absence fires for someone who has described
   * nothing. Any rule whose output claims to have READ the listener's
   * impressions must set this — absence of a symptom is not evidence that
   * the listener reported its absence.
   *
   * Counts symptoms only, not trait readings: traits are inferred from
   * incidental wording ("better", "warm") and are present for queries that
   * describe no listening experience at all.
   */
  min_symptom_signals?: number;
}

export interface RuleOutputs {
  explanation: string;
  suggestions: string[];
  risks: string[];
  next_step: string;
  verdict?: string;
  archetype_note?: string;
}

export interface EvaluationContext {
  symptoms: string[];
  traits: Record<string, SignalDirection>;
  archetypes: string[];
  uncertainty_level: number;
  has_improvement_signals: boolean;
}

export interface EvaluationResult {
  fired_rules: FiredRule[];
  archetype_conflict_detected: boolean;
  uncertainty_level: number;
}

export interface FiredRule {
  id: string;
  label: string;
  priority: number;
  outputs: RuleOutputs;
}
