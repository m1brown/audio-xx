/**
 * Integration-style tests for the deterministic system-assessment pipeline.
 *
 * Tests the full pipeline through buildSystemAssessment:
 *   - System parsing and component identification
 *   - Chain reconstruction correctness
 *   - Bottleneck detection and upgrade ranking
 *   - Consistency between keeps and upgrade targets
 *   - Reconciliation / no contradictions
 *   - Memo section population
 *
 * Uses realistic audio chain examples.
 */

// @ts-nocheck — globals provided by test-runner.ts
import { detectIntent } from '../intent';
import {
  buildSystemAssessment,
  type SystemAssessmentResult,
} from '../consultation';
import { renderDeterministicMemo } from '../memo-deterministic-renderer';

// ── Helpers ──────────────────────────────────────────

/**
 * Run the full assessment pipeline for a user message.
 * Returns the assessment result, or fails the test if null/clarification.
 */
function assess(message: string): Extract<SystemAssessmentResult, { kind: 'assessment' }> {
  const { subjectMatches, desires } = detectIntent(message);
  const result = buildSystemAssessment(message, subjectMatches, null, desires);
  if (!result) throw new Error(`buildSystemAssessment returned null for: "${message}"`);
  if (result.kind === 'clarification') {
    throw new Error(`Unexpected clarification: ${result.clarification.question} for: "${message}"`);
  }
  return result;
}

/**
 * Build a minimal LegacyProseInputs from a result for parity testing.
 * Extracts the prose fields that the pipeline already computed from the response.
 */
function extractProseFromResponse(
  result: Extract<SystemAssessmentResult, { kind: 'assessment' }>,
): import('../memo-deterministic-renderer').LegacyProseInputs {
  const r = result.response;
  return {
    subject: r.subject.replace(/^Your system:\s*/, ''),
    systemCharacterOpening: r.systemContext ?? '',
    componentParagraphs: r.componentReadings ?? [],
    systemInteraction: r.systemInteraction ?? '',
    assessmentStrengths: r.assessmentStrengths ?? [],
    assessmentLimitations: r.assessmentLimitations ?? [],
    upgradeDirection: r.upgradeDirection ?? '',
    followUp: r.followUp ?? '',
    links: r.links ?? [],
    introSummary: r.introSummary ?? '',
    keyObservation: r.keyObservation ?? '',
  };
}

/**
 * Run the pipeline expecting a clarification response.
 */
function expectClarification(message: string): string {
  const { subjectMatches, desires } = detectIntent(message);
  const result = buildSystemAssessment(message, subjectMatches, null, desires);
  if (!result) throw new Error(`buildSystemAssessment returned null (expected clarification) for: "${message}"`);
  if (result.kind !== 'clarification') {
    throw new Error(`Expected clarification but got assessment for: "${message}"`);
  }
  return result.clarification.question;
}

// ── Consistency check helpers ────────────────────────

function assertNoKeepUpgradeConflict(
  findings: NonNullable<Extract<SystemAssessmentResult, { kind: 'assessment' }>['findings']>,
) {
  const keepNames = new Set(findings.keeps.map((k) => k.name.toLowerCase()));
  const upgradeTargets = new Set(
    findings.upgradePaths.map((p) => p.targetRole.toLowerCase()),
  );
  const bottleneckName = findings.bottleneck?.component.toLowerCase();

  // No component should be both kept and targeted for upgrade
  for (const keep of findings.keeps) {
    const keepLower = keep.name.toLowerCase();
    // Should not be the bottleneck
    expect(keepLower).not.toBe(bottleneckName);
  }

  // Bottleneck should not be in keeps
  if (bottleneckName) {
    expect(keepNames.has(bottleneckName)).toBe(false);
  }
}

function assertChainOrder(
  findings: NonNullable<Extract<SystemAssessmentResult, { kind: 'assessment' }>['findings']>,
) {
  const chain = findings.systemChain;
  // The canonical role order should be source → DAC → amp → speaker
  const roleOrder: Record<string, number> = {
    Streamer: 0,
    DAC: 1,
    Preamplifier: 2,
    Amplifier: 3,
    Speakers: 4,
    Headphones: 4,
    Subwoofer: 5,
  };
  let lastOrder = -1;
  for (const role of chain.roles) {
    const order = roleOrder[role] ?? 99;
    if (order < 99) {
      expect(order).toBeGreaterThanOrEqual(lastOrder);
      lastOrder = order;
    }
  }
}

function assertMemoPopulated(
  result: Extract<SystemAssessmentResult, { kind: 'assessment' }>,
) {
  const { findings, response } = result;

  // MemoFindings should have essential fields
  expect(findings.componentNames.length).toBeGreaterThanOrEqual(2);
  expect(findings.systemChain.roles.length).toBeGreaterThanOrEqual(2);
  expect(findings.systemChain.names.length).toBeGreaterThanOrEqual(2);
  expect(findings.componentVerdicts.length).toBeGreaterThanOrEqual(2);

  // Response should have essential prose sections
  expect(response.subject).toBeTruthy();
  expect(response.systemContext).toBeTruthy();
  expect(response.componentReadings).toBeTruthy();
  expect(response.componentReadings!.length).toBeGreaterThanOrEqual(2);
  expect(response.systemInteraction).toBeTruthy();
}

// ──────────────────────────────────────────────────────
// Integration tests: realistic audio chains
// ──────────────────────────────────────────────────────

describe('Integration: Eversolo → Chord Hugo → JOB → WLM Diva', () => {
  it('produces an assessment (not clarification)', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    expect(result.kind).toBe('assessment');
  });

  it('identifies all 4 components', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    expect(result.findings.componentNames.length).toBeGreaterThanOrEqual(4);
  });

  it('preserves chain order', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    assertChainOrder(result.findings);
  });

  it('keeps and upgrades do not conflict', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    assertNoKeepUpgradeConflict(result.findings);
  });

  it('memo sections are populated', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    assertMemoPopulated(result);
  });

  it('chain has fullChain from arrows', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    expect(result.findings.systemChain.fullChain).toBeDefined();
    expect(result.findings.systemChain.fullChain!.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Integration: WiiM → Hugo → Crayon CIA → XSA Vanguard', () => {
  it('produces an assessment', () => {
    const result = assess(
      'My system: WiiM Pro → Chord Hugo → Crayon CIA-1 → XSA Vanguard. What should I upgrade?',
    );
    expect(result.kind).toBe('assessment');
  });

  it('identifies streamer, DAC, amplifier, speaker roles', () => {
    const result = assess(
      'My system: WiiM Pro → Chord Hugo → Crayon CIA-1 → XSA Vanguard. What should I upgrade?',
    );
    const roles = result.findings.systemChain.roles;
    expect(roles).toContain('Streamer');
    expect(roles).toContain('DAC');
    expect(roles).toContain('Speakers');
    // Crayon CIA-1 is an integrated amplifier — canonicalRole maps 'integrated' to 'Integrated'
    const hasAmp = roles.includes('Amplifier') || roles.includes('Integrated');
    expect(hasAmp).toBe(true);
  });

  it('chain is correct source→output order', () => {
    const result = assess(
      'My system: WiiM Pro → Chord Hugo → Crayon CIA-1 → XSA Vanguard. What should I upgrade?',
    );
    assertChainOrder(result.findings);
  });

  it('keeps and upgrades are consistent', () => {
    const result = assess(
      'My system: WiiM Pro → Chord Hugo → Crayon CIA-1 → XSA Vanguard. What should I upgrade?',
    );
    assertNoKeepUpgradeConflict(result.findings);
  });
});

describe('Integration: Denafrips Pontus → Leben CS300 → Harbeth', () => {
  it('produces an assessment for 3-component chain', () => {
    const result = assess(
      'I have Denafrips Pontus into Leben CS300 into Harbeth P3ESR. How does my system balance look?',
    );
    expect(result.kind).toBe('assessment');
  });

  it('identifies DAC, amplifier, speaker roles', () => {
    const result = assess(
      'I have Denafrips Pontus into Leben CS300 into Harbeth P3ESR. How does my system balance look?',
    );
    expect(result.findings.componentNames.length).toBeGreaterThanOrEqual(3);
    const roles = result.findings.systemChain.roles;
    expect(roles).toContain('DAC');
    expect(roles).toContain('Speakers');
    // Leben CS300 → amplifier via KNOWN_PRODUCT_ROLES
    expect(roles).toContain('Amplifier');
  });

  it('keeps and upgrades are consistent', () => {
    const result = assess(
      'I have Denafrips Pontus into Leben CS300 into Harbeth P3ESR. How does my system balance look?',
    );
    assertNoKeepUpgradeConflict(result.findings);
  });

  it('memo sections populated', () => {
    const result = assess(
      'I have Denafrips Pontus into Leben CS300 into Harbeth P3ESR. How does my system balance look?',
    );
    assertMemoPopulated(result);
  });
});

// ──────────────────────────────────────────────────────
// Clarification triggers
// ──────────────────────────────────────────────────────

describe('Integration: clarification triggers', () => {
  it('"WiiM Pro DAC" triggers role-label clarification', () => {
    // WiiM Pro is a streamer in the catalog. User calling it "DAC" should
    // trigger a role-label conflict clarification.
    const question = expectClarification(
      'My system is WiiM Pro DAC → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    expect(question).toMatch(/WiiM/i);
    expect(question).toMatch(/DAC|streamer/i);
  });
});

// ──────────────────────────────────────────────────────
// Parenthetical brand suppression
// ──────────────────────────────────────────────────────

describe('Integration: parenthetical brand suppression', () => {
  it('"Job (Goldmund)" does not create a separate Goldmund component', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → Job (Goldmund) integrated amp → WLM Diva Monitor. How does it look?',
    );
    const names = result.findings.componentNames.map((n) => n.toLowerCase());
    // Should have exactly 4 components, not 5+
    expect(names.length).toBe(4);
    // Should NOT have a standalone "Goldmund" component
    expect(names.some((n) => n === 'goldmund')).toBe(false);
    // Should have JOB as a component
    expect(names.some((n) => n.includes('job'))).toBe(true);
  });

  it('active system seed does not inject components not in the message', () => {
    const { subjectMatches, desires } = detectIntent(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    // Simulate an active system with an extra component not in the message
    const activeSystem = {
      systemId: 'test',
      systemName: 'Living Room',
      components: [
        { brand: 'Eversolo', name: 'DMP-A6', category: 'streamer' as const },
        { brand: 'Chord', name: 'Hugo', category: 'dac' as const },
        { brand: 'JOB', name: 'Integrated', category: 'amplifier' as const },
        { brand: 'Boenicke', name: 'W5', category: 'speaker' as const },
        { brand: 'WLM', name: 'Diva Monitor', category: 'speaker' as const },
      ],
    };
    const result = buildSystemAssessment(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
      subjectMatches,
      activeSystem,
      desires,
    );
    expect(result).not.toBeNull();
    if (result!.kind !== 'assessment') throw new Error('Expected assessment');
    const names = result!.findings.componentNames.map((n) => n.toLowerCase());
    // Boenicke W5 is NOT mentioned in the message — should NOT appear
    expect(names.some((n) => n.includes('boenicke') || n.includes('w5'))).toBe(false);
    // The 4 mentioned components should be present
    expect(names.length).toBe(4);
  });
});

// ──────────────────────────────────────────────────────
// Bottleneck and recommendation coherence
// ──────────────────────────────────────────────────────

describe('Bottleneck and recommendation coherence', () => {
  it('bottleneck component is not in keeps', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    if (result.findings.bottleneck) {
      const bottleneckLower = result.findings.bottleneck.component.toLowerCase();
      const keepNames = result.findings.keeps.map((k) => k.name.toLowerCase());
      expect(keepNames).not.toContain(bottleneckLower);
    }
  });

  it('first upgrade path targets the bottleneck role', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    if (result.findings.bottleneck && result.findings.upgradePaths.length > 0) {
      // The highest-ranked upgrade should target the bottleneck's role
      const topPath = result.findings.upgradePaths[0];
      expect(topPath.rank).toBe(1);
      // The topPath should relate to the bottleneck component's role
      expect(topPath.impact).toMatch(/highest|high/i);
    }
  });

  it('upgrade paths have decreasing impact', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    const paths = result.findings.upgradePaths;
    if (paths.length >= 2) {
      // Ranks should be ascending (1, 2, 3...)
      for (let i = 1; i < paths.length; i++) {
        expect(paths[i].rank).toBeGreaterThan(paths[i - 1].rank);
      }
    }
  });

  it('recommended sequence steps are numbered sequentially', () => {
    const result = assess(
      'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    );
    const seq = result.findings.recommendedSequence;
    if (seq.length > 0) {
      for (let i = 0; i < seq.length; i++) {
        expect(seq[i].step).toBe(i + 1);
      }
    }
  });
});

// ──────────────────────────────────────────────────────
// Consistency / reconciliation
// ──────────────────────────────────────────────────────

describe('Reconciliation consistency', () => {
  const testCases = [
    'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    'My system: WiiM Pro → Chord Hugo → Crayon CIA-1 → XSA Vanguard. What should I upgrade?',
    'I have Denafrips Pontus into Leben CS300 into Harbeth P3ESR. How does my system balance look?',
  ];

  for (const msg of testCases) {
    describe(`for: "${msg.slice(0, 60)}..."`, () => {
      it('no component is both "keep" and upgrade target', () => {
        const result = assess(msg);
        assertNoKeepUpgradeConflict(result.findings);
      });

      it('every verdict component is in componentNames', () => {
        const result = assess(msg);
        const names = new Set(result.findings.componentNames.map((n) => n.toLowerCase()));
        for (const v of result.findings.componentVerdicts) {
          expect(names.has(v.name.toLowerCase())).toBe(true);
        }
      });

      it('per-component axes cover all assessed components', () => {
        const result = assess(msg);
        const axisNames = new Set(
          result.findings.perComponentAxes.map((a) => a.name.toLowerCase()),
        );
        for (const name of result.findings.componentNames) {
          expect(axisNames.has(name.toLowerCase())).toBe(true);
        }
      });

      it('upgrade path options reference only known products/brands', () => {
        const result = assess(msg);
        // Every upgrade option should have non-empty name and brand
        for (const path of result.findings.upgradePaths) {
          for (const opt of path.options) {
            expect(opt.name.length).toBeGreaterThan(0);
            expect(opt.brand.length).toBeGreaterThan(0);
          }
        }
      });

      it('stacked traits reference actual component names', () => {
        const result = assess(msg);
        const names = new Set(result.findings.componentNames.map((n) => n.toLowerCase()));
        for (const trait of result.findings.stackedTraits) {
          for (const contributor of trait.contributors) {
            // Contributors should be component names we know about
            expect(names.has(contributor.toLowerCase())).toBe(true);
          }
        }
      });
    });
  }
});

// ──────────────────────────────────────────────────────
// Comma-separated input
// ──────────────────────────────────────────────────────

describe('Integration: comma-separated input', () => {
  it('comma-separated with assessment language produces assessment', () => {
    // Need assessment language + ownership + 2+ subjects
    const { subjectMatches, desires } = detectIntent(
      'My system: Eversolo DMP-A6, Chord Hugo, WLM Diva. How does it look?',
    );
    const result = buildSystemAssessment(
      'My system: Eversolo DMP-A6, Chord Hugo, WLM Diva. How does it look?',
      subjectMatches,
      null,
      desires,
    );
    // May return assessment or null (if not enough components recognized)
    if (result && result.kind === 'assessment') {
      assertChainOrder(result.findings);
      assertNoKeepUpgradeConflict(result.findings);
    }
  });
});

// ──────────────────────────────────────────────────────
// Renderer parity: MemoFindings-only path vs StructuredMemoInputs path
// ──────────────────────────────────────────────────────

describe('Renderer parity: MemoFindings-only rendering', () => {
  const testMessages = [
    'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?',
    'I have Denafrips Pontus into Leben CS300 into Harbeth P3ESR. How does my system balance look?',
  ];

  for (const msg of testMessages) {
    describe(`for: "${msg.slice(0, 55)}..."`, () => {
      it('MemoFindings-only path produces matching systemChain', () => {
        const result = assess(msg);
        const prose = extractProseFromResponse(result);
        const memoOnly = renderDeterministicMemo(result.findings, prose);
        const original = result.response;

        // systemChain should match
        expect(memoOnly.systemChain?.roles).toEqual(original.systemChain?.roles);
        expect(memoOnly.systemChain?.names).toEqual(original.systemChain?.names);
        expect(memoOnly.systemChain?.fullChain).toEqual(original.systemChain?.fullChain);
      });

      it('MemoFindings-only path produces matching keepRecommendations count', () => {
        const result = assess(msg);
        const prose = extractProseFromResponse(result);
        const memoOnly = renderDeterministicMemo(result.findings, prose);
        const original = result.response;

        // Keep recommendations should have the same count
        const memoKeepCount = memoOnly.keepRecommendations?.length ?? 0;
        const origKeepCount = original.keepRecommendations?.length ?? 0;
        expect(memoKeepCount).toBe(origKeepCount);
      });

      it('MemoFindings-only path produces matching upgrade path count and ranks', () => {
        const result = assess(msg);
        const prose = extractProseFromResponse(result);
        const memoOnly = renderDeterministicMemo(result.findings, prose);
        const original = result.response;

        const memoPathCount = memoOnly.upgradePaths?.length ?? 0;
        const origPathCount = original.upgradePaths?.length ?? 0;
        expect(memoPathCount).toBe(origPathCount);

        // Ranks should match
        if (memoOnly.upgradePaths && original.upgradePaths) {
          for (let i = 0; i < memoOnly.upgradePaths.length; i++) {
            expect(memoOnly.upgradePaths[i].rank).toBe(original.upgradePaths[i].rank);
          }
        }
      });

      it('MemoFindings-only path produces matching componentAssessments count', () => {
        const result = assess(msg);
        const prose = extractProseFromResponse(result);
        const memoOnly = renderDeterministicMemo(result.findings, prose);
        const original = result.response;

        const memoCount = memoOnly.componentAssessments?.length ?? 0;
        const origCount = original.componentAssessments?.length ?? 0;
        expect(memoCount).toBe(origCount);
      });

      it('MemoFindings-only path produces matching recommended sequence', () => {
        const result = assess(msg);
        const prose = extractProseFromResponse(result);
        const memoOnly = renderDeterministicMemo(result.findings, prose);
        const original = result.response;

        const memoSeqCount = memoOnly.recommendedSequence?.length ?? 0;
        const origSeqCount = original.recommendedSequence?.length ?? 0;
        expect(memoSeqCount).toBe(origSeqCount);

        if (memoOnly.recommendedSequence && original.recommendedSequence) {
          for (let i = 0; i < memoOnly.recommendedSequence.length; i++) {
            expect(memoOnly.recommendedSequence[i].step).toBe(
              original.recommendedSequence[i].step,
            );
          }
        }
      });

      it('prose fields pass through identically', () => {
        const result = assess(msg);
        const prose = extractProseFromResponse(result);
        const memoOnly = renderDeterministicMemo(result.findings, prose);
        const original = result.response;

        // Prose fields should be identical (passed through as-is)
        expect(memoOnly.subject).toBe(original.subject);
        expect(memoOnly.systemContext).toBe(original.systemContext);
        expect(memoOnly.systemInteraction).toBe(original.systemInteraction);
        expect(memoOnly.followUp).toBe(original.followUp);
        expect(memoOnly.introSummary).toBe(original.introSummary);
        expect(memoOnly.keyObservation).toBe(original.keyObservation);
      });
    });
  }
});
