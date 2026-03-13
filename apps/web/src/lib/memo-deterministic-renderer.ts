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
 *   - Future: prose builders will be rewritten to consume MemoFindings
 *     directly, eliminating the need for the legacy prose inputs
 *
 * This function is the deterministic fallback for the LLM overlay.
 * If the LLM layer is unavailable or produces invalid output,
 * this renderer's output is what the user sees.
 */

import type { ConsultationResponse } from './consultation';
import type { MemoFindings } from './memo-findings';
import type {
  SystemChain,
  PrimaryConstraint,
  StackedTraitInsight,
  ComponentAssessment,
  UpgradePath,
  KeepRecommendation,
  RecommendedStep,
  SourceReference,
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

// ── Structured memo inputs ─────────────────────────────
//
// These come from the deterministic pipeline and are already
// in the advisory-response types. Passed separately because
// MemoFindings uses its own structured types, and the existing
// renderer pipeline produces these directly.

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

/**
 * Render a deterministic memo from pre-computed prose and structured fields.
 *
 * This function performs NO analysis — it only assembles. All reasoning
 * has already happened in buildSystemAssessment(). The MemoFindings
 * parameter is accepted for contract verification and future use,
 * but does not currently drive rendering.
 *
 * @param _findings - The structured contract (for future use and verification)
 * @param prose - Pre-computed prose from legacy builders
 * @param structured - Structured memo fields from the pipeline
 * @returns A complete ConsultationResponse ready for the advisory adapter
 */
export function renderDeterministicMemo(
  _findings: MemoFindings,
  prose: LegacyProseInputs,
  structured: StructuredMemoInputs,
): ConsultationResponse {
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
    // Structured memo-format fields
    systemChain: structured.systemChain,
    introSummary: prose.introSummary,
    primaryConstraint: structured.primaryConstraint,
    stackedTraitInsights: structured.stackedTraitInsights.length > 0 ? structured.stackedTraitInsights : undefined,
    componentAssessments: structured.componentAssessments.length > 0 ? structured.componentAssessments : undefined,
    upgradePaths: structured.upgradePaths.length > 0 ? structured.upgradePaths : undefined,
    keepRecommendations: structured.keepRecommendations.length > 0 ? structured.keepRecommendations : undefined,
    recommendedSequence: structured.recommendedSequence.length > 0 ? structured.recommendedSequence : undefined,
    keyObservation: prose.keyObservation,
    sourceReferences: structured.sourceReferences.length > 0 ? structured.sourceReferences : undefined,
  };
}
