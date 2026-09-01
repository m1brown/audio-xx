/**
 * Audio XXI — Automated regression workflow (Tier A: deterministic engine).
 *
 * Single-command capture + compare + report for the System Assessment engine.
 * For every fixture in src/qa/fixtures.ts it captures the rendered assessment,
 * recommendation, bottleneck, and upgrade paths straight from the engine,
 * writes them to a timestamped run folder, diffs them against the committed
 * baseline, and emits a concise report that lists ONLY meaningful changes.
 *
 * Usage (from repo root):
 *   npm run qa:regress              # capture + diff vs baseline + report
 *   npm run qa:regress -- --fail-on-change   # also exit 1 if anything changed (CI gate)
 *   npm run qa:baseline             # capture + (re)write the baseline (after an intended change)
 *
 * Artifacts: apps/web/qa-regression/{baseline,runs}/ — see the README there.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import * as fixturesNs from '../src/qa/fixtures.ts';
import * as captureNs from '../src/qa/capture.ts';
import * as diffNs from '../src/qa/diff.ts';
import type { CapturedSnapshot } from '../src/qa/capture.ts';
import type { FixtureDiff, RegressionReport } from '../src/qa/diff.ts';

// tsx transpiles these TS modules to CJS; unwrap the default interop so named
// bindings resolve under Node ESM regardless of interop mode.
const { QA_FIXTURES } = ((fixturesNs as any).default ?? fixturesNs) as typeof import('../src/qa/fixtures.ts');
const { captureFixture } = ((captureNs as any).default ?? captureNs) as typeof import('../src/qa/capture.ts');
const { buildReport } = ((diffNs as any).default ?? diffNs) as typeof import('../src/qa/diff.ts');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QA_ROOT = path.resolve(__dirname, '../qa-regression');
const BASELINE_DIR = path.join(QA_ROOT, 'baseline', 'engine');
const RUNS_DIR = path.join(QA_ROOT, 'runs');

const args = new Set(process.argv.slice(2));
const UPDATE_BASELINE = args.has('--update-baseline');
const FAIL_ON_CHANGE = args.has('--fail-on-change');

function ensureDir(p: string) { fs.mkdirSync(p, { recursive: true }); }
function tsStamp(): string {
  // 2026-06-25T12-30-05 (filesystem-safe, sortable).
  return new Date().toISOString().replace(/:/g, '-').replace(/\..+$/, '');
}
function writeJson(p: string, v: unknown) { fs.writeFileSync(p, JSON.stringify(v, null, 2)); }

function loadBaselines(): Map<string, CapturedSnapshot> {
  const map = new Map<string, CapturedSnapshot>();
  if (!fs.existsSync(BASELINE_DIR)) return map;
  for (const file of fs.readdirSync(BASELINE_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const snap = JSON.parse(fs.readFileSync(path.join(BASELINE_DIR, file), 'utf8')) as CapturedSnapshot;
      map.set(snap.id, snap);
    } catch { /* skip corrupt baseline file */ }
  }
  return map;
}

// ── Capture every fixture ────────────────────────────────────────────────
console.log(`\nAudio XXI regression — capturing ${QA_FIXTURES.length} fixtures (engine tier)…`);
const snapshots: CapturedSnapshot[] = QA_FIXTURES.map((fx) => {
  const snap = captureFixture(fx);
  const flag = snap.resolved ? 'ok ' : 'UNRESOLVED';
  console.log(`  [${flag}] ${snap.id}`);
  return snap;
});

// ── Update-baseline mode: overwrite the committed baseline and exit ───────
if (UPDATE_BASELINE) {
  ensureDir(BASELINE_DIR);
  for (const f of fs.readdirSync(BASELINE_DIR)) {
    if (f.endsWith('.json')) fs.rmSync(path.join(BASELINE_DIR, f));
  }
  for (const snap of snapshots) writeJson(path.join(BASELINE_DIR, `${snap.id}.json`), snap);
  console.log(`\nBaseline updated: ${snapshots.length} snapshots → ${path.relative(process.cwd(), BASELINE_DIR)}`);
  console.log('Commit the baseline/ folder so future runs diff against it.\n');
  process.exit(0);
}

// ── Diff vs baseline ─────────────────────────────────────────────────────
const baselines = loadBaselines();
const stamp = tsStamp();
const runDir = path.join(RUNS_DIR, stamp);
const runEngineDir = path.join(runDir, 'engine');
ensureDir(runEngineDir);
for (const snap of snapshots) writeJson(path.join(runEngineDir, `${snap.id}.json`), snap);

if (baselines.size === 0) {
  console.log('\nNo baseline found. Capturing this run as the initial baseline.');
  ensureDir(BASELINE_DIR);
  for (const snap of snapshots) writeJson(path.join(BASELINE_DIR, `${snap.id}.json`), snap);
  console.log(`Baseline seeded with ${snapshots.length} snapshots. Re-run after an engine change to see diffs.\n`);
  process.exit(0);
}

const report = buildReport(baselines, snapshots);
writeJson(path.join(runDir, 'report.json'), report);
const md = renderMarkdown(report, stamp);
fs.writeFileSync(path.join(runDir, 'report.md'), md);

// ── Console summary ──────────────────────────────────────────────────────
const totalMeaningful =
  report.changed.length + report.new.length + report.removed.length + report.resolution.length;
console.log('\n' + '─'.repeat(60));
console.log(`Regression report — ${stamp}`);
console.log(`  fixtures: ${report.totalFixtures}  ·  unchanged: ${report.unchanged}`);
console.log(`  changed: ${report.changed.length}  ·  new: ${report.new.length}  ·  removed: ${report.removed.length}  ·  resolution flips: ${report.resolution.length}`);
if (totalMeaningful === 0) {
  console.log('  ✅ No meaningful differences from baseline.');
} else {
  for (const d of report.changed) {
    console.log(`  ~ ${d.id}: ${[...new Set(d.diffs.map((x) => x.category))].join(', ')}`);
  }
  for (const d of report.resolution) console.log(`  ! ${d.id}: ${d.resolutionNote}`);
  for (const d of report.new) console.log(`  + ${d.id} (new fixture)`);
  for (const d of report.removed) console.log(`  - ${d.id} (removed from suite)`);
}
console.log(`\nReport: ${path.relative(process.cwd(), path.join(runDir, 'report.md'))}`);
console.log('─'.repeat(60) + '\n');

if (FAIL_ON_CHANGE && totalMeaningful > 0) process.exit(1);
process.exit(0);

// ── Markdown rendering ───────────────────────────────────────────────────
function short(v: unknown, n = 220): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (s == null) return '∅';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function renderPaths(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return '_(none)_';
  return v
    .map((p: any) => `    - [${p.impact}] **${p.label}** — _${short(p.strategyLabel, 60)}_ — ${short(p.rationale, 200)}`)
    .join('\n');
}

function renderFieldDiff(field: string, before: unknown, after: unknown): string {
  if (field === 'upgradePaths') {
    return `  - **upgradePaths**\n    BEFORE:\n${renderPaths(before)}\n    AFTER:\n${renderPaths(after)}`;
  }
  if (field === 'bottleneck') {
    return `  - **bottleneck**: ${short(before, 120)} → ${short(after, 120)}`;
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    return `  - **${field}**\n    BEFORE: ${short(before, 400)}\n    AFTER:  ${short(after, 400)}`;
  }
  return `  - **${field}**: ${short(before)} → ${short(after)}`;
}

function renderFixture(d: FixtureDiff): string {
  const lines: string[] = [`### ${d.id} — ${d.label}`];
  const byCat = new Map<string, typeof d.diffs>();
  for (const fd of d.diffs) {
    if (!byCat.has(fd.category)) byCat.set(fd.category, []);
    byCat.get(fd.category)!.push(fd);
  }
  for (const [cat, fds] of byCat) {
    lines.push(`\n**${cat}**`);
    for (const fd of fds) lines.push(renderFieldDiff(fd.field, fd.before, fd.after));
  }
  return lines.join('\n');
}

function renderMarkdown(rep: RegressionReport, when: string): string {
  const total = rep.changed.length + rep.new.length + rep.removed.length + rep.resolution.length;
  const out: string[] = [];
  out.push(`# Audio XXI — Engine Regression Report`);
  out.push(`\n**Run:** ${when}  ·  **Fixtures:** ${rep.totalFixtures}  ·  **Unchanged:** ${rep.unchanged}`);
  out.push(
    `\n**Meaningful changes:** ${total}  `
    + `(changed ${rep.changed.length} · new ${rep.new.length} · removed ${rep.removed.length} · resolution flips ${rep.resolution.length})`,
  );
  if (total === 0) {
    out.push(`\n✅ **No meaningful differences from baseline.** Nothing to review.\n`);
    return out.join('\n');
  }

  if (rep.resolution.length) {
    out.push(`\n## ⚠️ Resolution flips (a system stopped or started resolving)`);
    for (const d of rep.resolution) out.push(`- **${d.id}** — ${d.label}: ${d.resolutionNote}`);
  }
  // Group changed fixtures by the categories they touch so the reviewer can
  // scan "what kind of thing moved" first.
  const buckets: Record<string, FixtureDiff[]> = {
    bottleneck: [], upgradePaths: [], recommendation: [], assessment: [],
  };
  for (const d of rep.changed) {
    const cats = new Set(d.diffs.map((x) => x.category));
    for (const c of Object.keys(buckets)) if (cats.has(c as any)) buckets[c].push(d);
  }
  out.push(`\n## Changed fixtures by category`);
  out.push(
    `| category | fixtures |\n|---|---|\n`
    + `| changed bottlenecks | ${buckets.bottleneck.map((d) => d.id).join(', ') || '—'} |\n`
    + `| changed upgrade paths | ${buckets.upgradePaths.map((d) => d.id).join(', ') || '—'} |\n`
    + `| changed recommendations | ${buckets.recommendation.map((d) => d.id).join(', ') || '—'} |\n`
    + `| changed assessments | ${buckets.assessment.map((d) => d.id).join(', ') || '—'} |`,
  );

  out.push(`\n## Details`);
  for (const d of rep.changed) out.push('\n' + renderFixture(d));

  if (rep.new.length) {
    out.push(`\n## New fixtures (no baseline yet — run \`npm run qa:baseline\` to adopt)`);
    for (const d of rep.new) out.push(`- **${d.id}** — ${d.label}`);
  }
  if (rep.removed.length) {
    out.push(`\n## Removed fixtures (in baseline, no longer in suite)`);
    for (const d of rep.removed) out.push(`- **${d.id}** — ${d.label}`);
  }
  out.push('');
  return out.join('\n');
}
