import React from 'react';
import './artifact.css';

/**
 * Artifact route layout. The wrapper class lets the stylesheet strip the
 * inherited app chrome (nav, start-over bar, footer) for this route only, so
 * the browser is left simply displaying a document.
 */
export default function ArtifactLayout({ children }: { children: React.ReactNode }) {
  return <div className="axx-route">{children}</div>;
}
