/**
 * Audio XX — Technology Profiles data layer.
 *
 * Sibling to BRAND_PROFILES in consultation.ts. Where BrandProfile carries
 * the editorial argument a manufacturer makes, TechnologyProfile carries
 * the editorial argument a topology / approach / school-of-design makes —
 * SET (Single-Ended Triode), NOS DACs, R2R DACs, Step-Up Transformers,
 * Class A Amplification, High-Efficiency Loudspeakers, etc.
 *
 * The shape is deliberately scoped to what a Technology Page actually
 * renders, and mirrors BrandProfile field-for-field where editorial intent
 * overlaps. Brand-specific fields (founder / country / brandScale /
 * categories / designFamilies) are intentionally absent — a technology
 * has no founder country and no product lineages.
 *
 * Schema membership comment on the EditorialEntity / shared-base question:
 *   The shared base interface is DEFERRED until a second Technology Page
 *   ships (NOS DACs is the natural second). With two technology pages in
 *   code, the shared fields between BrandProfile and TechnologyProfile
 *   become observable and the unification can be made cleanly. Doing it
 *   now would be refactor-before-need.
 *
 * See docs/AudioXX_Advisory_Brain.md for the broader editorial doctrine
 * (brands-as-containers-for-ideas; the three editorial tests: useful /
 * valuable / insightful; the five-year thoughtful-enthusiast test).
 */

import { toSlug as routeToSlug } from './route-slug';
import type { BrandLink } from './consultation';

/**
 * A cross-link from a Technology Page to a brand or to another
 * Technology Page. The `relation` sentence is editorially required —
 * without it, the cross-link card would have to invent text or carry
 * only the target's own tagline; neither aligns with the doctrine's
 * "every section answers both what is it? and why does it matter?"
 * rule.
 */
export interface TechnologyCrossLink {
  /** Slug into BRAND_PROFILES or TECHNOLOGY_PROFILES. */
  slug: string;
  /**
   * One sentence (~12-25 words) naming the relation between this
   * Technology Page and the target. NOT a paraphrase of the target's
   * own tagline.
   */
  relation: string;
}

/**
 * A Technology Page entry.
 *
 * Renderer lives at apps/web/src/app/tech/[slug]/page.tsx (commit 2 of
 * the SET sequence). Lookup helper is `findTechnologyProfileBySlug`
 * below.
 */
export interface TechnologyProfile {
  /**
   * Aliases used for slug matching. The first alias drives the
   * canonical URL: `routeToSlug(names[0])` is the page slug. Additional
   * aliases support both common acronyms and the spelled-out form
   * (e.g. ['set', 'single-ended triode']).
   */
  names: string[];

  /**
   * Explicit canonical display form. Non-optional because every
   * Technology Page so far is an acronym or a multi-word concept where
   * `humanizeFromSlug` would produce the wrong form (SET → 'Set',
   * NOS → 'Nos'). Same field added to BrandProfile in commit 015ea1a;
   * here it is required from day one.
   */
  displayName: string;

  /**
   * Optional ≤14-word tagline. Slightly more permissive than BrandProfile
   * (12 words) since technologies sometimes need to name the trade-off
   * directly.
   */
  tagline?: string;

  /**
   * The editorial argument the technology makes. Mirrors
   * BrandProfile.philosophy in role — the first prose paragraph after
   * the hero. Names the technology AS an idea, not as a category.
   */
  philosophy: string;

  /** Extended-form philosophy. ~150-280 words. Optional. */
  philosophyExtended?: string;

  /**
   * "What it is" — the technical anchor. Distinct from philosophy
   * because the reader returning for a refresher may want the technical
   * orientation without the full argument again.
   */
  whatItIs: string;

  /**
   * "Why it matters" — the structural claim about why the technology
   * earns editorial attention. Distinct from philosophy because
   * philosophy MAKES the argument; whyItMatters STATES THE STAKE.
   */
  whyItMatters: string;

  /** Idea-gifts. 4-6 entries. Each is a sentence, not a label. */
  strengths: string[];

  /** Idea-costs. 4-5 entries. The technology's conscious trade-offs. */
  tradeoffs: string[];

  /**
   * System fit. Equivalent of BrandProfile.pairingNotes. Names idea-
   * compatibility, anti-pairings, and the canonical system the
   * technology presupposes. ~200-280 words.
   */
  systemFit: string;

  /**
   * Cross-links into BRAND_PROFILES. Order is editorial — the strongest
   * relation first. The renderer resolves each slug through
   * findBrandProfileBySlug; unresolved slugs are dropped (with a dev-
   * only console.warn so authoring drift is visible).
   */
  relatedBrandSlugs: TechnologyCrossLink[];

  /**
   * Cross-links into TECHNOLOGY_PROFILES (sibling pages). May be empty
   * on first publish of a Technology Page; fills in as siblings ship.
   * The renderer suppresses the section heading when empty.
   */
  relatedTechnologySlugs?: TechnologyCrossLink[];

  /**
   * Informational links — manufacturer educational pages, museum /
   * archival references, school-of-thought primers. Same shape as
   * BrandProfile.links; the F4 reviewer-data exclusion gate applies
   * (no `kind: 'review'` rendering).
   */
  links?: BrandLink[];

  /**
   * Schools-of-thought membership memo. Same purpose as the inline
   * `// schools:` comment on BrandProfile — authored ahead of
   * Schools-of-Thought pages so cross-links are ready when those pages
   * ship.
   *
   * Soft format ("expresses both X and Y; bridges to Z"), not hard
   * category form ("is an X-school technology"). The doctrine treats
   * schools as overlapping intellectual traditions, not partitions.
   */
  schoolsMemo?: string;

  /**
   * Optional hero image. Manufacturer-sourced, museum-sourced, or
   * Wikimedia-public-domain. Locally hosted under
   * apps/web/public/brand-heroes/ (the directory name is preserved
   * from the brand-page era to avoid a parallel directory; the
   * locality discipline is the same). F4-satisfied: not
   * reviewer-derived.
   *
   * A Technology Page MAY ship text-only on first publish (the page
   * is text-rich enough to stand without one) and add the hero in a
   * follow-up commit once a safe asset is sourced.
   */
  media?: {
    images: Array<{
      url: string;
      caption: string;
      credit: string;
      sourceUrl?: string;
    }>;
  };
}

/**
 * The Technology Profiles registry.
 *
 * Order is editorial (strongest / earliest-shipped pages first); the
 * lookup helper does not depend on order.
 */
export const TECHNOLOGY_PROFILES: TechnologyProfile[] = [
  // ── SET — Single-Ended Triode Amplification ────────────
  // schools: musical-communication, low-power-amplification,
  // horn-efficiency (partnership); japanese-artisan affinity (Shindo,
  // Sun Audio, Audio Note Japan historically); analog-purism affinity
  // (the canonical SET chain is LP → MC → SUT → tube phono → SET).
  // This page is the connective tissue across the Wave 1 brand
  // cluster's SET cross-references — five existing brand pages
  // (Audio Note UK, Shindo, DeVore, Leben adjacent, Auditorium 23)
  // already author the cross-link FROM their side; this page lets
  // them be activated.
  {
    names: ['set', 'single-ended triode', 'single ended triode'],
    displayName: 'SET',
    tagline: 'Single-Ended Triode — the most uncompromised expression of low-power-as-positive-choice.',
    philosophy: 'Single-Ended Triode amplification is not merely a tube topology. It is the clearest expression of the low-power-as-positive-choice tradition in audio: a single triode handles the entire output stage with no push-pull complementary device, no negative feedback applied around the output, no global error correction. The listener gets immediacy, harmonic continuity, and musical communication. The trade is real and conscious — output power, measured linearity, and loudspeaker universality are given up in exchange for what cannot be designed in once they are given up. SET persists despite the obvious limitations because the limitations are the price of a coherent argument the topology has been making, in repeated choice by sophisticated listeners, for ~100 years.',
    philosophyExtended: 'The mainstream audiophile reading of SET is that it is a vintage curiosity preserved by hobbyist nostalgia — the topology that lost the engineering argument to push-pull and high-power solid state decades ago, kept alive by tube romance. That reading is wrong about what the listeners value, and it is wrong about the engineering. SET is the topology where a single device handles the full waveform from input to output transformer; push-pull is a topology where two complementary devices share the work and reconstruct the signal at the output. The choices have different signatures — not because one is correct and the other is not, but because the work being done at the output stage is structurally different. SET listeners argue that tonal continuity end-to-end, harmonic content as foundation rather than as added flavour, and the absence of complementary-device crossover are real and consequential differences. The mainstream reading treats these as audiophile preference; the SET tradition treats them as what amplification, at its most coherent, sounds like. The argument is not that SET is universally better — the trade-offs are real and the page names them explicitly. The argument is that the trade is principled, has been validated by repeated choice over ~100 years, and produces a result that cannot be approximated by a different topology even when the different topology is engineered to higher specifications.',
    whatItIs: 'A single triode tube — historically the Western Electric 300B and 211, contemporaneously joined by the 2A3, 45, 845, and EL34 / KT88 in triode-strapped variants — operates in Class A across the entire output cycle, handling the full audio signal end-to-end with no complementary push-pull device. Output power is typically 1–25 watts depending on tube choice. Negative feedback around the output stage is minimised or absent. The output transformer is decisive — it is doing work that solid-state designs distribute across many devices, and its quality bounds the result more strongly than in any other amplifier topology. The approach is from the Western Electric cinema-sound and broadcast-amplification era (1920s–1940s) and was the dominant high-end amplification approach before push-pull and high-power solid state displaced it commercially in the 1950s–70s. Its preservation in modern audio is a deliberate editorial choice, not a survival accident.',
    whyItMatters: 'SET matters because it is the most legible example in audio of a deliberate, principled trade-off — and because the trade-off has held its editorial position for ~100 years. Push-pull, high-feedback, and high-power amplification are improvements in the dimensions they measure; SET listeners argue that some dimensions of musical experience are not in those measurements. The page exists to land this not as nostalgia but as a structural claim about what amplification is for. If amplification is for delivering watts into loads, push-pull and high-power solid state are better engineering. If amplification is for delivering musical communication into a sensitised system, SET makes a defensible case validated by ~100 years of repeated choice by sophisticated listeners. Both readings are coherent. The choice between them is editorial, not technical, and the page exists so the editorial choice can be understood rather than assumed.',
    strengths: [
      'Tonal continuity end-to-end — a single device handling the full waveform produces a sonic signature different from any complementary-device topology, regardless of how good the complementary design is. The continuity is not a flavour added to the signal; it is what the topology produces by structure',
      'Harmonic richness as foundation, not as additive flavour — second-harmonic content is intrinsic to the single-ended triode, perceived as natural body rather than as a colouration the listener can dial in or out. Listeners who hear it as warmth are hearing the topology itself',
      'Microdynamic resolution at low listening levels — the small-signal behaviour where the topology and the high-efficiency speaker partnership meet, producing a resolution that high-power topologies struggle to match at moderate SPL because their advantages are at the other end of the dynamic range',
      'Immediacy of attack and decay — the absence of global feedback around the output stage removes one source of time-domain artifact, and the elimination of complementary-device crossover removes another. The result reads as directness rather than as resolution per se',
      'The output transformer becomes a voiced component — bringing transformer design back into editorial consideration (the way SUTs are voiced rather than commoditised) rather than treating it as a commodity. SET amplifier reviews routinely name the transformer designer as a relevant editorial fact, which is rare in other amplifier traditions',
    ],
    tradeoffs: [
      'Output power is typically 1–25W. This is not a side-effect to be minimised; it is what the topology is. The trade can only be made when the speaker partner cooperates — with 95 dB+ sensitive speakers in a small-to-medium room, the trade is invisible at realistic listening levels; with low-efficiency speakers or large rooms, the trade dominates and the topology will read as underpowered rather than as direct',
      'Loudspeaker universality is forfeit. SET demands 90 dB+ sensitivity for credible operation and rewards 95–105 dB. The mainstream loudspeaker market (most speakers in the 84–88 dB sensitivity range) is foreclosed — including most floorstanders the listener may already own',
      'Bass extension and authority are bounded by the topology and the output transformer. Deep, taut bass at high SPL is not what SET delivers; listeners who anchor on bass slam will hear the voicing as polite or rolled-off',
      'Measured neutrality is deprioritised. Frequency response is gentle, output impedance is high (loudspeaker damping is loose), distortion figures are higher than push-pull solid state. Listeners who anchor on spec-sheet measurement will read the topology as flawed before the system plays a note',
      'Operational economics are real. Tubes wear and need replacement; 300B replacement is a meaningful ownership decision both in cost and in matching. The chassis runs hot. The output transformer is the most expensive single component in many SET amplifiers and constrains the price floor — a well-designed SET amplifier cannot be inexpensive in the way a comparable Class D integrated can',
    ],
    systemFit: 'SET pairs naturally with brands and components whose ideas align: high-efficiency loudspeakers (90 dB+, ideally 95+), the analog front end as the primary source, NOS or R2R DACs when digital enters the chain, and listening rooms small enough that 5–15 watts is more than the listener will ever ask for. The canonical SET system is the most-celebrated systemic chain in modern Musical Communication School audio: Audio Note UK or Shindo SET amplification driving DeVore Orangutan, Audio Note AN-E, or Klipsch Heritage / Altec horn-loaded loudspeakers, fed by an LP → low-output MC cartridge → step-up transformer (canonically the Auditorium 23 Hommage T1) → tube phono stage chain. The system is not assembled by accident — every junction has been voiced against the others by listeners and dealers in the Musical Communication School ecosystem for decades. Brands at the edge of the cluster carry adjacent low-power arguments: Sugden (British Class A solid state) and Pass / First Watt (American minimalist Class A) are not SET but make the same low-power-as-positive-argument from different design traditions; the cross-link to those brand pages is on the school side, not the topology side. Leben push-pull KT77/KT88/EL34 is not single-ended but the listening posture, the speaker partnerships, and the editorial intent are the cluster\'s. Anti-pairings reveal the trade-off: low-sensitivity loudspeakers (below 88 dB) where the limitations dominate; large rooms requiring high SPL; measurement-led signal chains where the source voicing fights the SET voicing; FPGA DACs prioritising hyper-resolution over tonal weight; casual plug-and-play system-building, because SET rewards system thinking and the partners are not interchangeable; and listeners who treat amplifier choice as a measurement decision, who will read the topology as flawed and not build the chain to express its intent.',
    relatedBrandSlugs: [
      {
        slug: 'audio-note',
        relation: 'Anchor SET brand. The full-system SET expression — SET amplification driving Audio Note AN-E loudspeakers fed by Audio Note NOS DACs and AN cartridges — is the most complete editorial argument the topology has in contemporary audio.',
      },
      {
        slug: 'shindo',
        relation: 'Shindo Cortese 300B carries the SET argument in the WE-tradition circuit-individuality form: every circuit designed around its chosen NOS tubes rather than around a stock topology.',
      },
      {
        slug: 'devore',
        relation: 'The canonical SET *speaker* partner. DeVore Orangutan O/93 and O/96 are designed explicitly for low-power tube use; the DeVore + SET pairing is the most-cited modern expression of the topology + sensitive-speaker partnership.',
      },
      {
        slug: 'auditorium-23',
        relation: 'The canonical SET *front-end* partner. The Hommage T1 step-up transformer is voiced specifically for the SET / Musical Communication School chain; A23 also distributes Line Magnetic Audio in Germany, the mid-price modern SET specialist.',
      },
      {
        slug: 'leben',
        relation: 'Adjacent — Leben CS300 / CS600 use push-pull rather than single-ended topology, but the listening posture, speaker partnerships, and editorial intent are the SET cluster\'s; the page is here as a sister-brand cross-link, not a SET claim.',
      },
      {
        slug: 'sugden',
        relation: 'Adjacent low-power school. Sugden A21 lineage is British Class A solid-state, not SET — but the argument (low-power-as-positive-choice, voiced over measured, tonal continuity as foundation) is the same school expressed from a different design tradition.',
      },
      {
        slug: 'pass-labs',
        relation: 'Adjacent — Nelson Pass\'s First Watt line is the American single-ended Class A expression in solid-state, an explicit philosophical neighbour to SET. The Pass Labs page itself is the primary entry point; First Watt is currently an alias on that page.',
      },
    ],
    relatedTechnologySlugs: [
      // Empty on first publish. These will fill in as sibling Technology
      // Pages ship per the roadmap:
      //
      //   - nos-dacs           — the canonical digital source partner;
      //                          SET + NOS is a paired aesthetic
      //   - r2r-dacs           — sister technology to NOS in posture
      //   - step-up-transformers — the analog-interface partner; SET +
      //                            SUT + LP is the canonical front-to-back
      //                            system
      //   - high-efficiency-loudspeakers — the speaker-side partner
      //                            technology; SET cannot be reasoned
      //                            about without this page
      //   - class-a-amplification — the broader school SET sits inside
      //
      // The renderer suppresses this section's heading when the array is
      // empty, so the gap is invisible until siblings ship.
    ],
    links: [
      {
        label: 'Audio Note UK — Ongaku (SET reference; manufacturer page)',
        url: 'https://www.audionote.co.uk/',
      },
      {
        label: 'Shindo Laboratory (Cortese single-ended power amplifiers)',
        url: 'http://www.shindo-laboratory.co.jp/',
      },
    ],
    schoolsMemo: 'SET expresses the Musical Communication, Low-Power Amplification, and Horn & Efficiency schools at their intersection. It has a strong Japanese-Artisan affinity (Shindo, Leben adjacent, Sun Audio historically) and an Analog-Purism affinity (the canonical SET chain is LP → low-output MC → step-up transformer → tube phono → SET). It does not belong to any one school exclusively — like the brands that argue for it, it sits at the intersections.',
    // No hero image on first publish. The page is text-rich enough to
    // stand without one. A future commit can add a hero from a public-
    // domain / Wikimedia / museum source — candidates include a
    // 300B tube glow, a Western Electric 91A archival photograph, or
    // (with explicit manufacturer permission framing) an Audio Note
    // Ongaku interior shot. The trace comment names the gap.
  },
];

/**
 * Resolve a URL slug to a TechnologyProfile. Returns undefined if no
 * profile's `names` aliases produce the requested slug.
 *
 * Mirrors `findBrandProfileBySlug` in consultation.ts: the slug is
 * matched against the slugified form of each alias, so a profile with
 * `names: ['set', 'single-ended triode']` resolves both `/tech/set`
 * and `/tech/single-ended-triode`.
 */
export function findTechnologyProfileBySlug(
  slug: string,
): TechnologyProfile | undefined {
  if (!slug) return undefined;
  return TECHNOLOGY_PROFILES.find((tp) =>
    tp.names.some((name) => routeToSlug(name) === slug),
  );
}
