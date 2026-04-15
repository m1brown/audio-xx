/**
 * Hypothetical (temporary) system detection.
 *
 * When the user begins describing or refining a chain in the conversation
 * that differs from the saved/persisted system, we treat that chain as the
 * active reasoning context for the thread. The saved system may remain
 * visible in the UI but MUST NOT control recommendation logic while a
 * hypothetical chain is active.
 *
 * Engine boundary: this module is domain-agnostic in intent — it takes text
 * and returns structured role slots (source/amplification/output). The
 * domain vocabulary (PRODUCT_NAMES, catalog lookup) is delegated to the
 * existing intent + listener-profile layers. Consumers receive a
 * normalized chain { amp?, dac?, speaker?, headphone? } they can feed into
 * shopping context without knowing about catalogs or aliases.
 */
import { extractSubjectMatches } from './intent';
import { resolveProductAlias, findCatalogProduct } from './listener-profile';
import type { Product } from './products/dacs';

export interface HypotheticalChain {
  /** Resolved amplifier entry — catalog product, if found. */
  amp?: Product;
  /** Resolved DAC / source entry — catalog product, if found. */
  dac?: Product;
  /** Resolved speaker entry — catalog product, if found. */
  speaker?: Product;
  /** Resolved headphone entry — catalog product, if found. */
  headphone?: Product;
  /**
   * All brand+name strings that should be treated as the user's declared
   * system for this thread. Used to seed `engagedProductNames` and the
   * `activeSystemComponents` override in shopping-intent.
   */
  componentNames: string[];
  /**
   * True when the chain contains at least one component that implies
   * external amplification in the signal path (integrated amp, power amp,
   * tube amp, etc.). Mirrors SystemProfile.hasExternalAmplification but
   * computed from the hypothetical, not the saved, chain.
   */
  hasExternalAmplification: boolean;
}

/**
 * Category classification of a single resolved product. Mirrors the category
 * the Product catalog uses for each kind of entry.
 */
function productRole(p: Product): 'amp' | 'dac' | 'speaker' | 'headphone' | null {
  switch (p.category) {
    case 'amplifier':
    case 'integrated':
      return 'amp';
    case 'dac':
    case 'streamer':
      return 'dac'; // streamers act as the digital source slot
    case 'speaker':
      return 'speaker';
    case 'headphone':
    case 'iem':
      return 'headphone';
    default:
      return null;
  }
}

/**
 * Detect an explicitly-named hypothetical chain from the user's current
 * turn (and, optionally, accumulated thread text).
 *
 * Returns null when no specific product is named. Returns a chain with at
 * least one role slot filled when at least one catalog product is named.
 *
 * Matching uses the curated PRODUCT_NAMES list (via extractSubjectMatches)
 * and resolves shorthands through PRODUCT_NAME_ALIASES ("terminator" →
 * "denafrips terminator ii", etc.) before catalog lookup.
 */
export function detectHypotheticalChain(text: string): HypotheticalChain | null {
  const subjects = extractSubjectMatches(text);
  const productSubjects = subjects.filter((s) => s.kind === 'product');
  if (productSubjects.length === 0) return null;

  const chain: HypotheticalChain = {
    componentNames: [],
    hasExternalAmplification: false,
  };

  // Track ambiguous brand-only hits that need resolution via surrounding
  // text ("denafrips dac" without a specific model → flagship not assumed).
  const seenProductIds = new Set<string>();

  for (const s of productSubjects) {
    const resolved = resolveProductAlias(s.name.toLowerCase());
    const product = findCatalogProduct(resolved);
    if (!product) continue;
    if (seenProductIds.has(product.id)) continue;
    seenProductIds.add(product.id);

    const role = productRole(product);
    if (!role) continue;

    // First resolution wins per slot. The user may name both a flagship and
    // a cheaper sibling in one turn ("terminator - not entry level"); we
    // anchor on the first explicit mention and let the tier-floor in
    // product-scoring handle the rest.
    if (role === 'amp' && !chain.amp) {
      chain.amp = product;
    } else if (role === 'dac' && !chain.dac) {
      chain.dac = product;
    } else if (role === 'speaker' && !chain.speaker) {
      chain.speaker = product;
    } else if (role === 'headphone' && !chain.headphone) {
      chain.headphone = product;
    } else {
      continue;
    }

    chain.componentNames.push(`${product.brand} ${product.name}`);
  }

  if (chain.componentNames.length === 0) return null;

  // If the hypothetical chain contains an amplifier, any downstream speaker
  // recommendation must treat the chain as having external amplification.
  // This is the hypothetical-chain counterpart of the HAS_EXTERNAL_AMP
  // keyword scan in parseSystemProfile.
  chain.hasExternalAmplification = !!chain.amp;

  return chain;
}

/**
 * Produce a synthetic system-components array that can be passed to
 * detectShoppingIntent in place of the saved system's component names.
 * Returns undefined when the chain is empty (caller should fall back to
 * the saved system or pure user text).
 */
export function chainToComponentNames(chain: HypotheticalChain | null | undefined): string[] | undefined {
  if (!chain || chain.componentNames.length === 0) return undefined;
  return [...chain.componentNames];
}
