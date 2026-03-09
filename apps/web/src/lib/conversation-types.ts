import type { ExtractedSignals } from './signal-types';
import type { EvaluationResult } from './rule-types';
import type { ShoppingAnswer } from './shopping-intent';
import type { GlossaryResult } from './glossary';
import type { ClarificationResponse } from './clarification';
import type { UserIntent } from './intent';
import type { SystemDirection } from './system-direction';

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
}

export type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; kind: 'note' }
  | { role: 'assistant'; kind: 'question'; clarification: ClarificationResponse }
  | { role: 'assistant'; kind: 'analysis'; signals: ExtractedSignals; result: EvaluationResult; systemDirection?: SystemDirection }
  | { role: 'assistant'; kind: 'shopping-answer'; answer: ShoppingAnswer; signals: ExtractedSignals }
  | { role: 'assistant'; kind: 'glossary'; entry: GlossaryResult }
  | { role: 'assistant'; kind: 'gear-response'; response: GearResponse };

export interface ConversationState {
  messages: Message[];
  currentInput: string;
  turnCount: number;
  isLoading: boolean;
  // Future hooks for persistence (unused this pass):
  systemId?: string;
  profileId?: string;
}
