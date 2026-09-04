import { cache } from 'react';
import type { Metadata } from 'next';
import AssessmentArtifact from './AssessmentArtifact';
import SnapshotArtifact from './SnapshotArtifact';
import { authoritativeAssessment } from '@/lib/assessment/from-result';
import { buildServerDossiers } from '@/lib/assessment/server-dossiers';
import ArtifactActions from './ArtifactActions';
import TrackFailure from './TrackFailure';
import { runArtifactPipeline } from '@/product/assessment-pipeline';

/**
 * @deprecated LEGACY generate-from-input route. NOT the artifact contract.
 *
 * `?system=` carries the ENGINE INPUT and re-runs `buildSystemAssessment` on
 * every open, so this route RE-ASSESSES rather than rendering an assessment.
 * On production that meant Nathan's uncatalogued system did not render at all,
 * and Leben/Cornwall rendered a different assessment from the conversation
 * (CS600X not CS600, detailed not balanced).
 *
 * The canonical artifact is `/artifact/[viewToken]` — a frozen snapshot,
 * render-only. Print, Share and View Assessment must never route here. Kept
 * only so existing links do not 404; do not build new product flows on it.
 *
 * Milestone 2 — live end-to-end artifact.
 *
 * `?system=<free text>` runs the real engine and synthesizes the artifact.
 * `?case=flawed|balanced` are convenience presets that hit the SAME engine +
 * synthesizer path (not static fixtures), so both test paths are genuinely
 * end-to-end.
 */
const PRESETS: Record<string, string> = {
  flawed: 'Assess my system: Holo May (KTE), Decware SE84UFO, Magnepan LRS+',
  balanced: 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus',
};

type ArtifactSearchParams = { system?: string; case?: string; print?: string; date?: string };

function resolveText(sp: ArtifactSearchParams): string {
  return (sp?.system && sp.system.trim())
    || PRESETS[sp?.case ?? '']
    || PRESETS.flawed;
}

// Deduped per request: generateMetadata and the page share one engine run.
const renderCached = cache((text: string) => runArtifactPipeline(text));

/**
 * Sharing metadata (M4). A pasted assessment link is the product's
 * acquisition loop — it must unfurl as the assessment itself: the
 * verdict as the title, the standfirst/recognition as the description.
 */
export async function generateMetadata(
  { searchParams }: { searchParams: Promise<ArtifactSearchParams> },
): Promise<Metadata> {
  const sp = await searchParams;
  const text = resolveText(sp);
  const rendered = renderCached(text);
  if (!rendered) return { title: 'System Assessment' };
  /*
   * A SHARED LINK UNFURLS THE AUTHORITATIVE VERDICT.
   *
   * This read `payload.verdict` and `payload.standfirst` — the trait/axis
   * lane — so a pasted link published "Nothing here needs changing" as its
   * title and an axis-derived tonal summary as its description, to everyone
   * who saw the preview. Sharing metadata is a user-visible authoring
   * surface, and it was the last one still on the old lane.
   */
  const p = rendered.payload;
  const licensed = authoritativeAssessment(rendered.raw);
  const title = (licensed?.verdict ?? p.verdict).replace(/\.\s*$/, '');
  // The description names the SYSTEM. The review's first paragraph is now the
  // verdict lead (answer-first, 2026-09-04), which names the primary
  // relationship but not every component — a link preview should tell the
  // reader whose system this is, so the chain leads and the verdict follows.
  const chain = (licensed?.components ?? []).map((c) => c.name).join(' · ');
  const description = (
    chain ? `${chain} — ${(licensed?.systemReview?.[0] ?? '')}` : (licensed?.systemReview?.[0] ?? '')
  ).slice(0, 200)
    || (p.componentCredit?.length ? p.componentCredit.join(' · ') : 'An Audio XX system assessment');
  return {
    title,
    description,
    openGraph: {
      title: `${title} — Audio XX System Assessment`,
      description,
      type: 'article',
      url: `/artifact?system=${encodeURIComponent(text)}`,
    },
  };
}

export default async function ArtifactPage(
  { searchParams }: { searchParams: Promise<ArtifactSearchParams> },
) {
  const sp = await searchParams;
  const text = resolveText(sp);
  const print = sp?.print === '1';

  const rendered = renderCached(text);

  if (!rendered) {
    // MVP M1 failure path: never a dead end — send the reader back to the
    // builder with an editorial notice rather than an error.
    return (
      <section className="axx-followup" aria-label="Notice">
        <TrackFailure />
        <p>
          I couldn&rsquo;t read that as a system — an assessment needs at least
          two named components (a source or amplifier, and speakers or
          headphones).
        </p>
        <p>
          <a href="/">Build your system →</a>
        </p>
      </section>
    );
  }

  const { payload, contradictions } = rendered;
  // Override date when requested so PDF export is deterministic across runs.
  if (sp?.date) { payload.date = sp.date; rendered.canonical.meta.date = sp.date; }
  if (contradictions.length) {
    // eslint-disable-next-line no-console
    console.warn('[artifact] engine-output contradictions:', contradictions);
  }

  /*
   * Even the deprecated route renders the AUTHORITATIVE assessment.
   *
   * It rendered the canonical (trait/axis) model directly, so a link into this
   * route published claims no evidence licensed — the same essay the
   * conversation used to show. A deprecated surface is still a user-visible
   * one, and leaving it on the old lane would leave two lanes authoring, which
   * is the thing being removed.
   */
  /*
   * YOUR SYSTEM belongs on this surface too.
   *
   * The route rendered SYSTEM REVIEW and EVIDENCE with nothing between them,
   * because dossiers were only ever built client-side. A shared or printed
   * assessment therefore carried no component evidence at all — on the surface
   * most likely to be read by someone other than the listener who generated it.
   */
  const chain = (rendered.raw as {
    findings?: { systemChain?: { names?: string[]; roles?: string[] } };
  } | null)?.findings?.systemChain;
  const dossiers = await buildServerDossiers(
    (chain?.names ?? []).map((name, i) => ({ name, role: chain?.roles?.[i] })),
  );

  const assessment = authoritativeAssessment(rendered.raw, {
    dossiers,
    createdAt: sp?.date ? new Date(sp.date).toISOString() : undefined,
  });

  return (
    <>
      {assessment
        ? <SnapshotArtifact snapshot={assessment} />
        : <AssessmentArtifact canonical={rendered.canonical} contradictions={contradictions} print={print} />}
      {!print && <ArtifactActions systemText={text} />}
    </>
  );
}
