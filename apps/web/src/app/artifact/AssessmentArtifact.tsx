import React from 'react';
import FollowUp from './FollowUp';
import type { ArtifactPayload } from './fixtures';
import { toCanonicalAssessment, type CanonicalAssessment } from '@/lib/artifact/canonical';

/**
 * The Assessment Renderer — the shared semantic component tree.
 *
 * Consumes the Canonical Assessment Model (CAM). This is the *Web Artifact*
 * expression: a natural responsive reading of the assessment (not a simulation
 * of two paper sheets). The verdict is the centre of gravity; every other
 * block supports it. Print pagination, PDF, and the share projection are later
 * envelopes derived from the same CAM + this component.
 *
 * Back-compatible: existing call sites pass `p: ArtifactPayload` and get a CAM
 * built by the adapter (richer fields need `raw`; without it they degrade
 * gracefully). The /artifact route passes the full `canonical` directly.
 *
 * Styles travel with the component (scoped `.axa-*`, injected once) so the
 * design renders identically wherever the assessment appears.
 */
export default function AssessmentArtifact(
  {
    p,
    raw,
    canonical,
    contradictions = [],
    print = false,
    embedded = false,
  }: {
    p?: ArtifactPayload;
    raw?: unknown;
    canonical?: CanonicalAssessment;
    contradictions?: string[];
    print?: boolean;
    embedded?: boolean;
  },
) {
  const a: CanonicalAssessment | null =
    canonical ?? (p ? toCanonicalAssessment(p, raw) : null);
  if (!a) return null;

  const rootCls = 'axa-root' + (print ? ' axa-print' : '') + (embedded ? ' axa-embedded' : '');
  const sig = a.identity.tonalSignature;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: AXA_CSS }} />
      <article className={rootCls}>
        <div className="axa-ident">
          <span className="who"><b>Audio&nbsp;XX</b> System Assessment</span>
          <span className="when">{a.meta.date}</span>
        </div>

        {/* Subject line — WHAT was assessed, in one line. The verdict is
          * meaningless without it, so it stays above; the heavy evidence of
          * the subject (photo strip, origin prose) moves below the verdict. */}
        <p className="axa-kicker">The system assessed</p>
        <h1 className="axa-systemline">
          {a.subject.components.map((c) => c.name).join(' · ')}
        </h1>

        {/* Verdict — the centre of gravity, and now the first thing a reader
          * meets (founder, 2026-08-13). It previously sat below the photo
          * strip and the origin rows, which put the single most valuable
          * sentence on the page at ~805px — the bottom of a 900px viewport.
          * Publications lead with the conclusion. */}
        <div className="axa-verdictwrap">
          <span className="axa-rule" aria-hidden="true" />
          <h2 className="axa-verdict">{a.identity.verdict}</h2>
          {a.identity.signature && <p className="axa-standfirst">{a.identity.signature}</p>}
        </div>

        {sig && sig.length > 0 && (
          <div className="axa-sig">
            <p className="cap">Tonal signature</p>
            {/* Ruled reading table (2026-08-13): the scale sits left and right,
              * the marker plots the role-weighted numeric average, and the
              * reading names the result in the accent. The reading is derived
              * from the same value and band as the marker, so the table cannot
              * disagree with itself or with the signature prose above it. */}
            <div className="axa-sigtable">
              {sig.map((ax) => (
                <div className="axa-axis" key={ax.axis}>
                  <span className={'l' + (ax.pole === 'left' ? ' on' : '')}>{ax.left}</span>
                  <span className="axa-track">
                    <i className={ax.pole === 'neutral' ? 'neu' : ''} style={{ left: `${ax.position}%` }} />
                  </span>
                  <span className={'r' + (ax.pole === 'right' ? ' on' : '')}>{ax.right}</span>
                  <span className={'rd' + (ax.pole === 'neutral' ? ' bal' : '')}>
                    {ax.pole === 'left' ? ax.left : ax.pole === 'right' ? ax.right : 'Balanced'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subject evidence — the components themselves, after the verdict
          * and the signature that summarise them. */}
        {a.subject.components.length > 0 && (
          <ul className="axa-strip" aria-label="Components">
            {a.subject.components.map((c, i) => (
              <li className="axa-plate" key={i}>
                <div className="img">
                  {c.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.photo.src} alt={c.photo.alt} />
                    : <span className="ph" aria-hidden="true">◵</span>}
                </div>
                <span className="nm">{c.name}</span>
              </li>
            ))}
          </ul>
        )}

        {a.subject.components.some((c) => c.origin) && (
          <ul className="axa-origins" aria-label="Component origins">
            {a.subject.components.filter((c) => c.origin).map((c, i) => (
              <li key={i}><b>{c.name}</b> — {c.origin}</li>
            ))}
          </ul>
        )}

        <section className="axa-section">
          <p className="axa-label">Recognition</p>
          <p className="axa-p">{a.identity.recognition}</p>
        </section>

        <section className="axa-section">
          <p className="axa-label">Recommendation</p>
          <p className="axa-reco">{a.guidance.recommendation}</p>
          {a.guidance.oneCost && <p className="axa-cost">{a.guidance.oneCost}</p>}
        </section>

        <hr className="axa-divider" aria-hidden="true" />

        {a.reading.engineering.length > 0 && (
          <section className="axa-section">
            <p className="axa-label">Engineering</p>
            {a.reading.engineering.map((para, i) => <p className="axa-p" key={i}>{para}</p>)}
          </section>
        )}

        {a.reading.listeningSession.length > 0 && (
          <section className="axa-section">
            <p className="axa-label">Listening session</p>
            {a.reading.listeningSession.map((para, i) => <p className="axa-p" key={i}>{para}</p>)}
          </section>
        )}

        {/* Dominant character is intentionally NOT rendered (founder,
          * 2026-08-13). The line restated a character the standfirst and the
          * Tonal Signature already state, and it was generated from four
          * fixed templates keyed to the pre-unification categorical axes —
          * so it could contradict both. It returns post-beta in a different
          * job: naming the COMPONENT responsible for the character.
          * Spec: docs/backlog/machine-voice-editorial.md.
          * The CAM field and validateDominantCharacter are retained for that
          * rebuild; nothing consumes them today. */}

        {a.reading.operatingCondition && (
          <section className="axa-section">
            <p className="axa-label">Operating condition</p>
            <div className="axa-cond"><p className="axa-p">{a.reading.operatingCondition}</p></div>
          </section>
        )}

        {/* Provenance as a ruled block (2026-08-13): what licenses the
          * assessment was set as a footnote — 13.5px italic and a row of
          * 10px links. It is doctrine-central (D-7), so it now reads as a
          * panel with a source table and an evidence-class chip per source,
          * using the same devices as the rest of the document. */}
        <section className="axa-section axa-evsection">
          <p className="axa-label">Evidence</p>
          <div className="axa-evblock">
            <p className="axa-evidence">{a.evidence.statement}</p>
            {a.evidence.primarySources && a.evidence.primarySources.length > 0 && (
              <div className="axa-srctable">
                <p className="axa-srchead">Primary sources</p>
                {a.evidence.primarySources.map((s, i) => (
                  <div className="axa-srcrow" key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.label}</a>
                    <span className="axa-chip">{s.evidenceClass}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <p className="axa-colophon">Audio XX · System Assessment · {a.meta.date}</p>
      </article>

      {!print && !embedded && contradictions.length > 0 && (
        <aside className="axa-contradiction" aria-label="Engine diagnostics — not part of the assessment">
          <strong>Engine output contradictions (surfaced, not smoothed):</strong>
          <ul>{contradictions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </aside>
      )}

      {!print && !embedded && <FollowUp />}
    </>
  );
}

/* Scoped design system — cream paper, claret accent, restrained serif.
   Single-column responsive reading (web-primary). Travels with the component. */
const AXA_CSS = `
.axa-root{
  --ground:#FBF7EE; --panel:#F1EBDC; --ink:#423E37; --ink-muted:#66605C; --ink-faint:#948C86;
  --accent:#990F3D; --hairline:#CCC1B7;
  --serif:'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;
  --grot:ui-sans-serif,-apple-system,'Helvetica Neue','Segoe UI',Arial,sans-serif;
  background:var(--ground); color:var(--ink); font-family:var(--serif);
  width:100%; max-width:640px; margin:0 auto; padding:clamp(20px,5vw,56px) clamp(16px,5vw,64px) 44px;
  box-sizing:border-box; overflow-wrap:break-word; -webkit-font-smoothing:antialiased;
}
.axa-root *{box-sizing:border-box;min-width:0}
.axa-root img{max-width:100%;height:auto}
@media (prefers-color-scheme:dark){ .axa-root{ --ground:#221F1A; --panel:#2A2620; --ink:#EDE6D8; --ink-muted:#B4AC9E; --ink-faint:#867E70; --accent:#E8628B; --hairline:#3A362E; } }
.axa-ident{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--hairline);padding-bottom:8px;margin-bottom:28px}
.axa-ident .who{font-family:var(--grot);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-muted)}
.axa-ident .who b{color:var(--ink);font-weight:700;letter-spacing:.2em;margin-right:8px}
.axa-ident .when{font-family:var(--grot);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);font-variant-numeric:tabular-nums}
.axa-kicker{font-family:var(--grot);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-faint);margin:0 0 10px}
.axa-systemline{font-family:var(--serif);font-weight:600;font-size:clamp(21px,2.8vw,26px);line-height:1.3;margin:0 0 6px;letter-spacing:-.01em;text-wrap:balance}
.axa-strip{list-style:none;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:28px 0 8px}
.axa-plate{display:flex;flex-direction:column;gap:6px}
.axa-plate .img{aspect-ratio:4/3;border:1px solid var(--hairline);background:var(--panel);border-radius:2px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.axa-plate .img img{width:100%;height:100%;object-fit:cover}
.axa-plate .img .ph{color:var(--ink-faint);font-size:20px;opacity:.5}
.axa-plate .nm{font-family:var(--serif);font-size:13.5px;line-height:1.25}
.axa-verdictwrap{margin:26px 0 10px}
.axa-rule{display:block;width:40px;height:2.5px;background:var(--accent);margin-bottom:18px}
.axa-verdict{font-family:var(--serif);font-weight:600;font-size:clamp(32px,5.4vw,46px);line-height:1.02;letter-spacing:-.02em;margin:0 0 16px;text-wrap:balance}
.axa-standfirst{font-family:var(--serif);font-style:italic;font-size:clamp(17px,2.3vw,19.5px);line-height:1.5;color:var(--ink-muted);margin:0;text-wrap:pretty}
.axa-sig{margin:28px 0 6px}
.axa-sig .cap{font-family:var(--grot);font-size:12.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 10px;display:flex;align-items:center;gap:8px}
.axa-sig .cap::before{content:"";width:20px;height:2px;background:var(--accent);display:inline-block}
/* Ruled reading table — the proposal-document idiom the founder asked the
 * product to lean into (2026-08-13): bordered block, hairline row rules,
 * sans data face, the reading carried in the accent. */
.axa-sigtable{border:1px solid var(--hairline);border-radius:2px}
.axa-axis{display:grid;grid-template-columns:74px 1fr 74px 84px;align-items:center;gap:14px;padding:11px 14px;border-top:1px solid var(--hairline)}
.axa-axis:first-child{border-top:0}
.axa-axis span{font-family:var(--grot);font-size:11.5px;color:var(--ink-faint)}
.axa-axis .r{text-align:right}
/* The scale reads as a scale — both poles equal. The committed pole is
 * named once, in the reading column, rather than twice in two visual
 * languages. */
/* The reading — the one value in the row, in the accent. */
.axa-axis .rd{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);text-align:right}
.axa-axis .rd.bal{color:var(--ink-faint);font-weight:600}
.axa-track{position:relative;height:1.5px;background:var(--hairline)}
/* Centre tick — the neutral point, so distance from it reads as degree. */
.axa-track::before{content:"";position:absolute;left:50%;top:-4px;width:1px;height:9px;background:var(--hairline)}
.axa-track i{position:absolute;top:50%;width:9px;height:9px;border-radius:50%;background:var(--accent);transform:translate(-50%,-50%);box-shadow:0 0 0 3px var(--ground)}
/* A balanced axis reads as an open marker; a committed one is solid. */
.axa-track i.neu{background:var(--ground);border:1.5px solid var(--ink-faint)}
.axa-section{margin-top:26px}
/* Section eyebrows carry the accent (founder, 2026-08-13): they join the
 * accent system without becoming furniture — bolder colour without raising
 * the volume. The red block treatment was tried and rejected: stacked six
 * times down the page it reads as UI badges rather than editorial rubrics. */
.axa-label{font-family:var(--grot);font-size:12.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 8px;display:flex;align-items:center;gap:8px}
.axa-label::before{content:"";width:20px;height:2px;background:var(--accent);display:inline-block}
.axa-p{font-size:18px;line-height:1.62;margin:0 0 13px;color:var(--ink)}
.axa-p:last-child{margin-bottom:0}
.axa-reco{font-family:var(--serif);font-size:20.5px;line-height:1.5;margin:0}
.axa-cost{font-size:15.5px;line-height:1.55;color:var(--ink-muted);font-style:italic;margin:8px 0 0}
.axa-divider{border:0;border-top:1px solid var(--hairline);max-width:100%;margin:30px 0 4px}
.axa-cond{background:var(--panel);border:1px solid var(--hairline);border-radius:2px;padding:14px 16px;margin-top:6px}
.axa-cond .axa-p{font-size:17px;margin:0}
.axa-evsection{margin-top:34px}
.axa-evblock{border:1px solid var(--hairline);border-radius:2px;background:var(--panel);padding:16px 18px}
/* Full ink, not muted (founder, 2026-08-13): inside a tinted panel the
 * muted grey read as de-emphasised, and what licenses the assessment is not
 * a footnote. Italic still distinguishes it as a provenance statement. */
.axa-evidence{font-family:var(--serif);font-style:italic;font-size:16.5px;line-height:1.55;color:var(--ink);margin:0;text-wrap:pretty}
.axa-srctable{margin-top:14px;border-top:1px solid var(--hairline);padding-top:12px}
.axa-srchead{font-family:var(--grot);font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-faint);margin:0 0 4px}
.axa-srcrow{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:8px 0;border-top:1px solid var(--hairline)}
.axa-srcrow:nth-of-type(2){border-top:0}
.axa-srcrow a{font-size:15.5px;color:var(--accent);text-decoration:none;border-bottom:1px solid color-mix(in oklab,var(--accent) 40%,transparent)}
/* Evidence-class chip — names what licenses the source, in the chip idiom. */
.axa-chip{font-family:var(--grot);font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted);background:var(--ground);border:1px solid var(--hairline);border-radius:2px;padding:3px 8px;white-space:nowrap}
.axa-colophon{margin-top:18px;font-family:var(--grot);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint)}
/* Ruled rows, deliberately NOT a boxed panel: this sits directly above the
 * verdict, which is the page's centre of gravity — a tinted block here would
 * compete with it. Structure without weight. */
.axa-origins{list-style:none;padding:0;margin:20px 0 0;border-top:1px solid var(--hairline)}
.axa-origins li{font-size:16px;line-height:1.55;color:var(--ink-muted);padding:11px 0;border-bottom:1px solid var(--hairline)}
.axa-origins li b{color:var(--ink);font-weight:600;font-family:var(--serif)}
/* Embedded assessments keep the 640px reading measure — the conversation
 * column is wider (~748px) and letting the artifact fill it pushed prose
 * to ~97 characters/line (readability pass, founder-approved 2026-08-13). */
.axa-embedded{max-width:640px;margin:0;padding-left:0;padding-right:0;background:transparent}
@media (max-width:560px){
  .axa-strip{grid-template-columns:repeat(2,1fr)}
  /* Narrow: the reading moves under the track, scale labels stay flanking. */
  .axa-axis{grid-template-columns:56px 1fr 56px;gap:6px 10px;padding:10px 12px}
  .axa-axis span{font-size:10px}
  .axa-axis .rd{grid-column:1 / -1;text-align:left;font-size:10.5px}
  .axa-ident{flex-wrap:wrap;gap:4px 12px}
}
@media (max-width:360px){
  .axa-axis{grid-template-columns:46px 1fr 46px}
  .axa-axis .rd{grid-column:1 / -1}
}
@media print{
  .axa-root{background:#fff;color:#000;max-width:100%}
  .axa-contradiction{display:none}
}
`;
