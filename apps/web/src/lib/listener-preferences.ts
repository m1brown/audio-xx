/**
 * Listener Preferences — Stage PB2.2 v1
 *
 * Structured listener-profile layer that sits on top of the existing
 * signal/desire extraction. The profile captures where a listener sits
 * on 10 sonic-preference dimensions (each a float 0-1), independent of
 * the canonical 4-axis sonic-trait framework used for component anchoring.
 *
 * v1 scope:
 *   - Type definitions for ListenerProfile and PreferenceSignal
 *   - Regex-based phrase extraction (no LLM)
 *   - Signal application with 0..1 clamping
 *   - Natural-language summary with uncertainty language
 *
 * Out of scope for v1:
 *   - Cross-turn accumulation/persistence
 *   - Confidence weighting beyond signal count
 *   - Integration into recommendation ranking
 */
// ── Types ────────────────────────────────────────────────

/**
 * 10-dimensional listener preference profile.
 *
 * Each dimension is a float in [0, 1]:
 *   0.0 = left pole (the trait named first in the field name)
 *   1.0 = right pole (the trait named second)
 *   0.5 = neutral / unknown
 */
export interface ListenerProfile {
  /** 0 = warm-seeking · 1 = neutral/analytical-seeking */
  warmth_vs_neutrality: number;
  /** 0 = tonal density · 1 = clarity/separation */
  density_vs_clarity: number;
  /** 0 = relaxed/easy · 1 = intense/dynamic */
  ease_vs_intensity: number;
  /** 0 = musical flow · 1 = transient precision */
  flow_vs_precision: number;
  /** 0 = intimate/focused · 1 = expansive staging */
  intimacy_vs_scale: number;
  /** 0 = smooth/gentle · 1 = sharp attack */
  smoothness_vs_attack: number;
  /** 0 = low fatigue sensitivity · 1 = high fatigue sensitivity */
  fatigue_sensitivity: number;
  /** 0 = seeks novelty/change · 1 = seeks system coherence */
  novelty_vs_coherence: number;
  /** 0 = analytical listening · 1 = emotional engagement */
  analytical_vs_emotional: number;
  /** 0 = forward/immediate · 1 = laid-back/relaxed */
  immediacy_vs_relaxation: number;

  // ── Metadata ──
  /** 0-1, derived from signalCount (saturates around 6+ signals, capped at 0.85). */
  confidence: number;
  /** Number of preference signals that have been folded into this profile. */
  signalCount: number;
  /**
   * Per-dimension signal counts. Once a dimension has received 3+ signals,
   * subsequent signals on that dimension are halved (diminishing returns)
   * to avoid runaway confidence from repeated similar phrasing.
   */
  dimensionCounts: Partial<Record<ListenerProfileDimension, number>>;
  /** ISO date of last update. */
  lastUpdated: string;
}

/** The 10 sonic-preference dimensions (excludes metadata fields). */
export type ListenerProfileDimension =
  | 'warmth_vs_neutrality'
  | 'density_vs_clarity'
  | 'ease_vs_intensity'
  | 'flow_vs_precision'
  | 'intimacy_vs_scale'
  | 'smoothness_vs_attack'
  | 'fatigue_sensitivity'
  | 'novelty_vs_coherence'
  | 'analytical_vs_emotional'
  | 'immediacy_vs_relaxation';

export interface PreferenceSignal {
  dimension: ListenerProfileDimension;
  /** -0.2..+0.2 adjustment that will be added to the profile dimension. */
  direction: number;
  /** Source phrase that matched. */
  phrase: string;
  confidence: 'strong' | 'moderate' | 'weak';
}

// ── Defaults ─────────────────────────────────────────────

export function createDefaultProfile(): ListenerProfile {
  return {
    warmth_vs_neutrality: 0.5,
    density_vs_clarity: 0.5,
    ease_vs_intensity: 0.5,
    flow_vs_precision: 0.5,
    intimacy_vs_scale: 0.5,
    smoothness_vs_attack: 0.5,
    fatigue_sensitivity: 0.5,
    novelty_vs_coherence: 0.5,
    analytical_vs_emotional: 0.5,
    immediacy_vs_relaxation: 0.5,
    confidence: 0,
    signalCount: 0,
    dimensionCounts: {},
    lastUpdated: new Date().toISOString(),
  };
}

/** Maximum confidence achievable from textual signals alone. */
export const MAX_PROFILE_CONFIDENCE = 0.85;

/** Per-dimension threshold beyond which signals are halved. */
const DIMINISHING_RETURNS_THRESHOLD = 3;

// ── Phrase rules ─────────────────────────────────────────

interface PhraseRule {
  pattern: RegExp;
  effects: Array<{ dimension: ListenerProfileDimension; direction: number }>;
  phrase: string;
  confidence: 'strong' | 'moderate' | 'weak';
}

/**
 * Phrase-to-dimension mappings. Ordered specific → generic so that more
 * specific phrases (e.g. "I love flow and timing") win over their
 * looser single-word forms (e.g. bare "flow").
 *
 * Match runs on lowercased input; patterns use word boundaries to avoid
 * partial matches like "warmth" inside "warmthless".
 */
const PHRASE_RULES: PhraseRule[] = [
  // ── Specific compound phrases (strong signals) ────────
  {
    pattern: /\bi (?:love|like|enjoy|want|prefer) flow and timing\b/i,
    effects: [{ dimension: 'flow_vs_precision', direction: -0.15 }],
    phrase: 'I love flow and timing',
    confidence: 'strong',
  },
  {
    pattern: /\bflow and timing\b/i,
    effects: [{ dimension: 'flow_vs_precision', direction: -0.12 }],
    phrase: 'flow and timing',
    confidence: 'moderate',
  },
  {
    pattern: /\bdetail (?:fatigues|tires|wears|exhausts) me\b/i,
    effects: [
      { dimension: 'fatigue_sensitivity', direction: 0.2 },
      { dimension: 'density_vs_clarity', direction: -0.1 },
    ],
    phrase: 'detail fatigues me',
    confidence: 'strong',
  },
  {
    pattern: /\bi miss body\b/i,
    effects: [
      { dimension: 'warmth_vs_neutrality', direction: -0.1 },
      { dimension: 'density_vs_clarity', direction: -0.1 },
    ],
    phrase: 'I miss body',
    confidence: 'strong',
  },
  {
    pattern: /\b(?:i want|i'd like|need) more immersion\b/i,
    effects: [{ dimension: 'intimacy_vs_scale', direction: 0.1 }],
    phrase: 'I want more immersion',
    confidence: 'moderate',
  },
  {
    pattern: /\bi listen for hours\b/i,
    effects: [
      { dimension: 'fatigue_sensitivity', direction: 0.15 },
      { dimension: 'ease_vs_intensity', direction: -0.1 },
    ],
    phrase: 'I listen for hours',
    confidence: 'strong',
  },
  {
    pattern: /\b(?:i )?(?:listen|listening) (?:to .+? )?for hours\b/i,
    effects: [
      { dimension: 'fatigue_sensitivity', direction: 0.12 },
      { dimension: 'ease_vs_intensity', direction: -0.08 },
    ],
    phrase: 'listen for hours',
    confidence: 'moderate',
  },
  {
    pattern: /\b(?:i )?prefer intimacy over (?:huge|large|big|wide) stage\b/i,
    effects: [{ dimension: 'intimacy_vs_scale', direction: -0.15 }],
    phrase: 'I prefer intimacy over huge stage',
    confidence: 'strong',
  },
  {
    pattern: /\b(?:i want|i'd like|need) (?:something|a system) musical\b/i,
    effects: [
      { dimension: 'analytical_vs_emotional', direction: 0.1 },
      { dimension: 'flow_vs_precision', direction: -0.1 },
    ],
    phrase: 'I want something musical',
    confidence: 'moderate',
  },
  {
    pattern: /\b(?:i want|i'd like|need) precision and (?:control|imaging)\b/i,
    effects: [
      { dimension: 'flow_vs_precision', direction: 0.1 },
      { dimension: 'analytical_vs_emotional', direction: -0.1 },
    ],
    phrase: 'I want precision and control',
    confidence: 'strong',
  },
  {
    pattern: /\b(?:clean )?separation matters (?:most )?to me\b/i,
    effects: [
      { dimension: 'density_vs_clarity', direction: 0.12 },
      { dimension: 'flow_vs_precision', direction: 0.08 },
    ],
    phrase: 'separation matters to me',
    confidence: 'strong',
  },
  {
    pattern: /\b(?:i want|i'd like|need) to hear everything (?:in the recording)?\b/i,
    effects: [
      { dimension: 'density_vs_clarity', direction: 0.15 },
      { dimension: 'analytical_vs_emotional', direction: -0.1 },
    ],
    phrase: 'I want to hear everything',
    confidence: 'strong',
  },
  {
    pattern: /\bmaximum (?:resolution|detail|separation)\b/i,
    effects: [
      { dimension: 'density_vs_clarity', direction: 0.15 },
      { dimension: 'analytical_vs_emotional', direction: -0.1 },
    ],
    phrase: 'maximum resolution',
    confidence: 'strong',
  },
  {
    pattern: /\b(?:i )?(?:don'?t|do not) care about (?:ultimate )?detail\b/i,
    effects: [
      { dimension: 'density_vs_clarity', direction: -0.15 },
      { dimension: 'analytical_vs_emotional', direction: 0.1 },
    ],
    phrase: "don't care about detail",
    confidence: 'strong',
  },
  {
    pattern: /\bmusical ease\b/i,
    effects: [
      { dimension: 'ease_vs_intensity', direction: -0.12 },
      { dimension: 'analytical_vs_emotional', direction: 0.08 },
    ],
    phrase: 'musical ease',
    confidence: 'moderate',
  },
  {
    pattern: /\beasier to listen to\b/i,
    effects: [
      { dimension: 'fatigue_sensitivity', direction: 0.15 },
      { dimension: 'ease_vs_intensity', direction: -0.1 },
    ],
    phrase: 'easier to listen to',
    confidence: 'strong',
  },
  {
    pattern: /\bsounds? harsh after\b/i,
    effects: [
      { dimension: 'fatigue_sensitivity', direction: 0.2 },
      { dimension: 'smoothness_vs_attack', direction: -0.1 },
    ],
    phrase: 'sounds harsh after',
    confidence: 'strong',
  },
  {
    pattern: /\b(?:i want|need|prefer) body(?:,| and| ,)? warmth\b/i,
    effects: [
      { dimension: 'warmth_vs_neutrality', direction: -0.12 },
      { dimension: 'density_vs_clarity', direction: -0.08 },
    ],
    phrase: 'I want body and warmth',
    confidence: 'strong',
  },

  // ── Single-token vocabulary (weak/moderate) ───────────
  {
    pattern: /\b(?:warm|warmth|lush|saturated|dense)\b/i,
    effects: [{ dimension: 'warmth_vs_neutrality', direction: -0.1 }],
    phrase: 'warm/lush/dense',
    confidence: 'moderate',
  },
  {
    pattern: /\b(?:bright|clear|analytical|neutral)\b/i,
    effects: [{ dimension: 'warmth_vs_neutrality', direction: 0.1 }],
    phrase: 'bright/clear/analytical',
    confidence: 'moderate',
  },
  {
    pattern: /\b(?:relaxed|easy|gentle|laid-?back)\b/i,
    effects: [
      { dimension: 'ease_vs_intensity', direction: -0.1 },
      { dimension: 'immediacy_vs_relaxation', direction: 0.1 },
    ],
    phrase: 'relaxed/easy/gentle',
    confidence: 'moderate',
  },
  {
    pattern: /\b(?:punchy|dynamic|aggressive|forward)\b/i,
    effects: [
      { dimension: 'ease_vs_intensity', direction: 0.1 },
      { dimension: 'immediacy_vs_relaxation', direction: -0.1 },
    ],
    phrase: 'punchy/dynamic/aggressive',
    confidence: 'moderate',
  },
  {
    pattern: /\b(?:fatiguing|harsh|tiring|exhausting)\b/i,
    effects: [{ dimension: 'fatigue_sensitivity', direction: 0.2 }],
    phrase: 'fatiguing/harsh/tiring',
    confidence: 'strong',
  },
];

// ── Extraction ───────────────────────────────────────────

/**
 * Extract preference signals from a chunk of user text.
 *
 * The same dimension may receive multiple signals from one text — that
 * is intentional. applySignals will compound them and the per-dimension
 * value is still clamped to [0, 1].
 */
export function extractPreferenceSignals(text: string): PreferenceSignal[] {
  if (!text || typeof text !== 'string') return [];
  const signals: PreferenceSignal[] = [];
  const seen = new Set<string>();

  for (const rule of PHRASE_RULES) {
    if (!rule.pattern.test(text)) continue;
    // Dedupe: if the same phrase tag has already fired, skip.
    if (seen.has(rule.phrase)) continue;
    seen.add(rule.phrase);
    for (const eff of rule.effects) {
      signals.push({
        dimension: eff.dimension,
        direction: eff.direction,
        phrase: rule.phrase,
        confidence: rule.confidence,
      });
    }
  }
  return signals;
}

// ── Application ──────────────────────────────────────────

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Apply preference signals to a profile, returning a new profile.
 *
 * Each dimension is clamped to [0, 1]. Confidence saturates with
 * signalCount and is capped at MAX_PROFILE_CONFIDENCE (0.85) — text
 * alone never produces full certainty.
 *
 * Diminishing returns: once a dimension has already absorbed
 * DIMINISHING_RETURNS_THRESHOLD (3) signals in this profile, every
 * additional signal on that same dimension is halved before being
 * folded in. This prevents one strongly-worded phrase repeated across
 * several turns from saturating a dimension.
 */
export function applySignals(
  profile: ListenerProfile,
  signals: PreferenceSignal[],
): ListenerProfile {
  if (!signals.length) return profile;
  const next: ListenerProfile = {
    ...profile,
    dimensionCounts: { ...(profile.dimensionCounts ?? {}) },
  };
  for (const sig of signals) {
    const priorCount = next.dimensionCounts[sig.dimension] ?? 0;
    const damping = priorCount >= DIMINISHING_RETURNS_THRESHOLD ? 0.5 : 1;
    const current = next[sig.dimension] as number;
    next[sig.dimension] = clamp01(current + sig.direction * damping) as never;
    next.dimensionCounts[sig.dimension] = priorCount + 1;
  }
  next.signalCount = profile.signalCount + signals.length;
  // Confidence saturates: 6 signals ≈ 0.86, then capped at 0.85.
  const raw = 1 - Math.exp(-next.signalCount / 3);
  next.confidence = Math.min(raw, MAX_PROFILE_CONFIDENCE);
  next.lastUpdated = new Date().toISOString();
  return next;
}

// ── Summary rendering ────────────────────────────────────

/** Threshold above/below 0.5 that counts as a meaningful lean. */
const DEVIATION_THRESHOLD = 0.15;

interface DimensionLabel {
  dimension: ListenerProfileDimension;
  /** Phrase used when the listener leans toward the left pole (value < 0.5). */
  leftLabel: string;
  /** Phrase used when the listener leans toward the right pole (value > 0.5). */
  rightLabel: string;
}

const DIMENSION_LABELS: DimensionLabel[] = [
  {
    dimension: 'warmth_vs_neutrality',
    leftLabel: 'warmth',
    rightLabel: 'neutrality',
  },
  {
    dimension: 'density_vs_clarity',
    leftLabel: 'density',
    rightLabel: 'separation',
  },
  {
    dimension: 'ease_vs_intensity',
    leftLabel: 'long-term ease',
    rightLabel: 'dynamic intensity',
  },
  {
    dimension: 'flow_vs_precision',
    leftLabel: 'flow',
    rightLabel: 'transient precision',
  },
  {
    dimension: 'intimacy_vs_scale',
    leftLabel: 'intimacy',
    rightLabel: 'spatial scale',
  },
  {
    dimension: 'smoothness_vs_attack',
    leftLabel: 'smoothness',
    rightLabel: 'attack',
  },
  {
    dimension: 'fatigue_sensitivity',
    leftLabel: 'low fatigue sensitivity',
    rightLabel: 'long-session comfort',
  },
  {
    dimension: 'novelty_vs_coherence',
    leftLabel: 'novelty',
    rightLabel: 'system coherence',
  },
  {
    dimension: 'analytical_vs_emotional',
    leftLabel: 'analytical precision',
    rightLabel: 'emotional engagement',
  },
  {
    dimension: 'immediacy_vs_relaxation',
    leftLabel: 'forward immediacy',
    rightLabel: 'laid-back relaxation',
  },
];

function joinPhrases(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * Render a concise natural-language summary of a profile.
 *
 * Rules:
 *  - Only dimensions deviating from 0.5 by ≥ 0.15 are mentioned
 *  - 1-2 sentences, observational tone
 *  - Uncertainty language ("appears drawn toward", "seems to prioritize")
 *  - Returns a low-confidence note when no dimension deviates
 */
export function renderProfileSummary(profile: ListenerProfile): string {
  // A fully default profile produces no text — the UI uses this to hide
  // the visibility panel entirely until at least one signal has landed.
  if (profile.signalCount === 0) return '';

  // "toward" = the pole the listener leans into.
  // "away"   = the opposite pole of the same dimension (used in "over X" clause).
  const toward: string[] = [];
  const away: string[] = [];

  for (const lbl of DIMENSION_LABELS) {
    const value = profile[lbl.dimension] as number;
    const delta = value - 0.5;
    if (Math.abs(delta) < DEVIATION_THRESHOLD) continue;
    if (delta < 0) {
      toward.push(lbl.leftLabel);
      away.push(lbl.rightLabel);
    } else {
      toward.push(lbl.rightLabel);
      away.push(lbl.leftLabel);
    }
  }

  if (toward.length === 0) {
    return 'Early signals are still forming — no clear sonic lean has emerged yet.';
  }

  // Stem reflects confidence in how much data backs the profile.
  const stem = profile.confidence < 0.4
    ? 'May value'
    : profile.confidence < 0.7
      ? 'Seems to prioritize'
      : 'Appears drawn toward';

  // When there are 3+ leans, append an "over [opposing poles]" clause
  // to make the contrast explicit. Up to 2 opposing poles to keep it tight.
  if (toward.length >= 3) {
    return `${stem} ${joinPhrases(toward)} over ${joinPhrases(away.slice(0, 2))}.`;
  }

  return `${stem} ${joinPhrases(toward)}.`;
}
