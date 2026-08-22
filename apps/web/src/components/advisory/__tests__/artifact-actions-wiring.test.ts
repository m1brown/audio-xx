import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The user flow: completed assessment -> View -> Print/Save PDF -> Share.
 *
 * Print and Share are separate actions, and the separation has to be
 * structural rather than a matter of which handler happens to call what:
 * printing must never publish.
 */
const ROOT = join(process.cwd(), 'apps/web/src');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const ACTIONS = read('components/advisory/ArtifactActionsInline.tsx');

describe('the three actions resolve through the snapshot', () => {
  it('View opens the private artifact by view token', () => {
    expect(ACTIONS).toMatch(/\/artifact\/\$\{encodeURIComponent\(viewToken\)\}/);
  });

  it('Print opens the SAME private snapshot', () => {
    expect(ACTIONS).toMatch(/\$\{artifactUrl\}\?print=1/);
  });

  it('Share resolves to the public token route', () => {
    expect(ACTIONS).toMatch(/\/artifact\/s\/\$\{encodeURIComponent\(token\)\}/);
  });

  it('NO action routes through the legacy re-assessing route', () => {
    // Code only. The doc comments deliberately NAME the legacy route in order
    // to say nothing may use it, so matching raw source would fail on the very
    // sentence that states the rule.
    const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    for (const f of ['components/advisory/ArtifactActionsInline.tsx',
      'app/artifact/AutoPrint.tsx', 'product/create-artifact-snapshot.ts']) {
      expect(code(f), f).not.toMatch(/artifact\?system=|\?system=\$\{/);
    }
  });
});

describe('printing cannot publish', () => {
  it('the print path has no capability beyond window.print', () => {
    const auto = read('app/artifact/AutoPrint.tsx');
    expect(auto).toMatch(/window\.print\(\)/);
    expect(auto).not.toMatch(/fetch|share|Token/);
  });

  it('only the Share handler calls the share API', () => {
    // The share call appears once, inside onShare — not in the print anchor.
    // Exactly one CALL site. The import is `{ shareArtifactSnapshot }` with
    // no paren, so a call-shaped match counts invocations only.
    expect((ACTIONS.match(/shareArtifactSnapshot\(/g) ?? []).length).toBe(1);
    const printAnchor = ACTIONS.slice(ACTIONS.indexOf('?print=1') - 200, ACTIONS.indexOf('?print=1') + 200);
    expect(printAnchor).not.toMatch(/shareArtifactSnapshot|onShare/);
  });

  it('hides every action when the snapshot could not be stored', () => {
    // Offering an artifact that cannot be opened is worse than offering none.
    expect(ACTIONS).toMatch(/if \(!viewToken\) return null;/);
  });
});

describe('the conversation freezes what it rendered', () => {
  const page = read('app/page.tsx');

  it('freezes both reasoning paths from their OWN result object', () => {
    expect(page).toMatch(/snapshotFromProvisional\(provisional,/);
    expect(page).toMatch(/synthesizeArtifact\(assessmentResult\)/);
    expect(page).toMatch(/toCanonicalAssessment\(synth\.payload, assessmentResult\)/);
  });

  it('attaches the capability without rewriting the assessment', () => {
    // SET_ARTIFACT_TOKEN adds the token; it cannot alter assessment prose.
    expect(page).toMatch(/type: 'SET_ARTIFACT_TOKEN', id: \w+, viewToken/);
    const reducer = page.slice(page.indexOf("case 'SET_ARTIFACT_TOKEN'"), page.indexOf("case 'ADD_NOTE'"));
    expect(reducer).toMatch(/artifactViewToken: action\.viewToken/);
    expect(reducer).not.toMatch(/systemSignature|philosophy|tendencies|followUp/);
  });

  it('never blocks the assessment on the snapshot', () => {
    expect(page).toMatch(/the assessment stands even when the artifact cannot be frozen/);
  });
});

describe('the actions are mounted once, for every assessment format', () => {
  const msg = read('components/advisory/AdvisoryMessage.tsx');

  it('renders from ONE site, not per format', () => {
    expect((msg.match(/<ArtifactActionsInline/g) ?? []).length).toBe(1);
  });

  it('is gated only on the token, never on the renderer', () => {
    // The first attempt mounted inside the artifact and memo branches. Nathan
    // renders through StandardFormat, so the snapshot was created, the token
    // returned, and no action appeared.
    const site = msg.slice(msg.indexOf('const artifactActions'), msg.indexOf('const artifactActions') + 220);
    expect(site).toMatch(/viewToken=\{advisory\.artifactViewToken\}/);
    expect(site).not.toMatch(/isMemoFormat|StandardFormat|SYSTEM_ASSESSMENT_ARTIFACT_ENABLED/);
  });
});

describe('the capability survives a later advisory update', () => {
  const page = read('app/page.tsx');

  it('UPDATE_ADVISORY preserves the artifact tokens', () => {
    // The catalog path splices a character line into `systemContext` AFTER
    // dispatch, rebuilding the advisory from the original object. Whichever
    // async write landed second used to win, and on production that meant the
    // snapshot was created, the token returned, and no action appeared.
    const branch = page.slice(page.indexOf("case 'UPDATE_ADVISORY'"),
      page.indexOf("case 'SET_ARTIFACT_TOKEN'"));
    expect(branch).toMatch(/artifactViewToken:\s*\n?\s*action\.advisory\.artifactViewToken \?\? m\.advisory\.artifactViewToken/);
    expect(branch).toMatch(/artifactShareToken:/);
    // It must not simply replace the advisory wholesale any more.
    expect(branch).not.toMatch(/\{ \.\.\.m, advisory: action\.advisory \}/);
  });
});
