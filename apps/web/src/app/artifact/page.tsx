import AssessmentArtifact from './AssessmentArtifact';
import { FIXTURES } from './fixtures';

/**
 * M1 preview route. `?case=flawed` (default) or `?case=balanced`.
 * Renders the canonical artifact from a payload — no app shell, no chat.
 */
export default async function ArtifactPage(
  { searchParams }: { searchParams: Promise<{ case?: string }> },
) {
  const sp = await searchParams;
  const key = sp?.case === 'balanced' ? 'balanced' : 'flawed';
  return <AssessmentArtifact p={FIXTURES[key]} />;
}
