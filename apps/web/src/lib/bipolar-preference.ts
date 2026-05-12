/**
 * Audio XX — Bipolar Optimization Preference Parser (Phase 1).
 *
 * Specialist refinement validation surfaced one consistent failure mode:
 * the system collapsed "X without Y" and "X but Y" phrasings into
 * single-trait taste extraction (one half of the bipolar preference was
 * silently dropped) or into the partial-recognition diagnostic intercept
 * (treating positive preference words as complaints).
 *
 * This module is purely additive. It recognizes the bipolar shape, names
 * the desired trait AND the preserved trait (or avoided failure mode),
 * and returns null when the message is not bipolar — letting the existing
 * single-trait extractor run unchanged.
 *
 * The parser is deterministic, has no LLM dependency, and produces no
 * audio-domain assertions of its own. Quality resolution is delegated to
 * `resolveQuality` (intent.ts), which owns the canonical trait vocabulary.
 *
 * Engineering-vs-domain boundary: this module is engine-layer. It maps
 * surface syntax → an abstract { desired, preserved, avoided } record.
 * Audio-specific weighting of the record happens in the shopping adapter
 * (shopping-intent.ts), not here.
 */

import { resolveQuality } from './intent';

export type BipolarShape =
  | 'X_without_losing_Y'
  | 'X_without_becoming_Y'
  | 'X_without_sounding_Y'
  | 'less_X_without_losing_Y'
  | 'X_but_still_Y'
  | 'X_but_not_Y'
  | 'X_without_Y';

export interface BipolarTrait {
  /** Canonical trait token (see intent.KNOWN_QUALITIES / QUALITY_ALIASES). */
  quality: string;
  /** Original phrase from user input — kept for trace / display only. */
  raw: string;
}

export interface BipolarPreference {
  /** Which surface form matched. Recorded for trace, not used downstream. */
  shape: BipolarShape;
  /** The trait the user explicitly wants more (or less, if `negative`) of. */
  desired: BipolarTrait;
  /** A trait that must NOT degrade. Either preserved or avoided is set. */
  preserved: BipolarTrait | null;
  /** A failure mode the user wants to avoid. Either preserved or avoided is set. */
  avoided: BipolarTrait | null;
  /** When true, desired is framed as `less X` (reduction, not addition). */
  negativeDesired: boolean;
}

// Failure-mode tokens that read as "avoided" rather than "preserved"
// (an adjective complaint about a state the listener wants the system to
// NOT have). The 'without becoming Y' / 'without sounding Y' shapes always
// produce avoided regardless, but this set also captures cases where
// 'without Y' resolves to a clearly-negative trait.
const NEGATIVE_QUALITY_TOKENS = new Set([
  'analytical', 'sterile', 'sterility', 'clinical', 'cold', 'coldness',
  'thin', 'thinness', 'lean', 'dry', 'dryness', 'hard', 'harshness',
  'fatigue', 'fatiguing', 'glare', 'sibilance', 'edge', 'bright',
  'brightness', 'soft', 'softness', 'flabby', 'bloated', 'congested',
  'congestion', 'muddy', 'rolled-off', 'roll-off', 'collapsed',
  'collapse', 'forward', 'aggressive', 'aggression',
]);

// Adjective → canonical noun mapping for the avoided slot. resolveQuality
// already does this for many forms; this map covers tokens that don't
// fit the existing alias table.
const NEGATIVE_NOUN_FORM: Record<string, string> = {
  // analytical is mapped to 'sterility' by the main QUALITY_ALIASES table,
  // so we don't override it here.
  thin: 'thinness',
  lean: 'thinness',
  dry: 'dryness',
  hard: 'harshness',
  soft: 'softness',
  softness: 'softness',
  fatiguing: 'fatigue',
  flabby: 'softness',
  bloated: 'softness',
  congested: 'congestion',
  collapsed: 'collapse',
  collapsing: 'collapse',
  aggressive: 'aggression',
  bright: 'brightness',
  forward: 'forward',
  rolled: 'roll-off',
  'rolled-off': 'roll-off',
};

// Audiophile-specific tokens not in the main quality dictionary that we
// want the bipolar parser to recognize as canonical quality references.
// These supplement resolveQuality without modifying the engine-side
// vocabulary (which would change scoring elsewhere).
const SUPPLEMENTARY_QUALITY: Record<string, string> = {
  resolving: 'detail',
  resolved: 'detail',
  articulation: 'detail',
  articulate: 'detail',
  transient: 'speed',
  transients: 'speed',
  precision: 'detail',
  // "organic" → "naturalness" already in main aliases, but kept here
  // explicitly so the parser is self-documenting.
  organic: 'naturalness',
  natural: 'naturalness',
};

// Ordered so more-specific shapes match before generics. Each capture
// group is (?<x>...) (?<y>...). The shapes encoding "without becoming/
// sounding" assert Y is an avoided failure mode; "without losing" asserts
// Y is preserved; "without Y" / "but Y" / "but still Y" are inferred
// from token polarity.
const SHAPE_PATTERNS: Array<{ shape: BipolarShape; re: RegExp; ySlot: 'preserved' | 'avoided' | 'infer' }> = [
  {
    shape: 'less_X_without_losing_Y',
    re: /\bless\s+(?<x>[a-z][a-z\s-]*?)\s+without\s+(?:losing|sacrificing|trading\s+away|giving\s+up)\s+(?<y>[a-z][a-z\s-]+?)(?=[.,?!]|$)/i,
    ySlot: 'preserved',
  },
  {
    shape: 'X_without_losing_Y',
    re: /\b(?:more\s+|better\s+)?(?<x>[a-z][a-z\s-]*?)\s+without\s+(?:losing|sacrificing|trading\s+away|giving\s+up|killing)\s+(?<y>[a-z][a-z\s-]+?)(?=[.,?!]|$)/i,
    ySlot: 'preserved',
  },
  {
    shape: 'X_without_becoming_Y',
    re: /\b(?:more\s+|better\s+)?(?<x>[a-z][a-z\s-]*?)\s+without\s+(?:becoming|turning|getting)\s+(?<y>[a-z][a-z\s-]+?)(?=[.,?!]|$)/i,
    ySlot: 'avoided',
  },
  {
    shape: 'X_without_sounding_Y',
    re: /\b(?:more\s+|better\s+)?(?<x>[a-z][a-z\s-]*?)\s+without\s+(?:sounding|feeling|coming\s+across\s+as)\s+(?<y>[a-z][a-z\s-]+?)(?=[.,?!]|$)/i,
    ySlot: 'avoided',
  },
  {
    shape: 'X_but_still_Y',
    re: /\b(?<x>[a-z][a-z\s-]*?)\s+but\s+still\s+(?:highly\s+|fully\s+|fundamentally\s+)?(?<y>[a-z][a-z\s-]+?)(?=[.,?!]|$)/i,
    ySlot: 'preserved',
  },
  {
    shape: 'X_but_not_Y',
    re: /\b(?<x>[a-z][a-z\s-]*?)\s+but\s+not\s+(?<y>[a-z][a-z\s-]+?)(?=[.,?!]|$)/i,
    ySlot: 'avoided',
  },
  {
    shape: 'X_without_Y',
    re: /\b(?:more\s+|better\s+)?(?<x>[a-z][a-z\s-]*?)\s+without\s+(?<y>[a-z][a-z\s-]+?)(?=[.,?!]|$)/i,
    ySlot: 'infer',
  },
];

// Tokens that are NOT canonical qualities but are commonly part of multi-
// word phrases ("rolled-off highs", "transient precision"). We drop these
// so the last meaningful token reaches the resolver.
const STOPWORD_TAIL = new Set([
  'still', 'really', 'fully', 'overly', 'too', 'very', 'extremely',
  'highs', 'mids', 'midrange', 'treble', 'bass', 'lows', 'low-end',
  'sound', 'tone', 'character', 'feel', 'presentation', 'response',
  'precision', 'definition', 'reproduction',
]);

function resolveSingleToken(tok: string): string | null {
  if (!tok) return null;
  const q = resolveQuality(tok);
  if (q) return q;
  if (SUPPLEMENTARY_QUALITY[tok]) return SUPPLEMENTARY_QUALITY[tok];
  if (NEGATIVE_NOUN_FORM[tok]) return NEGATIVE_NOUN_FORM[tok];
  return null;
}

function normalizeTrait(raw: string): string | null {
  const cleaned = raw.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  // Try the whole phrase first
  const full = resolveSingleToken(cleaned);
  if (full) return full;
  // Try multi-word adjectives e.g. "rolled-off"
  const hyphen = cleaned.replace(/\s+/g, '-');
  const fullH = resolveSingleToken(hyphen);
  if (fullH) return fullH;
  // Walk tokens from right to left, prefer non-stopword tokens but fall
  // back to a stopword token's resolution if nothing else matches.
  const tokens = cleaned.split(/[\s-]+/);
  let fallback: string | null = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const tok = tokens[i];
    if (!tok) continue;
    const q = resolveSingleToken(tok);
    if (!q) continue;
    if (STOPWORD_TAIL.has(tok)) {
      if (!fallback) fallback = q;
      continue;
    }
    return q;
  }
  return fallback;
}

function classifyY(slot: 'preserved' | 'avoided' | 'infer', yToken: string): 'preserved' | 'avoided' {
  if (slot !== 'infer') return slot;
  // For 'without Y' / 'but Y' without an explicit becoming/losing cue: if
  // the resolved quality is in the negative set, it's an avoided failure
  // mode; otherwise it's a preserved trait.
  return NEGATIVE_QUALITY_TOKENS.has(yToken) ? 'avoided' : 'preserved';
}

/**
 * Parse a user message for a bipolar optimization preference.
 *
 * Returns null when no bipolar shape is present, or when neither side
 * resolves to a known quality. The caller (intent classifier, scoring
 * pipeline) is responsible for deciding what to do with the result —
 * this module names the structure, it doesn't act on it.
 */
export function extractBipolarPreference(text: string): BipolarPreference | null {
  if (!text || text.length < 6) return null;
  const lower = text.toLowerCase();
  for (const { shape, re, ySlot } of SHAPE_PATTERNS) {
    const m = lower.match(re);
    if (!m || !m.groups) continue;
    const { x, y } = m.groups;
    if (!x || !y) continue;
    const xQuality = normalizeTrait(x);
    const yQuality = normalizeTrait(y);
    // Require X to resolve. Y is optional but strongly preferred —
    // without it we cannot meaningfully describe the trade-off.
    if (!xQuality || !yQuality) continue;
    // Reject degenerate matches where X and Y resolve to the same trait
    // (e.g. "warmth without losing warmth" is not a meaningful balance).
    if (xQuality === yQuality) continue;
    const slot = classifyY(ySlot, yQuality);
    const negativeDesired = shape === 'less_X_without_losing_Y';
    return {
      shape,
      desired: { quality: xQuality, raw: x.trim() },
      preserved: slot === 'preserved' ? { quality: yQuality, raw: y.trim() } : null,
      avoided: slot === 'avoided' ? { quality: yQuality, raw: y.trim() } : null,
      negativeDesired,
    };
  }
  return null;
}

/**
 * Render a one-line summary of the bipolar preference for trace logging
 * and (optionally) prose insertion. Pure formatter — never throws.
 */
export function formatBipolarPreference(bp: BipolarPreference): string {
  const desired = bp.negativeDesired ? `less ${bp.desired.quality}` : bp.desired.quality;
  const second = bp.preserved
    ? `preserving ${bp.preserved.quality}`
    : bp.avoided
      ? `avoiding ${bp.avoided.quality}`
      : null;
  return second ? `${desired}, ${second}` : desired;
}
