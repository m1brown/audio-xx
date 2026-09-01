import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * A SYSTEM ASSESSMENT DOES NOT ASK WHAT THE LISTENER WANTS TO SPEND.
 *
 * Nathan asked what Audio XX made of the system he already owns. The answer
 * opened with:
 *
 *   "For sharper picks, tell me about your sonic preferences and budget."
 *
 * Nobody asked for picks. The line rendered because it was gated on the
 * listener's PROFILE being incomplete rather than on the listener wanting
 * recommendations — so sparse evidence about a person was read as an
 * opportunity to sell. Sparse evidence is not shopping intent.
 *
 * Pinned structurally rather than by asserting on one system's output: the
 * defect was a missing gate, and a gate is what must not go missing.
 */

// The identity-provenance badges moved to ComponentDossiers (2026-08-25) when
// the duplicate "Your system" card list was removed: each component now has one
// representation, and its provenance belongs on it. Both files are read so the
// contract is checked wherever the labels live.
const RAW = readFileSync('apps/web/src/components/advisory/AdvisoryMessage.tsx', 'utf8')
  + readFileSync('apps/web/src/components/advisory/ComponentDossiers.tsx', 'utf8');

/**
 * Comments in that file quote the removed copy on purpose, to record what was
 * removed and why. Count live code only, or the record of the fix reads as the
 * defect.
 */
const SRC = RAW.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('picks invitations require picks intent', () => {
  it('the invitation is gated on advisory mode, not on profile completeness alone', () => {
    const i = SRC.indexOf('For sharper picks');
    expect(i).toBeGreaterThan(-1);
    // The guard sits immediately above the line it guards.
    const guard = SRC.slice(Math.max(0, i - 900), i);
    expect(guard).toMatch(/solicitsPicks\(advisoryMode\)/);
  });

  it('only recommendation modes solicit picks', () => {
    const fn = SRC.slice(SRC.indexOf('function solicitsPicks'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    for (const mode of ['gear_advice', 'upgrade_suggestions', 'gear_comparison']) {
      expect(body, `${mode} should solicit picks`).toContain(mode);
    }
    // An assessment answers a question about equipment the listener owns.
    for (const mode of ['system_review', 'product_assessment', 'audio_knowledge']) {
      expect(body, `${mode} must NOT solicit picks`).not.toContain(mode);
    }
  });

  it('no other surface asks for a budget outside a recommendation', () => {
    // A second copy of this line elsewhere would reintroduce the defect
    // without tripping the guard above.
    const occurrences = SRC.split('For sharper picks').length - 1;
    expect(occurrences).toBe(1);
  });
});

describe('internal execution taxonomy stays off the reader surface', () => {
  it('"Expanded reasoning" is not shown as a badge or caption', () => {
    // It named a code path. What the reader needs — that Audio XX holds less
    // evidence for parts of this chain — the assessment already states, by
    // name, in the coverage paragraph.
    const header = SRC.slice(SRC.indexOf('function ResponseHeader'));
    const body = header.slice(0, header.indexOf('\n}\n'));
    expect(body).toMatch(/const showReasoning = false/);
    expect(body).toMatch(/const showCaption = false/);
  });

  it('the component basis label never reports the code path', () => {
    expect(SRC).not.toMatch(/model: 'Expanded reasoning'/);
  });

  it('`model` carries NO badge on the recognition cards', () => {
    // It was briefly "Identity corroborated" — epistemically true and
    // editorially empty. The listener owns the equipment; being told Audio XX
    // confirmed it exists is not news, and on Nathan it repeated across three
    // of four cards as furniture. What is worth saying about those components
    // the coverage paragraph already says, by name.
    //
    // A badge now marks only the two states that change how a card should be
    // weighed: Audio XX holds curated evidence, or the listener's own word is
    // the only source. No badge means identified, nothing curated.
    expect(SRC).toMatch(/model: '',/);
    // The badge is gated on the label being non-empty, so `model` renders
    // nothing. The card list this lived on was removed (2026-08-25) and the
    // badge moved onto the component's single dossier — hence `d`, not `c`.
    expect(SRC).toMatch(/BASIS_LABEL\[d\.basis \?\? ''\] && \(/);
  });

  it('genuine provenance labels are retained', () => {
    for (const label of ['Audio XX catalog', 'Audio XX brand evidence', 'Your description only']) {
      expect(SRC, `${label} is real provenance and must stay`).toContain(label);
    }
  });
});

describe('a suppressed section does not announce itself', () => {
  it('"Learn more" is gated on links that will actually render', () => {
    // The heading was gated on `links.length > 0` while the F4 reviewer
    // exclusion empties review-kind links INSIDE AdvisoryLinks. Nathan's links
    // are all reviews, so the content was correctly suppressed and the heading
    // stood over nothing — a section label with no section.
    expect(SRC).not.toMatch(/a\.links && a\.links\.length > 0/);
    expect(SRC).toMatch(/hasDisplayableLinks\(a\.links\)/);
  });

  it('the predicate excludes exactly what F4 excludes, and no more', () => {
    const links = readFileSync('apps/web/src/components/advisory/AdvisoryLinks.tsx', 'utf8');
    const fn = links.slice(links.indexOf('export function hasDisplayableLinks'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    // Reference and dealer links still display; review links never do.
    expect(body).toContain("'reference'");
    expect(body).toContain("'dealer'");
    expect(body).not.toContain("'review'");
  });
});
