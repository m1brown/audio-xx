import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Independent-review acquisition — slice 3.
 *
 * Acquisition only. Nothing consumes what it stores.
 *
 * The pipeline is proved without a network: resolve the publication, admit
 * under slice 1, store under slice 2. The network wrapper in the route only
 * fetches and parses, so everything that decides anything is exercised here.
 */

const { rows, executeRaw, queryRaw } = vi.hoisted(() => {
  const rows: Array<Record<string, unknown>> = [];
  const executeRaw = vi.fn(async (sql: string, ...args: unknown[]) => {
    if (!/^\s*INSERT/i.test(sql)) return 0;
    const id = String(args[0]);
    const row: Record<string, unknown> = {
      observationId: id, productKey: args[1], productName: args[2], publication: args[3],
      reviewer: args[4], sourceUrl: args[5], publishedAt: args[6], observationType: args[7],
      claim: args[8], quote: args[9], axis: args[10], direction: args[11],
      conditionKind: args[12], conditionText: args[13], retrievedAt: args[14],
    };
    const at = rows.findIndex((r) => r.observationId === id);
    if (at >= 0) rows[at] = row; else rows.push(row);
    return 1;
  });
  const queryRaw = vi.fn(async (_sql: string, productKey: string) =>
    rows.filter((r) => r.productKey === productKey));
  return { rows, executeRaw, queryRaw };
});

vi.mock('@/lib/prisma', () => ({
  prisma: { $executeRawUnsafe: executeRaw, $queryRawUnsafe: queryRaw },
}));

import {
  admitAndStore, resolveCandidatePublication, type ReviewCandidate,
} from '../evidence/independent-review-acquisition';
import { readObservations, __clearReviewCache } from '../evidence/independent-review-store';

const NOW = Date.now();

beforeEach(() => {
  rows.length = 0;
  executeRaw.mockClear();
  queryRaw.mockClear();
  __clearReviewCache();
});

// ── Publication resolution ───────────────────────────────────────────
describe('publication resolution — the host is authoritative, the name is a claim', () => {
  it('NORMALISES a near-miss name through the registry', async () => {
    // A model writing "Hi-Fi+" where the registry says "HiFi+" must not create
    // a second identity: one publication split in two would make a single
    // source look like two agreeing voices.
    const r = resolveCandidatePublication({
      publication: 'Hi-Fi+',
      sourceUrl: 'https://hifiplus.com/articles/dcs-apex-digital-converter-upgrades/',
    });
    expect(r).toEqual({ publication: 'HiFi+' });
  });

  it('stores the near-miss under the canonical identity, not a second one', async () => {
    const outcome = await admitAndStore('dCS Rossini APEX', 'dcs rossini apex', [{
      productName: 'dCS Rossini APEX', publication: 'Hi-Fi+',
      sourceUrl: 'https://hifiplus.com/articles/dcs-apex-digital-converter-upgrades/',
      observationType: 'listening',
      claim: 'Reports a more differentiated sense of instrumental texture.',
    }], NOW);
    expect(outcome.status).toBe('observations');
    __clearReviewCache();
    const stored = await readObservations('dcs rossini apex', NOW);
    expect(stored.map((o) => o.publication)).toEqual(['HiFi+']);
  });

  it('resolves other punctuation and case variants', () => {
    for (const [written, canonical] of [
      ['stereophile', 'Stereophile'],
      ['The Absolute Sound', 'The Absolute Sound'],
      ['soundstage!', 'SoundStage!'],
      ['Mono & Stereo', undefined],   // registry says "Mono and Stereo"
    ] as const) {
      const r = resolveCandidatePublication({ publication: written });
      if (canonical) expect(r).toEqual({ publication: canonical });
      else expect(r).toMatchObject({ reason: 'publication_unresolvable' });
    }
  });

  it('resolves a SoundStage! network host to the parent publication', () => {
    expect(resolveCandidatePublication({
      sourceUrl: 'https://www.soundstageultra.com/index.php/equipment-menu/119-audio-research-corporation-reference-5-preamplifier',
    })).toEqual({ publication: 'SoundStage!' });
  });

  it('rejects a byline claimed on another publication’s domain', () => {
    expect(resolveCandidatePublication({
      publication: 'Stereophile',
      sourceUrl: 'https://www.soundstagehifi.com/index.php/equipment-reviews/661',
    })).toMatchObject({ reason: 'publication_mismatch' });
  });
});

// ── Mirrors ──────────────────────────────────────────────────────────
describe('an approved publication served through a mirror is rejected', () => {
  it('refuses the article when the host is not the publication’s own', async () => {
    const outcome = await admitAndStore('dCS Rossini APEX', 'dcs rossini apex', [{
      productName: 'dCS Rossini APEX', publication: 'Stereophile',
      sourceUrl: 'https://manualzz.com/doc/stereophile-dcs-rossini-apex',
      observationType: 'listening', claim: 'Reports deeper silence between notes.',
    }], NOW);
    expect(outcome.status).toBe('no_coverage');
    expect(executeRaw).not.toHaveBeenCalled();
  });
});

// ── FIXTURE 1: dCS Rossini APEX — rich positive ──────────────────────
describe('FIXTURE dCS Rossini APEX — rich coverage is admitted and stored', () => {
  const CANDIDATES: ReviewCandidate[] = [
    { productName: 'dCS Rossini APEX', publication: 'Stereophile',
      reviewer: 'Jason Victor Serinus',
      sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor',
      observationType: 'listening',
      claim: 'Reports greater differentiation of instrumental texture and more space around instruments.',
      axis: 'smooth_detailed', direction: 'detailed' },
    { productName: 'dCS Rossini APEX', publication: 'Stereophile',
      sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-measurements',
      observationType: 'measurement',
      claim: 'Measured THD+N of 0.00026% at 1kHz into the 6V output.' },
    { productName: 'dCS Rossini APEX', publication: 'Twittering Machines',
      sourceUrl: 'https://twitteringmachines.com/dcs-apex-next-gen-ring-dacs/',
      observationType: 'listening',
      claim: 'Describes the APEX output stage as resolving more low-level detail.' },
  ];

  it('admits all three and stores them', async () => {
    const outcome = await admitAndStore('dCS Rossini APEX', 'dcs rossini apex', CANDIDATES, NOW);
    expect(outcome.status).toBe('observations');
    if (outcome.status !== 'observations') return;
    expect(outcome.observations).toHaveLength(3);
    __clearReviewCache();
    expect(await readObservations('dcs rossini apex', NOW)).toHaveLength(3);
  });

  it('is idempotent across repeated acquisition', async () => {
    await admitAndStore('dCS Rossini APEX', 'dcs rossini apex', CANDIDATES, NOW);
    await admitAndStore('dCS Rossini APEX', 'dcs rossini apex', CANDIDATES, NOW + 1000);
    __clearReviewCache();
    expect(await readObservations('dcs rossini apex', NOW + 1000)).toHaveLength(3);
  });

  it('keeps two publications separate rather than merging them', async () => {
    await admitAndStore('dCS Rossini APEX', 'dcs rossini apex', CANDIDATES, NOW);
    __clearReviewCache();
    const stored = await readObservations('dcs rossini apex', NOW);
    expect(new Set(stored.map((o) => o.publication)).size).toBe(2);
  });
});

// ── FIXTURE 2: ARC Reference 5 — variant + condition ─────────────────
describe('FIXTURE ARC Reference 5 — variant trap and condition', () => {
  const REF5 = 'Audio Research Reference 5';
  const KEY = 'audio research reference 5';

  it('admits the Reference 5 and REJECTS the Reference 5 SE in one batch', async () => {
    const outcome = await admitAndStore(REF5, KEY, [
      { productName: 'Audio Research Reference 5', publication: 'The Absolute Sound',
        sourceUrl: 'https://www.theabsolutesound.com/articles/audio-research-reference-5-linestage-preamplifier/',
        observationType: 'listening',
        claim: 'Describes a darker balance with denser tone colour than the Reference 3.' },
      { productName: 'Audio Research Reference 5 SE', publication: 'Stereophile',
        sourceUrl: 'https://www.stereophile.com/content/audio-research-reference-5-se-line-preamplifier',
        observationType: 'positioning',
        claim: 'Places it as a best buy among super-preamps.' },
    ], NOW);

    expect(outcome.status).toBe('observations');
    if (outcome.status !== 'observations') return;
    // A partially admissible batch stores its admissible half: one bad
    // candidate is not evidence about the others.
    expect(outcome.observations).toHaveLength(1);
    expect(outcome.rejected).toHaveLength(1);
    expect(outcome.rejected[0].reason).toBe('different_product');
    __clearReviewCache();
    const stored = await readObservations(KEY, NOW);
    expect(stored).toHaveLength(1);
    expect(stored[0].productName).toBe('Audio Research Reference 5');
  });

  it('stores the 500-hour observation WITH its condition', async () => {
    await admitAndStore(REF5, KEY, [{
      productName: 'Audio Research Reference 5', publication: 'The Absolute Sound',
      sourceUrl: 'https://www.theabsolutesound.com/articles/audio-research-reference-5-linestage-preamplifier/',
      observationType: 'listening',
      claim: 'Reports the presentation opens up markedly after roughly 500 hours.',
      condition: { kind: 'break_in', description: 'after approximately 500 hours' },
    }], NOW);
    __clearReviewCache();
    const [stored] = await readObservations(KEY, NOW);
    expect(stored.condition).toEqual(
      { kind: 'break_in', description: 'after approximately 500 hours' });
  });

  it('REJECTS the same observation when acquisition dropped the condition', async () => {
    const outcome = await admitAndStore(REF5, KEY, [{
      productName: 'Audio Research Reference 5', publication: 'The Absolute Sound',
      sourceUrl: 'https://www.theabsolutesound.com/articles/audio-research-reference-5-linestage-preamplifier/',
      observationType: 'listening',
      claim: 'Reports the presentation opens up markedly after roughly 500 hours.',
    }], NOW);
    expect(outcome.status).toBe('no_coverage');
    if (outcome.status === 'lookup_unknown') return;
    expect(outcome.rejected[0].reason).toBe('condition_dropped');
    expect(rows).toHaveLength(0);
  });

  it('files an unrecognised condition kind as `other` rather than losing it', async () => {
    await admitAndStore(REF5, KEY, [{
      productName: 'Audio Research Reference 5', publication: 'The Absolute Sound',
      sourceUrl: 'https://www.theabsolutesound.com/articles/audio-research-reference-5-linestage-preamplifier/',
      observationType: 'listening', claim: 'Bass tightens once settled.',
      condition: { kind: 'lunar_phase', description: 'after a week in the system' },
    }], NOW);
    __clearReviewCache();
    const [stored] = await readObservations(KEY, NOW);
    expect(stored.condition?.kind).toBe('other');
    expect(stored.condition?.description).toBe('after a week in the system');
  });
});

// ── FIXTURE 3: Butler MONAD A100 — zero coverage ─────────────────────
describe('FIXTURE Butler MONAD A100 — zero coverage is a valid result', () => {
  it('returns no_coverage and writes nothing', async () => {
    const outcome = await admitAndStore(
      'Butler MONAD A100', 'butler monad a100', [], NOW);
    expect(outcome.status).toBe('no_coverage');
    expect(executeRaw).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it('is DISTINGUISHABLE from a lookup failure', async () => {
    // The corroboration layer already paid for collapsing these once, where a
    // timeout became "your loudspeaker cannot be identified".
    const coverage = await admitAndStore('Butler MONAD A100', 'butler monad a100', [], NOW);
    expect(coverage.status).toBe('no_coverage');
    expect(coverage.status).not.toBe('lookup_unknown');
  });

  it('rejects 6moons, whose exclusion is its absence from the registry', async () => {
    const outcome = await admitAndStore('Butler MONAD A100', 'butler monad a100', [{
      productName: 'Butler MONAD A100', publication: '6moons',
      sourceUrl: 'https://6moons.com/audioreviews/butler/monad.html',
      observationType: 'listening', claim: 'Anything at all.',
    }], NOW);
    expect(outcome.status).toBe('no_coverage');
    if (outcome.status === 'lookup_unknown') return;
    expect(outcome.rejected[0].reason).toBe('publication_unresolvable');
    expect(rows).toHaveLength(0);
  });
});

// ── FIXTURE 4: Acora QRC-2 — sibling exclusion ───────────────────────
describe('FIXTURE Acora QRC-2 — siblings never become weaker QRC-2 evidence', () => {
  it('rejects every sibling model and stores nothing', async () => {
    const outcome = await admitAndStore('Acora Acoustics QRC-2', 'acora acoustics qrc-2', [
      { productName: 'Acora Acoustics SRB', publication: 'Stereophile',
        sourceUrl: 'https://www.stereophile.com/content/acora-srb-loudspeaker',
        observationType: 'listening', claim: 'Reports a smooth midrange from the stone enclosure.' },
      { productName: 'Acora Acoustics MRC-2', publication: 'SoundStage!',
        sourceUrl: 'https://www.soundstageultra.com/index.php/equipment-menu/1284-acora-acoustics-mrc-2-loudspeaker',
        observationType: 'listening', claim: 'Reports excellent image focus.' },
      { productName: 'Acora Acoustics VRC', publication: 'The Absolute Sound',
        sourceUrl: 'https://www.theabsolutesound.com/articles/acora-acoustics-vrc-loudspeaker/',
        observationType: 'positioning', claim: 'Names it a Golden Ear award winner.' },
    ], NOW);

    expect(outcome.status).toBe('no_coverage');
    if (outcome.status === 'lookup_unknown') return;
    expect(outcome.rejected).toHaveLength(3);
    expect(outcome.rejected.every((r) => r.reason === 'different_product')).toBe(true);
    expect(rows).toHaveLength(0);
  });

  it('admits a genuine QRC-2 observation from the same publication', async () => {
    const outcome = await admitAndStore('Acora Acoustics QRC-2', 'acora acoustics qrc-2', [{
      productName: 'Acora Acoustics QRC-2', publication: 'SoundStage!',
      sourceUrl: 'https://www.soundstageultra.com/index.php/equipment-menu/1284-acora-acoustics-mrc-2-loudspeaker',
      observationType: 'comparison',
      claim: 'Reports the QRC-2 sounding larger in scale than the MRC-2 without compression.',
    }], NOW);
    expect(outcome.status).toBe('observations');
  });
});

// ── No scores, ever ──────────────────────────────────────────────────
describe('acquisition generates no scores, ratings or summaries', () => {
  it('stores only the observation fields', async () => {
    await admitAndStore('dCS Rossini APEX', 'dcs rossini apex', [{
      productName: 'dCS Rossini APEX', publication: 'Stereophile',
      sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor',
      observationType: 'listening', claim: 'Reports greater texture differentiation.',
    }], NOW);
    __clearReviewCache();
    const [stored] = await readObservations('dcs rossini apex', NOW);
    for (const k of ['score', 'rating', 'average', 'consensus', 'stars', 'summary', 'overall']) {
      expect(Object.keys(stored)).not.toContain(k);
    }
  });
});
