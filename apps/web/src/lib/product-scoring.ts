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
import { resolveTraitValue, hasRisk } from './sonic-tendencies';

// ── Types ─────────────────────────────────────────────

export interface ScoredProduct {
  product: Product;
  score: number;
}

type SignalDirection = 'up' | 'down';

// ── Risk trait identification ─────────────────────────

const RISK_TRAITS = new Set(['fatigue_risk', 'glare_risk']);

// ── Architecture affinity map ─────────────────────────
//
// Maps user trait directions to architectures that tend
// to serve that preference. Used for the +1 architecture
// affinity bonus.

const ARCHITECTURE_AFFINITY: Record<string, string[]> = {
  // User wants dynamics/speed → multibit, R-2R, FPGA tend to deliver
  'dynamics:up': ['multibit', 'R-2R', 'FPGA'],
  'elasticity:up': ['multibit', 'R-2R', 'FPGA'],
  // User wants clarity → delta-sigma (ESS), FPGA tend to deliver
  'clarity:up': ['delta-sigma (ESS)', 'delta-sigma (AKM)', 'FPGA'],
  // User wants flow/density → R-2R, NOS tube tend to deliver
  'flow:up': ['R-2R', 'NOS tube', 'multibit'],
  'tonal_density:up': ['R-2R', 'NOS tube'],
  // User has fatigue concern → NOS tube, R-2R tend to be gentler
  'fatigue_risk:up': ['NOS tube', 'R-2R'],
  // User wants composure → delta-sigma (AKM), FPGA, R-2R
  'composure:up': ['delta-sigma (AKM)', 'FPGA', 'R-2R'],
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
        if (productHasRisk) {
          score -= 0.5;
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
 *   - Within budget: +1
 *   - Within 15% overshoot: +0.5
 *   - Over budget: 0
 */
function scoreBudgetFit(price: number, budgetAmount: number): number {
  if (price <= budgetAmount) return 1;
  if (price <= budgetAmount * 1.15) return 0.5;
  return 0;
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
    score += scoreBudgetFit(product.price, budgetAmount);
  }

  score += scoreArchitectureAffinity(product, userTraits);
  score += scoreSystemCoherence(product, systemProfile);

  return score;
}

/**
 * Score and rank all products, returning them sorted by fit.
 *
 * Hard budget guard: only products where price <= budget enter the
 * candidate pool. If no products pass, returns an empty array.
 * No over-budget products are ever returned.
 */
export function rankProducts(
  products: Product[],
  userTraits: Record<string, SignalDirection>,
  budgetAmount: number | null,
  systemProfile: SystemProfile,
): ScoredProduct[] {
  // Hard budget filter — no exceptions
  const candidates = budgetAmount
    ? products.filter((p) => p.price <= budgetAmount)
    : products;

  if (candidates.length === 0) return [];

  return candidates
    .map((product) => ({
      product,
      score: scoreProduct(product, userTraits, budgetAmount, systemProfile),
    }))
    .sort((a, b) => b.score - a.score);
}
