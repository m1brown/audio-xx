/**
 * Emergent behavior layer (Phase 2.5).
 *
 * Adds a narrow deterministic interaction layer to the system assessment.
 * Reads only fields that already exist on MemoFindings; emits at most a
 * short two-sentence paragraph (or empty string when not confident).
 *
 * Goal:
 *   Move the system narrative from "fast + fast + warm speaker = lean
 *   system corrected by speaker" toward "fast + low-friction + high-
 *   efficiency speaker = expressive, elastic, low-drag system."
 *
 * Boundaries (locked):
 *   - No MemoFindings shape change.
 *   - No routing, scoring, comparison, topology, or recommendation
 *     logic touched.
 *   - No LLM prose. All output is deterministic template composition.
 *   - Single insertion point: `composeAssessmentNarrative` inserts the
 *     returned string between SYSTEM READ (overview) and SYSTEM LOGIC.
 *   - Returns '' when skip conditions hold or no transform fires;
 *     the composer's `.filter()` then omits the section silently.
 *
 * Closed-set tag vocabulary:
 *   temporal_coherence | dynamic_elasticity | low_drag |
 *   harmonic_continuity | compression_resilience | presence_lift |
 *   system_tension_active | flow_continuity
 */

import type { MemoFindings, ComponentFindings } from './memo-findings';

// ── Closed-set tag vocabulary ──────────────────────────────────────

export type EmergentBehavior =
  | 'temporal_coherence'
  | 'dynamic_elasticity'
  | 'low_drag'
  | 'harmonic_continuity'
  | 'compression_resilience'
  | 'presence_lift'
  | 'system_tension_active'
  | 'flow_continuity';

export interface EmergentTransformResult {
  tag: EmergentBehavior;
  confidence: 'high' | 'medium';
  contributors: string[];
}

// ── Distinctness families ──────────────────────────────────────────
//
// When two tags fire, the second is dropped if it shares a family with
// the first. Per the user's adjustment: `low_drag + flow_continuity`
// and `temporal_coherence + flow_continuity` are redundant pairs.
// Acceptable pairs: dynamic_elasticity + low_drag, temporal_coherence
// + dynamic_elasticity, etc.

const FAMILY: Record<EmergentBehavior, ReadonlyArray<string>> = {
  temporal_coherence: ['coherence'],
  dynamic_elasticity: ['energy'],
  low_drag: ['motion'],
  harmonic_continuity: ['harmonic'],
  compression_resilience: ['physical'],
  presence_lift: ['energy'], // same family as dynamic_elasticity
  system_tension_active: ['contrast'],
  flow_continuity: ['motion', 'coherence'], // dedupes vs low_drag AND temporal_coherence
};

function isDistinct(a: EmergentBehavior, b: EmergentBehavior): boolean {
  const aFamilies = FAMILY[a];
  const bFamilies = FAMILY[b];
  for (const f of aFamilies) {
    if (bFamilies.includes(f)) return false;
  }
  return true;
}

// ── Priority order ─────────────────────────────────────────────────
//
// Stronger / more informative tags surface first. system_tension_active
// is the qualifier — when it fires, it MUST surface so the user isn't
// told a contrast system has "low drag" or "flow continuity."

const PRIORITY: EmergentBehavior[] = [
  'system_tension_active',
  'dynamic_elasticity',
  'low_drag',
  'harmonic_continuity',
  'temporal_coherence',
  'compression_resilience',
  'presence_lift',
  'flow_continuity',
];

// ── Architecture pattern matchers ──────────────────────────────────
//
// Each predicate reads `componentVerdicts[i].architecture` (an existing
// optional string field). Falls back to axis-based signals where the
// architecture string is missing. None of these patterns introduces new
// domain vocabulary — they all match existing brand-profile prose.

const ARCH_LOW_FEEDBACK = /\b(?:low[- ]?feedback|zero[- ]?feedback|class[- ]?a\b|goldmund|naim\s+slid)/i;
const ARCH_TUBE = /\b(?:tube|valve|single[- ]ended\s+triode|push[- ]?pull\s+tube|el34|kt77|kt88|2a3|300b|45\s+triode)\b/i;
const ARCH_R2R = /\br[- ]?2[- ]?r\b|\bladder\s+dac\b|\bdiscrete\s+ladder\b/i;
const ARCH_NOS = /\bnos[- ]?dac\b|\bnon[- ]oversampling\b/i;
const ARCH_FPGA = /\bfpga\b|\bpulse[- ]?array\b/i;
const ARCH_DELTA_SIGMA = /\bdelta[- ]?sigma\b|\bess\s+sabre\b|\bakm\s+dac\b/i;
const ARCH_HIGH_EFFICIENCY = /\b(?:high[- ]?efficiency|horn[- ]?loaded|horn\s+speaker|paper[- ]?cone|paper\s+driver|full[- ]?range|single[- ]?driver|compression\s+driver)\b/i;
const ARCH_BBC = /\b(?:bbc\s+(?:thin[- ]?wall|monitor|lineage|tradition)|thin[- ]?wall\s+cabinet|ls3\/5a)\b/i;
const ARCH_PLANAR = /\b(?:planar|electrostatic|ribbon|magnepan|martin\s*logan)\b/i;

function hasArchitecture(c: ComponentFindings, pattern: RegExp): boolean {
  if (!c.architecture) return false;
  return pattern.test(c.architecture);
}

function isHighEfficiencySpeaker(
  c: ComponentFindings,
  findings: MemoFindings,
): boolean {
  if (hasArchitecture(c, ARCH_HIGH_EFFICIENCY)) return true;
  // Power-match data gives us the speaker's sensitivity directly.
  const pm = findings.powerMatchAssessment;
  if (pm.speakerName === c.name && typeof pm.speakerSensitivityDb === 'number') {
    return pm.speakerSensitivityDb >= 92;
  }
  return false;
}

// ── Role helpers ───────────────────────────────────────────────────

function isAmplifier(c: ComponentFindings): boolean {
  const r = (c.role || '').toLowerCase();
  if (r === 'amplifier' || r === 'amp' || r === 'integrated' || r === 'preamp' || r === 'power-amp') return true;
  return (c.roles ?? []).some((x) => /amplifier|integrated|preamp/i.test(x));
}

function isDac(c: ComponentFindings): boolean {
  const r = (c.role || '').toLowerCase();
  if (r === 'dac') return true;
  return (c.roles ?? []).some((x) => x.toLowerCase() === 'dac');
}

function isSpeakerOrHeadphone(c: ComponentFindings): boolean {
  const r = (c.role || '').toLowerCase();
  return /speaker|monitor|headphone|cans|iem|earphone/.test(r);
}

function isSourceComponent(c: ComponentFindings): boolean {
  const r = (c.role || '').toLowerCase();
  return /streamer|source|transport|turntable|cdp/.test(r);
}

// ── Pick the canonical DAC / amp / speaker ─────────────────────────

function pickActiveDAC(findings: MemoFindings): ComponentFindings | null {
  const name = findings.activeDACInference.activeDACName;
  if (name) {
    const byName = findings.componentVerdicts.find((c) => c.name === name);
    if (byName) return byName;
  }
  return findings.componentVerdicts.find(isDac) ?? null;
}

function pickAmp(findings: MemoFindings): ComponentFindings | null {
  return findings.componentVerdicts.find(isAmplifier) ?? null;
}

function pickSpeaker(findings: MemoFindings): ComponentFindings | null {
  return findings.componentVerdicts.find(isSpeakerOrHeadphone) ?? null;
}

// ── 8 transforms ──────────────────────────────────────────────────
//
// Each transform reads only existing MemoFindings fields. Returns
// either a result with contributors (the names involved) or null.

type Transform = (findings: MemoFindings) => EmergentTransformResult | null;

const transformTemporalCoherence: Transform = (findings) => {
  const comps = findings.componentVerdicts;
  const detailedComps = comps.filter((c) => c.axisPosition.smooth_detailed === 'detailed');
  const controlledComps = comps.filter((c) => c.axisPosition.elastic_controlled === 'controlled');
  if (detailedComps.length < 2) return null;
  if (controlledComps.length > 0) return null; // a "controlled" link breaks temporal coherence
  const conf: 'high' | 'medium' =
    detailedComps.every((c) => c.confidence === 'high') ? 'high' : 'medium';
  return { tag: 'temporal_coherence', confidence: conf, contributors: detailedComps.map((c) => c.name) };
};

const transformDynamicElasticity: Transform = (findings) => {
  const amp = pickAmp(findings);
  const speaker = pickSpeaker(findings);
  if (!amp || !speaker) return null;
  const ampLowFriction =
    hasArchitecture(amp, ARCH_LOW_FEEDBACK) ||
    hasArchitecture(amp, ARCH_TUBE) ||
    // axis fallback: amp is elastic + not controlled-stiff
    (amp.axisPosition.elastic_controlled === 'elastic' &&
      amp.axisPosition.smooth_detailed !== 'detailed');
  if (!ampLowFriction) return null;
  if (!isHighEfficiencySpeaker(speaker, findings)) return null;
  return {
    tag: 'dynamic_elasticity',
    confidence: amp.confidence === 'low' || speaker.confidence === 'low' ? 'medium' : 'high',
    contributors: [amp.name, speaker.name],
  };
};

const transformLowDrag: Transform = (findings) => {
  const dac = pickActiveDAC(findings);
  const amp = pickAmp(findings);
  const speaker = pickSpeaker(findings);
  if (!speaker) return null;
  const upstreamLowDrag =
    (dac && (hasArchitecture(dac, ARCH_R2R) || hasArchitecture(dac, ARCH_NOS) || hasArchitecture(dac, ARCH_FPGA))) ||
    (amp && (hasArchitecture(amp, ARCH_LOW_FEEDBACK) || hasArchitecture(amp, ARCH_TUBE)));
  if (!upstreamLowDrag) return null;
  if (!isHighEfficiencySpeaker(speaker, findings)) return null;
  const contributors = [dac?.name, amp?.name, speaker.name].filter((n): n is string => !!n);
  return { tag: 'low_drag', confidence: 'medium', contributors };
};

const transformHarmonicContinuity: Transform = (findings) => {
  const dac = pickActiveDAC(findings);
  const amp = pickAmp(findings);
  const speaker = pickSpeaker(findings);
  if (!speaker) return null;
  // Per user adjustment: FPGA NOT included. R2R/NOS for DAC; tube for amp.
  const dacQualifies = dac && (hasArchitecture(dac, ARCH_R2R) || hasArchitecture(dac, ARCH_NOS));
  const ampQualifies = amp && hasArchitecture(amp, ARCH_TUBE);
  const speakerQualifies =
    hasArchitecture(speaker, ARCH_BBC) ||
    hasArchitecture(speaker, ARCH_HIGH_EFFICIENCY); // covers paper/full-range/horn
  if (!speakerQualifies) return null;
  if (!dacQualifies && !ampQualifies) return null;
  const contributors = [dac?.name, amp?.name, speaker.name].filter((n): n is string => !!n);
  return { tag: 'harmonic_continuity', confidence: 'medium', contributors };
};

const transformCompressionResilience: Transform = (findings) => {
  const pm = findings.powerMatchAssessment;
  if (pm.compatibility !== 'optimal') return null;
  if (pm.estimatedMaxCleanSPL == null || pm.estimatedMaxCleanSPL < 105) return null;
  if (!pm.ampName || !pm.speakerName) return null;
  return { tag: 'compression_resilience', confidence: 'high', contributors: [pm.ampName, pm.speakerName] };
};

const transformPresenceLift: Transform = (findings) => {
  const speaker = pickSpeaker(findings);
  if (!speaker) return null;
  if (!isHighEfficiencySpeaker(speaker, findings)) return null;
  const upstream = findings.componentVerdicts.filter((c) => isDac(c) || isAmplifier(c));
  const hasBrightDetailedUpstream = upstream.some(
    (c) => c.axisPosition.warm_bright === 'bright' || c.axisPosition.smooth_detailed === 'detailed',
  );
  if (!hasBrightDetailedUpstream) return null;
  // Only fires when system_tension_active is NOT also true — checked at selection time.
  return { tag: 'presence_lift', confidence: 'medium', contributors: [speaker.name] };
};

const transformSystemTensionActive: Transform = (findings) => {
  if (findings.isCoherent) return null;
  const upstream = findings.componentVerdicts.filter((c) => isDac(c) || isAmplifier(c));
  const downstream = findings.componentVerdicts.filter(isSpeakerOrHeadphone);
  if (upstream.length === 0 || downstream.length === 0) return null;

  // Specialist-pairing exception. When the chain has a low-feedback or
  // tube amp paired with a high-efficiency / horn / paper-cone speaker,
  // the upstream/downstream axis contrast is *intentional voicing* — the
  // amp deliberately stays lean so the speaker carries body and the
  // dynamic envelope. This is the SET + horn / Pass + high-efficiency /
  // JOB + WLM / Audio Note + Snell pattern. The system reads as
  // dynamic_elasticity (speed converted into elastic motion), not as
  // random tension between mismatched components. Skip the tension tag
  // so dynamic_elasticity / low_drag surface as the primary reading.
  const amp = upstream.find(isAmplifier);
  const speaker = downstream[0];
  if (amp && speaker) {
    const lowFrictionAmp =
      hasArchitecture(amp, ARCH_LOW_FEEDBACK) || hasArchitecture(amp, ARCH_TUBE);
    const highEfficiency = isHighEfficiencySpeaker(speaker, findings);
    if (lowFrictionAmp && highEfficiency) return null;
  }

  const upBright = upstream.some((c) => c.axisPosition.warm_bright === 'bright');
  const upWarm = upstream.some((c) => c.axisPosition.warm_bright === 'warm');
  const downBright = downstream.some((c) => c.axisPosition.warm_bright === 'bright');
  const downWarm = downstream.some((c) => c.axisPosition.warm_bright === 'warm');
  const sharpContrast = (upBright && downWarm) || (upWarm && downBright);
  if (!sharpContrast) return null;
  return {
    tag: 'system_tension_active',
    confidence: 'medium',
    contributors: [...upstream, ...downstream].map((c) => c.name),
  };
};

const transformFlowContinuity: Transform = (findings) => {
  const elasticComps = findings.componentVerdicts.filter(
    (c) => c.axisPosition.elastic_controlled === 'elastic',
  );
  if (elasticComps.length < 3) return null;
  return {
    tag: 'flow_continuity',
    confidence: 'medium',
    contributors: elasticComps.map((c) => c.name),
  };
};

const TRANSFORMS: Transform[] = [
  transformSystemTensionActive,
  transformDynamicElasticity,
  transformLowDrag,
  transformHarmonicContinuity,
  transformTemporalCoherence,
  transformCompressionResilience,
  transformPresenceLift,
  transformFlowContinuity,
];

// ── Skip conditions ────────────────────────────────────────────────

function shouldSkip(findings: MemoFindings): boolean {
  if (findings.componentVerdicts.length < 3) return true;
  if (findings.bottleneck !== null) return true;
  const pm = findings.powerMatchAssessment;
  if (pm.compatibility === 'strained' || pm.compatibility === 'mismatched') return true;
  const confidentCount = findings.componentVerdicts.filter(
    (c) => c.confidence === 'medium' || c.confidence === 'high',
  ).length;
  if (confidentCount < 2) return true;
  // Need at least one of: DAC, amp, speaker — preferably all three for the
  // sentence-2 template. Refuse to emit if the canonical chain isn't formed.
  if (!pickSpeaker(findings)) return true;
  return false;
}

// ── Selection: top-1 with optional distinct second ─────────────────

export function selectEmergentTags(
  fired: EmergentTransformResult[],
): EmergentTransformResult[] {
  if (fired.length === 0) return [];
  const byTag = new Map<EmergentBehavior, EmergentTransformResult>();
  for (const r of fired) byTag.set(r.tag, r);
  const ordered = PRIORITY.map((t) => byTag.get(t)).filter((r): r is EmergentTransformResult => !!r);
  if (ordered.length === 0) return [];
  const tension = ordered.find((r) => r.tag === 'system_tension_active');
  if (tension) {
    // Suppress presence_lift when tension is active (rule on transformPresenceLift)
    const filtered = ordered.filter((r) => r.tag !== 'presence_lift');
    // Tension must surface first. Try one distinct partner.
    const partner = filtered.find((r) => r.tag !== 'system_tension_active' && isDistinct(tension.tag, r.tag));
    return partner ? [tension, partner] : [tension];
  }
  const first = ordered[0];
  const second = ordered.slice(1).find((r) => isDistinct(first.tag, r.tag));
  return second ? [first, second] : [first];
}

// ── Component label & contribution phrase ─────────────────────────

const GENERIC_SUFFIX = /\b(?:integrated(?:\s+amplifier)?|monitor(?:s)?|speaker(?:s)?|amp(?:lifier)?|preamp(?:lifier)?|dac|streamer|player|cdp|transport|headphones?|cans|earphones?|iems?|turntable|cartridge)\s*$/i;

// Short all-caps model designators that read poorly as bare labels:
// Roman numerals ("II", "III", "IV"), caps-only suffixes ("SE", "MK2",
// "XR"). Length 1–4 chars, [A-Z] start, [A-Z0-9] remainder. Lowercase
// model words ("Hugo", "Diva") DO NOT match — they keep their bare form.
const DESIGNATOR_RE = /^[A-Z][A-Z0-9]{0,3}$/;

function shortLabel(name: string): string {
  const stripped = name.replace(GENERIC_SUFFIX, '').trim();
  const words = stripped.length > 0 ? stripped.split(/\s+/) : name.split(/\s+/);
  if (words.length === 0) return name;
  if (words.length === 1) return words[0];
  const last = words[words.length - 1];

  // Case 1 — last word is a trailing model number with digit+dash
  // ("DMP-A6", "12th-1"). Fall back to the prior word, paired with a
  // designator if one sits between (e.g. "Pontus II 12th-1" → "Pontus II").
  if (/[0-9]/.test(last) && /[-]/.test(last) && words.length >= 2) {
    const second = words[words.length - 2];
    if (words.length >= 3 && DESIGNATOR_RE.test(second)) {
      return `${words[words.length - 3]} ${second}`;
    }
    return second;
  }

  // Case 2 — last word is itself a short model designator ("II", "SE",
  // "MK2"). Pair with the prior word so the label preserves the
  // human-readable model name (Phase 2.6 polish, 2026-05-14).
  //   "Denafrips Pontus II" → "Pontus II"  (not bare "II")
  //   "WLM Diva Monitor"    → strip "Monitor" → "Diva" (regex rejects
  //                           lowercase, so unchanged)
  //   "Chord Hugo"          → "Hugo" (regex rejects lowercase)
  if (words.length >= 2 && DESIGNATOR_RE.test(last)) {
    return `${words[words.length - 2]} ${last}`;
  }

  return last;
}

function dacContribution(c: ComponentFindings): string {
  const label = shortLabel(c.name);
  if (hasArchitecture(c, ARCH_FPGA)) return `${label}'s timing precision`;
  if (hasArchitecture(c, ARCH_R2R)) return `${label}'s harmonic density`;
  if (hasArchitecture(c, ARCH_NOS)) return `${label}'s direct conversion`;
  if (hasArchitecture(c, ARCH_DELTA_SIGMA)) return `${label}'s transparent feed`;
  return `${label}'s conversion stage`;
}

function ampContribution(c: ComponentFindings): string {
  const label = shortLabel(c.name);
  if (hasArchitecture(c, ARCH_LOW_FEEDBACK)) return `the ${label}'s low-friction output`;
  if (hasArchitecture(c, ARCH_TUBE)) return `the ${label}'s harmonic body`;
  // axis fallback for elastic amps
  if (c.axisPosition.elastic_controlled === 'elastic') return `the ${label}'s low-friction output`;
  return `the ${label}'s amplification`;
}

function speakerContribution(c: ComponentFindings, findings: MemoFindings): string {
  const label = shortLabel(c.name);
  if (hasArchitecture(c, ARCH_BBC)) return `the ${label}'s BBC-monitor restraint`;
  if (hasArchitecture(c, ARCH_PLANAR)) return `the ${label}'s planar transparency`;
  if (isHighEfficiencySpeaker(c, findings)) return `the ${label}'s high-efficiency driver`;
  return `the ${label}'s final voicing`;
}

// ── Outcome and quality phrases per tag ────────────────────────────

const OUTCOME: Record<EmergentBehavior, string> = {
  // Sentence 1 "because" clause — what the system does, conceptually.
  dynamic_elasticity: 'speed is converted into elastic motion rather than edge',
  low_drag: 'low stored energy and fast recovery keep musical energy moving through the chain',
  temporal_coherence: 'transient timing stays continuous through the chain',
  harmonic_continuity: 'harmonic structure stays continuous from source to room',
  compression_resilience: 'the speaker reaches loud levels well within the amp\'s clean output',
  presence_lift: 'upstream detail surfaces as expressive energy rather than analytical edge',
  system_tension_active: 'two opposing voicings stay in tension without either dominating',
  flow_continuity: 'the chain breathes through musical phrasing rather than gripping it',
};

const QUALITY: Record<EmergentBehavior, string> = {
  // Sentence 2 "so" clause — what the listener hears as a result.
  dynamic_elasticity: 'microdynamics stay lively, quick, and sweet instead of merely lean',
  low_drag: 'note attacks land cleanly and decays release without the chain getting in the way',
  temporal_coherence: 'attack and decay stay coherent across instruments',
  harmonic_continuity: 'tonal density carries through instead of being filtered',
  compression_resilience: 'dynamic peaks land without compression at typical listening levels',
  presence_lift: 'presence-region detail arrives with expressive contrast, not glare',
  system_tension_active: 'each component\'s voice is audible — the system is two perspectives in one room',
  flow_continuity: 'rhythmic phrasing carries through without stalling on transients',
};

// ── Composition ────────────────────────────────────────────────────

function composeChainHeader(
  dac: ComponentFindings | null,
  amp: ComponentFindings | null,
  speaker: ComponentFindings,
): string {
  const labels: string[] = [];
  if (dac) labels.push(shortLabel(dac.name));
  if (amp) labels.push(shortLabel(amp.name));
  labels.push(shortLabel(speaker.name));
  return labels.join('/');
}

/**
 * Shared selector — runs skip + fire + suppress + select, returns the
 * structured tag results. Used by both `composeEmergentBehavior` (for
 * the rendered paragraph) and `getEmergentTags` (for the SYSTEM READ
 * calibration override in `composeAssessmentNarrative`).
 */
function selectEmergentForFindings(findings: MemoFindings): EmergentTransformResult[] {
  if (shouldSkip(findings)) return [];
  const fired: EmergentTransformResult[] = [];
  for (const t of TRANSFORMS) {
    const r = t(findings);
    if (r) fired.push(r);
  }
  const hasTension = fired.some((r) => r.tag === 'system_tension_active');
  const filtered = hasTension ? fired.filter((r) => r.tag !== 'presence_lift') : fired;
  return selectEmergentTags(filtered);
}

/**
 * Tags that indicate intentional synergy — when present, the SYSTEM
 * READ thesis should NOT use corrective "speaker compensates" framing.
 *
 * `system_tension_active` is deliberately EXCLUDED — when tension fires
 * the system genuinely is in contrast and the corrective framing is
 * accurate.
 */
export const INTENTIONAL_SYNERGY_TAGS: ReadonlyArray<EmergentBehavior> = [
  'dynamic_elasticity',
  'low_drag',
  'temporal_coherence',
  'harmonic_continuity',
  'flow_continuity',
];

/**
 * Returns the selected emergent tags for a findings object, or [] when
 * no transform fires or skip conditions hold. Used by the SYSTEM READ
 * calibration in `composeAssessmentNarrative` to decide whether to swap
 * corrective phrasing for intentional-synergy phrasing.
 *
 * Same selection logic as `composeEmergentBehavior` — both go through
 * `selectEmergentForFindings`.
 */
export function getEmergentTags(findings: MemoFindings): EmergentBehavior[] {
  return selectEmergentForFindings(findings).map((r) => r.tag);
}

/**
 * Convert a set of emergent tags into a short noun phrase describing
 * the system's intentional voicing. Used by the SYSTEM READ override
 * (and the SYSTEM LOGIC summary override) in
 * `composeAssessmentNarrative` so the override reads naturally for the
 * specific tags that fired.
 *
 * Examples:
 *   ['dynamic_elasticity', 'low_drag']        → "speed, elasticity, and tonal body"
 *   ['dynamic_elasticity']                    → "speed and elasticity"
 *   ['harmonic_continuity']                   → "harmonic continuity"
 *   ['temporal_coherence', 'dynamic_elasticity'] → "speed, elasticity, and temporal coherence"
 *   []                                        → "deliberate synergy" (defensive default)
 */
export function synergyDescriptor(tags: ReadonlyArray<EmergentBehavior>): string {
  const parts: string[] = [];
  const has = (t: EmergentBehavior) => tags.includes(t);
  if (has('dynamic_elasticity')) {
    parts.push('speed', 'elasticity');
  }
  if (has('harmonic_continuity')) {
    parts.push('harmonic continuity');
  }
  if (has('temporal_coherence') && !has('dynamic_elasticity')) {
    parts.push('temporal coherence');
  }
  if (has('low_drag') && parts.length === 0) {
    parts.push('low-drag energy transfer');
  }
  if (has('flow_continuity') && parts.length === 0) {
    parts.push('musical flow');
  }
  // Specialist-pairing cap: when elasticity is the primary tag and the
  // chain has either a low-drag or harmonic-continuity partner, add
  // "tonal body" — that's the speaker's contribution to the synergy.
  if (has('dynamic_elasticity') && (has('low_drag') || has('harmonic_continuity'))) {
    parts.push('tonal body');
  }
  if (parts.length === 0) return 'deliberate synergy';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * Compose the emergent-behavior paragraph for a deterministic system
 * assessment. Returns '' when no transform fires or skip conditions
 * hold — the upstream composer's `.filter()` then omits the section.
 *
 * Output shape (when emitted):
 *
 *   **Emergent behavior**
 *
 *   The <chain> chain works because <outcome>. <dac-contribution> and
 *   <amp-contribution> feed <speaker-contribution>, so <quality>.
 *
 * The header is fixed. The two sentences are composed by selecting
 * the top-priority tag (and optionally one distinct partner tag) and
 * filling the per-component contribution phrases.
 */
export function composeEmergentBehavior(findings: MemoFindings): string {
  const selected = selectEmergentForFindings(findings);
  if (selected.length === 0) return '';

  const primary = selected[0];
  const partner = selected[1];

  const dac = pickActiveDAC(findings);
  const amp = pickAmp(findings);
  const speaker = pickSpeaker(findings);
  if (!speaker) return ''; // shouldSkip already covers this; defensive

  const chain = composeChainHeader(dac, amp, speaker);

  // Sentence 1: outcome from primary tag.
  const sentence1 = `The ${chain} chain works because ${OUTCOME[primary.tag]}.`;

  // Sentence 2: contribution chain + quality from primary tag.
  const parts: string[] = [];
  if (dac) parts.push(dacContribution(dac));
  if (amp) parts.push(ampContribution(amp));
  const speakerPart = speakerContribution(speaker, findings);

  let contributionsClause: string;
  if (parts.length === 2) {
    contributionsClause = `${parts[0]} and ${parts[1]} feed ${speakerPart}`;
  } else if (parts.length === 1) {
    contributionsClause = `${parts[0]} feeds ${speakerPart}`;
  } else {
    contributionsClause = `${speakerPart} carries the chain`;
  }

  let sentence2 = `${contributionsClause[0].toUpperCase()}${contributionsClause.slice(1)}, so ${QUALITY[primary.tag]}.`;

  // Partner tag: append as a short additional observation only when the
  // partner adds a distinct concept (already enforced by selectEmergentTags).
  let sentence3 = '';
  if (partner) {
    sentence3 = ` ${capitalize(OUTCOME[partner.tag])}.`;
  }

  return [`**Emergent behavior**`, ``, `${sentence1} ${sentence2}${sentence3}`].join('\n');
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

// Exported for tests.
export const __TEST__ = {
  TRANSFORMS,
  shouldSkip,
  shortLabel,
  isDistinct,
  PRIORITY,
};
