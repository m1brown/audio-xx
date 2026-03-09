/**
 * Deterministic product scoring for shopping recommendations.
 *
 * Scores products by alignment with user-extracted traits, budget,
 * and architectural affinity. No LLM, no randomness.
 *
 * Scoring components:
 *   A. Trait alignment  (0–3 pts)  — how well product traits match user preferences
 *   B. Budget fit        (0–1 pt)  — is the product within or near the user's budget
 *   C. Architecture      (0–1 pt)  — does the architecture suit the taste direction
 */

import type { Product } from './products/dacs';

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

  for (const [trait, direction] of Object.entries(userTraits)) {
    const productValue = product.traits[trait];
    if (productValue === undefined) continue;

    if (RISK_TRAITS.has(trait)) {
      // Risk traits: user 'up' means problem present → want LOW product risk
      if (direction === 'up') {
        if (productValue <= 0.0) score += 1;
        else if (productValue <= 0.4) score += 0.5;
        else if (productValue >= 0.7) score -= 0.5;
      }
    } else {
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

// ── Public API ────────────────────────────────────────

/**
 * Score a single product against user preferences and budget.
 */
export function scoreProduct(
  product: Product,
  userTraits: Record<string, SignalDirection>,
  budgetAmount: number | null,
): number {
  let score = 0;

  score += scoreTraitAlignment(product, userTraits);

  if (budgetAmount !== null) {
    score += scoreBudgetFit(product.price, budgetAmount);
  }

  score += scoreArchitectureAffinity(product, userTraits);

  return score;
}

/**
 * Score and rank all products, returning them sorted by fit.
 * Filters to products within budget (with 30% flexibility for
 * the candidate pool, scored by exact fit).
 */
export function rankProducts(
  products: Product[],
  userTraits: Record<string, SignalDirection>,
  budgetAmount: number | null,
): ScoredProduct[] {
  // Filter candidate pool by budget (with generous margin for pool selection)
  const candidates = budgetAmount
    ? products.filter((p) => p.price <= budgetAmount * 1.3)
    : products;

  // If budget filter is too tight, include all products
  const pool = candidates.length >= 3 ? candidates : products;

  return pool
    .map((product) => ({
      product,
      score: scoreProduct(product, userTraits, budgetAmount),
    }))
    .sort((a, b) => b.score - a.score);
}
