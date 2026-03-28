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
import { TURNTABLE_PRODUCTS } from './products/turntables';
import { topTraits } from './taste-profile';

// ── Product catalog ─────────────────────────────────

const ALL_PRODUCTS: Product[] = [
  ...DAC_PRODUCTS,
  ...SPEAKER_PRODUCTS,
  ...(AMPLIFIER_PRODUCTS ?? []),
  ...TURNTABLE_PRODUCTS,
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

// ── Brand resolution ────────────────────────────────

/**
 * Try to find which brand a product name belongs to.
 * Checks if any catalog product's name matches the query term,
 * and also checks a known brand-product mapping for products
 * that aren't in the catalog but have a known brand association.
 */
const KNOWN_BRAND_PRODUCTS: Record<string, string> = {
  'udac': 'LAiV',
  'u-dac': 'LAiV',
  'micro udac': 'LAiV',
};

/**
 * Known product details for items not yet in the full catalog.
 * These are lightweight entries used by the brand-level fallback
 * to provide more specific guidance than raw brand averaging.
 */
interface KnownProductNote {
  brand: string;
  siblingId?: string;   // catalog ID of the closest sibling
  relationship: string; // how this product relates to the sibling
  architecture?: string;
  notes: string;
}

const KNOWN_PRODUCT_NOTES: Record<string, KnownProductNote> = {
  'udac': {
    brand: 'LAiV',
    siblingId: 'laiv-harmony-dac',
    relationship: 'budget sibling',
    architecture: 'Discrete R2R',
    notes: 'Uses the same R2R module as the Harmony DAC but with a less refined power supply. Smaller form factor, lower price point. Stellar reviews suggest it carries much of the Harmony\'s sonic character.',
  },
};

function findBrandForProduct(productName: string): string | undefined {
  const lower = productName.toLowerCase();

  // Check known mapping first
  if (KNOWN_BRAND_PRODUCTS[lower]) {
    return KNOWN_BRAND_PRODUCTS[lower];
  }

  // Check if any catalog product name matches
  for (const p of ALL_PRODUCTS) {
    if (p.name.toLowerCase() === lower) {
      return p.brand;
    }
  }

  return undefined;
}

// ── Brand-level sibling lookup ──────────────────────

/**
 * Find catalog products from the same brand.
 * Used for brand-level assessment when the specific product
 * isn't in the catalog.
 */
function findBrandSiblings(brandName: string): Product[] {
  const lower = brandName.toLowerCase();
  return ALL_PRODUCTS.filter((p) => p.brand.toLowerCase() === lower);
}

/**
 * Synthesize a brand-level sonic profile from sibling products.
 * Returns the dominant traits, architecture, and description
 * from the brand's catalog entries.
 */
function describeBrandCharacter(siblings: Product[]): {
  architecture: string;
  topology: string | undefined;
  traits: Record<string, number>;
  description: string;
  strengths: string[];
} {
  // Average traits across siblings
  const traitSums: Record<string, number> = {};
  const traitCounts: Record<string, number> = {};
  for (const p of siblings) {
    for (const [k, v] of Object.entries(p.traits)) {
      traitSums[k] = (traitSums[k] ?? 0) + v;
      traitCounts[k] = (traitCounts[k] ?? 0) + 1;
    }
  }
  const avgTraits: Record<string, number> = {};
  for (const k of Object.keys(traitSums)) {
    avgTraits[k] = traitSums[k] / traitCounts[k];
  }

  // Find dominant traits (>= 0.7 average)
  const strengths: string[] = [];
  for (const [k, v] of Object.entries(avgTraits)) {
    if (v >= 0.7 && k !== 'fatigue_risk' && k !== 'glare_risk') {
      strengths.push(k.replace(/_/g, ' '));
    }
  }

  // Use the first sibling's architecture as representative
  const arch = siblings[0]?.architecture ?? 'Unknown';
  const topology = siblings[0]?.topology;

  // Build a brand description from sibling descriptions
  const desc = siblings[0]?.description ?? '';

  return { architecture: arch, topology, traits: avgTraits, description: desc, strengths };
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

  // ── Brand sibling data for no-catalog fallback ────
  const productKey = productSubject?.name?.toLowerCase();
  const productNote = productKey ? KNOWN_PRODUCT_NOTES[productKey] : undefined;
  const brandName = candidate?.brand
    ?? productNote?.brand
    ?? brandSubject?.name
    ?? (productSubject ? findBrandForProduct(productSubject.name) : undefined);
  const siblings = brandName ? findBrandSiblings(brandName) : [];
  const brandProfile = siblings.length > 0 ? describeBrandCharacter(siblings) : null;
  const siblingProduct = productNote?.siblingId
    ? ALL_PRODUCTS.find((p) => p.id === productNote.siblingId)
    : siblings[0] ?? null;

  // ── Identify current component in same category ────
  let currentComponent: Product | null = null;
  let currentComponentName: string | undefined;
  // Determine the category to search — from the candidate product, or
  // from the sibling product when working from brand-level data.
  const targetCategory = candidate?.category ?? siblingProduct?.category;
  if (targetCategory && activeSystem) {
    for (const comp of activeSystem.components) {
      const compLower = `${comp.brand} ${comp.name}`.toLowerCase();
      for (const p of ALL_PRODUCTS) {
        if (p.category === targetCategory) {
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
  } else if (brandProfile) {
    // No catalog match but we know the brand — describe brand character
    if (productNote) {
      // We have specific knowledge about this product's relationship to a sibling
      whatChanges.push(productNote.notes);
      if (productNote.architecture) {
        whatChanges.push(`Architecture: ${productNote.architecture}`);
      }
    } else {
      if (brandProfile.architecture) {
        whatChanges.push(
          `${brandName} designs around ${brandProfile.architecture} topology`,
        );
      }
      if (brandProfile.strengths.length > 0) {
        whatChanges.push(
          `Brand's house sound emphasises ${brandProfile.strengths.join(', ')} — the ${candidateName} likely follows this direction`,
        );
      }
    }
    if (currentComponent) {
      const compArch = currentComponent.architecture;
      const brandArch = productNote?.architecture ?? brandProfile.architecture;
      if (compArch !== brandArch) {
        whatChanges.push(
          `Architectural shift from your current ${compArch} (${currentComponentName}) to ${brandArch}`,
        );
      } else {
        whatChanges.push(
          `Shares ${compArch} approach with your current ${currentComponentName} — differences will be in voicing and implementation`,
        );
      }
    }
  } else {
    // Softer phrasing — the product may have been recommended or is simply
    // outside the validated catalog. Avoid implying the system can't help.
    const fallbackName = candidateName !== 'Unknown product' ? candidateName : 'this product';
    whatChanges.push(`${fallbackName} is outside the validated catalog, so this assessment draws on general knowledge of the brand and category rather than measured data`);
  }

  // ── Build "system behavior" ────────────────────────
  const systemBehavior: string[] = [];

  // Use candidate traits directly, or fall back to brand profile traits
  const effectiveTraits = candidate?.traits ?? brandProfile?.traits ?? {};

  if (activeSystem) {
    const chain = activeSystem.components.map((c) => `${c.brand} ${c.name}`);

    // Check for stacking tendencies
    if ((effectiveTraits.tonal_density ?? 0) >= 0.7) {
      const systemHasDensity = activeSystem.components.some((c) => {
        const p = ALL_PRODUCTS.find(
          (prod) => c.name.toLowerCase().includes(prod.name.toLowerCase()),
        );
        return p && (p.traits.tonal_density ?? 0) >= 0.7;
      });
      if (systemHasDensity) {
        systemBehavior.push(
          'Your system already has components with strong tonal density — adding more may push the balance toward warmth',
        );
      } else {
        systemBehavior.push(
          'Would add tonal density and harmonic richness to your chain',
        );
      }
    }

    if ((effectiveTraits.clarity ?? 0) >= 0.7) {
      systemBehavior.push(
        'High clarity will be visible through your chain — ensure downstream components can handle the detail without adding edge',
      );
    }

    if ((effectiveTraits.flow ?? 0) >= 0.7) {
      systemBehavior.push(
        'Flow-oriented character should integrate well with musical listening priorities',
      );
    }

    if ((effectiveTraits.fatigue_risk ?? 0) >= 0.4) {
      systemBehavior.push(
        'Carries some fatigue risk — monitor for listener fatigue in extended sessions',
      );
    } else if ((effectiveTraits.fatigue_risk ?? 0) === 0) {
      systemBehavior.push(
        'Low fatigue risk — suitable for extended listening sessions',
      );
    }

    if (systemBehavior.length === 0) {
      systemBehavior.push(
        `Would sit in your chain as: ${chain.join(' → ')}`,
      );
    }

    // For brand-level assessments with a sibling, add context about the relationship
    if (!candidate && productNote && siblingProduct) {
      systemBehavior.push(
        `Based on the ${siblingProduct.brand} ${siblingProduct.name}'s traits (${productNote.relationship}) — actual behaviour may differ in power supply refinement and fine detail`,
      );
    }
  } else {
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
  } else if (tasteProfile && brandProfile) {
    // Brand-level alignment check using averaged sibling traits
    const topUserTraits = topTraits(tasteProfile, 3).map((t) => t.label);
    const overlap = topUserTraits.filter((t) =>
      brandProfile.strengths.some((s) => s.includes(t.toLowerCase()) || t.toLowerCase().includes(s)),
    );

    if (overlap.length >= 2) {
      goalAlignment = `${brandName}'s design priorities align well with your emphasis on ${overlap.join(' and ')} — this is a philosophically compatible direction`;
    } else if (overlap.length === 1) {
      goalAlignment = `${brandName}'s house sound addresses your interest in ${overlap[0]}. Your other priorities (${topUserTraits.filter((t) => !overlap.includes(t)).join(', ')}) would depend on the specific implementation`;
    } else {
      goalAlignment = `${brandName}'s strengths (${brandProfile.strengths.slice(0, 3).join(', ')}) don't directly overlap with your stated priorities (${topUserTraits.join(', ')}). Worth exploring if you're curious, but not a direct fit for your current direction`;
    }
  } else {
    goalAlignment = 'Share your sonic priorities for a more specific fit assessment';
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
  } else if (productNote && siblingProduct) {
    shortAnswer = `The ${candidateName} is a ${productNote.relationship} of the ${siblingProduct.brand} ${siblingProduct.name} (${productNote.architecture ?? brandProfile?.architecture ?? 'unknown architecture'}). ${productNote.notes.split('.')[0]}.`;
  } else if (brandProfile) {
    shortAnswer = `The ${candidateName} isn't in my catalog, but ${brandName} designs ${brandProfile.architecture} components that emphasise ${brandProfile.strengths.slice(0, 2).join(' and ')}. Assessment is based on the brand's known character.`;
  } else {
    shortAnswer = `I don't have catalog data on the ${candidateName}. If you can share the brand or model details, I can offer a more specific assessment.`;
  }

  // ── Build "recommendation" ─────────────────────────
  let recommendation: string;

  if (!candidate && productNote && siblingProduct) {
    // We have a known product note — give a specific recommendation
    const alignsWell = goalAlignment.includes('align well') || goalAlignment.includes('compatible');
    if (alignsWell) {
      recommendation = `The ${candidateName} is worth exploring — it sits in a philosophically compatible space for your system. The ${productNote.relationship} relationship to the ${siblingProduct.name} suggests similar sonic DNA at a different price point. Auditioning or reading listener impressions would confirm how much of the ${siblingProduct.name}'s refinement carries through.`;
    } else {
      recommendation = `The ${candidateName} carries the ${brandName} house sound. Whether that's the right direction depends on whether you're looking for what ${brandName} does well (${brandProfile?.strengths.slice(0, 2).join(', ') ?? 'their characteristic voicing'}) or something different. Worth researching listener impressions before committing.`;
    }
  } else if (!candidate && brandProfile) {
    recommendation = `I can assess this based on ${brandName}'s known design approach. The brand emphasises ${brandProfile.strengths.slice(0, 2).join(' and ')}, which gives a reasonable baseline. For a precise assessment, listener impressions or an audition would fill in the gaps.`;
  } else if (!candidate) {
    recommendation = 'I don\'t have enough data on this product to offer a confident recommendation. Share the brand or model details and I can say more.';
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
    candidateBrand: candidate?.brand ?? brandName ?? 'Unknown',
    candidateArchitecture: candidate?.architecture ?? productNote?.architecture ?? brandProfile?.architecture,
    candidateDescription: candidate?.description ?? productNote?.notes ?? brandProfile?.description,
    candidateTraits: candidate?.traits ?? (brandProfile ? brandProfile.traits : undefined),
    candidatePrice: candidate?.price,
    candidateTopology: candidate?.topology ?? brandProfile?.topology,
    currentComponentName,
    currentComponentArchitecture: currentComponent?.architecture,
    shortAnswer,
    whatChanges,
    systemBehavior,
    goalAlignment,
    recommendation,
    catalogMatch: candidate !== null,
    retailerLinks: (candidate ?? siblingProduct)?.retailer_links,
    sourceReferences: (candidate ?? siblingProduct)?.sourceReferences,
  };
}
