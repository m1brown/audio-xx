/**
 * Reviewer Profiles — Known reviewer listening biases.
 *
 * Used by the synthesis pipeline to calibrate evidence interpretation.
 * When a reviewer's listening bias is known, the synthesis prompt can
 * adjust axis positioning accordingly.
 *
 * Example: If Srajan (high speed bias) describes a DAC as "warm," that
 * observation carries more weight on the warm axis than the same claim
 * from a reviewer who gravitates toward warmth as a default preference.
 *
 * This is internal calibration data — never surfaced to users.
 */

import type { ReviewerProfile } from './types';

// ── Reviewer registry ────────────────────────────────

export const REVIEWER_PROFILES: ReviewerProfile[] = [
  {
    id: 'srajan-ebaen',
    name: 'Srajan Ebaen',
    publications: ['6moons'],
    url: 'https://6moons.com/',
    listeningBias: {
      openness: 'high',
      transientSpeed: 'high',
      tonalDensity: 'medium',
      warmth: 'medium',
      spatialProjection: 'high',
      microdetail: 'high',
      elasticity: 'high',
      damping: 'low',
    },
    calibrationNotes:
      'Srajan consistently values speed, openness, and spatial qualities. His reviewing language '
      + 'indexes heavily on transient behavior and microdynamic expression. When he describes '
      + 'something as "dense" or "warm," it likely registers higher on those axes than his language '
      + 'suggests — his baseline expectation is lean and fast. His "slow" may be another reviewer\'s '
      + '"natural." Particularly useful as an anchor for the speed/elasticity end of the axis model.',
  },
  {
    id: 'michael-lavorgna',
    name: 'Michael Lavorgna',
    publications: ['Twittering Machines', 'AudioStream (archived)'],
    url: 'https://twitteringmachines.com/',
    listeningBias: {
      openness: 'medium',
      transientSpeed: 'medium',
      tonalDensity: 'high',
      warmth: 'high',
      spatialProjection: 'medium',
      microdetail: 'medium',
      elasticity: 'high',
      damping: 'low',
    },
    calibrationNotes:
      'Lavorgna gravitates toward musical engagement, tonal richness, and rhythmic flow. His system '
      + 'choices (Leben tubes, DeVore speakers, totaldac R2R) reflect a preference for harmonic '
      + 'density and natural timbre over analytical precision. When he describes something as '
      + '"detailed," it likely means the component achieves resolution without sacrificing musicality — '
      + 'his baseline expectation is warm and involving. Particularly useful as an anchor for the '
      + 'tonal density / warmth / engagement end of the axis model.',
  },
];

// ── Lookup helpers ───────────────────────────────────

/**
 * Find a reviewer profile by ID.
 */
export function findReviewer(id: string): ReviewerProfile | undefined {
  return REVIEWER_PROFILES.find((r) => r.id === id);
}

/**
 * Find a reviewer profile by name (case-insensitive partial match).
 */
export function findReviewerByName(name: string): ReviewerProfile | undefined {
  const lower = name.toLowerCase();
  return REVIEWER_PROFILES.find((r) =>
    r.name.toLowerCase().includes(lower),
  );
}

/**
 * Find reviewer profiles associated with a publication.
 */
export function findReviewersByPublication(publication: string): ReviewerProfile[] {
  const lower = publication.toLowerCase();
  return REVIEWER_PROFILES.filter((r) =>
    r.publications.some((p) => p.toLowerCase().includes(lower)),
  );
}

/**
 * Build a calibration note for the synthesis prompt from reviewer profiles.
 *
 * When evidence sources include known reviewers, this function produces
 * a paragraph that the synthesis prompt can use to adjust interpretation.
 */
export function buildReviewerCalibrationNote(
  reviewerIds: string[],
): string | null {
  const profiles = reviewerIds
    .map((id) => findReviewer(id))
    .filter((r): r is ReviewerProfile => r !== undefined);

  if (profiles.length === 0) return null;

  const notes = profiles.map((r) => {
    const biasHighlights: string[] = [];
    const entries = Object.entries(r.listeningBias) as Array<[string, string]>;
    for (const [key, level] of entries) {
      if (level === 'high') {
        biasHighlights.push(key.replace(/([A-Z])/g, ' $1').toLowerCase().trim());
      }
    }
    return `${r.name} (${r.publications[0]}): known bias toward ${biasHighlights.join(', ')}. ${r.calibrationNotes}`;
  });

  return `## Reviewer Calibration\n\nThe following reviewer biases should be considered when interpreting evidence:\n\n${notes.join('\n\n')}`;
}
