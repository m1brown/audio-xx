/**
 * Editorial register gate (approved editorial-quality pass, 2026-08-04).
 *
 * The brief: Audio XX should read like an excellent reviewer, not a
 * novelist. The prose that ships on every assessment comes from
 * deterministic phrase banks, and neither of the existing guards inspects
 * them — `REVIEWER_REGISTER_RE` only sees LLM-proposed prose, and
 * `validateDominantCharacter` only sees one line. So the phrase banks had
 * drifted: "the chain breathes through musical phrasing", "the system is
 * two perspectives in one room", "That's the deal."
 *
 * This scans the string literals of the composer modules — comments
 * stripped, so a comment may quote a banned phrase to explain why it was
 * removed. It is a source gate, not a runtime one: these banks are static
 * data, so the source IS the output.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findRegisterViolations, REGISTER_RULES } from '../editorial-register';

const ROOT = join(__dirname, '..', '..');

/**
 * Composer modules whose emitted prose ships on assessments.
 *
 * `exclude` names top-level declarations that are glossary data rather than
 * advisor prose. QUALITY_PROFILES defines the listener vocabulary — the
 * entry for "sweetness" has to contain the word, and its `direction` field
 * ("Tube output stages are the classic source of sweetness…") is the causal
 * explanation the brief asks for, not the register problem it warns about.
 */
const GUARDED_MODULES: Array<{ path: string; exclude?: string[] }> = [
  { path: 'lib/artifact/canonical.ts' },
  { path: 'lib/artifact/synthesizeArtifact.ts' },
  { path: 'lib/emergent-behavior.ts' },
  { path: 'lib/gear-response.ts', exclude: ['QUALITY_PROFILES'] },
  { path: 'lib/listener-archetype.ts' },
  { path: 'lib/memo-deterministic-renderer.ts' },
];

/** Drop a top-level `const NAME ... = {` block, matching to its closing brace. */
function stripDeclaration(src: string, name: string): string {
  const start = src.search(new RegExp(`^(?:export )?const ${name}\\b`, 'm'));
  if (start < 0) throw new Error(`excluded declaration ${name} not found — update the test`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(0, start) + src.slice(i + 1);
  }
  throw new Error(`unbalanced braces scanning ${name}`);
}

/** Remove block and line comments so explanatory prose is not scanned. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/**
 * A vocabulary entry defining a listening term, e.g.
 *   '"Flow" is about musical continuity — notes connecting naturally…'
 * Defining "sweetness" for a reader is a different genre from using it to
 * describe a system, and the term being defined must appear verbatim. The
 * register rules govern the advisor's own prose, not its glossary.
 */
const TERM_DEFINITION_RE = /^["“][A-Z][a-z]+["”]\s+(?:is|describes|means|refers)\b/;

/** Every string/template literal in the source, comments already removed. */
function stringLiterals(src: string): string[] {
  const out: string[] = [];
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const s = m[1] ?? m[2] ?? m[3];
    // Only prose: skip identifiers, keys, class names, URLs, CSS values.
    if (s && /\s/.test(s) && !/^https?:|^[a-z-]+:\s|^\d/.test(s) && !TERM_DEFINITION_RE.test(s)) out.push(s);
  }
  return out;
}

describe('editorial register — composer prose', () => {
  for (const { path: rel, exclude } of GUARDED_MODULES) {
    it(`${rel} emits no off-register prose`, () => {
      let src = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
      for (const name of exclude ?? []) src = stripDeclaration(src, name);
      const offenders = stringLiterals(src)
        .flatMap((s) => findRegisterViolations(s).map((v) => `[${v.rule.id}] "${v.match}" in: ${s.slice(0, 110)}`));
      expect(offenders).toEqual([]);
    });
  }
});

describe('findRegisterViolations', () => {
  it('catches the constructions that shipped before this pass', () => {
    const shipped = [
      'the chain breathes through musical phrasing rather than gripping it',
      'each component\'s voice is audible — the system is two perspectives in one room',
      'More control trades a little bloom for grip. That’s the deal.',
      'the high-efficiency speakers don\'t need large amplification to come alive',
      'whether a tube amp sings or wheezes',
      'No single quality dominates; the system holds a considered balance.',
    ];
    for (const s of shipped) expect(findRegisterViolations(s).length).toBeGreaterThan(0);
  });

  it('passes concrete observational prose', () => {
    const clean = [
      'Warmth enters at the final stage, without obscuring the system’s resolution.',
      'small dynamic steps stay quick and clearly differentiated rather than flattened toward one level',
      'open and expansive presentation — image space extends beyond the speakers',
      'You hear it as bass that loosens under load and timing that softens on dense passages.',
      'the high-efficiency speakers reach satisfying levels on modest amplifier power',
    ];
    for (const s of clean) expect(findRegisterViolations(s)).toEqual([]);
  });

  it('every rule carries guidance on what to write instead', () => {
    for (const r of REGISTER_RULES) expect(r.guidance.length).toBeGreaterThan(20);
  });
});
