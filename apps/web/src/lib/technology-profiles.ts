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
 * An Editorial Figure rendered on a Technology Page.
 *
 * Discriminated union by `kind`. v1 ships with two kinds — `image` and
 * `signal-chain`. The `relationship-map` kind is intentionally
 * DEFERRED until at least three Technology Pages exist (SET + NOS DACs
 * + R2R DACs), so the map has enough real destinations to read as
 * orientation rather than as publishing aspiration. The Related Brands
 * section on the Technology Page already does most of the orientation
 * work for v1.
 *
 * No `position` discriminator in v1 — all figures render in one
 * dedicated "Editorial Figures" section at a fixed location in the
 * page, in authored order. Arbitrary placement (interleaving figures
 * between named text sections) is deferred until several Technology
 * Pages exist and the editorial team can observe what placement
 * flexibility is actually needed.
 *
 * Doctrine rule: every figure must justify its existence by helping
 * the reader understand something that would otherwise require
 * substantial explanation. The caption answers "why does this figure
 * exist?" — not "what is depicted?" — and that discipline lives in
 * editorial review, not in the schema.
 */
export type EditorialFigure =
  | {
      kind: 'image';
      image: {
        url: string;
        /**
         * Editorial caption — explains what the reader is seeing,
         * why it mattered historically, and why it remains relevant.
         * NOT a product-photo caption.
         */
        caption: string;
        /** Photographer / source / institution credit. */
        credit: string;
        /** Optional link to the original asset page (e.g. Wikimedia file page). */
        sourceUrl?: string;
        /** Optional `alt` text override. Defaults to the caption. */
        alt?: string;
      };
    }
  | {
      kind: 'signal-chain';
      /** Optional figure heading. */
      title?: string;
      /**
       * Optional small italic clarification rendered between the
       * title and the chain. Used when the title alone leaves a
       * possible misreading on the table — e.g. the SET system
       * chain uses "The SET system, not the SET topology" to keep
       * the reader from mistaking the system chain for a topology
       * diagram.
       */
      subtitle?: string;
      /**
       * Editorial caption — explains the EDITORIAL CLAIM the chain
       * makes, not just what the chain is. For SET this is "SET is
       * usually part of a broader low-power system philosophy in
       * which source, amplification, and loudspeaker sensitivity are
       * selected together rather than independently."
       */
      caption: string;
      /**
       * Ordered chain nodes. Each renders as a labeled box with an
       * optional italic sublabel. The renderer lays the chain out
       * horizontally on desktop and reflows to a vertical stack on
       * narrow viewports.
       */
      nodes: Array<{
        label: string;
        /** Italic sublabel printed under the primary label. */
        sublabel?: string;
      }>;
    };

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

  /**
   * Editorial Figures — explanatory visuals authored as data.
   *
   * Figures render in a single dedicated "Editorial Figures" section
   * on the Technology Page, in the order authored here. The renderer
   * dispatches by `kind` to the corresponding component primitive
   * (apps/web/src/components/editorial/figures/).
   *
   * v1 supports two kinds: `image` and `signal-chain`. Adding new
   * kinds (relationship-map, timeline, etc.) is a one-line extension
   * to the EditorialFigure union plus one new component file. See
   * the EditorialFigure type definition above for the deferral
   * rationale.
   *
   * A Technology Page MAY ship with zero figures (the section heading
   * is suppressed when the array is empty or absent).
   */
  figures?: EditorialFigure[];
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
    // ── Editorial Figures ──────────────────────────────────
    // v1 of the Editorial Figures layer for SET. Ships with one
    // figure: the SET system signal-chain diagram. The chain is the
    // primary learning artifact for this page — it lands the editorial
    // claim that SET is rarely chosen in isolation but rather as part
    // of a complete low-power system philosophy.
    //
    // Context-image gap (DELIBERATELY DEFERRED 2026-06-09):
    //   A 300B tube close-up was specified as the SET pilot's context
    //   image. The Wikimedia Commons / Creative Commons / public-
    //   domain corpus was searched and no candidate met the editorial
    //   quality gate set by the brief:
    //     * SE-300B-70W.jpg — Public Domain tag but Credit field
    //       points at a commercial site (space-tech-lab.com);
    //       provenance ambiguous.
    //     * 300B_triode_with_E.A.T._branding_at_HighEnd-2009_(...).jpg
    //       — commercial brand "E.A.T." visible in the frame.
    //     * All other 300B Wikimedia files are SVG schematics or
    //       PNG data charts, not photographs.
    //   Per the user's directive "do not use an image simply because
    //   it is legally available," the image was skipped. The
    //   signal-chain figure carries the page's editorial weight
    //   alone. When a rights-clean, watermark-free, commercial-
    //   branding-free, magazine-quality 300B photograph surfaces
    //   (museum collection / archival photographer / commissioned
    //   work), an ImageFigure entry can be added here as the FIRST
    //   element in the figures array.
    figures: [
      {
        kind: 'signal-chain',
        title: 'The SET System',
        subtitle: 'The SET system, not the SET topology.',
        nodes: [
          { label: 'Low-Output MC Cartridge', sublabel: '~0.2–0.5 mV' },
          { label: 'Step-Up Transformer', sublabel: 'voiced for the cartridge' },
          { label: 'Tube Phono Stage', sublabel: 'MM input via SUT' },
          { label: 'SET Amplifier', sublabel: '1–25 W; 300B / 2A3 / 845' },
          { label: '95 dB+ Loudspeaker', sublabel: 'horn or high-sensitivity' },
        ],
        caption: 'SET amplification is rarely chosen in isolation. It is usually part of a complete low-power system philosophy in which cartridge output, gain structure, amplifier power, and loudspeaker sensitivity are selected together rather than optimized independently.',
      },
    ],
  },
  // ── NOS DACs — Non-OverSampling Digital-to-Analog Conversion ──
  // schools: musical-communication, analog-purism, full-system-coherence
  // (Audio Note UK anchor); horn-efficiency affinity by canonical
  // chain pairing. NOS sits at the digital-source side of the same
  // system philosophy the SET page articulates on the amplification
  // side. The cross-link to SET is the most editorially-load-bearing
  // link this page carries.
  {
    names: ['nos dacs', 'nos-dacs', 'nos', 'non-oversampling', 'non-oversampling dacs'],
    displayName: 'NOS DACs',
    tagline: 'A listening philosophy expressed through a digital topology — non-oversampling D-to-A conversion.',
    philosophy: 'Non-OverSampling DACs are not a refusal of digital. They are a deliberate, principled trade of measurement-textbook frequency response and aggressive image rejection for transient continuity, tonal density, and freedom from long digital filter pre-ringing. The measurement case for oversampling is not wrong — it is incomplete. Oversampling delivers genuine engineering gains in audible-band frequency flatness and out-of-band image rejection; NOS gives those gains up in exchange for a different set of properties that the measurement framework does not fully capture. Listeners committed to tonal density and musical communication have chosen this trade for forty years, and the choice has been validated by multiple successful brands building entire careers around it — Audio Note UK, TotalDAC, Holo Audio, Denafrips. The page exists to make the trade explicit, not to advocate.',
    philosophyExtended: 'Oversampling earned its mainstream position honestly. Long FIR digital filters running on oversampled data deliver textbook frequency response, flat to Nyquist, with image content above Nyquist removed to a degree no analog filter can match. For the engineering goals oversampling was designed against, it is genuinely better. The NOS argument is not that those gains are illusory; it is that they come with a time-domain cost — pre-ringing energy preceding transients — that the measurement framework reports but does not weight the way listeners do. A NOS DAC produces no pre-ringing because it has no long FIR filter in the signal path; it accepts a gentle sin(x)/x roll-off in the audible upper octave (real at 44.1 kHz, smaller at 96 kHz and above) and reduced rejection of out-of-band images instead. The trade is structurally different from a tonal preference. Listeners report that NOS DACs sound less "digital" — meaning that transient attacks have continuity rather than mechanical artificiality and that tonal density survives the conversion in a way they do not hear from oversampling at the same price tier. After forty years of consistent niche demand and continuous product development from serious brands, the position is durable enough to deserve editorial attention rather than dismissal. The measurement case is not wrong. It is incomplete.',
    whatItIs: 'A non-oversampling DAC takes a PCM bitstream at its native sample rate (44.1 / 48 / 88.2 / 96 / 176.4 / 192 kHz) and converts it to analog through a parallel R2R resistor ladder, without first upsampling to a higher internal rate and without a long digital filter to suppress images above Nyquist. The standard oversampling path applies a multi-tap FIR filter on upsampled data (8×, 16×, or higher), then a delta-sigma or hybrid modulator, then a gentle analog reconstruction filter. The NOS path skips the upsampling and the long FIR; the PCM data flows directly into the R2R ladder and out through a minimal first-order analog reconstruction filter. The two consequences of the omission are real: a sin(x)/x amplitude roll-off in the audible upper octave (about 4 dB at 20 kHz at 44.1 kHz redbook, smaller at higher source rates) and out-of-band image content above Nyquist that the gentle analog filter does not fully eliminate. Historical lineage: most early consumer CD players (1982–1990) were NOS by circuit availability. As digital filtering matured, the industry standardised on oversampling; NOS persisted as a niche audiophile choice, formalised by Audio Note UK\'s Andy Grove in the late 1990s and carried into the modern market by TotalDAC, Holo Audio, and Denafrips.',
    whyItMatters: 'NOS matters because it is one of the clearest cases in audio where a philosophical commitment (tonal density and freedom from long-filter pre-ringing over textbook frequency response) found its expression in a specific topology (R2R conversion with minimal reconstruction filtering). The structural claim is about what D-to-A conversion is for. If conversion is for delivering a measurement-flat reconstruction of the source bitstream, oversampling is better engineering. If conversion is for delivering a signal that preserves tonal density and transient continuity into a system already committed to those properties, NOS makes a defensible case that has been chosen by sophisticated listeners for forty years. Both readings are coherent. The choice between them is editorial, not technical, and the page exists so the editorial choice can be understood rather than assumed. The measurement case is not wrong; it is incomplete in the same way the SET argument is incomplete from the high-power-solid-state perspective.',
    strengths: [
      'Freedom from long-FIR pre-ringing as a structural property — the output cannot contain pre-ringing because no long digital filter sits in the signal path; listeners describe this as transient immediacy and a "less digital" character',
      'Tonal density preserved as a foundation rather than added as a flavour — the R2R ladder plus minimal-filter architecture carries the harmonic content of the source through conversion intact, producing a tonal palette listeners describe as full-bodied without sounding artificially warmed',
      'A short signal path that is editorially auditable — every component is a real circuit (resistor ladder, output stage, analog filter) rather than a black-box DSP block; the brand can voice each component individually rather than subordinating it to a filter algorithm',
      'Consistency with the Musical Communication School cluster — a NOS DAC inserted into a chain of tube preamps, SET amplification, and high-efficiency loudspeakers is heard as one more component voiced the way the rest of the chain is voiced, where an oversampling DAC at the same price tier often introduces a tonal disagreement',
      'A durable editorial position — forty years of continuous niche commercial demand, multiple successful brands building entire product lines around the topology (Audio Note UK, TotalDAC, Holo Audio, Denafrips), and no sign of the niche collapsing; the position is durable in a way that fashion-driven design choices are not',
    ],
    tradeoffs: [
      'Audible-band frequency response is not textbook — at 44.1 kHz redbook the sin(x)/x roll-off is real (about 4 dB at 20 kHz) and listeners who prioritise flat measured response above 10 kHz will hear it; at 96 kHz and 192 kHz source rates the cost shrinks but does not vanish',
      'Out-of-band image content above Nyquist is not fully filtered — a NOS DAC\'s gentle analog reconstruction filter passes more of this content than an oversampling DAC\'s combined digital plus analog filter; downstream amplifiers and speakers ignore most of it but it is present',
      'Measurement-anchored evaluation will read NOS as flawed — listeners and reviewers who anchor evaluation on spec-sheet measurement see the roll-off, the residual images, and the higher distortion figures and conclude the DAC is broken; the trade-off is invisible to that evaluation method',
      'The price floor is higher for a given measured performance — a discrete R2R ladder built to NOS standards uses precision resistors and a discrete analog output stage, which is more expensive per measured-spec point than a delta-sigma chip with integrated oversampling; Audio Note UK, TotalDAC, and the upper Holo / Denafrips tiers reflect this in their pricing',
      'Source-rate format matters more than in oversampling DACs — the roll-off at 44.1 kHz is much larger than at 96 kHz, so the library and delivery-format decision (redbook CD versus hi-res file versus streaming codec) interacts with the DAC choice in a way the oversampling-DAC owner does not have to think about',
    ],
    systemFit: 'NOS DACs pair naturally with brands and components whose ideas align: tonal density over measurement-target neutrality, the analog front end as the primary source (with digital as the secondary), low-power tube or Class A amplification, and high-efficiency loudspeakers. The canonical NOS system places the DAC at the digital-source junction of a Musical Communication School chain: an Audio Note UK DAC One through DAC Five Signature, a TotalDAC d1 or d2, or a Holo Audio May / Spring / Cyan feeding a tube preamp (Shindo Aurièges / Monbrison / Masseto, Audio Note UK M-series, Leben RS-series) into SET amplification (Audio Note Ongaku family, Shindo Cortese 300B, Line Magnetic SET) or push-pull tube and Class A (Leben CS600X, Audio Note UK push-pull, Sugden Class A) driving high-efficiency loudspeakers (DeVore Orangutan O/93 and O/96, Audio Note AN-E, Klipsch Heritage, Living Voice). The analog-front-end side of the chain (LP via low-output MC → Auditorium 23 Hommage T1 SUT → tube phono stage) remains the primary source in many of these systems; the NOS DAC is the digital input that does not fight the rest of the chain. Anti-pairings reveal the trade-off: measurement-led signal chains built around brands optimising for ASR-style spec-sheet leadership (the source-side and downstream voicing fight; NOS reads as broken rather than principled); studio monitoring contexts (NOS is not what monitors are designed for and the audible-band roll-off matters in reference work); DSP-led platform chains where the signal is converted back to digital after the DAC (Trinnov, full Dirac, networked DSP processors); redbook-only systems where the 44.1 kHz roll-off is the worst case the listener will ever face; and listeners who judge amplifier and DAC choice primarily by spec-sheet measurement, who will read the topology as flawed before the system plays a note.',
    relatedBrandSlugs: [
      {
        slug: 'audio-note',
        relation: 'The anchor brand for NOS. Andy Grove\'s DAC One through DAC Five Signature line defined the modern editorial argument for the topology and remains the reference against which other NOS DACs are heard. Audio Note also argues full-system coherence — DAC, preamp, amp, and speaker voiced as a single chain.',
      },
      {
        slug: 'totaldac',
        relation: 'The discrete-R2R modern reference. Vincent Brient built the brand around discrete-ladder NOS philosophy at a deliberately premium tier; the d1 and d2 series are the canonical contemporary R2R DACs against which other discrete-ladder designs are compared.',
      },
      {
        slug: 'holo',
        relation: 'The Chinese R2R specialist that made discrete-ladder NOS available at mid-tier prices. May, Spring, and Cyan models put the topology in reach of listeners who could not afford TotalDAC, expanding the school\'s reach without compromising on the architectural commitment.',
      },
      {
        slug: 'denafrips',
        relation: 'The wider-distribution R2R specialist offering NOS as a switchable mode across the Ares / Pontus / Venus / Terminator line. Lower price floor than Holo and a longer ladder of tiers; the topology choice is the same, expressed at a more accessible scale.',
      },
      {
        slug: 'shindo',
        relation: 'Not a DAC maker — the cross-link is on the chain side. A Shindo system\'s canonical digital source is an Audio Note UK or TotalDAC NOS DAC because the rest of the chain (preamp, SET or push-pull amplifier, high-efficiency speaker) presupposes a tonally-dense digital input.',
      },
      {
        slug: 'leben',
        relation: 'Same reasoning as Shindo. Leben\'s CS300 / CS600 amplification and the brand\'s broader chain posture presuppose a tonally-dense source; when the source is digital, a NOS DAC is the canonical choice. The Leben + NOS pairing is heard most often with DeVore or Harbeth speakers.',
      },
      {
        slug: 'devore',
        relation: 'Speaker-side partner in the canonical chain. The SET + NOS + DeVore Orangutan O/96 system is the most-cited modern flagship in the Musical Communication School. DeVore\'s editorial position presupposes the kind of source-side coherence NOS provides.',
      },
      {
        slug: 'auditorium-23',
        relation: 'The analog-interface anchor that argues system coherence at the invisible parts of the chain (cables, transformers). NOS DACs apply the same posture — coherence at the digital-source side — making A23 a natural editorial sibling rather than a direct product partner.',
      },
    ],
    relatedTechnologySlugs: [
      {
        slug: 'set',
        relation: 'The canonical amplifier partner. The SET + NOS + high-efficiency speaker chain is the most editorially-developed system in the Musical Communication School cluster; both technologies argue the same posture (deliberate engineering trades for tonal density and transient continuity) from different ends of the signal path.',
      },
      // Future technology pages — added when they ship:
      //   - r2r-dacs            (sibling page; NOS DACs are typically
      //                          R2R DACs, but the concepts are not
      //                          identical and warrant separate pages)
      //   - step-up-transformers (analog-front-end partner)
      //   - high-efficiency-loudspeakers (speaker-side partner)
      //   - class-a-amplification (broader school)
      // The renderer suppresses unrendered links automatically, so
      // these additions are one-line append operations when sibling
      // pages land.
    ],
    links: [
      {
        label: 'Audio Note UK — DAC family (NOS reference; manufacturer page)',
        url: 'https://www.audionote.co.uk/',
      },
      {
        label: 'TotalDAC (discrete-R2R NOS; manufacturer page)',
        url: 'https://www.totaldac.com/',
      },
    ],
    schoolsMemo: 'NOS DACs express the Musical Communication, Analog Purism, and Full-System Coherence schools at their intersection. The topology has a strong Horn & Efficiency affinity (by canonical chain pairing) and an Analog Front-End affinity (NOS DACs are most often run alongside an LP chain rather than as the primary source). It does not belong to any one school exclusively — like the brands that argue for it, it sits at the intersections.',
    // ── Editorial Figures ──────────────────────────────────
    // v1 of the NOS DACs Editorial Figures layer. Two figures, in
    // authored order:
    //
    //   1. Image — Philips TDA1541A S1 chips on a vintage DAC PCB
    //      (context: the chip and the era this argument came from)
    //   2. Signal-chain — "Inside the NOS DAC" (the path the
    //      topology takes; the primary learning artifact)
    //
    // Image sourcing record (2026-06-09):
    //   Candidate identified within the time-boxed search window
    //   on Wikimedia Commons. Editorial quality gate passed:
    //     * Rights: CC BY-SA 3.0, artist "Cjp24" ("Own work" on
    //       Wikimedia — no ambiguous commercial-site provenance
    //       chain like the SET candidates had).
    //     * Resolution: 2560 × 1920 native (locally hosted under
    //       apps/web/public/editorial-figures/nos-tda1541a.jpg).
    //     * Watermarks: none.
    //     * Commercial branding: none in the editorial sense. The
    //       chips bear Philips factory markings ("TDA1541A S1") and
    //       the chip is from the era when Philips was a chip vendor;
    //       these markings are factual identification of the
    //       technology, NOT commercial branding overlay (the same
    //       standard a "300B" tube marking would have met for SET).
    //     * Editorial loading: the TDA1541A is the iconic R2R chip
    //       of the early CD-player era and is the chip Audio Note
    //       UK's Andy Grove reverse-engineered the modern NOS
    //       argument for. Two of them visible in stereo
    //       configuration, surrounded by the passive components
    //       that form the analog output stage.
    //   The page therefore ships with both figures; the context
    //   image precedes the signal-chain in the reading flow.
    figures: [
      {
        kind: 'image',
        image: {
          url: '/editorial-figures/nos-tda1541a.jpg',
          caption: 'Two Philips TDA1541A S1 chips on a vintage CD-player DAC board. The TDA1541A was one of the defining 16-bit R2R conversion ICs of the early CD era (introduced 1986) and the chip that vintage NOS-DAC enthusiasm centred on through the 1990s. The "S1" suffix marked Philips\'s grade-selected variant; players using TDA1541A S1 (Marantz CD-94, Philips CD960, Cambridge CD1, among many others) remain editorially central today, and the chip remains the historical reference against which discrete-R2R ladder designs are heard. The visible components around it — through-hole resistors, electrolytic and film capacitors — are the analog output stage the NOS architecture preserves.',
          credit: 'Cjp24 (Wikimedia Commons, CC BY-SA 3.0)',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:DAC_Philips_TDA1541A_S1.jpg',
          alt: 'Two Philips TDA1541A S1 R2R DAC chips on a vintage CD-player board surrounded by through-hole resistors and capacitors.',
        },
      },
      {
        kind: 'signal-chain',
        title: 'Inside the NOS DAC',
        subtitle: 'The path that does not take.',
        nodes: [
          { label: 'PCM Input', sublabel: 'native sample rate; no upsampling' },
          { label: 'R2R Resistor Ladder', sublabel: 'parallel converters, no delta-sigma' },
          { label: 'Direct Analog Output', sublabel: 'discrete output stage, no filter chip' },
          { label: 'Gentle Reconstruction Filter', sublabel: 'first-order analog only' },
        ],
        caption: 'A non-oversampling DAC keeps the signal path short. There is no upsampling stage, no long digital filter, and no oversampled output. The trade is explicit: textbook frequency response above 10 kHz and aggressive image rejection are partially given up in exchange for transient continuity, tonal density, and freedom from long-filter pre-ringing. Each choice in the chain is what the DAC is, not an implementation accident.',
      },
    ],
  },
  // ── R2R DACs — Resistor-Ladder Digital-to-Analog Conversion ──
  // schools: musical-communication, analog-purism, full-system-coherence
  // (Audio Note UK anchor by chip-to-discrete progression); cross-cluster
  // with NOS DACs (most NOS designs are R2R; some R2R designs run
  // oversampling). The page sits at the conversion-architecture side of
  // the digital-source argument: where NOS asks "should anything filter
  // in front of conversion?", R2R asks "what physically performs the
  // conversion?". The two pages must be authored as siblings; the
  // comparison is the editorial bridge.
  {
    names: ['r2r dacs', 'r2r-dacs', 'r2r', 'resistor-ladder dacs', 'resistor ladder dacs', 'ladder dac', 'multibit dac', 'multi-bit dac'],
    displayName: 'R2R DACs',
    tagline: 'Resistor-ladder digital-to-analog conversion — every bit\'s weight is a physical resistor.',
    philosophy: 'R2R DACs are not a refusal of modern digital. They are the argument that parallel binary-weighted conversion through a precision resistor network is the most editorially auditable path from a digital sample to an analog voltage. The architectural commitment is a different one than NOS: NOS is a filtering decision (don\'t upsample, don\'t apply a long FIR digital filter), R2R is a conversion architecture (use a resistor ladder rather than a delta-sigma modulator). The two concepts are commonly chosen together — most NOS DACs are R2R, and most R2R DACs run NOS — but they are independent. Oversampling R2R designs exist (Denafrips switchable modes, Audio Note UK Level 2/3 oversampling variants); non-R2R multi-bit DACs exist (Schiit-class designs using non-ladder multi-bit chips). The R2R argument is about what physically converts the bits, not about what happens before the conversion. Delta-sigma — the industry consensus topology that displaced multi-bit R2R commercially in the 1990s — wins decisively on cost, integration density, measured distortion at moderate signal levels, and the smallest measured noise floor. Those gains are real and the R2R argument does not contest them. The R2R argument contests the implicit claim that those measurements describe everything that matters in conversion.',
    philosophyExtended: 'The architectural fact the editorial position rests on is this: in an R2R ladder, every input bit\'s contribution to the output is a physical voltage produced by a physical resistor network. The designer of a discrete R2R DAC chose every resistor — the type (foil, bulk metal, thin-film), the matching method (selected pairs, factory-trimmed networks, board-level laser trim), and the temperature-coefficient strategy. The voicing decisions are visible at the schematic level. Delta-sigma decisions are baked into a chip vendor\'s IP and the designer chooses among modulator topologies the vendor has already implemented. Both positions are coherent; the R2R argument is that the editorial difference is itself meaningful. The result listeners report most consistently is tonal density preserved through conversion — and the consistency of the report across implementations from different manufacturers (Audio Note UK, TotalDAC, Holo Audio, Denafrips, Rockna) suggests an architectural cause rather than per-implementation variance.\n\nWhy R2R became rare: in the 1980s, multibit / R2R was mainstream — virtually every consumer CD player used some form of resistor-ladder conversion, with the Philips TDA1541A and Burr-Brown PCM-series chips among the widely-deployed examples. In the 1990s, delta-sigma won the commercial argument on cost, integration density, measured distortion, and mass-market manufacturability; chip vendors stopped developing new R2R parts and the existing chips entered long-tail production decline. In the 2000s, R2R survived as an audiophile niche, kept alive by brands that explicitly argued for the topology against the industry consensus and by collectors restoring TDA1541A and PCM-series players. From the 2010s onward, a discrete-ladder renaissance has produced R2R designs at multiple price tiers — TotalDAC at the premium end, Holo Audio and Denafrips at mid-tier — and the topology has stabilised as a permanent minority position rather than continuing to decline. The discrete-ladder cluster does not depend on out-of-production chips; the chip-R2R cluster does. Both clusters share the editorial argument that conversion architecture matters.',
    whatItIs: 'A resistor-ladder DAC converts a digital sample to an analog voltage in one parallel step by summing voltage contributions from a network of precision resistors arranged in a binary-weighted pattern. The two ladder topologies in common use are the R-2R ladder (uses only two resistor values, R and 2R, which simplifies the matching problem — the name "R2R" comes from this topology and is used in audiophile shorthand for the broader resistor-ladder category) and the fully binary-weighted ladder (uses N different resistor values for N-bit conversion; harder to match in practice). For each bit position in the input PCM word, a switch connects the corresponding ladder rung either to the reference voltage (bit = 1) or to ground (bit = 0); the summed currents flow into a summing amplifier and produce the output voltage. Every bit\'s weight is a physical resistor in the network. Implementations split into two families: chip-based R2R, where the ladder is fabricated on a silicon die with wafer-level trim (the Philips TDA1541A and the Burr-Brown / Texas Instruments PCM-series — PCM63, PCM1702, PCM1704 — and Analog Devices AD-series chips such as the AD1865 are among the canonical examples, all now out of production), and discrete R2R, where the ladder is built from individual precision resistors on a PCB with factory trim-calibration (TotalDAC\'s d1 DAC line, Audio Note UK\'s upper DAC range, Holo Audio May / Spring / Cyan, Denafrips Terminator and the upper Denafrips tiers, and Rockna\'s Wavedream with its discrete hybrid ladder topology). How R2R differs from adjacent concepts: vs delta-sigma — R2R is parallel multi-bit conversion in one step; delta-sigma uses single-bit or low-bit noise-shaped conversion at high modulation frequency. Vs NOS — R2R is an architecture (resistor ladder), NOS is a filtering decision (whether to upsample); the two are independent. Vs oversampling — R2R can run oversampling (Denafrips switchable modes); oversampling is conceptually upstream of conversion and can feed any conversion topology.',
    whyItMatters: 'R2R matters because it is one of the clearest cases in audio where two coherent engineering positions produce different listening signatures for structural rather than implementation reasons. Delta-sigma converts by noise-shaping a single-bit or low-bit modulator running at very high frequency; the listening signature is the sum of the modulator\'s decisions and the on-chip output stage\'s behavior, both of which the chip vendor designed. R2R converts by summing contributions from a physical resistor network; the listening signature is the sum of the ladder\'s linearity, the output stage\'s design, and the precision-resistor choices the designer made. Neither approach is correct; both are coherent commitments to a particular relationship between the bits and the analog voltage. The page exists so the editorial choice can be understood at the architectural level rather than as a tonal preference. If conversion is judged primarily by measured distortion and measured noise at moderate signal levels, delta-sigma is better engineering. If conversion is judged by monotonic linearity at the resistor level, freedom from noise-shaper artifacts, and an auditable design where every bit-weight decision is visible in the schematic, R2R makes a defensible case. The audiophile press routinely conflates R2R with NOS because the two concepts are often chosen together; the comparison with NOS DACs at the bottom of this page exists to fix that conflation in the Audio XX editorial map.',
    strengths: [
      'Monotonic linearity is a physical property of the network — the output voltage for input N is bounded by the outputs for input N-1 and N+1 by the structure of the ladder itself, not by a noise-shaper algorithm\'s aggregate behavior',
      'Freedom from noise-shaper artifacts — no high-frequency noise-shaping, no signal-dependent noise modulation, no idle tones; the noise floor is white or near-white, which listeners and some measurement methodologies report as a more natural absence-of-sound between notes',
      'Auditable design at the resistor level — every bit\'s contribution is a physical resistor whose value, type, temperature coefficient, and matching tolerance the designer chose; the voicing decisions are visible in the schematic, and the brand\'s editorial position lives in the part list',
      'Tonal density preserved through conversion — the subjective claim most consistently reported across R2R implementations from different manufacturers, suggesting the result is architectural rather than per-implementation',
      'A durable editorial position with brand-level commitment — brands that build around discrete resistor ladders (TotalDAC, Audio Note UK\'s upper DAC range, Holo Audio May, Denafrips Terminator, Rockna Wavedream) are making an unmistakable editorial commitment that scales with price tier and is visible to buyers in a way delta-sigma chip choice rarely is',
    ],
    tradeoffs: [
      'Resistor matching is the dominant manufacturing problem — a 24-bit R2R ladder requires resistors matched to ~0.1 ppm to achieve monotonic 24-bit linearity; off-the-shelf 0.01% precision resistors do not get there, and brands must hand-select, trim-calibrate, or accept lower effective resolution than the nominal bit count',
      'Manufacturing complexity drives cost — discrete-ladder DACs use many precision resistors per channel, each placed and trimmed; the labor cost floor is meaningfully higher than delta-sigma at any given price point, which is why TotalDAC and Audio Note UK\'s upper-range pricing reflects the topology directly',
      'Calibration is required and can drift — discrete R2R designs need initial trim calibration and may require re-calibration as the resistor temperature coefficients age; chip-based R2R handled this at the wafer level, but discrete designs must handle it at the board level',
      'Measurement honesty — delta-sigma wins on the metrics most reviews report at most price points (THD, SNR, IMD, dynamic range); the R2R argument does not deny the measurement gap, it argues the metrics are incomplete; consumers and reviewers anchoring on these metrics will see R2R as inferior engineering',
      'Out-of-production chip supply constrains the chip-R2R sub-cluster — the canonical chip-based R2R parts (TDA1541A, the PCM-series ladder DACs, the AD-series ladder DACs) are all out of production, and brands using these chips depend on remaining inventory or salvaged stock; the discrete-ladder cluster does not have this constraint, but the chip-cluster does, and it sets a price floor for restoration-class projects',
    ],
    systemFit: 'R2R DACs pair naturally with brands and components whose ideas align on conversion-side tonal density: tonal density preserved through the digital-to-analog step, monotonic linearity over noise-shaper measurement optimization, and editorial commitment to architecture at the brand scale. The canonical R2R chain is the same as the canonical NOS chain (most R2R DACs in the cluster also run NOS; cross-reference the NOS DACs page for the chain framing) — an Audio Note UK DAC, a TotalDAC d1, a Holo Audio May / Spring / Cyan, or a Denafrips Terminator feeding a tube preamp into SET or push-pull tube amplification driving high-efficiency loudspeakers. The brands that anchor the R2R conversation specifically (rather than the chain context) span the price spectrum: Holo Audio (mid-tier discrete-ladder), Denafrips (wider-distribution discrete-ladder), TotalDAC (premium discrete-ladder), and Rockna (flagship discrete hybrid ladder); Audio Note UK\'s DAC range demonstrates the chip-to-discrete progression as a product family across price tiers. Vintage chip-R2R chains (Marantz CD-94, Philips CD960, and similar TDA1541A-era players; Audio Note UK DAC restorations from the chip-R2R era) pair naturally with Auditorium 23 cables and tube electronics for a heritage Musical Communication chain. Anti-pairings reveal the trade-off: measurement-anchored evaluation chains (delta-sigma will give higher measured performance per dollar; R2R\'s editorial value is invisible to spec-sheet selection); high-resolution-streaming DSP-led chains where the signal is converted digital-analog-digital-analog through processing (R2R\'s auditable-design claim dilutes into invisibility); studio monitor workflows where delta-sigma\'s measurement profile is what qualifies equipment; cost-floor-constrained builds where measured performance per dollar is the primary criterion; and listeners who already get their tonal density from elsewhere in the chain and do not depend on the DAC for it.',
    relatedBrandSlugs: [
      {
        slug: 'audio-note',
        relation: 'The chip-to-discrete R2R reference. Audio Note UK introduced the DAC3 in 1992 as the brand\'s first argument against the oversampling consensus, naming the approach "1x oversampling direct from disc"; the DAC range has since walked the chip-to-discrete progression as a product family across multiple price tiers, with the brand\'s editorial argument extending to preamp, amplifier, and speaker as a single chain.',
      },
      {
        slug: 'totaldac',
        relation: 'The discrete-R2R modern reference. Vincent Brient founded TotalDAC in France and the brand describes its DACs as "R2R with discrete resistors"; the d1 DAC line argues that the discrete-ladder commitment can be made at a premium price tier and cannot be made by chip-based R2R designs at any price after the TDA1541A / PCM-series era.',
      },
      {
        slug: 'holo',
        relation: 'Brought R2R discrete-ladder DACs into the mid-tier. The May, Spring, and Cyan lines (current generation: May, Spring 3, Cyan 2 per the US distributor Kitsune Hi-Fi) are the brand\'s argument that the R2R commitment is accessible at price points below the premium tier, and the brand\'s DACs are widely documented as offering both NOS and oversampling modes — demonstrating that R2R and the filtering decision are independent concerns.',
      },
      {
        slug: 'denafrips',
        relation: 'The wider-distribution R2R specialist. The Ares / Pontus / Venus / Terminator ladder of products is widely documented as carrying the R2R argument at successively lower price points than Holo, with the upper tiers running discrete ladders and offering selectable NOS / oversampling modes; the brand\'s tier structure makes the topology accessible at price points that the premium discrete-ladder cluster does not address.',
      },
      {
        slug: 'rockna',
        relation: 'Flagship R2R from Romania. Rockna Wavedream uses a discrete sign-magnitude hybrid ladder topology (per the manufacturer\'s own description) with R2R-ladder linearity dithering and FPGA-based custom architecture — an unusual position in the R2R cluster because the conversion is discrete but the digital front-end is software-defined.',
      },
      {
        slug: 'shindo',
        relation: 'Not a DAC maker — same chain-context cross-link as the NOS DACs page. Shindo systems\' canonical digital source is an R2R DAC because the rest of the chain is voiced for the tonal density R2R conversion preserves; the cross-reference is on the system side, not the topology side.',
      },
      {
        slug: 'leben',
        relation: 'Same chain-context reasoning as Shindo. Leben\'s CS300 / CS600 amplification and the brand\'s broader chain posture presuppose a tonally-dense source; when the source is digital, an R2R DAC is the canonical choice for the same reasons.',
      },
      {
        slug: 'devore',
        relation: 'Speaker partner in the canonical R2R chain. The system context places R2R DACs at the digital source feeding tube amplification feeding DeVore Orangutan loudspeakers; the relation is on the system side, not the topology side, and is shared with the NOS DACs page by design.',
      },
      {
        slug: 'auditorium-23',
        relation: 'The analog-interface anchor that argues coherence at the invisible parts of the chain. R2R DACs apply the same posture to the digital-conversion side — every resistor in the ladder is a voiced component, just as every cable and SUT in the analog chain is a voiced component. The editorial parallel between A23\'s argument and the discrete-R2R argument is exact.',
      },
    ],
    relatedTechnologySlugs: [
      {
        slug: 'nos-dacs',
        relation: 'The most editorially load-bearing cross-link this page carries. NOS is a filtering decision (don\'t upsample, don\'t apply a long FIR digital filter); R2R is a conversion architecture (use a resistor ladder, not a delta-sigma modulator). Most NOS DACs are R2R, and most R2R DACs run NOS, but the concepts are independent. Start on the NOS page if the question is "should this DAC filter or not"; come back to this page when the next question is "how is the conversion itself done."',
      },
      {
        slug: 'set',
        relation: 'The canonical amplifier partner. The SET + NOS + R2R + high-efficiency-speaker chain is the most editorially-developed system in the Musical Communication School cluster; SET argues from the amplification side what R2R argues from the digital-conversion side — that the design choices should be visible, auditable, and voiced rather than abstracted into chip-vendor IP.',
      },
    ],
    links: [
      {
        label: 'TotalDAC — discrete-R2R reference (manufacturer page)',
        url: 'https://www.totaldac.com/',
      },
      {
        label: 'Holo Audio — discrete-R2R May / Spring / Cyan (manufacturer page)',
        url: 'https://kitsunehifi.com/holo-audio/',
      },
    ],
    schoolsMemo: 'R2R DACs express the Musical Communication, Analog Purism, and Full-System Coherence schools at their intersection — the same schools NOS DACs express but on the conversion-architecture axis rather than the filtering-decision axis. The topology has a strong Horn & Efficiency affinity by canonical chain pairing (R2R DACs typically feed tube amplification driving high-sensitivity loudspeakers). It does not belong to any one school exclusively — like the brands that argue for it, it sits at the intersections.',
    // ── Editorial Figures ──────────────────────────────────
    // v1 of the R2R DACs Editorial Figures layer. Ships with one
    // figure: the "Inside the R2R Ladder" signal-chain diagram. The
    // figure operates at a different level of abstraction than the
    // NOS DACs "Inside the NOS DAC" figure — where NOS shows the DAC
    // as a whole (input, ladder, output stage, filter) and lands the
    // claim about *what is not in the path*, the R2R figure shows
    // what is *inside the ladder itself* and lands the claim that
    // every bit corresponds to a physical resistor.
    //
    // Image sourcing — DEFERRED 2026-06-09:
    //   Per the brief, image categories searched were:
    //     * Discrete R2R ladder board close-up
    //     * PCM63 / PCM1702 / PCM1704 photographs
    //     * Rights-safe vintage R2R DAC internals (distinct from the
    //       TDA1541A image on the NOS DACs page)
    //   Wikimedia Commons returned no usable candidates: PCM63 /
    //   PCM1702 / PCM1704 searches returned empty; "discrete resistor
    //   ladder DAC" returned an unrelated PDF; AD1865 search returned
    //   geographic results (an unrelated chapel in Darwen named after
    //   the year 1865); "Burr Brown DAC" returned unrelated electronics
    //   product photos. Manufacturer-published photography of discrete
    //   ladder boards (TotalDAC, Audio Note UK, Holo) is rights-
    //   encumbered.
    //   Per the editorial standard (the absence of a mediocre image
    //   is a feature, not a defect) the page ships with the signal-
    //   chain figure alone, matching the SET pattern. An ImageFigure
    //   can be added as the FIRST entry in the figures array when a
    //   clean asset surfaces — preferred candidates remain a discrete
    //   ladder card close-up (TotalDAC, AN-UK Level 4+, Holo May) or
    //   a PCM63 / PCM1704 standalone image, both distinct from the
    //   TDA1541A photograph already used on the NOS DACs page.
    figures: [
      {
        kind: 'signal-chain',
        title: 'Inside the R2R Ladder',
        subtitle: 'Every bit is a resistor.',
        nodes: [
          { label: 'PCM Bit Stream', sublabel: 'parallel multi-bit word' },
          { label: 'Bit-Switched Voltage Divider', sublabel: 'each bit selects Vref or ground' },
          { label: 'Summed Resistor Ladder', sublabel: 'precision R-2R network' },
          { label: 'Analog Output Voltage', sublabel: 'one physical voltage per code' },
        ],
        caption: 'An R2R DAC converts a digital sample to an analog voltage by summing contributions from a network of precision-matched resistors. Every bit\'s weight is a physical resistor in the ladder. The architecture trades the integration economics of delta-sigma for monotonic linearity and an auditable, voiced conversion stage.',
      },
    ],
  },
  // ── SUTs — Step-Up Transformers ────────────────────────
  // schools: musical-communication, analog-purism, full-system-coherence
  // (Auditorium 23 anchor); japanese-artisan affinity (Shindo, Leben,
  // Aurorasound); horn-efficiency affinity by canonical chain pairing.
  // The page sits at the analog-source side of the Technology Pages
  // corpus and is the only page in the corpus where the editorially-
  // load-bearing topic is an INTERFACE BETWEEN two components rather
  // than the internals of a single device. SET (amplification), NOS
  // (digital filtering), and R2R (digital conversion) each describe
  // what a single device does internally; SUTs describes what happens
  // at the cartridge → phono stage junction. Five existing brand
  // pages (Auditorium 23, EMT, Shindo, Leben, Audio Note UK) already
  // author the SUT cross-link FROM their side; this page lets them
  // be activated.
  {
    names: ['suts', 'sut', 'step-up transformer', 'step-up transformers'],
    displayName: 'SUTs',
    tagline: 'Passive gain at the cartridge-to-phono-stage interface — voicing through turns ratio.',
    philosophy: 'A Step-Up Transformer is not an accessory between the cartridge and the phono stage. It is the interface where the cartridge\'s output voltage, the cartridge\'s source impedance, the phono stage\'s input loading, and the listener\'s tonal preference become a single decision. The editorial position is that this interface is a voiced component — that the SUT is chosen for a specific cartridge feeding a specific phono stage, and that the turns ratio and the transformer\'s construction are voicing choices rather than implementation details. Active MC head-amps are coherent engineering — lower cost, broader cartridge compatibility, integrated loading switching, lower hum sensitivity in difficult rooms, and easier setup. The SUT argument is not that active stages are wrong; it is that passive transformer gain, when matched correctly, produces a different result that listeners committed to the analog-source posture have chosen at every price tier for decades.',
    philosophyExtended: 'The mainstream reading of step-up transformers is that they were the necessary MC-to-MM interface in the era before low-noise transistor head-amps became commercially mature, and that their continued use is conservatism rather than choice. That reading misreads the architectural fact: the SUT and the active head-amp do different things at the cartridge. An active head-amp terminates the cartridge with a resistor whose value is set in the head-amp\'s input network and applies gain through an active device with a power supply. An SUT terminates the cartridge with a reflected impedance set by the turns ratio squared against the MM phono input, and applies gain through transformer action — no active device, no power supply, no biasing decision, no active-device noise contribution. The two routes are not equivalent at the cartridge.\n\nThe trade is real and bidirectional. Active head-amps win on universality (one head-amp handles a wider range of cartridges without a hardware swap), on plug-and-play simplicity, on integrated loading adjustment (loading is set by a front-panel control rather than by transformer choice), on cost (the active route\'s price floor is meaningfully lower), on hum sensitivity in difficult rooms (active stages do not couple magnetically to AC-mains fields the way transformers can), and on setup ease for listeners who do not want to think about turns ratios. The SUT argument is not that active stages are inferior; it is that the SUT trade — passive gain, voiced transformer, cartridge-specific matching — produces a result that listeners committed to the Musical Communication School chain have continued to choose at every price tier from inexpensive Lundahl modules to reference-tier hand-wound SUTs, and that the persistence over multiple commercial generations is durable enough to deserve editorial attention rather than dismissal.',
    whatItIs: 'A Step-Up Transformer is a passive two-winding transformer placed between a low-output moving-coil (MC) cartridge and the moving-magnet (MM) input of a phono preamplifier. The cartridge produces a small AC voltage (roughly 0.2–0.5 mV at standard groove velocity, depending on the cartridge); MM phono stages are designed for the higher output of a moving-magnet cartridge. The SUT bridges the gap by transformer action — the primary winding sees the cartridge voltage, induces a magnetic field in the core, and the secondary winding produces a stepped-up voltage at the MM phono input. The turns ratio (typical values: 1:10, 1:20, 1:30, 1:40) determines both the voltage step-up and the reflected impedance the cartridge sees through the transformer: the MM input\'s load impedance (commonly 47 kΩ) divided by the square of the turns ratio. A 1:20 SUT into a 47 kΩ MM input presents the cartridge with roughly 118 Ω; a 1:40 SUT presents roughly 29 Ω. The cartridge manufacturer\'s recommended load impedance and the chosen SUT\'s turns ratio together set the loading. Some SUTs (the Auditorium 23 T1 family among others) offer multiple selectable ratios so the listener can audition different loadings on the same physical hardware. Core material, winding wire, winding geometry, shielding strategy, and case construction are voicing decisions the brand has committed to.',
    whyItMatters: 'SUTs matter because they are one of the clearest cases in audio where the interface between two components — rather than the internals of any one component — is the editorially-load-bearing decision. SET argues about a topology. NOS argues about a filter. R2R argues about a converter. SUTs argue that the way the cartridge is loaded and the way its output is stepped up to MM level is itself a voiced choice — not an accessory after the cartridge is chosen and before the phono stage is chosen. The structural claim is that some dimensions of analog playback are decided at this junction, and that they are decided by transformer choice rather than by cartridge spec-sheet or by phono-stage feature count. Active MC stages handle the gain problem with the engineering discipline a well-designed amplifier brings to any small-signal stage; the SUT argument is not that they do this badly, it is that the passive route produces a different result that the Musical Communication School chain has been built around for decades. The page exists so the editorial choice can be understood at the architectural level rather than as a tonal preference about transformers.',
    strengths: [
      'Passive voltage gain without active-device noise contribution — the transformer\'s only intrinsic noise is the Johnson noise of the primary winding resistance plus whatever EMI it picks up from the room; there is no active device noise, no power-supply noise, and no power-supply-related distortion mechanism because there is no power supply at all',
      'Reflected impedance as a voicing tool — the cartridge sees an impedance set by the SUT\'s turns ratio squared against the MM phono input, and listeners experience this as the cartridge\'s character changing with the SUT choice; the SUT is, in editorial fact, the voicing control the cartridge buyer otherwise does not have',
      'The transformer as a voiced component — core material, winding wire (copper or silver), winding geometry, shielding strategy, and case construction are choices a brand has thousands of design hours behind; the voicing decision is visible at the level of which transformer the listener bought, not at the level of which chip a vendor specified',
      'Architectural consistency with the analog-front-end posture — Audio Note UK, Shindo, EMT, Auditorium 23, and Leben all build chains that presuppose passive interfaces wherever possible; SUTs are the passive interface the cartridge-to-phono-stage junction would otherwise force into an active stage, and choosing one is a structural statement about the rest of the chain',
      'A durable pattern of repeated choice by sophisticated listeners — SUTs were standard in broadcast and audiophile use in the mid-20th century, persisted as the niche audiophile choice through the 1980s and 1990s when active alternatives were cheaper and easier, and have had a continuous renaissance from the late 1990s onward led by Auditorium 23, Audio Note UK, Lundahl-based designers and others; the position is durable in a way that fashion-driven equipment categories are not',
    ],
    tradeoffs: [
      'Matching complexity is intrinsic and required — the SUT turns ratio must be chosen against the cartridge\'s output voltage, the cartridge\'s recommended load impedance, the phono stage\'s input impedance, and the listener\'s loading preference; a wrong-ratio SUT does not sound bad, it sounds like the cartridge unloaded incorrectly, which the listener may not recognise as a matching failure',
      'Cartridge specificity limits universality — an SUT chosen for one cartridge may be wrong for another with different output voltage or recommended loading; switching cartridges may require switching SUTs or accepting that the chain is now mismatched, which active head-amps with multiple loading options handle more flexibly and without a hardware swap',
      'Hum and shielding sensitivity is real — transformers couple magnetically to AC-mains fields, motor fields, and other low-frequency magnetic sources; a well-shielded mu-metal-cased SUT placed away from power transformers is robust, but in difficult rooms or near other components an SUT may pick up hum that an active head-amp would not, and physical placement becomes the system builder\'s responsibility',
      'Cost can be high for editorial-grade options — Auditorium 23 Hommage T1, Audio Note UK silver-wound SUTs at the upper range, and reference-tier hand-wound transformers are not impulse purchases; the price floor for a good SUT is meaningfully higher than the floor for a competent active MC stage at the same overall system tier',
      'Active MC stages legitimately win on convenience, cartridge flexibility, integrated loading adjustment, lower cost, easier setup, and lower hum sensitivity in challenging rooms — listeners who want plug-and-play simplicity, who run multiple very different cartridges, who have RF or magnetic-field issues in their listening room, or who are at price points where the SUT\'s voicing premium is not the priority, are correctly served by a well-designed active head-amp; the SUT trade is principled, not universally better',
    ],
    systemFit: 'SUTs pair naturally with brands and components whose ideas align on analog-source coherence: low-output moving-coil cartridges with characterful house voicings, tube MM phono stages, tube line stages, and amplification chains committed to passive interfaces wherever possible. The canonical SUT chain is the analog-source side of the Musical Communication School flagship system — a low-output MC cartridge (EMT JSD or HSD, Ortofon SPU, Audio Note IO, Denon DL-103R, or similar) feeding a voiced SUT (Auditorium 23 Hommage T1, Audio Note UK silver-wound or copper-wound SUTs, or hand-wound transformers from the Shindo / Leben tradition), then a tube MM phono stage (Shindo Aurièges or Monbrison phono, Leben RS-30EQ, Audio Note M-series, or Aurorasound VIDA used in SUT-fed mode), then a tube line stage, then SET or push-pull tube amplification driving high-efficiency loudspeakers (DeVore Orangutan, Audio Note AN-E, Klipsch Heritage, Living Voice). The SUT sits at one specific junction in this chain, but the choice ripples back to the cartridge and forward to the phono stage; the chain is the unit of design. Anti-pairings reveal the trade-off: high-output cartridges (typically 2.5 mV and above) that already drive MM phono stages directly will over-saturate the phono input through an SUT; phono stages that integrate active MC gain stages ahead of RIAA equalisation are designed to be cartridge-fed, not SUT-fed, and may sound worse with an SUT in front; casual plug-and-play vinyl systems where the listener does not want to think about cartridge loading or impedance reflection are editorially mismatched with SUTs and a well-chosen active head-amp is the right tool; rooms with significant low-frequency magnetic fields (proximity to power transformers, fluorescent ballasts, motorised equipment) raise the difficulty of SUT placement to a degree active head-amps avoid; and streaming-first chains where the analog front-end is secondary may not justify the SUT-tier investment over a competent active MC stage.',
    relatedBrandSlugs: [
      {
        slug: 'auditorium-23',
        relation: 'The canonical modern SUT brand and the editorial anchor for the technology. The Hommage T1 is voiced specifically for the EMT / SPU / Denon DL-103 cluster of low-output MC cartridges and for the Shindo-tradition tube MM phono input. A23\'s broader argument — that coherence is decided at the invisible interfaces of the chain — finds its most direct expression in the SUT itself.',
      },
      {
        slug: 'emt',
        relation: 'EMT\'s broadcast-heritage cartridges (modern JSD and HSD; heritage TSD-15 and OFD-15) are designed for SUT-fed input. The broadcast-engineering posture EMT brings to cartridge design is the engineering case for the SUT trade — passive interface, voiced transformer, system-specific matching — as the source-side commitment that matches the brand\'s cartridge identity.',
      },
      {
        slug: 'shindo',
        relation: 'Shindo phono stages are designed for SUT-fed MM input. The brand\'s circuit-individuality argument extends to the SUT junction: a Shindo phono stage assumes a specific cartridge-into-SUT-into-MM-input chain, and the brand\'s editorial position is that this chain is the unit of voicing rather than each component in isolation.',
      },
      {
        slug: 'leben',
        relation: 'Leben\'s RS-30EQ tube phono stage is an MM-input design that presupposes SUT-fed input from low-output moving-coil cartridges. The Leben + SUT + EMT / SPU / Ortofon chain is one of the most-cited modern expressions of the analog-source argument, and the Leben house voicing is built around it.',
      },
      {
        slug: 'audio-note',
        relation: 'Audio Note UK\'s transformer-interface philosophy extends to MC step-up: the brand makes its own SUTs across multiple tiers, with silver-wound transformers at the upper range and copper / bronze constructions at entry points — the chain-as-system argument carried into the cartridge-to-phono-stage interface.',
      },
      {
        slug: 'devore',
        relation: 'Not an SUT brand — the cross-link is on the system side. DeVore Orangutan O/93 and O/96 are the high-efficiency speakers the canonical analog chain ends at, and that chain begins with the cartridge → SUT → tube phono interface this page describes.',
      },
      {
        slug: 'ortofon',
        relation: 'The Ortofon SPU and the broader low-output MC line are widely paired with SUTs; the SPU + matched-impedance SUT chain is among the canonical low-output MC references in the Musical Communication School tradition, and Ortofon\'s wider cartridge range gives SUT owners a deep pool of source-side voicing choices.',
      },
      {
        slug: 'aurorasound',
        relation: 'The Aurorasound VIDA phono stage is widely run in SUT-fed mode by listeners who want a transparent, low-noise MM input behind the SUT rather than an integrated active MC gain stage; the VIDA\'s flexible loading options make it a natural match for SUT-driven cartridge experimentation.',
      },
    ],
    relatedTechnologySlugs: [
      {
        slug: 'set',
        relation: 'The canonical amplifier partner. The cartridge → SUT → tube phono → SET → high-efficiency speaker chain is the most editorially-developed system in the Musical Communication School cluster; SUTs argue from the cartridge-to-phono-stage interface what SET argues from the amplification side — that the choices should be visible, voiced, and selected together rather than independently.',
      },
      {
        slug: 'nos-dacs',
        relation: 'Source-side counterpart on the digital axis. NOS argues that the digital path should preserve transient continuity and tonal density through filtering; SUTs argue that the analog interface should preserve the cartridge\'s character through the gain stage. The two pages name complementary parts of the same source-side commitment, and the canonical Musical Communication system runs both.',
      },
      {
        slug: 'r2r-dacs',
        relation: 'Sibling argument on the digital-conversion axis. R2R names the conversion architecture as a voiced component built from physical resistors; SUTs name the cartridge-to-phono interface as a voiced component built from a physical transformer. The Audio Note UK chain — transformer-coupled wherever possible, including at the digital-to-analog output stage — is where the two arguments meet end-to-end.',
      },
    ],
    links: [
      {
        label: 'Auditorium 23 — Hommage T1 step-up transformer (manufacturer page)',
        url: 'http://www.auditorium23.de/',
      },
      {
        label: 'Audio Note UK — transformer-coupled chain (manufacturer page)',
        url: 'https://www.audionote.co.uk/',
      },
    ],
    schoolsMemo: 'SUTs express the Musical Communication, Analog Purism, and Full-System Coherence schools at their intersection — the same schools NOS DACs and R2R DACs express on the digital-source side, here expressed on the analog-source side. The topology has a strong Horn & Efficiency affinity (by canonical chain pairing — the SUT-fed chain typically ends at a high-sensitivity loudspeaker) and a Japanese-Artisan affinity (Shindo, Leben, Aurorasound) alongside its European centre of gravity (Auditorium 23, EMT, Audio Note UK). It does not belong to any one school exclusively — like the brands that argue for it, it sits at the intersections.',
    // ── Editorial Figures ──────────────────────────────────
    // v1 of the SUTs Editorial Figures layer. Ships with one figure:
    // the "SUT Interface" signal-chain diagram. The figure operates
    // at the INTERFACE level — the editorial position the page
    // articulates — rather than at the internals of any single
    // device. SET (5-node system chain), NOS (4-node DAC chain), and
    // R2R (4-node ladder chain) each show what is inside a single
    // device; SUTs shows the four nodes the SUT sits between, and
    // names the SUT itself as one of them.
    //
    // Image sourcing — DEFERRED 2026-06-10:
    //   Per the brief, image categories searched were:
    //     * Auditorium 23 Hommage T1 photograph (only if rights-safe)
    //     * Transformer winding close-up (vintage or modern audio SUT)
    //     * Vintage broadcast SUT photograph
    //     * EMT / SPU / SUT-chain image
    //   Wikimedia Commons search for "step up transformer audio" and
    //   "Auditorium 23 Hommage" returned no audiophile-SUT-specific
    //   photographs that clear the editorial quality gate (results
    //   were technical PDFs, generic radio-era distribution
    //   transformers, and unrelated auditorium-venue documents).
    //   Manufacturer photography from Auditorium 23, Audio Note UK,
    //   and EMT is rights-encumbered. Per the editorial standard
    //   (the absence of a mediocre image is a feature, not a defect)
    //   the page ships with the signal-chain figure alone, matching
    //   the SET and R2R DACs pattern. An ImageFigure can be added
    //   as the FIRST entry in the figures array when a rights-clean,
    //   commercial-branding-free, magazine-quality SUT-specific
    //   photograph surfaces (museum collection, archival
    //   photographer, or commissioned editorial work). The Hommage
    //   Cinema loudspeaker image already used on the Auditorium 23
    //   brand page must NOT be reused here — the Cinema is a
    //   loudspeaker, editorially wrong for this page.
    figures: [
      {
        kind: 'signal-chain',
        title: 'The SUT Interface',
        subtitle: 'Gain without an active circuit.',
        nodes: [
          { label: 'Low-Output MC Cartridge', sublabel: '0.2–0.5 mV signal' },
          { label: 'Step-Up Transformer', sublabel: 'turns ratio sets gain and loading' },
          { label: 'MM Phono Stage', sublabel: 'sees stepped-up voltage' },
          { label: 'Tube Line Stage', sublabel: 'low-noise analog gain continues' },
        ],
        caption: 'An SUT is not an accessory between the cartridge and the phono stage. It is the interface where the cartridge\'s output voltage, source impedance, phono-stage input loading, and transformer construction become one system. The turns ratio determines both voltage gain and the impedance the cartridge sees through the transformer. The trade is real: SUTs give up universality and plug-and-play simplicity for passive gain and cartridge-specific loading that the system builder can voice.',
      },
    ],
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
