/**
 * End-to-end validation of diagnosis routing fixes.
 *
 * For each target query, verifies:
 *   1. Intent detection → diagnosis (not shopping, gear_inquiry, etc.)
 *   2. Conversation state → ready_to_diagnose (not clarify_system)
 *   3. System context captured from inline mentions
 *   4. Diagnosis output is system-aware and actionable
 */

import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { detectInitialMode } from '../conversation-state';
import { buildSystemDiagnosis } from '../consultation';

const TARGET_QUERIES = [
  'wilson speakers and soulution amp, a little dry',
  'focal utopia and hegel h390, something feels off',
  'running a denafrips pontus into a first watt sit-3, lacks bass',
  'running klipsch heresy with leben, too forward',
];

describe('Diagnosis routing — end-to-end validation', () => {
  for (const q of TARGET_QUERIES) {
    describe(`"${q}"`, () => {
      const intent = detectIntent(q);
      const subjects = extractSubjectMatches(q);
      const state = detectInitialMode(q, {
        detectedIntent: intent.intent,
        hasSystem: false, // simulate first turn, no prior system
        subjectCount: subjects.length,
      });

      it('routes to diagnosis intent', () => {
        expect(intent.intent).toBe('diagnosis');
      });

      it('does NOT route to shopping', () => {
        expect(intent.intent).not.toBe('shopping');
      });

      it('does NOT route to gear_inquiry', () => {
        expect(intent.intent).not.toBe('gear_inquiry');
      });

      it('extracts at least 1 subject (system component)', () => {
        expect(subjects.length).toBeGreaterThanOrEqual(1);
      });

      it('sets conversation mode to diagnosis', () => {
        expect(state).not.toBeNull();
        expect(state!.mode).toBe('diagnosis');
      });

      it('goes to ready_to_diagnose (NOT clarify_system)', () => {
        expect(state!.stage).toBe('ready_to_diagnose');
      });

      it('marks hasSystem = true from inline mentions', () => {
        expect(state!.facts.hasSystem).toBe(true);
      });

      it('produces a system-aware diagnosis response', () => {
        const diagnosis = buildSystemDiagnosis(q, subjects);
        expect(diagnosis).not.toBeNull();
        expect(diagnosis!.subject).toBeTruthy();
        expect(diagnosis!.comparisonSummary).toBeTruthy();
        // Must mention something about the system or complaint
        expect(diagnosis!.comparisonSummary!.length).toBeGreaterThan(50);
      });
    });
  }
});

describe('Diagnosis output — user-facing content', () => {
  for (const q of TARGET_QUERIES) {
    it(`"${q}" produces actionable output`, () => {
      const subjects = extractSubjectMatches(q);
      const diagnosis = buildSystemDiagnosis(q, subjects);

      console.log(`\n${'═'.repeat(70)}`);
      console.log(`  QUERY: "${q}"`);
      console.log(`${'═'.repeat(70)}`);
      console.log(`\n  Subjects: ${subjects.map(s => s.name).join(', ')}`);
      console.log(`  Subject line: ${diagnosis?.subject}`);
      console.log(`\n  [Diagnosis Body]`);
      console.log(`  ${diagnosis?.comparisonSummary?.slice(0, 500)}`);
      if (diagnosis?.followUp) {
        console.log(`\n  [Follow-up]`);
        console.log(`  ${diagnosis.followUp}`);
      }
      console.log(`${'─'.repeat(70)}`);

      expect(diagnosis).not.toBeNull();
      // Must NOT contain product-dump language
      expect(diagnosis!.comparisonSummary).not.toMatch(/audio preferences|why this fits you|refine this shortlist/i);
      // Must NOT ask for system (we already have it)
      expect(diagnosis!.comparisonSummary).not.toMatch(/what['']?s in your system/i);
      expect(diagnosis!.followUp).not.toMatch(/what['']?s in your system/i);
    });
  }
});
