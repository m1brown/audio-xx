/**
 * Audio XX — Reviewer Benchmark · Phase C parity generator.
 *
 * Reads the manually curated ChatGPT baseline file for each benchmark case
 * that carries `chatgptBaselinePath`, reads the most recent Audio XX
 * transcript captured by the Playwright runner, and writes a single
 * side-by-side Markdown artifact at
 *   apps/web/reviewer-benchmark/<case-id>/parity.md
 *
 * The artifact has FOUR sections:
 *   1. Header / metadata
 *   2. Audio XX response (verbatim from transcript.json)
 *   3. ChatGPT baseline response (verbatim from baseline.md body)
 *   4. Qualitative observations + calibration backlog (curator template)
 *
 * No scoring, no LLM judging. Reviewer-readable side-by-side prose only.
 *
 * Run:
 *   cd apps/web
 *   npx tsx scripts/generate-parity.ts            # all cases with a baseline
 *   npx tsx scripts/generate-parity.ts my-system  # one case
 *
 * Boundaries (Phase C foundation):
 *   - benchmark / fixture / harness layer only
 *   - no engine changes
 *   - no narrative-composer changes
 *   - no MemoFindings changes
 *   - no scoring engine
 *   - baseline files are version-controlled markdown; the generator never
 *     writes to them. It only writes to the (gitignored) reviewer-benchmark
 *     artifact directory.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  BENCHMARK_CASES,
  type BenchmarkCase,
} from '../src/tests/reviewer-benchmark-cases';

// ── Paths ──────────────────────────────────────────────────────────

/** Resolved against this file's location so the script works from any cwd. */
const APPS_WEB_ROOT = path.resolve(__dirname, '..');
const BASELINE_DIR = path.join(
  APPS_WEB_ROOT,
  'src',
  'tests',
  'fixtures',
  'chatgpt-baselines',
);
const ARTIFACT_ROOT = path.join(APPS_WEB_ROOT, 'reviewer-benchmark');

// ── Baseline parsing ──────────────────────────────────────────────

export interface ParsedBaseline {
  frontMatter: Record<string, string>;
  body: string;
  /** True when the front-matter `status` field is exactly `curated`. */
  isCurated: boolean;
}

/**
 * Parses a baseline.md file. Accepts a minimal YAML-ish front matter — only
 * top-level key/value pairs, plus a `notes: |` block-literal for the curator
 * note. Anything more complex stays in the body (the generator doesn't
 * care). Returns front-matter as a string map and the verbatim body.
 *
 * Exported for unit tests.
 */
export function parseBaseline(text: string): ParsedBaseline {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') {
    // No front matter — treat whole file as body, mark uncurated.
    return { frontMatter: {}, body: text.trim(), isCurated: false };
  }
  let i = 1;
  const frontMatter: Record<string, string> = {};
  let collectingBlock: string | null = null;
  let blockLines: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '---') {
      i += 1;
      break;
    }
    if (collectingBlock) {
      // Block-literal continuation: any line indented 2+ spaces is part of
      // the block; the first non-indented line ends it (and is processed
      // normally in the next iteration).
      if (/^ {2,}/.test(line) || line.trim() === '') {
        blockLines.push(line.replace(/^ {2}/, ''));
        i += 1;
        continue;
      }
      frontMatter[collectingBlock] = blockLines.join('\n').trim();
      collectingBlock = null;
      blockLines = [];
      // fall through — re-process this line
    }
    const kvMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2];
      if (value.trim() === '|') {
        collectingBlock = key;
        blockLines = [];
      } else {
        // Strip surrounding quotes if present.
        const trimmed = value.trim();
        const dequoted = trimmed.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
        frontMatter[key] = dequoted;
      }
    }
    i += 1;
  }
  if (collectingBlock) {
    frontMatter[collectingBlock] = blockLines.join('\n').trim();
  }
  const body = lines.slice(i).join('\n').trim();
  const isCurated = (frontMatter.status ?? '').trim().toLowerCase() === 'curated';
  return { frontMatter, body, isCurated };
}

// ── Transcript reading ────────────────────────────────────────────

export interface TranscriptTurn {
  prompt: string;
  responseText: string;
}

/**
 * Reads the most recent transcript.json from
 *   apps/web/reviewer-benchmark/<case-id>/transcript.json
 * and returns the first turn's evidence. Returns null when the transcript
 * doesn't exist yet (the Playwright runner has never been executed for
 * this case).
 */
export function readTranscriptTurn(caseId: string, root: string = ARTIFACT_ROOT): TranscriptTurn | null {
  const p = path.join(root, caseId, 'transcript.json');
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as { turns?: Array<{ prompt?: string; responseText?: string }> };
    const t = parsed.turns?.[0];
    if (!t?.responseText) return null;
    return { prompt: t.prompt ?? '', responseText: t.responseText };
  } catch {
    return null;
  }
}

// ── Parity render ────────────────────────────────────────────────

/**
 * Compose the parity.md markdown body. Pure function — takes everything by
 * parameter, returns the string. Exported so tests can exercise it without
 * any filesystem dependency.
 *
 * The "Qualitative observations" section is intentionally template-shaped.
 * It carries four headed sub-blocks the curator fills in over time:
 *   - Emotional interpretation
 *   - Experiential language
 *   - Coherence framing
 *   - Acknowledgment of intentional system curation
 * plus a calibration backlog with checkbox bullets.
 *
 * The first bullet of each sub-block is pre-seeded with a leading prompt
 * to help the curator know what to look for; the reviewer is expected to
 * replace those prompts with concrete observations.
 */
export interface RenderParityInput {
  benchmarkCase: BenchmarkCase;
  baseline: ParsedBaseline;
  baselineRelativePath: string;
  transcript: TranscriptTurn | null;
  /** ISO timestamp; injected so tests are deterministic. */
  generatedAt: string;
}

export function renderParity(input: RenderParityInput): string {
  const { benchmarkCase: c, baseline, baselineRelativePath, transcript, generatedAt } = input;
  const lines: string[] = [];

  // ── Header ──
  lines.push(`# Parity comparison — ${c.id}`);
  lines.push('');
  lines.push(`**System:** ${c.systemName}`);
  lines.push(`**Chain:** ${c.chain.map((ent) => `${ent.brand} ${ent.name}`.trim()).join(' → ')}`);
  lines.push(`**Prompt:** ${c.prompts.primary}`);
  lines.push('');
  lines.push(`**Audio XX response source:** \`apps/web/reviewer-benchmark/${c.id}/transcript.json\` ` +
    `(deployed Playwright capture).`);
  lines.push(`**ChatGPT baseline:** \`apps/web/src/tests/fixtures/chatgpt-baselines/${baselineRelativePath}\` ` +
    `(${baseline.isCurated ? 'CURATED' : 'PLACEHOLDER — see status field; replace before relying on observations'}).`);
  if (baseline.frontMatter.captured_at) {
    lines.push(`**Baseline captured:** ${baseline.frontMatter.captured_at}`);
  }
  if (baseline.frontMatter.chatgpt_version) {
    lines.push(`**Baseline model:** ${baseline.frontMatter.chatgpt_version}`);
  }
  lines.push(`**Parity generated:** ${generatedAt}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Audio XX ──
  lines.push('## Audio XX response (deployed)');
  lines.push('');
  if (transcript) {
    lines.push('```');
    lines.push(transcript.responseText.trim());
    lines.push('```');
  } else {
    lines.push('_No transcript on disk yet. Run the Playwright benchmark for this case first:_');
    lines.push('');
    lines.push('```');
    lines.push(`cd apps/web`);
    lines.push(`npx playwright test src/tests/reviewer-benchmark.spec.ts -g '${c.id}'`);
    lines.push('```');
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── ChatGPT ──
  lines.push('## ChatGPT baseline response');
  lines.push('');
  if (!baseline.isCurated) {
    lines.push('> **PLACEHOLDER** — the baseline file currently has `status: placeholder`.');
    lines.push('> The body below is structural example prose only, not a real ChatGPT capture.');
    lines.push('> Paste a verbatim ChatGPT response into the baseline file and flip `status` to `curated`.');
    lines.push('');
  }
  lines.push('```');
  lines.push(baseline.body.trim());
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Qualitative observations (curator template) ──
  lines.push('## Qualitative observations');
  lines.push('');
  lines.push(
    'Four interpretive axes the user-facing brief calls out as the calibration ' +
    'target. Curator fills in concrete observations from reading both narratives ' +
    'above. The first line in each section is a guiding prompt; replace it with ' +
    'a real read.',
  );
  lines.push('');

  const axes: Array<{ heading: string; prompt: string }> = [
    {
      heading: 'Emotional interpretation',
      prompt:
        'Does Audio XX name how the system feels to live with? Does it acknowledge ' +
        'rhythmic involvement, fatigue resistance, listening engagement? Does ChatGPT?',
    },
    {
      heading: 'Experiential language',
      prompt:
        'Does Audio XX describe what the listener will HEAR — body, weight, dynamic ' +
        'ease — or only what the system measures or is structured to do? Where does ' +
        'ChatGPT use experiential vocabulary that Audio XX flattens to structural ' +
        'vocabulary?',
    },
    {
      heading: 'Coherence framing',
      prompt:
        'Does Audio XX recognise this chain as an intentional whole rather than ' +
        'three independent components? Does ChatGPT emphasise that more explicitly ' +
        '("celebrated pairing", "designed for", "voiced together")?',
    },
    {
      heading: 'Acknowledgment of intentional system curation',
      prompt:
        'Does Audio XX read the chain as the result of deliberate listener taste? ' +
        'Does it avoid suggesting changes the listener has already implicitly ' +
        'rejected? Does ChatGPT make the curation visible — e.g. "you have built ' +
        'a chain that..."?',
    },
  ];

  for (const ax of axes) {
    lines.push(`### ${ax.heading}`);
    lines.push('');
    lines.push(`- _${ax.prompt}_`);
    lines.push('- Audio XX:');
    lines.push('- ChatGPT:');
    lines.push('- Gap / calibration direction:');
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ── Calibration backlog ──
  lines.push('## Calibration backlog');
  lines.push('');
  lines.push(
    'Small, gated, narrow follow-up items that came out of this comparison. ' +
    'Format: action verb + smallest safe scope + which gate it should fire under. ' +
    'These feed Phase 2.6+ polish work — not a free-form rewrite plan.',
  );
  lines.push('');
  lines.push('- [ ] _(curator to fill in)_');
  lines.push('');

  return lines.join('\n');
}

// ── Top-level generator ───────────────────────────────────────────

export interface GenerateOptions {
  /** When set, only this case-id is generated. Otherwise: all eligible cases. */
  caseId?: string;
  /** Override the artifact root (used by tests). */
  artifactRoot?: string;
  /** Override the baseline directory (used by tests). */
  baselineDir?: string;
  /** Inject a deterministic timestamp for snapshot stability in tests. */
  generatedAt?: string;
}

export interface GenerateResult {
  caseId: string;
  status: 'written' | 'missing-baseline' | 'no-baseline-path';
  parityPath?: string;
  baselineCurated?: boolean;
  transcriptAvailable?: boolean;
}

export function generateAll(opts: GenerateOptions = {}): GenerateResult[] {
  const artifactRoot = opts.artifactRoot ?? ARTIFACT_ROOT;
  const baselineDir = opts.baselineDir ?? BASELINE_DIR;
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const results: GenerateResult[] = [];
  const cases = opts.caseId
    ? BENCHMARK_CASES.filter((c) => c.id === opts.caseId)
    : BENCHMARK_CASES;
  for (const c of cases) {
    if (!c.chatgptBaselinePath) {
      results.push({ caseId: c.id, status: 'no-baseline-path' });
      continue;
    }
    const baselinePath = path.join(baselineDir, c.chatgptBaselinePath);
    if (!fs.existsSync(baselinePath)) {
      results.push({ caseId: c.id, status: 'missing-baseline' });
      continue;
    }
    const baselineText = fs.readFileSync(baselinePath, 'utf-8');
    const baseline = parseBaseline(baselineText);
    const transcript = readTranscriptTurn(c.id, artifactRoot);
    const markdown = renderParity({
      benchmarkCase: c,
      baseline,
      baselineRelativePath: c.chatgptBaselinePath,
      transcript,
      generatedAt,
    });
    const caseDir = path.join(artifactRoot, c.id);
    if (!fs.existsSync(caseDir)) fs.mkdirSync(caseDir, { recursive: true });
    const parityPath = path.join(caseDir, 'parity.md');
    fs.writeFileSync(parityPath, markdown);
    results.push({
      caseId: c.id,
      status: 'written',
      parityPath,
      baselineCurated: baseline.isCurated,
      transcriptAvailable: !!transcript,
    });
  }
  return results;
}

// ── CLI entry ─────────────────────────────────────────────────────

// Only run when invoked directly via tsx / node, not when imported.
if (require.main === module) {
  const caseId = process.argv[2];
  const results = generateAll(caseId ? { caseId } : {});
  for (const r of results) {
    if (r.status === 'written') {
      const cur = r.baselineCurated ? 'curated' : 'placeholder';
      const tx = r.transcriptAvailable ? 'transcript ok' : 'no transcript';
      console.log(`  ✓ ${r.caseId}: parity.md (${cur}, ${tx}) → ${r.parityPath}`);
    } else if (r.status === 'missing-baseline') {
      console.log(`  ✗ ${r.caseId}: baseline file not found`);
    } else {
      console.log(`  · ${r.caseId}: no baseline configured (skipped)`);
    }
  }
}
