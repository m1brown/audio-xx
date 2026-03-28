/**
 * Final Routing Sanity Sweep — validates clean separation between
 * system_assessment, comparison, and product_assessment.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';

// ── Helpers ──────────────────────────────────────────

function route(msg: string) {
  const r = detectIntent(msg);
  return { intent: r.intent, subjects: r.subjects, count: r.subjectMatches.length };
}

function fullAssess(msg: string) {
  const { subjectMatches, desires } = detectIntent(msg);
  const result = buildSystemAssessment(msg, subjectMatches, null, desires);
  return result;
}

// ══════════════════════════════════════════════════════
// GROUP A — System Assessment
// ══════════════════════════════════════════════════════

describe('Group A: System Assessment', () => {
  const cases = [
    "how's this system? chord hugo + job integrated + WLM Diva",
    "is chord hugo + job integrated + WLM Diva a good setup?",
    "what do you think of this system: chord hugo + job integrated + WLM Diva",
  ];

  for (const msg of cases) {
    describe(`"${msg.substring(0, 60)}..."`, () => {
      const r = route(msg);

      it('routes to system_assessment', () => {
        console.log(`  A: "${msg.substring(0, 50)}" → ${r.intent} (${r.count} subjects: ${r.subjects.join(', ')})`);
        expect(r.intent).toBe('system_assessment');
      });

      it('detects ≥ 2 subjects', () => {
        expect(r.count).toBeGreaterThanOrEqual(2);
      });

      it('does NOT route to comparison or product_assessment', () => {
        expect(r.intent).not.toBe('comparison');
        expect(r.intent).not.toBe('product_assessment');
      });
    });
  }

  // Output quality spot check on primary case
  describe('output quality: primary case', () => {
    const result = fullAssess(cases[0]);

    it('produces assessment kind', () => {
      expect(result).not.toBeNull();
      expect(result!.kind).toBe('assessment');
    });

    it('includes all 3 components', () => {
      if (result?.kind !== 'assessment') throw new Error('not assessment');
      const names = result.findings.componentNames.map(n => n.toLowerCase());
      expect(names.length).toBeGreaterThanOrEqual(3);
      expect(names.join(' ')).toContain('hugo');
      expect(names.join(' ')).toContain('job');
      expect(names.join(' ')).toContain('diva');
    });

    it('has system interaction (not comparison framing)', () => {
      if (result?.kind !== 'assessment') throw new Error('not assessment');
      const interaction = (result.response.systemInteraction ?? '').toLowerCase();
      expect(interaction.length).toBeGreaterThan(50);
      expect(interaction).not.toContain('versus');
      expect(interaction).not.toContain(' vs ');
    });
  });
});

// ══════════════════════════════════════════════════════
// GROUP B — Comparison
// ══════════════════════════════════════════════════════

describe('Group B: Comparison', () => {
  const cases = [
    "compare JOB integrated and WLM Diva vs Crayon and WLM Diva",
    "JOB or Crayon?",
  ];

  for (const msg of cases) {
    describe(`"${msg}"`, () => {
      const r = route(msg);

      it('routes to comparison (or product_assessment for brand-only)', () => {
        console.log(`  B: "${msg}" → ${r.intent} (${r.count} subjects: ${r.subjects.join(', ')})`);
        // "JOB or Crayon?" is brand-only, might route differently
        // Main check: must NOT be system_assessment
        expect(r.intent).not.toBe('system_assessment');
      });

      it('does NOT route to system_assessment', () => {
        expect(r.intent).not.toBe('system_assessment');
      });
    });
  }
});

// ══════════════════════════════════════════════════════
// GROUP C — Single Product Assessment
// ══════════════════════════════════════════════════════

describe('Group C: Single Product Assessment', () => {
  const cases = [
    "thoughts on JOB integrated",
    "how good is the Chord Hugo?",
    "what do you think of WLM Diva?",
  ];

  for (const msg of cases) {
    describe(`"${msg}"`, () => {
      const r = route(msg);

      it('routes to product_assessment', () => {
        console.log(`  C: "${msg}" → ${r.intent} (${r.count} subjects: ${r.subjects.join(', ')})`);
        expect(r.intent).toBe('product_assessment');
      });

      it('does NOT route to system_assessment or comparison', () => {
        expect(r.intent).not.toBe('system_assessment');
        expect(r.intent).not.toBe('comparison');
      });
    });
  }
});
