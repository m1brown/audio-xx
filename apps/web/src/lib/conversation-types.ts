import type { ExtractedSignals } from './signal-types';
import type { EvaluationResult } from './rule-types';
import type { ShoppingAnswer } from './shopping-intent';
import type { GlossaryResult } from './glossary';
import type { ClarificationResponse } from './clarification';
import type { UserIntent, SubjectMatch } from './intent';
import type { SystemDirection } from './system-direction';
import type { SonicArchetype, UserArchetypePreference } from './archetype';
import type { ConsultationResponse } from './consultation';
import type { ConversationMode } from './conversation-router';
import type { ReasoningResult } from './reasoning';

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
  /** 5. Clarification — follow-up question to refine the recommendation. */
  clarification: string;
  /** Brand/product names mentioned. */
  subjects: string[];
  /** Inferred system direction context, if available. */
  systemDirection?: SystemDirection;
  /** Inferred user archetype preference — supports primary + secondary. */
  userArchetype?: UserArchetypePreference;
  /** "What I'm hearing" — short reflective summary bullets shown before advice. */
  hearing?: string[];
}

export type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; kind: 'note' }
  | { role: 'assistant'; kind: 'question'; clarification: ClarificationResponse }
  | { role: 'assistant'; kind: 'analysis'; signals: ExtractedSignals; result: EvaluationResult; systemDirection?: SystemDirection }
  | { role: 'assistant'; kind: 'shopping-answer'; answer: ShoppingAnswer; signals: ExtractedSignals }
  | { role: 'assistant'; kind: 'glossary'; entry: GlossaryResult }
  | { role: 'assistant'; kind: 'gear-response'; response: GearResponse }
  | { role: 'assistant'; kind: 'consultation'; consultation: ConsultationResponse };

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
  // Future hooks for persistence (unused this pass):
  systemId?: string;
  profileId?: string;
}
