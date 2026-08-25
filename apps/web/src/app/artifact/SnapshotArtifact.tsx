/**
 * Render a frozen assessment snapshot.
 *
 * THE ONE RULE: this component reads the snapshot and nothing else. It calls no
 * engine, resolves no product, consults no catalog and derives no axis. Every
 * value it displays was decided when the listener was first shown the
 * assessment.
 *
 * Presentation is deliberately plain in this pass — the snapshot/access
 * boundary is what is being proved. Typography, print polish and artifact
 * styling are held.
 */
import React from 'react';
import type { AssessmentSnapshotV1 } from '@/lib/artifact/snapshot';
import type { AxisReading } from '@/lib/artifact/canonical';
import type { DossierView } from '@/lib/evidence/dossier-presentation';
import { prettyLabel } from '@/lib/artifact/labels';

/**
 * The tonal signature, plotted from the reading the snapshot froze.
 *
 * `pole` and `position` were both decided upstream by the single numeric
 * derivation in `axis-poles.ts`. Nothing is recomputed here — recomputing a
 * pole in a renderer is how the same axis came to be stated three ways.
 */
/**
 * The evidence basis, in the reader's language.
 *
 * The snapshot stores the code (`brand`, `model`, `catalog`, `user`) because
 * that is what the engine decided. Printing the code put internal taxonomy in
 * front of the listener — "Acora QRC-2 (model)" says nothing to anyone who has
 * not read the source. These are the same words the conversation surface uses,
 * so one reader sees one vocabulary across both.
 */
function basisLabel(basis: string): string {
  switch (basis) {
    case 'catalog': return 'Audio XX catalog';
    case 'brand': return 'Audio XX brand evidence';
    case 'model': return 'identity corroborated';
    case 'user': return 'your description only';
    default: return basis;
  }
}

/**
 * Evidence classes in the reader's language.
 *
 * The stored values are the engine's vocabulary; a document must not print
 * `maker_published` at a listener any more than it prints `(model)`.
 */
const LEDGER_CLASS_LABEL: Record<string, string> = {
  maker_published: 'published by the manufacturer',
  independent_review: 'independent listening observations',
  third_party_reported: 'reported by a third party',
  catalog: 'Audio XX catalog',
};

function TonalSignature({ axes }: { axes: AxisReading[] }) {
  return (
    <section aria-label="Tonal signature">
      <h2 className="axx-section">Tonal signature</h2>
      {axes.map((a) => (
        <div key={a.axis} className="axx-axis">
          <span className="axx-axis-left">{a.left}</span>
          <span className="axx-axis-track" aria-hidden>
            <span className="axx-axis-mark" style={{ left: `${a.position}%` }} />
          </span>
          <span className="axx-axis-right">{a.right}</span>
          <span className="axx-axis-pole">
            {a.pole === 'neutral' ? 'Balanced' : a.pole === 'left' ? a.left : a.right}
          </span>
        </div>
      ))}
    </section>
  );
}

/**
 * Component dossiers, displayed exactly as the presentation layer resolved
 * them — primary lines, then the gaps it judged decision-relevant, then the
 * detail it demoted. This component chooses nothing.
 */
function Fact({ l }: { l: DossierView['primary'][number] }) {
  return (
    <div className="axx-fact">
      <span className="axx-fact-label">{prettyLabel(l.label)}</span>
      <span className="axx-fact-value">
        {l.value}
        {/* Compact epistemic marker. The full sentence — "reported by X, not
            maker-published" — was repeated on every row and outweighed the
            fact it qualified. The tag keeps the distinction visible and the
            per-component footnote below carries the source and the caveat
            once. */}
        {l.standing && <span className="axx-tag">{l.standing}</span>}
      </span>
    </div>
  );
}

function Dossiers({ dossiers }: { dossiers: DossierView[] }) {
  return (
    <section aria-label="Your system">
      <h2 className="axx-section">Your system</h2>
      {dossiers.map((d) => (
        <div key={d.displayName} className="axx-component">
          <h3 className="axx-cname">{d.displayName}</h3>
          {/* One representation per physical component. The lightweight card
              and the dossier were two renderings of one box; the role belongs
              with the evidence, not in a separate list above it. */}
          {d.role && <p className="axx-crole">{d.role}</p>}
          {/* Recognition, not evidence — see ComponentDossiers. Rendered only
              when the governed boundary admitted an exact-product asset;
              absent renders nothing at all, so a dossier without a photograph
              is a finished card rather than a gap. */}
          {d.image && (
            <figure className="axx-cimage">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.image.url} alt={d.displayName} />
              {d.image.credit && <figcaption>{d.image.credit}</figcaption>}
            </figure>
          )}

          {/* What the engine wrote ABOUT this component, with the component. */}
          {d.character && <p className="axx-ccharacter">{d.character}</p>}

          {d.primary.map((l, i) => <Fact key={i} l={l} />)}

          {/* detailSummary deliberately not rendered — see ComponentDossiers. */}

          {d.gaps.map((g, i) => (
            <p key={i} className="axx-fact-muted">Not established: {g}.</p>
          ))}

          {/* Open on the artifact: this is the finished document, not a
              working surface, and a reader who opened it wants what is held. */}
          {d.secondary.length > 0 && (
            <div className="axx-component-detail">
              {d.secondary.map((l, i) => <Fact key={i} l={l} />)}
            </div>
          )}

          {/* Every component in the graph appears here, including one Audio XX
              holds nothing about. Silence would read as an oversight. */}
          {d.primary.length === 0 && d.secondary.length === 0
            && d.gaps.length === 0 && (
            <p className="axx-fact-muted">
              Audio XX holds no published specifications for this unit yet.
            </p>
          )}

          {/* RESOURCES — last, quiet, and clearly not evidence. They follow
              everything Audio XX knows about the component rather than sitting
              beside its provenance, because a place to look and a statement of
              what is known are different kinds of thing. */}
          {d.resources && d.resources.length > 0 && (
            <p className="axx-cresources">
              Find one
              {d.resources.map((r) => (
                <a key={r.url} href={r.url} rel="noopener noreferrer nofollow">{r.label}</a>
              ))}
            </p>
          )}

          {(() => {
            const reported = [...new Set([...d.primary, ...d.secondary]
              .filter((l) => l.standing === 'reported' && l.publication)
              .map((l) => l.publication as string))];
            if (reported.length === 0) return null;
            return (
              <p className="axx-footnote">
                Reported by {reported.join(', ')} — not published by the maker.
              </p>
            );
          })()}
        </div>
      ))}
    </section>
  );
}

export default function SnapshotArtifact(
  { snapshot, embedded = false }:
  { snapshot: AssessmentSnapshotV1; embedded?: boolean },
) {
  const s = snapshot;
  return (
    <article className="axx-doc" aria-label="System assessment">
      {/* Embedded in a conversation the reader is already on the site, so the
          home link is navigation they do not need and a second "Audio XX"
          above the one in the nav bar. The DOCUMENT is identical either way —
          only this one piece of chrome differs. */}
      {!embedded && <a className="axx-home" href="/">Audio XX</a>}
      <header>
        <p className="axx-kicker">Audio XX System Assessment</p>
        <p className="axx-date">{new Date(s.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}</p>
      </header>

      <section aria-label="The system assessed">
        <p className="axx-credit">{s.components.map((c) => c.name).join(' · ')}</p>
        <p className="axx-verdict">{s.verdict}</p>
        {/* Subordinate to the finding it bounds — one register down, never
            competing with it for the eye. */}
        {s.qualification && <p className="axx-qualification">{s.qualification}</p>}
        {s.standfirst && <p className="axx-standfirst">{s.standfirst}</p>}
      </section>

      {s.tonalSignature && s.tonalSignature.length > 0 && (
        <TonalSignature axes={s.tonalSignature} />
      )}

      {s.recognition && (
        <section aria-label="Recognition">
          <h2 className="axx-section">Recognition</h2>
          <p>{s.recognition}</p>
        </section>
      )}

      {s.recommendation && (
        <section aria-label="Recommendation">
          <h2 className="axx-section">Recommendation</h2>
          <p>{s.recommendation}</p>
          {s.cost && <p>{s.cost}</p>}
        </section>
      )}

      {/* SYSTEM REVIEW — the intellectual centre of the document.
        *
        * It replaces a three-sentence review followed by four specification
        * sheets: a compatibility check handed back as a reading. Every
        * paragraph is composed from evidence this snapshot already holds and
        * states a relationship between facts rather than restating them.
        *
        * `sections` still renders where a snapshot predates the composed
        * review, so older artifacts keep their prose. */}
      {(s.systemReview?.length || s.sections.length) ? (
        <section aria-label="System review" className="axx-review">
          <h2 className="axx-section">System review</h2>
          {/* The composed analysis first, then whatever prose the engine
              already emitted — the coverage statement lives there. One
              section, so a reader meets one review rather than a review and
              an unlabelled remainder. */}
          {/* SEMANTIC SUBHEADS where the material exists, and nothing where it
              does not. A heading with filler under it is what the licensing
              work spent a month removing; a sparsely evidenced system keeps
              its short review and simply shows fewer slots. */}
          {s.reviewSections?.length
            ? s.reviewSections.map((sec) => (
              <div key={sec.label}>
                <h3 className="axx-review-slot">{sec.label}</h3>
                {sec.paragraphs.map((p, i) => <p key={`${sec.label}-${i}`}>{p}</p>)}
              </div>
            ))
            : (s.systemReview ?? []).map((p, i) => <p key={`r${i}`}>{p}</p>)}
          {/* Engine prose that survived the licence — the coverage statement
              lives here. With slots in play it belongs under the unknowns
              rather than trailing the previous heading unlabelled. */}
          {s.sections.length > 0 && (
            s.reviewSections?.length
              ? (
                <div>
                  {!s.reviewSections.some((x) => /remains unknown/i.test(x.label)) && (
                    <h3 className="axx-review-slot">What remains unknown</h3>
                  )}
                  {s.sections.flatMap((sec, i) =>
                    sec.paragraphs.map((p, j) => <p key={`s${i}-${j}`}>{p}</p>))}
                </div>
              )
              : s.sections.flatMap((sec, i) =>
                sec.paragraphs.map((p, j) => <p key={`s${i}-${j}`}>{p}</p>))
          )}

          {/* The diagnostic question is the closing slot, not a stray italic
              line between sections. */}
          {s.question && s.reviewSections?.length ? (
            <div>
              <h3 className="axx-review-slot">What would help next</h3>
              <p className="axx-question-line">{s.question}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {s.operatingCondition && (
        <section aria-label="Operating condition">
          <h2 className="axx-section">Operating condition</h2>
          <p>{s.operatingCondition}</p>
        </section>
      )}

      {/* NEXT comes before the reference material.
        *
        * The diagnostic question is the one thing the reader can act on, and
        * it sat behind four component dossiers — the reader met a page of
        * specifications before being told what would actually resolve the
        * open question. Conclusions and action first; reference after. */}
      {s.question && !s.reviewSections?.length && (
        <section aria-label="Next question" className="axx-question">
          <p>{s.question}</p>
        </section>
      )}

      {s.componentDossiers && s.componentDossiers.length > 0 && (
        <Dossiers dossiers={s.componentDossiers} />
      )}


      {/* `axx-doc-footer` marks this as the DOCUMENT's footer, not application
          chrome. The artifact route hides `footer` to strip site furniture,
          and this section — primary sources and provenance — was collateral. */}
      <footer aria-label="Evidence" className="axx-doc-footer">
        <h2 className="axx-section">Evidence</h2>
        <p>{s.evidenceLedger?.statement ?? s.evidenceStatement}</p>
        {/* SCOPE TRAVELS WITH THE SOURCE.
          *
          * Every entry names the components it licensed something about. A bare
          * list would let a reader carry a publication's authority across the
          * whole system — "Stereophile" beside a Butler/Acora power finding it
          * said nothing about. Naming the component keeps a source's displayed
          * role equal to the proposition it actually licensed.
          *
          * The ledger is derived from this snapshot's dossiers, so a source can
          * appear here only because evidence from it survives above. */}
        {s.evidenceLedger?.entries?.length ? (
          <ul className="axx-ledger">
            {s.evidenceLedger.entries.map((e) => (
              <li key={`${e.evidenceClass}-${e.label}`}>
                {e.url
                  ? <a href={e.url} rel="noopener noreferrer">{e.label}</a>
                  : <span>{e.label}</span>}
                {' — '}{LEDGER_CLASS_LABEL[e.evidenceClass]}
                {' · '}{e.licensedFor.join(', ')}
              </li>
            ))}
          </ul>
        ) : s.primarySources?.length ? (
          <ul>
            {s.primarySources.map((src) => (
              <li key={src.url}>
                <a href={src.url} rel="noopener noreferrer">{src.label}</a>
                {' — '}{src.evidenceClass}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="axx-provenance">
          {s.components.map((c) => `${c.name}${c.basis ? ` — ${basisLabel(c.basis)}` : ''}`).join(' · ')}
        </p>
        {/* A quiet close, so the document ends rather than stopping. */}
        <p className="axx-colophon">Audio XX · Notes on Your System</p>
      </footer>
    </article>
  );
}
