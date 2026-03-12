import type { GlossaryResult } from './glossary';
import type { ClarificationResponse } from './clarification';
import type { UserIntent, SubjectMatch } from './intent';
import type { SystemDirection } from './system-direction';
import type { UserArchetypePreference } from './archetype';
import type { ConversationMode } from './conversation-router';
import type { ReasoningResult } from './reasoning';
import type { AdvisoryResponse } from './advisory-response';

/**
 * System direction context attached to diagnostic analysis results.
 * Provides tendency and direction summaries inferred from the user's
 * description of their listening problem.
 */
export type { SystemDirection };

/**
 * Response for gear inquiries and comparisons — conversational, not diagnostic.
 *
 * Follows a five-part advisory pattern:
 *   1. Anchor — acknowledge the gear or situation
 *   2. Character — brief sonic character of the gear or category
 *   3. Interpretation — what the user's goal means in listening terms
 *   4. Direction — what type of sonic change or system direction could help
 *   5. Clarification — follow-up question to refine
 *
 * Not all parts are always present — a pure inquiry without a desire
 * may omit interpretation; a comparison may blend character and direction.
 */
export interface GearResponse {
  /** Detected intent that produced this response. */
  intent: UserIntent;
  /** 1. Anchor — acknowledge the gear or situation (1 sentence). */
  anchor: string;
  /** 2. Character — sonic character of the gear or category (1–2 sentences). */
  character: string;
  /** 3. Interpretation — what the user's goal means in listening terms (1–2 sentences, optional). */
  interpretation?: string;
  /** 4. Direction — what type of change or system direction could achieve it (1–2 sentences). */
  direction: string;
  /** 5. Clarification — follow-up question to refine the recommendation.
   *  May be omitted when the query is self-contained and the system context is already known. */
  clarification?: string;
  /** Brand/product names mentioned. */
  subjects: string[];
  /** Inferred system direction context, if available. */
  systemDirection?: SystemDirection;
  /** Inferred user archetype preference — supports primary + secondary. */
  userArchetype?: UserArchetypePreference;
  /** "What I'm hearing" — short reflective summary bullets shown before advice. */
  hearing?: string[];
  /** Structured upgrade analysis — populated for upgrade comparisons. */
  upgradeAnalysis?: UpgradeAnalysis;
}

/**
 * Structured upgrade analysis — 9-section consulting structure.
 *
 * Populated by the upgrade comparison builder when two products from
 * the same lineage (or explicit upgrade language) are compared.
 * The gearToAdvisory() adapter maps these into AdvisoryResponse fields
 * for the unified renderer.
 */
export interface UpgradeAnalysis {
  /** 1. SYSTEM CHARACTER — architecture lineage + system framing. */
  systemCharacter: string;
  /** 2. WHAT IS WORKING WELL — bullets about what the current setup does well. */
  workingWell: string[];
  /** 3. WHERE LIMITATIONS MAY APPEAR — bullets about where the current product may fall short. */
  limitations: string[];
  /** 4. WHAT THE PROPOSED CHANGE ACTUALLY DOES — prose describing the sonic shift. */
  whatChanges: string;
  /** 5. WHAT IMPROVES — bullet list of concrete improvements. */
  improvements: string[];
  /** 6. WHAT PROBABLY STAYS THE SAME — bullet list of continuities. */
  unchanged: string[];
  /** 7. WHEN THIS UPGRADE MAKES SENSE — conditions where the move is appropriate. */
  whenMakesSense: string;
  /** 8. WHEN IT MAY NOT BE THE BEST NEXT STEP — conditions where restraint is better. */
  whenToWait: string;
  /** 9. SYSTEM BALANCE SUMMARY — diagnostic of the system across core listening traits. */
  systemBalance: SystemBalanceEntry[];
  /** 10. WHERE UPGRADES WOULD HAVE THE MOST IMPACT — system-level reasoning. */
  upgradeImpactAreas: string[];
  /** 11. EXPECTED MAGNITUDE OF CHANGE — Minor / Moderate / Major + explanation. */
  changeMagnitude: ChangeMagnitude;
}

/** A single trait reading in the system balance summary. */
export interface SystemBalanceEntry {
  /** Human-readable trait label (e.g. "Speed / articulation"). */
  label: string;
  /** Descriptive level (e.g. "Strong", "Moderate", "Limited"). */
  level: string;
  /** Optional short note providing context. */
  note?: string;
}

/** Expected magnitude of change from an upgrade. */
export interface ChangeMagnitude {
  /** Classification: 'minor' | 'moderate' | 'major'. */
  tier: 'minor' | 'moderate' | 'major';
  /** Human-readable label (e.g. "Moderate"). */
  label: string;
  /** What aspects of the presentation change most. */
  changesmost: string;
  /** What will likely remain similar. */
  remainsSimilar: string;
}

export type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; kind: 'note' }
  | { role: 'assistant'; kind: 'question'; clarification: ClarificationResponse }
  | { role: 'assistant'; kind: 'glossary'; entry: GlossaryResult }
  | { role: 'assistant'; kind: 'advisory'; advisory: AdvisoryResponse };

export interface ConversationState {
  messages: Message[];
  currentInput: string;
  turnCount: number;
  isLoading: boolean;
  /** Active conversation mode for persistence across turns. */
  activeMode?: ConversationMode;
  /**
   * Most recent reasoning result — light continuity aid.
   * Used to carry taste/system/direction context across refinement turns.
   * Always re-run reasoning on accumulated text; this provides previous
   * context for comparison, not a substitute for fresh inference.
   */
  lastReasoning?: ReasoningResult;
  /**
   * Active comparison context — persists across follow-up turns.
   * Set when a comparison is detected, cleared on explicit mode shift
   * (shopping, diagnosis). Allows elliptical follow-ups like
   * "what's better with tubes?" to resolve against the stored pair.
   */
  activeComparison?: {
    left: SubjectMatch;
    right: SubjectMatch;
    scope: 'brand' | 'product';
  };
  /**
   * Active consultation context — persists across follow-up turns.
   * Set when a gear inquiry or consultation produces a response about
   * a specific brand/product. Allows follow-ups like "but aren't
   * there smaller models?" to stay in context instead of falling
   * through to diagnostic logic.
   */
  activeConsultation?: {
    subjects: SubjectMatch[];
    /** The original user message that started the consultation. */
    originalQuery: string;
  };
  // Future hooks for persistence (unused this pass):
  systemId?: string;
  profileId?: string;
}
