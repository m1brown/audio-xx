'use client';

/**
 * ProductImageContext — narrative-only first-reference image deduplication.
 *
 * Image policy (split by render context):
 *   - Card contexts (product cards, comparison cards, upgrade paths,
 *     dossier cards): ALWAYS show image when imageUrl is available.
 *     These components bypass dedup entirely.
 *   - Narrative/prose contexts (RewrittenSystemReview inline images):
 *     first-reference dedup applies via shouldShowImage(). A prose
 *     mention does NOT consume eligibility for later card contexts.
 *
 * Architecture:
 *   - Provider wraps each advisory message render (AdvisoryMessage)
 *   - Provider precomputes which narrative references are first-occurrence
 *   - Card components ignore the context — they show images unconditionally
 *   - shouldShowImage() is a PURE read — no mutation, no side effects
 *
 * React StrictMode compatibility:
 *   Precomputed via useMemo before any child renders. shouldShowImage()
 *   is a pure membership check — deterministic, fully StrictMode-safe.
 *
 * Key normalization matches product-images.ts: lowercase, alphanumeric + spaces,
 * collapsed whitespace.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

/** Normalize a (brand, name) pair to a stable lookup key. */
export function normalizeKey(brand?: string, name?: string): string {
  const raw = `${brand ?? ''} ${name ?? ''}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Minimal product-reference shape for precomputation. */
interface ProductRef {
  brand?: string;
  name?: string;
  imageUrl?: string;
}

/**
 * Precomputed dedup result. Two sets:
 *   - eligible: keys that should show images (first occurrence, has imageUrl)
 *   - scanned:  ALL keys that were examined (first + duplicates)
 *
 * Keys NOT in `scanned` are outside the dedup scope (e.g. narrative
 * bold-name references in RewrittenSystemReview) and always show images.
 */
interface DedupResult {
  eligible: Set<string>;
  scanned: Set<string>;
}

/**
 * Scan the advisory response data and build dedup sets.
 *
 * Scan order mirrors render order:
 *   1. comparisonImages (rendered above prose in StandardFormat)
 *   2. options (product cards, rendered after prose sections)
 *
 * Narrative bold-name references (RewrittenSystemReview) are in a mutually
 * exclusive format from product cards. They are NOT scanned here — instead
 * shouldShowImage() returns true for any unscanned key, so narrative
 * images always render when an imageUrl is available.
 */
function computeDedup(
  comparisonImages?: ProductRef[],
  options?: ProductRef[],
): DedupResult {
  const scanned = new Set<string>();
  const eligible = new Set<string>();

  // 1. Comparison images — render first in the visual hierarchy
  if (comparisonImages) {
    for (const ref of comparisonImages) {
      const key = normalizeKey(ref.brand, ref.name);
      if (!key) continue;
      if (!scanned.has(key) && ref.imageUrl) {
        eligible.add(key);
      }
      scanned.add(key);
    }
  }

  // 2. Product option cards — render after prose/comparison sections
  if (options) {
    for (const ref of options) {
      const key = normalizeKey(ref.brand, ref.name);
      if (!key) continue;
      if (!scanned.has(key) && ref.imageUrl) {
        eligible.add(key);
      }
      scanned.add(key);
    }
  }

  return { eligible, scanned };
}

interface ProductImageContextValue {
  /**
   * Pure membership check — returns true if this product's image should
   * render at this reference. Deterministic and side-effect-free.
   *
   * Behavior:
   *   - Key not in scanned set → true (outside dedup scope, e.g. narrative)
   *   - Key in scanned set AND in eligible set → true (first occurrence)
   *   - Key in scanned set but NOT in eligible set → false (duplicate)
   *   - No key (empty brand+name) → true (no identity to dedup)
   */
  shouldShowImage: (brand?: string, name?: string) => boolean;

  /** @deprecated Use shouldShowImage. Alias kept during migration. */
  claimImage: (brand?: string, name?: string) => boolean;
}

const Ctx = createContext<ProductImageContextValue>({
  // Default (no provider) — always show images (safe fallback for
  // components rendered outside an advisory message context).
  shouldShowImage: () => true,
  claimImage: () => true,
});

interface ProductImageProviderProps {
  children: ReactNode;
  /** Comparison-side thumbnails from the advisory response. */
  comparisonImages?: ProductRef[];
  /** Product option cards from the advisory response. */
  options?: ProductRef[];
}

export function ProductImageProvider({
  children,
  comparisonImages,
  options,
}: ProductImageProviderProps) {
  // Precompute the dedup sets ONCE per response. This runs before any
  // child component renders, so the result is available from the first
  // render invocation — no mutation needed during child render.
  const dedup = useMemo(
    () => computeDedup(comparisonImages, options),
    [comparisonImages, options],
  );

  const value = useMemo(() => {
    // Pure read — no Set mutation, no ref, no side effects.
    const shouldShowImage = (brand?: string, name?: string): boolean => {
      const key = normalizeKey(brand, name);
      if (!key) return true; // No product identity → show image

      // Key was never scanned → outside dedup scope (e.g. narrative
      // bold-name references). Always show when imageUrl is available.
      if (!dedup.scanned.has(key)) return true;

      // Key was scanned → show only if it's a first-occurrence.
      return dedup.eligible.has(key);
    };

    return { shouldShowImage, claimImage: shouldShowImage };
  }, [dedup]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProductImageClaim(): ProductImageContextValue {
  return useContext(Ctx);
}
