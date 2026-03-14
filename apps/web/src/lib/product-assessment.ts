/**
 * Product assessment builder.
 *
 * Evaluates a single product in the context of the user's system and
 * listening preferences. Produces a structured ProductAssessment object
 * that the rendering layer displays as an advisory-first response.
 *
 * This is the "Practical Assessment" mode — it fires when a user asks
 * about a specific component ("I'm considering the LAiV uDAC", "would
 * the Qutest work in my system?") rather than requesting category
 * recommendations.
 *
 * Architecture:
 *   - Deterministic inputs (catalog data, system context, taste profile)
 *   - Structured output (ProductAssessment)
 *   - The LLM is NOT called here — it may be used downstream to
 *     synthesize editorial prose from this structured object
 */

import type { Product } from './products/dacs';
import type { SubjectMatch } from './intent';
import type { ActiveSystemContext } from './system-types';
import type { TasteProfile } from './taste-profile';
import type { ProductAssessment, ShoppingAdvisoryContext } from './advisory-response';
import { DAC_PRODUCTS } from './products/dacs';
import { SPEAKER_PRODUCTS } from './products/speakers';
import { AMPLIFIER_PRODUCTS } from './products/amplifiers';
import { topTraits } from './taste-profile';

// ── Product catalog ─────────────────────────────────

const ALL_PRODUCTS: Product[] = [
  ...DAC_PRODUCTS,
  ...SPEAKER_PRODUCTS,
  ...(AMPLIFIER_PRODUCTS ?? []),
];

// ── Product lookup ──────────────────────────────────

/**
 * Find a product by subject matches. Uses the same priority system
 * as gear-response.ts but returns only the best single match.
 */
export function findAssessmentProduct(
  subjectMatches: SubjectMatch[],
): Product | null {
  let bestMatch: Product | null = null;
  let bestScore = 0;

  for (const match of subjectMatches) {
    const lower = match.name.toLowerCase();

    for (const product of ALL_PRODUCTS) {
      const brandLower = product.brand.toLowerCase();
      const nameLower = product.name.toLowerCase();
      const fullLower = `${brandLower} ${nameLower}`;

      let score = 0;
      if (nameLower === lower || fullLower === lower) {
        score = 4;
      } else if (lower.includes(nameLower) && lower.includes(brandLower)) {
        score = 3;
      } else if (lower.includes(nameLower)) {
        score = 2;
      } else if (nameLower.includes(lower)) {
        score = 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }
  }

  return bestMatch;
}

// ── Trait comparison helpers ─────────────────────────

/** Compare trait values between two products, return human-readable deltas. */
function describeTraitDelta(
  candidateTraits: Record<string, number>,
  currentTraits: Record<string, number>,
): string[] {
  const changes: string[] = [];
  const TRAIT_LABELS: Record<string, string> = {
    flow: 'musical flow',
    tonal_density: 'tonal density',
    clarity: 'clarity and resolution',
    dynamics: 'dynamic energy',
    fatigue_risk: 'fatigue risk',
    glare_risk: 'glare risk',
    texture: 'textural richness',
    composure: 'composure and control',
    warmth: 'warmth',
    speed: 'transient speed',
    spatial_precision: 'spatial precision',
    elasticity: 'rhythmic elasticity',
  };

  for (const [key, label] of Object.entries(TRAIT_LABELS)) {
    const cVal = candidateTraits[key] ?? 0;
    const curVal = currentTraits[key] ?? 0;
    const delta = cVal - curVal;

    if (key === 'fatigue_risk' || key === 'glare_risk') {
      if (delta > 0.3) changes.push(`May increase ${label}`);
      else if (delta < -0.3) changes.push(`Should reduce ${label}`);
    } else {
      if (delta > 0.3) changes.push(`Likely adds ${label}`);
      else if (delta < -0.3) changes.push(`May reduce ${label}`);
    }
  }

  return changes;
}

/** Describe a product's sonic character from its traits. */
function describeCharacter(product: Product): string[] {
  const lines: string[] = [];
  const t = product.traits;

  if ((t.flow ?? 0) >= 0.7) lines.push('Prioritizes musical flow and engagement');
  if ((t.tonal_density ?? 0) >= 0.7) lines.push('Strong tonal density and harmonic richness');
  if ((t.clarity ?? 0) >= 0.7) lines.push('High clarity and resolution');
  if ((t.dynamics ?? 0) >= 0.7) lines.push('Dynamic and energetic presentation');
  if ((t.texture ?? 0) >= 0.7) lines.push('Rich textural detail');
  if ((t.composure ?? 0) >= 0.7) lines.push('Composed and controlled');
  if ((t.warmth ?? 0) >= 0.7) lines.push('Warm tonal balance');
  if ((t.speed ?? 0) >= 0.7) lines.push('Fast transient response');
  if ((t.fatigue_risk ?? 0) >= 0.4) lines.push('Some fatigue risk in bright systems');
  if ((t.glare_risk ?? 0) >= 0.4) lines.push('Some glare risk — may add edge');

  if (lines.length === 0) {
    lines.push(product.description.split('.')[0]);
  }

  return lines;
}

// ── Assessment builder ──────────────────────────────

export interface AssessmentContext {
  subjectMatches: SubjectMatch[];
  activeSystem?: ActiveSystemContext | null;
  tasteProfile?: TasteProfile | null;
  advisoryCtx?: ShoppingAdvisoryContext;
  currentMessage: string;
}

/**
 * Build a structured product assessment.
 *
 * Returns null if we can't identify what product the user is asking about.
 * Returns an assessment with catalogMatch=false if the product isn't in
 * the catalog but the brand is recognized.
 */
export function buildProductAssessment(
  ctx: AssessmentContext,
): ProductAssessment | null {
  const { subjectMatches, activeSystem, tasteProfile, advisoryCtx, currentMessage } = ctx;

  // ── Find the candidate product ─────────────────────
  const candidate = findAssessmentProduct(subjectMatches);

  // Extract brand name even if no product match
  const brandSubject = subjectMatches.find((m) => m.kind === 'brand');
  const productSubject = subjectMatches.find((m) => m.kind === 'product');
  const candidateName = candidate
    ? `${candidate.brand} ${candidate.name}`
    : productSubject?.name ?? brandSubject?.name ?? 'Unknown product';

  if (!candidate && !brandSubject && !productSubject) {
    return null; // Can't identify what they're asking about
  }

  // ── Identify current component in same category ────
  let currentComponent: Product | null = null;
  let currentComponentName: string | undefined;
  if (candidate && activeSystem) {
    const category = candidate.category;
    // Try to find the current component in the same category
    for (const comp of activeSystem.components) {
      const compLower = `${comp.brand} ${comp.name}`.toLowerCase();
      for (const p of ALL_PRODUCTS) {
        if (p.category === category) {
          const pFull = `${p.brand} ${p.name}`.toLowerCase();
          if (compLower.includes(p.name.toLowerCase()) || pFull.includes(compLower)) {
            currentComponent = p;
            currentComponentName = `${comp.brand} ${comp.name}`;
            break;
          }
        }
      }
      if (currentComponent) break;
    }
  }

  // ── Build "what changes" ───────────────────────────
  const whatChanges: string[] = [];

  if (candidate && currentComponent) {
    // Architecture delta
    if (candidate.architecture !== currentComponent.architecture) {
      whatChanges.push(
        `Architecture shift: ${currentComponent.architecture} → ${candidate.architecture}`,
      );
    }
    // Trait-level deltas
    whatChanges.push(...describeTraitDelta(candidate.traits, currentComponent.traits));
  } else if (candidate) {
    // No current component to compare — describe the candidate's character
    whatChanges.push(...describeCharacter(candidate));
  } else {
    // No catalog match — provide what we know from the brand
    whatChanges.push('Product not in catalog — assessment is based on brand-level knowledge');
  }

  // ── Build "system behavior" ────────────────────────
  const systemBehavior: string[] = [];

  if (candidate && activeSystem) {
    const chain = activeSystem.components.map((c) => `${c.brand} ${c.name}`);

    // Check for stacking tendencies
    if ((candidate.traits.tonal_density ?? 0) >= 0.7) {
      const systemHasDensity = activeSystem.components.some((c) => {
        const p = ALL_PRODUCTS.find(
          (prod) => c.name.toLowerCase().includes(prod.name.toLowerCase()),
        );
        return p && (p.traits.tonal_density ?? 0) >= 0.7;
      });
      if (systemHasDensity) {
        systemBehavior.push(
          'Your system already has components with strong tonal density — adding more may push the balance too far toward warmth',
        );
      } else {
        systemBehavior.push(
          'Would add tonal density and harmonic richness to your chain',
        );
      }
    }

    if ((candidate.traits.clarity ?? 0) >= 0.7) {
      systemBehavior.push(
        'High clarity will be visible through your chain — ensure downstream components can handle the detail without adding edge',
      );
    }

    if ((candidate.traits.flow ?? 0) >= 0.7) {
      systemBehavior.push(
        'Flow-oriented character should integrate well with musical listening priorities',
      );
    }

    if ((candidate.traits.fatigue_risk ?? 0) >= 0.4) {
      systemBehavior.push(
        'Carries some fatigue risk — monitor for listener fatigue in extended sessions',
      );
    } else if ((candidate.traits.fatigue_risk ?? 0) === 0) {
      systemBehavior.push(
        'Low fatigue risk — suitable for extended listening sessions',
      );
    }

    if (systemBehavior.length === 0) {
      systemBehavior.push(
        `Would sit in your chain as: ${chain.join(' → ')}`,
      );
    }
  } else if (!activeSystem) {
    systemBehavior.push(
      'No system context available — tell me about your amplifier and speakers for a more specific assessment',
    );
  }

  // ── Build "goal alignment" ─────────────────────────
  let goalAlignment: string;

  if (tasteProfile && candidate) {
    const topUserTraits = topTraits(tasteProfile, 3).map((t) => t.label);
    const candidateStrengths: string[] = [];
    for (const [key, val] of Object.entries(candidate.traits)) {
      if (val >= 0.7 && key !== 'fatigue_risk' && key !== 'glare_risk') {
        candidateStrengths.push(key.replace(/_/g, ' '));
      }
    }

    const overlap = topUserTraits.filter((t) =>
      candidateStrengths.some((s) => s.includes(t.toLowerCase()) || t.toLowerCase().includes(s)),
    );

    if (overlap.length >= 2) {
      goalAlignment = `Good alignment with your priorities — matches your emphasis on ${overlap.join(' and ')}`;
    } else if (overlap.length === 1) {
      goalAlignment = `Partial alignment — addresses your interest in ${overlap[0]}, but your other priorities (${topUserTraits.filter((t) => !overlap.includes(t)).join(', ')}) may not be served as directly`;
    } else {
      goalAlignment = `This product's strengths (${candidateStrengths.slice(0, 2).join(', ')}) don't directly map to your stated priorities (${topUserTraits.join(', ')}). That doesn't make it wrong — but consider whether you're exploring a new direction or solving an existing need`;
    }
  } else if (candidate) {
    goalAlignment = 'Tell me about your sonic priorities for a more specific fit assessment';
  } else {
    goalAlignment = 'Without catalog data on this product, I can offer brand-level guidance but not a trait-level assessment';
  }

  // ── Build "short answer" ───────────────────────────
  let shortAnswer: string;

  if (candidate && currentComponent) {
    const archSame = candidate.architecture === currentComponent.architecture;
    const priceDelta = candidate.price - currentComponent.price;
    const traitOverlap = Object.keys(candidate.traits).filter(
      (k) => Math.abs((candidate.traits[k] ?? 0) - (currentComponent!.traits[k] ?? 0)) < 0.2,
    ).length;
    const totalTraits = Object.keys(candidate.traits).length;

    if (archSame && traitOverlap >= totalTraits * 0.7) {
      shortAnswer = `Moving from ${currentComponentName} to ${candidateName} would likely be a refinement rather than a transformational change — both share a ${candidate.architecture} architecture with similar sonic priorities.`;
    } else if (archSame) {
      shortAnswer = `${candidateName} shares the ${candidate.architecture} approach but with a different emphasis — this would shift your system's balance rather than fundamentally change its character.`;
    } else {
      shortAnswer = `This is an architectural shift — ${currentComponent.architecture} to ${candidate.architecture}. The change would meaningfully alter your system's sonic character.`;
    }
  } else if (candidate) {
    shortAnswer = `${candidateName} is a ${candidate.architecture} design priced at ~$${candidate.price.toLocaleString()}. ${candidate.description.split('.')[0]}.`;
  } else {
    shortAnswer = `I don't have detailed catalog data on the ${candidateName}, but I can share what I know from the brand's design approach.`;
  }

  // ── Build "recommendation" ─────────────────────────
  let recommendation: string;

  if (!candidate) {
    recommendation = 'I can provide brand-level guidance, but recommend researching listener impressions and ideally auditioning before committing. If you share the specific model, I may be able to offer more.';
  } else if (candidate && currentComponent) {
    const significantChange = whatChanges.length >= 3;
    const goodAlignment = goalAlignment.startsWith('Good alignment');

    if (significantChange && goodAlignment) {
      recommendation = `This looks like a meaningful and well-aligned move for your system. Worth pursuing if the opportunity is right.`;
    } else if (significantChange && !goodAlignment) {
      recommendation = `This would be a significant change, but it may not directly address your stated priorities. Consider whether you're exploring a new sonic direction or solving a specific need.`;
    } else if (!significantChange && goodAlignment) {
      recommendation = `Aligned with your priorities, but the change may be subtle. Consider whether the improvement justifies the cost and disruption.`;
    } else {
      recommendation = `A modest change that doesn't strongly align with your priorities. Unless you're specifically curious about this design approach, your current component may be serving you well.`;
    }
  } else {
    recommendation = `This looks like a capable product in its tier. Without knowing your current DAC, I'd suggest evaluating how its character (${describeCharacter(candidate).slice(0, 2).join(', ').toLowerCase()}) complements the rest of your chain.`;
  }

  return {
    candidateName,
    candidateBrand: candidate?.brand ?? brandSubject?.name ?? 'Unknown',
    candidateArchitecture: candidate?.architecture,
    candidateDescription: candidate?.description,
    candidateTraits: candidate?.traits,
    candidatePrice: candidate?.price,
    candidateTopology: candidate?.topology,
    currentComponentName,
    currentComponentArchitecture: currentComponent?.architecture,
    shortAnswer,
    whatChanges,
    systemBehavior,
    goalAlignment,
    recommendation,
    catalogMatch: candidate !== null,
  };
}
