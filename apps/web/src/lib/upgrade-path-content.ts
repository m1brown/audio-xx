/**
 * Audio XX — Shared upgrade-path direction content.
 *
 * Single source of truth for the three direction exemplars (Safe,
 * Alternative, Stretch). Consumed by:
 *   1. /path/upgrade/[flavor] — full-page direction view
 *   2. AdvisoryMessage post-response follow-up chips — in-chat panels
 *
 * Keeping the data here avoids drift between the page and the chip
 * follow-ups, and lets both consumers render with the same
 * AdvisoryProductCards component.
 *
 * Selection is deliberately static and hand-curated — these are
 * direction exemplars, not personalised picks against the user's
 * current chain. Per Playbook §8 (engine vs domain boundary), this
 * file is an adapter-layer domain artifact; direct product references
 * are appropriate here.
 */
import type { AdvisoryOption } from './advisory-response';

export type DirectionKey = 'safe' | 'alternative' | 'stretch';

export interface DirectionContent {
  title: string;
  blurb: string;
  options: AdvisoryOption[];
}

export const DIRECTION_CONTENT: Record<DirectionKey, DirectionContent> = {
  safe: {
    title: 'Safe upgrade path',
    blurb:
      'Refinement within the same design philosophy. Keeps the current topology and tonal balance — raises resolution, grip, and composure one step without changing the character of the system. Low-risk moves for listeners who mostly like what they have.',
    options: [
      {
        name: 'Qutest',
        brand: 'Chord',
        price: 1295,
        productType: 'Standalone DAC',
        fitNote:
          'Refines the FPGA timing-first source direction without changing topology — more clarity and composure, same signature.',
        availability: 'current',
      },
      {
        name: 'Bifrost 2/64',
        brand: 'Schiit',
        price: 699,
        productType: 'Standalone DAC',
        fitNote:
          'Confident R2R refinement at mid-fi. Steps up resolution and low-level detail while keeping the presentation tonally even.',
        availability: 'current',
      },
      {
        name: 'R3',
        brand: 'KEF',
        price: 2200,
        productType: 'Standmount Speaker',
        fitNote:
          'Refined modern coaxial standmount. Coherent imaging and tonal neutrality without exotic engineering risk.',
        availability: 'current',
      },
      {
        name: 'H190',
        brand: 'Hegel',
        price: 4000,
        productType: 'Integrated Amplifier',
        fitNote:
          'Quiet, neutral Norwegian integrated. Raises grip and resolution without altering the tonal balance of the chain.',
        availability: 'current',
      },
    ],
  },

  alternative: {
    title: 'Alternative path',
    blurb:
      'A different architectural philosophy, not a tier-up. Tubes, single-ended triodes, and R2R conversion trade measurement precision for harmonic density, tonal weight, and a different relationship to transient shape. Choose this when what you hear is correct but the music feels too polite.',
    options: [
      {
        name: 'SE84UFO',
        brand: 'Decware',
        price: 3200,
        productType: 'SET Integrated Amplifier',
        fitNote:
          'Single-ended triode — trades power for tonal density, low-level detail, and harmonic bloom. Requires efficient speakers.',
        availability: 'current',
      },
      {
        name: 'CS600X',
        brand: 'Leben',
        price: 6200,
        productType: 'Tube Integrated Amplifier',
        fitNote:
          'Japanese tube integrated in the classic vein. Midrange weight and texture over transient attack; warm without being slow.',
        availability: 'current',
      },
      {
        name: 'Pontus II 12th-1',
        brand: 'Denafrips',
        price: 1499,
        productType: 'R2R DAC',
        fitNote:
          'Discrete R2R conversion at an approachable tier. Harmonic density and natural transient shape rather than surgical precision.',
        availability: 'current',
      },
      {
        name: 'Baltic 5',
        brand: 'Lampizator',
        price: 7000,
        productType: 'Tube DAC',
        fitNote:
          'Tube-output NOS R2R — the fully organic source direction, as far from FPGA precision as the catalog goes.',
        availability: 'current',
      },
    ],
  },

  stretch: {
    title: 'Stretch upgrade path',
    blurb:
      'Structural moves: more power, more headroom, separates over integrateds, statement-tier engineering. Keep these on the table when the current chain is clearly capable but runs out of grip, scale, or composure at real-world listening levels.',
    options: [
      {
        name: 'Hugo TT2',
        brand: 'Chord',
        price: 5495,
        productType: 'DAC / Preamp',
        fitNote:
          'Desktop reference FPGA — the same timing signature as Qutest with meaningfully more composure, tonal density, and headroom.',
        availability: 'current',
      },
      {
        name: 'SuperNait 3',
        brand: 'Naim',
        price: 4500,
        productType: 'Integrated Amplifier',
        fitNote:
          'More current, more grip, more confident bass. The next step in amplification authority within the Naim family.',
        availability: 'current',
      },
      {
        name: 'A3',
        brand: 'Magico',
        price: 12500,
        productType: 'Floorstanding Speaker',
        fitNote:
          'Rigid aluminum enclosure, very low coloration. Structural speaker step-up — resolves and scales in ways most wooden cabinets cannot.',
        availability: 'current',
      },
      {
        name: '866',
        brand: 'Boulder',
        price: 15000,
        productType: 'Integrated Amplifier',
        fitNote:
          'Flagship integrated engineering. Extraordinary headroom and control — statement-tier build in one box instead of separates.',
        availability: 'current',
      },
    ],
  },
};
