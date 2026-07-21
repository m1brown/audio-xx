import AssessmentArtifact from './AssessmentArtifact';
import ArtifactActions from './ArtifactActions';
import { runArtifactPipeline } from '@/product/assessment-pipeline';

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

export default async function ArtifactPage(
  { searchParams }: { searchParams: Promise<{ system?: string; case?: string; print?: string; date?: string }> },
) {
  const sp = await searchParams;
  const text = (sp?.system && sp.system.trim())
    || PRESETS[sp?.case ?? '']
    || PRESETS.flawed;
  const print = sp?.print === '1';

  const rendered = runArtifactPipeline(text);

  if (!rendered) {
    // MVP M1 failure path: never a dead end — send the reader back to the
    // builder with an editorial notice rather than an error.
    return (
      <section className="axx-followup" aria-label="Notice">
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
  if (sp?.date) payload.date = sp.date;
  if (contradictions.length) {
    // eslint-disable-next-line no-console
    console.warn('[artifact] engine-output contradictions:', contradictions);
  }

  return (
    <>
      <AssessmentArtifact p={payload} contradictions={contradictions} print={print} />
      {!print && <ArtifactActions systemText={text} />}
    </>
  );
}
