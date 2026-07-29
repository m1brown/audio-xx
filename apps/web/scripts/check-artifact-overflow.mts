/**
 * Viewport-level overflow guard for the Assessment Renderer (Web Artifact).
 * Renders the France reference assessment through the real shared component,
 * loads it at representative mobile widths, and fails if the page overflows
 * horizontally (a headline, image, chart, box, or footer escaping the column).
 *
 * Run:  npx tsx apps/web/scripts/check-artifact-overflow.mts
 * CI-friendly: exits non-zero on any horizontal overflow.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';
import AssessmentArtifact from '../src/app/artifact/AssessmentArtifact';
import { extractSubjectMatches, detectIntent } from '../src/lib/intent';
import { buildSystemAssessment } from '../src/lib/consultation';
import { synthesizeArtifact } from '../src/lib/artifact/synthesizeArtifact';
import { toCanonicalAssessment } from '../src/lib/artifact/canonical';

const FRANCE = 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor';
const WIDTHS = [320, 360, 390, 414];

const subs = extractSubjectMatches(FRANCE);
const { desires } = detectIntent(FRANCE);
const raw: any = buildSystemAssessment(FRANCE, subs, null, desires);
const { payload } = synthesizeArtifact(raw) as any;
const canonical = toCanonicalAssessment(payload, raw);
const body = renderToStaticMarkup(createElement(AssessmentArtifact, { canonical, print: true }));
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}</style>${body}`;

const dir = mkdtempSync(join(tmpdir(), 'axa-'));
const path = join(dir, 'a.html');
writeFileSync(path, html);

const browser = await chromium.launch();
let overflow = false;
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 1400 } });
  await page.goto('file://' + path, { waitUntil: 'networkidle' }).catch(() => {});
  const r = await page.evaluate(() => {
    const iw = window.innerWidth;
    const offenders = [...document.querySelectorAll('*')]
      .filter((el) => el.getBoundingClientRect().right > iw + 1)
      .map((el) => `${(el as HTMLElement).tagName}.${(el as HTMLElement).className}`);
    return { scrollWidth: document.documentElement.scrollWidth, iw, offenders: offenders.slice(0, 8) };
  });
  const bad = r.scrollWidth > r.iw + 1;
  overflow ||= bad;
  console.log(`w=${width}: scrollWidth=${r.scrollWidth} innerWidth=${r.iw} → ${bad ? 'OVERFLOW ' + JSON.stringify(r.offenders) : 'OK'}`);
  await page.close();
}
await browser.close();
rmSync(dir, { recursive: true, force: true });
console.log(overflow ? 'FAIL: horizontal overflow detected' : 'PASS: zero horizontal overflow at all mobile widths');
process.exit(overflow ? 1 : 0);
