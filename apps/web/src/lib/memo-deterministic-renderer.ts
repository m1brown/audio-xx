/**
 * Audio XX — Advisory Presentation Layer
 *
 * These files format deterministic reasoning output into the structured
 * system review shown to the user.
 *
 * Important:
 *   The reasoning engine remains the source of truth.
 *   This layer should only:
 *     - format advisory structure
 *     - apply narrative tone
 *     - render UI components
 *   Do NOT add reasoning logic here.
 *
 * ── Deterministic memo renderer ─────────────────────
 *
 * Assembles a ConsultationResponse from MemoFindings plus legacy prose
 * fields. This is the rendering layer — it does not contain reasoning
 * logic. All analysis happens in the deterministic pipeline upstream.
 *
 * ── Rendering paths (transition state) ─────────────────────────
 *
 * CANONICAL path (MemoFindings-only):
 *   renderDeterministicMemo(findings, prose)
 *   Structured fields (systemChain, constraint, assessments, etc.)
 *   are derived from MemoFindings via the map*() functions below.
 *   This is the path all new code should use.
 *
 * DEPRECATED path (StructuredMemoInputs):
 *   renderDeterministicMemo(findings, prose, structured)
 *   When the third argument is provided, its fields take precedence
 *   over the MemoFindings-derived values. This exists solely for
 *   behavioral parity during transition — the call site in
 *   consultation.ts still passes StructuredMemoInputs to avoid
 *   changing rendered output in a single step.
 *
 * REMOVAL plan:
 *   Once the MemoFindings-only path is validated in production,
 *   remove the `structured` parameter and StructuredMemoInputs,
 *   and update the call site in consultation.ts to use the
 *   two-argument form. The parity tests in integration-assessment
 *   confirm the two paths produce equivalent output.
 *
 * ── Prose inputs ───────────────────────────────────────────────
 *
 * LegacyProseInputs are pre-computed prose fields from the existing
 * builders (inferSystemCharacterOpening, inferSystemInteraction, etc.).
 * These are passed through as-is. Future: rewrite prose builders to
 * consume MemoFindings directly, eliminating this indirection.
 *
 * This function is the deterministic fallback for the LLM overlay.
 * If the LLM layer is unavailable or produces invalid output,
 * this renderer's output is what the user sees.
 */

import type { ConsultationResponse } from './consultation';
import type {
  MemoFindings,
  ComponentFindings,
} from './memo-findings';
import { LISTENER_PRIORITY_LABELS, type ListenerPriority } from './memo-findings';
import type {
  SystemChain,
  PrimaryConstraint,
  StackedTraitInsight,
  ComponentAssessment,
  UpgradePath,
  UpgradePathOption,
  KeepRecommendation,
  RecommendedStep,
  SourceReference,
  VerdictKind,
} from './advisory-response';

// ── Legacy prose inputs ────────────────────────────────
//
// These are the pre-computed prose fields from the existing builders.
// They are passed through as-is for behavioral stability.
// Future: these will be derived from MemoFindings directly.

export interface LegacyProseInputs {
  /** Display title for the assessment (e.g. "Living Room System"). */
  title?: string;
  /** Subject line (component names joined). */
  subject: string;
  /** System character opening (1-2 sentences). */
  systemCharacterOpening: string;
  /** Per-component character paragraphs. */
  componentParagraphs: string[];
  /** System interaction summary. */
  systemInteraction: string;
  /** Assessment strengths bullets. */
  assessmentStrengths: string[];
  /** Assessment limitations bullets. */
  assessmentLimitations: string[];
  /** Upgrade direction prose. */
  upgradeDirection: string;
  /** Follow-up question. */
  followUp: string;
  /** Collected links. */
  links: { label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }[];
  /** Intro summary (memo format). */
  introSummary: string;
  /** Key observation prose. */
  keyObservation: string;
}

// ── Structured memo inputs (DEPRECATED — transitional only) ──────
//
// @deprecated Use renderDeterministicMemo(findings, prose) without this
// parameter. The MemoFindings-only path derives all structured fields
// from findings via map*() functions, and parity tests confirm equivalent
// output. This interface exists only so the consultation.ts call site
// can transition without changing rendered output in a single step.
// Remove once the two-argument call is validated in production.

export interface StructuredMemoInputs {
  systemChain: SystemChain;
  primaryConstraint: PrimaryConstraint | undefined;
  stackedTraitInsights: StackedTraitInsight[];
  componentAssessments: ComponentAssessment[];
  upgradePaths: UpgradePath[];
  keepRecommendations: KeepRecommendation[];
  recommendedSequence: RecommendedStep[];
  sourceReferences: SourceReference[];
}

// ── MemoFindings → Advisory type mappers ─────────────────
//
// These functions translate from the structured MemoFindings types
// to the advisory-response display types. This is the bridge layer
// that allows the renderer to consume MemoFindings directly.

function mapSystemChain(findings: MemoFindings): SystemChain {
  return {
    roles: findings.systemChain.roles,
    names: findings.systemChain.names,
    fullChain: findings.systemChain.fullChain,
  };
}

function mapPrimaryConstraint(findings: MemoFindings): PrimaryConstraint | undefined {
  if (!findings.bottleneck) return undefined;
  const b = findings.bottleneck;
  // Build an explanation from the structured data
  const axisNote = b.constrainedAxes.length > 0
    ? ` Constrained axes: ${b.constrainedAxes.join(', ')}.`
    : '';
  return {
    componentName: b.component,
    category: b.category,
    explanation: `The ${b.component} is where the system has the most room to grow (${b.category.replace(/_/g, ' ')}).${axisNote}`,
  };
}

function mapStackedTraitInsights(findings: MemoFindings): StackedTraitInsight[] {
  return findings.stackedTraits.map((s) => {
    const contribs = s.contributors.join(' and ');
    const trait = s.property.replace(/_/g, ' ');

    // Confidence-calibrated stacking language (Feature 5)
    // high = assertive, medium = light hedge, low = clearly tentative
    let explanation: string;
    if (s.classification === 'system_character') {
      explanation = s.confidence === 'low'
        ? `${contribs} may share ${trait}, though component data is limited.`
        : s.confidence === 'medium'
        ? `${contribs} likely share ${trait} — a probable feature of this system's character.`
        : `${contribs} share ${trait} — a defining feature of this system's sonic identity.`;
    } else {
      explanation = s.confidence === 'low'
        ? `${contribs} may both push toward ${trait}, though this is based on limited data.`
        : s.confidence === 'medium'
        ? `${contribs} likely both push toward ${trait}.`
        : `${contribs} both push toward ${trait}.`;
    }

    return {
      label: s.property,
      contributors: s.contributors,
      classification: s.classification,
      explanation,
    };
  });
}

function mapVerdictKind(verdict: ComponentFindings['verdict']): VerdictKind {
  switch (verdict) {
    case 'bottleneck': return 'bottleneck';
    case 'upgrade': return 'upgrade_candidate';
    case 'keep': return 'keeper';
    case 'neutral': return 'balanced';
    default: return 'balanced';
  }
}

function mapComponentAssessments(findings: MemoFindings): ComponentAssessment[] {
  return findings.componentVerdicts.map((cv) => {
    // Map from MemoFindings verdict to constructive reviewer-style prose
    let verdict: string;
    let verdictKind: VerdictKind;

    // Confidence-calibrated hedging prefix (Feature 5)
    // high = no hedge, medium = light hedge, low = clearly tentative
    const hedge = cv.confidence === 'low' ? 'Based on limited data, '
      : cv.confidence === 'medium' ? 'Likely — ' : '';

    switch (cv.verdict) {
      case 'bottleneck':
        verdict = `${hedge}The ${cv.role || 'component'} is where the system has the most room to grow. Upgrading here would have the largest impact on overall performance.`;
        verdictKind = 'bottleneck';
        break;
      case 'keep':
        verdict = cv.weaknesses.length === 0
          ? `${hedge}Well matched to the rest of the chain. No strong reason to change.`
          : `${hedge}A meaningful contributor to the system's character. Well placed in this chain.`;
        verdictKind = 'keeper';
        break;
      case 'upgrade':
        verdict = `${hedge}Could be refined, though it's not the first priority in this system.`;
        verdictKind = 'upgrade_candidate';
        break;
      default:
        verdict = `${hedge}Solid at its tier. Doing its job within the chain.`;
        verdictKind = 'balanced';
    }
    return {
      name: cv.name,
      role: cv.role !== 'component' ? cv.role : undefined,
      summary: `${cv.name} (${cv.catalogSource} characterisation).`,
      strengths: cv.strengths,
      weaknesses: cv.weaknesses,
      verdict,
      verdictKind,
      links: cv.links,
    };
  });
}

/**
 * Build a fused substance sentence from tradeoff data.
 * Combines gains, sacrifices, and (when meaningful) preservation into 1–2 sentences.
 * Confidence governs verb strength (Playbook P5).
 *
 * Feature 8: replaces the old template-based "A {role} change {verb}: …" pattern.
 */
function buildSubstance(t: NonNullable<typeof undefined | import('./tradeoff-assessment').TradeoffAssessment>, targetAxes: string[]): string {
  if (!t || (t.likelyGains.length === 0 && t.likelySacrifices.length === 0)) {
    // Axis-only fallback when no tradeoff detail exists
    if (targetAxes.length > 0) {
      return `Would shift the ${targetAxes.map((a) => a.replace(/_/g, ' ')).join(' and ')} balance.`;
    }
    return '';
  }

  const gainsVerb = t.confidence === 'high' ? 'Should improve'
    : t.confidence === 'medium' ? 'Should improve'
    : 'May improve';
  const gainsPhrase = t.likelyGains.slice(0, 2).join(' and ');

  const sacrificePhrase = t.likelySacrifices.length > 0
    ? t.likelySacrifices.slice(0, 2).join(' and ')
    : '';

  // Build fused sentence: gains + sacrifices in one clause
  let substance: string;
  if (sacrificePhrase) {
    const sacrificeVerb = t.confidence === 'high' ? 'though'
      : t.confidence === 'medium' ? 'though'
      : 'though the effect on';
    substance = t.confidence === 'low'
      ? `${gainsVerb} ${gainsPhrase}, ${sacrificeVerb} ${sacrificePhrase} is uncertain.`
      : `${gainsVerb} ${gainsPhrase}, though ${sacrificePhrase} may decrease.`;
  } else {
    substance = `${gainsVerb} ${gainsPhrase}.`;
  }

  // Preservation note — only when it meaningfully offsets the sacrifice
  // or protects a strength that the sacrifice directly threatens.
  // Omit when: no sacrifices stated, or preserved strengths don't relate to the sacrifice.
  if (
    t.preservedStrengths.length > 0
    && t.likelySacrifices.length > 0
  ) {
    const preserved = t.preservedStrengths[0];
    substance += ` ${preserved.charAt(0).toUpperCase() + preserved.slice(1)} should remain intact.`;
  }

  return substance;
}

/**
 * Select at most one caution signal from the available assessments.
 * Priority order (Feature 8 approved design):
 *   1. Restraint reason (counterfactual)
 *   2. Protection reason (block/caution)
 *   3. netNegative (tradeoff)
 *   4. Overcorrection risk (counterfactual)
 *   5. Stable baseline note (counterfactual)
 *
 * Returns empty string when no caution is warranted.
 * Suppresses the "Tentatively:" prefix when tradeoff verb hedging
 * already conveys uncertainty (hasTradeoff = true).
 */
function selectCaution(
  t: import('./tradeoff-assessment').TradeoffAssessment | undefined,
  prot: import('./preference-protection').PreferenceProtectionResult | undefined,
  cf: import('./counterfactual-assessment').CounterfactualAssessment | undefined,
  hasTradeoff: boolean,
): string {
  // 1. Restraint reason — strongest signal
  if (cf?.restraintRecommended && cf.restraintReason) {
    const hedge = (!hasTradeoff && cf.confidence === 'low') ? 'Tentatively: ' : '';
    return `${hedge}${cf.restraintReason}`;
  }

  // 2. Protection reason (caution only — block is handled separately)
  if (prot && prot.verdict === 'caution' && prot.reason) {
    return prot.reason;
  }

  // 3. netNegative
  if (t?.netNegative) {
    return 'Consider whether this change is necessary — the trade-offs may outweigh the gains.';
  }

  // 4. Overcorrection risk
  if (cf?.overcorrectionRisk.present && cf.overcorrectionRisk.reason) {
    const hedge = (!hasTradeoff && cf.confidence === 'low') ? 'Tentatively: ' : '';
    return `${hedge}${cf.overcorrectionRisk.reason}`;
  }

  // 5. Stable baseline note — weakest
  if (cf?.baseline === 'stable') {
    const hedge = (!hasTradeoff && cf.confidence === 'low') ? 'Tentatively: ' : '';
    return `${hedge}The current system balance is working — change is optional.`;
  }

  return '';
}

function mapUpgradePaths(findings: MemoFindings): UpgradePath[] {
  const systemAxes = findings.systemAxes;

  return findings.upgradePaths.map((p) => {
    const t = p.tradeoff;
    const prot = p.protection;
    const cf = p.counterfactual;
    const hasTradeoff = !!(t && (t.likelyGains.length > 0 || t.likelySacrifices.length > 0));

    // ── Assemble rationale (Feature 8 — unified voice) ──
    let rationale: string;

    if (prot && prot.verdict === 'block') {
      // Block verdict replaces entire rationale — no substance, no strategyIntent
      rationale = `Not recommended given your stated preference for ${prot.threats.map((t) => t.label).join(' and ')}. ${prot.reason}`;
    } else if (hasTradeoff) {
      // Substance from tradeoff — strategyIntent suppressed (label carries direction)
      const substance = buildSubstance(t!, p.targetAxes);
      const caution = selectCaution(t, prot, cf, true);
      rationale = caution ? `${substance} ${caution}` : substance;
    } else {
      // No tradeoff data — use strategyIntent as the rationale
      const fallback = p.strategyIntent
        ?? `Would shift the ${p.targetAxes.map((a) => a.replace(/_/g, ' ')).join(' and ')} balance.`;
      const caution = selectCaution(t, prot, cf, false);
      rationale = caution ? `${fallback} ${caution}` : fallback;
    }

    return {
    rank: p.rank,
    label: p.strategyLabel ?? `${p.targetRole} refinement`,
    impact: p.impact === 'highest' ? 'Highest impact'
      : p.impact === 'moderate' ? 'Moderate impact'
      : 'Refinement',
    rationale,
    explanation: p.explanation && p.explanation.length > 0 ? p.explanation : undefined,
    tradeoff: p.tradeoff,
    protection: p.protection,
    counterfactual: p.counterfactual,
    options: p.options.map((o, i) => {
      // Derive system delta by comparing product axis profile to system axes
      const improvements: string[] = [];
      const tradeOffs: string[] = [];

      for (const [axis, productVal] of Object.entries(o.axisProfile)) {
        if (productVal === null || productVal === 'neutral') continue;
        const sysKey = axis as keyof typeof systemAxes;
        const sysVal = systemAxes[sysKey];
        if (!sysVal || typeof sysVal === 'number') continue;

        const productNumeric = axisToNumeric(productVal);
        const systemNumeric = axisToNumeric(sysVal);
        const delta = productNumeric - systemNumeric;

        const readableAxis = axis.replace(/_/g, '↔');
        if (Math.abs(delta) >= 0.3) {
          if (delta > 0) {
            improvements.push(`shifts ${readableAxis} toward ${productVal}`);
          } else {
            improvements.push(`shifts ${readableAxis} toward ${productVal}`);
          }
        } else if (Math.abs(delta) < 0.15 && productVal !== 'neutral') {
          // Same direction as system — reinforces
          tradeOffs.push(`reinforces existing ${readableAxis} tendency`);
        }
      }

      // Build "why fits" from target axes
      const whyFits = p.targetAxes.length > 0
        ? `Addresses the system's ${p.targetAxes.map((a) => a.replace(/_/g, ' ')).join(' and ')} balance.`
        : undefined;

      const systemDelta = (whyFits || improvements.length > 0 || tradeOffs.length > 0)
        ? {
            whyFitsSystem: whyFits,
            likelyImprovements: improvements.length > 0 ? improvements : undefined,
            tradeOffs: tradeOffs.length > 0 ? tradeOffs : undefined,
          }
        : undefined;

      return {
        rank: i + 1,
        name: o.name,
        brand: o.brand,
        priceNote: o.priceRange,
        summary: `${o.brand} ${o.name} — ${o.priceRange}.`,
        pros: Object.entries(o.axisProfile)
          .filter(([_, v]) => v !== null && v !== 'neutral')
          .map(([axis, direction]) => `${axis.replace(/_/g, '↔')}: ${direction}`),
        cons: [],
        systemDelta,
      };
    }),
  };
  });
}

function mapKeepRecommendations(findings: MemoFindings): KeepRecommendation[] {
  return findings.keeps.map((k) => ({
    name: k.name,
    reason: k.alignedAxes.length > 0
      ? `Aligned on ${k.alignedAxes.map((a) => a.replace(/_/g, '↔')).join(', ')}.`
      : 'Performing well in the current system.',
  }));
}

function mapRecommendedSequence(findings: MemoFindings): RecommendedStep[] {
  return findings.recommendedSequence.map((s) => ({
    step: s.step,
    action: s.action,
  }));
}

function mapSourceReferences(findings: MemoFindings): SourceReference[] {
  return findings.sourceReferences.map((r) => ({
    source: r.source,
    note: r.note,
    url: r.url,
  }));
}

// ── System synergy derivation ────────────────────────────

/**
 * Derive a system synergy summary from MemoFindings.
 * Describes why the system works well together — based on
 * stacked traits classified as system_character and deliberateness signals.
 */
function deriveSystemSynergy(findings: MemoFindings): string | undefined {
  const characterTraits = findings.stackedTraits
    .filter((t) => t.classification === 'system_character');

  if (characterTraits.length === 0 && !findings.isDeliberate) return undefined;

  const parts: string[] = [];

  // Describe the system's shared direction
  if (characterTraits.length > 0) {
    const traitLabels = characterTraits.map((t) => {
      const label = t.property
        .replace(/^high_/, '')
        .replace(/_/g, ' ');
      return label;
    });
    const joined = traitLabels.length <= 2
      ? traitLabels.join(' and ')
      : traitLabels.slice(0, -1).join(', ') + ', and ' + traitLabels[traitLabels.length - 1];

    // Count how many components contribute to each trait, and report per-trait
    const traitDetails = characterTraits.map((t) => {
      const label = t.property.replace(/^high_/, '').replace(/_/g, ' ');
      return { label, count: t.contributors.length };
    });

    // Only say "N components reinforce" if the SAME set reinforces the SAME direction
    const allSameCount = traitDetails.every(td => td.count === traitDetails[0].count);
    const minContributors = Math.min(...traitDetails.map(td => td.count));

    if (minContributors >= 2 && allSameCount) {
      parts.push(`This system emphasizes ${joined} — ${minContributors} components reinforce this direction.`);
    } else {
      parts.push(`This system emphasizes ${joined}.`);
    }
  }

  if (findings.isDeliberate) {
    parts.push('The component choices suggest an intentional, coherent build.');
  }

  return parts.join(' ');
}

/**
 * Convert a string axis leaning to a numeric value (0–1).
 * Maps the categorical axis positions to a continuous scale.
 */
function axisToNumeric(value: string): number {
  // Each axis has a "low" pole, "neutral" center, and "high" pole.
  // Map: first pole → 0.2, neutral → 0.5, second pole → 0.8
  switch (value) {
    // warm_bright axis: warm=low, bright=high
    case 'warm': return 0.2;
    case 'bright': return 0.8;
    // smooth_detailed axis: smooth=low, detailed=high
    case 'smooth': return 0.2;
    case 'detailed': return 0.8;
    // elastic_controlled axis: elastic=low, controlled=high
    case 'elastic': return 0.2;
    case 'controlled': return 0.8;
    // airy_closed axis: airy=high (open), closed=low
    case 'airy': return 0.8;
    case 'closed': return 0.2;
    default: return 0.5; // neutral
  }
}

/**
 * Derive a listener taste profile from MemoFindings.
 * Maps listener priority tags to readable trait names.
 */
function deriveListenerTasteProfile(
  findings: MemoFindings,
  axes: MemoFindings['systemAxes'],
): {
  primaryTraits: string[];
  secondaryTraits?: string[];
  avoided?: string[];
  philosophy?: string;
} | undefined {
  if (findings.listenerPriorities.length === 0) return undefined;

  const all = findings.listenerPriorities.map(
    (p) => LISTENER_PRIORITY_LABELS[p] ?? p.replace(/_/g, ' '),
  );

  // Primary: top 3, secondary: remainder
  const primaryTraits = all.slice(0, 3);
  const secondaryTraits = all.length > 3 ? all.slice(3) : undefined;

  // Derive avoided traits from axis positions (using numeric conversion)
  const wb = axisToNumeric(axes.warm_bright);
  const sd = axisToNumeric(axes.smooth_detailed);
  const ec = axisToNumeric(axes.elastic_controlled);

  const avoided: string[] = [];
  if (wb > 0.65) avoided.push('tonal warmth');
  if (wb < 0.35) avoided.push('analytical brightness');
  if (sd > 0.65) avoided.push('smoothed-over detail');
  if (sd < 0.35) avoided.push('excessive detail emphasis');
  if (ec > 0.65) avoided.push('rigid control');
  if (ec < 0.35) avoided.push('loose dynamics');

  // Philosophy sentence
  let philosophy: string | undefined;
  if (findings.isDeliberate && primaryTraits.length >= 2) {
    philosophy = `The listener values ${primaryTraits[0]} and ${primaryTraits[1]}, suggesting a preference for a system that prioritizes musical engagement through these qualities.`;
  }

  return {
    primaryTraits,
    secondaryTraits,
    avoided: avoided.length > 0 ? avoided : undefined,
    philosophy,
  };
}

/**
 * Derive spider chart data from system axes and listener priorities.
 * Maps the 4-axis model to 7 radar dimensions for visualization.
 */
function deriveSpiderChartData(
  axes: MemoFindings['systemAxes'],
  priorities: MemoFindings['listenerPriorities'],
): Array<{ trait: string; value: number; fullMark: number }> {
  const wb = axisToNumeric(axes.warm_bright);
  const sd = axisToNumeric(axes.smooth_detailed);
  const ec = axisToNumeric(axes.elastic_controlled);
  const ac = axisToNumeric(axes.airy_closed);

  const prioritySet = new Set(priorities);

  const boost = (base: number, tag: ListenerPriority) =>
    prioritySet.has(tag) ? Math.min(100, base + 15) : base;

  return [
    { trait: 'Tonal Density', value: boost(Math.round((1 - wb) * 80 + 10), 'tonal_density'), fullMark: 100 },
    { trait: 'Transient Speed', value: boost(Math.round(sd * 80 + 10), 'transient_speed'), fullMark: 100 },
    { trait: 'Harmonic Richness', value: boost(Math.round((1 - wb) * 60 + 20), 'harmonic_richness'), fullMark: 100 },
    { trait: 'Micro-detail', value: boost(Math.round(sd * 70 + 15), 'transparency'), fullMark: 100 },
    { trait: 'Rhythmic Drive', value: boost(Math.round(ec * 75 + 15), 'rhythmic_articulation'), fullMark: 100 },
    { trait: 'Composure', value: boost(Math.round((1 - ec) * 70 + 15), 'control_precision'), fullMark: 100 },
    { trait: 'Spatial Scale', value: boost(Math.round(ac * 70 + 20), 'spatial_openness'), fullMark: 100 },
  ];
}

/**
 * Derive a system signature — a one-sentence characterization of the
 * system's sonic identity based on axis positions and listener priorities.
 *
 * Uses per-component numeric weighted averages (when available) to detect
 * contested axes — where components pull in opposite directions — rather
 * than declaring a pole from a narrow categorical majority.
 */
function deriveSystemSignature(
  findings: MemoFindings,
): string | undefined {
  const axes = findings.systemAxes;
  const priorities = findings.listenerPriorities;
  const traits: string[] = [];

  // ── Compute numeric weighted averages from per-component data ──
  // Role weights: speaker=3, dac=2, amp=1.5, source=0.5, cable=0.25
  const components = findings.perComponentAxes;
  const roles = findings.systemChain.roles;
  const hasComponentData = components.length > 0 && roles.length === components.length;

  function roleWt(role: string): number {
    const r = role.toLowerCase();
    if (r.includes('speak') || r.includes('headphone') || r.includes('monitor')) return 3;
    if (r.includes('dac')) return 2;
    if (r.includes('amp') || r.includes('integrated') || r.includes('preamp')) return 1.5;
    if (r.includes('stream') || r.includes('source') || r.includes('transport')) return 0.5;
    if (r.includes('cable') || r.includes('accessory') || r.includes('power')) return 0.25;
    return 1;
  }

  function catToNum(cat: string): number {
    switch (cat) {
      case 'warm': case 'smooth': case 'elastic': case 'airy': return -1;
      case 'bright': case 'detailed': case 'controlled': case 'closed': return 1;
      default: return 0;
    }
  }

  function weightedAvg(axisKey: 'warm_bright' | 'smooth_detailed' | 'elastic_controlled' | 'airy_closed'): number {
    if (!hasComponentData) {
      // Fallback: convert categorical to numeric
      return catToNum(axes[axisKey]);
    }
    let sumWV = 0, sumW = 0;
    for (let i = 0; i < components.length; i++) {
      const w = roleWt(roles[i]);
      const nKey = `${axisKey}_n` as keyof typeof components[0]['axes'];
      const numVal = components[i].axes[nKey];
      const v = typeof numVal === 'number' ? numVal : catToNum(components[i].axes[axisKey] as string);
      sumWV += v * w;
      sumW += w;
    }
    return sumW > 0 ? sumWV / sumW : 0;
  }

  const CONTESTED = 0.35; // Numeric average within ±CONTESTED is "balanced"

  const wbAvg = weightedAvg('warm_bright');
  const sdAvg = weightedAvg('smooth_detailed');
  const ecAvg = weightedAvg('elastic_controlled');
  const acAvg = weightedAvg('airy_closed');

  // Tonal character
  if (wbAvg < -CONTESTED) traits.push('tonally warm');
  else if (wbAvg > CONTESTED) traits.push('bright');
  else traits.push('tonally balanced');

  // Speed / detail
  if (sdAvg > CONTESTED) traits.push('detail-forward');
  else if (sdAvg < -CONTESTED) traits.push('smooth');

  // Timing character
  if (ecAvg < -CONTESTED) traits.push('elastically flowing');
  else if (ecAvg > CONTESTED) traits.push('rhythmically articulate');

  // Spatial character
  if (acAvg < -CONTESTED) traits.push('spatially open');
  else if (acAvg > CONTESTED) traits.push('intimate');

  if (traits.length === 0) return undefined;

  // Add engagement style from priorities
  const prioritySet = new Set(priorities);
  let engagementNote = '';
  if (prioritySet.has('musical_flow')) engagementNote = ' emphasizing musical engagement';
  else if (prioritySet.has('timing_accuracy')) engagementNote = ' emphasizing transient clarity';
  else if (prioritySet.has('tonal_density')) engagementNote = ' emphasizing tonal density';

  const traitStr = traits.join(', ');
  return traitStr.charAt(0).toUpperCase() + traitStr.slice(1) + ' system' + engagementNote + '.';
}

// ── Main renderer ───────────────────────────────────────

/**
 * Render a deterministic memo from MemoFindings + legacy prose.
 *
 * This function performs NO analysis — it only assembles. All reasoning
 * has already happened in buildSystemAssessment().
 *
 * CANONICAL call (new code):
 *   renderDeterministicMemo(findings, prose)
 *   → structured fields derived from MemoFindings via map*() functions
 *
 * DEPRECATED call (transitional — remove when validated):
 *   renderDeterministicMemo(findings, prose, structured)
 *   → StructuredMemoInputs fields take precedence over MemoFindings derivation
 *
 * @param findings  Structured contract from the deterministic pipeline.
 * @param prose     Pre-computed prose fields (passed through as-is).
 * @param structured  @deprecated Transitional override. Omit for canonical path.
 */
export function renderDeterministicMemo(
  findings: MemoFindings,
  prose: LegacyProseInputs,
  structured?: StructuredMemoInputs,
): ConsultationResponse {
  // When StructuredMemoInputs is provided, use those directly (behavioral parity).
  // When omitted, derive from MemoFindings (new path).
  const systemChain = structured?.systemChain ?? mapSystemChain(findings);
  const primaryConstraint = structured ? structured.primaryConstraint : mapPrimaryConstraint(findings);
  const stackedTraitInsights = structured?.stackedTraitInsights ?? mapStackedTraitInsights(findings);
  const componentAssessments = structured?.componentAssessments ?? mapComponentAssessments(findings);
  const upgradePaths = structured?.upgradePaths ?? mapUpgradePaths(findings);
  const keepRecommendations = structured?.keepRecommendations ?? mapKeepRecommendations(findings);
  const recommendedSequence = structured?.recommendedSequence ?? mapRecommendedSequence(findings);
  const sourceReferences = structured?.sourceReferences ?? mapSourceReferences(findings);

  return {
    title: prose.title,
    subject: `Your system: ${prose.subject}`,
    // Undefined — assessment sections carry all content; suppress AdvisoryProse
    philosophy: undefined,
    tendencies: undefined,
    // System assessment specific fields
    systemContext: prose.systemCharacterOpening,
    componentReadings: prose.componentParagraphs,
    systemInteraction: prose.systemInteraction,
    assessmentStrengths: prose.assessmentStrengths,
    assessmentLimitations: prose.assessmentLimitations,
    upgradeDirection: prose.upgradeDirection,
    followUp: prose.followUp,
    links: prose.links.length > 0 ? prose.links : undefined,
    // Structured memo-format fields (from MemoFindings or StructuredMemoInputs)
    systemChain,
    introSummary: prose.introSummary,
    primaryConstraint,
    stackedTraitInsights: stackedTraitInsights.length > 0 ? stackedTraitInsights : undefined,
    componentAssessments: componentAssessments.length > 0 ? componentAssessments : undefined,
    upgradePaths: upgradePaths.length > 0 ? upgradePaths : undefined,
    keepRecommendations: keepRecommendations.length > 0 ? keepRecommendations : undefined,
    recommendedSequence: recommendedSequence.length > 0 ? recommendedSequence : undefined,
    keyObservation: prose.keyObservation,
    systemSynergy: deriveSystemSynergy(findings),
    listenerTasteProfile: deriveListenerTasteProfile(findings, findings.systemAxes),
    spiderChartData: deriveSpiderChartData(findings.systemAxes, findings.listenerPriorities),
    sourceReferences: sourceReferences.length > 0 ? sourceReferences : undefined,
    advisoryMode: 'system_review' as const,
    systemSignature: deriveSystemSignature(findings),
  };
}
