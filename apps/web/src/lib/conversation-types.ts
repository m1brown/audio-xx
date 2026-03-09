import type { ExtractedSignals } from './signal-types';
import type { EvaluationResult } from './rule-types';

export type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; kind: 'question' | 'note' }
  | { role: 'assistant'; kind: 'analysis'; signals: ExtractedSignals; result: EvaluationResult };

export interface ConversationState {
  messages: Message[];
  currentInput: string;
  turnCount: number;
  isLoading: boolean;
  // Future hooks for persistence (unused this pass):
  systemId?: string;
  profileId?: string;
}
