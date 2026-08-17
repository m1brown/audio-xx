import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Durable positive cache — survival of a live-lookup failure.
 *
 * The real-user defect was that one failed lookup made a listener's
 * corroborated loudspeaker read "your description only". Retry narrowed the
 * window; durable storage closes it, because a product verified against its
 * manufacturer does not become unidentifiable when today's request fails.
 *
 * The failure that made this necessary was in the store itself:
 *
 *   Conversion failed: number must be an integer in column 'checkedAt',
 *   got '1786995866677.0'
 *
 * `checkedAt` was BIGINT written from a JS number; the driver adapter bound it
 * as REAL, so writes succeeded and every read of a written row failed. The
 * epoch is now TEXT, which removes numeric conversion from the path entirely.
 */

const rows: Array<Record<string, unknown>> = [];
const executeRaw = vi.fn(async () => 0);
const queryRaw = vi.fn(async (sql: string, name: string) => {
  const wantsPositiveOnly = /status" = 'corroborated'/.test(sql);
  return rows.filter((r) => r.normalizedName === name
    && (!wantsPositiveOnly || r.status === 'corroborated'));
});

vi.mock('@/lib/prisma', () => ({
  prisma: { $executeRawUnsafe: executeRaw, $queryRawUnsafe: queryRaw },
}));

const ACORA = 'Acora QRC-2';
const GOOD = {
  exists: true, canonicalName: 'Acora Acoustics QRC-2', brand: 'Acora Acoustics',
  sourceUrl: 'https://www.acoraacoustics.com/qrc-2', sourceKind: 'official',
  sourceTitle: 'Acora Acoustics QRC-2', matchQuality: 0.95,
};
const reply = (p: unknown) => ({ ok: true, json: async () => ({ output_text: JSON.stringify(p) }) });

async function post(name: string) {
  const { POST } = await import('../../app/api/corroborate/route');
  const req = { json: async () => ({ name }) } as unknown as Parameters<typeof POST>[0];
  return (await POST(req)).json();
}

/** A row as the store writes it — every value a string, as the column types demand. */
function seed(ageMs: number) {
  rows.length = 0;
  rows.push({
    normalizedName: 'acora qrc-2', status: 'corroborated',
    canonicalName: 'Acora Acoustics QRC-2', brand: 'Acora Acoustics',
    sourceUrl: 'https://www.acoraacoustics.com/qrc-2', sourceKind: 'official',
    matchQuality: '0.95', checkedAt: String(Date.now() - ageMs),
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  rows.length = 0;
  executeRaw.mockClear();
  queryRaw.mockClear();
  process.env.OPENAI_API_KEY = 'test-key';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const store = await import('@/lib/corroboration-store');
  store.__clearMemoryCache();
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('a cold instance serves the durable row without a live lookup', () => {
  it('never calls the model when a fresh row exists', async () => {
    seed(60_000);
    const r = await post(ACORA);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.status).toBe('corroborated');
    expect(r.cacheTier).toBe('durable');
    expect(r.canonicalName).toBe('Acora Acoustics QRC-2');
  });

  it('parses a text timestamp back to a usable number', async () => {
    // The exact v1 defect: a stored row that could be written and not read.
    seed(60_000);
    const r = await post(ACORA);
    expect(typeof r.checkedAt).toBe('number');
    expect(Number.isFinite(r.checkedAt)).toBe(true);
    expect(r.store).toBe('durable_ok');
  });
});

describe('THE SURVIVAL CASE — live lookup fails, prior corroboration stands', () => {
  it('serves a prior positive when every attempt fails', async () => {
    // Stale beyond the positive TTL, so `readCached` declines it and the route
    // goes to a live lookup — which then fails outright.
    seed(400 * 24 * 60 * 60 * 1000);
    fetchMock.mockRejectedValue(new Error('network down'));

    const r = await post(ACORA);

    expect(fetchMock).toHaveBeenCalledTimes(2);      // both attempts tried
    expect(r.status).toBe('corroborated');           // NOT lookup_unknown
    expect(r.cacheTier).toBe('stale_positive');
    expect(r.canonicalName).toBe('Acora Acoustics QRC-2');
  });

  it('reports lookup_unknown only when there is no prior positive at all', async () => {
    rows.length = 0;
    fetchMock.mockRejectedValue(new Error('network down'));
    const r = await post(ACORA);
    expect(r.status).toBe('lookup_unknown');
  });

  it('does NOT resurrect a stale negative', async () => {
    // Existence does not expire; absence does. New gear appears, which is what
    // the short negative TTL is for.
    rows.length = 0;
    rows.push({
      normalizedName: 'acora qrc-2', status: 'uncorroborated',
      checkedAt: String(Date.now() - 400 * 24 * 60 * 60 * 1000),
    });
    fetchMock.mockRejectedValue(new Error('network down'));
    expect((await post(ACORA)).status).toBe('lookup_unknown');
  });

  it('prefers a successful live lookup over the stale row', async () => {
    seed(400 * 24 * 60 * 60 * 1000);
    fetchMock.mockResolvedValue(reply(GOOD));
    const r = await post(ACORA);
    expect(r.cacheTier).toBe('live');
    expect(r.status).toBe('corroborated');
  });
});

describe('storage failure never becomes an answer', () => {
  it('falls back to a live lookup when the durable read throws', async () => {
    queryRaw.mockRejectedValueOnce(new Error('Conversion failed'));
    fetchMock.mockResolvedValue(reply(GOOD));
    const r = await post(ACORA);
    expect(r.status).toBe('corroborated');
    expect(r.store).toBe('read_failed');   // reported, not fatal
  });

  it('still answers when the table cannot be created', async () => {
    executeRaw.mockRejectedValue(new Error('no such database'));
    fetchMock.mockResolvedValue(reply(GOOD));
    const r = await post(ACORA);
    expect(r.status).toBe('corroborated');
    expect(r.store).toBe('ddl_failed');
  });
});
