/**
 * What Audio XX actually knew, said plainly.
 *
 * The EXPANDED REASONING badge told a listener that something was different
 * about this answer without telling them what — which is the least useful
 * form of a trust signal: it asks for suspicion and supplies no basis for it.
 * This derives the disclosure behind the badge from the SAME provenance state
 * that raises it, so the label and the explanation can never describe
 * different assessments.
 *
 * The disclosure explains an EPISTEMIC CONDITION. "AI was used" is not that:
 * it names a mechanism the listener cannot act on. What they can act on is
 * which of their components Audio XX could verify, which it reasoned about
 * from broader knowledge, and what that difference licenses.
 *
 * Pure and presentation-free on purpose — the same text has to survive into a
 * printed assessment, where there is nothing to click. See PRINT DEGRADATION
 * at the foot of this file.
 */

export type ProvenanceBasis = 'catalog' | 'brand' | 'model' | 'user';

export interface ProvenanceInput {
  reasoningMode?: string;
  fallbackReason?: string;
  componentProvenance?: Array<{ name: string; basis: ProvenanceBasis }>;
}

export interface ProvenanceDisclosure {
  /** Whether the badge — and therefore the disclosure — appears at all. */
  show: boolean;
  /** The one-line caption beside the badge. */
  caption: string;
  /** Heading for the expanded panel. */
  heading: string;
  /** Body paragraphs, in reading order. Never empty when `show` is true. */
  paragraphs: string[];
}

/** Caption per fallback reason. Unchanged wording — this is the existing label. */
const CAPTIONS: Record<string, string> = {
  unknown_subject:
    'Using expanded reasoning for products outside the current curated catalog.',
  low_confidence_system:
    'Using expanded reasoning because parts of this system sit outside Audio XX’s curated catalog.',
  brand_only:
    'Using expanded reasoning for a product not yet covered directly in the curated catalog.',
  open_ended_query:
    'Using expanded reasoning for a broader advisory question.',
  thin_output:
    'Using expanded reasoning because the curated layer did not produce a complete answer.',
};

const DEFAULT_CAPTION =
  'Using expanded reasoning because parts of this answer sit outside Audio XX’s curated catalog.';

function nameList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Compose the disclosure from the provenance the assessment actually carried.
 *
 * Each basis gets its own paragraph, strongest first, and each says what the
 * basis DOES and DOES NOT license. The brand paragraph is the one most worth
 * having: evidence about a maker is real evidence, and it does not establish a
 * characteristic of one particular model — a distinction a reader cannot make
 * unless we make it for them.
 */
export function describeProvenance(a: ProvenanceInput): ProvenanceDisclosure {
  const show = a.reasoningMode === 'expanded';
  const caption = (a.fallbackReason && CAPTIONS[a.fallbackReason]) || DEFAULT_CAPTION;
  if (!show) return { show: false, caption, heading: '', paragraphs: [] };

  const byBasis = new Map<ProvenanceBasis, string[]>();
  for (const c of a.componentProvenance ?? []) {
    if (!c?.name || !c?.basis) continue;
    byBasis.set(c.basis, [...(byBasis.get(c.basis) ?? []), c.name]);
  }

  const paragraphs: string[] = [];

  const catalog = byBasis.get('catalog');
  if (catalog?.length) {
    paragraphs.push(
      `${nameList(catalog)} ${catalog.length === 1 ? 'is' : 'are'} in Audio XX’s `
      + `curated catalogue. What is said about ${catalog.length === 1 ? 'it' : 'them'} `
      + `comes from that curated entry.`,
    );
  }

  const model = byBasis.get('model');
  if (model?.length) {
    paragraphs.push(
      `${nameList(model)} ${model.length === 1 ? 'sits' : 'sit'} outside Audio XX’s `
      + `curated catalogue. Audio XX verified ${model.length === 1 ? 'its identity' : 'their identities'} `
      + `and used broader model knowledge to reason about `
      + `${model.length === 1 ? 'it' : 'them'}. Product-specific characteristics that could `
      + `not be independently established are treated with lower confidence.`,
    );
  }

  const brand = byBasis.get('brand');
  if (brand?.length) {
    paragraphs.push(
      `For ${nameList(brand)}, Audio XX holds documented evidence about the maker rather `
      + `than about this particular model. A maker’s design philosophy is real evidence, `
      + `and it does not by itself establish a characteristic of one product in `
      + `${brand.length === 1 ? 'their' : 'their'} range.`,
    );
  }

  const user = byBasis.get('user');
  if (user?.length) {
    paragraphs.push(
      `${nameList(user)} ${user.length === 1 ? 'is' : 'are'} here on your description alone — `
      + `Audio XX could not identify ${user.length === 1 ? 'it' : 'them'}. `
      + `${user.length === 1 ? 'Its' : 'Their'} place in the chain is taken as you gave it, `
      + `and no characteristic is claimed for ${user.length === 1 ? 'it' : 'them'}.`,
    );
  }

  // No per-component provenance travelled with this response. Say the general
  // condition rather than nothing — the badge is showing either way, and a
  // badge with no explanation is the problem this exists to fix.
  if (paragraphs.length === 0) {
    paragraphs.push(
      'Part of this answer sits outside Audio XX’s curated catalogue. Audio XX used '
      + 'broader model knowledge to reason about it, and characteristics that could not '
      + 'be independently established are treated with lower confidence.',
    );
  }

  return { show: true, caption, heading: 'What this is based on', paragraphs };
}

/**
 * PRINT DEGRADATION — recorded, not built.
 *
 * A printed or PDF assessment has nothing to click, so the disclosure cannot
 * be the panel behind a badge there. The same `paragraphs` render as a short
 * static block in the artifact's evidence footer, under the one-line evidence
 * statement, set at the artifact's small size. No summary/details element, no
 * "expand", no link — the text is simply present.
 *
 * The web and print forms must read from THIS function, not from parallel
 * copy, or the printed assessment will eventually claim a different basis
 * from the one on screen. That is the failure mode the derived evidence
 * statement already had once.
 */
