export type SignalDirection = 'up' | 'down';

export interface SignalEntry {
  phrases: string[];
  signals: Record<string, SignalDirection>;
  symptom: string;
  archetype_hint?: string;
}

export interface SignalDictionary {
  signals: SignalEntry[];
  uncertainty_markers: string[];
}

export interface ExtractedSignals {
  traits: Record<string, SignalDirection>;
  symptoms: string[];
  archetype_hints: string[];
  uncertainty_level: number;
  matched_phrases: string[];
  matched_uncertainty_markers: string[];
}
