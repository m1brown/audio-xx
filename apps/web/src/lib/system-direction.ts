/**
 * System direction inference layer.
 *
 * Infers directional hints about the user's current system tendency and
 * desired change from conversation text. No numeric scoring — just
 * simple directional tags that influence how recommendations and
 * explanations are framed.
 *
 * Two outputs:
 *   1. Current tendency — what the system seems to be now
 *      (e.g., dense, lean, bright, warm, relaxed, analytical)
 *   2. Desired direction — where the user wants to go
 *      (e.g., speed ↑, density ↑, warmth ↓)
 */

import type { DesireSignal } from './intent';
import type { Product } from './products/dacs';

// ── Types ────────────────────────────────────────────

/**
 * Directional tendency labels. These are qualitative — they describe
 * a system's character in broad strokes, not precise measurements.
 */
export type Tendency =
  | 'dense'        // rich, thick, heavy harmonic content
  | 'lean'         // thin, light, sparse
  | 'bright'       // emphasis in treble / upper midrange
  | 'warm'         // emphasis in lower midrange / upper bass
  | 'relaxed'      // laid-back, smooth, low fatigue
  | 'analytical'   // precise, clinical, detail-forward
  | 'dynamic'      // punchy, high-contrast
  | 'compressed'   // flat dynamics, low contrast
  | 'flowing'      // continuous, musical, connected
  | 'controlled'   // tight, damped, precise
  | 'spacious'     // wide, open, airy
  | 'intimate';    // close, narrow, focused

/** A directional arrow — a quality and whether it should increase or decrease. */
export interface DirectionArrow {
  quality: string;
  direction: 'up' | 'down';
}

/** The inferred direction state for the current conversation. */
export interface SystemDirection {
  /** Inferred current tendencies of the user's system (0–3 typical). */
  currentTendencies: Tendency[];
  /** Desired directional changes (0–3 typical). */
  desiredDirections: DirectionArrow[];
  /** Human-readable summary of the current tendency (for use in responses). */
  tendencySummary: string | null;
  /** Human-readable summary of the desired direction (for use in responses). */
  directionSummary: string | null;
}

// ── Tendency inference from symptoms / descriptions ──

interface TendencyPattern {
  patterns: RegExp[];
  tendency: Tendency;
}

const TENDENCY_PATTERNS: TendencyPattern[] = [
  // Bright / lean
  {
    patterns: [
      /\bsounds?\s+(?:too\s+)?bright\b/i,
      /\btoo\s+much\s+(?:brightness|treble|sibilance|glare)\b/i,
      /\bharsh\b/i, /\bsibilant\b/i, /\bglare\b/i, /\bedgy\b/i,
      /\btreble\s+is\s+(?:too|a\s+bit)\b/i,
    ],
    tendency: 'bright',
  },
  {
    patterns: [
      /\bsounds?\s+(?:too\s+)?thin\b/i,
      /\btoo\s+lean\b/i, /\blacks?\s+(?:body|weight|density|substance)\b/i,
      /\bno\s+(?:body|weight)\b/i, /\bthin\s+sounding\b/i,
    ],
    tendency: 'lean',
  },
  // Warm / dense
  {
    patterns: [
      /\bsounds?\s+(?:too\s+)?warm\b/i,
      /\btoo\s+much\s+(?:warmth|bass)\b/i,
      /\bmuddy\b/i, /\bbloated\b/i, /\btoo\s+thick\b/i,
    ],
    tendency: 'warm',
  },
  {
    patterns: [
      /\bsounds?\s+(?:too\s+)?(?:dense|heavy|thick)\b/i,
      /\btoo\s+much\s+density\b/i, /\bcongested\b/i,
      /\boverweight\b/i,
    ],
    tendency: 'dense',
  },
  // Relaxed / analytical
  {
    patterns: [
      /\bsounds?\s+(?:too\s+)?(?:relaxed|laid[\s-]?back|slow|soft)\b/i,
      /\blacks?\s+(?:energy|drive|pace|speed|attack)\b/i,
      /\bno\s+(?:energy|drive|pace|attack)\b/i,
      /\bboring\b/i, /\blifeless\b/i,
    ],
    tendency: 'relaxed',
  },
  {
    patterns: [
      /\bsounds?\s+(?:too\s+)?(?:analytical|clinical|sterile|cold)\b/i,
      /\blacks?\s+(?:musicality|emotion|engagement|soul)\b/i,
      /\btoo\s+precise\b/i, /\bno\s+(?:soul|emotion)\b/i,
    ],
    tendency: 'analytical',
  },
  // Dynamic / compressed
  {
    patterns: [
      /\bsounds?\s+(?:too\s+)?(?:flat|compressed|lifeless)\b/i,
      /\blacks?\s+dynamics\b/i, /\bno\s+(?:punch|impact|slam)\b/i,
    ],
    tendency: 'compressed',
  },
  // Spacious / intimate
  {
    patterns: [
      /\bsounds?\s+(?:too\s+)?(?:narrow|closed[\s-]?in|boxy|congested)\b/i,
      /\blacks?\s+(?:space|width|soundstage|air)\b/i,
    ],
    tendency: 'intimate',
  },
];

// ── Tendency inference from known products ───────────

/** Map product trait profiles to broad tendency labels. */
function tendenciesFromProduct(product: Product): Tendency[] {
  const t = product.traits;
  const result: Tendency[] = [];

  if ((t.flow ?? 0) >= 0.7) result.push('flowing');
  if ((t.tonal_density ?? 0) >= 0.7) result.push('dense');
  if ((t.clarity ?? 0) >= 0.7 && (t.tonal_density ?? 0) < 0.4) result.push('analytical');
  if ((t.dynamics ?? 0) >= 0.7) result.push('dynamic');
  if ((t.composure ?? 0) >= 0.7) result.push('controlled');
  if ((t.fatigue_risk ?? 0) >= 0.4 || (t.glare_risk ?? 0) >= 0.4) result.push('bright');
  if ((t.tonal_density ?? 0) >= 0.7 && (t.flow ?? 0) >= 0.4) result.push('warm');
  if ((t.warmth ?? 0) >= 0.7) result.push('warm');
  if ((t.openness ?? 0) >= 0.7 || (t.spatial_precision ?? 0) >= 0.7) result.push('spacious');
  if ((t.rhythm ?? 0) >= 0.7 && (t.speed ?? 0) >= 0.7) result.push('dynamic');

  // Deduplicate
  return [...new Set(result)];
}

// ── Desired direction from desire signals ────────────

/** Maps a DesireSignal to a DirectionArrow. */
function desireToArrow(desire: DesireSignal): DirectionArrow {
  return {
    quality: desire.quality,
    direction: desire.direction === 'more' ? 'up' : 'down',
  };
}

/** Infer what tends to be the opposite / complementary desired direction from a tendency. */
function desiredDirectionFromTendency(tendency: Tendency): DirectionArrow[] {
  switch (tendency) {
    case 'bright':    return [{ quality: 'warmth', direction: 'up' }, { quality: 'smoothness', direction: 'up' }];
    case 'lean':      return [{ quality: 'density', direction: 'up' }, { quality: 'body', direction: 'up' }];
    case 'warm':      return [{ quality: 'clarity', direction: 'up' }, { quality: 'speed', direction: 'up' }];
    case 'dense':     return [{ quality: 'clarity', direction: 'up' }, { quality: 'air', direction: 'up' }];
    case 'relaxed':   return [{ quality: 'speed', direction: 'up' }, { quality: 'dynamics', direction: 'up' }];
    case 'analytical':return [{ quality: 'warmth', direction: 'up' }, { quality: 'flow', direction: 'up' }];
    case 'compressed':return [{ quality: 'dynamics', direction: 'up' }, { quality: 'punch', direction: 'up' }];
    case 'intimate':  return [{ quality: 'soundstage', direction: 'up' }, { quality: 'air', direction: 'up' }];
    case 'flowing':   return []; // Not typically a complaint
    case 'controlled':return []; // Not typically a complaint
    case 'dynamic':   return []; // Not typically a complaint
    case 'spacious':  return []; // Not typically a complaint
    default:          return [];
  }
}

// ── Summary generation ───────────────────────────────

const TENDENCY_LABELS: Record<Tendency, string> = {
  dense:       'dense and harmonically rich',
  lean:        'lean and lightweight',
  bright:      'bright and treble-forward',
  warm:        'warm and full-bodied',
  relaxed:     'relaxed and laid-back',
  analytical:  'analytical and precision-focused',
  dynamic:     'dynamically energetic',
  compressed:  'dynamically flat',
  flowing:     'musically flowing',
  controlled:  'tightly controlled',
  spacious:    'spatially open',
  intimate:    'spatially intimate',
};

function buildTendencySummary(tendencies: Tendency[]): string | null {
  if (tendencies.length === 0) return null;
  if (tendencies.length === 1) {
    return `Your system currently leans ${TENDENCY_LABELS[tendencies[0]]}.`;
  }
  const labels = tendencies.slice(0, 3).map((t) => TENDENCY_LABELS[t]);
  const last = labels.pop()!;
  return `Your system currently leans ${labels.join(', ')} and ${last}.`;
}

function buildDirectionSummary(arrows: DirectionArrow[]): string | null {
  if (arrows.length === 0) return null;
  const parts = arrows.slice(0, 3).map((a) =>
    a.direction === 'up' ? `more ${a.quality}` : `less ${a.quality}`
  );
  if (parts.length === 1) {
    return `The direction you're describing points toward ${parts[0]}.`;
  }
  const last = parts.pop()!;
  return `The direction you're describing points toward ${parts.join(', ')} and ${last}.`;
}

// ── Public API ───────────────────────────────────────

/**
 * Infer system direction from user text, desire signals, and optionally
 * a known product the user is referencing.
 *
 * Returns directional hints (not scores) that can influence how
 * recommendations and explanations are framed.
 */
export function inferSystemDirection(
  userText: string,
  desires: DesireSignal[],
  knownProduct?: Product | null,
): SystemDirection {
  // ── 1. Infer current tendencies ─────────────────────

  const tendencies: Tendency[] = [];

  // From explicit descriptions / symptoms
  for (const { patterns, tendency } of TENDENCY_PATTERNS) {
    if (patterns.some((p) => p.test(userText))) {
      if (!tendencies.includes(tendency)) {
        tendencies.push(tendency);
      }
    }
  }

  // From known product character (if user mentions gear they own/use)
  const ownershipPatterns = [
    /\bmy\s+/i, /\bi\s+(?:have|own|use|run|got)\b/i,
    /\bi\s+like\s+my\b/i, /\bcurrently\s+(?:using|running)\b/i,
  ];
  const mentionsOwnership = ownershipPatterns.some((p) => p.test(userText));

  if (knownProduct && mentionsOwnership) {
    const productTendencies = tendenciesFromProduct(knownProduct);
    for (const t of productTendencies) {
      if (!tendencies.includes(t)) {
        tendencies.push(t);
      }
    }
  }

  // ── 2. Infer desired directions ─────────────────────

  const desiredDirections: DirectionArrow[] = [];

  // From explicit desires ("want more speed")
  for (const desire of desires) {
    const arrow = desireToArrow(desire);
    if (!desiredDirections.some((d) => d.quality === arrow.quality)) {
      desiredDirections.push(arrow);
    }
  }

  // From symptom tendencies (if user described a problem but didn't
  // express a desire, infer the complementary direction)
  if (desiredDirections.length === 0 && tendencies.length > 0) {
    for (const tendency of tendencies) {
      const implied = desiredDirectionFromTendency(tendency);
      for (const arrow of implied) {
        if (!desiredDirections.some((d) => d.quality === arrow.quality)) {
          desiredDirections.push(arrow);
        }
      }
    }
  }

  // ── 3. Build summaries ──────────────────────────────

  return {
    currentTendencies: tendencies,
    desiredDirections,
    tendencySummary: buildTendencySummary(tendencies),
    directionSummary: buildDirectionSummary(desiredDirections),
  };
}
