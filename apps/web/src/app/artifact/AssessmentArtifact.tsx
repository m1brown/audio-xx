import React from 'react';
import FollowUp from './FollowUp';
import type { ArtifactPayload } from './fixtures';

/**
 * The canonical Audio XX assessment, rendered as a finished editorial document.
 * One <article> filled from a payload; two full-width peaks (verdict,
 * recommendation); an evidence rail kept to one side of the judgment column;
 * three silences carried by spacing tokens. Follow-up is a sibling, outside.
 */
export default function AssessmentArtifact(
  { p, contradictions = [], print = false }:
  { p: ArtifactPayload; contradictions?: string[]; print?: boolean },
) {
  return (
    <>
      <article className={'axx-artifact' + (print ? ' axx-print' : '')}>
        <header className="axx-masthead">
          <span><b>Audio XX</b></span>
          <span>{p.date}</span>
        </header>

        {/* Peak 1 — the verdict */}
        <section className="axx-verdict">
          <p className="axx-kicker">System Assessment</p>
          <h1>{p.verdict}</h1>
          {p.standfirst && <p className="axx-standfirst">{p.standfirst}</p>}
          <p className="axx-credit">{p.componentCredit.join(' · ')}</p>
        </section>

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
            {p.pullQuote && <p className="axx-pull">“{p.pullQuote}”</p>}
          </aside>

          <div className="axx-judgment">
            <p>{p.recognition}</p>
            {p.caseParagraphs.map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </div>

        {/* Peak 2 — the recommendation (preceded by the largest silence) */}
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

        <footer className="axx-colophon">Audio XX · {p.date}</footer>
      </article>

      {!print && contradictions.length > 0 && (
        <aside className="axx-contradiction" aria-label="Engine diagnostics — not part of the assessment">
          <strong>Engine output contradictions (surfaced, not smoothed):</strong>
          <ul>{contradictions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </aside>
      )}

      {!print && <FollowUp />}
    </>
  );
}
