/**
 * Audio XX — Reviewer Readiness Report.
 *
 * Reads the Playwright reviewer-benchmark artifacts at
 * `apps/web/reviewer-benchmark/` and produces a launch-readiness
 * report. Post-processing only — does not invoke the engine, does not
 * re-run benchmarks. Run `npx playwright test src/tests/reviewer-
 * benchmark.spec.ts` first to refresh artifacts.
 *
 * Outputs:
 *   - apps/web/reviewer-benchmark/reviewer-readiness-report.md
 *   - apps/web/reviewer-benchmark/reviewer-readiness-report.json
 *
 * Adds checks beyond the Playwright runner's existing assertions:
 *   - Naming seams (lowercase model fragments after a brand-cap word)
 *   - Brand-only fallback where a model name was supplied in the prompt
 *   - Duplicate section headers within a single turn
 *   - Per-case EMERGENT BEHAVIOR presence/absence expectation
 *   - Artifact file existence (screenshots + parity)
 *
 * No engine changes. No narrative wording changes. Reporting only.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, 'reviewer-benchmark');
const SUMMARY_PATH = path.join(ARTIFACT_DIR, 'summary.json');
const REPORT_MD = path.join(ARTIFACT_DIR, 'reviewer-readiness-report.md');
const REPORT_JSON = path.join(ARTIFACT_DIR, 'reviewer-readiness-report.json');

// ── Per-case readiness expectations ──────────────────────
//
// What the report-layer expects each case to produce. Distinct from the
// Playwright marker assertions — these are launch-readiness rules, not
// engine-correctness rules.

interface CaseExpectation {
  /** EMERGENT BEHAVIOR section: should it render or not? */
  emergentBehavior: 'present' | 'absent';
  /**
   * Prompts where the user supplied a specific model. If the rendered
   * response shows the brand without ANY of these model fragments, the
   * case has a brand-only-fallback regression worth flagging.
   *
   * Each entry maps a brand name to one or more model fragments the
   * report should expect to find adjacent to that brand. Case-insensitive
   * substring match.
   */
  modelFragmentsByBrand: Record<string, string[]>;
}

const EXPECTATIONS: Record<string, CaseExpectation> = {
  'my-system': {
    emergentBehavior: 'present',
    modelFragmentsByBrand: {
      JOB: ['Integrated'],
      Chord: ['Hugo'],
      WLM: ['Diva'],
      Eversolo: ['DMP-A6'],
    },
  },
  'leben-devore': {
    emergentBehavior: 'present',
    modelFragmentsByBrand: {
      Denafrips: ['Pontus'],
      Leben: ['CS600X'],
      DeVore: ['O/96', 'Orangutan'],
    },
  },
  'modern-precision-control': {
    emergentBehavior: 'absent',
    modelFragmentsByBrand: {
      Topping: ['D90SE'],
      Hegel: ['H190'],
      KEF: ['LS50'],
    },
  },
};

// ── Types ────────────────────────────────────────────────

// Severity tiers:
//   fail → blocks readiness (NO-GO)
//   warn → conditional (CONDITIONAL GO)
//   pass → check succeeded
//   info → informational note that does NOT affect status. Used for
//          per-case findings that are expected configuration choices
//          rather than defects (e.g. parity baseline absent on a
//          demoSuitability:'no' regression-only case).
type Severity = 'pass' | 'info' | 'warn' | 'fail';
type Status = 'GO' | 'CONDITIONAL GO' | 'NO-GO';

type DemoSuitability = 'primary' | 'secondary' | 'no';

interface Finding {
  severity: Severity;
  category: string;
  detail: string;
}

interface CaseReport {
  id: string;
  systemName: string;
  status: Status;
  findings: Finding[];
  evidence: {
    screenshot: string;
    viewportScreenshot: string;
    parityArtifact: string | null;
    transcript: string;
  };
}

interface OverallReport {
  generatedAt: string;
  overallStatus: Status;
  artifactRoot: string;
  cases: CaseReport[];
}

// ── Helpers ──────────────────────────────────────────────

function maxSeverity(findings: Finding[]): Severity {
  if (findings.some((f) => f.severity === 'fail')) return 'fail';
  if (findings.some((f) => f.severity === 'warn')) return 'warn';
  return 'pass';
  // `info` findings are intentionally excluded from status — they
  // appear in the report for visibility but do not block GO.
}

function severityToStatus(s: Severity): Status {
  if (s === 'fail') return 'NO-GO';
  if (s === 'warn') return 'CONDITIONAL GO';
  return 'GO';
}

function statusBadge(s: Status): string {
  if (s === 'GO') return '🟢 GO';
  if (s === 'CONDITIONAL GO') return '🟡 CONDITIONAL GO';
  return '🔴 NO-GO';
}

function severityIcon(s: Severity): string {
  if (s === 'pass') return '✓';
  if (s === 'info') return 'ℹ';
  if (s === 'warn') return '⚠';
  return '✗';
}

// ── Checks ───────────────────────────────────────────────

interface Turn {
  turn: number;
  prompt: string;
  responseText: string;
  headingsSeen: string[];
  expectedTermHits: Record<string, boolean>;
  forbiddenTermHits: Record<string, boolean>;
  screenshot: string;
  viewportScreenshot: string;
  consoleErrors: string[];
  pass: boolean;
  failReasons: string[];
}

interface Case {
  id: string;
  systemName: string;
  /**
   * Mirrors `BenchmarkCase.demoSuitability` in
   * `apps/web/src/tests/reviewer-benchmark-cases.ts`. Populated by the
   * Playwright runner into `summary.json`. Used here to scale parity
   * baseline severity: missing parity is a real warning for
   * outreach-suitable cases but only informational for regression-only
   * negative-control cases.
   */
  demoSuitability: DemoSuitability;
  turns: Turn[];
}

function checkMarkers(turn: Turn): Finding[] {
  const missing = Object.entries(turn.expectedTermHits)
    .filter(([, hit]) => !hit)
    .map(([term]) => term);
  if (missing.length === 0) {
    return [{ severity: 'pass', category: 'markers', detail: `all ${Object.keys(turn.expectedTermHits).length} expected markers present` }];
  }
  return [{ severity: 'fail', category: 'markers', detail: `missing: ${missing.map((m) => `"${m}"`).join(', ')}` }];
}

function checkForbidden(turn: Turn): Finding[] {
  const present = Object.entries(turn.forbiddenTermHits)
    .filter(([, hit]) => hit)
    .map(([term]) => term);
  if (present.length === 0) {
    return [{ severity: 'pass', category: 'forbidden', detail: `none of ${Object.keys(turn.forbiddenTermHits).length} forbidden markers present` }];
  }
  return [{ severity: 'fail', category: 'forbidden', detail: `present: ${present.map((m) => `"${m}"`).join(', ')}` }];
}

function checkEmergentExpectation(caseId: string, turn: Turn): Finding[] {
  const expected = EXPECTATIONS[caseId]?.emergentBehavior;
  if (!expected) return [];
  const seen = turn.headingsSeen.includes('EMERGENT BEHAVIOR');
  if (expected === 'present' && !seen) {
    return [{ severity: 'fail', category: 'emergent-behavior', detail: 'expected EMERGENT BEHAVIOR section is missing' }];
  }
  if (expected === 'absent' && seen) {
    return [{ severity: 'fail', category: 'emergent-behavior', detail: 'EMERGENT BEHAVIOR rendered on a non-synergy case' }];
  }
  return [{ severity: 'pass', category: 'emergent-behavior', detail: `EMERGENT BEHAVIOR ${expected} as expected` }];
}

function checkNamingSeams(caseId: string, turn: Turn): Finding[] {
  const findings: Finding[] = [];

  // Pattern: brand-cap word followed by a lowercase letter + digit token.
  // Catches "Hegel h190" / "WLM diva monitor" etc.
  // Tightened to a single lowercase-letter prefix on the model token, so
  // it doesn't match natural prose like "Hegel adds composure".
  const LOWERCASE_MODEL_RE = /\b([A-Z][A-Za-z]+)\s+([a-z]\d[\w-]*)\b/g;
  const seamHits = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = LOWERCASE_MODEL_RE.exec(turn.responseText)) !== null) {
    seamHits.add(`${m[1]} ${m[2]}`);
  }
  if (seamHits.size > 0) {
    findings.push({
      severity: 'fail',
      category: 'naming-seam',
      detail: `lowercase model token(s) after brand: ${[...seamHits].map((h) => `"${h}"`).join(', ')}`,
    });
  } else {
    findings.push({ severity: 'pass', category: 'naming-seam', detail: 'no lowercase-model-after-brand patterns detected' });
  }

  // Brand-only fallback: prompt supplied a model, response renders the
  // brand without any expected model fragment adjacent.
  const expectation = EXPECTATIONS[caseId];
  if (expectation) {
    const promptLower = turn.prompt.toLowerCase();
    const responseLower = turn.responseText.toLowerCase();
    const brandOnly: string[] = [];
    for (const [brand, fragments] of Object.entries(expectation.modelFragmentsByBrand)) {
      // Only flag if the prompt actually included one of the expected
      // model fragments (i.e. the user supplied a model).
      const userSuppliedModel = fragments.some((f) => promptLower.includes(f.toLowerCase()));
      if (!userSuppliedModel) continue;
      const brandPresent = responseLower.includes(brand.toLowerCase());
      const modelPresent = fragments.some((f) => responseLower.includes(f.toLowerCase()));
      if (brandPresent && !modelPresent) {
        brandOnly.push(`${brand} (expected ${fragments.map((f) => `"${f}"`).join(' or ')})`);
      }
    }
    if (brandOnly.length > 0) {
      findings.push({
        severity: 'fail',
        category: 'brand-only-fallback',
        detail: `brand rendered without expected model fragment: ${brandOnly.join('; ')}`,
      });
    } else {
      findings.push({ severity: 'pass', category: 'brand-only-fallback', detail: 'all brand-supplied models present in render' });
    }
  }

  return findings;
}

function checkDuplicateSections(turn: Turn): Finding[] {
  const target = ['SYSTEM READ', 'EMERGENT BEHAVIOR', 'SYSTEM LOGIC', 'DECISION'];
  const dupes: string[] = [];
  const upper = turn.responseText.toUpperCase();
  for (const h of target) {
    // Use word-boundary regex so a substring inside another sentence
    // doesn't false-positive.
    const re = new RegExp(`\\b${h.replace(/ /g, '\\s+')}\\b`, 'g');
    const matches = upper.match(re);
    if (matches && matches.length > 1) {
      dupes.push(`${h} (×${matches.length})`);
    }
  }
  if (dupes.length === 0) {
    return [{ severity: 'pass', category: 'duplicates', detail: 'no duplicated section headers' }];
  }
  return [{ severity: 'fail', category: 'duplicates', detail: `duplicated sections: ${dupes.join(', ')}` }];
}

function checkArtifacts(
  caseId: string,
  demoSuitability: DemoSuitability,
  turn: Turn,
): { findings: Finding[]; parityArtifact: string | null } {
  const findings: Finding[] = [];
  const caseDir = path.join(ARTIFACT_DIR, caseId);
  const fullPng = path.join(caseDir, 'turn-1.png');
  const viewportPng = path.join(caseDir, 'turn-1-viewport.png');
  const parityMd = path.join(caseDir, 'parity.md');

  if (fs.existsSync(fullPng)) {
    findings.push({ severity: 'pass', category: 'screenshot', detail: `full-page screenshot present (${path.relative(ROOT, fullPng)})` });
  } else {
    findings.push({ severity: 'fail', category: 'screenshot', detail: `missing full-page screenshot: ${path.relative(ROOT, fullPng)}` });
  }

  if (fs.existsSync(viewportPng)) {
    findings.push({ severity: 'pass', category: 'screenshot', detail: `viewport crop present (${path.relative(ROOT, viewportPng)})` });
  } else {
    findings.push({ severity: 'fail', category: 'screenshot', detail: `missing viewport crop: ${path.relative(ROOT, viewportPng)}` });
  }

  // Parity severity is scaled by demoSuitability:
  //   - primary / secondary → outreach cases. Missing baseline is a real
  //     CONDITIONAL signal (we can't compare against ChatGPT).
  //   - 'no' → regression-only (negative control). Baseline is not
  //     expected; missing is informational, not a defect.
  let parityArtifact: string | null = null;
  if (fs.existsSync(parityMd)) {
    parityArtifact = path.relative(ROOT, parityMd);
    findings.push({ severity: 'pass', category: 'parity', detail: `parity artifact present (${parityArtifact})` });
  } else if (demoSuitability === 'no') {
    findings.push({
      severity: 'info',
      category: 'parity',
      detail: `no parity.md — not required for regression-only cases (demoSuitability='no')`,
    });
  } else {
    findings.push({
      severity: 'warn',
      category: 'parity',
      detail: `no parity.md — ChatGPT baseline not configured for this demoSuitability='${demoSuitability}' case`,
    });
  }

  void turn;
  return { findings, parityArtifact };
}

function checkConsoleErrors(turn: Turn): Finding[] {
  if (turn.consoleErrors.length === 0) {
    return [{ severity: 'pass', category: 'console', detail: 'no console errors during capture' }];
  }
  return [{
    severity: 'warn',
    category: 'console',
    detail: `${turn.consoleErrors.length} console error(s) — first: ${turn.consoleErrors[0].slice(0, 160)}`,
  }];
}

// ── Main ─────────────────────────────────────────────────

function buildCaseReport(c: Case): CaseReport {
  // Assume single turn per benchmark case; extend if multi-turn becomes the norm.
  const turn = c.turns[0];
  const allFindings: Finding[] = [
    ...checkMarkers(turn),
    ...checkForbidden(turn),
    ...checkEmergentExpectation(c.id, turn),
    ...checkNamingSeams(c.id, turn),
    ...checkDuplicateSections(turn),
    ...checkConsoleErrors(turn),
  ];
  const { findings: artifactFindings, parityArtifact } = checkArtifacts(c.id, c.demoSuitability, turn);
  allFindings.push(...artifactFindings);

  const status = severityToStatus(maxSeverity(allFindings));
  return {
    id: c.id,
    systemName: c.systemName,
    status,
    findings: allFindings,
    evidence: {
      screenshot: path.relative(ROOT, turn.screenshot),
      viewportScreenshot: path.relative(ROOT, turn.viewportScreenshot),
      parityArtifact,
      transcript: path.relative(ROOT, path.join(ARTIFACT_DIR, c.id, 'transcript.json')),
    },
  };
}

function renderMarkdown(report: OverallReport): string {
  const lines: string[] = [];
  lines.push('# Audio XX — Reviewer Readiness Report');
  lines.push('');
  lines.push(`**Generated**: ${report.generatedAt}`);
  lines.push(`**Overall**: ${statusBadge(report.overallStatus)}`);
  lines.push(`**Artifact root**: \`${path.relative(ROOT, report.artifactRoot)}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Case | Status |');
  lines.push('|---|---|');
  for (const c of report.cases) {
    lines.push(`| \`${c.id}\` — ${c.systemName} | ${statusBadge(c.status)} |`);
  }
  lines.push('');
  for (const c of report.cases) {
    lines.push(`## \`${c.id}\` — ${c.systemName}`);
    lines.push('');
    lines.push(`**Status**: ${statusBadge(c.status)}`);
    lines.push('');
    lines.push('### Checks');
    lines.push('');
    for (const f of c.findings) {
      lines.push(`- ${severityIcon(f.severity)} **${f.category}** — ${f.detail}`);
    }
    lines.push('');
    lines.push('### Evidence');
    lines.push('');
    lines.push(`- Full-page screenshot: \`${c.evidence.screenshot}\``);
    lines.push(`- Viewport crop: \`${c.evidence.viewportScreenshot}\``);
    lines.push(`- Transcript: \`${c.evidence.transcript}\``);
    if (c.evidence.parityArtifact) {
      lines.push(`- Parity artifact: \`${c.evidence.parityArtifact}\``);
    } else {
      lines.push('- Parity artifact: _(none — baseline not configured)_');
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('_Re-run with:_ `npx tsx apps/web/scripts/reviewer-readiness-report.ts`');
  lines.push('_Refresh artifacts first with:_ `npx playwright test src/tests/reviewer-benchmark.spec.ts` (from `apps/web`)');
  lines.push('');
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(SUMMARY_PATH)) {
    // eslint-disable-next-line no-console
    console.error(`No benchmark summary at ${SUMMARY_PATH} — run the Playwright benchmark first.`);
    process.exit(1);
  }
  const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf-8')) as { cases: Case[] };

  // Filter to the three reviewer-readiness cases.
  const targetIds = Object.keys(EXPECTATIONS);
  const cases = summary.cases.filter((c) => targetIds.includes(c.id));
  if (cases.length === 0) {
    // eslint-disable-next-line no-console
    console.error('No target cases found in summary.json — expected one of:', targetIds.join(', '));
    process.exit(1);
  }

  const caseReports = cases.map(buildCaseReport);
  const worst = caseReports.reduce<Severity>((acc, c) => {
    const cs = c.status === 'NO-GO' ? 'fail' : c.status === 'CONDITIONAL GO' ? 'warn' : 'pass';
    if (cs === 'fail') return 'fail';
    if (cs === 'warn' && acc !== 'fail') return 'warn';
    return acc;
  }, 'pass');

  const report: OverallReport = {
    generatedAt: new Date().toISOString(),
    overallStatus: severityToStatus(worst),
    artifactRoot: ARTIFACT_DIR,
    cases: caseReports,
  };

  fs.writeFileSync(REPORT_MD, renderMarkdown(report));
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  // eslint-disable-next-line no-console
  console.log(`\nReport written:\n  ${path.relative(ROOT, REPORT_MD)}\n  ${path.relative(ROOT, REPORT_JSON)}\n`);
  // eslint-disable-next-line no-console
  console.log(`Overall: ${statusBadge(report.overallStatus)}\n`);
  for (const c of caseReports) {
    // eslint-disable-next-line no-console
    console.log(`  ${statusBadge(c.status)}  ${c.id}`);
  }
  // eslint-disable-next-line no-console
  console.log('');
  process.exit(worst === 'fail' ? 1 : 0);
}

main();
