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

// ── Product lookup ───────────────────────────────────

const ALL_PRODUCTS: Product[] = [...DAC_PRODUCTS];

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

// ── Character builders ───────────────────────────────

function productCharacter(product: Product): string {
  const traits = product.traits;
  const leanings: string[] = [];

  if ((traits.flow ?? 0) >= 0.7) leanings.push('musical flow');
  if ((traits.tonal_density ?? 0) >= 0.7) leanings.push('tonal weight');
  if ((traits.clarity ?? 0) >= 0.7) leanings.push('clarity');
  if ((traits.dynamics ?? 0) >= 0.7) leanings.push('dynamic energy');
  if ((traits.texture ?? 0) >= 0.7) leanings.push('textural detail');
  if ((traits.composure ?? 0) >= 0.7) leanings.push('composure');

  let char = `${product.description} It uses ${product.architecture}`;
  if (leanings.length > 0) {
    char += `, and its design leans toward ${leanings.join(' and ')}.`;
  } else {
    char += '.';
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

  // ── Comparison ──────────────────────────────────────
  if (intent === 'comparison') {
    const a = products[0] ?? null;
    const b = products[1] ?? null;

    if (a && b) {
      return {
        intent,
        subjects,
        anchor: `The ${a.brand} ${a.name} and ${b.brand} ${b.name} come from quite different design traditions.`,
        character: `The ${a.name} uses ${a.architecture} — ${a.description.charAt(0).toLowerCase() + a.description.slice(1)} The ${b.name} uses ${b.architecture} — ${b.description.charAt(0).toLowerCase() + b.description.slice(1)}`,
        interpretation: desires.length > 0
          ? QUALITY_PROFILES[desires[0].quality]?.interpretation
          : undefined,
        direction: buildComparisonDirection(a, b),
        clarification: pick(COMPARISON_CLARIFICATIONS, seed),
      };
    }

    if (subjects.length >= 2) {
      return {
        intent,
        subjects,
        anchor: 'Those come from different corners of the market.',
        character: 'The comparison usually comes down to design philosophy — what each designer chose to prioritize. Architecture, feedback topology, and output stage all shape character differently.',
        interpretation: desires.length > 0
          ? QUALITY_PROFILES[desires[0].quality]?.interpretation
          : undefined,
        direction: 'The most useful way to think about it is: what do you want more of in your listening, and which design approach tends to deliver that? A comparison that holds in one system may reverse in another.',
        clarification: pick(COMPARISON_CLARIFICATIONS, seed),
      };
    }

    return {
      intent,
      subjects,
      anchor: 'Comparisons always depend on context.',
      character: products.length > 0 ? productCharacter(products[0]) : 'Every component has a character — the question is how it interacts with your system.',
      direction: 'To make a useful comparison, I\'d need to know what you\'re comparing and what dimensions matter most. Two excellent components can be optimized for very different priorities.',
      clarification: 'What are you comparing, and what\'s driving the question?',
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

    return {
      intent,
      subjects,
      anchor: `The ${productName} has a well-established character, and wanting ${primary.direction} ${primary.quality} from it tells me something useful about where you want to go.`,
      character: product
        ? productCharacter(product)
        : brandCharacter(productName),
      interpretation: profile?.interpretation
        ?? `When listeners ask for ${primary.direction} ${primary.quality}, the answer usually depends on where in the chain the limitation lives — and whether it's truly missing or being masked by something else.`,
      direction: profile?.direction
        ?? 'The right path depends on the rest of the system and what trade-offs you\'re comfortable with. Sometimes the change you want comes from a different part of the chain than you\'d expect.',
      clarification: pick(DESIRE_CLARIFICATIONS, seed),
    };
  }

  // ── Pure gear inquiry (known product) ───────────────
  if (products.length > 0) {
    const product = products[0];
    return {
      intent,
      subjects,
      anchor: `The ${product.brand} ${product.name} is a well-known piece in this space.`,
      character: productCharacter(product),
      direction: buildInquiryDirection(product),
      clarification: pick(INQUIRY_CLARIFICATIONS, seed),
    };
  }

  // ── Brand mention, no specific product ──────────────
  if (subjects.length > 0) {
    const brandName = subjects[0].charAt(0).toUpperCase() + subjects[0].slice(1);
    return {
      intent,
      subjects,
      anchor: `${brandName} is a name that comes up regularly in these conversations.`,
      character: brandCharacter(brandName),
      direction: 'The best way to evaluate any piece of gear is relative to the system it\'s going into. A component that sounds extraordinary in one system can be unremarkable in another — that\'s not a flaw, it\'s how audio works.',
      clarification: pick(GENERIC_CLARIFICATIONS, seed),
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
  };
}

// ── Direction helpers ────────────────────────────────

function buildComparisonDirection(a: Product, b: Product): string {
  const diffs: string[] = [];

  const flowDiff = (a.traits.flow ?? 0) - (b.traits.flow ?? 0);
  if (Math.abs(flowDiff) >= 0.3) {
    diffs.push(flowDiff > 0
      ? `the ${a.name} leans more toward musical flow, while the ${b.name} is more measured`
      : `the ${b.name} leans more toward musical flow, while the ${a.name} is more measured`);
  }
  const clarityDiff = (a.traits.clarity ?? 0) - (b.traits.clarity ?? 0);
  if (Math.abs(clarityDiff) >= 0.3) {
    diffs.push(clarityDiff > 0
      ? `the ${a.name} emphasizes clarity more`
      : `the ${b.name} emphasizes clarity more`);
  }
  const densityDiff = (a.traits.tonal_density ?? 0) - (b.traits.tonal_density ?? 0);
  if (Math.abs(densityDiff) >= 0.3) {
    diffs.push(densityDiff > 0
      ? `the ${a.name} carries more tonal weight`
      : `the ${b.name} carries more tonal weight`);
  }

  if (diffs.length > 0) {
    return `In practice, ${diffs.join('; ')}. Neither is objectively better — they optimize for different things, and the right choice depends on what your system needs.`;
  }
  return 'They\'re closer in overall balance than you might expect given the architectural differences. The distinction is more about texture and presentation style than broad tonal character.';
}

function buildInquiryDirection(product: Product): string {
  const traits = product.traits;
  const cautions: string[] = [];

  if ((traits.fatigue_risk ?? 0) >= 0.4) cautions.push('it can lean forward in the treble, which may be fatiguing in brighter systems');
  if ((traits.glare_risk ?? 0) >= 0.4) cautions.push('there\'s some edge in the upper frequencies that could compound with bright amplification');

  if (cautions.length > 0) {
    return `Worth being aware of: ${cautions.join('; ')}. Whether that matters depends entirely on what it\'s paired with and what you prioritize.`;
  }

  return 'It\'s generally well-mannered across different system contexts, though how well it fits always depends on the rest of the chain and what you value in your listening.';
}
