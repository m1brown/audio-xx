import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { presentDossier } from '../dossier-presentation';
import { dossierFor } from '../product-dossier';

/**
 * Everything admitted to the DossierView is visible, on every surface.
 *
 * Founder decision (2026-08-23): once a fact has been admitted, hiding it
 * behind a second interaction is the presentation layer overruling a selection
 * decision already made. Selection stays with `presentDossier`; display shows
 * what it chose. Depth varies by component — three useful facts is a shorter
 * card than ten, and that is the point.
 */
const ROOT = join(process.cwd(), 'apps/web/src');
const CONVERSATION = readFileSync(join(ROOT, 'components/advisory/ComponentDossiers.tsx'), 'utf8');
const ARTIFACT = readFileSync(join(ROOT, 'app/artifact/SnapshotArtifact.tsx'), 'utf8');

describe('no progressive disclosure on any surface', () => {
  it('the conversation card has no expand affordance', () => {
    expect(CONVERSATION).not.toMatch(/More detail|− Less|useState/);
  });

  it('the artifact has none either', () => {
    expect(ARTIFACT).not.toMatch(/More detail|− Less|useState|details>|summary>/);
  });

  it('both render every bucket of the view', () => {
    for (const [name, src] of [['conversation', CONVERSATION], ['artifact', ARTIFACT]] as const) {
      expect(src, `${name}: primary`).toMatch(/d\.primary\.map/);
      expect(src, `${name}: secondary`).toMatch(/d\.secondary\.map/);
      expect(src, `${name}: gaps`).toMatch(/d\.gaps\.map/);
    }
  });

  it('neither surface filters or reorders what selection chose', () => {
    for (const src of [CONVERSATION, ARTIFACT]) {
      // A `.filter(` or `.slice(` over a bucket would be a second selection.
      expect(src).not.toMatch(/d\.(primary|secondary)\.(filter|slice|sort)\(/);
    }
  });
});

describe("Nathan's admitted facts are all visible without any user action", () => {
  const dcs = presentDossier(dossierFor('dcs rossini apex', 'dCS Rossini Apex', {
    role: 'dac',
    heldSpecs: [
      { field: 'dimensions', value: '444mm x 435mm x 151mm' },
      { field: 'frequency_response', value: '16-bit data: Better than -96dB0' },
      { field: 'weight', value: '17.4kg / 38.3lbs' },
    ],
    reviews: [
      { publication: 'Stereophile', claim: 'Deeper silences between notes.',
        condition: { kind: 'other', description: 'direct A/B against the earlier Rossini' } },
      { publication: 'Stereophile', claim: 'Smoother highs over Ethernet.',
        condition: { kind: 'associated_equipment', description: 'Ethernet rather than USB' } },
      { publication: 'Stereophile', claim: 'Measured performance beyond reproach.' },
    ],
  }));
  const arc = presentDossier(dossierFor('arc ref 5', 'ARC ref 5', {
    role: 'preamplifier',
    heldSpecs: [
      { field: 'frequency_response', value: '0.5Hz to 200kHz' },
      { field: 'inputs', value: 'CD, TUNER, VIDEO, PHONO' },
      { field: 'tube_complement', value: '(4)-6H30P dual triodes, plus 6550C' },
      { field: 'weight', value: '30.4 lbs.' },
    ],
  }));

  it('every dCS observation is in the view, none dropped', () => {
    const rows = [...dcs.primary, ...dcs.secondary];
    expect(rows.filter((l) => l.publication === 'Stereophile')).toHaveLength(3);
    expect(rows.some((l) => l.value.includes('direct A/B'))).toBe(true);
    expect(rows.some((l) => l.value.includes('heard through other electronics'))).toBe(true);
  });

  it("ARC's tube complement is in the view", () => {
    const rows = [...arc.primary, ...arc.secondary];
    expect(rows.find((l) => l.label === 'tube complement')?.value).toContain('6H30P');
  });

  it('depth varies by component rather than being padded', () => {
    // dCS holds more than ARC; neither is topped up to match the other.
    const count = (v: typeof dcs) => v.primary.length + v.secondary.length;
    expect(count(dcs)).toBeGreaterThan(count(arc));
  });

  it('every row carries a label and a value — nothing is a stub', () => {
    for (const v of [dcs, arc]) {
      for (const l of [...v.primary, ...v.secondary]) {
        expect(l.label.trim().length, JSON.stringify(l)).toBeGreaterThan(0);
        expect(l.value.trim().length, JSON.stringify(l)).toBeGreaterThan(0);
      }
    }
  });
});

describe('the qualification renders once, with its finding', () => {
  const MSG = readFileSync(join(ROOT, 'components/advisory/AdvisoryMessage.tsx'), 'utf8');

  it('never appears as a sibling outside the finding conditional', () => {
    // Rendered as a sibling it fired once per signature block and printed the
    // sensitivity sentence twice on Nathan.
    expect(MSG).not.toMatch(/\}\)\}\s*\n\s*\{\/\*[^*]*\*\/\}\s*\n\s*\{a\.qualification &&/);
  });

  it('is guarded by the same condition as the finding', () => {
    // Every occurrence sits inside a block that also renders systemSignature.
    for (const m of MSG.matchAll(/\{a\.qualification && \(/g)) {
      const before = MSG.slice(Math.max(0, m.index! - 900), m.index!);
      expect(before, 'qualification detached from its finding')
        .toMatch(/a\.systemSignature/);
    }
  });
});
