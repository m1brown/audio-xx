#!/usr/bin/env tsx
/**
 * Audio XX — Assessment Artifact PDF export (Milestone N+1).
 *
 *   npm run artifact:pdf -- --case=flawed
 *   npm run artifact:pdf -- --case=balanced
 *   npm run artifact:pdf -- --system="Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus"
 *   npm run artifact:pdf -- --case=flawed --date="27 June 2026" --out=./dist
 *
 * Drives the running dev server's /artifact?print=1 view through headless
 * Chromium (already installed via @playwright/test at the repo root) and
 * writes a deterministic PDF: same payload + same --date → byte-identical PDF.
 *
 * Narrow scope (per the milestone brief):
 *   • artifact only — no follow-up, no diagnostics, no app chrome
 *   • no new visual design — reuses the artifact's print stylesheet
 *   • no doctrine changes
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

interface Opts {
  caseKey?: 'flawed' | 'balanced';
  system?: string;
  date?: string;
  out: string;
  baseUrl: string;
}

function parseArgs(argv: string[]): Opts {
  const out: Opts = { out: './dist/artifact', baseUrl: 'http://localhost:3000' };
  for (const a of argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=');
    if (k === 'case') out.caseKey = v as 'flawed' | 'balanced';
    else if (k === 'system') out.system = v;
    else if (k === 'date') out.date = v;
    else if (k === 'out') out.out = v;
    else if (k === 'baseUrl') out.baseUrl = v;
  }
  if (!out.caseKey && !out.system) out.caseKey = 'flawed';
  return out;
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'system';
}

async function waitForServer(baseUrl: string, ms = 30_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(baseUrl + '/artifact?case=balanced&print=1', { method: 'HEAD' });
      if (r.ok || r.status === 200) return;
    } catch { /* still warming up */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server at ${baseUrl} did not respond within ${ms}ms.`);
}

async function main() {
  const opts = parseArgs(process.argv);
  const params = new URLSearchParams();
  if (opts.caseKey) params.set('case', opts.caseKey);
  if (opts.system) params.set('system', opts.system);
  if (opts.date) params.set('date', opts.date);
  params.set('print', '1');
  const url = `${opts.baseUrl}/artifact?${params.toString()}`;

  // Filename slug — descriptive + stable. System slug is dominant; date trails.
  const systemPart = opts.system
    ? slugify(opts.system)
    : (opts.caseKey ?? 'system');
  const datePart = opts.date ? '_' + slugify(opts.date) : '';
  const filename = `audio-xx_${systemPart}${datePart}.pdf`;
  mkdirSync(opts.out, { recursive: true });
  const outfile = resolve(opts.out, filename);

  console.log(`Audio XX → PDF`);
  console.log(`  URL : ${url}`);
  console.log(`  Out : ${outfile}`);

  await waitForServer(opts.baseUrl);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1024 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  // emulateMedia('print') so the @media print rules apply during PDF gen.
  await page.emulateMedia({ media: 'print' });

  await page.pdf({
    path: outfile,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log(`  ✓ wrote ${outfile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Silence unused-import lint for spawn (kept for future programmatic dev-server boot).
void spawn;
