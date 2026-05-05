'use client';

/**
 * Tiny client wrapper for product images in server-rendered cards.
 * Handles onError gracefully — hides the container if the image fails to load.
 * Optional credit line renders below the image in muted text.
 */
/** Generic local placeholder — always available, no external dependency. */
const FALLBACK_PLACEHOLDER = '/images/placeholders/product.svg';

export function ProductImage({ src, alt, credit, fallbackSrc }: {
  src: string;
  alt: string;
  credit?: string;
  /** Optional category-specific placeholder. Falls back to generic product.svg. */
  fallbackSrc?: string;
}) {
  return (
    <figure style={{ margin: 0, marginBottom: '0.5rem' }}>
      <div
        style={{
          borderRadius: '10px',
          overflow: 'hidden',
          width: '100%',
          maxHeight: '200px',
          minHeight: '100px',
          background: '#f6f5f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.35rem 0',
          boxSizing: 'border-box',
        }}
      >
        <img
          src={src}
          alt={alt}
          loading="eager"
          referrerPolicy="no-referrer"
          style={{
            maxWidth: '100%',
            maxHeight: '180px',
            objectFit: 'contain',
            display: 'block',
          }}
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            const placeholder = fallbackSrc || FALLBACK_PLACEHOLDER;
            // Avoid infinite loop: if already showing a placeholder, hide instead.
            if (img.src.endsWith(placeholder) || img.dataset.fallback === '1') {
              const fig = img.closest('figure');
              if (fig) fig.style.display = 'none';
              return;
            }
            img.dataset.fallback = '1';
            img.src = placeholder;
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
