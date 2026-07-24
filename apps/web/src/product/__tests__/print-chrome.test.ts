/**
 * Certification Gate 1, defect G1-D1 (S1) — regression pin.
 *
 * The printed assessment is a core deliverable ("keep, print, share").
 * Site chrome (the global nav and the floating Start Over bar) must be
 * excluded from every print rendering. The print exclusions live in CSS,
 * so the pin is structural: the stylesheets must contain @media print
 * rules covering the chrome and the on-screen artifact actions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WEB = resolve(__dirname, '../../..');
const globals = readFileSync(resolve(WEB, 'src/app/globals.css'), 'utf8');
const artifact = readFileSync(resolve(WEB, 'src/app/artifact/artifact.css'), 'utf8');

function printBlocks(css: string): string {
  // Concatenate the contents of every @media print block.
  const out: string[] = [];
  const re = /@media print\s*{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      if (css[i] === '}') depth--;
      i++;
    }
    out.push(css.slice(start, i - 1));
  }
  return out.join('\n');
}

describe('print output excludes everything that is not the assessment', () => {
  const globalPrint = printBlocks(globals);
  const artifactPrint = printBlocks(artifact);

  it('site nav is hidden in print', () => {
    expect(globalPrint).toMatch(/(^|[\s,{])nav[\s,{]/);
    expect(globalPrint).toContain('display: none');
  });

  it('the floating Start Over bar is hidden in print', () => {
    expect(globalPrint).toContain('.audioxx-global-startover');
  });

  it('artifact screen actions and follow-up are hidden in print', () => {
    expect(artifactPrint).toContain('.axx-actions');
    expect(artifactPrint).toContain('.axx-followup');
  });
});
