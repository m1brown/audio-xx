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

        {/* Subject — the system this assessment concerns */}
        <p className="axa-kicker">The system assessed</p>
        <h1 className="axa-systemline">
          {a.subject.components.map((c) => c.name).join(' · ')}
        </h1>
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

        {/* Verdict — the centre of gravity */}
        <div className="axa-verdictwrap">
          <span className="axa-rule" aria-hidden="true" />
          <h2 className="axa-verdict">{a.identity.verdict}</h2>
          {a.identity.signature && <p className="axa-standfirst">{a.identity.signature}</p>}
        </div>

        {sig && sig.length > 0 && (
          <div className="axa-sig">
            <p className="cap">Tonal signature</p>
            {sig.map((ax) => (
              <div className="axa-axis" key={ax.axis}>
                <span className={'l' + (ax.pole === 'left' ? ' on' : '')}>{ax.left}</span>
                <span className="axa-track"><i className={ax.pole === 'neutral' ? 'neu' : ''} style={{ left: `${ax.position}%` }} /></span>
                <span className={'r' + (ax.pole === 'right' ? ' on' : '')}>{ax.right}</span>
              </div>
            ))}
          </div>
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

        {/* Dominant character renders as ordinary labeled prose, not a
          * pull-quote: the line is a distilled observation, and display-type
          * staging promoted it to a slogan the evidence doesn't earn
          * (founder, 2026-08-13 — "trying too hard"). Copy generation
          * itself is deferred engine work (post-beta, option C). */}
        {a.reading.dominantCharacter && (
          <section className="axa-section">
            <p className="axa-label">Dominant character</p>
            <p className="axa-p">{a.reading.dominantCharacter}</p>
          </section>
        )}

        {a.reading.operatingCondition && (
          <section className="axa-section">
            <p className="axa-label">Operating condition</p>
            <div className="axa-cond"><p className="axa-p">{a.reading.operatingCondition}</p></div>
          </section>
        )}

        <p className="axa-evidence">{a.evidence.statement}</p>
        {a.evidence.primarySources && a.evidence.primarySources.length > 0 && (
          <p className="axa-sources">
            <span className="k">Primary sources</span>
            {a.evidence.primarySources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.label}</a>
            ))}
          </p>
        )}
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
.axa-ident .who{font-family:var(--grot);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-muted)}
.axa-ident .who b{color:var(--ink);font-weight:700;letter-spacing:.2em;margin-right:8px}
.axa-ident .when{font-family:var(--grot);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);font-variant-numeric:tabular-nums}
.axa-kicker{font-family:var(--grot);font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-faint);margin:0 0 10px}
.axa-systemline{font-family:var(--serif);font-weight:600;font-size:clamp(19px,2.6vw,23px);line-height:1.3;margin:0 0 20px;letter-spacing:-.01em;text-wrap:balance}
.axa-strip{list-style:none;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 8px}
.axa-plate{display:flex;flex-direction:column;gap:6px}
.axa-plate .img{aspect-ratio:4/3;border:1px solid var(--hairline);background:var(--panel);border-radius:2px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.axa-plate .img img{width:100%;height:100%;object-fit:cover}
.axa-plate .img .ph{color:var(--ink-faint);font-size:20px;opacity:.5}
.axa-plate .nm{font-family:var(--serif);font-size:12px;line-height:1.15}
.axa-verdictwrap{margin:44px 0 10px}
.axa-rule{display:block;width:40px;height:2.5px;background:var(--accent);margin-bottom:18px}
.axa-verdict{font-family:var(--serif);font-weight:600;font-size:clamp(32px,5.4vw,46px);line-height:1.02;letter-spacing:-.02em;margin:0 0 16px;text-wrap:balance}
.axa-standfirst{font-family:var(--serif);font-style:italic;font-size:clamp(16px,2.2vw,18px);line-height:1.45;color:var(--ink-muted);margin:0;text-wrap:pretty}
.axa-sig{margin:28px 0 6px;border-top:1px solid var(--hairline);padding-top:16px}
.axa-sig .cap{font-family:var(--grot);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-faint);margin:0 0 13px}
.axa-axis{display:grid;grid-template-columns:64px 1fr 64px;align-items:center;gap:10px;margin:8px 0}
.axa-axis span{font-family:var(--grot);font-size:10px;color:var(--ink-faint)}
.axa-axis .r{text-align:right}
.axa-axis .l.on,.axa-axis .r.on{color:var(--ink);font-weight:600}
.axa-track{position:relative;height:1.5px;background:var(--hairline)}
.axa-track i{position:absolute;top:50%;width:8px;height:8px;border-radius:50%;background:var(--accent);transform:translate(-50%,-50%);box-shadow:0 0 0 3px var(--ground)}
.axa-track i.neu{background:var(--ink-faint)}
.axa-section{margin-top:26px}
.axa-label{font-family:var(--grot);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-muted);margin:0 0 8px;display:flex;align-items:center;gap:8px}
.axa-label::before{content:"";width:14px;height:1.5px;background:var(--accent);display:inline-block}
.axa-p{font-size:17px;line-height:1.65;margin:0 0 13px;color:var(--ink)}
.axa-p:last-child{margin-bottom:0}
.axa-reco{font-family:var(--serif);font-size:19px;line-height:1.55;margin:0}
.axa-cost{font-size:14px;line-height:1.55;color:var(--ink-muted);font-style:italic;margin:8px 0 0}
.axa-divider{border:0;border-top:1px solid var(--hairline);max-width:100%;margin:30px 0 4px}
.axa-cond{background:var(--panel);border:1px solid var(--hairline);border-radius:2px;padding:14px 16px;margin-top:6px}
.axa-cond .axa-p{font-size:14.5px;margin:0}
.axa-evidence{margin-top:36px;border-top:1px solid var(--hairline);padding-top:14px;font-family:var(--serif);font-style:italic;font-size:13.5px;line-height:1.55;color:var(--ink-muted);text-wrap:pretty}
.axa-colophon{margin-top:16px;font-family:var(--grot);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint)}
.axa-origins{list-style:none;padding:0;margin:16px 0 0;display:flex;flex-direction:column;gap:8px}
.axa-origins li{font-size:12.5px;line-height:1.5;color:var(--ink-muted)}
.axa-origins li b{color:var(--ink);font-weight:600;font-family:var(--serif)}
.axa-sources{margin-top:12px;font-family:var(--grot);font-size:10px;color:var(--ink-faint);display:flex;flex-wrap:wrap;gap:5px 16px;align-items:baseline}
.axa-sources .k{text-transform:uppercase;letter-spacing:.16em}
.axa-sources a{color:var(--accent);text-decoration:none;border-bottom:1px solid color-mix(in oklab,var(--accent) 40%,transparent)}
/* Embedded assessments keep the 640px reading measure — the conversation
 * column is wider (~748px) and letting the artifact fill it pushed prose
 * to ~97 characters/line (readability pass, founder-approved 2026-08-13). */
.axa-embedded{max-width:640px;margin:0;padding-left:0;padding-right:0;background:transparent}
@media (max-width:560px){
  .axa-strip{grid-template-columns:repeat(2,1fr)}
  .axa-axis{grid-template-columns:50px 1fr 50px;gap:8px}
  .axa-axis span{font-size:9px}
  .axa-ident{flex-wrap:wrap;gap:4px 12px}
}
@media (max-width:360px){
  .axa-axis{grid-template-columns:46px 1fr 46px}
}
@media print{
  .axa-root{background:#fff;color:#000;max-width:100%}
  .axa-contradiction{display:none}
}
`;
