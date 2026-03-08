import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import type { Rule, EvaluationContext, EvaluationResult, FiredRule } from './types';

const RULES_PATH = resolve(__dirname, '..', 'rules.yaml');

let cachedRules: Rule[] | null = null;

export function loadRules(path?: string): Rule[] {
  if (cachedRules && !path) return cachedRules;
  const raw = readFileSync(path ?? RULES_PATH, 'utf-8');
  const parsed = parse(raw);
  const rules = (parsed.rules as Rule[]).sort((a, b) => a.priority - b.priority);
  if (!path) cachedRules = rules;
  return rules;
}

export function clearCache(): void {
  cachedRules = null;
}

/** Detect whether archetypes conflict (engagement + composure) */
function detectArchetypeConflict(archetypes: string[]): boolean {
  return archetypes.includes('engagement') && archetypes.includes('composure');
}

/** Check if a single rule's conditions match the evaluation context */
function ruleMatches(rule: Rule, ctx: EvaluationContext): boolean {
  const cond = rule.conditions;

  // Check symptoms_present (all must be present)
  if (cond.symptoms_present) {
    if (!cond.symptoms_present.every((s) => ctx.symptoms.includes(s))) {
      return false;
    }
  }

  // Check symptoms_present_any (at least one)
  if (cond.symptoms_present_any) {
    if (!cond.symptoms_present_any.some((s) => ctx.symptoms.includes(s))) {
      return false;
    }
  }

  // Check symptoms_absent (none must be present)
  if (cond.symptoms_absent) {
    if (cond.symptoms_absent.some((s) => ctx.symptoms.includes(s))) {
      return false;
    }
  }

  // Check trait directions
  if (cond.traits) {
    for (const [trait, direction] of Object.entries(cond.traits)) {
      if (ctx.traits[trait] !== direction) {
        return false;
      }
    }
  }

  // Check archetypes_include
  if (cond.archetypes_include) {
    if (!cond.archetypes_include.every((a) => ctx.archetypes.includes(a))) {
      return false;
    }
  }

  // Check has_improvement_signals
  if (cond.has_improvement_signals !== undefined) {
    if (ctx.has_improvement_signals !== cond.has_improvement_signals) {
      return false;
    }
  }

  // Check archetype_conflict
  if (cond.archetype_conflict !== undefined) {
    if (detectArchetypeConflict(ctx.archetypes) !== cond.archetype_conflict) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate rules against the given context.
 * Returns fired rules sorted by priority, with uncertainty applied.
 *
 * When uncertainty_level > 0, the engine increases conservatism:
 * - At level 1+: prefer "wait" and "do nothing" verdicts
 * - At level 2+: suppress all but the highest-priority matching rule
 * - At level 3: only fire rules with verdict "no_purchase_recommended", "wait_recommended", or "revert_recommended"
 */
export function evaluate(ctx: EvaluationContext, rules?: Rule[]): EvaluationResult {
  const allRules = rules ?? loadRules();
  const archetypeConflict = detectArchetypeConflict(ctx.archetypes);

  let firedRules: FiredRule[] = [];

  for (const rule of allRules) {
    if (ruleMatches(rule, ctx)) {
      firedRules.push({
        id: rule.id,
        label: rule.label,
        priority: rule.priority,
        outputs: rule.outputs,
      });
    }
  }

  // Also fire the archetype conflict rule if applicable
  if (archetypeConflict) {
    const conflictRule = allRules.find((r) => r.conditions.archetype_conflict === true);
    if (conflictRule && !firedRules.some((r) => r.id === conflictRule.id)) {
      firedRules.push({
        id: conflictRule.id,
        label: conflictRule.label,
        priority: conflictRule.priority,
        outputs: conflictRule.outputs,
      });
    }
  }

  // Sort by priority
  firedRules.sort((a, b) => a.priority - b.priority);

  // Apply uncertainty conservatism
  if (ctx.uncertainty_level >= 3) {
    const conservativeVerdicts = ['no_purchase_recommended', 'wait_recommended', 'revert_recommended'];
    firedRules = firedRules.filter(
      (r) => r.outputs.verdict && conservativeVerdicts.includes(r.outputs.verdict)
    );
    // If no conservative rules match, produce a generic "wait" result
    if (firedRules.length === 0) {
      firedRules = [
        {
          id: 'uncertainty-override',
          label: 'High uncertainty — wait recommended',
          priority: 0,
          outputs: {
            explanation:
              'Your description contains significant uncertainty. Rather than acting on uncertain impressions, continue listening and return when your observations are clearer.',
            suggestions: ['Wait and listen more before making changes.'],
            risks: ['Acting on uncertain impressions may lead to unnecessary changes.'],
            next_step:
              'Listen for a few more sessions and pay attention to what specifically bothers or pleases you. Return with more specific observations.',
            verdict: 'wait_recommended',
          },
        },
      ];
    }
  } else if (ctx.uncertainty_level >= 2) {
    // Only keep the highest-priority rule
    firedRules = firedRules.slice(0, 1);
  }

  return {
    fired_rules: firedRules,
    archetype_conflict_detected: archetypeConflict,
    uncertainty_level: ctx.uncertainty_level,
  };
}
