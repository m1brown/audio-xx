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

/**
 * The tonal signature, plotted from the reading the snapshot froze.
 *
 * `pole` and `position` were both decided upstream by the single numeric
 * derivation in `axis-poles.ts`. Nothing is recomputed here — recomputing a
 * pole in a renderer is how the same axis came to be stated three ways.
 */
function TonalSignature({ axes }: { axes: AxisReading[] }) {
  return (
    <section aria-label="Tonal signature">
      <h2 className="axx-label">Tonal signature</h2>
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
function Dossiers({ dossiers }: { dossiers: DossierView[] }) {
  return (
    <section aria-label="The components">
      <h2 className="axx-label">The components</h2>
      {dossiers.map((d) => (
        <div key={d.displayName} className="axx-component">
          <h3 className="axx-component-name">{d.displayName}</h3>

          {d.primary.map((l, i) => (
            <p key={i} className="axx-fact">
              <span className="axx-fact-label">{l.label}</span>
              <span className="axx-fact-value">
                {l.value}
                {l.standing && (
                  <em> — {l.standing}{l.publication ? ` by ${l.publication}` : ''}, not maker-published</em>
                )}
              </span>
            </p>
          ))}

          {d.detailSummary && <p className="axx-fact-muted">{d.detailSummary}</p>}

          {d.gaps.map((g, i) => (
            <p key={i} className="axx-fact-muted">Not established: {g}.</p>
          ))}

          {/* Open on the artifact: this is the finished document, not a
              working surface, and a reader who opened it wants what is held. */}
          {d.secondary.length > 0 && (
            <div className="axx-component-detail">
              {d.secondary.map((l, i) => (
                <p key={i} className="axx-fact">
                  <span className="axx-fact-label">{l.label}</span>
                  <span className="axx-fact-value">
                    {l.value}
                    {l.standing && (
                      <em> — {l.standing}{l.publication ? ` by ${l.publication}` : ''}, not maker-published</em>
                    )}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

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

      {s.tonalSignature && s.tonalSignature.length > 0 && (
        <TonalSignature axes={s.tonalSignature} />
      )}

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

      {s.componentDossiers && s.componentDossiers.length > 0 && (
        <Dossiers dossiers={s.componentDossiers} />
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
