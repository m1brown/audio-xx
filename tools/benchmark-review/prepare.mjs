#!/usr/bin/env node
/**
 * Benchmark Review — dataset preparation (disposable, local-only).
 *
 * Reads the 106-row benchmark, fills the two generation gaps, and emits
 * review-data.js for review.html:
 *
 *   1. The 42 knowledge-lane rows whose stored response is a harness
 *      placeholder get a real Audio XX response, generated with the
 *      knowledge lane's OWN system prompt — extracted verbatim from
 *      apps/web/src/lib/audio-lanes.ts at run time (source of truth,
 *      sha256-recorded), using the same model the production lane uses
 *      (default extracted from apps/web/src/app/api/memo-overlay/route.ts).
 *
 *   2. Every row gets an "OpenAI Baseline" response: the bare prompt,
 *      no system prompt, sent to the closest available proxy for the
 *      ChatGPT experience (preference order below; exact model recorded
 *      in metadata). Labelled OpenAI Baseline, not ChatGPT, because
 *      literal parity with chatgpt.com cannot be established.
 *
 * Reliability: every successful response is cached incrementally in
 * cache.json; an interrupted run resumes without repeating completed
 * calls. Completed responses are never overwritten unless --refresh.
 * Failed rows are recorded in metadata and surfaced in the review page.
 *
 * Usage:
 *   node tools/benchmark-review/prepare.mjs            # resume/generate
 *   node tools/benchmark-review/prepare.mjs --refresh  # regenerate all
 *
 * Requires OPENAI_API_KEY in the environment (or pass --env-file <path>
 * pointing at a dotenv-style file).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const BENCHMARK_PATH = 'audit-2026-07-14/launch-qa-100/responses.json';
const LANE_SOURCE = 'apps/web/src/lib/audio-lanes.ts';
const ROUTE_SOURCE = 'apps/web/src/app/api/memo-overlay/route.ts';
const CACHE_PATH = resolve(HERE, 'cache.json');
const OUT_PATH = resolve(HERE, 'review-data.js');

const REFRESH = process.argv.includes('--refresh');
const envFileIdx = process.argv.indexOf('--env-file');
if (envFileIdx !== -1 && process.argv[envFileIdx + 1]) {
  for (const line of readFileSync(process.argv[envFileIdx + 1], 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('OPENAI_API_KEY not set. Pass --env-file <path> or export it.');
  process.exit(1);
}

// ── Source-of-truth extraction ──────────────────────────────────────
const laneSource = readFileSync(resolve(REPO, LANE_SOURCE), 'utf8');
const promptMatch = laneSource.match(/const systemPrompt = `([\s\S]*?)`;\n\n  const userPrompt/);
if (!promptMatch) {
  console.error(`Could not extract knowledge-lane system prompt from ${LANE_SOURCE} — the source shape changed.`);
  process.exit(1);
}
const KNOWLEDGE_SYSTEM_PROMPT = promptMatch[1];
const promptSha = createHash('sha256').update(KNOWLEDGE_SYSTEM_PROMPT).digest('hex');

const routeSource = readFileSync(resolve(REPO, ROUTE_SOURCE), 'utf8');
const modelMatch = routeSource.match(/PROVIDER === 'openai' \? '([^']+)'/);
const AUDIOXX_MODEL = process.env.MEMO_LLM_MODEL ?? (modelMatch ? modelMatch[1] : 'gpt-4o-mini');

const COMMIT = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();

// ── Baseline model selection ────────────────────────────────────────
// chatgpt-4o-latest is OpenAI's published alias for the model serving
// chatgpt.com when available; otherwise fall down the list. Whatever is
// chosen, the column is labelled OpenAI Baseline.
const BASELINE_PREFERENCE = ['chatgpt-4o-latest', 'gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4o-mini'];

async function pickBaselineModel() {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`model list failed: ${res.status}`);
  const ids = new Set((await res.json()).data.map((m) => m.id));
  for (const pref of BASELINE_PREFERENCE) if (ids.has(pref)) return pref;
  throw new Error('No preferred baseline model available to this key.');
}

// ── OpenAI chat call with retries ───────────────────────────────────
async function chat(model, messages, { retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        // max_completion_tokens (not the legacy max_tokens) — required by
        // gpt-5-family models, accepted by gpt-4o-family. Generous cap
        // because reasoning models spend thinking tokens inside it.
        body: JSON.stringify({ model, messages, max_completion_tokens: 16000 }),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`retryable ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('empty completion');
      return content;
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

// The lane asks for JSON {explanation, keyPoints}; unwrap like the lane does.
function unwrapLaneResponse(raw) {
  try {
    const parsed = JSON.parse(raw.replace(/^```json?\n?|```$/g, ''));
    if (typeof parsed.explanation === 'string') {
      const points = Array.isArray(parsed.keyPoints) && parsed.keyPoints.length
        ? '\n\nKey points: ' + parsed.keyPoints.join(' · ')
        : '';
      return parsed.explanation + points;
    }
  } catch { /* raw prose */ }
  return raw;
}

// ── Main ────────────────────────────────────────────────────────────
const rows = JSON.parse(readFileSync(resolve(REPO, BENCHMARK_PATH), 'utf8'));
if (rows.length !== 106) {
  console.error(`Expected 106 benchmark rows, found ${rows.length} — refusing to continue.`);
  process.exit(1);
}

const cache = !REFRESH && existsSync(CACHE_PATH)
  ? JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
  : {};
const saveCache = () => writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1));

const isPlaceholder = (r) => /llm-lane/.test(r.routedPath);
const stats = { audioxxGenerated: 0, audioxxReused: 0, baselineGenerated: 0, baselineReused: 0, failed: [] };

const BASELINE_MODEL = await pickBaselineModel();
console.log(`[prepare] Audio XX model: ${AUDIOXX_MODEL} (from ${ROUTE_SOURCE})`);
console.log(`[prepare] Baseline model: ${BASELINE_MODEL} (labelled "OpenAI Baseline")`);
console.log(`[prepare] Lane prompt sha256: ${promptSha.slice(0, 16)}… (from ${LANE_SOURCE} @ ${COMMIT.slice(0, 7)})`);

let done = 0;
const CONCURRENCY = 4;
const queue = [...rows];
async function worker() {
  while (queue.length) {
    const row = queue.shift();
    cache[row.id] = cache[row.id] ?? {};
    const c = cache[row.id];

    // Audio XX side: only the placeholder rows need generation.
    if (isPlaceholder(row)) {
      if (c.audioxx) {
        stats.audioxxReused++;
      } else {
        try {
          const raw = await chat(AUDIOXX_MODEL, [
            { role: 'system', content: KNOWLEDGE_SYSTEM_PROMPT },
            { role: 'user', content: `Question: ${row.prompt}` },
          ]);
          c.audioxx = unwrapLaneResponse(raw);
          delete c.audioxxError;
          stats.audioxxGenerated++;
          saveCache();
        } catch (e) {
          c.audioxxError = String(e.message ?? e);
          stats.failed.push({ id: row.id, side: 'audioxx', error: c.audioxxError });
          saveCache();
        }
      }
    }

    // Baseline side: every row.
    if (c.baseline) {
      stats.baselineReused++;
    } else {
      try {
        c.baseline = await chat(BASELINE_MODEL, [{ role: 'user', content: row.prompt }]);
        delete c.baselineError;
        stats.baselineGenerated++;
        saveCache();
      } catch (e) {
        c.baselineError = String(e.message ?? e);
        stats.failed.push({ id: row.id, side: 'baseline', error: c.baselineError });
        saveCache();
      }
    }

    done++;
    if (done % 10 === 0 || queue.length === 0) console.log(`[prepare] ${done}/${rows.length} rows processed`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// ── Emit review-data.js ─────────────────────────────────────────────
const outRows = rows.map((r) => {
  const c = cache[r.id] ?? {};
  return {
    id: r.id,
    category: r.category,
    prompt: r.prompt,
    audioxx: isPlaceholder(r) ? (c.audioxx ?? null) : r.response,
    audioxxGenerated: isPlaceholder(r),
    audioxxError: c.audioxxError ?? null,
    baseline: c.baseline ?? null,
    baselineError: c.baselineError ?? null,
  };
});

const meta = {
  generatedAt: new Date().toISOString(),
  audioxxCommit: COMMIT,
  sourceBenchmark: BENCHMARK_PATH,
  audioxxModel: AUDIOXX_MODEL,
  audioxxModelSource: ROUTE_SOURCE,
  baselineModel: BASELINE_MODEL,
  baselineLabel: 'OpenAI Baseline',
  systemPrompt: { source: LANE_SOURCE, commit: COMMIT, sha256: promptSha },
  stats,
};

writeFileSync(OUT_PATH, `window.REVIEW_DATA = ${JSON.stringify({ meta, rows: outRows }, null, 1)};\n`);
console.log(`[prepare] wrote ${OUT_PATH}`);
console.log(`[prepare] generated: audioxx=${stats.audioxxGenerated} baseline=${stats.baselineGenerated} | reused: audioxx=${stats.audioxxReused} baseline=${stats.baselineReused} | failed: ${stats.failed.length}`);
if (stats.failed.length) console.log('[prepare] failures:', JSON.stringify(stats.failed));
