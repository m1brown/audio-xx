/**
 * Turn-0 consolidation pins (2026-09-20).
 *
 *  1. ONE OWNER OF THE HANDOFF — a snapshot frozen with a published
 *     governed review carries no legacy follow-up question beside it;
 *     ownership is publication state, never text matching. A fallback
 *     snapshot keeps the legacy follow-up as its handoff.
 *  2. THE FROZEN REVIEW IS WHAT THE LISTENER READ — publishedReview
 *     replaces the second deterministic composition on both snapshot
 *     builders, so conversation, artifact, and follow-up continuity all
 *     read one text.
 *  3. THE SAVE PROPOSAL INHERITS THE ASSESSMENT GRAPH — unknown brands no
 *     longer become category 'other' with dropped components; the
 *     assessment's roles are authoritative.
 *  4. ONE TURN-0 ARCHITECTURE — both assessment branches (provisional and
 *     cataloged) call the same governed synthesis mode and clear the
 *     legacy follow-up on publish; catalog state selects evidence, never
 *     the reasoning architecture.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { snapshotFromProvisional } from '../snapshot';
import { draftComponentsFromAssessed } from '@/lib/system-types';

const RESPONSE = {
  philosophy: 'A system-level reading.',
  tendencies: '',
  systemSignature: 'sig',
  qualification: undefined,
  actionVerdict: undefined,
  followUp: 'Could you provide more details about the ARC, such as its role in your system?',
  systemRelations: [],
  componentProvenance: [],
} as never;

const META = {
  engineVersion: 'test',
  createdAt: '2026-09-20T00:00:00.000Z',
  components: [
    { name: 'dCS Rossini Apex', role: 'dac' },
    { name: 'ARC ref', role: 'preamplifier' },
    { name: 'Butler Monads', role: 'amplifier' },
    { name: 'Acora QRC-2', role: 'speaker' },
  ],
  rawQuery: 'Assess my system: dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2.',
};

const GOVERNED = [
  'My first read is that this is a system to refine through setup.',
  'Which ARC Reference preamplifier model are you using?',
];

describe('one owner of the conversational handoff', () => {
  it('a published governed review freezes no legacy follow-up beside it', () => {
    const snap = snapshotFromProvisional(RESPONSE, { ...META, publishedReview: GOVERNED });
    expect(snap.question).toBeUndefined();
    expect(snap.systemReview).toEqual(GOVERNED);
    expect(snap.reviewSections).toEqual([{ label: 'System review', paragraphs: GOVERNED }]);
  });

  it('a fallback snapshot keeps the legacy follow-up as its handoff', () => {
    const snap = snapshotFromProvisional(RESPONSE, META);
    expect(snap.question).toBe(RESPONSE.followUp);
    // And its review is the deterministic composition, not the governed text.
    expect(snap.systemReview).not.toEqual(GOVERNED);
  });
});

describe('the save proposal inherits the assessment graph', () => {
  it('assessed roles become correct draft categories — never other for typed roles', () => {
    const drafts = draftComponentsFromAssessed(META.components.map((c) => ({
      displayName: c.name, role: c.role,
    })));
    const byName = Object.fromEntries(drafts.map((d) => [d.name, d]));
    expect(byName['Butler Monads']).toMatchObject({ category: 'amplifier' });
    expect(byName['Acora QRC-2']).toMatchObject({ category: 'speaker' });
    expect(byName['dCS Rossini Apex']).toMatchObject({ category: 'dac' });
    expect(byName['ARC ref']).toMatchObject({ category: 'amplifier', role: 'preamp' });
    // Every assessed component is present — none dropped.
    expect(drafts.length).toBe(4);
    expect(drafts.every((d) => d.category !== 'other')).toBe(true);
  });

  it('brand text from the prior extraction is preserved on a name match', () => {
    const drafts = draftComponentsFromAssessed(
      [{ displayName: 'Butler Monads', role: 'amplifier' }],
      [{ name: 'Monads', brand: 'Butler', category: 'other', role: null }],
    );
    expect(drafts[0]).toMatchObject({ name: 'Monads', brand: 'Butler', category: 'amplifier' });
  });

  it('an untyped role still lands somewhere honest', () => {
    const [d] = draftComponentsFromAssessed([{ displayName: 'Mystery Box', role: 'cd player' }]);
    expect(d.category).toBe('other');
    expect(d.name).toBe('Mystery Box');
  });
});

describe('one turn-0 architecture — both branches, same governed path', () => {
  const page = readFileSync(join(__dirname, '..', '..', '..', 'app', 'page.tsx'), 'utf8');

  it('both assessment branches call the same governed synthesis mode', () => {
    expect((page.match(/mode: 'assessment'/g) ?? []).length).toBe(2);
  });

  it('each publish block clears the legacy follow-up (ownership by publication state)', () => {
    const provisional = /provisionalAdvisory\.followUp = undefined/;
    const cataloged = /deterministicAdvisory\.followUp = undefined/;
    expect(page).toMatch(provisional);
    expect(page).toMatch(cataloged);
  });

  it('the v2 prose carrier yields to a published governed review', () => {
    expect(page).toMatch(/ASSESSMENT_ARTIFACT_V2_ENABLED && !governedParas/);
  });
});
