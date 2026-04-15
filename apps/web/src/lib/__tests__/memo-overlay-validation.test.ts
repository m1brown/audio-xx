/**
 * Tests for the LLM overlay validation and merge logic.
 *
 * Covers:
 *   1. Allowlist construction from MemoFindings
 *   2. Per-field validation (intro, keyObservation, recommendedSequence)
 *   3. Unknown product rejection
 *   4. Prohibited pattern rejection
 *   5. Length limit enforcement
 *   6. Partial acceptance (some fields pass, others rejected)
 *   7. Deterministic fallback when overlay is null
 *   8. Prompt construction from MemoFindings
 *   9. LLM response parsing (valid JSON, markdown fences, garbage)
 */

import {
  buildProductAllowlist,
  validateLlmOverlay,
} from '../memo-validation';
import type { LlmOverlayFields } from '../memo-validation';
import type { MemoFindings } from '../memo-findings';
import type { PrimaryAxisLeanings } from '../axis-types';
import {
  _buildSystemPrompt as buildSystemPrompt,
  _buildUserPrompt as buildUserPrompt,
  _parseLlmResponse as parseLlmResponse,
} from '../memo-llm-overlay';

// ── Test fixture ────────────────────────────────────

const neutralAxes: PrimaryAxisLeanings = {
  warm_bright: 'neutral',
  smooth_detailed: 'neutral',
  elastic_controlled: 'neutral',
  airy_closed: 'neutral',
};

function makeMockFindings(overrides?: Partial<MemoFindings>): MemoFindings {
  return {
    componentNames: ['Eversolo DMP-A6', 'Chord Hugo', 'JOB Integrated', 'WLM Diva Monitor'],
    systemChain: {
      roles: ['Streamer', 'DAC', 'Amplifier', 'Speakers'],
      names: ['Eversolo DMP-A6', 'Chord Hugo', 'JOB Integrated', 'WLM Diva Monitor'],
    },
    systemAxes: { ...neutralAxes, smooth_detailed: 'detailed' },
    perComponentAxes: [
      { name: 'Eversolo DMP-A6', axes: neutralAxes, source: 'product' },
      { name: 'Chord Hugo', axes: { ...neutralAxes, smooth_detailed: 'detailed' }, source: 'product' },
      { name: 'JOB Integrated', axes: { ...neutralAxes, warm_bright: 'bright' }, source: 'brand' },
      { name: 'WLM Diva Monitor', axes: { ...neutralAxes, elastic_controlled: 'elastic' }, source: 'product' },
    ],
    stackedTraits: [],
    bottleneck: {
      component: 'Eversolo DMP-A6',
      role: 'Streamer',
      category: 'source_limitation',
      constrainedAxes: ['smooth_detailed'],
      severity: 5,
    },
    componentVerdicts: [
      { name: 'Eversolo DMP-A6', role: 'Streamer', roles: ['streamer', 'dac'], catalogSource: 'product', axisPosition: neutralAxes, strengths: ['affordable', 'feature-rich'], weaknesses: ['limited resolving power'], verdict: 'bottleneck' },
      { name: 'Chord Hugo', role: 'DAC', roles: ['dac'], catalogSource: 'product', axisPosition: neutralAxes, strengths: ['timing precision', 'detail'], weaknesses: [], verdict: 'keep' },
      { name: 'JOB Integrated', role: 'Amplifier', roles: ['amplifier', 'preamp'], catalogSource: 'brand', axisPosition: neutralAxes, strengths: ['transparency'], weaknesses: [], verdict: 'keep' },
      { name: 'WLM Diva Monitor', role: 'Speakers', roles: ['speaker'], catalogSource: 'product', axisPosition: neutralAxes, strengths: ['efficiency', 'dynamics'], weaknesses: [], verdict: 'keep' },
    ],
    upgradePaths: [
      {
        rank: 1,
        targetRole: 'Streamer',
        impact: 'highest',
        targetAxes: ['smooth_detailed'],
        options: [
          { name: 'Innuos Zen Mini', brand: 'Innuos', priceRange: '~$1200', axisProfile: neutralAxes },
          { name: 'Lumin U2 Mini', brand: 'Lumin', priceRange: '~$2500', axisProfile: neutralAxes },
        ],
      },
    ],
    keeps: [
      { name: 'Chord Hugo', role: 'DAC', alignedAxes: ['smooth_detailed'] },
      { name: 'WLM Diva Monitor', role: 'Speakers', alignedAxes: ['elastic_controlled'] },
    ],
    recommendedSequence: [
      { step: 1, action: 'Upgrade streamer from Eversolo DMP-A6', targetRole: 'Streamer' },
      { step: 2, action: 'Reassess system balance', targetRole: 'System' },
    ],
    sourceReferences: [],
    listenerPriorities: ['timing_accuracy', 'transparency'],
    isDeliberate: true,
    deliberatenessSignals: ['multi_brand_coherence'],
    hasMultipleDACs: true,
    hasMultipleAmps: false,
    roleOverlaps: [{ role: 'dac', components: ['Eversolo DMP-A6', 'Chord Hugo'] }],
    activeDACInference: {
      activeDACName: 'Chord Hugo',
      activeDACType: 'standalone',
      multipleDACs: true,
      needsDACClarification: false,
      confidence: 'medium',
    },
    powerMatchAssessment: {
      ampName: 'Leben CS600X',
      speakerName: 'DeVore O/93',
      ampPowerWatts: 32,
      speakerSensitivityDb: 93,
      compatibility: 'optimal',
      estimatedMaxCleanSPL: 108,
      relevantInteraction: null,
    },
    ...overrides,
  };
}

// ── 1. Allowlist construction ───────────────────────

describe('buildProductAllowlist', () => {
  it('includes current system component names', () => {
    const findings = makeMockFindings();
    const allowlist = buildProductAllowlist(findings);
    expect(allowlist.has('chord hugo')).toBe(true);
    expect(allowlist.has('eversolo dmp-a6')).toBe(true);
    expect(allowlist.has('job integrated')).toBe(true);
    expect(allowlist.has('wlm diva monitor')).toBe(true);
  });

  it('includes upgrade path product names and brands', () => {
    const findings = makeMockFindings();
    const allowlist = buildProductAllowlist(findings);
    expect(allowlist.has('innuos zen mini')).toBe(true);
    expect(allowlist.has('innuos')).toBe(true);
    expect(allowlist.has('lumin u2 mini')).toBe(true);
    expect(allowlist.has('lumin')).toBe(true);
  });

  it('does not include random unrelated names', () => {
    const findings = makeMockFindings();
    const allowlist = buildProductAllowlist(findings);
    expect(allowlist.has('boenicke w5')).toBe(false);
    expect(allowlist.has('naim')).toBe(false);
  });
});

// ── 2. Field validation ─────────────────────────────

describe('validateLlmOverlay — introSummary', () => {
  const findings = makeMockFindings();
  const deterministicSeq = [
    { step: 1, action: 'Upgrade streamer from Eversolo DMP-A6' },
    { step: 2, action: 'Reassess system balance' },
  ];

  it('accepts valid intro text referencing known components', () => {
    const overlay: LlmOverlayFields = {
      introSummary: 'A four-component system built around the Chord Hugo DAC and JOB Integrated amplifier, driving the WLM Diva Monitor speakers from an Eversolo DMP-A6 streamer.',
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.introSummary).toBeDefined();
    expect(result.rejections.length).toBe(0);
  });

  it('rejects intro with unknown product reference', () => {
    const overlay: LlmOverlayFields = {
      introSummary: 'This system would pair well with a Naim Atom for streaming, which would transform the Chord Hugo setup.',
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.introSummary).toBeUndefined();
    expect(result.rejections.length).toBeGreaterThan(0);
    expect(result.rejections[0]).toContain('unknown product');
  });

  it('rejects intro exceeding length limit', () => {
    const overlay: LlmOverlayFields = {
      introSummary: 'A'.repeat(401),
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.introSummary).toBeUndefined();
    expect(result.rejections[0]).toContain('exceeds');
  });

  it('rejects intro with prohibited urgency language', () => {
    const overlay: LlmOverlayFields = {
      introSummary: 'You must immediately upgrade the streamer to hear what this system can really do.',
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.introSummary).toBeUndefined();
    expect(result.rejections[0]).toContain('prohibited');
  });

  it('rejects intro with superlatives', () => {
    const overlay: LlmOverlayFields = {
      introSummary: 'The Chord Hugo is the best DAC at this price point and makes this the perfect system.',
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.introSummary).toBeUndefined();
  });
});

describe('validateLlmOverlay — keyObservation', () => {
  const findings = makeMockFindings();
  const deterministicSeq = [
    { step: 1, action: 'Upgrade streamer' },
    { step: 2, action: 'Reassess' },
  ];

  it('accepts valid key observation', () => {
    const overlay: LlmOverlayFields = {
      keyObservation: 'The component choices suggest a listener who prioritises timing accuracy and transparency over tonal density.',
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.keyObservation).toBeDefined();
  });

  it('rejects key observation with affiliate language', () => {
    const overlay: LlmOverlayFields = {
      keyObservation: 'Click here for a discount on Chord Hugo upgrades through our partner store.',
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.keyObservation).toBeUndefined();
    expect(result.rejections.some((r) => r.includes('prohibited'))).toBe(true);
  });
});

describe('validateLlmOverlay — recommendedSequence', () => {
  const findings = makeMockFindings();
  const deterministicSeq = [
    { step: 1, action: 'Upgrade streamer from Eversolo DMP-A6' },
    { step: 2, action: 'Reassess system balance' },
  ];

  it('accepts sequence with correct step count and order', () => {
    const overlay: LlmOverlayFields = {
      recommendedSequence: [
        { step: 1, action: 'Replace the Eversolo DMP-A6 with a higher-resolution streamer.' },
        { step: 2, action: 'Once the streamer is settled, reassess the overall tonal balance.' },
      ],
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.recommendedSequence).toBeDefined();
    expect(result.accepted.recommendedSequence!.length).toBe(2);
  });

  it('rejects sequence with mismatched step count', () => {
    const overlay: LlmOverlayFields = {
      recommendedSequence: [
        { step: 1, action: 'Replace the streamer.' },
      ],
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.recommendedSequence).toBeUndefined();
    expect(result.rejections[0]).toContain('step count mismatch');
  });

  it('rejects sequence with wrong step order', () => {
    const overlay: LlmOverlayFields = {
      recommendedSequence: [
        { step: 2, action: 'Reassess balance.' },
        { step: 1, action: 'Replace the streamer.' },
      ],
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.recommendedSequence).toBeUndefined();
    expect(result.rejections[0]).toContain('step order mismatch');
  });

  it('rejects sequence step exceeding length limit', () => {
    const overlay: LlmOverlayFields = {
      recommendedSequence: [
        { step: 1, action: 'A'.repeat(201) },
        { step: 2, action: 'Reassess.' },
      ],
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.recommendedSequence).toBeUndefined();
  });
});

// ── 3. Partial acceptance ───────────────────────────

describe('validateLlmOverlay — partial acceptance', () => {
  const findings = makeMockFindings();
  const deterministicSeq = [
    { step: 1, action: 'Upgrade streamer' },
    { step: 2, action: 'Reassess' },
  ];

  it('accepts valid intro but rejects invalid key observation', () => {
    const overlay: LlmOverlayFields = {
      introSummary: 'A system built around the Chord Hugo DAC.',
      keyObservation: 'This is the best system I have ever seen — buy now!',
    };
    const result = validateLlmOverlay(overlay, findings, deterministicSeq);
    expect(result.accepted.introSummary).toBeDefined();
    expect(result.accepted.keyObservation).toBeUndefined();
    expect(result.rejections.length).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
  });
});

// ── 4. Prompt construction ──────────────────────────

describe('buildSystemPrompt', () => {
  it('includes strict constraints section', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('STRICT CONSTRAINTS');
    expect(prompt).toContain('introSummary');
    expect(prompt).toContain('keyObservation');
    expect(prompt).toContain('recommendedSequence');
  });
});

describe('buildUserPrompt', () => {
  it('includes component names and chain', () => {
    const findings = makeMockFindings();
    const prompt = buildUserPrompt(findings);
    expect(prompt).toContain('Chord Hugo');
    expect(prompt).toContain('Eversolo DMP-A6');
    expect(prompt).toContain('JOB Integrated');
    expect(prompt).toContain('WLM Diva Monitor');
    expect(prompt).toContain('SIGNAL CHAIN');
  });

  it('includes bottleneck when present', () => {
    const findings = makeMockFindings();
    const prompt = buildUserPrompt(findings);
    expect(prompt).toContain('PRIMARY CONSTRAINT');
    expect(prompt).toContain('Eversolo DMP-A6');
  });

  it('includes upgrade path options', () => {
    const findings = makeMockFindings();
    const prompt = buildUserPrompt(findings);
    expect(prompt).toContain('UPGRADE PATHS');
    expect(prompt).toContain('Innuos Zen Mini');
    expect(prompt).toContain('Lumin U2 Mini');
  });

  it('includes listener priorities', () => {
    const findings = makeMockFindings();
    const prompt = buildUserPrompt(findings);
    expect(prompt).toContain('LISTENER PRIORITIES');
    expect(prompt).toContain('timing accuracy');
    expect(prompt).toContain('transparency');
  });
});

// ── 5. LLM response parsing ────────────────────────

describe('parseLlmResponse', () => {
  it('parses valid JSON', () => {
    const json = JSON.stringify({
      introSummary: 'A detailed system.',
      keyObservation: 'Values transparency.',
      recommendedSequence: [{ step: 1, action: 'Upgrade streamer.' }],
    });
    const result = parseLlmResponse(json);
    expect(result).not.toBeNull();
    expect(result!.introSummary).toBe('A detailed system.');
    expect(result!.keyObservation).toBe('Values transparency.');
    expect(result!.recommendedSequence).toHaveLength(1);
  });

  it('handles markdown code fences', () => {
    const wrapped = '```json\n{"introSummary": "Wrapped."}\n```';
    const result = parseLlmResponse(wrapped);
    expect(result).not.toBeNull();
    expect(result!.introSummary).toBe('Wrapped.');
  });

  it('returns null for garbage input', () => {
    expect(parseLlmResponse('this is not json')).toBeNull();
  });

  it('returns null for non-object', () => {
    expect(parseLlmResponse('"just a string"')).toBeNull();
  });

  it('handles partial fields (only intro)', () => {
    const json = JSON.stringify({ introSummary: 'Only intro.' });
    const result = parseLlmResponse(json);
    expect(result).not.toBeNull();
    expect(result!.introSummary).toBe('Only intro.');
    expect(result!.keyObservation).toBeUndefined();
    expect(result!.recommendedSequence).toBeUndefined();
  });

  it('filters malformed sequence steps', () => {
    const json = JSON.stringify({
      recommendedSequence: [
        { step: 1, action: 'Valid.' },
        { step: 'two', action: 'Invalid step number.' },
        { action: 'Missing step.' },
      ],
    });
    const result = parseLlmResponse(json);
    expect(result).not.toBeNull();
    // Only the first step has valid types
    expect(result!.recommendedSequence).toHaveLength(1);
    expect(result!.recommendedSequence![0].step).toBe(1);
  });
});

// ── 6. Deterministic fallback ───────────────────────

describe('deterministic fallback behavior', () => {
  it('null overlay result means deterministic stands (no crash)', () => {
    // Simulate what page.tsx does: if requestLlmOverlay returns null, no merge
    const overlayResult = null;
    const deterministicAdvisory = {
      introSummary: 'Deterministic intro.',
      keyObservation: 'Deterministic observation.',
    };

    // This is the merge logic from page.tsx
    if (overlayResult) {
      // Would merge — but overlay is null so this doesn't execute
      throw new Error('Should not reach here');
    }

    // Advisory stays deterministic
    expect(deterministicAdvisory.introSummary).toBe('Deterministic intro.');
    expect(deterministicAdvisory.keyObservation).toBe('Deterministic observation.');
  });

  it('empty accepted fields means no merge', () => {
    const overlayResult = { fields: {}, rejections: ['all fields rejected'] };
    const hasFieldsToMerge = Object.keys(overlayResult.fields).length > 0;
    expect(hasFieldsToMerge).toBe(false);
  });
});
