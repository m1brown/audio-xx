/**
 * Feature 10 — Demo QA Audit
 *
 * Exercises 5 core demo prompts through the deterministic pipeline
 * and captures output quality signals for review.
 *
 * All prompts use CATALOGUED products only.
 */

import { detectIntent } from '../intent';
import { buildSystemAssessment, type SystemAssessmentResult } from '../consultation';

// ── Helpers ──────────────────────────────────────────

function assess(message: string): Extract<SystemAssessmentResult, { kind: 'assessment' }> | null {
  const { subjectMatches, desires } = detectIntent(message);
  const result = buildSystemAssessment(message, subjectMatches, null, desires);
  if (!result || result.kind !== 'assessment') return null;
  return result;
}

// ══════════════════════════════════════════════════════
// Demo 1 — Full system assessment (3 catalogued components)
// Denafrips Pontus II (DAC) + Leben CS300 (Amp) + Harbeth Super HL5 Plus (Speaker)
// ══════════════════════════════════════════════════════

describe('Demo 1: Denafrips Pontus II + Leben CS300 + Harbeth Super HL5 Plus', () => {
  const msg = 'I have a Denafrips Pontus II, a Leben CS300, and Harbeth Super HL5 Plus speakers. Assess my system.';
  const result = assess(msg);

  test('produces an assessment (not clarification)', () => {
    expect(result).not.toBeNull();
    expect(result!.findings.componentNames.length).toBeGreaterThanOrEqual(3);
  });

  if (!result) return;
  const { response: r, findings: f } = result;

  test('identifies system axes', () => {
    expect(f.systemAxes).toBeDefined();
    expect(f.systemAxes.warm_bright).toBeDefined();
  });

  test('engine produces coherent output (paths or restraint)', () => {
    // Well-matched system may produce 0 paths (restraint) — that's correct
    if (f.upgradePaths.length > 0) {
      for (const p of f.upgradePaths) {
        expect(p.strategyLabel).toBeDefined();
      }
    } else {
      // All kept = restraint signal
      expect(f.keeps.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('produces keep recommendations', () => {
    expect(f.keeps.length).toBeGreaterThanOrEqual(1);
  });

  test('system signature populated', () => {
    expect(r.systemSignature).toBeDefined();
    expect(r.systemSignature!.length).toBeGreaterThan(10);
  });

  test('rendered rationale is Feature-8-compliant (no template prefix)', () => {
    for (const p of r.upgradePaths ?? []) {
      expect(p.rationale).not.toMatch(/^A \w+ change/);
      expect(p.rationale).not.toContain('Preserve:');
    }
  });

  test('no duplicate caution language', () => {
    for (const p of r.upgradePaths ?? []) {
      const cautionMatches = p.rationale.match(/consider whether|trade-offs may outweigh|change is optional/gi);
      expect((cautionMatches ?? []).length).toBeLessThanOrEqual(1);
    }
  });

  test('explanation layer populated when paths exist', () => {
    if ((r.upgradePaths ?? []).length > 0) {
      const withExplanation = (r.upgradePaths ?? []).filter((p) => p.explanation && p.explanation.length > 0);
      expect(withExplanation.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('output snapshot', () => {
    console.log('[Demo 1] Components:', f.componentNames);
    console.log('[Demo 1] System signature:', r.systemSignature);
    console.log('[Demo 1] Bottleneck:', f.bottleneck?.component ?? 'none');
    console.log('[Demo 1] Keep:', f.keeps.map((k) => k.name));
    console.log('[Demo 1] Stacked traits:', f.stackedTraits.map((s) => `${s.property} (${s.classification})`));
    for (const p of r.upgradePaths ?? []) {
      console.log(`[Demo 1] Path ${p.rank}: ${p.label}`);
      console.log(`  Impact: ${p.impact}`);
      console.log(`  Rationale: ${p.rationale}`);
      console.log(`  Explanation: ${(p.explanation ?? []).join(' | ')}`);
    }
  });
});

// ══════════════════════════════════════════════════════
// Demo 2 — Bright/fatiguing diagnosis (2 catalogued components)
// Klipsch Heresy IV (Speaker) + JOB 225 (Amp)
// ══════════════════════════════════════════════════════

describe('Demo 2: Klipsch Heresy IV + JOB 225 — bright system', () => {
  const msg = 'I have Klipsch Heresy IV speakers and a JOB 225 amplifier. My system sounds bright and fatiguing.';
  const result = assess(msg);

  if (!result) {
    test('assessment may not fire for 2-component diagnosis', () => {
      // This is expected — diagnosis routing may take over
      const intent = detectIntent(msg);
      console.log('[Demo 2] Intent subjects:', intent.subjectMatches.map((s) => s.name));
      console.log('[Demo 2] Intent desires:', intent.desires.map((d) => d.signal));
      expect(intent.subjectMatches.length).toBeGreaterThanOrEqual(2);
    });
    return;
  }

  const { response: r, findings: f } = result;

  test('resolves both components', () => {
    expect(f.componentNames.length).toBeGreaterThanOrEqual(2);
  });

  test('system axes lean bright', () => {
    expect(['bright', 'detailed']).toContain(f.systemAxes.warm_bright);
  });

  test('output snapshot', () => {
    console.log('[Demo 2] Components:', f.componentNames);
    console.log('[Demo 2] System axes:', f.systemAxes);
    console.log('[Demo 2] Stacked traits:', f.stackedTraits.map((s) => `${s.property} (${s.classification})`));
    console.log('[Demo 2] Bottleneck:', f.bottleneck?.component ?? 'none');
  });
});

// ══════════════════════════════════════════════════════
// Demo 3 — 4-component system (integration test parity)
// Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva
// ══════════════════════════════════════════════════════

describe('Demo 3: Eversolo → Chord Hugo → JOB Integrated → WLM Diva', () => {
  const msg = 'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?';
  const result = assess(msg);

  test('produces an assessment', () => {
    expect(result).not.toBeNull();
  });

  if (!result) return;
  const { response: r, findings: f } = result;

  test('identifies all 4 components', () => {
    expect(f.componentNames.length).toBeGreaterThanOrEqual(4);
  });

  test('upgrade paths have concise rationale (Feature 8)', () => {
    for (const p of r.upgradePaths ?? []) {
      // Count sentences: split on period+space or terminal period
      const sentences = p.rationale.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0);
      expect(sentences.length).toBeLessThanOrEqual(3);
    }
  });

  test('output snapshot', () => {
    console.log('[Demo 3] Components:', f.componentNames);
    console.log('[Demo 3] System signature:', r.systemSignature);
    console.log('[Demo 3] Bottleneck:', f.bottleneck?.component ?? 'none');
    for (const p of r.upgradePaths ?? []) {
      console.log(`[Demo 3] Path ${p.rank}: ${p.label} — ${p.rationale}`);
    }
  });
});

// ══════════════════════════════════════════════════════
// Demo 4 — Restraint test (balanced system)
// Chord Qutest (DAC) + Hegel H190 (Amp) + DeVore O/96 (Speaker)
// ══════════════════════════════════════════════════════

describe('Demo 4: Chord Qutest + Hegel H190 + DeVore O/96 — restraint test', () => {
  const msg = 'My system: Chord Qutest → Hegel H190 → DeVore O/96. Should I upgrade anything?';
  const result = assess(msg);

  test('produces an assessment', () => {
    expect(result).not.toBeNull();
  });

  if (!result) return;
  const { response: r, findings: f } = result;

  test('resolves all 3 components', () => {
    expect(f.componentNames.length).toBe(3);
  });

  test('restraint: well-matched system keeps most components', () => {
    // Well-matched system = few or no upgrade paths, high keep count
    expect(f.keeps.length).toBeGreaterThanOrEqual(2);
  });

  test('output snapshot', () => {
    console.log('[Demo 4] Components:', f.componentNames);
    console.log('[Demo 4] System signature:', r.systemSignature);
    console.log('[Demo 4] Bottleneck:', f.bottleneck?.component ?? 'none');
    console.log('[Demo 4] Keep:', f.keeps.map((k) => k.name));
    for (const p of r.upgradePaths ?? []) {
      const cf = p.counterfactual;
      console.log(`[Demo 4] Path ${p.rank}: ${p.label}`);
      console.log(`  Rationale: ${p.rationale}`);
      console.log(`  CF: baseline=${cf?.baseline}, restraint=${cf?.restraintRecommended}`);
      console.log(`  Explanation: ${(p.explanation ?? []).join(' | ')}`);
    }
  });
});

// ══════════════════════════════════════════════════════
// Demo 5 — Warm coherent system
// Denafrips Pontus II (DAC) + PrimaLuna EVO 300 (Amp) + Harbeth P3ESR (Speaker)
// ══════════════════════════════════════════════════════

describe('Demo 5: Denafrips Pontus II + PrimaLuna EVO 300 + Harbeth P3ESR — warm system', () => {
  const msg = 'My system: Denafrips Pontus II, PrimaLuna EVO 300 Integrated, Harbeth P3ESR. How does my system balance look?';
  const result = assess(msg);

  test('produces an assessment', () => {
    expect(result).not.toBeNull();
  });

  if (!result) return;
  const { response: r, findings: f } = result;

  test('system axes lean warm', () => {
    expect(f.systemAxes.warm_bright).toBe('warm');
  });

  test('stacked traits detect warmth compounding', () => {
    const warmTraits = f.stackedTraits.filter((s) =>
      s.property.includes('warm') || s.property.includes('tonal') || s.property.includes('density'),
    );
    console.log('[Demo 5] Warm stacked traits:', warmTraits.map((s) => s.property));
    expect(warmTraits.length).toBeGreaterThanOrEqual(1);
  });

  test('output snapshot', () => {
    console.log('[Demo 5] Components:', f.componentNames);
    console.log('[Demo 5] System signature:', r.systemSignature);
    console.log('[Demo 5] System axes:', f.systemAxes);
    console.log('[Demo 5] Stacked traits:', f.stackedTraits.map((s) => `${s.property} (${s.classification})`));
    console.log('[Demo 5] Bottleneck:', f.bottleneck?.component ?? 'none');
    for (const p of r.upgradePaths ?? []) {
      console.log(`[Demo 5] Path ${p.rank}: ${p.label} — ${p.rationale}`);
      console.log(`  Explanation: ${(p.explanation ?? []).join(' | ')}`);
    }
  });
});
