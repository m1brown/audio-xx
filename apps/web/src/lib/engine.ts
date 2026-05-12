/**
 * Server-side evaluation pipeline.
 * Wires the signal processor and rule engine together.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import type { ExtractedSignals, SignalDictionary, SignalDirection, SignalEntry } from './signal-types';
import type { Rule, EvaluationContext, EvaluationResult, FiredRule, RuleConditions } from './rule-types';

// ── Text Normalization ────────────────────────────

/**
 * Explicit correction map for common misspellings, shorthand,
 * and variant spellings. Applied before phrase matching.
 * Keys must be lowercase.
 */
const CORRECTIONS: Record<string, string> = {
  // Misspellings
  'spded': 'speed',
  'spd': 'speed',
  'warmht': 'warmth',
  'detial': 'detail',
  'deatil': 'detail',
  'fatiging': 'fatiguing',
  'fatigueing': 'fatiguing',
  'glary': 'glare',
  'sweatness': 'sweetness',
  'sweeetness': 'sweetness',
  'analitical': 'analytical',
  'analyitcal': 'analytical',
  'liqid': 'liquid',
  'liqud': 'liquid',
  'resoultion': 'resolution',
  'resoltion': 'resolution',
  'sibilence': 'sibilant',
  'sibillant': 'sibilant',
  'harhs': 'harsh',
  'smoth': 'smooth',
  'smoooth': 'smooth',
  'trasparent': 'transparent',
  'transparant': 'transparent',
  'agressive': 'aggressive',
  'aggresive': 'aggressive',
  'rythmic': 'rhythmic',
  'rythm': 'rhythm',
  'congested': 'congested',
  'congestd': 'congested',
  'brigth': 'bright',
  'birght': 'bright',
  'fatige': 'fatigue',
  'orgainc': 'organic',
  'organc': 'organic',
  'coherant': 'coherent',
  'reavealing': 'revealing',
  'reveling': 'revealing',

  // Shorthand / product variants
  'ares 2': 'ares 15th',
  'ares2': 'ares 15th',
  'ares ii': 'ares 15th',
  'enyo': 'enyo 15th',
  'hugo tt2': 'hugo tt2',
  'tt 2': 'tt2',
};

/**
 * Lightweight deterministic text normalization.
 * Lowercases, then applies explicit corrections for known
 * misspellings and shorthand before phrase matching.
 */
function normalizeText(lower: string): string {
  let result = lower;
  for (const [from, to] of Object.entries(CORRECTIONS)) {
    if (result.includes(from)) {
      result = result.replaceAll(from, to);
    }
  }
  return result;
}

// ── Signal Processing ──────────────────────────────

const SIGNALS_PATH = resolve(process.cwd(), '../../packages/signals/signals.yaml');
const RULES_PATH = resolve(process.cwd(), '../../packages/rules/rules.yaml');

function loadSignalDictionary(): SignalDictionary {
  const raw = readFileSync(SIGNALS_PATH, 'utf-8');
  return parse(raw) as SignalDictionary;
}

export function processText(text: string): ExtractedSignals {
  const dict = loadSignalDictionary();
  const lower = normalizeText(text.toLowerCase());

  const traits: Record<string, SignalDirection> = {};
  const symptoms = new Set<string>();
  const archetypeHints = new Set<string>();
  const matchedPhrases: string[] = [];

  // Negation-aware phrase matcher: a quality word inside a desired-constraint
  // phrase ("avoid glare", "without glare", "no glare", "less glare") is a
  // shopping preference, not a current-state complaint. The signal dictionary
  // is symptom-oriented, so without this guard "what DACs avoid digital glare"
  // routes to diagnosis (partial-recognition) instead of shopping.
  // Smallest safe fix: detect the negation context around the matched phrase
  // and skip the symptom assertion when present.
  const NEGATION_WINDOW = 24; // characters before phrase start
  const NEGATION_RE = /\b(?:avoid|avoids?|avoiding|without|no|not|less|never|reduce|reduces?|reducing|minim(?:ise|ize|al)|free\s+of|free\s+from|don'?t\s+want|do\s+not\s+want|low\s+on|low-on)\b[^a-z]*$/i;
  // Also treat positive aspirational openers as non-complaints when the
  // matched phrase is a positive quality used as a *desire* ("relaxed",
  // "resolving"). These are shopping signals, not symptoms.
  const ASPIRATIONAL_RE = /\b(?:want|wanting|looking\s+for|seeking|prefer|prefers?|preferring|like\s+(?:more|the))\b[^.]*$/i;
  // Whole-message guard: aspirational shapes like "systems that sound X",
  // "what DACs avoid X", "best X for Y" frame the message as preference
  // capture, not complaint. When the entire message matches one of these
  // shapes, we don't extract any symptoms — they would only feed false
  // partial-recognition diagnostic flows.
  //
  // Bipolar optimization shapes ("X without Y", "X but Y", "X without
  // losing Y") are also aspirational — the user is naming a balance to
  // strike, not reporting a current complaint. Symptom extraction here
  // turns "more flow without losing detail" into a 'musical_organic'
  // partial-recognition firing.
  const MESSAGE_IS_ASPIRATIONAL = (
    /\b(?:systems?|setups?|amps?|amplifiers?|dacs?|speakers?|streamers?|headphones?)\s+that\s+(?:sound|are|feel|deliver|do|disappear)\b/i.test(lower) ||
    /\bwhat\s+(?:dacs?|amps?|amplifiers?|speakers?|streamers?|headphones?)\s+(?:avoid|don'?t|without|never|are\s+free)/i.test(lower) ||
    /\b(?:best|good|recommend(?:ed)?|favourite|favorite)\s+\w+\s+for\b/i.test(lower) ||
    /\b(?:want|need|looking\s+for|seeking)\s+\w+\s+with\b/i.test(lower) ||
    // Bipolar shapes — "X without losing Y", "X without becoming Y",
    // "X without sounding Y", "X but still Y", "less X without losing Y".
    /\b\w[\w\s-]{0,40}\s+without\s+(?:losing|sacrificing|trading|giving|killing|becoming|turning|getting|sounding|feeling)\s+\w/i.test(lower) ||
    /\b\w[\w\s-]{0,40}\s+but\s+(?:still|not)\s+\w/i.test(lower)
  );

   for (const entry of dict.signals) {
    for (const phrase of entry.phrases) {
const p = phrase.toLowerCase();
   const hit = p.includes(' ')
     ? lower.indexOf(p)
     : (() => { const m = lower.match(new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')); return m && m.index !== undefined ? m.index : -1; })();

   if (hit >= 0) {
        // Check if the matched phrase is inside a negation/aspiration window.
        const window = lower.slice(Math.max(0, hit - NEGATION_WINDOW), hit);
        const isNegated = NEGATION_RE.test(window);
        const isAspirational = ASPIRATIONAL_RE.test(window);
        if (isNegated || isAspirational || MESSAGE_IS_ASPIRATIONAL) {
          // Treated as preference, not symptom — skip symptom assertion and
          // record the phrase for diagnostics only.
          matchedPhrases.push(`${phrase} [neg]`);
          break;
        }
        matchedPhrases.push(phrase);
        symptoms.add(entry.symptom);
        for (const [trait, direction] of Object.entries(entry.signals)) {
          traits[trait] = direction;
        }
        if (entry.archetype_hint) {
          archetypeHints.add(entry.archetype_hint);
        }
        break;
      }
    }
  }

  const matchedUncertaintyMarkers: string[] = [];
  for (const marker of dict.uncertainty_markers) {
    if (lower.includes(marker.toLowerCase())) {
      matchedUncertaintyMarkers.push(marker);
    }
  }

  return {
    traits,
    symptoms: Array.from(symptoms),
    archetype_hints: Array.from(archetypeHints),
    uncertainty_level: Math.min(matchedUncertaintyMarkers.length, 3),
    matched_phrases: matchedPhrases,
    matched_uncertainty_markers: matchedUncertaintyMarkers,
  };
}

// ── Rule Evaluation ────────────────────────────────

function loadRules(): Rule[] {
  const raw = readFileSync(RULES_PATH, 'utf-8');
  const parsed = parse(raw);
  return (parsed.rules as Rule[]).sort((a: Rule, b: Rule) => a.priority - b.priority);
}

function detectArchetypeConflict(archetypes: string[]): boolean {
  return archetypes.includes('engagement') && archetypes.includes('composure');
}

function ruleMatches(rule: Rule, ctx: EvaluationContext): boolean {
  const cond = rule.conditions;

  if (cond.symptoms_present) {
    if (!cond.symptoms_present.every((s: string) => ctx.symptoms.includes(s))) return false;
  }
  if (cond.symptoms_present_any) {
    if (!cond.symptoms_present_any.some((s: string) => ctx.symptoms.includes(s))) return false;
  }
  if (cond.symptoms_absent) {
    if (cond.symptoms_absent.some((s: string) => ctx.symptoms.includes(s))) return false;
  }
  if (cond.traits) {
    for (const [trait, direction] of Object.entries(cond.traits)) {
      if (ctx.traits[trait] !== direction) return false;
    }
  }
  if (cond.archetypes_include) {
    if (!cond.archetypes_include.every((a: string) => ctx.archetypes.includes(a))) return false;
  }
  if (cond.has_improvement_signals !== undefined) {
    if (ctx.has_improvement_signals !== cond.has_improvement_signals) return false;
  }
  if (cond.archetype_conflict !== undefined) {
    if (detectArchetypeConflict(ctx.archetypes) !== cond.archetype_conflict) return false;
  }

  return true;
}


export function evaluate(ctx: EvaluationContext): EvaluationResult {
  const allRules = loadRules();
  const archetypeConflict = detectArchetypeConflict(ctx.archetypes);

  let firedRules: FiredRule[] = [];

  // Run all rules except fallback
  for (const rule of allRules) {
    if (rule.id === 'friendly-advisor-fallback') continue;

    if (ruleMatches(rule, ctx)) {
      firedRules.push({
        id: rule.id,
        label: rule.label,
        priority: rule.priority,
        outputs: rule.outputs,
      });
    }
  }

  // If nothing matched, decide whether to fire the dismissive fallback.
  //
  // Phase K — fallback overuse fix:
  //   The friendly-advisor-fallback says "does not strongly activate a
  //   specific symptom pattern". Surfacing that copy whenever no rule
  //   matches is too aggressive — users frequently describe a recognisable
  //   signal (e.g. "noisy", "no bass", "sounds tiny") that we DID detect
  //   in symptoms[] / archetypes[] but for which no curated rule exists.
  //
  //   New behaviour:
  //     - If we recognised at least one signal (symptom OR archetype OR
  //       any trait), emit a soft "partial-recognition" acknowledgement
  //       that names what we saw, without claiming the user was unclear.
  //     - Only fire the dismissive fallback when the input produced
  //       genuinely zero recognised content.
  //
  //   This naturally caps the dismissive copy to inputs where it is true,
  //   instead of using it as a generic "no rule matched" placeholder.
  if (firedRules.length === 0) {
    const hasAnyRecognisedSignal =
      ctx.symptoms.length > 0
      || ctx.archetypes.length > 0
      || Object.keys(ctx.traits).length > 0;

    if (hasAnyRecognisedSignal) {
      const recognisedLabel =
        ctx.symptoms[0]
        ?? ctx.archetypes[0]
        ?? Object.keys(ctx.traits)[0]
        ?? 'something in your description';
      const readable = recognisedLabel.replace(/_/g, ' ');
      firedRules.push({
        id: 'partial-recognition',
        label: 'Partial recognition — recognised signal, no curated rule',
        priority: 950,
        outputs: {
          explanation: `I recognised "${readable}" in what you described, but I do not yet have a confident pattern that ties it to a specific architectural cause. A short follow-up will let me give you something useful instead of guessing.`,
          suggestions: [
            'Mention which component(s) the issue seems to track with (source, amp, speakers, room).',
            'Note whether the experience is constant or only on certain music or volumes.',
          ],
          risks: [
            'Acting on a single symptom word without context often leads to component swaps that miss the real cause.',
          ],
          next_step: 'Tell me one more thing about when this happens or what changed recently, and I can give a more pointed read.',
          verdict: 'wait_recommended',
        },
      });
    } else {
      const fallback = allRules.find((r: Rule) => r.id === 'friendly-advisor-fallback');
      if (fallback) {
        firedRules.push({
          id: fallback.id,
          label: fallback.label,
          priority: fallback.priority,
          outputs: fallback.outputs,
        });
      }
    }
  }

  // Ensure archetype conflict rule is included when relevant
  if (archetypeConflict) {
    const conflictRule = allRules.find((r: Rule) => r.conditions.archetype_conflict === true);
    if (conflictRule && !firedRules.some((r) => r.id === conflictRule.id)) {
      firedRules.push({
        id: conflictRule.id,
        label: conflictRule.label,
        priority: conflictRule.priority,
        outputs: conflictRule.outputs,
      });
    }
  }

  firedRules.sort((a, b) => a.priority - b.priority);

  // Apply uncertainty conservatism
  if (ctx.uncertainty_level >= 3) {
    const conservativeVerdicts = ['no_purchase_recommended', 'wait_recommended', 'revert_recommended'];
    firedRules = firedRules.filter(
      (r) => r.outputs.verdict && conservativeVerdicts.includes(r.outputs.verdict)
    );
    if (firedRules.length === 0) {
      firedRules = [{
        id: 'uncertainty-override',
        label: 'High uncertainty — wait recommended',
        priority: 0,
        outputs: {
          explanation: 'Your description contains significant uncertainty. Rather than acting on uncertain impressions, continue listening and return when your observations are clearer.',
          suggestions: ['Wait and listen more before making changes.'],
          risks: ['Acting on uncertain impressions may lead to unnecessary changes.'],
          next_step: 'Listen for a few more sessions and pay attention to what specifically bothers or pleases you.',
          verdict: 'wait_recommended',
        },
      }];
    }
  } else if (ctx.uncertainty_level >= 2) {
    firedRules = firedRules.slice(0, 1);
  }

  return {
    fired_rules: firedRules,
    archetype_conflict_detected: archetypeConflict,
    uncertainty_level: ctx.uncertainty_level,
  };
}
/**
 * Full evaluation pipeline: text → signals → rules → result.
 */
export function evaluateText(
  text: string,
  archetypes: string[] = [],
): { signals: ExtractedSignals; result: EvaluationResult } {
  const signals = processText(text);

  // Merge profile archetypes with detected hints
  const allArchetypes = [...new Set([...archetypes, ...signals.archetype_hints])];

  const ctx: EvaluationContext = {
    symptoms: signals.symptoms,
    traits: signals.traits,
    archetypes: allArchetypes,
    uncertainty_level: signals.uncertainty_level,
    has_improvement_signals: signals.symptoms.includes('improvement'),
  };

  const result = evaluate(ctx);
  return { signals, result };
}
