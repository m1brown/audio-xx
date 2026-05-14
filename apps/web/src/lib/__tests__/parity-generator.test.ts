// @ts-nocheck — vitest globals injected via apps/web vitest config

/**
 * Phase C — ChatGPT parity generator tests.
 *
 * Covers the deterministic pieces of the generator:
 *   1. `parseBaseline` correctly extracts front matter + body and detects
 *      placeholder vs curated status.
 *   2. `renderParity` produces a markdown body with the expected sections,
 *      includes both prose blocks, and surfaces the placeholder warning
 *      when the baseline isn't curated.
 *   3. `generateAll` writes a parity.md file when the baseline exists and
 *      reports `missing-baseline` / `no-baseline-path` outcomes correctly.
 *   4. Manifest invariants — every case with `chatgptBaselinePath` set
 *      has a corresponding baseline file on disk.
 *
 * Pure adapter-layer tests. No engine, no narrative composer, no MemoFindings.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  parseBaseline,
  renderParity,
  generateAll,
  readTranscriptTurn,
  type TranscriptTurn,
} from '../../../scripts/generate-parity';
import {
  BENCHMARK_CASES,
  type BenchmarkCase,
} from '../../tests/reviewer-benchmark-cases';

// ── parseBaseline ──────────────────────────────────────────────────

describe('parseBaseline', () => {
  it('extracts top-level front-matter keys and body', () => {
    const text = [
      '---',
      'case_id: my-system',
      'captured_at: 2026-05-14',
      'status: curated',
      '---',
      '',
      'This is the body.',
      '',
      'Another paragraph.',
    ].join('\n');
    const r = parseBaseline(text);
    expect(r.frontMatter.case_id).toBe('my-system');
    expect(r.frontMatter.captured_at).toBe('2026-05-14');
    expect(r.isCurated).toBe(true);
    expect(r.body).toContain('This is the body.');
    expect(r.body).toContain('Another paragraph.');
  });

  it('strips surrounding quotes from front-matter values', () => {
    const text = [
      '---',
      'prompt_used: "Assess my system: A, B, C"',
      'status: placeholder',
      '---',
      '',
      'body',
    ].join('\n');
    const r = parseBaseline(text);
    expect(r.frontMatter.prompt_used).toBe('Assess my system: A, B, C');
  });

  it('handles a block-literal notes field', () => {
    const text = [
      '---',
      'case_id: x',
      'notes: |',
      '  First note line.',
      '  Second note line.',
      'status: placeholder',
      '---',
      '',
      'body',
    ].join('\n');
    const r = parseBaseline(text);
    expect(r.frontMatter.notes).toContain('First note line.');
    expect(r.frontMatter.notes).toContain('Second note line.');
    expect(r.frontMatter.status).toBe('placeholder');
    expect(r.isCurated).toBe(false);
  });

  it('treats missing front matter as body-only, uncurated', () => {
    const text = 'No front matter at all.\nJust body.';
    const r = parseBaseline(text);
    expect(r.frontMatter).toEqual({});
    expect(r.isCurated).toBe(false);
    expect(r.body).toContain('No front matter at all.');
  });
});

// ── renderParity ──────────────────────────────────────────────────

const SAMPLE_CASE: BenchmarkCase = {
  id: 'sample-case',
  systemName: 'Sample Test System',
  chain: [
    { brand: 'BrandA', name: 'DAC X', role: 'dac' },
    { brand: 'BrandB', name: 'Amp Y', role: 'integrated' },
    { brand: 'BrandC', name: 'Speaker Z', role: 'speaker' },
  ],
  intendedPhilosophy: 'Test philosophy.',
  whatBadAIGetsWrong: 'Test failure mode.',
  expertInterpretation: 'Test expert read.',
  prompts: { primary: 'Test prompt.', followups: [] },
  expectedMarkers: { mustContain: [], mustNotContain: [] },
  resolutionExpectation: 'assessment',
  tier: 'regression',
  demoSuitability: 'primary',
  chatgptBaselinePath: 'sample-case.md',
};

describe('renderParity', () => {
  const baseline = {
    frontMatter: {
      case_id: 'sample-case',
      captured_at: '2026-05-14',
      chatgpt_version: 'GPT-4o web',
      status: 'placeholder',
    },
    body: 'This is the ChatGPT baseline prose.',
    isCurated: false,
  };
  const transcript: TranscriptTurn = {
    prompt: 'Test prompt.',
    responseText: 'Audio XX deployed response.',
  };

  it('includes the case header, chain, and prompt', () => {
    const md = renderParity({
      benchmarkCase: SAMPLE_CASE,
      baseline,
      baselineRelativePath: 'sample-case.md',
      transcript,
      generatedAt: '2026-05-14T00:00:00Z',
    });
    expect(md).toContain('# Parity comparison — sample-case');
    expect(md).toContain('**System:** Sample Test System');
    expect(md).toContain('BrandA DAC X → BrandB Amp Y → BrandC Speaker Z');
    expect(md).toContain('**Prompt:** Test prompt.');
  });

  it('embeds the Audio XX response verbatim in a code block', () => {
    const md = renderParity({
      benchmarkCase: SAMPLE_CASE,
      baseline,
      baselineRelativePath: 'sample-case.md',
      transcript,
      generatedAt: '2026-05-14T00:00:00Z',
    });
    expect(md).toContain('## Audio XX response (deployed)');
    expect(md).toContain('Audio XX deployed response.');
  });

  it('shows the placeholder warning when the baseline is uncurated', () => {
    const md = renderParity({
      benchmarkCase: SAMPLE_CASE,
      baseline,
      baselineRelativePath: 'sample-case.md',
      transcript,
      generatedAt: '2026-05-14T00:00:00Z',
    });
    expect(md).toContain('**PLACEHOLDER**');
    expect(md).toContain('status: placeholder');
  });

  it('does NOT show the placeholder warning when curated', () => {
    const curatedBaseline = { ...baseline, isCurated: true, frontMatter: { ...baseline.frontMatter, status: 'curated' } };
    const md = renderParity({
      benchmarkCase: SAMPLE_CASE,
      baseline: curatedBaseline,
      baselineRelativePath: 'sample-case.md',
      transcript,
      generatedAt: '2026-05-14T00:00:00Z',
    });
    expect(md).not.toContain('**PLACEHOLDER**');
    expect(md).toContain('(CURATED)');
  });

  it('renders the four qualitative observation axes', () => {
    const md = renderParity({
      benchmarkCase: SAMPLE_CASE,
      baseline,
      baselineRelativePath: 'sample-case.md',
      transcript,
      generatedAt: '2026-05-14T00:00:00Z',
    });
    expect(md).toContain('### Emotional interpretation');
    expect(md).toContain('### Experiential language');
    expect(md).toContain('### Coherence framing');
    expect(md).toContain('### Acknowledgment of intentional system curation');
  });

  it('renders calibration backlog section', () => {
    const md = renderParity({
      benchmarkCase: SAMPLE_CASE,
      baseline,
      baselineRelativePath: 'sample-case.md',
      transcript,
      generatedAt: '2026-05-14T00:00:00Z',
    });
    expect(md).toContain('## Calibration backlog');
    expect(md).toMatch(/- \[ \]/);
  });

  it('handles missing transcript with a helpful inline hint', () => {
    const md = renderParity({
      benchmarkCase: SAMPLE_CASE,
      baseline,
      baselineRelativePath: 'sample-case.md',
      transcript: null,
      generatedAt: '2026-05-14T00:00:00Z',
    });
    expect(md).toContain('No transcript on disk yet');
    expect(md).toContain('npx playwright test');
    expect(md).toContain("-g 'sample-case'");
  });

  it('output is fully deterministic when `generatedAt` is fixed', () => {
    const a = renderParity({
      benchmarkCase: SAMPLE_CASE,
      baseline,
      baselineRelativePath: 'sample-case.md',
      transcript,
      generatedAt: '2026-05-14T00:00:00Z',
    });
    const b = renderParity({
      benchmarkCase: SAMPLE_CASE,
      baseline,
      baselineRelativePath: 'sample-case.md',
      transcript,
      generatedAt: '2026-05-14T00:00:00Z',
    });
    expect(a).toBe(b);
  });
});

// ── generateAll — file-level integration ──────────────────────────

describe('generateAll', () => {
  it('writes a parity.md file when the baseline exists', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-test-root-'));
    const tmpBaselineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-test-baselines-'));
    try {
      // Seed the baseline directory with the on-disk my-system fixture so
      // we exercise the real parser on production-shaped content.
      const realBaselinePath = path.resolve(
        __dirname,
        '../../tests/fixtures/chatgpt-baselines/my-system.md',
      );
      const seeded = fs.readFileSync(realBaselinePath, 'utf-8');
      fs.writeFileSync(path.join(tmpBaselineDir, 'my-system.md'), seeded);

      const results = generateAll({
        caseId: 'my-system',
        artifactRoot: tmpRoot,
        baselineDir: tmpBaselineDir,
        generatedAt: '2026-05-14T00:00:00Z',
      });
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('written');
      expect(results[0].parityPath).toBeTruthy();
      expect(fs.existsSync(results[0].parityPath!)).toBe(true);
      const written = fs.readFileSync(results[0].parityPath!, 'utf-8');
      expect(written).toContain('# Parity comparison — my-system');
      // No transcript was seeded — fallback hint should fire.
      expect(written).toContain('No transcript on disk yet');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
      fs.rmSync(tmpBaselineDir, { recursive: true, force: true });
    }
  });

  it('reports `missing-baseline` when the file is absent', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-test-root-'));
    const tmpBaselineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-test-baselines-'));
    try {
      const results = generateAll({
        caseId: 'leben-devore',
        artifactRoot: tmpRoot,
        baselineDir: tmpBaselineDir,
        generatedAt: '2026-05-14T00:00:00Z',
      });
      expect(results[0].status).toBe('missing-baseline');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
      fs.rmSync(tmpBaselineDir, { recursive: true, force: true });
    }
  });

  it('reports `no-baseline-path` for cases without chatgptBaselinePath', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-test-root-'));
    const tmpBaselineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-test-baselines-'));
    try {
      const results = generateAll({
        caseId: 'audio-note-coherent',
        artifactRoot: tmpRoot,
        baselineDir: tmpBaselineDir,
        generatedAt: '2026-05-14T00:00:00Z',
      });
      expect(results[0].status).toBe('no-baseline-path');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
      fs.rmSync(tmpBaselineDir, { recursive: true, force: true });
    }
  });
});

// ── Manifest invariants ──────────────────────────────────────────

describe('manifest invariants', () => {
  it('every case with chatgptBaselinePath has the baseline file on disk', () => {
    const baselineDir = path.resolve(
      __dirname,
      '../../tests/fixtures/chatgpt-baselines',
    );
    const wired = BENCHMARK_CASES.filter((c) => !!c.chatgptBaselinePath);
    expect(wired.length).toBeGreaterThan(0); // sanity: Phase C has wired ≥1 case
    for (const c of wired) {
      const baselinePath = path.join(baselineDir, c.chatgptBaselinePath!);
      expect(fs.existsSync(baselinePath), `baseline missing for ${c.id}: ${baselinePath}`).toBe(true);
    }
  });

  it('Phase C primary cases (my-system, leben-devore) both have baselines wired', () => {
    const my = BENCHMARK_CASES.find((c) => c.id === 'my-system');
    const lb = BENCHMARK_CASES.find((c) => c.id === 'leben-devore');
    expect(my?.chatgptBaselinePath).toBe('my-system.md');
    expect(lb?.chatgptBaselinePath).toBe('leben-devore.md');
  });
});
