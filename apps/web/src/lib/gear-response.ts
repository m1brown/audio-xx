/**
 * Gear response builder.
 *
 * Produces conversational, advisory responses for gear inquiries and
 * comparisons. These bypass the diagnostic engine — no verdicts, no
 * scoring — but should feel like a knowledgeable audio advisor reasoning
 * through the situation.
 *
 * Five-part response structure (inspired by experienced audio reviewers):
 *   1. Anchor — acknowledge the gear or situation
 *   2. Character — brief sonic character
 *   3. Interpretation — what the user's goal means in listening terms
 *   4. Direction — what type of change or system direction could help
 *   5. Clarification — follow-up question
 *
 * Target: 4–6 sentences before the follow-up question.
 */

import type { GearResponse, UpgradeAnalysis, SystemBalanceEntry, ChangeMagnitude } from './conversation-types';
import type { UserIntent, DesireSignal } from './intent';
import type { ActiveSystemContext } from './system-types';
import { DAC_PRODUCTS, type Product } from './products/dacs';
import { SPEAKER_PRODUCTS } from './products/speakers';
import { AMPLIFIER_PRODUCTS } from './products/amplifiers';
import { TURNTABLE_PRODUCTS } from './products/turntables';
import { inferSystemDirection, type SystemDirection } from './system-direction';
import {
  compareProductArchetypes,
  tagProductArchetype,
  getArchetypeLabel,
  getArchetypeShortLabel,
  type SonicArchetype,
  type UserArchetypePreference,
} from './archetype';
import { topTraits, type TasteProfile } from './taste-profile';
import {
  hasTendencies,
  hasExplainableProfile,
  selectCharacterTendencies,
  selectDefaultTendencies,
  findMatchingInteractions,
  hasRisk,
  getEmphasizedTraits,
  getLessEmphasizedTraits,
  resolveTraitValue,
  type TendencyConfidence,
} from './sonic-tendencies';
import {
  resolveArchetype,
  archetypeCharacter,
  archetypeTradeoff,
  archetypeCaution,
} from './design-archetypes';
import { detectChurnSignal, buildChurnNote, type ChurnSignal } from './churn-avoidance';
import { buildTasteDecisionFrame } from './consultation';

// ── Product lookup ───────────────────────────────────

const ALL_PRODUCTS: Product[] = [...DAC_PRODUCTS, ...SPEAKER_PRODUCTS, ...AMPLIFIER_PRODUCTS, ...TURNTABLE_PRODUCTS];

/**
 * Resolve subject strings to catalog Product entries.
 *
 * Priority order (highest first):
 *   1. Exact product name match (subject === product.name)
 *   2. Exact full name match (subject === "brand name")
 *   3. Product name contained in subject or vice versa
 *   4. Brand-level fallback (subject matches brand)
 *
 * When an exact match exists, brand-level fallbacks are suppressed for
 * that subject so "Hugo TT2" never resolves to Qutest.
 */
function findProducts(subjects: string[]): Product[] {
  if (subjects.length === 0) return [];
  const found: Product[] = [];

  for (const subject of subjects) {
    const lower = subject.toLowerCase();
    let bestMatch: Product | null = null;
    let bestScore = 0;

    for (const product of ALL_PRODUCTS) {
      const brandLower = product.brand.toLowerCase();
      const nameLower = product.name.toLowerCase();
      const fullLower = `${brandLower} ${nameLower}`;

      let score = 0;
      if (nameLower === lower || fullLower === lower) {
        score = 4; // exact match
      } else if (lower.includes(nameLower) && lower.includes(brandLower)) {
        score = 3; // subject contains both brand and product name
      } else if (lower.includes(nameLower)) {
        score = 2; // subject contains product name
      } else if (nameLower.includes(lower)) {
        score = 1; // product name contains subject (partial)
      } else if (lower.includes(brandLower) || brandLower === lower) {
        score = 0; // brand-only — do not add via this path
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }

    if (bestMatch && !found.some((p) => p.id === bestMatch!.id)) {
      found.push(bestMatch);
    }
  }
  return found;
}

// ── Comparison pair resolution ──────────────────────
//
// For system-vs-system queries ("X + Y vs Z + Y"), splits the query
// at the separator, identifies which products belong to each side,
// detects shared components (held constant), and returns the
// differing pair to compare. Falls back to null for simple A vs B.

interface ComparisonResolution {
  left: Product;
  right: Product;
  shared: Product[];
  isSystemComparison: boolean;
}

/**
 * Find a product by partial brand name (for comparison context only).
 * "crayon" → Crayon Audio CIA-1T, "wlm" → WLM Diva, etc.
 * Only matches when the brand's first word matches the subject.
 */
function findProductByBrand(brandSubject: string): Product | null {
  const lower = brandSubject.toLowerCase();
  return ALL_PRODUCTS.find((p) => {
    const brandLower = p.brand.toLowerCase();
    // Exact brand match or first-word match
    return brandLower === lower || brandLower.split(/\s+/)[0] === lower;
  }) ?? null;
}

/**
 * Enhanced product finder for comparison sides.
 * Uses standard findProducts first, then falls back to brand resolution.
 */
function findProductsForSide(subjects: string[]): Product[] {
  const found = findProducts(subjects);
  // For any unresolved subject, try brand-based fallback
  for (const subject of subjects) {
    const lower = subject.toLowerCase();
    const alreadyResolved = found.some(
      (p) => p.name.toLowerCase().includes(lower)
        || `${p.brand} ${p.name}`.toLowerCase().includes(lower)
        || lower.includes(p.name.toLowerCase()),
    );
    if (!alreadyResolved) {
      const brandMatch = findProductByBrand(subject);
      if (brandMatch && !found.some((p) => p.id === brandMatch.id)) {
        found.push(brandMatch);
      }
    }
  }
  return found;
}

/**
 * Resolve which products to compare when the query has "vs"/"versus"/"or" structure.
 * Splits the query at the separator, assigns subjects to each side,
 * identifies shared components, and returns the differing pair.
 *
 * Also handles "with" as a shared-context marker:
 *   "compare JOB vs Crayon with WLM Diva"
 */
function resolveComparisonPair(
  currentMessage: string,
  subjects: string[],
): ComparisonResolution | null {
  // Find the separator — "vs", "versus", or "or" (word-bounded)
  const sepMatch = currentMessage.match(/\b(vs\.?|versus)\b/i)
    ?? currentMessage.match(/\b(or)\b/i);
  if (!sepMatch) return null;

  const sepIdx = sepMatch.index!;
  const leftHalf = currentMessage.slice(0, sepIdx).toLowerCase();
  let rightHalf = currentMessage.slice(sepIdx + sepMatch[0].length).toLowerCase();

  // Handle "with X" as shared context
  //   "compare JOB vs Crayon with WLM Diva"
  //   rightHalf = " crayon with wlm diva"
  let withSubjects: string[] = [];
  const withMatch = rightHalf.match(/\bwith\b(.+)/i);
  if (withMatch) {
    const withText = withMatch[1];
    withSubjects = subjects.filter((s) => withText.includes(s.toLowerCase()));
    rightHalf = rightHalf.slice(0, withMatch.index);
  }

  // Assign subjects to left/right side by text position
  const leftSubjects: string[] = [];
  const rightSubjects: string[] = [];

  for (const s of subjects) {
    const sLower = s.toLowerCase();
    const inLeft = leftHalf.includes(sLower);
    const inRight = rightHalf.includes(sLower);
    if (inLeft) leftSubjects.push(s);
    if (inRight) rightSubjects.push(s);
  }

  // "with" subjects are shared context
  for (const s of withSubjects) {
    if (!leftSubjects.includes(s)) leftSubjects.push(s);
    if (!rightSubjects.includes(s)) rightSubjects.push(s);
  }

  // Resolve products per side (with brand fallback)
  const leftProducts = findProductsForSide(leftSubjects);
  const rightProducts = findProductsForSide(rightSubjects);

  // Identify shared products (same product on both sides)
  const shared = leftProducts.filter((lp) =>
    rightProducts.some((rp) => rp.id === lp.id),
  );

  // Differing products — unique to each side
  const leftOnly = leftProducts.filter((p) => !shared.some((s) => s.id === p.id));
  const rightOnly = rightProducts.filter((p) => !shared.some((s) => s.id === p.id));

  if (leftOnly.length >= 1 && rightOnly.length >= 1) {
    return {
      left: leftOnly[0],
      right: rightOnly[0],
      shared,
      isSystemComparison: shared.length > 0,
    };
  }

  // One side has no unique product — try fallback from unresolved subjects
  // (e.g., "crayon" when only brand name is given)
  if (leftOnly.length === 0 && rightOnly.length >= 1) {
    // Left side unresolved — look for brand-only subjects on the left
    for (const s of leftSubjects) {
      const fallback = findProductByBrand(s);
      if (fallback && !shared.some((p) => p.id === fallback.id) && fallback.id !== rightOnly[0].id) {
        return { left: fallback, right: rightOnly[0], shared, isSystemComparison: shared.length > 0 };
      }
    }
  }
  if (rightOnly.length === 0 && leftOnly.length >= 1) {
    for (const s of rightSubjects) {
      const fallback = findProductByBrand(s);
      if (fallback && !shared.some((p) => p.id === fallback.id) && fallback.id !== leftOnly[0].id) {
        return { left: leftOnly[0], right: fallback, shared, isSystemComparison: shared.length > 0 };
      }
    }
  }

  return null; // Fall back to default product ordering
}

// ── Quality interpretation ───────────────────────────

interface QualityProfile {
  /** What this quality usually means in listening terms. */
  interpretation: string;
  /** What type of system direction or change tends to deliver it. */
  direction: string;
}

const QUALITY_PROFILES: Record<string, QualityProfile> = {
  speed: {
    interpretation: 'When listeners say "speed," they usually mean faster transient attack — sharper leading edges, more defined plucks and strikes, and a sense that the music starts and stops precisely.',
    direction: 'That kind of change typically comes from the DAC architecture (delta-sigma and FPGA designs tend to excel here) or from the amplifier\'s grip on the driver. Sometimes what feels like a speed issue is actually a transient softness introduced upstream.',
  },
  pace: {
    interpretation: '"Pace" is about rhythmic drive — the sense that music pushes forward with momentum. It\'s related to timing but more about feel than measurement.',
    direction: 'Designs that preserve leading-edge energy without rounding tend to deliver this. NOS or minimum-phase filter DACs sometimes help, as do amplifiers with strong current delivery into the load.',
  },
  timing: {
    interpretation: 'Timing in audio describes how well a system preserves the rhythmic structure of music — whether beats land with conviction and whether subtle timing cues between instruments feel coherent.',
    direction: 'Timing behavior is shaped across the chain. Jitter in the digital source, filter choices in the DAC, and the amplifier\'s transient response all contribute. It\'s rarely one component.',
  },
  warmth: {
    interpretation: '"Warmth" typically means more energy in the lower midrange and upper bass — a fuller, richer tonal quality. Some listeners also use it to mean the absence of brightness.',
    direction: 'R2R DAC architectures and tube amplification both tend toward a denser harmonic presentation. Speaker placement also contributes — closer to walls adds bass warmth, further away reduces it.',
  },
  body: {
    interpretation: '"Body" is about the weight and substance of instruments — the sense that a cello has physical presence and a piano has mass behind each note.',
    direction: 'DACs with higher tonal density deliver this, along with amplifiers that maintain composure under load. Sometimes the source is the limiting factor — a thin-sounding DAC can strip away the sense of physical scale.',
  },
  richness: {
    interpretation: '"Richness" describes harmonic density — how many overtones and how much tonal color instruments seem to carry. A rich system makes a violin sound wooden and resonant, not just pitched.',
    direction: 'R2R conversion and tube output stages tend to present more harmonic information. The trade-off is that very rich-sounding systems can feel slower or less transparent.',
  },
  density: {
    interpretation: '"Density" is closely related to body and richness — it\'s the feeling that the sound has substance and mass, rather than feeling thin or lightweight.',
    direction: 'DAC architecture has a large influence here. R2R designs tend toward a denser presentation, while some delta-sigma implementations lean lighter. Amplifier topology matters too.',
  },
  detail: {
    interpretation: '"Detail" can mean two things: micro-detail retrieval (hearing every tiny element) or presence and articulation (instruments sounding clearly defined). The direction depends on which.',
    direction: 'If it\'s micro-detail, look at source resolution and noise floor. If it\'s presence, look at upper midrange energy. Sometimes "more detail" actually means less masking — reducing congestion elsewhere reveals what was always there.',
  },
  clarity: {
    interpretation: '"Clarity" is about transparency — the sense that nothing veils or smears the music. It\'s related to detail but more about the absence of interference.',
    direction: 'Reducing sources of distortion or jitter in the digital chain helps, as does power quality. Delta-sigma DACs with precise clocking tend to score well on measured transparency.',
  },
  resolution: {
    interpretation: '"Resolution" describes a system\'s ability to distinguish fine detail — the texture of a voice, the decay of a reverb tail, the difference between similar instruments.',
    direction: 'This is influenced across the chain, but DAC quality and noise floor set the ceiling. Higher-resolution components reveal more, though they also reveal recording flaws.',
  },
  dynamics: {
    interpretation: '"Dynamics" is about contrast — the difference between soft and loud, the impact of a sudden accent, the sense that music breathes and has physical weight.',
    direction: 'Amplifier headroom matters most for macro-dynamics. For micro-dynamics (subtle inflections in quiet passages), DAC and source quality are more important. Speaker sensitivity plays a role too.',
  },
  punch: {
    interpretation: '"Punch" is specifically about physical impact — kick drums hitting, bass notes landing with authority. It lives in the relationship between transient speed and bass energy.',
    direction: 'Amplifier damping and current output directly affect punch. Speaker design matters enormously — sealed vs ported. And the DAC contributes through transient fidelity: if leading edges are softened upstream, nothing downstream restores them.',
  },
  flow: {
    interpretation: '"Flow" is about musical continuity — notes connecting naturally, phrases breathing, music feeling like a coherent whole rather than a series of events.',
    direction: 'R2R and NOS DAC designs are often described as more flowing. Tube amplification tends to enhance continuity through its harmonic behavior. Reducing jitter can also help — timing irregularities break the sense of flow.',
  },
  smoothness: {
    interpretation: '"Smoothness" usually means the absence of grain, edge, or harshness — a relaxed quality where nothing sticks out uncomfortably.',
    direction: 'DACs with lower odd-order distortion tend to sound smoother. It\'s also worth checking whether a treble peak is adding perceived roughness, and whether power or cable quality is contributing a grainy overlay.',
  },
  engagement: {
    interpretation: '"Engagement" describes the quality that makes you want to keep listening — it\'s less about any single attribute and more about how the system connects you to the music emotionally.',
    direction: 'Engagement is hard to engineer directly because it emerges from a balance of factors — rhythmic drive, tonal naturalness, dynamic life, and low fatigue. Sometimes a system that measures worse is more engaging because it gets the balance right for that listener.',
  },
  soundstage: {
    interpretation: '"Soundstage" is the spatial presentation — how wide, deep, and three-dimensional the music feels around you.',
    direction: 'Speaker placement and room treatment have by far the largest impact. Electronics contribute, but subtly compared to physical setup. For headphone listeners, the choice between open-back and closed-back designs dominates.',
  },
  texture: {
    interpretation: '"Texture" is the tactile quality of instruments — rosin on a bow, the buzz of a string against a fret, breathiness in a voice. It\'s a form of micro-detail that contributes to realism.',
    direction: 'High-resolution, low-noise DACs tend to reveal more texture. R2R designs are sometimes praised for textural richness. Amplifier linearity at low levels matters — subtle cues can be masked by noise or crossover distortion.',
  },
  air: {
    interpretation: '"Air" is the sense of space and openness in the upper frequencies — the feeling that instruments exist in a real room with atmosphere around them.',
    direction: 'DACs with extended, clean treble without peaking contribute to air. So do open-back headphones and speakers with good high-frequency dispersion. Room treatment can help by reducing reflections that smear spatial cues.',
  },
  openness: {
    interpretation: '"Openness" describes a sense of spaciousness and lack of constriction — the feeling that the music isn\'t boxed in.',
    direction: 'This is shaped by speaker and room interaction as much as electronics. Open-back headphones are inherently more open-sounding. In speakers, dispersion pattern and crossover design contribute.',
  },
  naturalness: {
    interpretation: '"Naturalness" is about believable timbre — instruments and voices sounding like themselves, without electronic artifact or tonal editorialising. A natural-sounding system doesn\'t draw attention to its own character.',
    direction: 'Naturalness tends to emerge from low distortion without excessive analytical lean. R2R DACs and well-implemented tube stages are often cited, but it\'s more about the absence of artifice than a specific topology. Power quality and low-jitter clocking contribute by removing subtle grit that breaks the illusion.',
  },
  excitement: {
    interpretation: '"Excitement" describes a sense of vividness and forward momentum — the feeling that music is alive, urgent, and physically engaging. It\'s a compound of dynamic contrast, rhythmic energy, and presence-range forwardness.',
    direction: 'Exciting systems tend to have strong macro-dynamics, well-preserved transients, and a slight upper-midrange presence that brings vocalists and lead instruments forward. The risk is that excitement pushed too far becomes fatigue. The line between vivid and aggressive depends on the listener.',
  },
  aggression: {
    interpretation: '"Aggression" in audio describes an overly forward, hard-edged quality — excessive push in the upper midrange or treble that turns energy into harshness. A degree of forwardness can be exciting; too much becomes wearing.',
    direction: 'Aggression is usually a symptom rather than a design goal. It can come from bright-leaning DACs, amplifiers that harden under load, or speakers with a presence-region peak. Cables and power quality can modulate it at the margins. The fix depends on where in the chain the hardness originates.',
  },
  sparkle: {
    interpretation: '"Sparkle" is the liveliness in the upper treble — shimmer on cymbals, the ring of a triangle, the sense that high-frequency content has life and definition without becoming sharp.',
    direction: 'DACs with extended, clean treble and low phase distortion tend to produce sparkle. Silver interconnects can add a touch of upper-frequency energy. The trade-off: too much sparkle in a bright system risks tipping into glare.',
  },
  sweetness: {
    interpretation: '"Sweetness" describes a quality where the upper frequencies and midrange feel rounded, liquid, and pleasant — the opposite of grain or edge. It\'s often associated with a slight second-harmonic emphasis.',
    direction: 'Tube output stages are the classic source of sweetness. Some R2R DACs also produce it through their harmonic profile. The trade-off is that excessive sweetness can round off transient precision and veil micro-detail.',
  },
  energy: {
    interpretation: '"Energy" is about the sense of life and drive in the music — not just volume, but the feeling that the system has reserves and can deliver dynamic swings with conviction.',
    direction: 'Amplifier headroom and current delivery are the primary contributors. Speakers with higher sensitivity tend to feel more energetic at a given volume. DACs that preserve dynamic contrast without compression help maintain the sense of scale.',
  },
  musicality: {
    interpretation: '"Musicality" is the quality that makes a system feel coherent and emotionally connected — where technical performance serves the music rather than dissecting it. It\'s subjective and composite, but real.',
    direction: 'Musical systems tend to get rhythm, tonal weight, and harmonic richness right even if they sacrifice some measurable precision. The balance point is personal. Some listeners find musicality in flow and warmth; others in dynamic truthfulness and timing.',
  },
};

// ── Trait labels (human-readable) ────────────────────

const TRAIT_LABELS: Record<string, string> = {
  flow: 'musical flow',
  tonal_density: 'tonal weight',
  clarity: 'clarity',
  dynamics: 'dynamic energy',
  texture: 'textural detail',
  composure: 'composure',
  rhythm: 'rhythmic drive',
  spatial_precision: 'spatial precision',
  speed: 'transient speed',
  warmth: 'warmth',
  openness: 'openness',
  elasticity: 'elasticity',
};

// ── Character builders ───────────────────────────────

// ── Confidence-aware hedging ─────────────────────────

/**
 * Frame trait emphasis with language calibrated to confidence level.
 *
 * high:   "Listeners consistently describe this as emphasizing X."
 * medium: "This tends to lean toward X."
 */
function confidenceFrame(
  confidence: TendencyConfidence,
  traitList: string,
  verb: 'emphasize' | 'lean',
): string {
  if (confidence === 'high') {
    if (verb === 'emphasize') {
      return `Listeners consistently describe this as emphasizing ${traitList}.`;
    }
    return `Its character clearly leans toward ${traitList}.`;
  }
  // medium (low is gated out before reaching here)
  if (verb === 'emphasize') {
    return `This tends to lean toward ${traitList}.`;
  }
  return `This tends to lean toward ${traitList}, though implementation details matter.`;
}

/**
 * Frame trade-off language calibrated to confidence level.
 */
function confidenceTradeoffFrame(
  confidence: TendencyConfidence,
  gains: string,
  cost: string,
): string {
  if (confidence === 'high') {
    return `Its trade-off is well-understood: ${gains} at the cost of ${cost}.`;
  }
  return `The likely trade-off is ${gains} at the cost of ${cost}.`;
}

/**
 * Build a sonic character description for a product.
 *
 * Prefers structured tendencies when available and confidence is adequate.
 * Falls back to description + trait-label path otherwise.
 *
 * @param desireQualities - user's desire qualities, used to select relevant tendencies
 */
// ── Domain synthesis helpers ──────────────────────────
//
// Map tendencyProfile traits to the 5 core character domains so that
// profile-only and legacy products can produce domain-labeled output
// consistent with the curated tendency path.

/** Core domains ordered for display. */
const CORE_DOMAINS: readonly string[] = ['tonality', 'timing', 'spatial', 'dynamics', 'texture'];

/** Domain display labels. */
const DOMAIN_LABELS: Record<string, string> = {
  tonality: 'Tonality',
  timing: 'Timing',
  spatial: 'Spatial',
  dynamics: 'Dynamics',
  texture: 'Texture',
  clarity: 'Clarity',
  flow: 'Flow',
  bass: 'Bass',
  resolution: 'Resolution',
};

/** Map individual traits to the domain they best represent. */
const TRAIT_TO_DOMAIN: Record<string, string> = {
  warmth: 'tonality',
  tonal_density: 'tonality',
  clarity: 'tonality',
  speed: 'timing',
  elasticity: 'timing',
  flow: 'timing',
  rhythm: 'timing',
  spatial_precision: 'spatial',
  openness: 'spatial',
  dynamics: 'dynamics',
  composure: 'dynamics',
  texture: 'texture',
};

/** Describe a trait-level emphasis in natural language, keyed by trait name + level. */
const TRAIT_DOMAIN_DESCRIPTIONS: Record<string, Record<string, string>> = {
  tonality: {
    warmth_emphasized: 'warm and tonally rich — favors body and harmonic weight over analytical precision',
    warmth_present: 'slightly warm side of neutral — there is tonal weight without heaviness',
    warmth_less: 'lean and transparent — prioritizes clarity over tonal density',
    tonal_density_emphasized: 'dense and harmonically saturated — notes carry real weight and body',
    tonal_density_present: 'moderate tonal weight — present but not overly dense',
    tonal_density_less: 'lighter tonal character — favors speed and agility over density',
    clarity_emphasized: 'high clarity and transparency — detail is surfaced without editorial smoothing',
    clarity_present: 'good clarity — resolving without being analytical',
    clarity_less: 'softer focus — musical but not the most revealing',
  },
  timing: {
    speed_emphasized: 'fast and articulate — leading edges arrive with precision',
    speed_present: 'good transient speed — responsive without being aggressive',
    speed_less: 'relaxed timing — favors flow over attack',
    elasticity_emphasized: 'elastic and rhythmically alive — music breathes and bounces',
    elasticity_present: 'moderate rhythmic flexibility',
    flow_emphasized: 'strong musical flow — events connect seamlessly',
    flow_present: 'good continuity between musical events',
    flow_less: 'more analytical than flowing — events can feel discrete',
    rhythm_emphasized: 'strong rhythmic drive and pace',
    rhythm_present: 'good rhythmic engagement',
  },
  spatial: {
    spatial_precision_emphasized: 'precise imaging and well-defined soundstage — instruments are placed with specificity',
    spatial_precision_present: 'decent spatial presentation — reasonable depth and width',
    spatial_precision_less: 'less emphasis on imaging specificity — more about tone than space',
    openness_emphasized: 'open and expansive presentation — the soundstage breathes',
    openness_present: 'reasonable openness',
    openness_less: 'more intimate staging — focused rather than expansive',
  },
  dynamics: {
    dynamics_emphasized: 'dynamic and punchy — contrast between loud and soft is well preserved',
    dynamics_present: 'decent dynamic range',
    dynamics_less: 'more even and composed than dynamically explosive',
    composure_emphasized: 'very composed and controlled — stays calm under pressure',
    composure_present: 'good composure',
    composure_less: 'can become slightly unsettled with demanding material',
  },
  texture: {
    texture_emphasized: 'rich textural detail — surfaces and timbres are tangible',
    texture_present: 'moderate textural information',
    texture_less: 'smoother rendering — less surface detail but easier long-term listening',
  },
};

/**
 * Synthesize domain descriptions from a tendencyProfile.
 * Returns domain-labeled lines for domains where we have signal.
 */
function synthesizeDomainLines(product: Product): string[] {
  const lines: string[] = [];
  const profile = product.tendencyProfile;
  const traits = product.traits;

  if (profile && hasExplainableProfile(profile)) {
    // Group profile traits by domain
    const domainTraits = new Map<string, { trait: string; level: string }[]>();
    for (const t of profile.tendencies) {
      const domain = TRAIT_TO_DOMAIN[t.trait];
      if (domain) {
        if (!domainTraits.has(domain)) domainTraits.set(domain, []);
        domainTraits.get(domain)!.push({ trait: t.trait, level: t.level });
      }
    }

    // Build lines for each domain that has data
    for (const domain of CORE_DOMAINS) {
      const domTraits = domainTraits.get(domain);
      if (!domTraits || domTraits.length === 0) continue;

      // Pick the most prominent trait in this domain (emphasized > present > less_emphasized)
      const sorted = [...domTraits].sort((a, b) => {
        const order: Record<string, number> = { emphasized: 0, present: 1, less_emphasized: 2 };
        return (order[a.level] ?? 9) - (order[b.level] ?? 9);
      });
      const best = sorted[0];
      const key = `${best.trait}_${best.level === 'less_emphasized' ? 'less' : best.level}`;
      const desc = TRAIT_DOMAIN_DESCRIPTIONS[domain]?.[key];
      if (desc) {
        lines.push(`${DOMAIN_LABELS[domain]}: ${desc}.`);
      }
    }
    return lines;
  }

  // Fall back to numeric traits — synthesize from values >= 0.7 or <= 0.3
  const domainHits = new Map<string, string[]>();
  for (const [trait, value] of Object.entries(traits)) {
    const domain = TRAIT_TO_DOMAIN[trait];
    if (!domain) continue;
    const level = value >= 0.7 ? 'emphasized' : value <= 0.3 ? 'less' : 'present';
    if (level === 'present') continue; // Only surface notable traits
    const key = `${trait}_${level}`;
    const desc = TRAIT_DOMAIN_DESCRIPTIONS[domain]?.[key];
    if (desc) {
      if (!domainHits.has(domain)) domainHits.set(domain, []);
      domainHits.get(domain)!.push(desc);
    }
  }

  for (const domain of CORE_DOMAINS) {
    const descs = domainHits.get(domain);
    if (descs && descs.length > 0) {
      lines.push(`${DOMAIN_LABELS[domain]}: ${descs[0]}.`);
    }
  }

  return lines;
}

/**
 * Build a sonic character description for a product.
 *
 * Unified template: always produces domain-labeled sections where data exists.
 * The template contracts gracefully when less data is available.
 *
 *   Full tendencies   → verbatim curated domain lines + interactions
 *   Profile only      → synthesized domain lines from trait emphasis
 *   Legacy            → synthesized domain lines from numeric traits
 *
 * @param desireQualities - user's desire qualities, used to prioritize relevant domains
 */
function productCharacter(product: Product, desireQualities: string[] = []): string {
  const parts: string[] = [`${product.architecture} design.`];

  // ── Curated tendency path (highest quality) ─────────
  if (hasTendencies(product.tendencies)) {
    // Show ALL character domains (not just top 2), prioritized by desire relevance
    const tendencies = desireQualities.length > 0
      ? selectCharacterTendencies(product.tendencies.character, desireQualities, product.tendencies.character.length)
      : product.tendencies.character;

    for (const t of tendencies) {
      const label = DOMAIN_LABELS[t.domain] ?? (t.domain.charAt(0).toUpperCase() + t.domain.slice(1));
      const text = t.tendency.charAt(0).toUpperCase() + t.tendency.slice(1);
      parts.push(t.context ? `${label}: ${text} — ${t.context}.` : `${label}: ${text}.`);
    }
  } else {
    // ── Synthesized domain lines (profile or legacy) ──
    const domainLines = synthesizeDomainLines(product);
    if (domainLines.length > 0) {
      parts.push(...domainLines);
    } else {
      // Absolute fallback: use product description
      parts.push(product.description);
    }
  }

  const risks = buildRiskNotes(product);
  if (risks) parts.push(risks);

  return parts.join(' ');
}

/**
 * Compact product character for comparisons — 2-3 traits in 1-2 sentences.
 * No domain labels, no risk notes. Just the sonic signature.
 */
function productCharacterCompact(product: Product): string {
  if (hasTendencies(product.tendencies)) {
    // Take top 2-3 character domains, no labels
    const chars = product.tendencies.character.slice(0, 3);
    const traits = chars.map((t) => t.tendency).join(', ');
    // Add one system note if available
    const positive = product.tendencies.interactions?.find((i) => i.valence === 'positive');
    const sysNote = positive ? ` Works well ${positive.condition}.` : '';
    return `${traits}.${sysNote}`;
  }
  // Fallback: first sentence of description
  const firstSentence = product.description.split(/\.\s/)[0];
  return firstSentence.endsWith('.') ? firstSentence : `${firstSentence}.`;
}

/** Shared risk note builder using tendencyProfile when available. */
function buildRiskNotes(product: Product): string | undefined {
  const risks: string[] = [];
  if (hasRisk(product.tendencyProfile, product.traits, 'fatigue_risk')) {
    risks.push('some listening fatigue risk in bright systems');
  }
  if (hasRisk(product.tendencyProfile, product.traits, 'glare_risk')) {
    risks.push('a touch of upper-frequency edge');
  }
  return risks.length > 0 ? `Worth noting: ${risks.join('; ')}.` : undefined;
}

function brandCharacter(brandName: string): string {
  return `This specific model isn't in the validated catalog yet, but ${brandName} has a recognizable design approach. I can reason about it from the brand's general tendencies — how it sounds in practice will depend on what it's paired with and what you prioritize as a listener.`;
}

// ── Follow-up questions ──────────────────────────────

// ── Clarification pools ──────────────────────────────
//
// Two pools: one for when NO active system exists (asks about system
// context), and one for when an active system IS loaded (asks about
// preferences and priorities only — never about system components).

const CLARIFICATIONS_NO_SYSTEM = [
  'What does the rest of your system look like? That would help narrow down where the shift is most likely to come from.',
  'What kind of system would it be going into, and what do you value most in your listening?',
  'What system would these be going into? The pairing often determines which design philosophy wins.',
  'What are you pairing it with? The rest of the chain shapes the experience more than any single component.',
  'Is this about a specific system? Knowing what you\'re pairing with would help me gauge direction.',
];

const CLARIFICATIONS_WITH_SYSTEM = [
  'What quality are you hoping this change would bring to your listening?',
  'What matters most to you — engagement and rhythm, or refinement and tonal beauty?',
  'Is there something about your current setup you\'re hoping to shift?',
  'Are you open to changes elsewhere in the chain, or is the source the piece you want to move on?',
  'Are you exploring options, or working toward a specific quality?',
];

function pick(options: string[], seed: number): string {
  return options[seed % options.length];
}

/**
 * Unified clarification builder.
 *
 * Rules:
 *   1. No active system → ask about the system.
 *   2. Active system exists → ask about preferences, never system components.
 *   3. If churn is detected and no desires expressed → use the churn
 *      reflective question (which is always preference-oriented).
 *   4. The caller may pass `omitIfClear: true` to allow returning
 *      undefined when the query already specifies the change clearly.
 */
function buildClarification(opts: {
  activeSystem: ActiveSystemContext | null | undefined;
  seed: number;
  churn?: ChurnSignal;
  hasDesires?: boolean;
  omitIfClear?: boolean;
}): string | undefined {
  // Rule 4: caller signals the query is self-contained
  if (opts.omitIfClear) return undefined;

  // Rule 3: churn reflective question takes priority
  if (opts.churn?.detected && opts.churn.reflectiveQuestion && !opts.hasDesires) {
    return opts.churn.reflectiveQuestion;
  }

  // Rule 1 vs 2: pick from the appropriate pool
  const pool = opts.activeSystem
    ? CLARIFICATIONS_WITH_SYSTEM
    : CLARIFICATIONS_NO_SYSTEM;

  return pick(pool, opts.seed);
}

// ── "What I'm hearing" block ─────────────────────────

/**
 * Plain-language labels for archetype tendencies — avoids exposing
 * internal identifiers like "tonal_saturated" directly.
 */
const ARCHETYPE_PLAIN: Record<string, string> = {
  flow_organic: 'musical flow and natural ease',
  precision_explicit: 'precision and explicit detail',
  rhythmic_propulsive: 'rhythmic drive and energy',
  tonal_saturated: 'tonal richness and harmonic weight',
  spatial_holographic: 'spatial depth and imaging',
};

function buildHearingBlock(
  intent: UserIntent,
  desires: DesireSignal[],
  products: Product[],
  sysDir: SystemDirection,
  tasteProfile?: TasteProfile,
): string[] {
  const bullets: string[] = [];

  // 1. Desire-based bullets — what the user wants more/less of
  if (desires.length > 0) {
    const primary = desires[0];
    const secondary = desires[1];

    // Translate primary desire into a preference statement
    const desireLabel = TRAIT_LABELS[primary.quality] ?? primary.quality;
    if (primary.direction === 'more') {
      if (secondary) {
        const secLabel = TRAIT_LABELS[secondary.quality] ?? secondary.quality;
        if (secondary.direction === 'more') {
          bullets.push(`Based on your inputs, the direction points toward more ${desireLabel} and ${secLabel}`);
        } else {
          bullets.push(`Based on your inputs, the direction favors ${desireLabel} over ${secLabel}`);
        }
      } else {
        bullets.push(`Based on your inputs, the direction points toward more ${desireLabel} from the system`);
      }
    } else {
      bullets.push(`Based on your inputs, the direction points toward less ${desireLabel} — pulling back there`);
    }
  }

  // 2. Current system tendency — what the user's system likely emphasizes
  if (products.length > 0 && products[0]) {
    const product = products[0];
    const tags = tagProductArchetype(product);
    const plainLabel = ARCHETYPE_PLAIN[tags.primary] ?? getArchetypeShortLabel(tags.primary);
    if (desires.length > 0) {
      // User has the product and wants a change — reflect what they already have
      bullets.push(`Your ${product.brand} ${product.name} leans toward ${plainLabel}`);
    }
  }

  // 3. System direction — inferred tendency of the current system
  if (sysDir.currentTendencies.length > 0 && bullets.length < 3) {
    const tendencyLabels = sysDir.currentTendencies
      .slice(0, 2)
      .map((t) => t.replace(/_/g, ' '));
    if (tendencyLabels.length > 0) {
      bullets.push(`Your current system may already lean toward ${tendencyLabels.join(' and ')}`);
    }
  }

  // 4. Directional inference — what they're moving toward
  if (sysDir.desiredDirections.length > 0 && bullets.length < 3) {
    const dir = sysDir.desiredDirections[0];
    const qualityLabel = TRAIT_LABELS[dir.quality] ?? dir.quality.replace(/_/g, ' ');
    const dirPhrase = dir.direction === 'up' ? `more ${qualityLabel}` : `less ${qualityLabel}`;
    bullets.push(`The direction you're describing points toward ${dirPhrase}`);
  }

  // 5. Nature of the change — refinement vs philosophical shift
  if (desires.length > 0 && products.length > 0 && bullets.length < 4) {
    const product = products[0];
    const tags = tagProductArchetype(product);
    const userPref = sysDir.inferredArchetype;
    if (userPref && tags.primary !== userPref.primary && tags.primary !== userPref.secondary) {
      bullets.push('That\'s a philosophical shift, not just a refinement — worth being deliberate about');
    } else if (userPref && (tags.primary === userPref.primary || tags.primary === userPref.secondary)) {
      bullets.push('That\'s a refinement within your current direction, not a philosophical change');
    }
  }

  // 6. Comparison context — what the comparison is really about
  if (intent === 'comparison' && products.length >= 2) {
    const a = products[0];
    const b = products[1];
    const tagsA = tagProductArchetype(a);
    const tagsB = tagProductArchetype(b);
    if (tagsA.primary !== tagsB.primary) {
      const labelA = ARCHETYPE_PLAIN[tagsA.primary] ?? getArchetypeShortLabel(tagsA.primary);
      const labelB = ARCHETYPE_PLAIN[tagsB.primary] ?? getArchetypeShortLabel(tagsB.primary);
      bullets.push(`This is a comparison between ${labelA} and ${labelB} — different design philosophies`);
    } else {
      bullets.push(`Both share a similar design philosophy — the differences are in degree, not direction`);
    }
  }

  // 7. Taste profile background — only if desires don't already cover it
  if (tasteProfile && tasteProfile.confidence > 0.2 && desires.length === 0) {
    const top = topTraits(tasteProfile, 3);
    if (top.length > 0) {
      const traitLabels = top.map((t) => t.label.toLowerCase());
      bullets.push(`Your profile suggests you tend toward ${traitLabels.join(' and ')}`);
    }
  }

  // Cap at 4 bullets
  return bullets.slice(0, 4);
}

// ── System context for comparisons ───────────────────

/**
 * Build a note about how a product comparison relates to the user's
 * active system. Returns null when no system is selected.
 */
function buildSystemComparisonNote(
  a: Product,
  b: Product,
  activeSystem: ActiveSystemContext | null | undefined,
): string | null {
  if (!activeSystem || activeSystem.components.length === 0) return null;

  const componentNames = activeSystem.components
    .map((c) => `${c.brand} ${c.name}`)
    .join(', ');

  // Identify which product is the "current" (in the system) and which is the "candidate"
  const aInSystem = activeSystem.components.some(
    (c) => c.name.toLowerCase() === a.name.toLowerCase()
      || `${c.brand} ${c.name}`.toLowerCase() === `${a.brand} ${a.name}`.toLowerCase(),
  );
  const bInSystem = activeSystem.components.some(
    (c) => c.name.toLowerCase() === b.name.toLowerCase()
      || `${c.brand} ${c.name}`.toLowerCase() === `${b.brand} ${b.name}`.toLowerCase(),
  );

  if (aInSystem && !bInSystem) {
    return `Your current system includes the ${a.brand} ${a.name} (alongside ${componentNames}). The question is what the ${b.brand} ${b.name} would change in that context — not just how the two compare in isolation.`;
  }
  if (bInSystem && !aInSystem) {
    return `Your current system includes the ${b.brand} ${b.name} (alongside ${componentNames}). The question is what the ${a.brand} ${a.name} would change in that context — not just how the two compare in isolation.`;
  }

  // Neither is in system — still note the system context
  return `Your current system (${componentNames}) provides context for this comparison. How either product interacts with the rest of the chain would likely matter more than how they compare in isolation.`;
}

// ── Third-product scrubbing ──────────────────────────
//
// Upgrade comparisons must only reference the two products involved
// and the system context.  Product data (tendencies, interactions,
// tradeoffs) sometimes mentions sibling products (e.g. "Qutest",
// "Pontus").  This helper strips those references so the output
// stays focused on A, B, and the listener's chain.

/**
 * Build a set of product-name tokens that are allowed in the output.
 * Everything else found in ALL_PRODUCTS is a "third product".
 */
function buildAllowedNames(
  from: Product,
  to: Product,
  activeSystem: ActiveSystemContext | null | undefined,
): Set<string> {
  const allowed = new Set<string>();
  // Add both comparison products (lower-cased for matching)
  for (const p of [from, to]) {
    allowed.add(p.name.toLowerCase());
    allowed.add(`${p.brand} ${p.name}`.toLowerCase());
  }
  // Add system components
  if (activeSystem) {
    for (const c of activeSystem.components) {
      allowed.add(c.name.toLowerCase());
      allowed.add(`${c.brand} ${c.name}`.toLowerCase());
    }
  }
  return allowed;
}

/**
 * Build regex patterns that match third-product names (brand + name, or
 * standalone name) from the full product catalog, excluding allowed names.
 */
function buildThirdProductPatterns(allowed: Set<string>): RegExp[] {
  const patterns: RegExp[] = [];
  for (const product of ALL_PRODUCTS) {
    const fullName = `${product.brand} ${product.name}`.toLowerCase();
    const shortName = product.name.toLowerCase();

    // Skip if this product is in the allowed set
    if (allowed.has(fullName) || allowed.has(shortName)) continue;

    // Match "Brand Name" as a unit first, then standalone "Name"
    // Word boundaries prevent partial matches (e.g. "Hugo" inside "Hugo TT2")
    // but we need care: short names like "W5" should still match.
    patterns.push(new RegExp(`\\b${escapeRegex(product.brand)}\\s+${escapeRegex(product.name)}\\b`, 'gi'));
    // Only add standalone name pattern if the name is specific enough
    // (>= 3 chars and not a common English word)
    if (product.name.length >= 3) {
      patterns.push(new RegExp(`\\b${escapeRegex(product.name)}\\b`, 'gi'));
    }
  }
  return patterns;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove third-product references from a text string.
 *
 * Strategy:
 * - Phrases like "like the Qutest" / "such as the Pontus" / "or Qutest"
 *   are removed entirely (the connective + article + name).
 * - Enumeration fragments like "Qutest and Hugo" where one is allowed
 *   collapse to just the allowed name.
 * - Bare product names that survive are replaced with "other models in
 *   the lineup" (same-brand) or removed.
 */
function scrubThirdProductRefs(
  text: string,
  allowed: Set<string>,
  sameBrand: boolean,
): string {
  const patterns = buildThirdProductPatterns(allowed);
  let result = text;

  for (const pat of patterns) {
    // Phase 1: Remove connective phrases that introduce the third product.
    // Patterns like:  "like the Qutest", "such as Qutest", "or Qutest",
    //   "and Qutest", "over Qutest", "than Qutest", "the Qutest and"
    // We also handle "compared to Qutest or Hugo" → scrub the third name only.
    const nameSource = pat.source; // e.g. \bQutest\b
    const flags = 'gi';

    // "over <Name>" / "than <Name>" / "like <Name>" with optional article
    result = result.replace(
      new RegExp(`\\b(?:over|than|like|versus)\\s+(?:the\\s+)?${nameSource}`, flags),
      sameBrand ? 'over other models in the lineup' : '',
    );

    // "such as <Name>" / "such as the <Name>"
    result = result.replace(
      new RegExp(`\\bsuch\\s+as\\s+(?:the\\s+)?${nameSource}`, flags),
      '',
    );

    // "<Name> or " / "or <Name>" / "<Name> and " / "and <Name>"
    // with optional articles — remove the conjunction + name fragment
    result = result.replace(
      new RegExp(`(?:,?\\s*(?:and|or)\\s+(?:the\\s+)?${nameSource})`, flags),
      '',
    );
    result = result.replace(
      new RegExp(`(?:${nameSource}\\s*(?:,\\s*)?(?:and|or)\\s+(?:the\\s+)?)`, flags),
      '',
    );

    // Bare name — last resort
    result = result.replace(pat, sameBrand ? 'other models in the lineup' : '');
  }

  // Clean up double spaces and orphaned punctuation
  result = result.replace(/\s{2,}/g, ' ');
  result = result.replace(/\(\s*\)/g, '');
  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/\s+([.,;])/g, '$1');
  result = result.trim();

  return result;
}

// ── Upgrade intent detection ─────────────────────────

const UPGRADE_LANGUAGE_RE = [
  /\bupgrade\b/i,
  /\breplace\b/i,
  /\bswap\b/i,
  /\bchange\s+(?:from|my)\b/i,
  /\bmove\s+(?:from|up\b)/i,
  /\bstep\s+up\b/i,
  /\bwhat\s+would\b.*\b(?:change|differ|shift|improve)\b/i,
];

function isUpgradeComparison(message: string, a: Product, b: Product): boolean {
  // Upgrade if the query uses upgrade language, or if both products share
  // the same brand AND the same architecture (lineage upgrade).
  const hasUpgradeLanguage = UPGRADE_LANGUAGE_RE.some((p) => p.test(message));
  const sameLineage = a.brand === b.brand && a.architecture === b.architecture;
  return hasUpgradeLanguage || sameLineage;
}

// ── Upgrade comparison builder ───────────────────────
//
// Produces the four-element upgrade reasoning structure:
//   1. Architecture lineage — what design they share
//   2. What remains similar — shared traits (confident language)
//   3. What changes — trait deltas and tendency shifts (analytical language)
//   4. System interaction — how the change would affect the chain (conditional language)

function buildUpgradeAnchor(
  from: Product,
  to: Product,
  activeSystem: ActiveSystemContext | null | undefined,
): string {
  // 1. Architecture lineage — confident, factual.
  // Use short names after the first reference to avoid repetitive full names.
  // Vary the opening so it doesn't always start with "Both…"

  if (from.brand === to.brand) {
    // Same-brand lineage — lead with the shared architecture, then pivot to context.
    const sharedArch = `The ${from.name} and ${to.name} share ${from.brand}'s ${from.architecture} architecture.`;

    if (activeSystem && activeSystem.components.length > 0) {
      const otherComponents = activeSystem.components
        .filter((c) => c.name.toLowerCase() !== from.name.toLowerCase()
          && c.name.toLowerCase() !== to.name.toLowerCase())
        .map((c) => `${c.brand} ${c.name}`);
      if (otherComponents.length > 0) {
        return `${sharedArch} Within your system — ${otherComponents.join(', ')} — the question is what that step up actually changes.`;
      }
    }

    return `${sharedArch} This is a question of scale and refinement within that design philosophy, not a change in direction.`;
  }

  // Different-brand / different-architecture comparison
  const crossArch = `The ${from.brand} ${from.name} is built on ${from.architecture}, while the ${to.brand} ${to.name} uses ${to.architecture} — these are different design lineages.`;

  if (activeSystem && activeSystem.components.length > 0) {
    const otherComponents = activeSystem.components
      .filter((c) => c.name.toLowerCase() !== from.name.toLowerCase()
        && c.name.toLowerCase() !== to.name.toLowerCase())
      .map((c) => `${c.brand} ${c.name}`);
    if (otherComponents.length > 0) {
      return `${crossArch} Within your system — ${otherComponents.join(', ')} — the question is how each philosophy interacts with the rest of the chain.`;
    }
  }

  return crossArch;
}

function buildUpgradeCharacter(
  from: Product,
  to: Product,
  allowed: Set<string>,
): string {
  const parts: string[] = [];
  const sameBrand = from.brand === to.brand;
  const scrub = (t: string) => scrubThirdProductRefs(t, allowed, sameBrand);

  // 2. What remains similar — shared tendencies (confident language)
  // 3. What changes — tendency shifts (analytical language)
  //
  // Voice rules: avoid "Both… Both…" openings, use short names after first
  // mention, lead with insight rather than mechanical enumeration.

  if (hasTendencies(from.tendencies) && hasTendencies(to.tendencies)) {
    const fromDomains = new Map(from.tendencies.character.map((t) => [t.domain, t.tendency]));
    const toDomains = new Map(to.tendencies.character.map((t) => [t.domain, t.tendency]));

    const sharedQualities: string[] = [];
    const changedQualities: { domain: string; from: string; to: string }[] = [];

    for (const [domain, fromTend] of fromDomains) {
      const toTend = toDomains.get(domain);
      if (!toTend) continue;
      const fromWords = new Set(fromTend.toLowerCase().split(/\s+/));
      const toWords = new Set(toTend.toLowerCase().split(/\s+/));
      const overlap = [...fromWords].filter((w) => toWords.has(w) && w.length > 4).length;
      if (overlap >= 2) {
        sharedQualities.push(domain);
      } else {
        changedQualities.push({ domain, from: fromTend, to: toTend });
      }
    }

    // Shared qualities — confident, varied phrasing
    if (sharedQualities.length > 0) {
      const domains = sharedQualities.join(' and ');
      if (sameBrand) {
        parts.push(`The core ${from.brand} character carries through in ${domains} — that continuity is the design intent.`);
      } else {
        parts.push(`They share common ground in ${domains}, despite the different architectures.`);
      }
    }

    // Changed qualities — analytical, scrubbed, using short names
    // Use "the <shortName>" after first mention rather than repeating full product names.
    if (changedQualities.length > 0) {
      for (const cq of changedQualities.slice(0, 2)) {
        parts.push(`Where they diverge is ${cq.domain}: the ${from.name} leans toward ${scrub(cq.from)}, while the ${to.name} tends toward ${scrub(cq.to)}.`);
      }
    }
  }

  // Trait-level deltas — confident language for measurable shifts
  const traitChanges: string[] = [];
  const keyTraits = ['composure', 'tonal_density', 'dynamics', 'clarity', 'flow', 'texture', 'elasticity'] as const;

  for (const trait of keyTraits) {
    const fromVal = resolveTraitValue(from.tendencyProfile, from.traits, trait);
    const toVal = resolveTraitValue(to.tendencyProfile, to.traits, trait);
    const diff = toVal - fromVal;
    // Use 0.29 threshold to account for floating-point arithmetic
    // (e.g. 0.7 - 0.4 = 0.29999... which fails >= 0.3)
    if (diff >= 0.29) {
      const label = TRAIT_LABELS[trait] ?? trait.replace(/_/g, ' ');
      traitChanges.push(`more ${label}`);
    } else if (diff <= -0.29) {
      const label = TRAIT_LABELS[trait] ?? trait.replace(/_/g, ' ');
      traitChanges.push(`less ${label}`);
    }
  }

  if (traitChanges.length > 0 && parts.length < 3) {
    parts.push(`In concrete terms, the ${to.name} brings ${traitChanges.join(', ')} relative to the ${from.name}.`);
  }

  // Trade-off — split gains and costs into separate clauses for clarity
  if (hasTendencies(to.tendencies) && to.tendencies.tradeoffs.length > 0) {
    const tradeoff = to.tendencies.tradeoffs[0];
    const gains = scrub(tradeoff.gains);
    const cost = scrub(tradeoff.cost);
    parts.push(`What you gain is ${gains}. The cost is ${cost}.`);
  }

  return parts.join(' ');
}

function buildUpgradeDirection(
  from: Product,
  to: Product,
  activeSystem: ActiveSystemContext | null | undefined,
  allowed: Set<string>,
): string {
  const parts: string[] = [];
  const sameBrand = from.brand === to.brand;
  const scrub = (t: string) => scrubThirdProductRefs(t, allowed, sameBrand);

  // 4. System interaction — conditional language (upgrade predictions).
  // Voice rules: use short names, lead with system context, avoid
  // repeating "The Hugo TT2" as a sentence opener.

  if (hasTendencies(to.tendencies)) {
    const systemInteractions = to.tendencies.interactions;

    // Same-lineup interaction — scrub and rephrase for system context
    const lineupInteraction = systemInteractions.find((i) =>
      i.condition.toLowerCase().includes(from.name.toLowerCase())
      || i.condition.toLowerCase().includes('same system')
      || i.condition.toLowerCase().includes('compared to'),
    );
    if (lineupInteraction) {
      parts.push(`In your system, ${scrub(lineupInteraction.effect)}.`);
    }

    // Chain interaction — infer from trait deltas, use conditional language
    if (activeSystem && activeSystem.components.length > 0) {
      const ampComponent = activeSystem.components.find((c) =>
        c.category === 'amplifier' || c.category === 'integrated',
      );
      const speakerComponent = activeSystem.components.find((c) =>
        c.category === 'speaker',
      );

      if (ampComponent || speakerComponent) {
        const chainParts: string[] = [];
        if (ampComponent) chainParts.push(`${ampComponent.brand} ${ampComponent.name}`);
        if (speakerComponent) chainParts.push(`${speakerComponent.brand} ${speakerComponent.name}`);
        const chainDesc = chainParts.join(' and ');

        const composureGain = resolveTraitValue(to.tendencyProfile, to.traits, 'composure')
          - resolveTraitValue(from.tendencyProfile, from.traits, 'composure');
        const densityGain = resolveTraitValue(to.tendencyProfile, to.traits, 'tonal_density')
          - resolveTraitValue(from.tendencyProfile, from.traits, 'tonal_density');

        // Combine composure and density into a single chain-effect sentence
        // when both are present, rather than repeating the chain description.
        if (composureGain >= 0.29 && densityGain >= 0.29) {
          parts.push(`Feeding the ${chainDesc}, the added composure and tonal density would likely produce a more effortless, harmonically fuller presentation — the source becomes less of a limiting factor.`);
        } else if (composureGain >= 0.29) {
          parts.push(`Downstream, the ${chainDesc} would likely benefit from the added composure — less strain on dynamic peaks, a more effortless overall presentation.`);
        } else if (densityGain >= 0.29) {
          parts.push(`The added tonal density would likely give the ${chainDesc} more midrange authority, shifting the overall balance toward greater body.`);
        }
      }
    }
  }

  // Price proportionality — conditional, concise
  if (from.price > 0 && to.price > 0) {
    const ratio = to.price / from.price;
    if (ratio > 3) {
      parts.push(`At ${ratio.toFixed(1)}x the price, this is a refinement within the same architecture — real gains, but incremental rather than transformational.`);
    } else if (ratio > 1.8) {
      parts.push(`The price step is meaningful. Whether the gains justify it depends on how close the ${from.name} is to its ceiling in your system.`);
    }
  }

  if (parts.length === 0) {
    return `The ${to.name} would likely deliver more of what the ${from.name} already does well, with greater authority and composure. Whether your system reveals that difference depends on the resolving power downstream.`;
  }

  return parts.join(' ');
}

// ── Structured upgrade analysis (9-section consulting format) ──

/**
 * Build the structured 9-section upgrade analysis.
 *
 * This extracts the same underlying data as buildUpgradeAnchor/Character/Direction
 * but organises it into discrete, labelled sections for the advisory renderer.
 * The reasoning pipeline is unchanged — only how the output is arranged.
 */
function buildUpgradeAnalysis(
  from: Product,
  to: Product,
  activeSystem: ActiveSystemContext | null | undefined,
  allowed: Set<string>,
): UpgradeAnalysis {
  const sameBrand = from.brand === to.brand;
  const scrub = (t: string) => scrubThirdProductRefs(t, allowed, sameBrand);

  // ── 1. SYSTEM CHARACTER ──────────────────────────────
  let systemCharacter: string;
  if (sameBrand) {
    systemCharacter = `The ${from.name} and ${to.name} share ${from.brand}'s ${from.architecture} architecture.`;
    if (activeSystem && activeSystem.components.length > 0) {
      const others = activeSystem.components
        .filter((c) => c.name.toLowerCase() !== from.name.toLowerCase()
          && c.name.toLowerCase() !== to.name.toLowerCase())
        .map((c) => `${c.brand} ${c.name}`);
      if (others.length > 0) {
        systemCharacter += ` Within your system — ${others.join(', ')} — this is a question of scale and refinement within that design philosophy.`;
      } else {
        systemCharacter += ` This is a question of scale and refinement within that design philosophy, not a change in direction.`;
      }
    } else {
      systemCharacter += ` This is a question of scale and refinement within that design philosophy, not a change in direction.`;
    }
  } else {
    systemCharacter = `The ${from.brand} ${from.name} is built on ${from.architecture}, while the ${to.brand} ${to.name} uses ${to.architecture} — these are different design lineages.`;
    if (activeSystem && activeSystem.components.length > 0) {
      const others = activeSystem.components
        .filter((c) => c.name.toLowerCase() !== from.name.toLowerCase()
          && c.name.toLowerCase() !== to.name.toLowerCase())
        .map((c) => `${c.brand} ${c.name}`);
      if (others.length > 0) {
        systemCharacter += ` Within your system — ${others.join(', ')} — the question is how each philosophy interacts with the rest of the chain.`;
      }
    }
  }

  // ── Shared data extraction ───────────────────────────
  const sharedQualities: string[] = [];
  const changedQualities: { domain: string; from: string; to: string }[] = [];

  if (hasTendencies(from.tendencies) && hasTendencies(to.tendencies)) {
    const fromDomains = new Map(from.tendencies.character.map((t) => [t.domain, t.tendency]));
    const toDomains = new Map(to.tendencies.character.map((t) => [t.domain, t.tendency]));

    for (const [domain, fromTend] of fromDomains) {
      const toTend = toDomains.get(domain);
      if (!toTend) continue;
      const fromWords = new Set(fromTend.toLowerCase().split(/\s+/));
      const toWords = new Set(toTend.toLowerCase().split(/\s+/));
      const overlap = [...fromWords].filter((w) => toWords.has(w) && w.length > 4).length;
      if (overlap >= 2) {
        sharedQualities.push(domain);
      } else {
        changedQualities.push({ domain, from: fromTend, to: toTend });
      }
    }
  }

  // ── Trait-level deltas ───────────────────────────────
  const keyTraits = ['composure', 'tonal_density', 'dynamics', 'clarity', 'flow', 'texture', 'elasticity'] as const;
  const positiveDeltas: { trait: string; label: string; diff: number }[] = [];
  const negativeDeltas: { trait: string; label: string; diff: number }[] = [];

  for (const trait of keyTraits) {
    const fromVal = resolveTraitValue(from.tendencyProfile, from.traits, trait);
    const toVal = resolveTraitValue(to.tendencyProfile, to.traits, trait);
    const diff = toVal - fromVal;
    const label = TRAIT_LABELS[trait] ?? trait.replace(/_/g, ' ');
    if (diff >= 0.29) {
      positiveDeltas.push({ trait, label, diff });
    } else if (diff <= -0.29) {
      negativeDeltas.push({ trait, label, diff });
    }
  }

  // ── From product strengths (traits >= 0.65) ──────────
  const fromStrengths: { trait: string; label: string; value: number }[] = [];
  for (const trait of keyTraits) {
    const val = resolveTraitValue(from.tendencyProfile, from.traits, trait);
    const label = TRAIT_LABELS[trait] ?? trait.replace(/_/g, ' ');
    if (val >= 0.65) {
      fromStrengths.push({ trait, label, value: val });
    }
  }

  // ── 2. WHAT IS WORKING WELL ──────────────────────────
  const workingWell: string[] = [];

  if (sharedQualities.length > 0 && sameBrand) {
    workingWell.push(`Core ${from.brand} character in ${sharedQualities.join(' and ')} — that continuity is the design intent`);
  } else if (sharedQualities.length > 0) {
    workingWell.push(`Common ground in ${sharedQualities.join(' and ')}, despite different architectures`);
  }
  for (const s of fromStrengths.slice(0, 3)) {
    workingWell.push(`Strong ${s.label} from the ${from.name}`);
  }
  if (hasTendencies(from.tendencies) && from.tendencies.tradeoffs.length > 0) {
    const gains = scrub(from.tendencies.tradeoffs[0].gains);
    if (gains) workingWell.push(gains);
  }

  // ── 3. WHERE LIMITATIONS MAY APPEAR ──────────────────
  const limitations: string[] = [];

  for (const nd of negativeDeltas) {
    // If the 'to' product has less of something, the 'from' already has it — skip
    // Focus on traits where 'from' is weaker (positive deltas mean 'to' gains)
  }
  // Traits where 'from' is below 0.45 (noticeably weak)
  for (const trait of keyTraits) {
    const val = resolveTraitValue(from.tendencyProfile, from.traits, trait);
    const label = TRAIT_LABELS[trait] ?? trait.replace(/_/g, ' ');
    if (val < 0.45 && val > 0) {
      limitations.push(`The ${from.name} has limited ${label} — this may show up in demanding material`);
    }
  }
  if (hasTendencies(from.tendencies) && from.tendencies.tradeoffs.length > 0) {
    const cost = scrub(from.tendencies.tradeoffs[0].cost);
    if (cost) limitations.push(cost);
  }
  // Changed qualities as limitation framing
  for (const cq of changedQualities.slice(0, 2)) {
    if (limitations.length < 3) {
      limitations.push(`In ${cq.domain}, the ${from.name} leans toward ${scrub(cq.from)} — the ${to.name} takes a different approach`);
    }
  }

  // ── 4. WHAT THE PROPOSED CHANGE ACTUALLY DOES ────────
  const whatChangesParts: string[] = [];

  for (const cq of changedQualities.slice(0, 2)) {
    whatChangesParts.push(`In ${cq.domain}, the ${to.name} shifts from ${scrub(cq.from)} toward ${scrub(cq.to)}.`);
  }
  if (positiveDeltas.length > 0) {
    const changes = positiveDeltas.map((d) => `more ${d.label}`).join(', ');
    whatChangesParts.push(`In concrete terms, the ${to.name} brings ${changes} relative to the ${from.name}.`);
  }
  if (negativeDeltas.length > 0) {
    const changes = negativeDeltas.map((d) => `less ${d.label}`).join(', ');
    whatChangesParts.push(`It also means ${changes}.`);
  }
  if (hasTendencies(to.tendencies) && to.tendencies.tradeoffs.length > 0) {
    const tradeoff = to.tendencies.tradeoffs[0];
    whatChangesParts.push(`What you gain is ${scrub(tradeoff.gains)}. The cost is ${scrub(tradeoff.cost)}.`);
  }

  const whatChanges = whatChangesParts.length > 0
    ? whatChangesParts.join(' ')
    : `The ${to.name} extends what the ${from.name} does well, with greater authority and composure.`;

  // ── 5. WHAT IMPROVES ─────────────────────────────────
  const improvements: string[] = [];

  for (const pd of positiveDeltas) {
    improvements.push(`More ${pd.label}`);
  }
  // Chain interaction improvements
  if (activeSystem && activeSystem.components.length > 0 && hasTendencies(to.tendencies)) {
    const ampComponent = activeSystem.components.find((c) =>
      c.category === 'amplifier' || c.category === 'integrated',
    );
    const speakerComponent = activeSystem.components.find((c) =>
      c.category === 'speaker',
    );
    if (ampComponent || speakerComponent) {
      const chainParts: string[] = [];
      if (ampComponent) chainParts.push(`${ampComponent.brand} ${ampComponent.name}`);
      if (speakerComponent) chainParts.push(`${speakerComponent.brand} ${speakerComponent.name}`);
      const chainDesc = chainParts.join(' and ');

      const composureGain = resolveTraitValue(to.tendencyProfile, to.traits, 'composure')
        - resolveTraitValue(from.tendencyProfile, from.traits, 'composure');
      const densityGain = resolveTraitValue(to.tendencyProfile, to.traits, 'tonal_density')
        - resolveTraitValue(from.tendencyProfile, from.traits, 'tonal_density');

      if (composureGain >= 0.29 && densityGain >= 0.29) {
        improvements.push(`Feeding the ${chainDesc}, expect a more effortless, harmonically fuller presentation`);
      } else if (composureGain >= 0.29) {
        improvements.push(`Less strain on dynamic peaks through the ${chainDesc} — a more effortless overall delivery`);
      } else if (densityGain >= 0.29) {
        improvements.push(`More midrange authority through the ${chainDesc}, shifting the overall balance toward greater body`);
      }
    }
  }
  // Lineup interaction
  if (hasTendencies(to.tendencies)) {
    const lineupInteraction = to.tendencies.interactions.find((i) =>
      i.condition.toLowerCase().includes(from.name.toLowerCase())
      || i.condition.toLowerCase().includes('same system')
      || i.condition.toLowerCase().includes('compared to'),
    );
    if (lineupInteraction && lineupInteraction.valence === 'positive') {
      improvements.push(scrub(lineupInteraction.effect));
    }
  }

  // ── 6. WHAT PROBABLY STAYS THE SAME ──────────────────
  const unchanged: string[] = [];

  if (sameBrand) {
    unchanged.push(`Core ${from.brand} voicing and design philosophy`);
  }
  for (const sq of sharedQualities) {
    unchanged.push(`${sq.charAt(0).toUpperCase() + sq.slice(1)} character — shared across both models`);
  }
  // Traits that are very similar between from and to
  for (const trait of keyTraits) {
    const fromVal = resolveTraitValue(from.tendencyProfile, from.traits, trait);
    const toVal = resolveTraitValue(to.tendencyProfile, to.traits, trait);
    const diff = Math.abs(toVal - fromVal);
    const label = TRAIT_LABELS[trait] ?? trait.replace(/_/g, ' ');
    if (diff < 0.15 && fromVal >= 0.5 && unchanged.length < 4) {
      unchanged.push(`${label.charAt(0).toUpperCase() + label.slice(1)} — similar level in both`);
    }
  }

  // ── 7. WHEN THIS UPGRADE MAKES SENSE ─────────────────
  const senseParts: string[] = [];

  if (positiveDeltas.length > 0) {
    const qualities = positiveDeltas.map((d) => d.label).join(', ');
    senseParts.push(`you value ${qualities} and your system is resolving enough to reveal the difference`);
  }
  if (activeSystem && activeSystem.components.length > 0) {
    senseParts.push(`your downstream chain has the transparency to show what a better source delivers`);
  }
  if (from.price > 0 && to.price > 0 && to.price / from.price <= 2.5) {
    senseParts.push(`the price step feels proportionate to the improvement you're seeking`);
  }

  const whenMakesSense = senseParts.length > 0
    ? `This upgrade makes sense when ${senseParts.join(', and ')}.`
    : `This makes sense when the rest of the chain is resolving enough to reveal what a better source contributes.`;

  // ── 8. WHEN IT MAY NOT BE THE BEST NEXT STEP ────────
  const waitParts: string[] = [];

  if (from.price > 0 && to.price > 0) {
    const ratio = to.price / from.price;
    if (ratio > 3) {
      waitParts.push(`at ${ratio.toFixed(1)}x the price, the gains are real but incremental within the same architecture — the money may deliver more impact elsewhere in the chain`);
    } else if (ratio > 1.8) {
      waitParts.push(`the price step is meaningful — whether the gains justify it depends on how close the ${from.name} is to its ceiling in your system`);
    }
  }
  if (negativeDeltas.length > 0) {
    const traded = negativeDeltas.map((d) => d.label).join(', ');
    waitParts.push(`you value ${traded} — the ${to.name} trades some of this away`);
  }
  // Caution interactions
  if (hasTendencies(to.tendencies)) {
    const cautions = to.tendencies.interactions.filter((i) => i.valence === 'caution');
    if (cautions.length > 0) {
      waitParts.push(scrub(`${cautions[0].condition}: ${cautions[0].effect}`));
    }
  }
  if (waitParts.length === 0) {
    waitParts.push(`the rest of the chain isn't resolving enough to reveal the difference — in that case, the upgrade would be inaudible relative to its cost`);
  }

  const whenToWait = `Consider waiting if ${waitParts.join('; or if ')}.`;

  // ── 9. SYSTEM BALANCE SUMMARY ────────────────────────
  // Only shown when the system includes at least two major components
  // (e.g. source + amp, or amp + speakers).  A single component does
  // not provide enough context for meaningful system-level scoring.
  const MAJOR_CATEGORIES = new Set(['dac', 'amplifier', 'integrated', 'speaker']);
  const majorComponentCount = 1 /* the 'from' product itself */
    + (activeSystem?.components.filter(
      (c) => c.name.toLowerCase() !== from.name.toLowerCase()
        && c.name.toLowerCase() !== to.name.toLowerCase()
        && MAJOR_CATEGORIES.has(c.category),
    ).length ?? 0);

  const BALANCE_TRAITS: Array<{ key: string; label: string }> = [
    { key: 'speed', label: 'Speed / articulation' },
    { key: 'tonal_density', label: 'Tonal density' },
    { key: 'dynamics', label: 'Dynamic scale' },
    { key: 'spatial_precision', label: 'Spatial depth' },
    { key: 'flow', label: 'Musical flow' },
    { key: 'composure', label: 'Composure' },
    { key: 'texture', label: 'Textural detail' },
  ];

  const systemBalance: SystemBalanceEntry[] = [];

  // Only build balance summary when we have enough system context.
  if (majorComponentCount >= 2) {
    for (const bt of BALANCE_TRAITS) {
      const fromVal = resolveTraitValue(from.tendencyProfile, from.traits, bt.key);

      // If we have system components, try to find a system-level aggregate
      // by checking if other products in the system affect this trait.
      let systemVal = fromVal;
      let systemNote: string | undefined;

      if (activeSystem && activeSystem.components.length > 0) {
        // Look up system components in the product catalog
        for (const comp of activeSystem.components) {
          if (comp.name.toLowerCase() === from.name.toLowerCase()) continue;
          if (comp.name.toLowerCase() === to.name.toLowerCase()) continue;
          const compProduct = ALL_PRODUCTS.find(
            (p) => p.name.toLowerCase() === comp.name.toLowerCase()
              || `${p.brand} ${p.name}`.toLowerCase() === `${comp.brand} ${comp.name}`.toLowerCase(),
          );
          if (compProduct) {
            const compVal = resolveTraitValue(compProduct.tendencyProfile, compProduct.traits, bt.key);
            // Component influence: downstream components can limit or enhance the source
            if (comp.category === 'speaker' || comp.category === 'amplifier' || comp.category === 'integrated') {
              if (compVal < systemVal - 0.2) {
                systemVal = (systemVal + compVal) / 2;
                systemNote = `${comp.brand} ${comp.name} may be a limiting factor`;
              } else if (compVal > systemVal + 0.2) {
                systemNote = `${comp.brand} ${comp.name} contributes here`;
              }
            }
          }
        }
      }

      let level: string;
      if (systemVal >= 0.75) level = 'Strong';
      else if (systemVal >= 0.55) level = 'Good';
      else if (systemVal >= 0.4) level = 'Moderate';
      else if (systemVal > 0) level = 'Limited';
      else level = 'Neutral';

      // Only include traits that have meaningful signal
      if (systemVal > 0 || fromVal > 0) {
        systemBalance.push({ label: bt.label, level, note: systemNote });
      }
    }
  }

  // ── 10. WHERE UPGRADES WOULD HAVE THE MOST IMPACT ────
  // System-level reasoning about where improvement is most meaningful.
  const upgradeImpactAreas: string[] = [];

  // Source / DAC — if the from product has weak traits that the to product fixes
  if (positiveDeltas.length > 0) {
    const labels = positiveDeltas.slice(0, 2).map((d) => d.label).join(' and ');
    upgradeImpactAreas.push(`Source ${from.category}: ${labels} — this is where the proposed change delivers`);
  }

  // Downstream components that may limit or benefit
  if (activeSystem && activeSystem.components.length > 0) {
    const speakerComp = activeSystem.components.find((c) => c.category === 'speaker');
    const ampComp = activeSystem.components.find((c) => c.category === 'amplifier' || c.category === 'integrated');

    if (speakerComp) {
      const speakerProduct = ALL_PRODUCTS.find(
        (p) => p.name.toLowerCase() === speakerComp.name.toLowerCase()
          || `${p.brand} ${p.name}`.toLowerCase() === `${speakerComp.brand} ${speakerComp.name}`.toLowerCase(),
      );
      if (speakerProduct) {
        const spkDynamics = resolveTraitValue(speakerProduct.tendencyProfile, speakerProduct.traits, 'dynamics');
        const spkComposure = resolveTraitValue(speakerProduct.tendencyProfile, speakerProduct.traits, 'composure');
        if (spkDynamics < 0.5 || spkComposure < 0.5) {
          upgradeImpactAreas.push(`Speaker dynamic headroom — the ${speakerComp.brand} ${speakerComp.name} may become the next ceiling after upgrading the source`);
        }
      } else {
        // Unknown speaker — general note
        upgradeImpactAreas.push(`Speaker interaction — how well it reveals source-level improvements will determine the perceived gain`);
      }
    }

    if (ampComp) {
      const ampProduct = ALL_PRODUCTS.find(
        (p) => p.name.toLowerCase() === ampComp.name.toLowerCase()
          || `${p.brand} ${p.name}`.toLowerCase() === `${ampComp.brand} ${ampComp.name}`.toLowerCase(),
      );
      if (ampProduct) {
        const ampComposure = resolveTraitValue(ampProduct.tendencyProfile, ampProduct.traits, 'composure');
        if (ampComposure < 0.5) {
          upgradeImpactAreas.push(`Amplifier composure — the ${ampComp.brand} ${ampComp.name} may constrain how much of the source upgrade is audible`);
        }
      }
    }
  }

  // Room interaction — always a factor
  if (upgradeImpactAreas.length < 3) {
    upgradeImpactAreas.push('Room interaction and placement — often the highest-leverage change, independent of electronics');
  }

  // ── 11. EXPECTED MAGNITUDE OF CHANGE ─────────────────
  // Scoring philosophy:
  //   Minor    = small tuning or lateral changes within similar architecture
  //   Moderate = meaningful improvements within the same architecture
  //   Major    = architectural changes (speakers, amplification topology,
  //              large-scale system shifts)
  //
  // Most DAC-to-DAC upgrades land in Minor–Moderate.  "Major" is reserved
  // for changes that fundamentally alter how the system renders music.

  let magnitudeScore = 0;

  // Trait delta contribution — scaled so typical DAC upgrades
  // (2–3 deltas of ~0.3 each) land in the Moderate band, not Major.
  for (const pd of positiveDeltas) {
    magnitudeScore += pd.diff * 0.5;
  }
  for (const nd of negativeDeltas) {
    magnitudeScore -= Math.abs(nd.diff) * 0.15;
  }

  // Category weighting — source-only changes are inherently smaller
  // than speaker or amplification topology changes.
  const isSourceOnly = from.category === 'dac' || from.category === 'streamer';
  if (isSourceOnly) {
    magnitudeScore *= 0.7;
  }

  // Same-brand / same-architecture damping — refinement, not revolution.
  if (sameBrand) {
    magnitudeScore *= 0.8;
  }

  // Cross-architecture / cross-brand gets a modest boost.
  if (!sameBrand) {
    magnitudeScore *= 1.1;
  }

  // Price ratio modulation — very high ratios within same architecture
  // indicate diminishing returns, not bigger gains.
  if (from.price > 0 && to.price > 0) {
    const ratio = to.price / from.price;
    if (ratio > 4) {
      magnitudeScore *= 0.75;
    } else if (ratio > 2.5) {
      magnitudeScore *= 0.85;
    }
  }

  let changeMagnitude: ChangeMagnitude;
  const changesLabels = positiveDeltas.map((d) => d.label);
  const remainsLabels = sharedQualities.length > 0
    ? sharedQualities
    : unchanged.slice(0, 2).map((u) => u.split(' — ')[0]);

  // Thresholds: Minor < 0.35, Moderate 0.35–0.7, Major >= 0.7
  if (magnitudeScore >= 0.7) {
    changeMagnitude = {
      tier: 'major',
      label: 'Major',
      changesmost: changesLabels.length > 0
        ? `Expect a clearly audible shift in ${changesLabels.join(', ')}`
        : 'Expect a clearly audible shift in overall presentation',
      remainsSimilar: remainsLabels.length > 0
        ? `${remainsLabels.join(', ')} should carry through`
        : 'Core tonal character should carry through',
    };
  } else if (magnitudeScore >= 0.35) {
    changeMagnitude = {
      tier: 'moderate',
      label: 'Moderate',
      changesmost: changesLabels.length > 0
        ? `Noticeable improvement in ${changesLabels.join(', ')}, especially on well-recorded material`
        : 'Noticeable improvement in refinement and authority',
      remainsSimilar: remainsLabels.length > 0
        ? `${remainsLabels.join(', ')} remain largely unchanged`
        : 'Overall tonal signature remains familiar',
    };
  } else {
    changeMagnitude = {
      tier: 'minor',
      label: 'Minor',
      changesmost: changesLabels.length > 0
        ? `Subtle refinement in ${changesLabels.join(', ')} — audible in direct comparison, less obvious day-to-day`
        : 'Subtle refinement rather than a transformative change',
      remainsSimilar: remainsLabels.length > 0
        ? `${remainsLabels.join(', ')} stay essentially the same`
        : 'Most of the system character stays the same',
    };
  }

  return {
    systemCharacter,
    workingWell: workingWell.length > 0 ? workingWell : [`The ${from.name} is a capable starting point in its tier`],
    limitations: limitations.length > 0 ? limitations : [`At this price point, there may be a ceiling on resolution and composure`],
    whatChanges,
    improvements: improvements.length > 0 ? improvements : [`Greater overall authority and refinement`],
    unchanged: unchanged.length > 0 ? unchanged : [`Basic sonic character and design intent`],
    whenMakesSense,
    whenToWait,
    systemBalance,
    upgradeImpactAreas,
    changeMagnitude,
  };
}

// ── Public API ───────────────────────────────────────

export function buildGearResponse(
  intent: UserIntent,
  subjects: string[],
  currentMessage: string,
  desires: DesireSignal[] = [],
  tasteProfile?: TasteProfile,
  activeSystem?: ActiveSystemContext | null,
): GearResponse | null {
  if (intent !== 'gear_inquiry' && intent !== 'comparison') return null;

  const products = findProducts(subjects);
  const seed = currentMessage.length;

  // Infer system direction from the user's message and known product
  const sysDir = inferSystemDirection(
    currentMessage,
    desires,
    products[0] ?? null,
    tasteProfile,
  );

  // Churn avoidance — detect vague upgrade intent without clear symptom
  const churn = detectChurnSignal(currentMessage);
  const churnNote = buildChurnNote(churn);

  // Build reflective "What I'm hearing" block
  const hearing = buildHearingBlock(intent, desires, products, sysDir, tasteProfile);

  // Insert churn note into hearing block when detected
  if (churnNote && hearing.length < 4) {
    hearing.push(churnNote);
  }

  // Helper: append tendency context to an anchor if available
  const withTendency = (base: string): string => {
    if (!sysDir.tendencySummary) return base;
    return `${base} ${sysDir.tendencySummary}`;
  };

  // Helper: prepend direction context to a direction string if available
  const withDirection = (base: string): string => {
    if (!sysDir.directionSummary) return base;
    return `${sysDir.directionSummary} ${base}`;
  };

  // ── Comparison ──────────────────────────────────────
  if (intent === 'comparison') {
    // ── System-vs-system resolution ──────────────────
    // For "X + Y vs Z + Y", resolve which products are shared (held
    // constant) and which differ (the actual comparison targets).
    const compPair = resolveComparisonPair(currentMessage, subjects);
    const a = compPair?.left ?? products[0] ?? null;
    const b = compPair?.right ?? products[1] ?? null;
    const sharedComponents = compPair?.shared ?? [];
    const isSystemComparison = compPair?.isSystemComparison ?? false;

    if (a && b) {
      // ── Upgrade comparison path ──────────────────────
      // When the query uses upgrade language or both products share a
      // brand lineage, produce the four-element upgrade structure:
      //   anchor → architecture lineage + system framing
      //   character → what stays + what changes
      //   direction → system interaction + proportionality
      if (isUpgradeComparison(currentMessage, a, b)) {
        // Determine "from" and "to" — cheaper product is the origin,
        // unless active system contains one of them.
        let from = a.price <= b.price ? a : b;
        let to = a.price <= b.price ? b : a;
        if (activeSystem) {
          const aInSystem = activeSystem.components.some(
            (c) => c.name.toLowerCase() === a.name.toLowerCase()
              || `${c.brand} ${c.name}`.toLowerCase() === `${a.brand} ${a.name}`.toLowerCase(),
          );
          const bInSystem = activeSystem.components.some(
            (c) => c.name.toLowerCase() === b.name.toLowerCase()
              || `${c.brand} ${c.name}`.toLowerCase() === `${b.brand} ${b.name}`.toLowerCase(),
          );
          if (aInSystem && !bInSystem) { from = a; to = b; }
          if (bInSystem && !aInSystem) { from = b; to = a; }
        }

        const allowed = buildAllowedNames(from, to, activeSystem);

        return {
          intent,
          subjects,
          anchor: buildUpgradeAnchor(from, to, activeSystem),
          character: buildUpgradeCharacter(from, to, allowed),
          interpretation: desires.length > 0
            ? QUALITY_PROFILES[desires[0].quality]?.interpretation
            : undefined,
          direction: buildUpgradeDirection(from, to, activeSystem, allowed),
          clarification: buildClarification({ activeSystem, seed, churn, hasDesires: desires.length > 0 }),
          systemDirection: sysDir,
          hearing,
          userArchetype: sysDir.inferredArchetype
            ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
            : undefined,
          upgradeAnalysis: buildUpgradeAnalysis(from, to, activeSystem, allowed),
        };
      }

      // ── General comparison path (different architectures/brands) ──
      // Concise side-by-side format: opening + two trait blocks + decision guidance.
      const nameA = `${a.brand} ${a.name}`;
      const nameB = `${b.brand} ${b.name}`;

      // Extract compact character descriptions (1 sentence each)
      const charA = productCharacterCompact(a);
      const charB = productCharacterCompact(b);

      // System note — compact context if user has a system
      const systemNote = buildSystemComparisonNote(a, b, activeSystem);

      // Shared-component context for system-vs-system comparisons
      const sharedNote = isSystemComparison && sharedComponents.length > 0
        ? buildSharedComponentNote(a, b, sharedComponents)
        : null;

      // Price context
      let priceNote = '';
      if (a.price && b.price) {
        const ratio = Math.max(a.price, b.price) / Math.min(a.price, b.price);
        if (ratio >= 2) {
          priceNote = ` (different tiers — ~$${Math.min(a.price, b.price).toLocaleString()} vs ~$${Math.max(a.price, b.price).toLocaleString()})`;
        } else if (ratio >= 1.3) {
          priceNote = ` (~$${Math.min(a.price, b.price).toLocaleString()} vs ~$${Math.max(a.price, b.price).toLocaleString()})`;
        }
      }

      // Opening — shared-component note takes priority over system note
      let opening: string;
      if (sharedNote) {
        opening = `${sharedNote} These take different approaches${priceNote}:`;
      } else if (systemNote) {
        opening = `${systemNote} These take different approaches${priceNote}:`;
      } else {
        opening = `These take different approaches${priceNote}:`;
      }

      // Per-product trait blocks: architecture + 2-3 traits + 1 system note
      const archA = a.architecture ? `${a.architecture} design. ` : '';
      const archB = b.architecture ? `${b.architecture} design. ` : '';
      const blockA = `**${nameA}** — ${archA}${charA}`;
      const blockB = `**${nameB}** — ${archB}${charB}`;

      // Decision guidance
      const directionCompact = buildComparisonDirection(a, b);

      // Taste-based decision frame — listener-centered layer
      const tendTextA = a.tendencies?.character?.map((t) => `${t.tendency}`).join(', ') ?? charA;
      const tendTextB = b.tendencies?.character?.map((t) => `${t.tendency}`).join(', ') ?? charB;
      const tasteFrame = buildTasteDecisionFrame(currentMessage, nameA, charA, tendTextA, nameB, charB, tendTextB);

      // System interaction note for shared components
      const sharedInteraction = isSystemComparison && sharedComponents.length > 0
        ? buildSharedInteractionNote(a, b, sharedComponents)
        : '';

      const conciseComparison = `${opening}\n\n${blockA}\n\n${blockB}\n\n${directionCompact}${sharedInteraction ? `\n\n${sharedInteraction}` : ''}${tasteFrame ? `\n\n${tasteFrame}` : ''}`;

      return {
        intent,
        subjects,
        anchor: conciseComparison,
        character: '',
        interpretation: desires.length > 0
          ? QUALITY_PROFILES[desires[0].quality]?.interpretation
          : undefined,
        direction: '',
        clarification: isSystemComparison
          ? `What matters more to you — rhythmic engagement or tonal refinement?`
          : activeSystem
            ? `How does your current setup lean — warmer or more precise?`
            : `What are you pairing it with?`,
        systemDirection: sysDir,
        hearing,
        userArchetype: sysDir.inferredArchetype
        ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
        : undefined,
        matchedProducts: [a, b, ...sharedComponents].filter(Boolean) as Product[],
      };
    }

    // Half-known comparison: one product found, one not in catalog.
    // Use the known product's full data instead of generic boilerplate.
    if (subjects.length >= 2 && (a || b)) {
      const known = a ?? b;
      const knownName = `${known!.brand} ${known!.name}`;
      const unknownSubjects = subjects.filter(
        (s) => s.toLowerCase() !== known!.brand.toLowerCase() && s.toLowerCase() !== known!.name.toLowerCase(),
      );
      const unknownName = unknownSubjects.length > 0
        ? unknownSubjects.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
        : 'the other product';

      // Full character for the known product
      const knownCharacter = productCharacter(known!, desires.length > 0 ? [desires[0].quality] : []);

      // Full directional analysis for the known product
      const knownDirection = buildInquiryDirection(
        known!,
        sysDir.inferredArchetype ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary } : undefined,
      );

      // System interactions and trade-offs from the known product
      let interactionNote = '';
      if (hasTendencies(known!.tendencies)) {
        const tradeoff = known!.tendencies.tradeoffs[0];
        if (tradeoff) {
          const rel = tradeoff.relative_to ? ` compared to ${tradeoff.relative_to}` : '';
          interactionNote = ` What the ${known!.name} tends to deliver is ${tradeoff.gains}${rel}. What it trades away is ${tradeoff.cost}.`;
        }
        const cautions = known!.tendencies.interactions.filter((i) => i.valence === 'caution');
        if (cautions.length > 0) {
          interactionNote += ` Worth being aware of: ${cautions[0].condition}, ${cautions[0].effect}.`;
        }
      }

      return {
        intent,
        subjects,
        anchor: withTendency(
          `The ${knownName} is well documented and widely reviewed. The ${unknownName} appears less represented in the sources I rely on. I can describe the ${known!.name}'s character in detail, which may help frame the comparison.`,
        ),
        character: `The ${knownName}: ${knownCharacter}${interactionNote}`,
        interpretation: desires.length > 0
          ? QUALITY_PROFILES[desires[0].quality]?.interpretation
          : undefined,
        direction: withDirection(
          knownDirection
            + ` For a meaningful comparison with the ${unknownName}, the key question is whether its design philosophy complements or diverges from these tendencies.`,
        ),
        clarification: `What draws you to the ${unknownName} — is there a specific quality you're hoping it does differently from the ${known!.name}?`,
        systemDirection: sysDir,
        hearing,
        userArchetype: sysDir.inferredArchetype
          ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
          : undefined,
        matchedProducts: [known!],
      };
    }

    // Fully unknown comparison: neither product in catalog
    if (subjects.length >= 2) {
      return {
        intent,
        subjects,
        anchor: withTendency('Neither of those products appears in my catalog, so I can\'t give you component-level trait data. What I can do is reason from design class.'),
        character: 'The comparison comes down to design philosophy — what each designer chose to prioritize. Architecture, feedback topology, and output stage all shape character differently, and two products at the same price point can be optimised for completely opposite listener priorities.',
        interpretation: desires.length > 0
          ? QUALITY_PROFILES[desires[0].quality]?.interpretation
          : undefined,
        direction: withDirection('The most useful way to think about it is: what do you want more of in your listening, and which design approach tends to deliver that? A comparison that holds in one system may reverse in another.'),
        clarification: buildClarification({ activeSystem, seed, churn, hasDesires: desires.length > 0 }),
        systemDirection: sysDir,
        hearing,
        userArchetype: sysDir.inferredArchetype
        ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
        : undefined,
      };
    }

    return {
      intent,
      subjects,
      anchor: 'To reason about any comparison, I need to know what\'s actually being compared — the design architectures, not just the names.',
      character: products.length > 0 ? productCharacter(products[0]) : 'Every component has a design priority — a set of things it does well and things it trades away. The comparison is only meaningful relative to a specific system and listener.',
      direction: 'To make a useful comparison, I\'d need to know what you\'re comparing and what dimensions matter most. Two excellent components can be optimized for very different priorities.',
      clarification: 'What are you comparing, and what\'s driving the question?',
      systemDirection: sysDir,
      hearing,
      userArchetype: sysDir.inferredArchetype
        ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
        : undefined,
    };
  }

  // ── Gear inquiry with desire ────────────────────────
  if (desires.length > 0 && (products.length > 0 || subjects.length > 0)) {
    const product = products[0] ?? null;
    const primary = desires[0];
    const profile = QUALITY_PROFILES[primary.quality];
    const productName = product
      ? `${product.brand} ${product.name}`
      : subjects[0].charAt(0).toUpperCase() + subjects[0].slice(1);

    // Archetype context for the anchor
    const archetypeContext = sysDir.archetypeNote
      ? ` ${sysDir.archetypeNote}`
      : '';

    // Use product description for interpretation when available, otherwise
    // synthesize from what we know about the desire + product architecture.
    const desireAnchor = product && product.description
      ? `The ${productName} — ${product.description.charAt(0).toLowerCase() + product.description.slice(1)} Wanting ${primary.direction} ${primary.quality} from that tells me something specific about the gap you're trying to close.${archetypeContext}`
      : `The ${productName} has a clear design direction. Wanting ${primary.direction} ${primary.quality} from it tells me where you feel the gap — and that gap usually sits in a specific part of the chain.${archetypeContext}`;
    return {
      intent,
      subjects,
      anchor: withTendency(desireAnchor),
      character: product
        ? productCharacter(product, [primary.quality])
        : brandCharacter(productName),
      interpretation: profile?.interpretation
        ?? `When listeners ask for ${primary.direction} ${primary.quality}, the answer usually depends on where in the chain the limitation lives — and whether it's truly missing or being masked by something else.`,
      direction: withDirection(
        profile?.direction
          ?? 'The right path depends on the rest of the system and what trade-offs you\'re comfortable with. Sometimes the change you want comes from a different part of the chain than you\'d expect.'
      ),
      clarification: buildClarification({ activeSystem, seed, churn, hasDesires: desires.length > 0 }),
      systemDirection: sysDir,
      hearing,
      userArchetype: sysDir.inferredArchetype
        ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
        : undefined,
      matchedProducts: products.length > 0 ? products : undefined,
    };
  }

  // ── Pure gear inquiry (known product) ───────────────
  if (products.length > 0) {
    const product = products[0];
    // Use the product description as the interpretation anchor if available.
    // Fallback to architecture-based framing — never use generic acknowledgment.
    const productInterpretation = product.description
      ? `The ${product.brand} ${product.name} — ${product.description.charAt(0).toLowerCase() + product.description.slice(1)}`
      : `The ${product.brand} ${product.name} is built around ${product.architecture} architecture, which shapes its character in specific ways.`;
    return {
      intent,
      subjects,
      anchor: withTendency(productInterpretation),
      character: productCharacter(product),
      direction: buildInquiryDirection(product, sysDir.inferredArchetype ?? undefined),
      clarification: buildClarification({ activeSystem, seed, churn, hasDesires: desires.length > 0 }),
      systemDirection: sysDir,
      hearing,
      userArchetype: sysDir.inferredArchetype
        ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
        : undefined,
      matchedProducts: products,
    };
  }

  // ── Brand mention, no specific product ──────────────
  if (subjects.length > 0) {
    const brandName = subjects[0].charAt(0).toUpperCase() + subjects[0].slice(1);
    return {
      intent,
      subjects,
      anchor: withTendency(`${brandName} has a recognizable design philosophy — the question is how it maps to your system and what you're trying to change.`),
      character: brandCharacter(brandName),
      direction: 'The best way to evaluate any piece of gear is relative to the system it\'s going into. A component that sounds extraordinary in one system can be unremarkable in another — that\'s not a flaw, it\'s how audio works.',
      clarification: buildClarification({ activeSystem, seed, churn, hasDesires: desires.length > 0 }),
      systemDirection: sysDir,
      hearing,
      userArchetype: sysDir.inferredArchetype
        ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
        : undefined,
    };
  }

  // ── Fallback ────────────────────────────────────────
  return {
    intent,
    subjects: [],
    anchor: 'Every piece of audio gear makes trade-offs — what it prioritizes shapes what you hear, and what it trades away shapes what you don\'t.',
    character: 'Every component has a character — a set of things it does well and things it trades away.',
    direction: 'What matters is how that character interacts with your system and your listening priorities. The same piece can sound relaxed in one system and forward in another.',
    clarification: buildClarification({ activeSystem, seed, churn, hasDesires: desires.length > 0 }),
    systemDirection: sysDir,
    hearing,
    userArchetype: sysDir.inferredArchetype
      ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
      : undefined,
  };
}

// ── Shared-component helpers ───────────────────────
//
// For system-vs-system comparisons ("X + Y vs Z + Y"), these helpers
// produce context about the shared component (Y) and how the differing
// components (X vs Z) interact with it differently.

/**
 * Build opening note about the shared component held constant.
 *   "Both systems share the WLM Diva. The difference is the amplifier."
 */
function buildSharedComponentNote(
  left: Product,
  right: Product,
  shared: Product[],
): string {
  const sharedNames = shared.map((p) => `${p.brand} ${p.name}`).join(' and ');
  const leftCat = left.category ?? 'component';
  const rightCat = right.category ?? 'component';
  const differingType = leftCat === rightCat ? leftCat : 'component';
  return `Both systems share the ${sharedNames}. The difference is the ${differingType} — ${left.brand} ${left.name} vs ${right.brand} ${right.name}.`;
}

/**
 * Build interaction note about how each differing component behaves
 * with the shared component(s).
 */
function buildSharedInteractionNote(
  left: Product,
  right: Product,
  shared: Product[],
): string {
  const parts: string[] = [];
  for (const sharedProd of shared) {
    const sharedName = `${sharedProd.brand} ${sharedProd.name}`;
    // Check if either product has interaction notes about the shared component's category
    const sharedCat = sharedProd.category ?? '';
    if (hasTendencies(left.tendencies)) {
      const relevant = left.tendencies.interactions.find(
        (i) => i.condition.toLowerCase().includes(sharedCat)
          || i.condition.toLowerCase().includes(sharedProd.name.toLowerCase()),
      );
      if (relevant) {
        parts.push(`The ${left.name} paired with the ${sharedName}: ${relevant.effect}`);
      }
    }
    if (hasTendencies(right.tendencies)) {
      const relevant = right.tendencies.interactions.find(
        (i) => i.condition.toLowerCase().includes(sharedCat)
          || i.condition.toLowerCase().includes(sharedProd.name.toLowerCase()),
      );
      if (relevant) {
        parts.push(`The ${right.name} paired with the ${sharedName}: ${relevant.effect}`);
      }
    }
  }
  if (parts.length === 0) {
    // Generic framing when no specific interaction data exists
    const sharedName = shared.map((p) => p.name).join(' and ');
    return `With the ${sharedName} held constant, the difference comes down to what each ${left.category ?? 'component'} brings to the pairing — they'll shape the overall character in distinctly different ways.`;
  }
  return parts.join(' ');
}

// ── Direction helpers ────────────────────────────────

/** Trait comparison descriptors — each trait gets a pair of phrases for A>B and B>A. */
const COMPARISON_PHRASES: Record<string, { aLeads: string; bLeads: string }> = {
  flow:              { aLeads: 'leans more toward musical flow',       bLeads: 'leans more toward musical flow' },
  rhythm:            { aLeads: 'has stronger rhythmic drive',          bLeads: 'has stronger rhythmic drive' },
  dynamics:          { aLeads: 'delivers more dynamic energy',         bLeads: 'delivers more dynamic energy' },
  tonal_density:     { aLeads: 'carries more tonal weight',            bLeads: 'carries more tonal weight' },
  clarity:           { aLeads: 'emphasizes clarity more',              bLeads: 'emphasizes clarity more' },
  speed:             { aLeads: 'has faster transient response',        bLeads: 'has faster transient response' },
  warmth:            { aLeads: 'leans warmer and fuller',              bLeads: 'leans warmer and fuller' },
  spatial_precision: { aLeads: 'images with more spatial precision',   bLeads: 'images with more spatial precision' },
  texture:           { aLeads: 'reveals more textural detail',         bLeads: 'reveals more textural detail' },
  composure:         { aLeads: 'stays more composed under pressure',   bLeads: 'stays more composed under pressure' },
  openness:          { aLeads: 'sounds more open and spacious',        bLeads: 'sounds more open and spacious' },
  elasticity:        { aLeads: 'has more rhythmic elasticity',         bLeads: 'has more rhythmic elasticity' },
};

function buildComparisonDirection(a: Product, b: Product): string {
  // ── Tendency-driven comparison ────────────────────
  if (hasTendencies(a.tendencies) && hasTendencies(b.tendencies)) {
    const parts: string[] = [];

    // Compare character tendencies in overlapping domains
    const aDomains = new Set(a.tendencies.character.map((t) => t.domain));
    const bDomains = new Set(b.tendencies.character.map((t) => t.domain));
    const sharedDomains = [...aDomains].filter((d) => bDomains.has(d));

    for (const domain of sharedDomains.slice(0, 2)) {
      const aTend = a.tendencies.character.find((t) => t.domain === domain);
      const bTend = b.tendencies.character.find((t) => t.domain === domain);
      if (aTend && bTend && aTend.tendency !== bTend.tendency) {
        parts.push(`In ${domain}, the ${a.name} tends toward ${aTend.tendency}, while the ${b.name} tends toward ${bTend.tendency}`);
      }
    }

    // Add trade-off contrast if available
    const aTradeoff = a.tendencies.tradeoffs[0];
    const bTradeoff = b.tendencies.tradeoffs[0];
    if (aTradeoff && bTradeoff) {
      parts.push(`The ${a.name} optimizes for ${aTradeoff.gains}; the ${b.name} optimizes for ${bTradeoff.gains}`);
    }

    if (parts.length > 0) {
      return `${parts.join('. ')}. Neither is objectively better — they represent different design philosophies, and the right choice depends on your system context and listening priorities.`;
    }
  }

  // ── Fallback: trait-diff comparison (uses bridge) ─
  const diffs: string[] = [];

  for (const [trait, phrases] of Object.entries(COMPARISON_PHRASES)) {
    const aVal = resolveTraitValue(a.tendencyProfile, a.traits, trait);
    const bVal = resolveTraitValue(b.tendencyProfile, b.traits, trait);
    const diff = aVal - bVal;
    if (Math.abs(diff) >= 0.3) {
      diffs.push(diff > 0
        ? `the ${a.name} ${phrases.aLeads}`
        : `the ${b.name} ${phrases.bLeads}`);
    }
  }

  const topDiffs = diffs.slice(0, 4);

  if (topDiffs.length > 0) {
    const last = topDiffs.pop()!;
    const list = topDiffs.length > 0
      ? `${topDiffs.join('; ')}, while ${last}`
      : last;
    return `In practice, ${list}. Neither is objectively better — they represent different design philosophies, and the right choice depends on your system context and listening priorities.`;
  }

  return 'They\'re closer in overall balance than you might expect given the architectural differences. The distinction is more about texture and presentation style than broad tonal character. Context — the amp, the room, the music — will determine which one feels right.';
}

function buildInquiryDirection(product: Product, userPref?: { primary: SonicArchetype; secondary?: SonicArchetype }): string {
  const traits = product.traits;
  const tags = tagProductArchetype(product);
  const parts: string[] = [];

  // Archetype alignment note — check against both primary and secondary
  if (userPref) {
    const userPrimary = userPref.primary;
    const userSecondary = userPref.secondary;
    if (tags.primary === userPrimary || tags.primary === userSecondary) {
      parts.push(`Its design emphasizes ${getArchetypeLabel(tags.primary)}, which aligns with what you're describing.`);
    } else {
      parts.push(`It leans toward ${getArchetypeLabel(tags.primary)}, which is a different emphasis from the ${getArchetypeLabel(userPrimary)} you seem to be after.`);
    }
  }

  // ── Tendency-driven path ──────────────────────────
  if (hasTendencies(product.tendencies)) {
    // Use curated trade-off tendencies instead of inferring from weak trait scores
    const tradeoff = product.tendencies.tradeoffs[0];
    if (tradeoff) {
      const rel = tradeoff.relative_to ? ` compared to ${tradeoff.relative_to}` : '';
      parts.push(`What you tend to get is ${tradeoff.gains}${rel}. What it trades away is ${tradeoff.cost}.`);
    }

    // Include matching interaction tendencies if system context is available
    // (use archetype preferences as proxy for system type)
    const systemKeywords: string[] = [];
    if (userPref) {
      if (userPref.primary === 'flow_organic') systemKeywords.push('warm', 'smooth', 'tube');
      if (userPref.primary === 'precision_explicit') systemKeywords.push('speed', 'precision', 'analytical');
      if (userPref.primary === 'tonal_saturated') systemKeywords.push('warm', 'dense', 'tonal');
      if (userPref.primary === 'rhythmic_propulsive') systemKeywords.push('speed', 'dynamic');
    }
    const matchedInteractions = findMatchingInteractions(product.tendencies.interactions, systemKeywords);
    if (matchedInteractions.length > 0) {
      const inter = matchedInteractions[0];
      if (inter.valence === 'caution') {
        parts.push(`Worth being aware of: ${inter.condition}, ${inter.effect}.`);
      } else {
        parts.push(`${inter.condition.charAt(0).toUpperCase() + inter.condition.slice(1)}, ${inter.effect}.`);
      }
    }

    // Caution interactions that didn't match keywords but are important
    const cautionInteractions = product.tendencies.interactions.filter(
      (i) => i.valence === 'caution' && !matchedInteractions.includes(i),
    );
    if (cautionInteractions.length > 0 && matchedInteractions.length === 0) {
      const ci = cautionInteractions[0];
      parts.push(`Worth being aware of: ${ci.condition}, ${ci.effect}.`);
    }
  } else if (hasExplainableProfile(product.tendencyProfile)) {
    // ── Qualitative profile path (high/medium) ──────
    const emphasized = getEmphasizedTraits(product.tendencyProfile);
    const lessEmphasized = getLessEmphasizedTraits(product.tendencyProfile);
    const conf = product.tendencyProfile.confidence;

    if (emphasized.length > 0 && !userPref) {
      parts.push(confidenceFrame(conf, emphasized.join(' and '), 'emphasize'));
    }
    if (lessEmphasized.length > 0) {
      parts.push(confidenceTradeoffFrame(conf, 'what it does best', lessEmphasized.slice(0, 2).join(' and ')));
    }

    const cautions: string[] = [];
    if (hasRisk(product.tendencyProfile, traits, 'fatigue_risk')) cautions.push('it can lean forward in the treble, which may be fatiguing in brighter systems');
    if (hasRisk(product.tendencyProfile, traits, 'glare_risk')) cautions.push('there\'s some edge in the upper frequencies that could compound with bright amplification');
    if (cautions.length > 0) {
      parts.push(`Worth being aware of: ${cautions.join('; ')}.`);
    }
  } else {
    // ── Design archetype fallback ────────────────────
    const dirArchetype = resolveArchetype(product.architecture);
    const tradeoffSentence = dirArchetype ? archetypeTradeoff(dirArchetype) : undefined;
    const cautionSentence = dirArchetype ? archetypeCaution(dirArchetype) : undefined;

    if (tradeoffSentence) {
      // Archetype provides class-level direction
      const archEmphasized = dirArchetype!.typicalTendencies
        .filter((t) => t.direction === 'emphasized')
        .map((t) => t.trait.replace(/_/g, ' '));

      if (archEmphasized.length > 0 && !userPref) {
        const verb = dirArchetype!.confidence === 'high' ? 'typically emphasizes' : 'tends toward';
        parts.push(`${dirArchetype!.label} designs ${verb} ${archEmphasized.slice(0, 2).join(' and ')}.`);
      }
      parts.push(tradeoffSentence);
      if (cautionSentence) {
        parts.push(`Worth being aware of: ${cautionSentence}`);
      }
    } else {
    // ── Legacy fallback: trait-inferred direction ────
    const strengths: string[] = [];
    if ((traits.rhythm ?? 0) >= 1.0 || (traits.dynamics ?? 0) >= 1.0) strengths.push('rhythmic and dynamic engagement');
    if ((traits.tonal_density ?? 0) >= 1.0) strengths.push('tonal richness');
    if ((traits.spatial_precision ?? 0) >= 1.0) strengths.push('spatial precision');
    if ((traits.clarity ?? 0) >= 1.0) strengths.push('transparency');
    if ((traits.flow ?? 0) >= 1.0) strengths.push('musical continuity');
    if ((traits.texture ?? 0) >= 1.0) strengths.push('textural realism');

    const tradeoffs: string[] = [];
    if ((traits.clarity ?? 0) <= 0.4 && strengths.length > 0) tradeoffs.push('resolution');
    if ((traits.dynamics ?? 0) <= 0.4 && strengths.length > 0) tradeoffs.push('dynamic scale');
    if ((traits.spatial_precision ?? 0) <= 0.4 && strengths.length > 0) tradeoffs.push('imaging specificity');
    if ((traits.warmth ?? 0) <= 0.0 && (traits.clarity ?? 0) >= 0.7) tradeoffs.push('warmth');

    const cautions: string[] = [];
    if ((traits.fatigue_risk ?? 0) >= 0.4) cautions.push('it can lean forward in the treble, which may be fatiguing in brighter systems');
    if ((traits.glare_risk ?? 0) >= 0.4) cautions.push('there\'s some edge in the upper frequencies that could compound with bright amplification');

    if (strengths.length > 0 && !userPref) {
      parts.push(`Its design philosophy clearly prioritizes ${strengths.join(' and ')}.`);
    }
    if (tradeoffs.length > 0) {
      parts.push(`The trade-off is ${tradeoffs.join(' and ')} — it gives up some of that to focus on what it does best.`);
    }
    if (cautions.length > 0) {
      parts.push(`Worth being aware of: ${cautions.join('; ')}.`);
    }
    } // close archetype else → legacy fallback
  }

  parts.push('How well it works depends on the rest of the chain and what you prioritize in your listening.');

  return parts.join(' ');
}
