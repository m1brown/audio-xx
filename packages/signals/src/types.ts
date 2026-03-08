/** Direction of a trait signal */
export type SignalDirection = 'up' | 'down';

/** A single entry in the signal dictionary YAML */
export interface SignalEntry {
  phrases: string[];
  signals: Record<string, SignalDirection>;
  symptom: string;
  archetype_hint?: string;
}

/** Parsed signal dictionary */
export interface SignalDictionary {
  signals: SignalEntry[];
  uncertainty_markers: string[];
}

/** Result of processing free text */
export interface ExtractedSignals {
  /** Trait name → direction */
  traits: Record<string, SignalDirection>;
  /** Detected symptoms */
  symptoms: string[];
  /** Detected archetype hints */
  archetype_hints: string[];
  /** Uncertainty level 0–3 based on marker count */
  uncertainty_level: number;
  /** Matched phrases for transparency */
  matched_phrases: string[];
  /** Raw uncertainty markers found */
  matched_uncertainty_markers: string[];
}
