import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Independent-review storage — slice 2.
 *
 * Storage only: no acquisition, no consumption, no D-12 use, no UI.
 *
 * The fixtures are the real beta products, because the shape of their coverage
 * is what the store has to survive: one review yielding several observations,
 * two publications on one product, a claim that exists in both conditioned and
 * unconditioned form, two variants that must never share a row, and a product
 * with no coverage at all.
 */

// `vi.mock` is hoisted above module scope, so the doubles it closes over must
// be hoisted too.
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
  readObservations, writeObservations, observationId, __clearReviewCache,
} from '../evidence/independent-review-store';
import type { ReviewObservation } from '../evidence/independent-review';

const NOW = Date.now();

const obs = (over: Partial<ReviewObservation>): ReviewObservation => ({
  productKey: 'dcs rossini apex',
  productName: 'dCS Rossini APEX',
  publication: 'Stereophile',
  sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor',
  observationType: 'listening',
  claim: 'Reports greater differentiation of instrumental texture.',
  retrievedAt: NOW,
  ...over,
});

beforeEach(() => {
  rows.length = 0;
  executeRaw.mockClear();
  queryRaw.mockClear();
  __clearReviewCache();
});

describe('several observations from ONE review are stored separately', () => {
  it('keeps each distinct claim from the same article', async () => {
    const article = 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor';
    await writeObservations([
      obs({ sourceUrl: article, claim: 'Reports deeper silence between notes.' }),
      obs({ sourceUrl: article, claim: 'Reports greater grace and flow from strings.' }),
      obs({ sourceUrl: article, claim: 'Reports improved bass response.' }),
    ]);
    __clearReviewCache();
    expect(await readObservations('dcs rossini apex', NOW)).toHaveLength(3);
  });

  it('keeps a measurement distinct from a listening note in the same review', async () => {
    await writeObservations([
      obs({ claim: 'Measured THD+N of 0.00026% at 1kHz.', observationType: 'measurement' }),
      obs({ claim: 'Measured THD+N of 0.00026% at 1kHz.', observationType: 'listening' }),
    ]);
    __clearReviewCache();
    const stored = await readObservations('dcs rossini apex', NOW);
    expect(stored).toHaveLength(2);
    expect(stored.map((o) => o.observationType).sort()).toEqual(['listening', 'measurement']);
  });
});

describe('multiple publications on ONE product stay separate', () => {
  it('does not merge two publications making the same observation', async () => {
    // Agreement between publications is a finding. Collapsing them into one
    // row would destroy it, and there is no consensus field to put it in.
    await writeObservations([
      obs({ publication: 'Stereophile' }),
      obs({ publication: 'Twittering Machines',
        sourceUrl: 'https://twitteringmachines.com/dcs-apex-next-gen-ring-dacs/' }),
      obs({ publication: 'HiFi+',   // the whitelist's exact name
        sourceUrl: 'https://hifiplus.com/articles/dcs-apex-digital-converter-upgrades/' }),
    ]);
    __clearReviewCache();
    const stored = await readObservations('dcs rossini apex', NOW);
    expect(stored).toHaveLength(3);
    expect(new Set(stored.map((o) => o.publication)).size).toBe(3);
  });

  it('stores no aggregate, score or consensus field', async () => {
    await writeObservations([obs({})]);
    __clearReviewCache();
    const [stored] = await readObservations('dcs rossini apex', NOW);
    for (const k of ['score', 'rating', 'average', 'consensus', 'stars', 'verdict']) {
      expect(Object.keys(stored)).not.toContain(k);
    }
  });
});

describe('conditioned and unconditioned observations remain distinct', () => {
  const REF5 = 'audio research reference 5';
  const base = {
    productKey: REF5, productName: 'Audio Research Reference 5',
    publication: 'The Absolute Sound',
    sourceUrl: 'https://www.theabsolutesound.com/articles/audio-research-reference-5-linestage-preamplifier/',
  };

  it('keeps "glorious" and "glorious after 500 hours" as two observations', async () => {
    // Collapsing them would erase the licence. The condition is the only part
    // a listener could act on.
    await writeObservations([
      obs({ ...base, claim: 'Describes the presentation as glorious.' }),
      obs({ ...base, claim: 'Describes the presentation as glorious.',
        condition: { kind: 'break_in', description: 'after approximately 500 hours' } }),
    ]);
    __clearReviewCache();
    const stored = await readObservations(REF5, NOW);
    expect(stored).toHaveLength(2);
    expect(stored.filter((o) => o.condition)).toHaveLength(1);
  });

  it('round-trips the condition intact', async () => {
    await writeObservations([obs({ ...base,
      claim: 'Reports the presentation opens up markedly.',
      condition: { kind: 'break_in', description: 'after approximately 500 hours' } })]);
    __clearReviewCache();
    const [stored] = await readObservations(REF5, NOW);
    expect(stored.condition).toEqual({ kind: 'break_in', description: 'after approximately 500 hours' });
  });

  it('treats two different conditions on one claim as two observations', async () => {
    await writeObservations([
      obs({ ...base, claim: 'Bass tightens.',
        condition: { kind: 'break_in', description: 'after 500 hours' } }),
      obs({ ...base, claim: 'Bass tightens.',
        condition: { kind: 'associated_equipment', description: 'with a high-current amplifier' } }),
    ]);
    __clearReviewCache();
    expect(await readObservations(REF5, NOW)).toHaveLength(2);
  });
});

describe('exact-variant separation survives storage', () => {
  it('never shares a row between the Reference 5 and the Reference 5 SE', async () => {
    await writeObservations([
      obs({ productKey: 'audio research reference 5',
        productName: 'Audio Research Reference 5',
        publication: 'The Absolute Sound',
        sourceUrl: 'https://www.theabsolutesound.com/articles/audio-research-reference-5-linestage-preamplifier/',
        claim: 'Describes a darker tonal balance than the Reference 3.' }),
      obs({ productKey: 'audio research reference 5 se',
        productName: 'Audio Research Reference 5 SE',
        sourceUrl: 'https://www.stereophile.com/content/audio-research-reference-5-se-line-preamplifier',
        claim: 'Describes a darker tonal balance than the Reference 3.' }),
    ]);
    __clearReviewCache();
    expect(await readObservations('audio research reference 5', NOW)).toHaveLength(1);
    __clearReviewCache();
    expect(await readObservations('audio research reference 5 se', NOW)).toHaveLength(1);
  });

  it('gives identical claims about different products different identities', async () => {
    const shared = {
      publication: 'Stereophile', sourceUrl: 'https://www.stereophile.com/x',
      observationType: 'listening' as const, claim: 'Smooth through the midrange.',
    };
    expect(observationId({ ...shared, productKey: 'acora qrc-2' }))
      .not.toBe(observationId({ ...shared, productKey: 'acora qrc-1' }));
  });
});

describe('idempotency', () => {
  it('re-running acquisition over the same article does not multiply rows', async () => {
    const three = [
      obs({ claim: 'Reports deeper silence between notes.' }),
      obs({ claim: 'Reports greater grace and flow.' }),
      obs({ claim: 'Reports improved bass response.' }),
    ];
    await writeObservations(three);
    await writeObservations(three);
    await writeObservations(three);
    __clearReviewCache();
    expect(await readObservations('dcs rossini apex', NOW)).toHaveLength(3);
  });

  it('updates a byline discovered on re-acquisition without creating a row', async () => {
    // `reviewer` and `quote` are outside the identity on purpose: learning
    // them later does not make it a new observation.
    await writeObservations([obs({})]);
    await writeObservations([obs({ reviewer: 'Jason Victor Serinus', quote: 'beyond reproach' })]);
    __clearReviewCache();
    const stored = await readObservations('dcs rossini apex', NOW);
    expect(stored).toHaveLength(1);
    expect(stored[0].reviewer).toBe('Jason Victor Serinus');
    expect(stored[0].quote).toBe('beyond reproach');
  });

  it('is insensitive to whitespace and case in the claim', async () => {
    await writeObservations([obs({ claim: 'Reports deeper silence.' })]);
    await writeObservations([obs({ claim: '  reports   DEEPER silence.  ' })]);
    __clearReviewCache();
    expect(await readObservations('dcs rossini apex', NOW)).toHaveLength(1);
  });
});

describe('zero coverage creates nothing', () => {
  it('writes no synthetic row for a product with no observations', async () => {
    await writeObservations([]);
    expect(executeRaw).not.toHaveBeenCalled();
    expect(await readObservations('butler monad a100', NOW)).toEqual([]);
  });

  it('returns an empty list rather than a placeholder', async () => {
    // Absence is a state the licensing layer already handles. A "we found
    // nothing" row would be indistinguishable from evidence later.
    const stored = await readObservations('butler monad a100', NOW);
    expect(stored).toEqual([]);
    expect(rows).toHaveLength(0);
  });
});

describe('6moons never reaches storage', () => {
  it('refuses to write a non-approved publication even if a caller tries', async () => {
    // Admission rejects it upstream; this makes it impossible even when a
    // future caller forgets to check.
    await writeObservations([obs({
      publication: '6moons',
      sourceUrl: 'https://6moons.com/audioreviews/dcs/rossini.html',
    })]);
    expect(executeRaw).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it('stops serving a row whose publication later left the whitelist', async () => {
    // The manufacturer store shipped a first-party fix production ignored,
    // because cached rows predated it. Re-checking on read retires them.
    rows.push({
      observationId: 'x-1', productKey: 'dcs rossini apex', productName: 'dCS Rossini APEX',
      publication: '6moons', reviewer: null,
      sourceUrl: 'https://6moons.com/x', publishedAt: null,
      observationType: 'listening', claim: 'Anything at all.', quote: null,
      axis: null, direction: null, conditionKind: null, conditionText: null,
      retrievedAt: String(NOW),
    });
    expect(await readObservations('dcs rossini apex', NOW)).toEqual([]);
  });
});

describe('storage failure is never an evidentiary answer', () => {
  it('returns absence when the read throws', async () => {
    queryRaw.mockRejectedValueOnce(new Error('Conversion failed'));
    expect(await readObservations('dcs rossini apex', NOW)).toEqual([]);
  });

  it('still serves from memory when the table cannot be created', async () => {
    executeRaw.mockRejectedValue(new Error('no such database'));
    await writeObservations([obs({})]);
    // The durable write failed; the in-process tier still answers.
    expect(await readObservations('dcs rossini apex', NOW)).toHaveLength(1);
  });
});
