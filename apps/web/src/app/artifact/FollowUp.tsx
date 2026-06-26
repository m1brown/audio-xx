'use client';

import { useState } from 'react';

/**
 * Follow-up lives OUTSIDE the editorial artifact, past a hard boundary (a full
 * screen of silence). It is deliberately un-editorial — plain system type — so
 * the artifact above it stays a clean, screenshot- and print-able document.
 * It is removed entirely from print / PDF (see artifact.css @media print).
 */
export default function FollowUp() {
  const [open, setOpen] = useState(false);
  return (
    <section className="axx-followup" aria-label="Follow-up — not part of the assessment">
      <div className="axx-sep" aria-hidden="true" />
      {!open ? (
        <a
          href="#follow-up"
          onClick={(e) => { e.preventDefault(); setOpen(true); }}
        >
          Ask a follow-up about this assessment →
        </a>
      ) : (
        <div>
          <label htmlFor="axx-fu" style={{ display: 'block', marginBottom: '.5rem', color: '#6B6862', fontSize: '.9rem' }}>
            Your question
          </label>
          <textarea id="axx-fu" rows={3} placeholder="Ask about this system…" />
        </div>
      )}
    </section>
  );
}
