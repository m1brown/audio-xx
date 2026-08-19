import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AssessmentArtifact from '../AssessmentArtifact';
import { runArtifactPipeline } from '../../../product/assessment-pipeline';

/**
 * Paper is its own medium.
 *
 * Print used to be `background:#fff; color:#000` and nothing else — the
 * screen design photographed onto a page, at an 18px body, a 46px verdict
 * and an unbounded measure. That is what made a saved assessment read as a
 * printed webpage rather than a document.
 *
 * Verified for real during the pass: rendered through headless Chromium with
 * `emulateMedia({ media: 'print' })`, the artifact comes out at A4, two
 * pages, body computing to 14px (10.5pt), and pixel-identical between a
 * light-mode and a dark-mode browser.
 */

const markup = (): string => {
  const text = 'Assess my system: Amp: Decware SE84UFO Speakers: Acora QRC-2 '
    + 'Dac: Denafrips Pontus II';
  const { canonical } = runArtifactPipeline(text)!;
  return renderToStaticMarkup(
    createElement(AssessmentArtifact as never, { canonical, print: true }),
  );
};

/** The @media print block, isolated. */
function printBlock(html: string): string {
  const i = html.indexOf('@media print{');
  expect(i).toBeGreaterThan(-1);
  // Balance braces from the block's opening brace.
  let depth = 0;
  for (let j = html.indexOf('{', i); j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(i, j + 1); }
  }
  throw new Error('unbalanced @media print block');
}

describe('the printed artifact is set for paper', () => {
  const block = printBlock(markup());

  it('declares a page size and margins', () => {
    expect(block).toMatch(/@page\{\s*size:A4 portrait;\s*margin:18mm 16mm;\s*\}/);
  });

  it('sets a print body size in points, not screen pixels', () => {
    expect(block).toMatch(/font-size:10\.5pt/);
    expect(block).toMatch(/\.axa-p\{font-size:10\.5pt;line-height:1\.4[0-9]?/);
  });

  it('brings the verdict down from its screen size', () => {
    expect(block).toMatch(/\.axa-verdict\{font-size:24pt/);
  });

  it('bounds the measure', () => {
    expect(block).toMatch(/max-width:74ch/);
  });

  it('keeps units that read as one block off page breaks', () => {
    expect(block).toMatch(/break-inside:avoid/);
    expect(block).toMatch(/break-after:avoid/);
  });

  it('drops screen-only chrome', () => {
    expect(block).toMatch(/\.axa-contradiction,\.axa-actions,\.axa-followup\{display:none/);
  });
});

describe('printing from a dark-mode browser does not print dark', () => {
  // prefers-color-scheme still matches at print time. Overriding only
  // background and colour left every hairline, panel and accent on their
  // dark values, so the whole token block is re-declared.
  const block = printBlock(markup());

  it('re-declares the full light palette, not just background and ink', () => {
    for (const token of ['--ground:#fff', '--panel:#fff', '--ink:#111',
      '--ink-muted:#333', '--ink-faint:#555', '--hairline:#999']) {
      expect(block).toContain(token);
    }
  });

  it('gives the tonal signature a mark that survives greyscale', () => {
    // The committed pole is named in words in the reading column, so the
    // graph is corroborating — but the marker must still be visible without
    // colour, hence an outline on both the committed and neutral states.
    expect(block).toMatch(/\.axa-track i\{[^}]*border:\.5pt solid #111/);
    expect(block).toMatch(/\.axa-track i\.neu\{[^}]*border:1pt solid #111/);
  });
});
