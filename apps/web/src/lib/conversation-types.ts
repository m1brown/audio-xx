import type { ExtractedSignals } from './signal-types';
import type { EvaluationResult } from './rule-types';
import type { ShoppingAnswer } from './shopping-intent';
import type { GlossaryResult } from './glossary';
import type { ClarificationResponse } from './clarification';
import type { UserIntent } from './intent';

/** Response for gear inquiries and comparisons — conversational, not diagnostic. */
export interface GearResponse {
  /** Detected intent that produced this response. */
  intent: UserIntent;
  /** Short acknowledgement of the user's question. */
  acknowledge: string;
  /** Neutral description of the gear or comparison. */
  description: string;
  /** Natural follow-up question. */
  followUp: string;
  /** Brand/product names mentioned. */
  subjects: string[];
}

export type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; kind: 'note' }
  | { role: 'assistant'; kind: 'question'; clarification: ClarificationResponse }
  | { role: 'assistant'; kind: 'analysis'; signals: ExtractedSignals; result: EvaluationResult }
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
