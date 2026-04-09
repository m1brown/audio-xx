/**
 * Runtime-style validation of inferActiveDAC() + narrative integration.
 *
 * Tests both:
 *   - Logical correctness of the inference function
 *   - Narrative quality of the text that would be generated
 *
 * Each case constructs realistic SystemComponent[], runs inferActiveDAC(),
 * then simulates the narrative conditional from composeAssessmentNarrative
 * to check the exact text output.
 */

import { inferActiveDAC } from '../consultation';
import type { SystemComponent } from '../consultation';
import type { ActiveDACInference } from '../memo-findings';

// ── Helpers ────────────────────────────────────────────

function makeComponent(
  displayName: string,
  role: string,
  roles: string[],
): SystemComponent {
  return { displayName, role, roles, character: `${displayName} character` };
}

/**
 * Replicate the exact narrative conditional from composeAssessmentNarrative.
 * This is a copy of the dacNote logic so we can test it without needing
 * the full MemoFindings pipeline.
 */
function buildDACNarrative(
  dac: ActiveDACInference,
  roleOverlaps: { role: string; components: string[] }[],
): string {
  if (dac.multipleDACs && dac.activeDACName && !dac.needsDACClarification) {
    const dacOverlap = roleOverlaps.find((o) => o.role === 'dac');
    const others = dacOverlap?.components.filter((n) => n !== dac.activeDACName) ?? [];

    if (dac.confidence === 'high') {
      return `Your system uses the ${dac.activeDACName} as its DAC.`;
    } else if (dac.confidence === 'medium') {
      if (dac.activeDACType === 'standalone' && others.length > 0) {
        return `Your system likely uses the ${dac.activeDACName} as the primary DAC. If it is handling digital conversion, the DAC stage in the ${others.join(' and ')} would typically not be used.`;
      } else if (dac.activeDACType === 'integrated' && others.length > 0) {
        return `Your system likely uses the DAC in your integrated amplifier (${dac.activeDACName}). If so, the ${others.join(' and ')} feeds it as a transport.`;
      } else {
        return `Your system likely uses the ${dac.activeDACName} as its primary DAC.`;
      }
    } else {
      return `Your system includes multiple DAC-capable components. The ${dac.activeDACName} is the most likely active DAC, but the actual conversion path depends on how they are connected.`;
    }
  } else if (dac.needsDACClarification) {
    return `Your system includes multiple DAC-capable components, and the active conversion path is unclear. Which DAC is handling conversion affects the sound — worth confirming your signal routing.`;
  }
  return ''; // No DAC note needed
}

/**
 * Build roleOverlaps from components (mirrors extractMemoFindings logic).
 */
function buildRoleOverlaps(components: SystemComponent[]): { role: string; components: string[] }[] {
  const roleCounts = new Map<string, string[]>();
  for (const c of components) {
    for (const r of c.roles) {
      const norm = r.toLowerCase();
      if (!roleCounts.has(norm)) roleCounts.set(norm, []);
      roleCounts.get(norm)!.push(c.displayName);
    }
  }
  const overlaps: { role: string; components: string[] }[] = [];
  for (const [role, names] of roleCounts) {
    if (names.length >= 2) overlaps.push({ role, components: names });
  }
  return overlaps;
}

// ── Narrative quality assertions ───────────────────────

/** Phrases that should NEVER appear when confidence is not 'high'. */
const DEFINITIVE_PHRASES = [
  'is the active DAC',
  'is bypassed',
  'the DAC in the',  // without "likely" qualifier
];

function assertNoDefinitiveClaims(text: string, confidence: string): void {
  if (confidence === 'high') return;
  for (const phrase of DEFINITIVE_PHRASES) {
    // Allow "likely uses the DAC in" but not bare "the DAC in"
    if (text.includes(phrase) && !text.includes('likely')) {
      throw new Error(
        `Narrative contains definitive phrase "${phrase}" at confidence "${confidence}": "${text}"`,
      );
    }
  }
}

function assertContainsHedge(text: string, confidence: string): void {
  if (confidence === 'high' || text === '') return;
  const hedges = ['likely', 'If ', 'unclear', 'depends on', 'most likely', 'typically'];
  const hasHedge = hedges.some((h) => text.includes(h));
  if (!hasHedge) {
    throw new Error(
      `Narrative at confidence "${confidence}" lacks hedging language: "${text}"`,
    );
  }
}

// ── Test cases ─────────────────────────────────────────

describe('DAC inference validation — 7 scenarios', () => {

  // ── Case 1: Source-only DAC ──
  describe('Case 1 — Source-only DAC', () => {
    const components = [
      makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
      makeComponent('NAD C 316BEE', 'amplifier', ['amplifier']),
      makeComponent('ELAC Debut B6.2', 'speaker', ['speaker']),
    ];

    it('inference: confidence high, no clarification', () => {
      const result = inferActiveDAC(components);
      expect(result.activeDACName).toBe('Bluesound Node');
      expect(result.activeDACType).toBe('source');
      expect(result.confidence).toBe('high');
      expect(result.needsDACClarification).toBe(false);
      expect(result.multipleDACs).toBe(false);
    });

    it('narrative: no DAC note (single DAC, no ambiguity)', () => {
      const result = inferActiveDAC(components);
      const overlaps = buildRoleOverlaps(components);
      const narrative = buildDACNarrative(result, overlaps);
      // Single DAC → multipleDACs is false → no note generated
      expect(narrative).toBe('');
    });
  });

  // ── Case 2: Source + integrated amp with DAC ──
  describe('Case 2 — Source + integrated amp DAC', () => {
    const components = [
      makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
      makeComponent('Hegel H190', 'amplifier', ['integrated', 'amp', 'dac']),
      makeComponent('Focal Aria 906', 'speaker', ['speaker']),
    ];

    it('inference: integrated selected, confidence medium', () => {
      const result = inferActiveDAC(components);
      expect(result.activeDACName).toBe('Hegel H190');
      expect(result.activeDACType).toBe('integrated');
      expect(result.confidence).toBe('medium');
      expect(result.needsDACClarification).toBe(false);
      expect(result.multipleDACs).toBe(true);
    });

    it('narrative: uses "likely", conditional language', () => {
      const result = inferActiveDAC(components);
      const overlaps = buildRoleOverlaps(components);
      const narrative = buildDACNarrative(result, overlaps);

      expect(narrative).toContain('likely');
      expect(narrative).toContain('Hegel H190');
      assertNoDefinitiveClaims(narrative, result.confidence);
      assertContainsHedge(narrative, result.confidence);
    });
  });

  // ── Case 3: Source + standalone DAC ──
  describe('Case 3 — Source + standalone DAC', () => {
    const components = [
      makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
      makeComponent('Chord Qutest', 'dac', ['dac']),
      makeComponent('Pass Labs INT-25', 'amplifier', ['amplifier']),
      makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
    ];

    it('inference: standalone selected, confidence medium', () => {
      const result = inferActiveDAC(components);
      expect(result.activeDACName).toBe('Chord Qutest');
      expect(result.activeDACType).toBe('standalone');
      expect(result.confidence).toBe('medium');
      expect(result.needsDACClarification).toBe(false);
    });

    it('narrative: conditional bypass language only', () => {
      const result = inferActiveDAC(components);
      const overlaps = buildRoleOverlaps(components);
      const narrative = buildDACNarrative(result, overlaps);

      expect(narrative).toContain('likely');
      expect(narrative).toContain('Chord Qutest');
      // Must NOT say "is bypassed" — only "would typically not be used"
      expect(narrative).not.toContain('is bypassed');
      expect(narrative).toContain('If ');
      assertNoDefinitiveClaims(narrative, result.confidence);
    });
  });

  // ── Case 4: Full chain (source + standalone + integrated) ──
  describe('Case 4 — Full chain (3 DACs)', () => {
    const components = [
      makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
      makeComponent('Chord Qutest', 'dac', ['dac']),
      makeComponent('Hegel H190', 'amplifier', ['integrated', 'amp', 'dac']),
      makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
    ];

    it('inference: standalone selected, confidence medium', () => {
      const result = inferActiveDAC(components);
      expect(result.activeDACName).toBe('Chord Qutest');
      expect(result.activeDACType).toBe('standalone');
      expect(result.confidence).toBe('medium');
      expect(result.multipleDACs).toBe(true);
    });

    it('narrative: no hard bypass claims', () => {
      const result = inferActiveDAC(components);
      const overlaps = buildRoleOverlaps(components);
      const narrative = buildDACNarrative(result, overlaps);

      expect(narrative).not.toContain('is bypassed');
      expect(narrative).not.toContain('is the active DAC');
      assertNoDefinitiveClaims(narrative, result.confidence);
      assertContainsHedge(narrative, result.confidence);
    });
  });

  // ── Case 5: Two standalone DACs (ambiguity) ──
  describe('Case 5 — Two standalone DACs', () => {
    const components = [
      makeComponent('Chord Qutest', 'dac', ['dac']),
      makeComponent('Denafrips Ares II', 'dac', ['dac']),
      makeComponent('Pass Labs INT-25', 'amplifier', ['amplifier']),
      makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
    ];

    it('inference: ambiguous, low confidence, needs clarification', () => {
      const result = inferActiveDAC(components);
      expect(result.activeDACName).toBeNull();
      expect(result.confidence).toBe('low');
      expect(result.needsDACClarification).toBe(true);
      expect(result.multipleDACs).toBe(true);
    });

    it('narrative: clearly states ambiguity', () => {
      const result = inferActiveDAC(components);
      const overlaps = buildRoleOverlaps(components);
      const narrative = buildDACNarrative(result, overlaps);

      expect(narrative).toContain('unclear');
      expect(narrative).not.toContain('is the active DAC');
      expect(narrative).not.toContain('is bypassed');
    });
  });

  // ── Case 6: Malformed data (missing roles[]) ──
  describe('Case 6 — Malformed data', () => {
    const components = [
      { displayName: 'Some DAC', role: 'dac', roles: undefined as unknown as string[], character: 'test' },
      makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
    ] as SystemComponent[];

    it('inference: low confidence, needs clarification, no crash', () => {
      const result = inferActiveDAC(components);
      expect(result.confidence).toBe('low');
      expect(result.needsDACClarification).toBe(true);
      // Should not crash
      expect(result.multipleDACs).toBe(true);
    });

    it('narrative: reflects uncertainty', () => {
      const result = inferActiveDAC(components);
      // Build overlaps manually since one component has malformed roles
      const overlaps = [{ role: 'dac', components: ['Some DAC', 'Bluesound Node'] }];
      const narrative = buildDACNarrative(result, overlaps);

      // needsDACClarification is true → should get the ambiguity message
      expect(narrative).toContain('unclear');
      expect(narrative).not.toContain('is the active DAC');
    });
  });

  // ── Case 7: No DAC in system ──
  describe('Case 7 — No DAC in system', () => {
    const components = [
      makeComponent('Rega Planar 3', 'turntable', ['turntable']),
      makeComponent('Rega Brio', 'amplifier', ['amplifier']),
      makeComponent('Wharfedale Linton', 'speaker', ['speaker']),
    ];

    it('inference: null, low confidence, no clarification', () => {
      const result = inferActiveDAC(components);
      expect(result.activeDACName).toBeNull();
      expect(result.activeDACType).toBeNull();
      expect(result.confidence).toBe('low');
      expect(result.needsDACClarification).toBe(false);
      expect(result.multipleDACs).toBe(false);
    });

    it('narrative: empty (no DAC behavior invented)', () => {
      const result = inferActiveDAC(components);
      const overlaps = buildRoleOverlaps(components);
      const narrative = buildDACNarrative(result, overlaps);

      // No DAC → no note at all
      expect(narrative).toBe('');
    });
  });
});
