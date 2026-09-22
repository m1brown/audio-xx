/**
 * ONE INTERPRETIVE AUTHORITY (integration cleanup, 2026-09-21).
 *
 * When the governed lane published a review, the assessment document carries
 * exactly ONE account of the assembled system — the governed prose. Every
 * deterministic system-level interpretation stands down: verdict, standfirst,
 * recognition, recommendation, cost, operating condition, action verdict and
 * the engine's reading prose. Facts are untouched: dossiers, evidence ledger,
 * provenance, question handoff and the component roster freeze exactly as
 * before.
 *
 * On fallback (no published review) the deterministic document is unchanged —
 * these pins assert both directions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { snapshotFromProvisional } from '../snapshot';

const RESPONSE = {
  philosophy: 'A system-level reading.',
  tendencies: '',
  systemSignature: 'A deterministic one-line verdict.',
  qualification: 'A deterministic qualification.',
  actionVerdict: { kind: 'act', headline: 'Change the amplifier' },
  followUp: 'A legacy follow-up question?',
  systemRelations: [],
  componentProvenance: [],
} as never;

const META = {
  engineVersion: 'test',
  createdAt: '2026-09-21T00:00:00.000Z',
  components: [
    { name: 'dCS Rossini Apex', role: 'dac' },
    { name: 'Butler Monads', role: 'amplifier' },
    { name: 'Acora QRC-2', role: 'speaker' },
  ],
  rawQuery: 'Assess my system.',
};

const GOVERNED = ['The governed account of this system.', 'Its one closing question?'];

describe('provisional snapshot — governed review displaces deterministic interpretation', () => {
  it('verdict, qualification and action verdict stand down on publish', () => {
    const snap = snapshotFromProvisional(RESPONSE, { ...META, publishedReview: GOVERNED });
    expect(snap.verdict).toBe('');
    expect(snap.qualification).toBeUndefined();
    expect(snap.actionVerdict).toBeUndefined();
    expect(snap.sections).toEqual([]);
    expect(snap.systemReview).toEqual(GOVERNED);
  });

  it('facts and evidence are untouched by the stand-down', () => {
    const snap = snapshotFromProvisional(RESPONSE, { ...META, publishedReview: GOVERNED });
    expect(snap.components.map((c) => c.name)).toEqual(META.components.map((c) => c.name));
    expect(snap.evidenceLedger).toBeDefined();
    expect(snap.evidenceStatement).toBeTruthy();
  });

  it('fallback keeps the deterministic interpretation exactly as before', () => {
    const snap = snapshotFromProvisional(RESPONSE, META);
    expect(snap.verdict.length).toBeGreaterThan(0);
    expect(snap.question).toBe('A legacy follow-up question?');
  });
});

describe('canonical builder and licence — structural pins', () => {
  const snapshotSrc = readFileSync(join(__dirname, '..', 'snapshot.ts'), 'utf8');
  const licenceSrc = readFileSync(
    join(__dirname, '..', '..', 'assessment', 'authoritative.ts'), 'utf8',
  );
  const fromResultSrc = readFileSync(
    join(__dirname, '..', '..', 'assessment', 'from-result.ts'), 'utf8',
  );
  const advisoryMsgSrc = readFileSync(
    join(__dirname, '..', '..', '..', 'components', 'advisory', 'AdvisoryMessage.tsx'), 'utf8',
  );

  it('every canonical interpretive field consults publishedReview', () => {
    for (const field of [
      "verdict: meta.publishedReview ? '' :",
      'standfirst: meta.publishedReview ? undefined :',
      'recognition: meta.publishedReview ? undefined :',
      'recommendation: meta.publishedReview ? undefined :',
      'cost: meta.publishedReview ? undefined :',
      'operatingCondition: meta.publishedReview ? undefined :',
      'actionVerdict: meta.publishedReview ? undefined :',
    ]) {
      expect(snapshotSrc, field).toContain(field);
    }
  });

  it('the licence never recomposes a verdict over a governed review', () => {
    expect((licenceSrc.match(/input\.governedReview\s*\n?\s*\? ''/g) ?? []).length)
      .toBeGreaterThanOrEqual(2);
  });

  it('the embedded artifact receives the governed review', () => {
    expect(fromResultSrc).toContain('publishedReview: options.publishedReview');
    expect(advisoryMsgSrc).toContain('publishedReview: advisory.__governedReview');
  });

  it('the sound graph keeps its place above the governed document', () => {
    expect(advisoryMsgSrc).toMatch(/advisory\.__governedReview && \(\s*<SystemHero/);
  });
});
