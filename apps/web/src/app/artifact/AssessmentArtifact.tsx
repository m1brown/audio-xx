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
            {p.caseParagraphs.map((para, i) => <p key={i}>{para}</p>)}
            {/* Causal Explanation pilot (Phase 1) — temporary, clearly-labelled
              * evaluation block. Present only when the deterministic causal
              * engine produced a claim from approved authored knowledge.
              * Not the final presentation. */}
            {p.causalBlock && (
              <section className="axx-causal" aria-label="Why it sounds this way">
                <h2 className="axx-vh">Why it sounds this way</h2>
                <p>{p.causalBlock}</p>
              </section>
            )}
            {/* Brand house-voicing — approved knowledge surfaced through the gate
              * stack. One short observation per qualifying component; absent when
              * no brand qualifies (restraint). Rendered as quiet editorial notes
              * under a small-caps rule, so it reads as marginalia to the judgment
              * rather than a second verdict. */}
            {p.brandNotes && p.brandNotes.length > 0 && (
              <section className="axx-brandnotes" aria-label="On the houses">
                <h2 className="axx-brandnotes-h">On the houses</h2>
                {p.brandNotes.map((n, i) => (
                  <p key={i}>
                    <span className="axx-brandnote-name">{n.component}</span>
                    {' — '}
                    {n.sentence}
                  </p>
                ))}
              </section>
            )}
          </div>

          {/* Peak 2 — the recommendation. Lives in column 3 so its gap to the
            * last judgment paragraph is the --pause silence, not the leftover
            * height of the evidence rail. (On narrow viewports the grid
            * collapses to one column and the order falls back to verdict →
            * rail → judgment → recommendation in the natural reading flow.) */}
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
        </div>

        {p.cost && <p className="axx-cost">{p.cost}</p>}

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
