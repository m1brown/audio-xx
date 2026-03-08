import type { SignalDirection } from '@audio-xx/signals';
import type { ArchetypeName } from '@audio-xx/data';

/** A single rule as stored in YAML */
export interface Rule {
  id: string;
  label: string;
  priority: number;
  conditions: RuleConditions;
  outputs: RuleOutputs;
}

/** Conditions that must be met for a rule to fire */
export interface RuleConditions {
  /** All these symptoms must be present */
  symptoms_present?: string[];
  /** At least one of these symptoms must be present */
  symptoms_present_any?: string[];
  /** All these symptoms must be absent */
  symptoms_absent?: string[];
  /** Trait direction requirements */
  traits?: Record<string, SignalDirection>;
  /** Archetypes that must be in the user's profile */
  archetypes_include?: ArchetypeName[];
  /** Whether improvement signals are present */
  has_improvement_signals?: boolean;
  /** Whether archetype conflict is detected */
  archetype_conflict?: boolean;
}

/** Rule outputs — what the system tells the user */
export interface RuleOutputs {
  explanation: string;
  suggestions: string[];
  risks: string[];
  next_step: string;
  verdict?: string;
  archetype_note?: string;
}

/** Context passed to the rule engine for evaluation */
export interface EvaluationContext {
  /** Symptoms detected from free text */
  symptoms: string[];
  /** Trait signals from free text */
  traits: Record<string, SignalDirection>;
  /** User's active archetypes (from profile + detected hints) */
  archetypes: ArchetypeName[];
  /** Uncertainty level (0–3) */
  uncertainty_level: number;
  /** Whether improvement signals were detected */
  has_improvement_signals: boolean;
}

/** Result of rule engine evaluation */
export interface EvaluationResult {
  /** Rules that fired, in priority order */
  fired_rules: FiredRule[];
  /** Whether archetype conflict was detected */
  archetype_conflict_detected: boolean;
  /** Uncertainty level carried through */
  uncertainty_level: number;
}

export interface FiredRule {
  id: string;
  label: string;
  priority: number;
  outputs: RuleOutputs;
}
