/**
 * Gear response builder.
 *
 * Produces conversational responses for gear inquiries and comparisons.
 * These bypass the diagnostic engine entirely — no verdicts, no scoring,
 * just neutral descriptions and natural follow-up questions.
 */

import type { GearResponse } from './conversation-types';
import type { UserIntent } from './intent';
import { DAC_PRODUCTS, type Product } from './products/dacs';

// ── Product lookup ───────────────────────────────────

/** All known products across categories (extend as more catalogs are added). */
const ALL_PRODUCTS: Product[] = [...DAC_PRODUCTS];

function findProducts(subjects: string[]): Product[] {
  if (subjects.length === 0) return [];
  const found: Product[] = [];
  for (const subject of subjects) {
    const lower = subject.toLowerCase();
    for (const product of ALL_PRODUCTS) {
      const brandLower = product.brand.toLowerCase();
      const nameLower = product.name.toLowerCase();
      if (
        brandLower === lower ||
        nameLower === lower ||
        `${brandLower} ${nameLower}`.includes(lower) ||
        lower.includes(brandLower) ||
        lower.includes(nameLower)
      ) {
        // Avoid duplicates
        if (!found.some((p) => p.id === product.id)) {
          found.push(product);
        }
      }
    }
  }
  return found;
}

// ── Description helpers ──────────────────────────────

/** One-sentence character sketch from product traits. */
function characterSketch(product: Product): string {
  const traits = product.traits;
  const strengths: string[] = [];
  const cautions: string[] = [];

  if ((traits.flow ?? 0) >= 0.7) strengths.push('musical flow');
  if ((traits.tonal_density ?? 0) >= 0.7) strengths.push('tonal richness');
  if ((traits.clarity ?? 0) >= 0.7) strengths.push('clarity');
  if ((traits.dynamics ?? 0) >= 0.7) strengths.push('dynamic punch');
  if ((traits.texture ?? 0) >= 0.7) strengths.push('textural detail');
  if ((traits.composure ?? 0) >= 0.7) strengths.push('composure');
  if ((traits.fatigue_risk ?? 0) >= 0.4) cautions.push('can lean forward in bright systems');
  if ((traits.glare_risk ?? 0) >= 0.4) cautions.push('may show some edge in the treble');

  let sketch = product.description;
  if (strengths.length > 0) {
    sketch += ` Its strengths lean toward ${strengths.join(' and ')}.`;
  }
  if (cautions.length > 0) {
    sketch += ` Worth noting: ${cautions.join('; ')}.`;
  }
  return sketch;
}

/** Brief comparison sketch between two products. */
function comparisonSketch(a: Product, b: Product): string {
  const diffs: string[] = [];

  const flowDiff = (a.traits.flow ?? 0) - (b.traits.flow ?? 0);
  if (Math.abs(flowDiff) >= 0.3) {
    diffs.push(
      flowDiff > 0
        ? `The ${a.name} leans more toward musical flow, while the ${b.name} is more measured`
        : `The ${b.name} leans more toward musical flow, while the ${a.name} is more measured`
    );
  }

  const clarityDiff = (a.traits.clarity ?? 0) - (b.traits.clarity ?? 0);
  if (Math.abs(clarityDiff) >= 0.3) {
    diffs.push(
      clarityDiff > 0
        ? `the ${a.name} emphasizes clarity and precision more`
        : `the ${b.name} emphasizes clarity and precision more`
    );
  }

  const densityDiff = (a.traits.tonal_density ?? 0) - (b.traits.tonal_density ?? 0);
  if (Math.abs(densityDiff) >= 0.3) {
    diffs.push(
      densityDiff > 0
        ? `the ${a.name} carries more tonal weight`
        : `the ${b.name} carries more tonal weight`
    );
  }

  const dynamicsDiff = (a.traits.dynamics ?? 0) - (b.traits.dynamics ?? 0);
  if (Math.abs(dynamicsDiff) >= 0.3) {
    diffs.push(
      dynamicsDiff > 0
        ? `the ${a.name} has more dynamic punch`
        : `the ${b.name} has more dynamic punch`
    );
  }

  if (diffs.length === 0) {
    return `The ${a.brand} ${a.name} and ${b.brand} ${b.name} are closer than you might expect — they share a similar balance. The main differences come down to architecture: the ${a.name} uses ${a.architecture} while the ${b.name} uses ${b.architecture}.`;
  }

  return `These represent different design approaches. ${diffs.join('; ')}. The ${a.name} uses ${a.architecture}, the ${b.name} uses ${b.architecture}.`;
}

// ── Follow-up question templates ─────────────────────

const GEAR_FOLLOW_UPS = [
  'What kind of system would it be going into?',
  'Are you considering it for a specific system, or more of a general interest?',
  'What are you looking for it to bring to your listening — more engagement, more refinement, or something else?',
  'What do you value most in your listening — rhythm and energy, or tone and texture?',
];

const COMPARISON_FOLLOW_UPS = [
  'What matters most to you — engagement, refinement, or tonal character?',
  'Are these going into a specific system? That would help me gauge which design approach fits better.',
  'Is there anything about your current setup you\'re hoping to shift?',
];

const GENERIC_FOLLOW_UPS = [
  'What are you pairing it with, and what do you value most in your listening?',
  'Are you considering this for a specific system, or exploring options?',
];

function pickFollowUp(options: string[], seed: number): string {
  return options[seed % options.length];
}

// ── Public API ───────────────────────────────────────

/**
 * Build a conversational response for a gear inquiry or comparison.
 * Returns null if the intent doesn't match (caller should use a different path).
 */
export function buildGearResponse(
  intent: UserIntent,
  subjects: string[],
  currentMessage: string,
): GearResponse | null {
  if (intent !== 'gear_inquiry' && intent !== 'comparison') return null;

  const products = findProducts(subjects);
  const seed = currentMessage.length; // deterministic pseudo-random

  // ── Comparison ──────────────────────────────────────
  if (intent === 'comparison') {
    if (products.length >= 2) {
      return {
        intent,
        subjects,
        acknowledge: `Good question — those are both well-regarded but come from different design philosophies.`,
        description: comparisonSketch(products[0], products[1]),
        followUp: pickFollowUp(COMPARISON_FOLLOW_UPS, seed),
      };
    }

    // Comparison intent but we don't have both products in catalog
    if (subjects.length >= 2) {
      return {
        intent,
        subjects,
        acknowledge: `Those come from different corners of the market.`,
        description: `I don't have detailed profiles for both, but the comparison often comes down to design philosophy — what the designer chose to prioritize. Architecture, feedback topology, and output stage all shape the sound differently.`,
        followUp: pickFollowUp(COMPARISON_FOLLOW_UPS, seed),
      };
    }

    // Single subject mentioned with comparison language
    return {
      intent,
      subjects,
      acknowledge: 'Comparisons are always system-dependent.',
      description: products.length > 0
        ? characterSketch(products[0])
        : 'The right comparison depends on what alternatives you have in mind and what you\'re optimizing for.',
      followUp: 'What are you comparing it against, and what does your system look like?',
    };
  }

  // ── Gear inquiry ────────────────────────────────────
  if (products.length > 0) {
    const product = products[0];
    // Known product — give a real character description
    return {
      intent,
      subjects,
      acknowledge: `The ${product.brand} ${product.name} is a well-known piece.`,
      description: characterSketch(product),
      followUp: pickFollowUp(GEAR_FOLLOW_UPS, seed),
    };
  }

  if (subjects.length > 0) {
    // Known brand but no specific product in catalog
    const brandName = subjects[0].charAt(0).toUpperCase() + subjects[0].slice(1);
    return {
      intent,
      subjects,
      acknowledge: `${brandName} is a name that comes up often in these conversations.`,
      description: `I don't have a detailed product profile for that specific model, but the brand has a recognizable design approach. The best way to evaluate fit is relative to your system and preferences.`,
      followUp: pickFollowUp(GENERIC_FOLLOW_UPS, seed),
    };
  }

  // Gear inquiry without any identifiable subject — shouldn't normally happen
  return {
    intent,
    subjects: [],
    acknowledge: 'Interesting question.',
    description: 'The answer depends a lot on system context and what you value in your listening.',
    followUp: pickFollowUp(GENERIC_FOLLOW_UPS, seed),
  };
}
