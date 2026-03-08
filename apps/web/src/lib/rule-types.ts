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
