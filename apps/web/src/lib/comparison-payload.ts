/**
 * Structured comparison payload — separates comparison reasoning from rendering.
 *
 * All comparison outputs flow through this payload:
 *   1. Code builds the payload (deterministic)
 *   2. Code validates the payload (enforcement)
 *   3. Renderer turns the payload into prose (rendering)
 *
 * The payload is the single source of truth for what a comparison says.
 * No comparison can reach the user without passing validation.
 */

// ── Payload Type ────────────────────────────────────────

export type TradeoffAxis =
  | 'flow_vs_density'
  | 'speed_vs_warmth'
  | 'precision_vs_body'
  | 'control_vs_elasticity'
  | 'musicality_vs_accuracy'
  | 'engagement_vs_control';

export interface ComparisonSide {
  /** Display name (e.g. "Leben", "JOB"). */
  name: string;
  /** Core character summary — 2-4 trait words. */
  character: string;
  /** Design philosophy — WHY it sounds the way it does. */
  designPhilosophy: string;
  /** Sonic translation — what you actually hear. */
  sonicTraits: string[];
  /** System interaction note (when system context is present). */
  systemInteraction?: string;
}

export interface ComparisonDecision {
  /** "If you want X → choose A" */
  chooseAIf: string;
  /** "If you want Y → choose B" */
  chooseBIf: string;
  /** When system context makes one pairing clearly stronger. */
  recommended?: string;
  /** Rationale for the recommendation. */
  rationale?: string;
}

export interface ComparisonPayload {
  /** Subject line (e.g. "Job vs Leben — with DeVore O/96"). */
  subject: string;
  /** Side A — first brand/product. */
  sideA: ComparisonSide;
  /** Side B — second brand/product. */
  sideB: ComparisonSide;

  // ── Reasoning (computed deterministically) ──────────

  /** The primary tension — a single axis that defines the real choice. */
  tradeoff: {
    axis: TradeoffAxis;
    /** Human-readable statement (e.g. "flow vs density"). */
    label: string;
    /** Full prose trade-off statement. */
    statement: string;
  };

  /** Listener taste frame — always present, never undefined. */
  tasteFrame: {
    /** 'explicit' when query contained taste signal, 'provisional' when inferred. */
    source: 'explicit' | 'provisional';
    /** The taste-framed statement. */
    statement: string;
  };

  /** Directional decision — mandatory, always computed. */
  decision: ComparisonDecision;

  // ── System context (when present) ──────────────────

  /** System context anchor (e.g. "DeVore O/96"). */
  systemAnchor?: {
    name: string;
    character: string | null;
    anchorStatement: string;
  };

  /** System-level trade-off (only when system context present). */
  systemTradeoff?: string;

  // ── Shopping + Sources (after decision) ─────────────

  /** Shopping pointers — optional, comes after decision. */
  shopping?: string[];

  /** Source references — known pairings, review citations. */
  sources?: string[];

  // ── Follow-up (rare — only for design-family models) ──

  /** Optional follow-up question. */
  followUp?: string;
}

// ── Keyword scoring utility ─────────────────────────────

const WARM_KEYWORDS = ['warm', 'rich', 'dense', 'harmonic', 'tonal density', 'tonal body', 'lush', 'musical', 'golden', 'tube-adjacent', 'saturated'];
const CONTROL_KEYWORDS = ['controlled', 'composed', 'neutral', 'clean', 'damping', 'precise', 'analytical', 'tight', 'restrained', 'cool', 'dry'];
const FLOW_KEYWORDS = ['flow', 'elastic', 'alive', 'engagement', 'rhythmic', 'drive', 'timing'];
const DENSITY_KEYWORDS = ['dense', 'density', 'body', 'harmonic', 'saturated', 'lush', 'weight', 'presence'];

export function scoreKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((w) => lower.includes(w)).length;
}

export type DominantAxis = 'warm' | 'control' | 'flow' | 'neutral';

export function detectDominantAxis(character: string, tendencies: string): DominantAxis {
  const text = character + ' ' + tendencies;
  const warm = scoreKeywords(text, WARM_KEYWORDS);
  const control = scoreKeywords(text, CONTROL_KEYWORDS);
  const flow = scoreKeywords(text, FLOW_KEYWORDS);

  if (warm > control) return 'warm';
  if (control > warm) return 'control';
  if (flow > 0) return 'flow';
  return 'neutral';
}

// ── Trade-off computation ───────────────────────────────

export function computeTradeoffAxis(
  dominantA: DominantAxis,
  dominantB: DominantAxis,
  flowScoreA: number,
  flowScoreB: number,
): TradeoffAxis {
  if (dominantA === 'warm' && dominantB === 'control') {
    return flowScoreA > 0 ? 'musicality_vs_accuracy' : 'speed_vs_warmth';
  }
  if (dominantB === 'warm' && dominantA === 'control') {
    return flowScoreB > 0 ? 'musicality_vs_accuracy' : 'speed_vs_warmth';
  }
  if (dominantA === 'flow' && dominantB === 'control') return 'control_vs_elasticity';
  if (dominantB === 'flow' && dominantA === 'control') return 'control_vs_elasticity';
  if (dominantA === 'warm' && dominantB === 'warm') return 'flow_vs_density';
  if (dominantA === 'control' && dominantB === 'control') return 'precision_vs_body';
  return 'engagement_vs_control';
}

export const TRADEOFF_LABELS: Record<TradeoffAxis, [string, string]> = {
  flow_vs_density: ['speed and rhythmic precision', 'tonal density and harmonic saturation'],
  speed_vs_warmth: ['warmth and tonal body', 'precision and control'],
  precision_vs_body: ['resolving precision', 'tonal weight and body'],
  control_vs_elasticity: ['composure and control', 'musical flow and rhythmic engagement'],
  musicality_vs_accuracy: ['musical realism through flow and harmonic richness', 'technical accuracy through control and precision'],
  engagement_vs_control: ['musical engagement', 'analytical precision'],
};

// ── Validation ──────────────────────────────────────────

/** Phrases that indicate generic/indecisive output. Reject these. */
const BANNED_PHRASES = [
  'balanced presentation',
  'no strong signal',
  'it depends',
  'hard to say',
  'equally good',
  'both are excellent choices',
  'you can\'t go wrong',
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a comparison payload before rendering.
 * Fails if any mandatory field is missing or generic.
 */
export function validateComparisonPayload(payload: ComparisonPayload): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Mandatory fields
  if (!payload.tradeoff?.axis) errors.push('Missing trade-off axis');
  if (!payload.tradeoff?.statement) errors.push('Missing trade-off statement');
  if (!payload.decision?.chooseAIf) errors.push('Missing chooseAIf');
  if (!payload.decision?.chooseBIf) errors.push('Missing chooseBIf');
  if (!payload.tasteFrame?.statement) errors.push('Missing taste frame');

  // If system context present, anchoring is required
  if (payload.systemAnchor && !payload.systemAnchor.anchorStatement) {
    errors.push('System context present but no anchor statement');
  }

  // Side completeness
  if (payload.sideA.sonicTraits.length === 0) warnings.push('Side A has no sonic traits');
  if (payload.sideB.sonicTraits.length === 0) warnings.push('Side B has no sonic traits');
  if (!payload.sideA.designPhilosophy) errors.push('Side A missing design philosophy');
  if (!payload.sideB.designPhilosophy) errors.push('Side B missing design philosophy');

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate rendered comparison output text.
 * Rejects generic phrases and requires decision language.
 */
export function validateComparisonOutput(output: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lower = output.toLowerCase();

  // Reject banned phrases
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      errors.push(`Output contains banned phrase: "${phrase}"`);
    }
  }

  // Require decision language
  const hasDecisionLanguage = /if you want/i.test(output)
    || /→/i.test(output)
    || /choose\s/i.test(output);
  if (!hasDecisionLanguage) {
    errors.push('Output lacks decision language (no "if you want" / "→" / "choose")');
  }

  // Require trade-off language
  const hasTradeoff = /real choice|trade-off|trade off|system-level|the question is/i.test(output)
    || /counterbalance|compounds/i.test(output);
  if (!hasTradeoff) {
    warnings.push('Output may lack explicit trade-off framing');
  }

  // Should not end with a question when system context is present
  const lines = output.split('\n').filter((l) => l.trim());
  const lastLine = lines[lines.length - 1] ?? '';
  if (lastLine.trim().endsWith('?')) {
    warnings.push('Output ends with a question — prefer ending with a decision');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Payload Rendering ───────────────────────────────────

/**
 * Render a ComparisonPayload into the final prose output.
 * This is the ONLY path from payload to user-visible text.
 */
export function renderComparisonPayload(payload: ComparisonPayload): {
  comparisonSummary: string;
  followUp?: string;
} {
  const parts: string[] = [];

  // 1. System anchor (if present) — "This is not a neutral comparison."
  if (payload.systemAnchor) {
    parts.push(payload.systemAnchor.anchorStatement);
  }

  // 2. Design philosophy (initial comparisons only — system-anchored skip this)
  if (!payload.systemAnchor) {
    parts.push(`**${payload.sideA.name}:** ${payload.sideA.designPhilosophy}`);
    parts.push(`**${payload.sideB.name}:** ${payload.sideB.designPhilosophy}`);
  }

  // 3. Sonic translation / System interaction
  if (payload.systemAnchor) {
    // System-anchored: show interaction notes
    if (payload.sideA.systemInteraction) {
      parts.push(`**${payload.sideA.name}** with ${payload.systemAnchor.name}: ${payload.sideA.systemInteraction}`);
    }
    if (payload.sideB.systemInteraction) {
      parts.push(`**${payload.sideB.name}** with ${payload.systemAnchor.name}: ${payload.sideB.systemInteraction}`);
    }
  } else {
    // Initial: show sonic traits
    const sonicA = payload.sideA.sonicTraits.length > 0
      ? `**${payload.sideA.name}:** ${payload.sideA.sonicTraits.slice(0, 4).join('. ')}.`
      : '';
    const sonicB = payload.sideB.sonicTraits.length > 0
      ? `**${payload.sideB.name}:** ${payload.sideB.sonicTraits.slice(0, 4).join('. ')}.`
      : '';
    if (sonicA && sonicB) parts.push(`${sonicA}\n\n${sonicB}`);
  }

  // 4. System trade-off (if present)
  if (payload.systemTradeoff) {
    parts.push(payload.systemTradeoff);
  }

  // 5. Main trade-off
  parts.push(payload.tradeoff.statement);

  // 6. Taste frame
  parts.push(payload.tasteFrame.statement);

  // 7. Decision
  parts.push(`${payload.decision.chooseAIf}\n${payload.decision.chooseBIf}`);

  // 8. Recommendation
  if (payload.decision.recommended) {
    const rec = payload.decision.rationale
      ? `${payload.decision.recommended} ${payload.decision.rationale}`
      : payload.decision.recommended;
    parts.push(rec);
  }

  // 9. Shopping
  if (payload.shopping && payload.shopping.length > 0) {
    parts.push(`Recommended direction:\n${payload.shopping.join('\n')}`);
  }

  // 10. Sources
  if (payload.sources && payload.sources.length > 0) {
    parts.push(`Sources:\n${payload.sources.map((s) => `- ${s}`).join('\n')}`);
  }

  return {
    comparisonSummary: parts.join('\n\n'),
    followUp: payload.followUp,
  };
}
