import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The assessment's own Evidence footer is not application chrome.
 *
 * The artifact route hides site furniture with `body:has(.axx-route) footer`.
 * The document's last tier — primary sources and per-component provenance — is
 * itself a <footer>, so it matched too, and was invisible on every artifact and
 * in every PDF. It was in the DOM the whole time, which is why no content test
 * caught it: the markup was right and the stylesheet removed it.
 */
const CSS = readFileSync('apps/web/src/app/artifact/artifact.css', 'utf8');
const TSX = readFileSync('apps/web/src/app/artifact/SnapshotArtifact.tsx', 'utf8');

describe('evidence footer survives the chrome-hiding rules', () => {
  it('no rule hides `footer` unqualified on the artifact route', () => {
    const offenders = CSS.split('\n').filter(
      (l) => /body:has\(\.axx-route\)\s+footer\s*,?\s*$/.test(l.trim()),
    );
    expect(offenders, 'unqualified footer hide reintroduced').toEqual([]);
  });

  it('the document footer is excluded by class, not by element type', () => {
    expect(CSS).toMatch(/footer:not\(\.axx-doc-footer\)/);
    expect(TSX).toMatch(/className="axx-doc-footer"/);
  });

  it('the document footer is never hidden in print either', () => {
    // Print hides `.axx-actions`, the follow-up and the SITE footer. A rule
    // that hid `.axx-doc-footer` would drop sources from the PDF only.
    // Only a rule that TARGETS the class counts; `:not(.axx-doc-footer)` is
    // the exclusion that keeps it visible, not a rule against it.
    const targeting = CSS.split('}').filter((block) => {
      const sel = block.split('{')[0] ?? '';
      return /\.axx-doc-footer/.test(sel.replace(/:not\([^)]*\)/g, ''))
        && /display:\s*none/.test(block);
    });
    expect(targeting).toEqual([]);
  });

  it('the footer still carries sources and provenance', () => {
    const i = TSX.indexOf('axx-doc-footer');
    const body = TSX.slice(i, i + 900);
    expect(body).toContain('evidenceStatement');
    expect(body).toContain('primarySources');
    expect(body).toContain('axx-provenance');
  });
});

describe('the footer speaks the reader\'s language', () => {
  it('basis codes are never printed raw', () => {
    // "Acora QRC-2 (model)" says nothing to anyone who has not read the
    // source. The snapshot stores the code because that is what the engine
    // decided; the document must not repeat it.
    expect(TSX).not.toMatch(/\(\$\{c\.basis\}\)/);
    expect(TSX).toMatch(/basisLabel\(c\.basis\)/);
  });

  it('uses the same vocabulary as the conversation surface', () => {
    const conv = readFileSync('apps/web/src/components/advisory/AdvisoryMessage.tsx', 'utf8');
    const fn = TSX.slice(TSX.indexOf('function basisLabel'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    for (const [code, phrase] of [
      ['catalog', 'Audio XX catalog'],
      ['brand', 'Audio XX brand evidence'],
      ['model', 'identity corroborated'],
      ['user', 'your description only'],
    ] as const) {
      expect(body, `${code} label`).toContain(phrase);
    }

    // Where the CONVERSATION shows a badge, it uses the same words. It shows
    // none for `model`: a per-card badge repeating "identity corroborated"
    // three times is furniture, whereas the footer states each component's
    // basis once, as a provenance ledger. Same vocabulary, different job.
    for (const phrase of ['Audio XX catalog', 'Audio XX brand evidence', 'Your description only']) {
      expect(conv, `${phrase} parity`).toContain(phrase);
    }
    expect(conv).toMatch(/model: '',/);
  });
});
