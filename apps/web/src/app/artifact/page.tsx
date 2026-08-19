import { cache } from 'react';
import type { Metadata } from 'next';
import AssessmentArtifact from './AssessmentArtifact';
import ArtifactActions from './ArtifactActions';
import TrackFailure from './TrackFailure';
import { runArtifactPipeline } from '@/product/assessment-pipeline';
import { extractSubjectMatches } from '@/lib/intent';
import { factCandidateNames } from '@/lib/evidence/manufacturer-facts';
import { parseLabelledComponents } from '@/lib/labelled-components';
import { readFactsForNames } from '@/lib/evidence/manufacturer-fact-store';

/**
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

/**
 * Deduped per request: generateMetadata and the page share one engine run.
 *
 * The store read happens here, on the server, where `readFactsForNames` is
 * directly reachable — no route hop, and no acquisition: `readFacts` only ever
 * reads. Without this the artifact renders from strictly less evidence than
 * the web assessment of the same system.
 */
const renderCached = cache(async (text: string) => {
  const facts = await readFactsForNames(
    factCandidateNames(extractSubjectMatches(text), parseLabelledComponents(text)),
  );
  return runArtifactPipeline(text, facts);
});

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
  const rendered = await renderCached(text);
  if (!rendered) return { title: 'System Assessment' };
  const p = rendered.payload;
  const title = p.verdict.replace(/\.\s*$/, '');
  const description = (p.standfirst || p.recognition || '').slice(0, 200)
    + (p.componentCredit?.length ? ` — ${p.componentCredit.join(' · ')}` : '');
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

  const rendered = await renderCached(text);

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

  return (
    <>
      <AssessmentArtifact canonical={rendered.canonical} contradictions={contradictions} print={print} />
      {!print && <ArtifactActions systemText={text} />}
    </>
  );
}
