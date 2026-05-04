'use client';

/**
 * Tiny client wrapper for product images in server-rendered cards.
 * Handles onError gracefully — hides the container if the image fails to load.
 * Optional credit line renders below the image in muted text.
 */
export function ProductImage({ src, alt, credit }: { src: string; alt: string; credit?: string }) {
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
            const fig = (e.currentTarget as HTMLImageElement).closest('figure');
            if (fig) fig.style.display = 'none';
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
