/**
 * Deterministic product scoring for shopping recommendations.
 *
 * Scores products by alignment with user-extracted traits, budget,
 * architectural affinity, and system coherence. No LLM, no randomness.
 *
 * Scoring components:
 *   A. Trait alignment    (0–3 pts)  — how well product traits match user preferences
 *   B. Budget fit          (0–1 pt)  — is the product within or near the user's budget
 *   C. Architecture        (0–1 pt)  — does the architecture suit the taste direction
 *   D. System coherence  (−1 to +1)  — does the product complement or worsen system balance
 */

import type { Product } from './products/dacs';
import type { SystemProfile } from './system-profile';
import type { HardConstraints } from './shopping-intent';
import { resolveTraitValue, hasRisk } from './sonic-tendencies';
import type { ListenerProfile } from './listener-profile';
import { computeTastePenalty } from './listener-profile';

// ── Types ─────────────────────────────────────────────

export interface ScoredProduct {
  product: Product;
  score: number;
}

type SignalDirection = 'up' | 'down';

// ── Risk trait identification ─────────────────────────

const RISK_TRAITS = new Set(['fatigue_risk', 'glare_risk']);

// ── Cross-risk map ──────────────────────────────────
// Glare causes fatigue. A user signalling fatigue concern should also
// be protected from glare-flagged products (and vice versa).
const CROSS_RISK: Record<string, string[]> = {
  fatigue_risk: ['glare_risk'],
  glare_risk: ['fatigue_risk'],
};

// ── Architecture affinity map ─────────────────────────
//
// Maps user trait directions to architectures that tend
// to serve that preference. Used for the +1 architecture
// affinity bonus.

const ARCHITECTURE_AFFINITY: Record<string, string[]> = {
  // ── DAC architectures ───────────────────────────────
  // User wants dynamics/speed → multibit, R2R, FPGA tend to deliver
  'dynamics:up': ['multibit', 'R2R', 'FPGA', 'Class AB', 'SoundEngine', 'Goldmund', 'Current-feedback', 'High-feedback'],
  'elasticity:up': ['multibit', 'R2R', 'FPGA', 'Current-feedback', 'Goldmund', 'ZOTL', 'Low-feedback'],
  // User wants clarity → delta-sigma (ESS), FPGA, high-feedback SS tend to deliver
  'clarity:up': ['delta-sigma (ESS)', 'delta-sigma (AKM)', 'FPGA', 'Goldmund', 'SoundEngine', 'Current-feedback', 'Continuity', 'High-feedback', 'Class A'],
  // User wants flow/density → R2R, NOS tube, SET, low-feedback tend to deliver
  'flow:up': ['R2R', 'NOS tube', 'multibit', 'Single-ended triode', 'Push-pull tube', 'ZOTL', 'SIT', 'Low-feedback'],
  'tonal_density:up': ['R2R', 'NOS tube', 'Single-ended triode', 'Push-pull tube', 'SIT', 'Hybrid'],
  // User has fatigue concern → NOS tube, R2R, SET, low-feedback tend to be gentler
  'fatigue_risk:up': ['NOS tube', 'R2R', 'Single-ended triode', 'ZOTL', 'SIT', 'Low-feedback'],
  // User wants composure → delta-sigma (AKM), FPGA, R2R, Class A, high-feedback SS
  'composure:up': ['delta-sigma (AKM)', 'FPGA', 'R2R', 'Continuity', 'Class A', 'SoundEngine', 'High-feedback'],
  // ── Amplifier-centric affinities ───────────────────
  'warmth:up': ['Single-ended triode', 'Push-pull tube', 'SIT', 'Hybrid', 'Low-feedback'],
  'texture:up': ['Single-ended triode', 'ZOTL', 'SIT', 'R2R', 'NOS tube', 'Low-feedback'],
  'speed:up': ['Goldmund', 'Current-feedback', 'SoundEngine', 'FPGA', 'High-feedback', 'Class AB'],
  'spatial_precision:up': ['ZOTL', 'SIT', 'Continuity', 'FPGA', 'Class A', 'Low-feedback'],
};

// ── Scoring functions ─────────────────────────────────

/**
 * Score how well a product's trait tendencies align with the user's
 * extracted signal directions.
 *
 * For regular traits (flow, clarity, dynamics, etc.):
 *   - user 'up' + product value ≥ 0.7 → +1
 *   - user 'up' + product value ≥ 0.4 → +0.5
 *
 * For risk traits (fatigue_risk, glare_risk):
 *   - user 'up' (problem present) + product value ≤ 0.0 → +1 (low risk = good)
 *   - user 'up' + product value ≤ 0.4 → +0.5
 *   - user 'up' + product value ≥ 0.7 → -0.5 (high risk = bad)
 *
 * Capped at 3 points.
 */
function scoreTraitAlignment(
  product: Product,
  userTraits: Record<string, SignalDirection>,
): number {
  let score = 0;
  const tp = product.tendencyProfile;

  for (const [trait, direction] of Object.entries(userTraits)) {
    if (RISK_TRAITS.has(trait)) {
      // Risk traits: user 'up' means problem present → want LOW product risk
      if (direction === 'up') {
        const productHasRisk = hasRisk(tp, product.traits, trait as 'fatigue_risk' | 'glare_risk');
        // Cross-risk: glare causes fatigue, so check related risks too
        const crossRisks = CROSS_RISK[trait] ?? [];
        const productHasCrossRisk = crossRisks.some(
          (cr) => hasRisk(tp, product.traits, cr as 'fatigue_risk' | 'glare_risk'),
        );
        if (productHasRisk) {
          score -= 1.0; // Strong penalty for direct risk match
        } else if (productHasCrossRisk) {
          score -= 0.5; // Moderate penalty for related risk
        } else {
          score += 1;
        }
      }
    } else {
      const productValue = resolveTraitValue(tp, product.traits, trait);
      // Regular traits: user 'up' means want MORE of this
      if (direction === 'up') {
        if (productValue >= 0.7) score += 1;
        else if (productValue >= 0.4) score += 0.5;
      } else {
        // user 'down' means want LESS — products with low values are better
        if (productValue <= 0.0) score += 0.5;
      }
    }
  }

  return Math.min(score, 3);
}

/**
 * Score budget alignment.
 *
 * Two components:
 *   1. Gate score — is this product within budget? (0–1)
 *   2. Utilization bonus — does it USE the budget? (0–1)
 *
 * When someone says "best DAC under $5,000" they expect products that
 * explore the upper reaches of that range, not $699 options with $4,300
 * left over. The utilization bonus rewards products that use 40%+ of
 * the stated budget, peaking at 70–100% utilization.
 *
 * Total range: 0–2 (was 0–1).
 */
function scoreBudgetFit(product: Product, budgetAmount: number): number {
  // ── Gate: is this product affordable? ──
  let gate = 0;
  let effectivePrice = product.price;
  if (product.price <= budgetAmount) {
    gate = 1;
  } else if (product.usedPriceRange && product.usedPriceRange.high <= budgetAmount) {
    gate = 0.75;
    effectivePrice = product.usedPriceRange.high;
  } else {
    // No stretch allowance — budget is a hard constraint.
    // Products above budget (even within 15%) must not appear.
    return 0;
  }

  // ── Utilization: reward products that use the budget ──
  // ratio = price / budget → 0.0 to 1.0+
  // Bonus curve: 0 below 40%, ramps to 1.0 at 70%, stays at 1.0 through 100%
  const ratio = effectivePrice / budgetAmount;
  let utilization = 0;
  if (ratio >= 0.7) {
    utilization = 1.0;
  } else if (ratio >= 0.4) {
    // Linear ramp from 0 at 40% to 1.0 at 70%
    utilization = (ratio - 0.4) / 0.3;
  }

  // ── Proportionality penalty ──
  // Products well below budget get penalised — a $3K amp in a $10K
  // search shouldn't outrank $8K+ gear on trait alignment alone.
  // The penalty ramps from 0 (at 30% of budget) to −2 (at 1%).
  // Products above 30% of budget are unaffected.
  let proportionalityPenalty = 0;
  if (ratio < 0.3) {
    // Linear ramp: −2 at 0%, 0 at 30%
    proportionalityPenalty = -2 * (1 - ratio / 0.3);
  }

  return gate + utilization + proportionalityPenalty;
}

/**
 * Score architecture affinity based on user trait directions.
 *   - If the product's architecture appears in the affinity list
 *     for any of the user's 'up' traits, +1.
 *   - Otherwise 0.
 */
function scoreArchitectureAffinity(
  product: Product,
  userTraits: Record<string, SignalDirection>,
): number {
  for (const [trait, direction] of Object.entries(userTraits)) {
    const key = `${trait}:${direction}`;
    const affinities = ARCHITECTURE_AFFINITY[key];
    if (affinities && affinities.some((arch) => product.architecture.includes(arch))) {
      return 1;
    }
  }
  return 0;
}

/**
 * Score system coherence — how well a product complements (or worsens)
 * the user's existing system balance.
 *
 * This is a nudge, not a gate. Products are never excluded by this
 * score, but they shift up or down in ranking based on whether they'd
 * compound an existing imbalance or help compensate for it.
 *
 *   Bright system + product glare_risk ≥ 0.4 → −1   (compounds brightness)
 *   Bright system + product glare_risk = 0    → +0.5 (compensates)
 *   Warm system   + product tonal_density ≥ 0.7 → −0.5 (compounds warmth)
 *   Warm system   + product clarity ≥ 0.7    → +0.5 (compensates)
 *   Tube amp      + product fatigue_risk ≥ 0.4 → −0.5 (tubes already smooth)
 *   Low-power     + product dynamics ≥ 0.7   → +0.5 (helps dynamics-limited systems)
 *
 * Range: −1 to +1 (clamped).
 */
function scoreSystemCoherence(
  product: Product,
  systemProfile: SystemProfile,
): number {
  let score = 0;
  const tp = product.tendencyProfile;

  // Bright system interactions
  if (systemProfile.systemCharacter === 'bright') {
    if (hasRisk(tp, product.traits, 'glare_risk')) score -= 1;
    else score += 0.5;
  }

  // Warm system interactions
  if (systemProfile.systemCharacter === 'warm') {
    if (resolveTraitValue(tp, product.traits, 'tonal_density') >= 0.7) score -= 0.5;
    if (resolveTraitValue(tp, product.traits, 'clarity') >= 0.7) score += 0.5;
  }

  // Tube amplification — already smooth, penalize products that add fatigue risk
  if (systemProfile.tubeAmplification) {
    if (hasRisk(tp, product.traits, 'fatigue_risk')) score -= 0.5;
  }

  // Low-power context — dynamics-limited, reward products that help
  if (systemProfile.lowPowerContext) {
    if (resolveTraitValue(tp, product.traits, 'dynamics') >= 0.7) score += 0.5;
  }

  return Math.max(-1, Math.min(1, score));
}

// ── Reviewer acclaim ─────────────────────────────────
//
// Products reviewed by trusted, independent audio publications
// receive a small scoring bonus. This surfaces community-loved
// gear over spec-sheet winners.
//
// Trusted sources are independent reviewers/publications known
// for subjective, listening-first evaluation:

const TRUSTED_REVIEWERS = new Set([
  'darko.audio',
  '6moons',
  'twittering machines',
  'the audiophiliac',
  'stereophile',
  'british audiophile',
  'hifi huff',
  'srajan ebaen',        // 6moons editor
  'john darko',
  'steve guttenberg',    // Audiophiliac
  'herb reichert',       // Stereophile
]);

/** Small bonus per trusted reviewer, capped at 0.5. */
function scoreReviewerAcclaim(product: Product): number {
  if (!product.sourceReferences || product.sourceReferences.length === 0) return 0;

  let count = 0;
  for (const ref of product.sourceReferences) {
    const srcLower = ref.source.toLowerCase();
    for (const reviewer of TRUSTED_REVIEWERS) {
      if (srcLower.includes(reviewer)) {
        count++;
        break;
      }
    }
  }

  // 0.15 per trusted source, capped at 0.5
  return Math.min(count * 0.15, 0.5);
}

// ── Public API ────────────────────────────────────────

/**
 * Score a single product against user preferences, budget, and system context.
 */
export function scoreProduct(
  product: Product,
  userTraits: Record<string, SignalDirection>,
  budgetAmount: number | null,
  systemProfile: SystemProfile,
): number {
  let score = 0;

  score += scoreTraitAlignment(product, userTraits);

  if (budgetAmount !== null) {
    score += scoreBudgetFit(product, budgetAmount);
  }

  score += scoreArchitectureAffinity(product, userTraits);
  score += scoreSystemCoherence(product, systemProfile);
  score += scoreReviewerAcclaim(product);

  // ── Soft availability penalty ──────────────────────────
  // Discontinued and vintage products are slightly penalized by default
  // (even without the newOnly hard constraint). This reflects the practical
  // reality that current products are easier to audition, purchase, and
  // service. The penalty is small enough that genuinely excellent
  // discontinued gear still ranks well on trait alignment.
  if (product.availability === 'discontinued') {
    score -= 0.3;
  } else if (product.availability === 'vintage') {
    score -= 0.2; // vintage products often have collector appeal
  }

  return score;
}

/**
 * Score and rank all products, returning them sorted by fit.
 *
 * Budget guard: products pass if their retail price is within budget,
 * OR if they have a usedPriceRange whose high end is within budget.
 * This allows community favorites like the Chord Qutest ($1,295 new,
 * ~$800-1000 used) to appear in "under $1000" queries.
 */
export function rankProducts(
  products: Product[],
  userTraits: Record<string, SignalDirection>,
  budgetAmount: number | null,
  systemProfile: SystemProfile,
  constraints?: HardConstraints,
  listenerProfile?: ListenerProfile,
): ScoredProduct[] {
  // Budget filter — hard constraint, no stretch allowance.
  // Used-market pricing qualifies a product only if the new price
  // is within 2× budget (prevents $5000 products appearing in $1500 searches
  // just because they can be found used for $1400).
  let candidates = budgetAmount
    ? products.filter((p) => {
        if (p.price <= budgetAmount) return true;
        if (p.usedPriceRange && p.usedPriceRange.high <= budgetAmount && p.price <= budgetAmount * 2) return true;
        return false;
      })
    : products;

  // ── Hard compatibility filter: active speakers vs. existing amp ──
  // When the user's chain already contains external amplification, active /
  // powered / wireless speakers (those carrying their own amps) are
  // architecturally incompatible as a primary recommendation — buying one
  // would duplicate amplification and leave the existing amp unused. Exclude
  // these products unconditionally. This gate runs before every other filter
  // so no downstream scoring bonus can rescue an incompatible product.
  if (systemProfile.hasExternalAmplification) {
    const before = candidates.length;
    const excluded: string[] = [];
    candidates = candidates.filter((p) => {
      if (p.activeAmplification) {
        excluded.push(`${p.brand} ${p.name}`);
        return false;
      }
      return true;
    });
    if (candidates.length < before) {
      console.log('[compat-filter] excluded %d active speaker(s) (user has external amp): %s',
        before - candidates.length, excluded.join(', '));
    }
  }

  // ── Hard constraint filters ──────────────────────────
  // These are user-stated requirements that act as gates, not preferences.
  if (constraints) {
    // Topology exclusion: "no tubes" → exclude set, push-pull-tube
    if (constraints.excludeTopologies.length > 0) {
      candidates = candidates.filter((p) =>
        !p.topology || !constraints.excludeTopologies.includes(p.topology),
      );
    }

    // Topology requirement: "class AB only" → only class-ab-solid-state
    if (constraints.requireTopologies.length > 0) {
      candidates = candidates.filter((p) =>
        p.topology && constraints.requireTopologies.includes(p.topology),
      );
    }

    // Availability: "I want new" → exclude discontinued/vintage
    if (constraints.newOnly) {
      candidates = candidates.filter((p) =>
        !p.availability || p.availability === 'current',
      );
    }

    // Availability: "used only" → only discontinued/vintage
    if (constraints.usedOnly) {
      candidates = candidates.filter((p) =>
        p.availability === 'discontinued' || p.availability === 'vintage',
      );
    }
  }

  if (candidates.length === 0) return [];

  // ── Taste-based filtering (listener profile) ────────
  // Apply taste penalties from the accumulated listener profile.
  // Disliked brands are effectively removed (penalty = -3).
  // Products contradicting inferred taste get soft penalties.
  const removedByTaste: string[] = [];
  const penalizedByTaste: string[] = [];

  // Hard removal fires at ANY confidence — explicit dislikes are unconditional.
  if (listenerProfile) {
    // Hard removal: disliked brands
    const dislikedBrands = new Set(listenerProfile.dislikedBrands);
    if (dislikedBrands.size > 0) {
      const before = candidates.length;
      candidates = candidates.filter((p) => {
        if (dislikedBrands.has(p.brand.toLowerCase())) {
          removedByTaste.push(`${p.brand} ${p.name} (disliked brand)`);
          return false;
        }
        return true;
      });
      if (candidates.length < before) {
        console.log('[taste-filter] removed %d products from disliked brands: %s',
          before - candidates.length, removedByTaste.join(', '));
      }
    }

    // Hard removal: disliked products
    const dislikedProducts = listenerProfile.dislikedProducts;
    if (dislikedProducts.length > 0) {
      candidates = candidates.filter((p) => {
        const fullName = `${p.brand} ${p.name}`.toLowerCase();
        const isDisliked = dislikedProducts.some((dp) =>
          fullName.includes(dp) || dp.includes(fullName),
        );
        if (isDisliked) {
          removedByTaste.push(`${p.brand} ${p.name} (disliked product)`);
        }
        return !isDisliked;
      });
    }
  }

  if (candidates.length === 0) return [];

  // ── Liked-brand boost setup ─────────────────────────
  // Meaningful directional boost for brands the user explicitly likes.
  // At +0.8, this is strong enough to shift ranking by 1–3 positions but
  // not so large that it overpowers trait alignment or budget fit. A product
  // with poor trait fit won't become anchor just because the brand is liked.
  // Asymmetric with −3.0 dislike (removal).
  const LIKED_BRAND_BOOST = 0.8;
  const likedBrandSet = listenerProfile
    ? new Set(listenerProfile.likedBrands)
    : new Set<string>();
  const boostedByTaste: string[] = [];

  const scored = candidates
    .map((product) => {
      let score = scoreProduct(product, userTraits, budgetAmount, systemProfile);

      // Apply taste penalties (soft scoring, not hard removal)
      if (listenerProfile && listenerProfile.confidence >= 0.1) {
        const { penalty, reasons } = computeTastePenalty(product, listenerProfile);
        if (penalty < 0) {
          score += penalty;
          penalizedByTaste.push(`${product.brand} ${product.name} (${penalty.toFixed(1)}: ${reasons.join('; ')})`);
        }
      }

      // Liked-brand boost: positive nudge for brands the user has expressed affinity for
      if (likedBrandSet.size > 0 && likedBrandSet.has(product.brand.toLowerCase())) {
        score += LIKED_BRAND_BOOST;
        boostedByTaste.push(`${product.brand} ${product.name} (+${LIKED_BRAND_BOOST})`);
      }

      return { product, score };
    })
    .sort((a, b) => b.score - a.score);

  if (removedByTaste.length > 0 || penalizedByTaste.length > 0 || boostedByTaste.length > 0) {
    console.log('[taste-filter]', {
      inferredTraits: listenerProfile
        ? Object.entries(listenerProfile.inferredTraits)
            .filter(([, v]) => v > 0.1)
            .map(([k, v]) => `${k}:${(v as number).toFixed(2)}`)
        : 'none',
      removedProducts: removedByTaste,
      penalizedProducts: penalizedByTaste,
      boostedProducts: boostedByTaste,
    });
  }

  return scored;
}

// ── Amplifier Architecture Sonic Tendencies ──────────
//
// Maps amplifier architecture labels to their typical sonic
// tendencies. Each entry lists traits the architecture tends
// to emphasize (+) and de-emphasize (−). Used by the system
// delta reasoning layer to predict sonic impact.
//
// These are editorial observations grounded in design physics
// and listener consensus — not measurements.

export interface ArchitectureTendency {
  label: string;
  /** Traits this architecture typically emphasizes. */
  strengths: string[];
  /** Traits this architecture typically de-emphasizes or sacrifices. */
  weaknesses: string[];
  /** Short design-physics explanation. */
  rationale: string;
}

export const AMPLIFIER_ARCHITECTURE_TENDENCIES: Record<string, ArchitectureTendency> = {
  'Single-ended triode': {
    label: 'SET tube',
    strengths: ['tonal_density', 'flow', 'texture', 'warmth'],
    weaknesses: ['dynamics', 'composure', 'speed'],
    rationale: 'Even-order harmonic distortion enriches midrange; low power limits bass control and dynamic headroom.',
  },
  'Push-pull tube': {
    label: 'Push-pull tube',
    strengths: ['tonal_density', 'warmth', 'dynamics', 'flow'],
    weaknesses: ['speed', 'clarity'],
    rationale: 'Cancels even-order distortion for more power and dynamics while retaining tube-family tonal character.',
  },
  'SIT': {
    label: 'SIT / single-ended transistor',
    strengths: ['texture', 'spatial_precision', 'flow', 'tonal_density'],
    weaknesses: ['dynamics', 'composure'],
    rationale: 'Static induction transistors produce tube-like harmonic structure with solid-state linearity. Very low power.',
  },
  'Class A': {
    label: 'Class A solid-state',
    strengths: ['composure', 'clarity', 'spatial_precision', 'warmth'],
    weaknesses: ['speed', 'dynamics'],
    rationale: 'Constant bias eliminates crossover distortion; lower efficiency trades power for refinement.',
  },
  'Class AB': {
    label: 'Class AB solid-state',
    strengths: ['dynamics', 'speed', 'composure', 'clarity'],
    weaknesses: ['tonal_density', 'warmth'],
    rationale: 'High current delivery and wide bandwidth. Crossover distortion minimized but present.',
  },
  'Low-feedback': {
    label: 'Low-feedback solid-state',
    strengths: ['flow', 'texture', 'elasticity', 'warmth'],
    weaknesses: ['composure', 'clarity'],
    rationale: 'Minimal negative feedback preserves musical elasticity at the cost of measured precision.',
  },
  'High-feedback': {
    label: 'High-feedback solid-state',
    strengths: ['clarity', 'composure', 'speed', 'dynamics'],
    weaknesses: ['flow', 'warmth', 'texture'],
    rationale: 'Deep feedback loop lowers distortion and output impedance for precise, controlled sound.',
  },
  'Hybrid': {
    label: 'Hybrid (tube input / SS output)',
    strengths: ['tonal_density', 'warmth', 'dynamics'],
    weaknesses: ['texture', 'spatial_precision'],
    rationale: 'Tube input stage shapes harmonic character; solid-state output provides current and control.',
  },
  'ZOTL': {
    label: 'ZOTL (zero-hysteresis OTL)',
    strengths: ['spatial_precision', 'texture', 'flow', 'clarity'],
    weaknesses: ['warmth', 'tonal_density'],
    rationale: 'Transformer-less output with impedance conversion via RF carrier. Unusually linear for a tube topology.',
  },
  'Goldmund': {
    label: 'Goldmund / JOB minimalist',
    strengths: ['speed', 'dynamics', 'elasticity', 'clarity'],
    weaknesses: ['tonal_density', 'warmth'],
    rationale: 'Ultra-short signal path, minimal gain stages. Maximizes transient speed and rhythmic articulation.',
  },
  'Current-feedback': {
    label: 'Current-feedback',
    strengths: ['speed', 'elasticity', 'dynamics', 'clarity'],
    weaknesses: ['warmth', 'tonal_density'],
    rationale: 'Current-mode feedback topology provides bandwidth independence from gain, yielding exceptional transient speed.',
  },
  'Continuity': {
    label: 'Continuity (Schiit)',
    strengths: ['composure', 'clarity', 'spatial_precision'],
    weaknesses: ['warmth', 'texture'],
    rationale: 'Proprietary Class A topology eliminates crossover distortion with higher efficiency than traditional Class A.',
  },
};
