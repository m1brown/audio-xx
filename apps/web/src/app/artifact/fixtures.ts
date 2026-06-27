/**
 * Audio XX — Assessment Artifact payload contract + Milestone-1 fixtures.
 *
 * The renderer is the static design system; these are the *generated* slots.
 * For M1 the two payloads are derived faithfully from the live engine's reads
 * of the two named systems (captured via buildSystemAssessment). The live
 * engine → payload adapter is the next milestone; see the M1 report for the
 * slots the engine does not yet emit cleanly (single-sentence verdict, the
 * recommendation line, the hero datum extraction).
 */

export type { ArtifactPayload } from '@/lib/artifact/types';
import type { ArtifactPayload } from '@/lib/artifact/types';

const flawed: ArtifactPayload = {
  verdict: "The amplifier can't drive these speakers.",
  standfirst: 'A warmth-first system asked to do something its two-watt amplifier cannot.',
  componentCredit: ['Holo May KTE', 'Decware SE84UFO', 'Magnepan LRS+'],
  recognition:
    'You’ve built a warmth-first system — a tone-rich R2R source into a single-ended triode amplifier into planar speakers, chosen for transparency and low-level resolution.',
  caseParagraphs: [
    'The Decware SE84UFO makes two watts. The Magnepan LRS+ is 86 dB sensitive, and its own maker asks for far more power than that. Together they reach roughly 89 dB of clean output — below comfortable listening levels for dynamic music.',
    'Below that ceiling the tone is genuinely lovely. Push past it and the system compresses: dynamics flatten, bass loses grip, and the amplifier leaves its comfort zone.',
    'Everything upstream is held back by it.',
  ],
  heroDatum: { value: '≈ 89 dB', caption: 'the most this pairing plays cleanly' },
  pullQuote: 'Below the surface warmth, the system is quietly running out of air.',
  recommendation: "I’d replace the amplifier first.",
  figure: {
    src: '/artifact/plate.svg',
    alt: 'A higher-current amplifier',
    caption: 'A higher-current amplifier — image placeholder (M1)',
  },
  cost:
    'You’ll give up a little of that SET midrange magic; if you only ever listen late and quiet, you can keep it — but you’re leaving the speakers’ best on the table.',
  date: '14 June 2026',
  edition: 'No. 001',
};

const balanced: ArtifactPayload = {
  verdict: 'A system that already knows what it is.',
  standfirst: 'A detail-forward front end into a forgiving speaker — and nothing here needs fixing.',
  componentCredit: ['Chord Qutest', 'Naim SuperNait 3', 'Harbeth Super HL5 Plus'],
  recognition:
    'You’ve built a detail-first system: a resolving DAC and a fast, transparent integrated, with the Harbeth supplying the warmth that keeps it from turning clinical.',
  caseParagraphs: [
    'Clarity, timing, and spatial precision lead; the Harbeth’s body is what keeps that precision musical rather than analytical. The three pull in the same considered direction.',
    'There is no weak link holding the others back — the speaker is doing exactly the compensating the front end needs.',
    'It is balanced.',
  ],
  // No hero datum: no hard objective limit.
  pullQuote: 'The Harbeth’s warmth is the whole reason this system stays musical.',
  recommendation: 'Leave it alone.',
  // No figure: the dignified blank where a product would go.
  cost: 'If you ever chase more, the one place to look is the speaker — but not today.',
  date: '14 June 2026',
  edition: 'No. 002',
};

export const FIXTURES: Record<'flawed' | 'balanced', ArtifactPayload> = { flawed, balanced };
