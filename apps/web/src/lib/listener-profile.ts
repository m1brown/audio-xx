/**
 * Listener Profile Engine — taste memory across conversation turns.
 *
 * Accumulates listener preferences from:
 *   - Explicit product likes/dislikes ("I like the JBL L100 Classic")
 *   - Brand preferences ("I prefer DeVore")
 *   - Inferred traits from product metadata
 *
 * The profile persists across turns within a session and influences
 * future recommendations via effectiveTaste.
 *
 * Design:
 *   - Lightweight and deterministic — no LLM involvement
 *   - Additive: each signal nudges trait values, never resets them
 *   - Confidence grows with each signal, capped at 1.0
 *   - Product traits are resolved from the catalog (not hallucinated)
 */

import type { Product } from './products/dacs';
import { DAC_PRODUCTS } from './products/dacs';
import { SPEAKER_PRODUCTS } from './products/speakers';
import { AMPLIFIER_PRODUCTS } from './products/amplifiers';
import { HEADPHONE_PRODUCTS } from './products/headphones';
import { TURNTABLE_PRODUCTS } from './products/turntables';
import { resolveTraitValue } from './sonic-tendencies';
import type { ProfileTraitKey, TasteProfile } from './taste-profile';
import type { SignalDirection } from './signal-types';

// ── Combined catalog for product lookup ──────────────

const ALL_CATALOG: Product[] = [
  ...DAC_PRODUCTS,
  ...SPEAKER_PRODUCTS,
  ...AMPLIFIER_PRODUCTS,
  ...(HEADPHONE_PRODUCTS ?? []),
  ...(TURNTABLE_PRODUCTS ?? []),
];

// ── Trait keys that map to ProfileTraitKey ────────────

/** Maps product-level trait names → ProfileTraitKey equivalents. */
const TRAIT_TO_PROFILE: Record<string, ProfileTraitKey> = {
  flow: 'flow',
  clarity: 'clarity',
  dynamics: 'dynamics',
  tonal_density: 'tonal_density',
  warmth: 'warmth',
  rhythm: 'rhythm',
  elasticity: 'rhythm',          // elasticity → rhythm family
  texture: 'clarity',            // texture → clarity family
  speed: 'rhythm',               // speed → rhythm family
  openness: 'spatial_depth',
  spatial_precision: 'spatial_depth',
  composure: 'flow',             // composure → flow family
};

/** The 7 canonical profile traits. */
const PROFILE_KEYS: ProfileTraitKey[] = [
  'flow', 'clarity', 'rhythm', 'tonal_density', 'spatial_depth', 'dynamics', 'warmth',
];

// ── Core Types ───────────────────────────────────────

export interface InferredTraits {
  flow: number;
  clarity: number;
  rhythm: number;
  tonal_density: number;
  spatial_depth: number;
  dynamics: number;
  warmth: number;
}

export interface ListenerProfile {
  likedProducts: string[];
  dislikedProducts: string[];
  likedBrands: string[];
  dislikedBrands: string[];
  inferredTraits: InferredTraits;
  /** Human-readable log of what signals shaped this profile. */
  sourceSignals: string[];
  /** 0–1: how confident we are in the profile. Grows with each signal. */
  confidence: number;
}

export interface EffectiveTaste {
  /** Merged trait weights (0–1 per trait). */
  traits: Record<ProfileTraitKey, number>;
  /** Dominant archetype direction label, if clear. */
  direction: string | null;
  /** Human-readable summary of the merged taste. */
  summary: string;
}

// ── Factory ──────────────────────────────────────────

export function createEmptyListenerProfile(): ListenerProfile {
  return {
    likedProducts: [],
    dislikedProducts: [],
    likedBrands: [],
    dislikedBrands: [],
    inferredTraits: {
      flow: 0,
      clarity: 0,
      rhythm: 0,
      tonal_density: 0,
      spatial_depth: 0,
      dynamics: 0,
      warmth: 0,
    },
    sourceSignals: [],
    confidence: 0,
  };
}

// ── Product name aliases ────────────────────────────
// Maps common user-facing names to catalog product names.
// Applied before fuzzy matching so "Ares II" resolves correctly, etc.
const PRODUCT_NAME_ALIASES: Record<string, string> = {
  'ares': 'denafrips ares 15th',
  'ares 15th': 'denafrips ares 15th',
  'denafrips ares': 'denafrips ares 15th',
  'ares ii': 'denafrips ares 15th',
  'ares 2': 'denafrips ares 15th',
  'ares 12th-1': 'denafrips ares 15th',
  'enyo': 'denafrips enyo 15th',
  'enyo 15th': 'denafrips enyo 15th',
  'denafrips enyo': 'denafrips enyo 15th',
  'pontus': 'denafrips pontus ii 12th-1',
  'pontus ii': 'denafrips pontus ii 12th-1',
  'denafrips pontus': 'denafrips pontus ii 12th-1',
  'terminator': 'denafrips terminator ii',
  'terminator ii': 'denafrips terminator ii',
  'denafrips terminator': 'denafrips terminator ii',
  'venus': 'denafrips venus ii',
  'venus ii': 'denafrips venus ii',
  'denafrips venus': 'denafrips venus ii',
  'bifrost': 'schiit bifrost 2/64',
  'bifrost 2': 'schiit bifrost 2/64',
  'schiit bifrost': 'schiit bifrost 2/64',
  'bifrost 2/64': 'schiit bifrost 2/64',
  'gungnir': 'schiit gungnir multibit',
  'yggdrasil': 'schiit yggdrasil',
};

/**
 * Normalize a product name through the alias map.
 * If the entire input (lowercased) matches an alias key, replace it.
 * Also checks if the input *contains* an alias key and substitutes.
 */
export function resolveProductAlias(normalized: string): string {
  // Exact alias match (most common case)
  if (PRODUCT_NAME_ALIASES[normalized]) return PRODUCT_NAME_ALIASES[normalized];
  // Partial: input contains an alias key (e.g., "the denafrips ares dac")
  for (const [alias, canonical] of Object.entries(PRODUCT_NAME_ALIASES)) {
    if (normalized.includes(alias)) {
      return normalized.replace(alias, canonical);
    }
  }
  return normalized;
}

// ── Product lookup ───────────────────────────────────

/**
 * Find a product in the catalog by name (case-insensitive, fuzzy).
 * Returns null if no reasonable match found.
 */
export function findCatalogProduct(name: string): Product | null {
  const normalized = resolveProductAlias(name.toLowerCase().trim());
  if (!normalized) return null;

  let bestMatch: Product | null = null;
  let bestScore = 0;

  for (const p of ALL_CATALOG) {
    const brandLower = p.brand.toLowerCase();
    const nameLower = p.name.toLowerCase();
    const fullLower = `${brandLower} ${nameLower}`;

    let score = 0;

    // Exact full match
    if (normalized === fullLower) score = 100;
    // Input contains both brand and name
    else if (normalized.includes(nameLower) && normalized.includes(brandLower)) score = 90;
    // Name-only match (e.g., "L100 Classic" matches "JBL L100 Classic")
    else if (normalized.includes(nameLower) && nameLower.length >= 4) score = 75;
    // Full product name contains input (e.g., "l100" in "l100 classic")
    else if (fullLower.includes(normalized) && normalized.length >= 4) score = 70;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  }

  return bestScore >= 50 ? bestMatch : null;
}

/**
 * Find products by brand name.
 * Returns all products from a matching brand.
 */
function findProductsByBrand(brandName: string): Product[] {
  const normalized = brandName.toLowerCase().trim();
  return ALL_CATALOG.filter((p) => p.brand.toLowerCase() === normalized);
}

// ── Trait extraction from product ────────────────────

/**
 * Extract profile-mapped trait values from a product.
 * Returns 0–1 values for each ProfileTraitKey.
 */
function extractProductTraits(product: Product): InferredTraits {
  const traits: InferredTraits = {
    flow: 0, clarity: 0, rhythm: 0,
    tonal_density: 0, spatial_depth: 0, dynamics: 0, warmth: 0,
  };

  // Resolve each product trait and map to profile trait
  for (const [productTrait, profileKey] of Object.entries(TRAIT_TO_PROFILE)) {
    const value = resolveTraitValue(product.tendencyProfile, product.traits, productTrait);
    // Take the max if multiple product traits map to the same profile key
    if (value > traits[profileKey]) {
      traits[profileKey] = value;
    }
  }

  return traits;
}

/**
 * Average the traits of multiple products (for brand-level inference).
 */
function averageTraits(products: Product[]): InferredTraits {
  if (products.length === 0) {
    return { flow: 0, clarity: 0, rhythm: 0, tonal_density: 0, spatial_depth: 0, dynamics: 0, warmth: 0 };
  }

  const sum: InferredTraits = { flow: 0, clarity: 0, rhythm: 0, tonal_density: 0, spatial_depth: 0, dynamics: 0, warmth: 0 };

  for (const p of products) {
    const t = extractProductTraits(p);
    for (const key of PROFILE_KEYS) {
      sum[key] += t[key];
    }
  }

  const result: InferredTraits = { flow: 0, clarity: 0, rhythm: 0, tonal_density: 0, spatial_depth: 0, dynamics: 0, warmth: 0 };
  for (const key of PROFILE_KEYS) {
    result[key] = sum[key] / products.length;
  }
  return result;
}

// ── Profile mutation ─────────────────────────────────

/** Weight applied when liking a product (nudges toward its traits). */
const LIKE_WEIGHT = 0.3;
/** Weight applied when disliking a product (nudges away from its traits). */
const DISLIKE_WEIGHT = -0.15;
/** Weight applied for brand preference (weaker than specific product). */
const BRAND_WEIGHT = 0.15;
/** Confidence increment per signal. */
const CONFIDENCE_PER_SIGNAL = 0.15;

/**
 * Apply a product trait vector to the profile with a given weight.
 * Clamps all values to [0, 1].
 */
function applyTraits(
  current: InferredTraits,
  productTraits: InferredTraits,
  weight: number,
): InferredTraits {
  const result = { ...current };
  for (const key of PROFILE_KEYS) {
    result[key] = Math.max(0, Math.min(1, current[key] + productTraits[key] * weight));
  }
  return result;
}

/**
 * Record that the user likes a specific product.
 * Looks up the product in the catalog and nudges the profile toward its traits.
 */
export function recordProductLike(
  profile: ListenerProfile,
  productName: string,
): ListenerProfile {
  const product = findCatalogProduct(productName);
  const normalizedName = productName.toLowerCase().trim();

  // Don't double-count
  if (profile.likedProducts.includes(normalizedName)) return profile;

  const newProfile = { ...profile };
  newProfile.likedProducts = [...profile.likedProducts, normalizedName];

  if (product) {
    const productTraits = extractProductTraits(product);
    newProfile.inferredTraits = applyTraits(profile.inferredTraits, productTraits, LIKE_WEIGHT);
    newProfile.sourceSignals = [
      ...profile.sourceSignals,
      `liked ${product.brand} ${product.name} → ${describeTopTraits(productTraits)}`,
    ];

    // Also record brand affinity
    const brandLower = product.brand.toLowerCase();
    if (!newProfile.likedBrands.includes(brandLower)) {
      newProfile.likedBrands = [...newProfile.likedBrands, brandLower];
    }

    console.log('[listener-profile] liked product: %s %s', product.brand, product.name);
    console.log('[listener-profile]   product traits:', productTraits);
    console.log('[listener-profile]   updated inferred:', newProfile.inferredTraits);
  } else {
    newProfile.sourceSignals = [
      ...profile.sourceSignals,
      `liked "${productName}" (not in catalog — recorded without trait inference)`,
    ];
    console.log('[listener-profile] liked product: "%s" (not in catalog)', productName);
  }

  newProfile.confidence = Math.min(1, profile.confidence + CONFIDENCE_PER_SIGNAL);
  return newProfile;
}

/**
 * Record that the user dislikes a specific product.
 */
export function recordProductDislike(
  profile: ListenerProfile,
  productName: string,
): ListenerProfile {
  const product = findCatalogProduct(productName);
  const normalizedName = productName.toLowerCase().trim();

  if (profile.dislikedProducts.includes(normalizedName)) return profile;

  const newProfile = { ...profile };
  newProfile.dislikedProducts = [...profile.dislikedProducts, normalizedName];

  if (product) {
    const productTraits = extractProductTraits(product);
    newProfile.inferredTraits = applyTraits(profile.inferredTraits, productTraits, DISLIKE_WEIGHT);
    newProfile.sourceSignals = [
      ...profile.sourceSignals,
      `disliked ${product.brand} ${product.name} → moved away from ${describeTopTraits(productTraits)}`,
    ];

    const brandLower = product.brand.toLowerCase();
    if (!newProfile.dislikedBrands.includes(brandLower)) {
      newProfile.dislikedBrands = [...newProfile.dislikedBrands, brandLower];
    }

    console.log('[listener-profile] disliked product: %s %s', product.brand, product.name);
  } else {
    newProfile.sourceSignals = [
      ...profile.sourceSignals,
      `disliked "${productName}" (not in catalog)`,
    ];
    console.log('[listener-profile] disliked product: "%s" (not in catalog)', productName);
  }

  newProfile.confidence = Math.min(1, profile.confidence + CONFIDENCE_PER_SIGNAL);
  return newProfile;
}

/**
 * Record that the user prefers a brand (without a specific product).
 */
export function recordBrandPreference(
  profile: ListenerProfile,
  brandName: string,
  positive: boolean,
): ListenerProfile {
  const normalizedBrand = brandName.toLowerCase().trim();
  const list = positive ? 'likedBrands' : 'dislikedBrands';

  if (profile[list].includes(normalizedBrand)) return profile;

  const newProfile = { ...profile };
  newProfile[list] = [...profile[list], normalizedBrand];

  const brandProducts = findProductsByBrand(normalizedBrand);
  if (brandProducts.length > 0) {
    const avgTraits = averageTraits(brandProducts);
    const weight = positive ? BRAND_WEIGHT : -BRAND_WEIGHT;
    newProfile.inferredTraits = applyTraits(profile.inferredTraits, avgTraits, weight);
    newProfile.sourceSignals = [
      ...profile.sourceSignals,
      `${positive ? 'likes' : 'dislikes'} brand ${brandName} (${brandProducts.length} products) → ${describeTopTraits(avgTraits)}`,
    ];
    console.log('[listener-profile] brand %s: %s (%d products)', positive ? 'like' : 'dislike', brandName, brandProducts.length);
  } else {
    newProfile.sourceSignals = [
      ...profile.sourceSignals,
      `${positive ? 'likes' : 'dislikes'} brand "${brandName}" (not in catalog)`,
    ];
  }

  newProfile.confidence = Math.min(1, profile.confidence + CONFIDENCE_PER_SIGNAL * 0.5);
  return newProfile;
}

// ── Preference detection from text ───────────────────

/** Patterns that indicate the user likes something or has decided. */
const LIKE_PATTERNS = [
  /\bi\s+(?:really\s+)?(?:like|love|prefer|enjoy|dig)\s+(?:the\s+)?(.+)/i,
  /\b(?:the\s+)?(.+?)\s+(?:sounds?|is|looks?|seems?)\s+(?:great|amazing|perfect|good|nice|right|ideal)/i,
  /\bi(?:'m|'m| am)\s+(?:going\s+with|leaning\s+toward|choosing|picking)\s+(?:the\s+)?(.+)/i,
  /\b(?:that|the)\s+(.+?)\s+(?:is|was)\s+(?:my|the)\s+(?:favorite|pick|choice)/i,
  /\bi\s+want\s+(?:the\s+)?(.+)/i,
  /\b(?:sold\s+on|drawn\s+to|excited\s+about)\s+(?:the\s+)?(.+)/i,
  // Decision-language patterns (user has made up their mind)
  /\bi(?:'ll|'ll| will)\s+(?:go\s+with|get|take|order|buy)\s+(?:the\s+)?(.+)/i,
  /\bthat(?:'s|'s| is)\s+(?:the\s+one|my\s+pick|it|decided)\b/i,
  /\b(?:the\s+)?(.+?)\s+(?:it\s+is|is\s+the\s+(?:one|winner))\b/i,
  /\b(?:decided\s+on|settled\s+on|going\s+for)\s+(?:the\s+)?(.+)/i,
];

/** Patterns that indicate the user dislikes something. */
const DISLIKE_PATTERNS = [
  /\bi\s+(?:don'?t|do\s+not)\s+(?:really\s+)?(?:like|enjoy|prefer|want)\s+(?:the\s+)?(.+)/i,
  /\b(?:the\s+)?(.+?)\s+(?:sounds?|is|looks?|seems?)\s+(?:too|overly|excessively)\s+/i,
  /\bnot\s+(?:a\s+)?fan\s+of\s+(?:the\s+)?(.+)/i,
  /\b(?:the\s+)?(.+?)\s+(?:isn'?t|is\s+not)\s+(?:for\s+me|my\s+thing|right)/i,
];

export interface PreferenceSignal {
  kind: 'like' | 'dislike';
  /** The raw subject text matched. */
  subject: string;
  /** Resolved product from catalog, if found. */
  product: Product | null;
  /** Whether this matched a brand rather than a specific product. */
  isBrand: boolean;
}

/**
 * Detect product/brand preference signals from user text.
 * Returns an array of preference signals found.
 */
export function detectPreferenceSignals(text: string): PreferenceSignal[] {
  const signals: PreferenceSignal[] = [];
  const seen = new Set<string>();

  // Check like patterns
  for (const pattern of LIKE_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const subject = (match[1] || match[2] || '').trim().replace(/[.,!?]+$/, '');
      if (subject && subject.length > 2 && !seen.has(subject.toLowerCase())) {
        seen.add(subject.toLowerCase());
        const product = findCatalogProduct(subject);
        // Check if it's a brand rather than a product
        const isBrand = !product && findProductsByBrand(subject).length > 0;
        signals.push({ kind: 'like', subject, product, isBrand });
      }
    }
  }

  // Check dislike patterns
  for (const pattern of DISLIKE_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const subject = (match[1] || match[2] || '').trim().replace(/[.,!?]+$/, '');
      if (subject && subject.length > 2 && !seen.has(subject.toLowerCase())) {
        seen.add(subject.toLowerCase());
        const product = findCatalogProduct(subject);
        const isBrand = !product && findProductsByBrand(subject).length > 0;
        signals.push({ kind: 'dislike', subject, product, isBrand });
      }
    }
  }

  return signals;
}

/**
 * Apply detected preference signals to a listener profile.
 * Returns the updated profile and a list of what changed.
 */
export function applyPreferenceSignals(
  profile: ListenerProfile,
  signals: PreferenceSignal[],
): { profile: ListenerProfile; applied: string[] } {
  let updated = profile;
  const applied: string[] = [];

  for (const signal of signals) {
    if (signal.kind === 'like') {
      if (signal.product) {
        updated = recordProductLike(updated, `${signal.product.brand} ${signal.product.name}`);
        applied.push(`liked: ${signal.product.brand} ${signal.product.name}`);
      } else if (signal.isBrand) {
        updated = recordBrandPreference(updated, signal.subject, true);
        applied.push(`liked brand: ${signal.subject}`);
      } else {
        // Record name even if not in catalog
        updated = recordProductLike(updated, signal.subject);
        applied.push(`liked: ${signal.subject} (not in catalog)`);
      }
    } else {
      if (signal.product) {
        updated = recordProductDislike(updated, `${signal.product.brand} ${signal.product.name}`);
        applied.push(`disliked: ${signal.product.brand} ${signal.product.name}`);
      } else if (signal.isBrand) {
        updated = recordBrandPreference(updated, signal.subject, false);
        applied.push(`disliked brand: ${signal.subject}`);
      } else {
        updated = recordProductDislike(updated, signal.subject);
        applied.push(`disliked: ${signal.subject} (not in catalog)`);
      }
    }
  }

  return { profile: updated, applied };
}

// ── Effective Taste Merger ───────────────────────────

/** Direction labels for dominant trait patterns — expert-level descriptions. */
const DIRECTION_LABELS: Record<string, string> = {
  dynamics_rhythm: 'high transient energy with rhythmic propulsion — the attack-and-drive axis',
  warmth_tonal_density: 'harmonic saturation with midrange weight — the tonal-richness axis',
  clarity_spatial_depth: 'micro-detail resolution with holographic staging — the precision-spatial axis',
  flow_warmth: 'temporal continuity with tonal warmth — the engagement-ease axis',
  rhythm_clarity: 'leading-edge speed with textural articulation — the timing-resolution axis',
  dynamics_clarity: 'macrodynamic contrast with transient precision — the impact-detail axis',
  flow_tonal_density: 'phrasing ease with harmonic density — the immersive-organic axis',
};

/**
 * Merge explicit conversation signals, stored taste profile, and
 * listener profile into a single effectiveTaste.
 *
 * Priority (highest to lowest):
 *   1. Explicit conversation signals (traits from current session)
 *   2. Listener profile inferred traits (product preference memory)
 *   3. Stored taste profile (historical, low weight)
 */
export function mergeEffectiveTaste(
  explicitTraits: Record<string, SignalDirection> | undefined,
  listenerProfile: ListenerProfile,
  storedProfile: TasteProfile | null,
): EffectiveTaste {
  const traits: Record<ProfileTraitKey, number> = {
    flow: 0, clarity: 0, rhythm: 0,
    tonal_density: 0, spatial_depth: 0, dynamics: 0, warmth: 0,
  };

  // Layer 1: Stored profile (weight: 20% of its values)
  if (storedProfile && storedProfile.confidence > 0.1) {
    const storedWeight = 0.2 * storedProfile.confidence;
    for (const key of PROFILE_KEYS) {
      traits[key] += (storedProfile.traits[key] ?? 0) * storedWeight;
    }
  }

  // Layer 2: Listener profile inferred traits (weight: 40%)
  if (listenerProfile.confidence > 0) {
    const profileWeight = 0.4 * listenerProfile.confidence;
    for (const key of PROFILE_KEYS) {
      traits[key] += listenerProfile.inferredTraits[key] * profileWeight;
    }
  }

  // Layer 3: Explicit conversation signals (weight: 100% — strongest)
  if (explicitTraits) {
    for (const [traitName, direction] of Object.entries(explicitTraits)) {
      const profileKey = TRAIT_TO_PROFILE[traitName];
      if (profileKey && direction === 'up') {
        traits[profileKey] = Math.min(1, traits[profileKey] + 0.5);
      } else if (profileKey && direction === 'down') {
        traits[profileKey] = Math.max(0, traits[profileKey] - 0.3);
      }
    }
  }

  // Clamp all to [0, 1]
  for (const key of PROFILE_KEYS) {
    traits[key] = Math.max(0, Math.min(1, traits[key]));
  }

  // Determine dominant direction
  const direction = inferDirection(traits);

  // Build summary
  const summary = buildTasteSummary(traits, listenerProfile);

  console.log('[taste-merge]', {
    explicitTraits: explicitTraits ? Object.entries(explicitTraits).map(([t, d]) => `${t}:${d}`).join(', ') : 'none',
    profileTraits: Object.entries(listenerProfile.inferredTraits).filter(([, v]) => v > 0.1).map(([t, v]) => `${t}:${v.toFixed(2)}`).join(', ') || 'none',
    effectiveTaste: Object.entries(traits).filter(([, v]) => v > 0.1).map(([t, v]) => `${t}:${v.toFixed(2)}`).join(', ') || 'flat',
    direction,
  });

  return { traits, direction, summary };
}

// ── Taste-aware next-step generation ─────────────────

/**
 * Given a listener profile with liked products, generate a contextual
 * "next step" response that acknowledges taste and moves forward.
 *
 * Returns null if the profile doesn't have enough information.
 */
export function generateTasteAcknowledgment(
  profile: ListenerProfile,
  likedProductName: string,
): { acknowledgment: string; nextStep: string; nextCategory: string | null } | null {
  const product = findCatalogProduct(likedProductName);
  if (!product) return null;

  const traits = extractProductTraits(product);
  const topTraitList = getTopTraits(traits, 2);
  const direction = describeTopTraits(traits);

  // Determine what category to suggest next
  const nextCategory = suggestNextCategory(product.category);

  // Short, sharp acknowledgment — interpret what the choice reveals
  const topLabel = topTraitList.length > 0 ? EXPERT_SHORT_MAP[topTraitList[0].key] : direction;
  const secondLabel = topTraitList.length > 1 ? EXPERT_SHORT_MAP[topTraitList[1].key] : null;

  const productShort = `${product.brand} ${product.name}`;
  const acknowledgment = secondLabel
    ? `${productShort} reflects a focus on ${topLabel} with ${secondLabel} as a secondary axis.`
    : `${productShort} reflects a focus on ${topLabel} as the primary axis.`;

  let nextStep: string;
  if (nextCategory === 'amplifier') {
    nextStep = `Next question: amplification that doubles down on that energy, or one that anchors it with more control?`;
  } else if (nextCategory === 'dac') {
    nextStep = `Now — a DAC that reinforces that character, or one that introduces precision without fighting it?`;
  } else if (nextCategory === 'speaker') {
    nextStep = `Speakers are where this becomes most audible. Want to lean into that character or complement it?`;
  } else {
    nextStep = `What part of the chain should we look at next?`;
  }

  console.log('[taste-ack] product=%s direction=%s nextCategory=%s', likedProductName, direction, nextCategory);

  return { acknowledgment, nextStep, nextCategory };
}

// ── Helpers ──────────────────────────────────────────

/**
 * Expert-level audio vocabulary for trait descriptions.
 * Replaces generic phrases with the language of experienced listeners
 * and audio engineers — precise, evocative, non-promotional.
 */
const EXPERT_LABEL_MAP: Record<string, string> = {
  flow: 'temporal continuity and phrasing ease',
  clarity: 'transient articulation and micro-detail resolution',
  rhythm: 'leading-edge speed and rhythmic propulsion',
  tonal_density: 'harmonic saturation and midrange body',
  spatial_depth: 'stage layering and holographic imaging',
  dynamics: 'macrodynamic swing and microdynamic contrast',
  warmth: 'lower-midrange colour and tonal weight',
};

/** Shorter expert labels for inline use. */
const EXPERT_SHORT_MAP: Record<string, string> = {
  flow: 'continuity and phrasing',
  clarity: 'transient speed and resolution',
  rhythm: 'rhythmic drive and timing',
  tonal_density: 'harmonic density',
  spatial_depth: 'spatial depth and layering',
  dynamics: 'dynamic impact',
  warmth: 'tonal warmth and body',
};

function describeTopTraits(traits: InferredTraits): string {
  const sorted = PROFILE_KEYS
    .map((key) => ({ key, value: traits[key] }))
    .filter((t) => t.value > 0.3)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  if (sorted.length === 0) return 'balanced';

  return sorted.map((t) => EXPERT_SHORT_MAP[t.key] ?? t.key).join(', ');
}

/**
 * Generate a detailed expert description of a single trait.
 * Used in the Taste Reflection Block for structured taste interpretation.
 */
function describeTraitExpert(key: ProfileTraitKey, value: number): string {
  const intensity = value > 0.7 ? 'strong' : value > 0.45 ? 'moderate' : 'mild';

  const DESCRIPTIONS: Record<string, Record<string, string>> = {
    flow: {
      strong: 'You gravitate toward designs that prioritize temporal continuity — where musical phrases breathe without mechanical interruption. This typically means lower-feedback topologies, R2R conversion, or tube-hybrid architectures.',
      moderate: 'Musical flow matters to you — you notice when transients feel disconnected from the phrase structure. This suggests sensitivity to time-domain behavior and phase coherence.',
      mild: 'You show some preference for designs that maintain phrasing ease, though this isn\'t your dominant priority.',
    },
    clarity: {
      strong: 'You respond to fast leading-edge transients and micro-detail retrieval — the kind of resolution that reveals breath sounds, bow pressure, and room reflections. High-feedback, low-distortion designs tend to serve this well.',
      moderate: 'Transient articulation and textural detail are meaningful to you. You want to hear into recordings without the presentation becoming analytical or clinical.',
      mild: 'You appreciate clarity when it\'s present, but don\'t prioritize it over musicality or tonal character.',
    },
    rhythm: {
      strong: 'Rhythmic precision and propulsive energy are central to your listening. You notice pace, leading-edge attack, and the sense that music has forward momentum — this often correlates with high damping factor and fast rise times.',
      moderate: 'Timing and rhythmic engagement matter to you — you want music to feel alive and moving, not static or sluggish.',
      mild: 'Rhythmic character registers, but it\'s not the primary axis you optimize for.',
    },
    tonal_density: {
      strong: 'You\'re drawn to harmonic richness — the sense of weight, body, and overtone complexity in instruments and voices. This often aligns with tube amplification, R2R DACs, or speakers with high-mass drivers.',
      moderate: 'Midrange body and harmonic texture matter to you. You prefer instruments to sound substantial rather than thin or etched.',
      mild: 'You notice tonal weight when it\'s there, but don\'t specifically seek it out.',
    },
    spatial_depth: {
      strong: 'Soundstage depth, layering, and precise imaging are important to you — the ability to locate instruments in three-dimensional space. This favors designs with excellent channel separation and time-coherent driver alignment.',
      moderate: 'Spatial presentation contributes to your enjoyment. You appreciate when recordings open up and instruments have their own space.',
      mild: 'Spatial qualities register but aren\'t a primary decision factor for you.',
    },
    dynamics: {
      strong: 'You respond to dynamic contrast — both the macro-level impact of orchestral climaxes and the micro-level expressiveness of a singer\'s breath control. High-current amplification and efficient speakers tend to excel here.',
      moderate: 'Dynamic life and expressiveness enhance your listening. You want music to feel emotionally immediate, not compressed or flattened.',
      mild: 'You notice dynamic range but aren\'t specifically chasing maximum impact.',
    },
    warmth: {
      strong: 'Tonal warmth and presence-region energy are important to you — you prefer a slight lower-midrange emphasis over analytical neutrality. This often means class-A biasing, paper-cone speakers, or even-order harmonic coloration.',
      moderate: 'You prefer warmth over clinical precision — a natural tonal balance where vocals and acoustic instruments feel physically present.',
      mild: 'Warmth is appreciated but not the defining quality you seek.',
    },
  };

  return DESCRIPTIONS[key]?.[intensity] ?? `${EXPERT_LABEL_MAP[key]}: ${intensity} tendency.`;
}

// ── Taste Reflection Block ───────────────────────────

export interface TasteReflection {
  /** 3-5 structured interpretation bullets using expert audio language. */
  bullets: string[];
  /** One-sentence summary of overall taste direction. */
  summary: string;
  /** Dominant archetype label (if clear). */
  direction: string | null;
  /** Whether this reflection has enough data to be useful. */
  confident: boolean;
}

/**
 * Generate a structured Taste Reflection Block from the listener profile.
 *
 * This replaces generic "smooth and flowing" descriptions with expert-level
 * audio language: "fast leading-edge transients", "presence-region energy",
 * "macrodynamic swing", etc.
 *
 * Returns null if the profile has insufficient data (confidence < 0.15).
 */
export function generateTasteReflection(
  profile: ListenerProfile,
): TasteReflection | null {
  if (profile.confidence < 0.15) return null;

  const sorted = PROFILE_KEYS
    .map((key) => ({ key, value: profile.inferredTraits[key] }))
    .filter((t) => t.value > 0.15)
    .sort((a, b) => b.value - a.value);

  if (sorted.length === 0) return null;

  // Take top 3-5 traits for the reflection
  const topTraits = sorted.slice(0, Math.min(5, sorted.length));

  // Generate expert-language bullets
  const bullets: string[] = [];

  for (const trait of topTraits) {
    const bullet = describeTraitExpert(trait.key, trait.value);
    bullets.push(bullet);
  }

  // If we have liked products, add a grounding bullet
  if (profile.likedProducts.length > 0) {
    const recentLikes = profile.likedProducts.slice(-2);
    const productContext = recentLikes.length === 1
      ? `your response to ${recentLikes[0]}`
      : `your response to ${recentLikes[0]} and ${recentLikes[1]}`;
    bullets.push(`This profile is grounded in ${productContext} — not abstract preference, but observed resonance with specific design approaches.`);
  }

  // Build summary from top 2 traits
  const summaryTraits = topTraits.slice(0, 2);
  const summary = summaryTraits.length >= 2
    ? `Your listening priorities center on ${EXPERT_SHORT_MAP[summaryTraits[0].key]} and ${EXPERT_SHORT_MAP[summaryTraits[1].key]}.`
    : `Your listening priority centers on ${EXPERT_SHORT_MAP[summaryTraits[0].key]}.`;

  // Direction
  const direction = inferDirection(profile.inferredTraits as Record<ProfileTraitKey, number>);

  console.log('[taste-reflection] generated %d bullets, direction=%s, confidence=%.2f',
    bullets.length, direction, profile.confidence);

  return {
    bullets,
    summary,
    direction,
    confident: profile.confidence >= 0.3,
  };
}

// ── Concise Taste Reflection (for rendering above recommendations) ──

/** Human-readable trait labels for natural prose. */
const TRAIT_LABELS: Record<ProfileTraitKey, string> = {
  flow: 'musical flow',
  clarity: 'clarity and detail',
  rhythm: 'rhythmic energy',
  tonal_density: 'harmonic density',
  spatial_depth: 'spatial depth',
  dynamics: 'dynamic impact',
  warmth: 'warmth and body',
};

/**
 * Build a concise 1–2 sentence taste reflection from the listener profile.
 * Designed to sit above product recommendations — not in decisive mode.
 * Returns null if insufficient data.
 */
export function buildTasteReflection(profile: ListenerProfile): string | null {
  if (profile.confidence < 0.15) return null;

  const sorted = PROFILE_KEYS
    .map((key) => ({ key, value: profile.inferredTraits[key] }))
    .filter((t) => t.value > 0.15)
    .sort((a, b) => b.value - a.value);

  if (sorted.length === 0) return null;

  // Top priorities (what the listener values)
  const priorities = sorted.slice(0, 3).map((t) => TRAIT_LABELS[t.key]);

  // Depriorities (low or zero traits — what the listener cares less about)
  const lowTraits = PROFILE_KEYS
    .filter((key) => profile.inferredTraits[key] <= 0.1)
    .map((key) => TRAIT_LABELS[key]);
  const depriority = lowTraits.length > 0 ? lowTraits.slice(0, 2) : null;

  // Build natural sentence
  let reflection: string;
  if (priorities.length >= 2 && depriority && depriority.length > 0) {
    reflection = `Given your focus on ${priorities.slice(0, 2).join(' and ')} over ${depriority.join(' or ')}, the options below explore whether to reinforce that character, push it further, or try a different direction.`;
  } else if (priorities.length >= 2) {
    reflection = `Given your focus on ${priorities.slice(0, 2).join(' and ')}, the options below explore different ways to serve that.`;
  } else {
    reflection = `Given your focus on ${priorities[0]}, the options below explore different ways to deliver that.`;
  }

  console.log('[taste-reflection] %s (confidence=%.2f)', reflection, profile.confidence);
  return reflection;
}

// ── Conclusion Mode ──────────────────────────────────

export interface TasteConclusion {
  /** Top pick product name + reason. */
  topPick: { name: string; reason: string };
  /** Alternative pick + reason (different design philosophy). */
  alternative: { name: string; reason: string };
  /** One-sentence synthesis of why these two represent the listener's range. */
  synthesis: string;
}

/**
 * Detect whether the user is asking for a conclusion / final recommendation.
 */
export function detectConclusionIntent(text: string): boolean {
  const CONCLUSION_PATTERNS = [
    /\bwhat\s+should\s+i\s+(?:get|buy|choose|pick|go\s+with)\b/i,
    /\bwhich\s+(?:one|should)\b/i,
    /\bjust\s+tell\s+me\b/i,
    /\bwhat(?:'s| is)\s+(?:the\s+)?best\s+(?:for\s+me|option|choice)\b/i,
    /\bnarrow\s+it\s+down\b/i,
    /\bfinal\s+(?:answer|recommendation|pick)\b/i,
    /\bmake\s+(?:a|the)\s+call\b/i,
    /\bif\s+you\s+(?:had|were)\s+(?:to\s+)?(?:pick|choose)\b/i,
    /\bbottom\s+line\b/i,
    // "what would you do" / "what would you actually do" / "what would you pick"
    /\bwhat\s+would\s+you\s+(?:actually\s+)?(?:do|pick|choose|get|buy|recommend|suggest)\b/i,
    // "what do you recommend" / "what do you suggest"
    /\bwhat\s+do\s+you\s+(?:recommend|suggest|think\s+i\s+should)\b/i,
    // "tell me what to get" / "tell me what to buy"
    /\btell\s+me\s+what\s+to\s+(?:get|buy|pick|choose)\b/i,
    // "your pick" / "your recommendation" / "your call"
    /\byour\s+(?:pick|recommendation|call|choice)\b/i,
  ];
  return CONCLUSION_PATTERNS.some((p) => p.test(text));
}

function getTopTraits(traits: InferredTraits, n: number): Array<{ key: ProfileTraitKey; value: number }> {
  return PROFILE_KEYS
    .map((key) => ({ key, value: traits[key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

function inferDirection(traits: Record<ProfileTraitKey, number>): string | null {
  const sorted = PROFILE_KEYS
    .map((key) => ({ key, value: traits[key] }))
    .filter((t) => t.value > 0.15)
    .sort((a, b) => b.value - a.value);

  if (sorted.length < 2) {
    if (sorted.length === 1) {
      const key = sorted[0].key;
      return { dynamics: 'dynamic-first', warmth: 'warmth-oriented', clarity: 'resolution-focused', flow: 'flow-organic', rhythm: 'rhythm-driven', tonal_density: 'tonally-rich', spatial_depth: 'spatially-holographic' }[key] ?? null;
    }
    return null;
  }

  const combo = `${sorted[0].key}_${sorted[1].key}`;
  return DIRECTION_LABELS[combo] ?? describeTopTraits(traits as InferredTraits);
}

function buildTasteSummary(traits: Record<ProfileTraitKey, number>, profile: ListenerProfile): string {
  const top = PROFILE_KEYS
    .map((key) => ({ key, value: traits[key] }))
    .filter((t) => t.value > 0.15)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  if (top.length === 0) return 'No strong taste direction established yet.';

  const traitWords = top.map((t) => EXPERT_SHORT_MAP[t.key] ?? t.key);

  const productContext = profile.likedProducts.length > 0
    ? ` (informed by preference for ${profile.likedProducts.slice(-2).join(' and ')})`
    : '';

  return `Taste leans toward ${traitWords.join(', ')}${productContext}.`;
}

function suggestNextCategory(currentCategory: string): string | null {
  // After speakers → amplifier, after DAC → amp, after amp → DAC, etc.
  const NEXT: Record<string, string> = {
    speaker: 'amplifier',
    amplifier: 'dac',
    dac: 'amplifier',
    headphone: 'dac',
    turntable: 'amplifier',
  };
  return NEXT[currentCategory] ?? null;
}

// ── Taste-based filtering (Task 2) ──────────────────

/**
 * Compute a taste penalty for a product based on the listener profile.
 *
 * Returns a negative number (penalty) if the product contradicts
 * the listener's inferred taste, or 0 if no contradiction.
 *
 * This is deterministic — no LLM, no randomness.
 *
 * Penalty logic:
 *   - Disliked brand → hard penalty (-3.0, effectively removes)
 *   - Anti-trait: product strong on trait the listener is weak on,
 *     AND the listener has a clear opposite preference → soft penalty
 *   - Trait misalignment: product trait direction opposes inferred taste
 */
export function computeTastePenalty(
  product: Product,
  profile: ListenerProfile,
): { penalty: number; reasons: string[] } {
  if (profile.confidence < 0.1) return { penalty: 0, reasons: [] };

  let penalty = 0;
  const reasons: string[] = [];

  // ── Disliked brand → hard removal ──────────────
  const brandLower = product.brand.toLowerCase();
  if (profile.dislikedBrands.includes(brandLower)) {
    penalty -= 3.0;
    reasons.push(`disliked brand: ${product.brand}`);
  }

  // ── Disliked product (exact match) → hard removal ──
  const fullNameLower = `${product.brand} ${product.name}`.toLowerCase();
  if (profile.dislikedProducts.some((dp) => fullNameLower.includes(dp) || dp.includes(fullNameLower))) {
    penalty -= 3.0;
    reasons.push(`disliked product: ${product.brand} ${product.name}`);
  }

  // ── Trait contradiction detection ───────────────
  // If the listener strongly prefers X and this product is weak on X
  // but strong on an opposing trait, apply a penalty.
  const productTraits = extractProductTraits(product);
  const profileWeight = Math.min(1, profile.confidence * 1.5); // scale with confidence

  // Opposing pairs: traits that tend to be in tension
  const OPPOSING_PAIRS: [ProfileTraitKey, ProfileTraitKey][] = [
    ['warmth', 'clarity'],    // warm vs analytical
    ['flow', 'rhythm'],       // laid-back vs driving
    ['tonal_density', 'spatial_depth'], // dense vs open
  ];

  for (const [traitA, traitB] of OPPOSING_PAIRS) {
    const listenerA = profile.inferredTraits[traitA];
    const listenerB = profile.inferredTraits[traitB];
    const productA = productTraits[traitA];
    const productB = productTraits[traitB];

    // If listener clearly prefers A over B, but product is strong on B and weak on A
    if (listenerA > 0.4 && listenerB < 0.2 && productB > 0.6 && productA < 0.3) {
      const p = -0.5 * profileWeight;
      penalty += p;
      reasons.push(`contradicts taste: strong ${traitB} (${productB.toFixed(1)}) vs listener's ${traitA} preference`);
    }
    // Reverse
    if (listenerB > 0.4 && listenerA < 0.2 && productA > 0.6 && productB < 0.3) {
      const p = -0.5 * profileWeight;
      penalty += p;
      reasons.push(`contradicts taste: strong ${traitA} (${productA.toFixed(1)}) vs listener's ${traitB} preference`);
    }
  }

  // ── Low alignment penalty ──────────────────────
  // If the listener's top 2 traits both have low values on this product, penalize
  const sortedListener = PROFILE_KEYS
    .map((key) => ({ key, value: profile.inferredTraits[key] }))
    .sort((a, b) => b.value - a.value);

  if (sortedListener.length >= 2) {
    const top2 = sortedListener.slice(0, 2);
    const allWeak = top2.every((t) => productTraits[t.key] < 0.3);
    if (allWeak && top2[0].value > 0.3) {
      const p = -0.4 * profileWeight;
      penalty += p;
      reasons.push(`weak on listener's top traits: ${top2.map((t) => t.key).join(', ')}`);
    }
  }

  return { penalty: Math.max(-3.0, penalty), reasons };
}

// ── Decisive Recommendation (Task 1) ────────────────

export interface DecisiveRecommendation {
  topPick: { name: string; brand: string; reason: string };
  alternative?: { name: string; brand: string; reason: string };
}

/**
 * Build a decisive "What I would actually do" block from
 * the final shortlist + listener profile + system context.
 *
 * Requires at least 2 products in the shortlist.
 */
export function buildDecisiveRecommendation(
  products: Array<{ name: string; brand: string; price: number }>,
  profile: ListenerProfile,
  anchorProduct?: string | null,
): DecisiveRecommendation | null {
  // Filter out disliked brands and products BEFORE selecting top/alt.
  // This ensures a disliked product never appears in the decisive block.
  const dislikedBrands = new Set(profile.dislikedBrands.map((b) => b.toLowerCase()));
  const dislikedProducts = new Set(profile.dislikedProducts.map((p) => p.toLowerCase()));

  const eligible = products.filter((p) => {
    if (dislikedBrands.has(p.brand.toLowerCase())) return false;
    const fullName = `${p.brand} ${p.name}`.toLowerCase();
    if (dislikedProducts.has(fullName) || dislikedProducts.has(p.name.toLowerCase())) return false;
    return true;
  });

  console.log('[decisive-filter] dislikedBrands=[%s], dislikedProducts=[%s], candidates=%d→%d',
    [...dislikedBrands].join(', '), [...dislikedProducts].join(', '),
    products.length, eligible.length);

  // Need at least 1 eligible product and sufficient confidence
  if (eligible.length < 1 || profile.confidence < 0.15) return null;

  const top = eligible[0];
  const alt = eligible.length >= 2 ? eligible[1] : null;

  // Determine the listener's dominant trait for reasoning
  const sortedTraits = PROFILE_KEYS
    .map((key) => ({ key, value: profile.inferredTraits[key] }))
    .sort((a, b) => b.value - a.value);
  const dominantTrait = sortedTraits[0];
  const secondaryTrait = sortedTraits.length > 1 ? sortedTraits[1] : null;

  const dominantLabel = EXPERT_SHORT_MAP[dominantTrait.key] ?? dominantTrait.key;
  const secondaryLabel = secondaryTrait ? (EXPERT_SHORT_MAP[secondaryTrait.key] ?? secondaryTrait.key) : null;

  // Build reason for top pick — system-level action first, then product
  const catLabel = { flow: 'source', tonal_density: 'DAC', clarity: 'amplifier', control: 'amplifier', spatial: 'speakers' }[dominantTrait.key] ?? 'this part of the chain';
  let topReason: string;
  if (anchorProduct) {
    topReason = `I'd change ${catLabel} first. Your ${anchorProduct} is doing its job — ${catLabel} is where the system can move toward more ${dominantLabel}.`;
    if (secondaryLabel && dominantTrait.value > 0.3) {
      topReason += ` Keeps ${secondaryLabel} intact.`;
    }
  } else if (secondaryLabel && dominantTrait.value > 0.3) {
    topReason = `I'd start with ${catLabel}. Cleanest way to get more ${dominantLabel} without losing ${secondaryLabel}.`;
  } else {
    topReason = `I'd start with ${catLabel}. That's where the biggest shift toward what you respond to will come from.`;
  }

  // Build alternative (if available)
  let altEntry: { name: string; brand: string; reason: string } | undefined;
  if (alt) {
    let altReason: string;
    if (anchorProduct && secondaryLabel && dominantTrait.value > 0.3) {
      altReason = `Moves the system toward ${secondaryLabel} instead. You give up some ${dominantLabel}, but it's a different balance worth hearing.`;
    } else if (secondaryLabel && dominantTrait.value > 0.3) {
      altReason = `More ${secondaryLabel}, less ${dominantLabel}. Different balance — worth hearing if your priorities are shifting.`;
    } else {
      altReason = `Different trade-offs. Worth hearing if the top pick doesn't land the way you expect.`;
    }
    altEntry = { name: alt.name, brand: alt.brand, reason: altReason };
  }

  console.log('[final-recommendation]', {
    topPick: `${top.brand} ${top.name}`,
    alternative: alt ? `${alt.brand} ${alt.name}` : 'none',
    dominantTrait: dominantTrait.key,
    confidence: profile.confidence,
    anchorProduct: anchorProduct ?? 'none',
  });

  return {
    topPick: { name: top.name, brand: top.brand, reason: topReason },
    alternative: altEntry,
  };
}

// ── System-Aware Pairing (Task 3) ───────────────────

/**
 * Build a system-aware pairing intro that references the anchor product
 * (liked product, selected component, or current system component)
 * and frames the next recommendation as reinforce-or-counterbalance.
 *
 * Returns null if no anchor product is available.
 */
export function buildSystemPairingIntro(
  profile: ListenerProfile,
  category: string,
  systemComponents?: string[],
): { intro: string; anchorName: string; direction: 'reinforce' | 'counterbalance' | 'neutral' } | null {
  // Find the best anchor: recent liked product > system component
  let anchorName: string | null = null;
  let anchorProduct: Product | null = null;

  // Priority 1: most recent liked product
  if (profile.likedProducts.length > 0) {
    const recentLike = profile.likedProducts[profile.likedProducts.length - 1];
    anchorProduct = findCatalogProduct(recentLike);
    if (anchorProduct) {
      anchorName = `${anchorProduct.brand} ${anchorProduct.name}`;
    }
  }

  // Priority 2: system component matching the upstream/downstream category
  if (!anchorProduct && systemComponents && systemComponents.length > 0) {
    for (const comp of systemComponents) {
      const product = findCatalogProduct(comp);
      if (product) {
        anchorProduct = product;
        anchorName = comp;
        break;
      }
    }
  }

  if (!anchorProduct || !anchorName) return null;

  const anchorTraits = extractProductTraits(anchorProduct);
  const topAnchorTraits = getTopTraits(anchorTraits, 2);

  if (topAnchorTraits.length === 0) return null;

  const anchorCharacter = topAnchorTraits.map((t) => EXPERT_SHORT_MAP[t.key] ?? t.key).join(' and ');

  // Determine pairing direction based on whether the listener wants more of the same or balance
  const listenerTopTraits = getTopTraits(profile.inferredTraits, 2);
  const overlapCount = listenerTopTraits.filter((lt) =>
    topAnchorTraits.some((at) => at.key === lt.key),
  ).length;

  // If the listener's taste aligns with the anchor's character → reinforce option is primary
  // If listener's taste differs from anchor → counterbalance is primary
  const direction: 'reinforce' | 'counterbalance' | 'neutral' =
    overlapCount >= 1 ? 'reinforce' : 'counterbalance';

  const categoryLabel = { amplifier: 'amplifier', dac: 'DAC', speaker: 'speaker' }[category] ?? category;

  const listenerCharacter = listenerTopTraits.map((t) => EXPERT_SHORT_MAP[t.key] ?? t.key).join(' and ');

  let intro: string;
  if (direction === 'reinforce') {
    intro = `Your ${anchorName} sets the system's character. The ${categoryLabel} options below are evaluated against that — does each one preserve what's working or pull the system somewhere else?`;
  } else {
    intro = `Your ${anchorName} leans toward ${anchorCharacter}, but your taste points toward ${listenerCharacter}. That gap is the ${categoryLabel} opportunity — the right pairing fills what the anchor doesn't naturally provide.`;
  }

  console.log('[system-pairing]', {
    anchorProduct: anchorName,
    anchorCharacter,
    pairingDirection: direction,
    category,
  });

  return { intro, anchorName, direction };
}

/** Expose extractProductTraits for external use (taste filtering). */
export { extractProductTraits };
