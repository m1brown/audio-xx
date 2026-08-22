'use client';

/**
 * Component dossiers — what each piece of equipment IS.
 *
 * Deliberately OUTSIDE the relational publication boundary. Every line here
 * has one subject, so D-12 was never its business: the filter polices claims
 * that two components act on one another, and a dossier makes none. Rendering
 * this as prose inside the system paragraphs would put single-subject facts
 * through a rule designed for interactions, and the filter would eat any
 * sentence that happened to name two products.
 *
 * Structure, not sentences. The presentation layer emits typed lines; this
 * component lays them out and adds no words of its own.
 */
import React, { useState } from 'react';
import type { DossierView } from '@/lib/evidence/dossier-presentation';
import { COLOR } from '@/lib/editorial-tokens';

const label: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque, sans-serif)',
  fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: COLOR.textMuted,
};

function Line({ l }: { l: DossierView['primary'][number] }) {
  return (
    <div style={{ display: 'flex', gap: '0.7rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
      <span style={{ ...label, minWidth: '8.5rem' }}>{l.label}</span>
      <span style={{ fontSize: '0.86rem', lineHeight: 1.5, flex: 1, minWidth: '12rem' }}>
        {l.value}
        {l.standing && (
          <em style={{ color: COLOR.textMuted, fontSize: '0.78rem' }}>
            {' '}— {l.standing}{l.publication ? ` by ${l.publication}` : ''}, not maker-published
          </em>
        )}
      </span>
    </div>
  );
}

export default function ComponentDossiers({ dossiers }: { dossiers?: DossierView[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const present = (dossiers ?? []).filter((d) => d.primary.length > 0 || d.gaps.length > 0);
  if (present.length === 0) return null;

  return (
    <section style={{ marginTop: '1.8rem' }} aria-label="The components">
      <h2 style={{ ...label, marginBottom: '0.9rem' }}>The components</h2>
      {present.map((d) => (
        <div key={d.displayName} style={{
          marginBottom: '1.3rem', paddingBottom: '1.1rem',
          borderBottom: '1px solid rgba(27,26,24,0.08)',
        }}>
          <p style={{ margin: '0 0 0.55rem 0', fontWeight: 600, fontSize: '0.95rem' }}>
            {d.displayName}
          </p>
          {d.primary.map((l, i) => <Line key={i} l={l} />)}

          {d.gaps.map((g, i) => (
            <p key={i} style={{
              margin: '0.5rem 0 0 0', fontSize: '0.84rem',
              lineHeight: 1.5, color: COLOR.textMuted,
            }}>
              Not established: {g}.
            </p>
          ))}

          {d.secondary.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [d.displayName]: !o[d.displayName] }))}
                style={{ ...label, background: 'none', border: 'none', padding: '0.5rem 0 0 0', cursor: 'pointer' }}
              >
                {open[d.displayName] ? '− Less' : '+ More detail'}
              </button>
              {open[d.displayName] && (
                <div style={{ marginTop: '0.5rem' }}>
                  {d.secondary.map((l, i) => <Line key={i} l={l} />)}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </section>
  );
}
