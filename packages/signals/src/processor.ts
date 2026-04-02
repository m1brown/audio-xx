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
 * Escape special regex characters in a string.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a word-boundary-aware regex for a phrase.
 * Multi-word phrases match the full sequence; single words use \b boundaries
 * so "thin" won't match inside "something".
 */
function phraseRegex(phrase: string): RegExp {
  const escaped = escapeRegex(phrase.toLowerCase());
  return new RegExp(`(?:^|\\b|\\s)${escaped}(?:\\b|\\s|$)`, 'i');
}

/**
 * Process free-text input into structured signals.
 * This is the bridge between user language and the rule engine.
 */
export function processText(text: string, dictionary?: SignalDictionary): ExtractedSignals {
  const dict = dictionary ?? loadSignalDictionary();
  const lower = text.toLowerCase();

  const archetypeHints = new Set<string>();
  const matchedPhrases: string[] = [];

  // ── Phase 1: Collect all phrase matches with their metadata ──
  // Each match records the phrase, its length, and the originating entry.
  // Uses word-boundary matching to prevent "thin" matching inside "something".
  type PhraseMatch = { phrase: string; entry: SignalEntry; len: number };
  const allMatches: PhraseMatch[] = [];

  for (const entry of dict.signals) {
    for (const phrase of entry.phrases) {
      if (phraseRegex(phrase).test(lower)) {
        allMatches.push({ phrase, entry, len: phrase.length });
        break; // Only match the first phrase per entry
      }
    }
  }

  // ── Phase 2: Sort longest-first, then apply to traits ──
  // Longer phrases are more specific ("not enough dynamics" > "dynamic").
  // Traits from longer matches take priority over shorter ones.
  // Apply in reverse order (shortest first) so longest match overwrites.
  allMatches.sort((a, b) => b.len - a.len);

  const traits: Record<string, SignalDirection> = {};
  const symptoms = new Set<string>();

  for (let i = allMatches.length - 1; i >= 0; i--) {
    const { phrase, entry } = allMatches[i];
    matchedPhrases.push(phrase);
    symptoms.add(entry.symptom);

    for (const [trait, direction] of Object.entries(entry.signals)) {
      traits[trait] = direction;
    }

    if (entry.archetype_hint) {
      archetypeHints.add(entry.archetype_hint);
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
