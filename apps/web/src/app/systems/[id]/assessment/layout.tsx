import React from 'react';
import '@/app/artifact/artifact.css';

/**
 * Saved-assessment layout (MVP M2). Reuses the artifact stylesheet and
 * chrome-stripping wrapper so a saved assessment reads exactly like the
 * live artifact — the same publication, another spread.
 */
export default function SavedAssessmentLayout({ children }: { children: React.ReactNode }) {
  return <div className="axx-route">{children}</div>;
}
