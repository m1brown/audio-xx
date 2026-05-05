'use client';

import { useCallback } from 'react';

/**
 * Tiny client wrapper for product images in server-rendered cards.
 * Handles onError gracefully — swaps to a local placeholder SVG on failure.
 * If the placeholder itself fails, hides the container as a last resort.
 * Optional credit line renders below the image in muted text.
 *
 * NOTE: Uses a ref callback (not just onError) to catch images that failed
 * before React hydration — the browser fires `error` as soon as the HTML
 * arrives, which can be before React attaches its event handlers.
 */

/** Generic local placeholder — always available, no external dependency. */
const FALLBACK_PLACEHOLDER = '/images/placeholders/product.svg';

function applyFallback(img: HTMLImageElement, fallbackSrc?: string) {
  const placeholder = fallbackSrc || FALLBACK_PLACEHOLDER;
  // Avoid infinite loop: if already showing a placeholder, hide instead.
  if (img.src.endsWith(placeholder) || img.dataset.fallback === '1') {
    const fig = img.closest('figure');
    if (fig) fig.style.display = 'none';
    return;
  }
  img.dataset.fallback = '1';
  img.src = placeholder;
}

export function ProductImage({ src, alt, credit, fallbackSrc }: {
  src: string;
  alt: string;
  credit?: string;
  /** Optional category-specific placeholder. Falls back to generic product.svg. */
  fallbackSrc?: string;
}) {
  // Ref callback: fires once when the <img> mounts into the DOM.
  // If the image already errored before React hydrated, `img.complete`
  // is true but `img.naturalWidth` is 0 — detect that and apply fallback.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (!img) return;
    if (img.complete && img.naturalWidth === 0 && !img.dataset.fallback) {
      applyFallback(img, fallbackSrc);
    }
  }, [fallbackSrc]);

  return (
    <figure style={{ margin: 0, marginBottom: '0.5rem' }}>
      <div
        style={{
          borderRadius: '10px',
          overflow: 'hidden',
          width: '100%',
          maxHeight: '220px',
          minHeight: '100px',
          background: '#f6f5f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.25rem 0',
          boxSizing: 'border-box',
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="eager"
          referrerPolicy="no-referrer"
          style={{
            maxWidth: '100%',
            maxHeight: '200px',
            objectFit: 'contain',
            display: 'block',
          }}
          onError={(e) => {
            applyFallback(e.currentTarget as HTMLImageElement, fallbackSrc);
          }}
        />
      </div>
      {credit && (
        <figcaption style={{
          marginTop: '0.2rem',
          fontSize: '0.72rem',
          color: '#a09a90',
          textAlign: 'right',
        }}>
          Image: {credit}
        </figcaption>
      )}
    </figure>
  );
}
