import React from 'react';
import Link from 'next/link';
import FollowUp from './FollowUp';
import ComponentCell from './ComponentCell';
import type { ArtifactPayload } from './fixtures';

/**
 * The canonical Audio XX assessment, rendered as a finished editorial document.
 * One <article> filled from a payload; two full-width peaks (verdict,
 * recommendation); an evidence rail kept to one side of the judgment column;
 * three silences carried by spacing tokens. Follow-up is a sibling, outside.
 *
 * `embedded` is a presentation-only gate used when the artifact renders
 * inside the chat stream (v2 dispatch). It suppresses the masthead (the chat
 * shell already carries identity + timestamp), the FollowUp surface (chat
 * composer handles follow-ups), the contradictions diagnostics block (dev
 * surface only; not for end users in chat), and the entrance animation (the
 * message envelope already animates in). The article markup, typography,
 * spacing, R1–R8 rule output, and overall composition are unchanged.
 */
export default function AssessmentArtifact(
  { p, contradictions = [], print = false, embedded = false }:
  { p: ArtifactPayload; contradictions?: string[]; print?: boolean; embedded?: boolean },
) {
  const articleCls =
    'axx-artifact'
    + (print ? ' axx-print' : '')
    + (embedded ? ' axx-embedded' : '');
  return (
    <>
      <article className={articleCls}>
        {!embedded && (
          <header className="axx-masthead">
            <Link href="/" className="axx-masthead-home" aria-label="Audio XX — back to home">
              <b>Audio XX</b>
            </Link>
            <span>{p.date}</span>
          </header>
        )}

        {/* Peak 1 — the verdict */}
        <section className="axx-verdict">
          <p className="axx-kicker">System Assessment</p>
          <h1>{p.verdict}</h1>
          {p.standfirst && <p className="axx-standfirst">{p.standfirst}</p>}
          <p className="axx-credit">{p.componentCredit.join(' · ')}</p>
          {/* Editorial photo strip — three components shown, not just
            * named. Renders only when at least one photo is present;
            * the credit line above is the fallback naming. Each cell
            * shows the product against a quiet cream and the component
            * name beneath in small caps. */}
          {Array.isArray(p.componentPhotos)
            && p.componentPhotos.some((ph) => ph !== null && ph !== undefined) && (
              <ul className="axx-component-strip" aria-label="Components">
                {p.componentPhotos.map((photo, i) => {
                  if (!photo) return null;
                  const name = p.componentCredit[i] ?? '';
                  return (
                    <ComponentCell key={i} src={photo.src} alt={photo.alt} name={name} />
                  );
                })}
              </ul>
            )}
        </section>

        {/* Peak 2 — the recommendation. Pulled up to sit directly beneath the
          * system summary so the complete assessment — verdict, system,
          * character, recommendation — reads as one self-contained answer
          * above the fold. The evidence / "why it sounds this way" layer
          * follows below the divider, as an optional deeper read. Order and
          * placement only; the recommendation's own styling is unchanged. */}
        <section className="axx-rec">
          <h2 className="axx-vh">Recommendation</h2>
          <p className="line">{p.recommendation}</p>
          {p.figure && (
            <figure className="axx-fig">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.figure.src} alt={p.figure.alt} width={640} height={427} />
              <figcaption>{p.figure.caption}</figcaption>
            </figure>
          )}
        </section>

        {p.cost && <p className="axx-cost">{p.cost}</p>}

        {/* Structural divider — separates the assessment (above) from the
          * optional evidence layer (below). Decorative; hidden from a11y. */}
        <hr className="axx-divider" aria-hidden="true" />

        {/* The seam — evidence (left) | judgment (right) */}
        <div className="axx-case">
          <aside className="axx-rail" aria-label="Evidence">
            <h2 className="axx-vh">Evidence</h2>
            {/* The component list lives once under the standfirst — the rail
             *  begins with evidence, not a repeated identifier. */}
            {p.heroDatum && (
              <p className="axx-datum">
                <span className="v">{p.heroDatum.value}</span>
                <span className="c">{p.heroDatum.caption}</span>
              </p>
            )}
            {/* The pull quote is Audio XX's own voice, not an attributed
              * quote — so no quotation marks. The italic face is the
              * typographic marker that this is a focused observation. */}
            {p.pullQuote && <p className="axx-pull">{p.pullQuote}</p>}
          </aside>

          <div className="axx-judgment">
            <p>{p.recognition}</p>
            {/* The case, as shortening beats. When the causal engine licenses an
              * interaction claim, the synthesizer has already woven that one
              * paragraph into this sequence within the mechanism arc — it is not
              * a separate labelled block. */}
            {p.caseParagraphs.map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </div>

        <footer className="axx-colophon">Audio XX · {p.date}</footer>
      </article>

      {!print && !embedded && contradictions.length > 0 && (
        <aside className="axx-contradiction" aria-label="Engine diagnostics — not part of the assessment">
          <strong>Engine output contradictions (surfaced, not smoothed):</strong>
          <ul>{contradictions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </aside>
      )}

      {!print && !embedded && <FollowUp />}
    </>
  );
}
