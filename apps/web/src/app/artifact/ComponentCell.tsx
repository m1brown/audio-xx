'use client';

/**
 * One cell of the artifact's component photo strip (M4).
 *
 * A product image that fails to load removes its whole cell — the
 * strip degrades to the remaining photos (or disappears via the
 * server-side some() guard when none load), exactly as if no photo
 * had existed. An empty white frame never reads as a broken product.
 */
import React, { useEffect, useRef, useState } from 'react';

export default function ComponentCell(
  { src, alt, name }: { src: string; alt: string; name: string },
) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // The server-rendered image may have ALREADY failed before hydration
  // attached onError — a fast 404 beats React to it. Check on mount:
  // a complete image with no natural size is a failed load.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;
  return (
    <li className="axx-component-cell">
      <div className="axx-component-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      </div>
      {name && <span className="axx-component-name">{name}</span>}
    </li>
  );
}
