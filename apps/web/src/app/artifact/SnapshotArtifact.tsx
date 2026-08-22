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

export default function SnapshotArtifact({ snapshot }: { snapshot: AssessmentSnapshotV1 }) {
  const s = snapshot;
  return (
    <article className="axx-artifact" aria-label="System assessment">
      <header>
        <p className="axx-eyebrow">Audio XX System Assessment</p>
        <p className="axx-date">{new Date(s.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}</p>
      </header>

      <section aria-label="The system assessed">
        <h2 className="axx-label">The system assessed</h2>
        <p className="axx-credit">{s.components.map((c) => c.name).join(' · ')}</p>
        <p className="axx-verdict">{s.verdict}</p>
        {s.standfirst && <p className="axx-standfirst">{s.standfirst}</p>}
      </section>

      {s.recognition && (
        <section aria-label="Recognition">
          <h2 className="axx-label">Recognition</h2>
          <p>{s.recognition}</p>
        </section>
      )}

      {s.recommendation && (
        <section aria-label="Recommendation">
          <h2 className="axx-label">Recommendation</h2>
          <p>{s.recommendation}</p>
          {s.cost && <p>{s.cost}</p>}
        </section>
      )}

      {s.sections.map((sec, i) => (
        <section key={i} aria-label={sec.label ?? 'Assessment'}>
          {sec.label && <h2 className="axx-label">{sec.label}</h2>}
          {sec.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
        </section>
      ))}

      {s.operatingCondition && (
        <section aria-label="Operating condition">
          <h2 className="axx-label">Operating condition</h2>
          <p>{s.operatingCondition}</p>
        </section>
      )}

      {s.question && (
        <section aria-label="Next question" className="axx-question">
          <p>{s.question}</p>
        </section>
      )}

      <footer aria-label="Evidence">
        <h2 className="axx-label">Evidence</h2>
        <p>{s.evidenceStatement}</p>
        {s.primarySources?.length ? (
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
          {s.components.map((c) => `${c.name}${c.basis ? ` (${c.basis})` : ''}`).join(' · ')}
        </p>
      </footer>
    </article>
  );
}
