/**
 * Curated independent-review evidence for the reference systems.
 *
 * Acquisition is demand-driven and cached rather than synchronous: no
 * assessment fetches the web while a listener waits. These rows are the result
 * of that acquisition, written down.
 *
 * EVERY ROW GOES THROUGH `admitReviewObservation`. This file is a list of
 * candidates, not a list of admitted facts, and `seedObservations()` returns
 * only what the gate passes. That matters more than it looks: it means a
 * publication leaving the whitelist, or a variant rule tightening, silently
 * removes evidence from here too, with no migration and no second policy.
 *
 * WHAT ACQUISITION FOUND, AND DID NOT.
 *
 * Two of the four components in the Nathan reference system are well covered
 * by approved publications. Two are not, and the shape of the shortfall is
 * itself a finding:
 *
 *   Acora QRC-2 — no full review in an approved publication. What exists is a
 *   show report and a comparison made inside a review of a different model.
 *   Both are real evidence and both are heavily conditioned. Acora's SRC-1,
 *   SRC-2, MRC-2 and VRC are reviewed properly; none of them is the QRC-2.
 *
 *   Butler Monad A100 — nothing admissible at all. The substantial review is
 *   at 6moons, which is excluded; the remainder is a non-approved site, dealer
 *   listings, forum threads and the maker's own copy. The claim that the A100
 *   delivers 300B character at many times normal 300B power is BK Butler's,
 *   and no approved independent listener has been found to have tested it.
 *   That absence is why the Nathan review says what it says about the
 *   amplifier, and it must not be papered over from topology: the A100 is a
 *   hybrid in which a 300B drives a solid-state output stage, so even the
 *   usual inferences from "300B" do not apply.
 */

import { admitReviewObservation } from './independent-review';
import type { ReviewObservation } from './independent-review';

/**
 * How a listener's words map to a stored product key.
 *
 * Needed because none of these products is in the catalog, so there is no
 * canonical identity to resolve against, and a listener writes "ARC ref 5"
 * where the evidence is filed under "audio research reference 5". Token
 * containment alone cannot bridge that — the two share only "5".
 *
 * `excludes` is the important half and is not optional. Containment is
 * generous in one direction that matters: the tokens of "audio research
 * reference 5" are all present in "Audio Research Reference 5 SE", so without
 * an explicit block the SE — a different product with doubled power-supply
 * capacitance and Teflon coupling capacitors, reviewed separately — would
 * inherit the Reference 5's evidence. That is precisely the substitution the
 * admission contract refuses at the front door, and it must not reappear here
 * at the back.
 */
export interface ProductIdentity {
  productKey: string;
  canonical: string;
  /** Listener shorthands a human has confirmed mean this exact unit. */
  aliases: string[];
  /** Names that must never resolve here, however similar they look. */
  excludes: string[];
}

export const PRODUCT_IDENTITIES: ProductIdentity[] = [
  {
    productKey: 'dcs rossini apex',
    canonical: 'dCS Rossini Apex',
    aliases: ['dcs rossini apex dac', 'rossini apex'],
    // The non-Apex Rossini is the product every comparison is made AGAINST.
    excludes: ['dcs rossini', 'rossini', 'dcs rossini dac', 'dcs vivaldi apex'],
  },
  {
    productKey: 'audio research reference 5',
    canonical: 'Audio Research Reference 5',
    aliases: ['arc ref 5', 'arc reference 5', 'audio research ref 5', 'arc ref5'],
    excludes: [
      'audio research reference 5 se', 'arc ref 5 se', 'arc reference 5 se',
      'audio research reference 3', 'arc ref 3', 'audio research reference 6',
    ],
  },
  {
    /*
     * FOUNDER DECISION 2026-08-26. One identity decision, governing both the
     * governed photograph and the admitted review evidence — the same question
     * was gating both, and answering it twice invites the two to diverge.
     * Condition: the A100 is the SOLE Monad on the maker's site, and the
     * maker's own manual says "most applications will use at least a pair of
     * MONAD amplifiers". Not generalised to any other plural or abbreviation.
     */
    productKey: 'butler monad a100',
    canonical: 'Butler MONAD A100',
    aliases: ['butler monads', 'butler monad', 'monad a100', 'butler a100'],
    excludes: ['butler tdb', 'butler 2250', 'butler monad a200'],
  },
  {
    productKey: 'acora qrc-2',
    canonical: 'Acora Acoustics QRC-2',
    aliases: ['acora qrc2', 'acora acoustics qrc-2', 'qrc-2'],
    excludes: ['acora qrc-1', 'acora src-1', 'acora src-2', 'acora mrc-2', 'acora vrc'],
  },
];

/** A candidate row, before the gate sees it. */
type Candidate = Omit<ReviewObservation, 'retrievedAt'> & { retrievedAt?: number };

/**
 * When these rows were read from the publications.
 *
 * Fixed rather than `Date.now()` so that a build is reproducible and a
 * revalidation sweep has a real date to compare against.
 */
const ACQUIRED_AT = Date.parse('2026-08-25T00:00:00Z');

const CANDIDATES: Candidate[] = [
  // ---------------------------------------------------------------- dCS ----
  // Stereophile's review is a sustained A/B against the non-Apex Rossini the
  // listener's unit replaced. Almost everything in it is therefore comparative,
  // and stays that way.
  {
    productKey: 'dcs rossini apex',
    productName: 'dCS Rossini Apex',
    publication: 'Stereophile',
    sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-page-2',
    observationType: 'comparison',
    claim: 'Rendered instrumental texture, nuance, the silence between notes and bass '
      + 'response significantly better than the earlier Rossini DAC.',
    axis: 'smooth_detailed', direction: 'detailed',
  },
  {
    productKey: 'dcs rossini apex',
    productName: 'dCS Rossini Apex',
    publication: 'Stereophile',
    sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-page-2',
    observationType: 'comparison',
    claim: 'Rendered trumpet and double bass fuller and richer than the earlier Rossini DAC.',
    axis: 'warm_bright', direction: 'warm',
  },
  {
    productKey: 'dcs rossini apex',
    productName: 'dCS Rossini Apex',
    publication: 'Stereophile',
    sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-page-2',
    observationType: 'comparison',
    claim: 'Gave all instruments fuller and rounder tone and a more substantial bass '
      + 'foundation than the earlier Rossini DAC.',
    axis: 'warm_bright', direction: 'warm',
  },
  {
    // The founder's own example of a condition that must not be dropped.
    productKey: 'dcs rossini apex',
    productName: 'dCS Rossini Apex',
    publication: 'Stereophile',
    sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-page-2',
    observationType: 'comparison',
    claim: 'Rendered colours more saturated, highs smoother and less aggressive and the '
      + 'bass foundation firmer through its Ethernet input than through USB.',
    condition: {
      kind: 'mode',
      description: 'comparing the Ethernet input against the USB input on the same unit',
    },
  },
  {
    productKey: 'dcs rossini apex',
    productName: 'dCS Rossini Apex',
    publication: 'Stereophile',
    sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-page-2',
    observationType: 'comparison',
    claim: 'Sounded more colourful than the EMM Labs DV2, with tighter deep bass, a more '
      + 'open soundstage and a lower apparent noisefloor.',
    condition: {
      kind: 'level',
      description: 'with output levels matched to within 0.03V using a multimeter',
    },
  },
  {
    // The one genuinely unconditioned listening note in the review.
    productKey: 'dcs rossini apex',
    productName: 'dCS Rossini Apex',
    publication: 'Stereophile',
    sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-page-2',
    observationType: 'listening',
    claim: 'Presented music in a way the reviewer described as natural and unforced.',
    axis: 'smooth_detailed', direction: 'smooth',
  },
  {
    productKey: 'dcs rossini apex',
    productName: 'dCS Rossini Apex',
    publication: 'Stereophile',
    sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-measurements',
    observationType: 'measurement',
    claim: 'Measured distortion low enough to challenge the resolution of the test '
      + 'equipment; measured performance described as beyond reproach.',
  },

  // ---------------------------------------------------- Audio Research ----
  // Jonathan Valin, TAS 205. The break-in condition is the reason this review
  // is quoted in the admission contract's own header.
  {
    productKey: 'audio research reference 5',
    productName: 'Audio Research Reference 5',
    publication: 'The Absolute Sound',
    reviewer: 'Jonathan Valin',
    sourceUrl: 'https://www.theabsolutesound.com/articles/'
      + 'audio-research-corporation-reference-5-linestage-preamp-tas-205/',
    publishedAt: '2010-08-18',
    observationType: 'listening',
    claim: 'Sounded darker in balance and relatively airless and bloomless for an ARC unit '
      + 'when new, the darkness giving way to light, air and bloom once run in.',
    condition: {
      kind: 'break_in',
      description: 'after several hundred hours of play; the reviewer noted it took longer '
        + 'than other ARC units he had used',
    },
  },
  {
    productKey: 'audio research reference 5',
    productName: 'Audio Research Reference 5',
    publication: 'The Absolute Sound',
    reviewer: 'Jonathan Valin',
    sourceUrl: 'https://www.theabsolutesound.com/articles/'
      + 'audio-research-corporation-reference-5-linestage-preamp-tas-205/',
    publishedAt: '2010-08-18',
    observationType: 'comparison',
    claim: 'Higher in resolution, lower in tube-like coloration and better defined in '
      + 'imaging than the Reference 3 it replaces, with better extension and grip at both '
      + 'frequency extremes.',
    axis: 'smooth_detailed', direction: 'detailed',
  },
  {
    productKey: 'audio research reference 5',
    productName: 'Audio Research Reference 5',
    publication: 'The Absolute Sound',
    reviewer: 'Jonathan Valin',
    sourceUrl: 'https://www.theabsolutesound.com/articles/'
      + 'audio-research-corporation-reference-5-linestage-preamp-tas-205/',
    publishedAt: '2010-08-18',
    observationType: 'listening',
    claim: 'Brought neutrality, resolution, definition, dimensionality and bloom to the '
      + 'bottom and top octaves as well as to the midrange.',
    axis: 'airy_closed', direction: 'airy',
  },
  {
    productKey: 'audio research reference 5',
    productName: 'Audio Research Reference 5',
    publication: 'The Absolute Sound',
    reviewer: 'Jonathan Valin',
    sourceUrl: 'https://www.theabsolutesound.com/articles/'
      + 'audio-research-corporation-reference-5-linestage-preamp-tas-205/',
    publishedAt: '2010-08-18',
    observationType: 'listening',
    claim: 'Supplied three-dimensional body and bloom, and fine resolution of low-level '
      + 'harmonic detail, particularly on solo instruments and small ensembles.',
    axis: 'airy_closed', direction: 'airy',
  },
  {
    // The observation that most complicates a "warm valve preamplifier" reading.
    productKey: 'audio research reference 5',
    productName: 'Audio Research Reference 5',
    publication: 'The Absolute Sound',
    reviewer: 'Jonathan Valin',
    sourceUrl: 'https://www.theabsolutesound.com/articles/'
      + 'audio-research-corporation-reference-5-linestage-preamp-tas-205/',
    publishedAt: '2010-08-18',
    observationType: 'listening',
    claim: 'Balanced without the sweetness, darkness or syrupiness some listeners expect '
      + 'from tube equipment, in a presentation the reviewer characterised as neutral '
      + 'rather than coloured.',
    axis: 'warm_bright', direction: 'neutral',
  },
  {
    productKey: 'audio research reference 5',
    productName: 'Audio Research Reference 5',
    publication: 'The Absolute Sound',
    reviewer: 'Jonathan Valin',
    sourceUrl: 'https://www.theabsolutesound.com/articles/'
      + 'audio-research-corporation-reference-5-linestage-preamp-tas-205/',
    publishedAt: '2010-08-18',
    observationType: 'comparison',
    claim: 'Did not equal the best solid-state preamplifiers in transient speed or '
      + 'bottom-end grip, though it came closer than previous ARC linestages.',
  },
  {
    productKey: 'audio research reference 5',
    productName: 'Audio Research Reference 5',
    publication: 'The Absolute Sound',
    reviewer: 'Jonathan Valin',
    sourceUrl: 'https://www.theabsolutesound.com/articles/'
      + 'audio-research-corporation-reference-5-linestage-preamp-tas-205/',
    publishedAt: '2010-08-18',
    observationType: 'listening',
    claim: 'Imaged slightly more forward than certain other tube and solid-state '
      + 'preamplifiers, which the reviewer heard as lifelike presence.',
    axis: 'airy_closed', direction: 'airy',
  },

  // ------------------------------------------------------------- Acora ----
  // A show report and a passing comparison. Both admitted, both conditioned,
  // and between them they do not amount to a review.
  {
    productKey: 'acora qrc-2',
    productName: 'Acora Acoustics QRC-2',
    publication: 'Stereophile',
    reviewer: 'Robert Schryer',
    sourceUrl: 'https://www.stereophile.com/content/'
      + 'acora-acousticsaudio-researchhegelcardastransrotor',
    publishedAt: '2022-10-24',
    observationType: 'listening',
    claim: 'Sounded warm, reverberant and saturated, with vocals full of breath and '
      + 'saxophone and piano vividly present.',
    condition: {
      kind: 'associated_equipment',
      description: 'heard at Toronto Audiofest 2022 in an unfamiliar room, driven by Hegel '
        + 'P30A and H30A solid-state electronics from a Transrotor turntable front end, on '
        + 'older jazz and vocal material',
    },
    axis: 'warm_bright', direction: 'warm',
  },
  {
    productKey: 'acora qrc-2',
    productName: 'Acora Acoustics QRC-2',
    publication: 'SoundStage!',
    reviewer: 'Phil Gold',
    sourceUrl: 'https://www.soundstageultra.com/index.php/'
      + 'equipment-menu/1284-acora-acoustics-mrc-2-loudspeaker',
    publishedAt: '2025-09-15',
    observationType: 'comparison',
    claim: 'Delivered a more relaxed presentation and better image focus than the Acora '
      + 'MRC-2 on high-quality recordings.',
    condition: {
      kind: 'setup',
      description: 'a comparison made in passing during a review of the MRC-2, not a '
        + 'review of the QRC-2',
    },
  },

  // ------------------------------------------------------------ Butler ----
  /*
   * REVISED 2026-08-25. This section used to be empty, and the header used to
   * cite The Audio Beatnik as a non-approved site. That was a statement about
   * Audio XX's publication list rather than about the world: the Beatnik has a
   * named editor, publishes long-form listening notes and states its
   * associated equipment throughout, so it was evaluated and added rather than
   * left out by inertia. 6moons remains excluded and its coverage stays unused.
   *
   * The tube dependency is the condition that matters here and it is unusual
   * enough to be worth naming: the A100's 300B is user-replaceable, and the
   * reviewer reports materially different balance with different tubes. A
   * claim about this amplifier's tonal balance is therefore a claim about this
   * amplifier WITH A STATED TUBE, and cannot travel without it.
   */
  {
    productKey: 'butler monad a100',
    productName: 'Butler MONAD A100',
    publication: 'The Audio Beatnik',
    reviewer: 'Jack Roberts',
    sourceUrl: 'https://theaudiobeatnik.com/review-part-2-monad-a100-monoblocks/',
    publishedAt: '2020-03-08',
    observationType: 'listening',
    claim: 'Reproduced a dynamic range extending from very quiet detail to a life-sized '
      + 'piano that filled the room.',
    condition: {
      kind: 'associated_equipment',
      description: 'heard driving Quad ESL 57 electrostatics and DeVore Gibbon Super Nines, '
        + 'from an LTA microZOTL MZ3 preamplifier',
    },
  },
  {
    productKey: 'butler monad a100',
    productName: 'Butler MONAD A100',
    publication: 'The Audio Beatnik',
    reviewer: 'Jack Roberts',
    sourceUrl: 'https://theaudiobeatnik.com/review-part-2-monad-a100-monoblocks/',
    publishedAt: '2020-03-08',
    observationType: 'listening',
    claim: 'Rendered harmonics audibly, particularly on piano, in a presentation the '
      + 'reviewer described as organic and involving.',
    condition: {
      kind: 'associated_equipment',
      description: 'heard driving Quad ESL 57 electrostatics from an LTA microZOTL MZ3 '
        + 'preamplifier, with an AMG V12 turntable and BorderPatrol DAC as sources',
    },
    axis: 'warm_bright', direction: 'warm',
  },
  {
    /*
     * RELATIONAL, and the most useful row in this file.
     *
     * A statement about how the A100 behaved WITH a particular preamplifier —
     * the kind of observation separate reviews of two boxes can never produce,
     * and the reason the relational layer otherwise has to keep saying nobody
     * heard these together. It is still scoped hard: one reviewer, one tube
     * choice, one preamplifier that is not the listener's.
     */
    productKey: 'butler monad a100',
    productName: 'Butler MONAD A100',
    publication: 'The Audio Beatnik',
    reviewer: 'Jack Roberts',
    sourceUrl: 'https://theaudiobeatnik.com/review-part-1-butler-a100-monoblocks-a-little-history-and-design/',
    publishedAt: '2020-03-08',
    observationType: 'listening',
    claim: 'Presented a slightly darker tonal balance that the reviewer found complemented '
      + 'a preamplifier of slightly lighter balance.',
    condition: {
      kind: 'mode',
      description: 'fitted with Takatsuki TA-300B tubes, driving an LTA microZOTL MZ3 '
        + 'preamplifier; the reviewer reports a different, more forward balance with '
        + 'PSVANE tubes in the same amplifier',
    },
    axis: 'warm_bright', direction: 'warm',
  },
];

/** The reason a candidate did not make it in, for the acquisition report. */
export interface SeedRejection {
  productName: string;
  publication: string;
  reason: string;
  detail?: string;
}

let cached: { admitted: ReviewObservation[]; rejected: SeedRejection[] } | null = null;

/**
 * The curated rows that survive admission.
 *
 * Memoised because the gate is pure and the input is a literal, but never
 * exported as a mutable array: a caller that could push into this would be
 * writing evidence without admission, which is the one thing the whole module
 * exists to prevent.
 */
export function seedObservations(): {
  admitted: ReviewObservation[]; rejected: SeedRejection[];
} {
  if (cached) return { admitted: [...cached.admitted], rejected: [...cached.rejected] };

  const admitted: ReviewObservation[] = [];
  const rejected: SeedRejection[] = [];

  for (const candidate of CANDIDATES) {
    const observation: ReviewObservation = {
      ...candidate,
      retrievedAt: candidate.retrievedAt ?? ACQUIRED_AT,
    };
    // The publication named the product, so brand establishment is not at
    // issue for any of these; passing `true` states that explicitly rather
    // than letting the fail-closed default hide a real check.
    const verdict = admitReviewObservation(observation.productName, observation, true);
    if (verdict.admitted) admitted.push(observation);
    else {
      rejected.push({
        productName: observation.productName,
        publication: observation.publication,
        reason: verdict.reason,
        detail: verdict.detail,
      });
    }
  }

  cached = { admitted, rejected };
  return { admitted: [...admitted], rejected: [...rejected] };
}

/** Admitted rows for one product key. */
export function seedObservationsFor(productKey: string): ReviewObservation[] {
  return seedObservations().admitted.filter((o) => o.productKey === productKey);
}
