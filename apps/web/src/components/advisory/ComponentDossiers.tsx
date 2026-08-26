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
import { deriveEvidenceLedger } from '@/lib/artifact/evidence-ledger';
import { synthesiseChain } from '@/lib/artifact/sonic-synthesis';
import { COLOR } from '@/lib/editorial-tokens';
import { meaningFor } from '@/lib/evidence/spec-meaning';

const label: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque, sans-serif)',
  fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: COLOR.textMuted,
};

function Line({ l }: { l: DossierView['primary'][number] }) {
  /*
   * WHAT THE FIGURE MEANS, under the figure.
   *
   * A dossier printing "600 ohms" and "47K ohms" tells a reader who already
   * knows exactly nothing new, and everyone else nothing at all. The gloss
   * explains the QUANTITY — what output impedance is, which way is better —
   * and never the product: every sentence it can produce would read the same
   * under any component, which is what keeps it outside the character lane.
   *
   * Most labels get none. Dimensions and weight need no explaining, and a
   * sentence under every row would bury the ones that earn their place.
   */
  const meaning = meaningFor(l.label);
  return (
    <div style={{ display: 'flex', gap: '0.7rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
      <span style={{ ...label, minWidth: '8.5rem' }}>{l.label}</span>
      <span style={{ fontSize: '0.86rem', lineHeight: 1.5, flex: 1, minWidth: '12rem' }}>
        {l.value}
        {l.standing && (
          <em style={{ color: COLOR.textMuted, fontSize: '0.78rem' }}>
            {' '}— {l.standing}{l.publication ? ` by ${l.publication}` : ''}, not maker-published
          </em>
        )}
        {meaning && (
          <span style={{
            display: 'block', marginTop: '0.15rem', fontSize: '0.78rem',
            lineHeight: 1.45, color: COLOR.textMuted,
          }}>{meaning}</span>
        )}
      </span>
    </div>
  );
}

export default function ComponentDossiers({ dossiers }: { dossiers?: DossierView[] }) {
  // Render-worthiness is decided in the presentation layer; a component with
  // only detail-level knowledge still gets a card, because holding four
  // published specifications and showing nothing is worse than a short card.
  /**
   * Identity provenance, preserved from the card list this section replaced.
   *
   * `model` is deliberately empty — see the render site. `Audio XX catalog`
   * and `Audio XX brand evidence` are real provenance and must stay.
   */
  const BASIS_LABEL: Record<string, string> = {
    catalog: 'Audio XX catalog',
    brand: 'Audio XX brand evidence',
    model: '',
    user: 'Your description only',
  };
  const BASIS_TONE: Record<string, string> = {
    catalog: '#4F6B4A', brand: '#4F6B4A', model: '#8A6D3B', user: '#6B6862',
  };

  /** Evidence classes in the reader's language, matching the artifact. */
  const basisLabel = (c: string): string => ({
    maker_published: 'published by the manufacturer',
    independent_review: 'independent listening observations',
    independent_measurement: 'independent measurement',
    owner_report: 'owner report',
    third_party_reported: 'reported by a third party',
    catalog: 'Audio XX catalog',
    audio_xx_derived: 'derived by Audio XX',
  }[c] ?? c);

  const present = (dossiers ?? []);
  if (present.length === 0) return null;

  /*
   * The observation inventory belongs HERE, not in the review.
   *
   * SYSTEM REVIEW argues from this evidence; YOUR SYSTEM is where a reader
   * checking one component looks for what was actually said about it, by
   * whom, under what conditions. Printing the attributed statements in both
   * places put the same sentences twice in one document.
   *
   * Derived from the same pure function over the same admitted rows the
   * review used, so the two surfaces cannot drift.
   */
  const dossierSynthesis = synthesiseChain(
    present.map((d) => ({ displayName: d.displayName, role: d.role ?? '' })),
  );

  return (
    /*
     * THIS IS "YOUR SYSTEM", AND IT IS THE ONLY REPRESENTATION.
     *
     * The conversation rendered a lightweight "Your system" card list — name,
     * role, and the FIND ONE links — and then THE COMPONENTS below it with the
     * dossier for the same four boxes. Two renderings of one physical unit,
     * with the commercial links attached to the thinner one.
     *
     * The artifact was converged to SYSTEM REVIEW → YOUR SYSTEM → EVIDENCE
     * some time ago; this surface was not, so the duplication survived exactly
     * where most listeners meet it. Each component now appears once, with its
     * evidence and its resources together.
     */
    <section style={{ marginTop: '1.8rem' }} aria-label="Your system">
      <h2 style={{ ...label, marginBottom: '0.9rem' }}>Your system</h2>
      {present.map((d) => (
        <div key={d.displayName} style={{
          marginBottom: '1.3rem', paddingBottom: '1.1rem',
          borderBottom: '1px solid rgba(27,26,24,0.08)',
        }}>
          <p style={{ margin: '0 0 0.15rem 0', fontWeight: 600, fontSize: '0.95rem' }}>
            {d.displayName}
          </p>
          {/* IDENTITY PROVENANCE — a badge only where it tells the listener
              something. `model` (identity corroborated, nothing curated) is
              epistemically true and editorially empty: the listener owns the
              equipment, so being told it exists is not news. Its absence is
              the signal. */}
          {BASIS_LABEL[d.basis ?? ''] && (
            <p style={{
              margin: '0 0 0.4rem 0', display: 'inline-block',
              fontFamily: 'var(--face-grotesque), system-ui, sans-serif',
              fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.11em',
              textTransform: 'uppercase', color: BASIS_TONE[d.basis ?? ''],
              border: `1px solid ${BASIS_TONE[d.basis ?? '']}`, borderRadius: 2,
              padding: '0.1rem 0.35rem',
            }}>{BASIS_LABEL[d.basis ?? '']}</p>
          )}
          {/* The role belongs with the evidence, not in a separate list above
              it — that separation is what produced two cards per component. */}
          {d.role && (
            <p style={{
              margin: '0 0 0.55rem 0',
              fontFamily: 'var(--face-grotesque), system-ui, sans-serif',
              fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'rgba(27,26,24,0.45)',
            }}>{d.role}</p>
          )}
          {/* Recognition, not evidence. Rendered only when the governed
              boundary admitted an exact-product asset; absent renders NOTHING
              — no frame, no placeholder, no reserved space — so a dossier
              without a photograph is a finished card rather than a gap. */}
          {d.image && (
            <figure style={{ margin: '0 0 0.7rem 0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.image.url}
                alt={d.displayName}
                style={{
                  display: 'block', maxWidth: '190px', width: '100%',
                  height: 'auto', objectFit: 'contain', borderRadius: 2,
                }}
              />
              {d.image.credit && (
                <figcaption style={{ ...label, marginTop: '0.25rem' }}>
                  {d.image.credit}
                </figcaption>
              )}
            </figure>
          )}
          {/* EVIDENCE-GROUNDED CHARACTERISATION — one or two sentences,
            * assembled from this component's admitted propositions and
            * nothing else. The statements are the character layer's own,
            * already phrased at licensed strength; this block selects the
            * strongest one or two so the card opens with what independent
            * listeners actually established, before the figures. */}
          {(() => {
            const props = dossierSynthesis.character.get(d.displayName) ?? [];
            if (props.length === 0) return null;
            const rank = { convergent_observations: 0, direct_observation: 1, comparative_only: 2, conditional: 3 };
            const lead = [...props].sort((a, b) => rank[a.basis] - rank[b.basis]).slice(0, 2);
            return (
              <p style={{
                margin: '0 0 0.7rem 0', fontSize: '0.88rem', lineHeight: 1.55,
                color: 'rgba(27,26,24,0.8)',
              }}>{lead.map((x) => x.statement).join(' ')}</p>
            );
          })()}
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

          {/* A component Audio XX holds nothing about still appears, and says
              so. Silence here would read as an oversight; stating it is the
              same discipline the assessment applies everywhere else. */}
          {d.primary.length === 0 && d.secondary.length === 0
            && d.gaps.length === 0 && (
            <p style={{
              margin: 0, fontSize: '0.85rem', fontStyle: 'italic',
              color: 'rgba(27,26,24,0.5)',
            }}>
              Audio XX holds no published specifications for this unit yet.
            </p>
          )}

          {/* RESOURCES — last, quiet, and clearly not evidence. They lived on
              a separate lightweight card, which is what made each component
              appear twice. Subordinate to the evidence above them, and built
              from canonical product identity. */}
          {/* WHAT REVIEWERS HEARD — the rest of this component's admitted
            * observations, inside its own card. The two shown in the
            * characterisation above are not repeated. */}
          {(() => {
            const props = dossierSynthesis.character.get(d.displayName) ?? [];
            if (props.length <= 2) return null;
            const rank = { convergent_observations: 0, direct_observation: 1, comparative_only: 2, conditional: 3 };
            const rest = [...props].sort((a, b) => rank[a.basis] - rank[b.basis]).slice(2);
            return (
              <div style={{ marginTop: '0.8rem' }}>
                <p style={{ ...label, margin: '0 0 0.3rem 0' }}>What reviewers heard</p>
                {rest.map((x, i) => (
                  <p key={i} style={{
                    margin: '0 0 0.3rem 0', fontSize: '0.83rem', lineHeight: 1.5,
                    color: 'rgba(27,26,24,0.68)',
                  }}>{x.statement}</p>
                ))}
              </div>
            );
          })()}

          {/* FIND ONE — deliberately discoverable, deliberately subordinate.
            * The blue is the action accent, not an advertisement: it marks
            * navigation the way the app's own links do, and it sits last in
            * the card, after photograph, identity, characterisation and
            * evidence. Destinations derive from canonical identity. */}
          {d.resources && d.resources.length > 0 && (
            <p style={{
              margin: '0.85rem 0 0 0',
              fontFamily: 'var(--face-grotesque), system-ui, sans-serif',
              fontSize: '0.7rem', letterSpacing: '0.06em',
            }}>
              <span style={{
                textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700,
                marginRight: '0.7rem', color: '#2b5e9e',
              }}>Find one</span>
              {d.resources.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  style={{
                    color: '#2b5e9e', marginRight: '0.8rem',
                    textDecoration: 'none', borderBottom: '1px solid rgba(43,94,158,0.35)',
                  }}
                >{r.label}</a>
              ))}
            </p>
          )}
        </div>
      ))}

      {/* The consolidated WHAT REVIEWERS OBSERVED section was REMOVED
        * (2026-08-26, convergence): it re-listed every component a second
        * time, after the dossiers, which made the review evidence read as a
        * separate report rather than part of each product. The observations
        * now render INSIDE each component's dossier above — where a reader
        * examining that component actually looks. */}

      {/* EVIDENCE — the third principal section, on this surface too.
        *
        * The conversation carried SYSTEM REVIEW and YOUR SYSTEM and stopped.
        * A listener who pressed Cmd-P therefore received a two-section
        * document while the artifact route produced three, so which route was
        * canonical decided what they got. Derived from the SAME dossiers
        * rendered above, so a source can appear here only because evidence
        * from it survives into the assessment. */}
      {(() => {
        /*
         * The ledger now sees the review evidence too.
         *
         * Without the second argument this section listed manufacturer
         * specifications only, while the review above it quoted The Absolute
         * Sound and SoundStage! — an EVIDENCE section that omitted the sources
         * of the assessment's strongest claims. Derived from the same pure
         * function over the same admitted rows the review used, so this is one
         * bibliography rather than a parallel one.
         */
        const ledger = deriveEvidenceLedger(present, dossierSynthesis);
        if (!ledger.entries?.length && !ledger.statement) return null;
        return (
          <section style={{ marginTop: '1.8rem' }} aria-label="Evidence">
            <h2 style={{ ...label, marginBottom: '0.7rem' }}>Evidence</h2>
            <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', color: 'rgba(27,26,24,0.6)' }}>
              {ledger.statement}
            </p>
            {ledger.entries?.map((e) => (
              <p key={`${e.label}-${e.licensedFor.join(',')}`} style={{
                margin: '0 0 0.3rem 0', fontSize: '0.8rem', color: 'rgba(27,26,24,0.55)',
              }}>
                {e.url
                  ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.label}</a>
                  : e.label}
                {' — '}
                {/* Scope travels with the source: a publication may never look
                    as though it supported a component it said nothing about. */}
                {basisLabel(e.evidenceClass)} · {e.licensedFor.join(', ')}
              </p>
            ))}
          </section>
        );
      })()}
    </section>
  );
}
