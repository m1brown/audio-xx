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
import type { ActiveSystemContext } from './system-types';
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

// ── Product lookup ───────────────────────────────────

const ALL_PRODUCTS: Product[] = [...DAC_PRODUCTS, ...SPEAKER_PRODUCTS];

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
  naturalness: {
    interpretation: '"Naturalness" is about believable timbre — instruments and voices sounding like themselves, without electronic artifact or tonal editorialising. A natural-sounding system doesn\'t draw attention to its own character.',
    direction: 'Naturalness tends to emerge from low distortion without excessive analytical lean. R-2R DACs and well-implemented tube stages are often cited, but it\'s more about the absence of artifice than a specific topology. Power quality and low-jitter clocking contribute by removing subtle grit that breaks the illusion.',
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
    direction: 'Tube output stages are the classic source of sweetness. Some R-2R DACs also produce it through their harmonic profile. The trade-off is that excessive sweetness can round off transient precision and veil micro-detail.',
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
function productCharacter(product: Product, desireQualities: string[] = []): string {
  // ── Tendency-driven path ──────────────────────────
  if (hasTendencies(product.tendencies)) {
    const tendencies = desireQualities.length > 0
      ? selectCharacterTendencies(product.tendencies.character, desireQualities)
      : selectDefaultTendencies(product.tendencies.character);

    const parts: string[] = [`${product.architecture} design.`];
    for (const t of tendencies) {
      const text = t.tendency.charAt(0).toUpperCase() + t.tendency.slice(1);
      parts.push(t.context ? `${text} — ${t.context}.` : `${text}.`);
    }

    const risks = buildRiskNotes(product);
    if (risks) parts.push(risks);

    return parts.join(' ');
  }

  // ── Qualitative profile path (high/medium only) ───
  if (hasExplainableProfile(product.tendencyProfile)) {
    const emphasized = getEmphasizedTraits(product.tendencyProfile);
    const lessEmphasized = getLessEmphasizedTraits(product.tendencyProfile);
    const conf = product.tendencyProfile.confidence;

    const parts: string[] = [`${product.architecture} design.`];
    if (emphasized.length > 0) {
      const list = emphasized.join(' and ');
      parts.push(confidenceFrame(conf, list, 'emphasize'));
    }
    if (lessEmphasized.length > 0) {
      const list = lessEmphasized.slice(0, 2).join(' and ');
      parts.push(`Less of a priority: ${list}.`);
    }

    const risks = buildRiskNotes(product);
    if (risks) parts.push(risks);

    return parts.join(' ');
  }

  // ── Design archetype fallback ─────────────────────
  const archetype = resolveArchetype(product.architecture);
  if (archetype) {
    const charSentence = archetypeCharacter(archetype);
    if (charSentence) {
      const parts: string[] = [`${product.architecture} design.`, charSentence];
      const risks = buildRiskNotes(product);
      if (risks) parts.push(risks);
      return parts.join(' ');
    }
  }

  // ── Legacy fallback: description + trait labels ───
  const traits = product.traits;

  const strengths: string[] = [];
  for (const [key, label] of Object.entries(TRAIT_LABELS)) {
    if ((traits[key] ?? 0) >= 0.7) strengths.push(label);
  }

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

  const risks = buildRiskNotes(product);
  if (risks) char += ` ${risks}`;

  return char;
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

/**
 * Pick a clarification — prefers the churn reflective question when
 * churn is detected and no explicit desires are present.
 */
function pickClarification(
  options: string[],
  seed: number,
  churn: ChurnSignal,
  hasDesires: boolean,
): string {
  if (churn.detected && churn.reflectiveQuestion && !hasDesires) {
    return churn.reflectiveQuestion;
  }
  return pick(options, seed);
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
    const a = products[0] ?? null;
    const b = products[1] ?? null;

    if (a && b) {
      const archetypeFrame = compareProductArchetypes(a, b);
      const systemNote = buildSystemComparisonNote(a, b, activeSystem);

      // Build system-aware anchor — when a system is selected, frame the
      // comparison in the context of what it would change in the system
      const baseAnchor = systemNote
        ? `${systemNote} Here is how the two compare.`
        : `The ${a.brand} ${a.name} and ${b.brand} ${b.name} come from quite different design traditions.`;

      // Build system-aware direction — add chain interaction note
      let directionText = withDirection(buildComparisonDirection(a, b));
      if (activeSystem && activeSystem.components.length > 0) {
        // Check if this is an upgrade within the same brand lineage
        if (a.brand === b.brand) {
          directionText += ` Since both share the ${a.brand} ${a.architecture} architecture, the change would likely be one of scale and refinement rather than philosophical shift.`;
        }
      }

      return {
        intent,
        subjects,
        anchor: withTendency(baseAnchor),
        character: `${archetypeFrame} ${productCharacter(a, desires.length > 0 ? [desires[0].quality] : [])} ${productCharacter(b, desires.length > 0 ? [desires[0].quality] : [])}`,
        interpretation: desires.length > 0
          ? QUALITY_PROFILES[desires[0].quality]?.interpretation
          : undefined,
        direction: directionText,
        clarification: systemNote
          ? 'What specific quality are you hoping this change would improve in your system?'
          : pick(COMPARISON_CLARIFICATIONS, seed),
        systemDirection: sysDir,
        hearing,
        userArchetype: sysDir.inferredArchetype
        ? { primary: sysDir.inferredArchetype.primary, secondary: sysDir.inferredArchetype.secondary, blended: false }
        : undefined,
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
      };
    }

    // Fully unknown comparison: neither product in catalog
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
        ? productCharacter(product, [primary.quality])
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
      clarification: pickClarification(INQUIRY_CLARIFICATIONS, seed, churn, desires.length > 0),
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
      clarification: pickClarification(GENERIC_CLARIFICATIONS, seed, churn, desires.length > 0),
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
    clarification: pickClarification(GENERIC_CLARIFICATIONS, seed, churn, desires.length > 0),
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
