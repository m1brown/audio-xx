import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import type { SignalDictionary, SignalEntry, ExtractedSignals, SignalDirection } from './types';

const SIGNALS_PATH = resolve(__dirname, '..', 'signals.yaml');

let cachedDictionary: SignalDictionary | null = null;

export function loadSignalDictionary(path?: string): SignalDictionary {
  if (cachedDictionary && !path) return cachedDictionary;
  const raw = readFileSync(path ?? SIGNALS_PATH, 'utf-8');
  const parsed = parse(raw) as SignalDictionary;
  if (!path) cachedDictionary = parsed;
  return parsed;
}

export function clearCache(): void {
  cachedDictionary = null;
}

/**
 * Process free-text input into structured signals.
 * This is the bridge between user language and the rule engine.
 */
export function processText(text: string, dictionary?: SignalDictionary): ExtractedSignals {
  const dict = dictionary ?? loadSignalDictionary();
  const lower = text.toLowerCase();

  const traits: Record<string, SignalDirection> = {};
  const symptoms = new Set<string>();
  const archetypeHints = new Set<string>();
  const matchedPhrases: string[] = [];

  // Match signal entries
  for (const entry of dict.signals) {
    for (const phrase of entry.phrases) {
      if (lower.includes(phrase.toLowerCase())) {
        matchedPhrases.push(phrase);
        symptoms.add(entry.symptom);

        // Merge trait signals — last match wins for conflicting traits
        for (const [trait, direction] of Object.entries(entry.signals)) {
          traits[trait] = direction;
        }

        if (entry.archetype_hint) {
          archetypeHints.add(entry.archetype_hint);
        }

        // Only match the first phrase per entry to avoid double-counting
        break;
      }
    }
  }

  // Count uncertainty markers
  const matchedUncertaintyMarkers: string[] = [];
  for (const marker of dict.uncertainty_markers) {
    if (lower.includes(marker.toLowerCase())) {
      matchedUncertaintyMarkers.push(marker);
    }
  }
  const uncertaintyLevel = Math.min(matchedUncertaintyMarkers.length, 3) as 0 | 1 | 2 | 3;

  return {
    traits,
    symptoms: Array.from(symptoms),
    archetype_hints: Array.from(archetypeHints),
    uncertainty_level: uncertaintyLevel,
    matched_phrases: matchedPhrases,
    matched_uncertainty_markers: matchedUncertaintyMarkers,
  };
}
