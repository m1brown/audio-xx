/**
 * Assessment follow-up continuity (launch continuity, 2026-07-19).
 *
 * When the first follow-up after a system assessment asks for upgrade
 * direction ("what would I upgrade first?", "weakest link?"), this
 * composer answers from the MemoFindings the assessment already
 * produced — a short, direct reply rather than a second full artifact,
 * and never a request to restate the system.
 *
 * Deliberately not a conversational memory system: the orchestrator
 * invokes it for exactly one turn, and every claim is sourced from the
 * findings contract — no new interpretation happens here.
 */
import type { MemoFindings } from './memo-findings';

/** "DAC" stays an initialism; other roles read as plain words. */
function roleForProse(role: string): string {
  const r = role.trim();
  return r.toUpperCase() === 'DAC' ? 'DAC' : r.toLowerCase();
}

/** Reject generic/placeholder role tags — they read as nonsense in prose. */
function usableRole(role?: string): string | null {
  if (!role) return null;
  const r = role.trim().toLowerCase();
  if (!r || r === 'other' || r === 'unknown' || r === 'component') return null;
  return role.trim();
}

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Compose a focused upgrade-direction answer from existing findings.
 * Returns null when the findings are too thin to answer honestly —
 * the caller falls back to the standard assessment path.
 */
/**
 * A follow-up answered FROM the standing review's own paragraphs.
 *
 * Nathan beta (2026-08-28): while a system review is on screen, questions
 * like "What would you change first?" fell to the knowledge lane, whose
 * generic essay ("many enthusiasts start with the speakers") both ignored
 * and contradicted the review directly above it. The licensed answer to a
 * direction question about an assessed system already exists — it is the
 * review. This selects the paragraphs that speak to the question's own
 * words plus the experiment paragraph, verbatim; it invents nothing, and
 * returns null only when the review holds nothing relevant.
 */
export function composeReviewAnchoredAnswer(
  question: string,
  review: string[],
): string | null {
  if (!review?.length) return null;
  const qTokens = question.toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4
      && !['what', 'would', 'should', 'could', 'think', 'much', 'really',
        'this', 'that', 'system', 'make', 'made', 'with', 'before',
        'change', 'first', 'better', 'difference', 'replace'].includes(w));
  const experiment = review.filter((p) =>
    /experiment worth running|most informative experiment|conversion stages|leave the/i.test(p));
  const relevant = review
    .map((p) => ({ p, hits: qTokens.filter((w) => p.toLowerCase().includes(w)).length }))
    .filter((x) => x.hits >= 1 && !experiment.includes(x.p))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map((x) => x.p);
  const body = [...relevant, ...experiment];
  if (body.length === 0) return null;
  return ['From the assessment above:', ...body].join('\n\n');
}

export function composeAssessmentFollowUp(
  findings: MemoFindings,
  /**
   * The standing review's own recommendation paragraphs, where the caller
   * holds them (sparse-evidence pass, 2026-08-27). A substitution question
   * about a system whose review already names its highest-information
   * experiment is answered FROM that experiment — not with "voiced as a
   * whole" prose the sparse evidence never licensed, and never with a
   * shopping intake.
   */
  reviewExperiment?: string[],
): string | null {
  if (!findings || findings.componentNames.length === 0) return null;
  const paths = findings.upgradePaths ?? [];
  const keeps = findings.keeps ?? [];
  const sequence = findings.recommendedSequence ?? [];

  if (paths.length === 0 && reviewExperiment && reviewExperiment.length > 0) {
    return [
      'The assessment already contains the first step of that answer, and it costs nothing.',
      ...reviewExperiment,
      'Nothing in the evidence held demonstrates a constraint there \u2014 the experiment '
      + 'is how you find out, and either outcome is worth having before any money moves.',
    ].join(' ');
  }

  // No upgrade paths — reference-tier or coherently voiced system.
  // The honest answer is the assessment's own verdict: stay put.
  if (paths.length === 0) {
    const parts: string[] = [];
    parts.push('Honestly — nothing. This is the rare case where the right first upgrade is no upgrade.');
    if (findings.isCoherent) {
      parts.push('The system is voiced as a whole: each piece was chosen to pull in the same direction, so swapping any one of them would change its character rather than raise its quality.');
    } else {
      parts.push('No single component is holding the others back, so money spent replacing one buys you a different system, not a better one.');
    }
    parts.push('If you do get restless, start with what you want to hear differently — that tells us which direction to move, and I can take it from there.');
    return parts.join(' ');
  }

  const top = paths[0];
  const bottleneck = findings.bottleneck;
  // Findings sometimes carry generic role tags; commit to a direction only
  // when a concrete role survives, otherwise let the caller fall back to
  // the standard assessment path rather than print a vague answer.
  const leadRole = usableRole(top.targetRole)
    ?? usableRole(bottleneck?.role)
    ?? usableRole(sequence[0]?.targetRole);
  if (!leadRole) return null;
  const parts: string[] = [];

  parts.push(`If you change one thing, make it the ${roleForProse(leadRole)}.`);
  if (bottleneck && bottleneck.role.toLowerCase() === leadRole.toLowerCase()) {
    parts.push(`Your ${bottleneck.component} is the component setting the ceiling here.`);
  }

  const options = (top.options ?? []).slice(0, 2);
  if (options.length > 0) {
    const optText = options
      .map((o) => `${o.brand} ${o.name}${o.priceRange ? ` (${o.priceRange})` : ''}`)
      .join(' or the ');
    parts.push(`Worth hearing first: the ${optText}.`);
  }

  const keepNames = keeps
    .map((k) => k.name)
    .filter((n) => n && n !== bottleneck?.component);
  if (keepNames.length > 0) {
    const plural = keepNames.length > 1;
    parts.push(`I'd leave the ${joinNatural(keepNames)} alone — ${plural ? "they're" : "it's"} doing exactly what ${plural ? 'they' : 'it'} should.`);
  }

  const nextRole = usableRole(sequence[1]?.targetRole);
  if (nextRole && nextRole.toLowerCase() !== leadRole.toLowerCase()) {
    parts.push(`After that, the next place to look is the ${roleForProse(nextRole)} — but one change at a time.`);
  }

  return parts.join(' ');
}
