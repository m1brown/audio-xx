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
import React from 'react';
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
  // Render-worthiness is decided in the presentation layer; a component with
  // only detail-level knowledge still gets a card, because holding four
  // published specifications and showing nothing is worse than a short card.
  const present = (dossiers ?? []);
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
          {/* `detailSummary` is NOT rendered. It announced "4 published
              details held" and then listed the four details immediately below
              — a count of what the reader can already see. It made sense when
              detail was collapsed behind a disclosure control; that control is
              gone, so the sentence now only delays the facts. The field is
              retained because `worthRendering` uses it to decide whether a
              component holds enough to deserve a card at all. */}

          {d.gaps.map((g, i) => (
            <p key={i} style={{
              margin: '0.5rem 0 0 0', fontSize: '0.84rem',
              lineHeight: 1.5, color: COLOR.textMuted,
            }}>
              Not established: {g}.
            </p>
          ))}

          {/* No progressive disclosure. Once a fact has been admitted to the
              DossierView, hiding it behind a second interaction is the
              presentation layer overruling a selection decision already made.
              Selection stays with `presentDossier`; display shows what it
              chose. Depth varies by component, and one with three useful facts
              is simply shorter than one with ten. */}
          {d.secondary.map((l, i) => <Line key={`s${i}`} l={l} />)}

        </div>
      ))}
    </section>
  );
}
