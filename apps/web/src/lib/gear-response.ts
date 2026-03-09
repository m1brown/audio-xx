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

import type { GearResponse } from './conversation-types';
import type { UserIntent, DesireSignal } from './intent';
import { DAC_PRODUCTS, type Product } from './products/dacs';
import { SPEAKER_PRODUCTS } from './products/speakers';
import { inferSystemDirection, type SystemDirection } from './system-direction';
import {
  compareProductArchetypes,
  tagProductArchetype,
  getArchetypeLabel,
  getArchetypeShortLabel,
  type SonicArchetype,
  type UserArchetypePreference,
} from './archetype';

// ── Product lookup ───────────────────────────────────

const ALL_PRODUCTS: Product[] = [...DAC_PRODUCTS, ...SPEAKER_PRODUCTS];

function findProducts(subjects: string[]): Product[] {
  if (subjects.length === 0) return [];
  const found: Product[] = [];
  for (const subject of subjects) {
    const lower = subject.toLowerCase();
    for (const product of ALL_PRODUCTS) {
      const brandLower = product.brand.toLowerCase();
      const nameLower = product.name.toLowerCase();
      if (
        brandLower === lower ||
        nameLower === lower ||
        `${brandLower} ${nameLower}`.includes(lower) ||
        lower.includes(brandLower) ||
        lower.includes(nameLower)
      ) {
        if (!found.some((p) => p.id === product.id)) {
          found.push(product);
        }
      }
    }
  }
  return found;
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
    direction: 'R-2R DAC architectures and tube amplification both tend toward a denser harmonic presentation. Speaker placement also contributes — closer to walls adds bass warmth, further away reduces it.',
  },
  body: {
    interpretation: '"Body" is about the weight and substance of instruments — the sense that a cello has physical presence and a piano has mass behind each note.',
    direction: 'DACs with higher tonal density deliver this, along with amplifiers that maintain composure under load. Sometimes the source is the limiting factor — a thin-sounding DAC can strip away the sense of physical scale.',
  },
  richness: {
    interpretation: '"Richness" describes harmonic density — how many overtones and how much tonal color instruments seem to carry. A rich system makes a violin sound wooden and resonant, not just pitched.',
    direction: 'R-2R conversion and tube output stages tend to present more harmonic information. The trade-off is that very rich-sounding systems can feel slower or less transparent.',
  },
  density: {
    interpretation: '"Density" is closely related to body and richness — it\'s the feeling that the sound has substance and mass, rather than feeling thin or lightweight.',
    direction: 'DAC architecture has a large influence here. R-2R designs tend toward a denser presentation, while some delta-sigma implementations lean lighter. Amplifier topology matters too.',
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
    direction: 'R-2R and NOS DAC designs are often described as more flowing. Tube amplification tends to enhance continuity through its harmonic behavior. Reducing jitter can also help — timing irregularities break the sense of flow.',
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
    direction: 'High-resolution, low-noise DACs tend to reveal more texture. R-2R designs are sometimes praised for textural richness. Amplifier linearity at low levels matters — subtle cues can be masked by noise or crossover distortion.',
  },
  air: {
    interpretation: '"Air" is the sense of space and openness in the upper frequencies — the feeling that instruments exist in a real room with atmosphere around them.',
    direction: 'DACs with extended, clean treble without peaking contribute to air. So do open-back headphones and speakers with good high-frequency dispersion. Room treatment can help by reducing reflections that smear spatial cues.',
  },
  openness: {
    interpretation: '"Openness" describes a sense of spaciousness and lack of constriction — the feeling that the music isn\'t boxed in.',
    direction: 'This is shaped by speaker and room interaction as much as electronics. Open-back headphones are inherently more open-sounding. In speakers, dispersion pattern and crossover design contribute.',
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

function productCharacter(product: Product): string {
  const traits = product.traits;

  // Gather strong traits (≥ 0.7) in human-readable form
  const strengths: string[] = [];
  for (const [key, label] of Object.entries(TRAIT_LABELS)) {
    if ((traits[key] ?? 0) >= 0.7) strengths.push(label);
  }

  // Gather risk traits for nuance
  const risks: string[] = [];
  if ((traits.fatigue_risk ?? 0) >= 0.4) risks.push('some listening fatigue risk in bright systems');
  if ((traits.glare_risk ?? 0) >= 0.4) risks.push('a touch of upper-frequency edge');

  let char = `${product.description} It uses ${product.architecture}`;
  if (strengths.length > 0) {
    const last = strengths.pop()!;
    const list = strengths.length > 0
      ? `${strengths.join(', ')} and ${last}`
      : last;
    char += `, and its design leans toward ${list}.`;
  } else {
    char += '.';
  }

  if (risks.length > 0) {
    char += ` Worth noting: ${risks.join('; ')}.`;
  }

  return char;
}

function brandCharacter(brandName: string): string {
  return `I don't have a detailed profile for that specific model, but ${brandName} has a recognizable design approach. How it sounds in practice depends heavily on what it's paired with and what the listener prioritizes.`;
}

// ── Follow-up questions ──────────────────────────────

const DESIRE_CLARIFICATIONS = [
  'What does the rest of your system look like? That would help narrow down where the shift is most likely to come from.',
  'Is this about a specific system? Knowing what you\'re pairing with would help me gauge direction.',
  'Are you open to changes elsewhere in the chain, or is the source the piece you want to move on?',
];

const INQUIRY_CLARIFICATIONS = [
  'What kind of system would it be going into, and what do you value most in your listening?',
  'Are you considering it for a specific setup, or more exploring what its character would bring?',
  'What are you pairing it with? The rest of the chain shapes the experience more than any single component.',
];

const COMPARISON_CLARIFICATIONS = [
  'What matters most to you — engagement and rhythm, or refinement and tonal beauty?',
  'What system would these be going into? The pairing often determines which design philosophy wins.',
  'Is there something about your current setup you\'re hoping to shift?',
];

const GENERIC_CLARIFICATIONS = [
  'What are you pairing it with, and what do you value most in your listening?',
  'Are you exploring options, or considering this for a specific system?',
];

function pick(options: string[], seed: number): string {
  return options[seed % options.length];
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
          bullets.push(`You seem to be looking for more ${desireLabel} and ${secLabel}`);
        } else {
          bullets.push(`You seem to prefer ${desireLabel} over ${secLabel}`);
        }
      } else {
        bullets.push(`You seem to want more ${desireLabel} from your system`);
      }
    } else {
      bullets.push(`You seem to want less ${desireLabel} — looking to pull back there`);
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

  // Cap at 4 bullets
  return bullets.slice(0, 4);
}

// ── Public API ───────────────────────────────────────

export function buildGearResponse(
  intent: UserIntent,
  subjects: string[],
  currentMessage: string,
  desires: DesireSignal[] = [],
): GearResponse | null {
  if (intent !== 'gear_inquiry' && intent !== 'comparison') return null;

  const products = findProducts(subjects);
  const seed = currentMessage.length;

  // Infer system direction from the user's message and known product
  const sysDir = inferSystemDirection(
    currentMessage,
    desires,
    products[0] ?? null,
  );

  // Build reflective "What I'm hearing" block
  const hearing = buildHearingBlock(intent, desires, products, sysDir);

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
    const a = products[0] ?? null;
    const b = products[1] ?? null;

    if (a && b) {
      const archetypeFrame = compareProductArchetypes(a, b);
      return {
        intent,
        subjects,
        anchor: withTendency(`The ${a.brand} ${a.name} and ${b.brand} ${b.name} come from quite different design traditions.`),
        character: `${archetypeFrame} The ${a.name} uses ${a.architecture} — ${a.description.charAt(0).toLowerCase() + a.description.slice(1)} The ${b.name} uses ${b.architecture} — ${b.description.charAt(0).toLowerCase() + b.description.slice(1)}`,
        interpretation: desires.length > 0
          ? QUALITY_PROFILES[desires[0].quality]?.interpretation
          : undefined,
        direction: withDirection(buildComparisonDirection(a, b)),
        clarification: pick(COMPARISON_CLARIFICATIONS, seed),
        systemDirection: sysDir,
        hearing,
        userArchetype: sysDir.inferredArchetype
        ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
        : undefined,
      };
    }

    if (subjects.length >= 2) {
      return {
        intent,
        subjects,
        anchor: withTendency('Those come from different corners of the market.'),
        character: 'The comparison usually comes down to design philosophy — what each designer chose to prioritize. Architecture, feedback topology, and output stage all shape character differently.',
        interpretation: desires.length > 0
          ? QUALITY_PROFILES[desires[0].quality]?.interpretation
          : undefined,
        direction: withDirection('The most useful way to think about it is: what do you want more of in your listening, and which design approach tends to deliver that? A comparison that holds in one system may reverse in another.'),
        clarification: pick(COMPARISON_CLARIFICATIONS, seed),
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
      anchor: 'Comparisons always depend on context.',
      character: products.length > 0 ? productCharacter(products[0]) : 'Every component has a character — the question is how it interacts with your system.',
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

    return {
      intent,
      subjects,
      anchor: withTendency(`The ${productName} has a well-established character, and wanting ${primary.direction} ${primary.quality} from it tells me something useful about where you want to go.${archetypeContext}`),
      character: product
        ? productCharacter(product)
        : brandCharacter(productName),
      interpretation: profile?.interpretation
        ?? `When listeners ask for ${primary.direction} ${primary.quality}, the answer usually depends on where in the chain the limitation lives — and whether it's truly missing or being masked by something else.`,
      direction: withDirection(
        profile?.direction
          ?? 'The right path depends on the rest of the system and what trade-offs you\'re comfortable with. Sometimes the change you want comes from a different part of the chain than you\'d expect.'
      ),
      clarification: pick(DESIRE_CLARIFICATIONS, seed),
      systemDirection: sysDir,
      hearing,
      userArchetype: sysDir.inferredArchetype
        ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
        : undefined,
    };
  }

  // ── Pure gear inquiry (known product) ───────────────
  if (products.length > 0) {
    const product = products[0];
    return {
      intent,
      subjects,
      anchor: withTendency(`The ${product.brand} ${product.name} is a well-known piece in this space.`),
      character: productCharacter(product),
      direction: buildInquiryDirection(product, sysDir.inferredArchetype ?? undefined),
      clarification: pick(INQUIRY_CLARIFICATIONS, seed),
      systemDirection: sysDir,
      hearing,
      userArchetype: sysDir.inferredArchetype
        ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
        : undefined,
    };
  }

  // ── Brand mention, no specific product ──────────────
  if (subjects.length > 0) {
    const brandName = subjects[0].charAt(0).toUpperCase() + subjects[0].slice(1);
    return {
      intent,
      subjects,
      anchor: withTendency(`${brandName} is a name that comes up regularly in these conversations.`),
      character: brandCharacter(brandName),
      direction: 'The best way to evaluate any piece of gear is relative to the system it\'s going into. A component that sounds extraordinary in one system can be unremarkable in another — that\'s not a flaw, it\'s how audio works.',
      clarification: pick(GENERIC_CLARIFICATIONS, seed),
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
    anchor: 'That\'s a good question.',
    character: 'Every component has a character — a set of things it does well and things it trades away.',
    direction: 'What matters is how that character interacts with your system and your listening priorities. The same piece can sound relaxed in one system and forward in another.',
    clarification: pick(GENERIC_CLARIFICATIONS, seed),
    systemDirection: sysDir,
    hearing,
    userArchetype: sysDir.inferredArchetype
      ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
      : undefined,
  };
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
  const diffs: string[] = [];

  for (const [trait, phrases] of Object.entries(COMPARISON_PHRASES)) {
    const diff = (a.traits[trait] ?? 0) - (b.traits[trait] ?? 0);
    if (Math.abs(diff) >= 0.3) {
      diffs.push(diff > 0
        ? `the ${a.name} ${phrases.aLeads}`
        : `the ${b.name} ${phrases.bLeads}`);
    }
  }

  // Cap at 4 most distinctive differences to keep it readable
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

  // Identify the product's strongest trait dimension for context
  const strengths: string[] = [];
  if ((traits.rhythm ?? 0) >= 1.0 || (traits.dynamics ?? 0) >= 1.0) strengths.push('rhythmic and dynamic engagement');
  if ((traits.tonal_density ?? 0) >= 1.0) strengths.push('tonal richness');
  if ((traits.spatial_precision ?? 0) >= 1.0) strengths.push('spatial precision');
  if ((traits.clarity ?? 0) >= 1.0) strengths.push('transparency');
  if ((traits.flow ?? 0) >= 1.0) strengths.push('musical continuity');
  if ((traits.texture ?? 0) >= 1.0) strengths.push('textural realism');

  // Identify trade-offs (weak areas)
  const tradeoffs: string[] = [];
  if ((traits.clarity ?? 0) <= 0.4 && strengths.length > 0) tradeoffs.push('resolution');
  if ((traits.dynamics ?? 0) <= 0.4 && strengths.length > 0) tradeoffs.push('dynamic scale');
  if ((traits.spatial_precision ?? 0) <= 0.4 && strengths.length > 0) tradeoffs.push('imaging specificity');
  if ((traits.warmth ?? 0) <= 0.0 && (traits.clarity ?? 0) >= 0.7) tradeoffs.push('warmth');

  // Cautions
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

  parts.push('How well it works depends on the rest of the chain and what you prioritize in your listening.');

  return parts.join(' ');
}
