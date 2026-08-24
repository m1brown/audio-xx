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

const RAW = readFileSync('apps/web/src/components/advisory/AdvisoryMessage.tsx', 'utf8');

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

  it('the component basis label reports EVIDENCE, not the code path', () => {
    expect(SRC).toMatch(/model: 'Identity corroborated'/);
    expect(SRC).not.toMatch(/model: 'Expanded reasoning'/);
  });

  it('genuine provenance labels are retained', () => {
    for (const label of ['Audio XX catalog', 'Audio XX brand evidence', 'Your description only']) {
      expect(SRC, `${label} is real provenance and must stay`).toContain(label);
    }
  });
});
