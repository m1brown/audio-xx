/**
 * System Evaluation Routing + Output — Validates that system assessment queries
 * with plus-separated component chains route correctly and produce complete output.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment, type SystemAssessmentResult } from '../consultation';

function assess(message: string) {
  const { subjectMatches, desires } = detectIntent(message);
  const result = buildSystemAssessment(message, subjectMatches, null, desires);
  return { result, subjectMatches, desires };
}

describe('System Evaluation Routing', () => {

  describe('subject extraction', () => {
    it('extracts all 3 components from plus-separated chain', () => {
      const matches = extractSubjectMatches("how's this system? chord hugo + job integrated + WLM Diva");
      const names = matches.map(m => m.name);
      console.log('Extracted subjects:', names);
      expect(names).toContain('hugo');
      const hasJob = names.some(n => n.includes('job'));
      expect(hasJob).toBe(true);
      expect(names).toContain('diva');
    });
  });

  describe('intent detection', () => {
    it('"how\'s this system? chord hugo + job integrated + WLM Diva" → system_assessment', () => {
      const result = detectIntent("how's this system? chord hugo + job integrated + WLM Diva");
      console.log('Intent:', result.intent, 'Subjects:', result.subjects);
      expect(result.intent).toBe('system_assessment');
      expect(result.subjects.length).toBeGreaterThanOrEqual(2);
    });

    it('"what do you think of this system? chord hugo + job integrated + WLM Diva" → system_assessment', () => {
      const result = detectIntent("what do you think of this system? chord hugo + job integrated + WLM Diva");
      expect(result.intent).toBe('system_assessment');
    });

    it('"is this a good setup? hugo + job integrated + WLM Diva" → system_assessment', () => {
      const result = detectIntent("is this a good setup? hugo + job integrated + WLM Diva");
      expect(result.intent).toBe('system_assessment');
    });

    it('arrow chain still works: "chord hugo → job integrated → WLM Diva"', () => {
      const result = detectIntent("chord hugo → job integrated → WLM Diva");
      expect(result.intent).toBe('system_assessment');
    });

    it('ownership + assessment still works: "I have a chord hugo, job integrated, and WLM Diva — what do you think?"', () => {
      const result = detectIntent("I have a chord hugo, job integrated, and WLM Diva — what do you think?");
      expect(result.intent).toBe('system_assessment');
    });

    // Regression: single-product assessment should still route to product_assessment
    it('"thoughts on JOB integrated" → product_assessment (not system_assessment)', () => {
      const result = detectIntent("thoughts on JOB integrated");
      expect(result.intent).toBe('product_assessment');
    });
  });

  // ── Full pipeline: assessment output quality ──

  describe('assessment output', () => {
    const target = "how's this system? chord hugo + job integrated + WLM Diva";
    const { result } = assess(target);

    it('produces an assessment (not null, not clarification)', () => {
      expect(result).not.toBeNull();
      expect(result!.kind).toBe('assessment');
    });

    it('includes all 3 components', () => {
      if (result?.kind !== 'assessment') throw new Error('Expected assessment');
      const names = (result.findings as any).componentNames as string[];
      console.log('Component names in findings:', names);
      expect(names.length).toBeGreaterThanOrEqual(3);
      // Check all three are represented
      const joined = names.join(' ').toLowerCase();
      expect(joined).toContain('hugo');
      expect(joined).toContain('job');
      expect(joined).toContain('diva');
    });

    it('has system-level interaction description', () => {
      if (result?.kind !== 'assessment') throw new Error('Expected assessment');
      const interaction = result.response.systemInteraction;
      console.log('System interaction:', interaction?.substring(0, 200));
      expect(interaction).toBeDefined();
      expect(interaction!.length).toBeGreaterThan(50);
    });

    it('has per-component readings', () => {
      if (result?.kind !== 'assessment') throw new Error('Expected assessment');
      const readings = result.response.componentReadings;
      console.log('Component readings count:', readings?.length);
      expect(readings).toBeDefined();
      expect(readings!.length).toBeGreaterThanOrEqual(3);
    });

    it('has strengths and limitations', () => {
      if (result?.kind !== 'assessment') throw new Error('Expected assessment');
      expect(result.response.assessmentStrengths).toBeDefined();
      expect(result.response.assessmentLimitations).toBeDefined();
    });

    it('does not contain "compared to" / "versus" / "vs" in interaction text', () => {
      if (result?.kind !== 'assessment') throw new Error('Expected assessment');
      const interaction = (result.response.systemInteraction ?? '').toLowerCase();
      expect(interaction).not.toContain('compared to');
      expect(interaction).not.toContain('versus');
      expect(interaction).not.toContain(' vs ');
    });

    it('prints full assessment summary', () => {
      if (result?.kind !== 'assessment') return;
      const r = result.response;
      const f = result.findings as any;
      console.log('\n═══ SYSTEM EVALUATION OUTPUT ═══');
      console.log('Components:', f.componentNames?.join(', '));
      console.log('Chain:', JSON.stringify(f.systemChain).substring(0, 200));
      console.log('System axes:', JSON.stringify(f.systemAxes));
      console.log('Bottleneck:', f.bottleneck);
      console.log('Interaction:', r.systemInteraction?.substring(0, 200));
      console.log('Strengths:', r.assessmentStrengths?.join(' | ').substring(0, 200));
      console.log('Limitations:', r.assessmentLimitations?.join(' | ').substring(0, 200));
      console.log('Upgrade direction:', r.upgradeDirection?.substring(0, 200));
      console.log('Follow-up:', r.followUp?.substring(0, 200));
    });
  });
});
