/**
 * Deterministic memo renderer.
 *
 * Assembles a ConsultationResponse from MemoFindings plus legacy prose
 * fields. This is the rendering layer — it does not contain reasoning
 * logic. All analysis happens in the deterministic pipeline upstream.
 *
 * Design:
 *   - Takes MemoFindings as the structured contract
 *   - Takes pre-computed prose fields for behavioral stability
 *     (legacy prose builders still read SystemComponent[] directly)
 *   - Produces the same ConsultationResponse as before the refactor
 *   - Structured fields (systemChain, constraint, assessments, etc.)
 *     are derived from MemoFindings via mapping functions
 *   - Future: prose builders will be rewritten to consume MemoFindings
 *     directly, eliminating the need for the legacy prose inputs
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

// ── Structured memo inputs (DEPRECATED) ──────────────────
//
// Retained for backward compatibility during the transition period.
// New code should use renderDeterministicMemo(findings, prose) directly.

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
    explanation: `${b.component} is the primary constraint in the chain (${b.category.replace(/_/g, ' ')}).${axisNote}`,
  };
}

function mapStackedTraitInsights(findings: MemoFindings): StackedTraitInsight[] {
  return findings.stackedTraits.map((s) => ({
    label: s.property,
    contributors: s.contributors,
    // Generate a concise explanation from the structured data
    explanation: `${s.contributors.join(' and ')} both push toward ${s.property.replace(/_/g, ' ')}.`,
  }));
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
    // Map from MemoFindings verdict to prose verdict
    let verdict: string;
    let verdictKind: VerdictKind;
    switch (cv.verdict) {
      case 'bottleneck':
        verdict = '**This is the primary constraint in the chain.** Upgrading here yields the highest system-level impact.';
        verdictKind = 'bottleneck';
        break;
      case 'keep':
        verdict = cv.weaknesses.length === 0
          ? 'Performing well. No immediate upgrade rationale.'
          : 'Strong contributor to the system\'s character. Worth keeping.';
        verdictKind = 'keeper';
        break;
      case 'upgrade':
        verdict = 'Room for improvement. This component may be limiting the system\'s potential.';
        verdictKind = 'upgrade_candidate';
        break;
      default:
        verdict = 'Solid at its tier. Room for refinement, not the priority.';
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
    };
  });
}

function mapUpgradePaths(findings: MemoFindings): UpgradePath[] {
  return findings.upgradePaths.map((p) => ({
    rank: p.rank,
    label: `${p.targetRole} Upgrade`,
    impact: p.impact === 'highest' ? 'Highest Impact'
      : p.impact === 'moderate' ? 'Moderate Impact'
      : 'Refinement',
    rationale: `Upgrading the ${p.targetRole.toLowerCase()} addresses ${p.targetAxes.join(' and ').replace(/_/g, '↔')}.`,
    options: p.options.map((o, i) => ({
      rank: i + 1,
      name: o.name,
      brand: o.brand,
      priceNote: o.priceRange,
      summary: `${o.brand} ${o.name} — ${o.priceRange}.`,
      pros: Object.entries(o.axisProfile)
        .filter(([_, v]) => v !== null && v !== 'neutral')
        .map(([axis, direction]) => `${axis.replace(/_/g, '↔')}: ${direction}`),
      cons: [],
    })),
  }));
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
  }));
}

// ── Main renderer ───────────────────────────────────────

/**
 * Render a deterministic memo from MemoFindings + legacy prose.
 *
 * This function performs NO analysis — it only assembles. All reasoning
 * has already happened in buildSystemAssessment().
 *
 * The structured memo fields (systemChain, constraint, assessments, etc.)
 * are derived from MemoFindings via the mapping functions above.
 * Legacy prose fields are passed through as-is for behavioral stability.
 *
 * Overload 1 (preferred): MemoFindings + prose only.
 * Overload 2 (deprecated): MemoFindings + prose + StructuredMemoInputs.
 *   When StructuredMemoInputs is provided, those fields take precedence
 *   (this preserves exact behavioral parity during the transition).
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
    sourceReferences: sourceReferences.length > 0 ? sourceReferences : undefined,
  };
}
