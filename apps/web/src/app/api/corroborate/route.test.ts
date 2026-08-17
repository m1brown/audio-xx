import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Corroboration durability — the real-user defect.
 *
 * A listener submitted
 *
 *   Assess my system: Pre-amp: ARC ref 5 Amps: Butler Monads
 *   Dac/Streamer: dCS Rossini Apex Speakers: Acora QRC-2
 *
 * and the assessment labelled the Acora QRC-2 "YOUR DESCRIPTION ONLY", said
 * its characteristics were unknown, and asked them to describe their own
 * loudspeaker. Audio XX identifies that product correctly on demand — probing
 * production, it resolves to acoraacoustics.com every time.
 *
 * The lookup had failed on that one turn, and a failed lookup was
 * indistinguishable from a completed one that found nothing. One observed
 * failure mode was a `sourceUrl` of
 *
 *   "https://www.acoraacoustics.com/ (via indication of QRC-2 on their site)"
 *
 * — a real address with commentary glued on. Rejecting it was correct.
 * Recording it as "this loudspeaker cannot be identified" was not.
 */

vi.mock('@/lib/prisma', () => ({ prisma: null }));   // memory tier only

const ACORA = 'Acora QRC-2';

/** The reply production returns when the lookup works. */
const GOOD = {
  exists: true,
  canonicalName: 'Acora Acoustics QRC-2',
  brand: 'Acora Acoustics',
  sourceUrl: 'https://www.acoraacoustics.com/qrc-2',
  sourceKind: 'official',
  sourceTitle: 'Acora Acoustics QRC-2',
  matchQuality: 0.95,
};

/** The reply that broke it: a URL with prose appended. */
const MALFORMED = {
  ...GOOD,
  sourceUrl: 'https://www.acoraacoustics.com/ (via indication of QRC-2 on their site)',
};

/** A completed lookup that genuinely found nothing. */
const NOT_FOUND = { exists: false, canonicalName: null, brand: null, sourceUrl: null,
  sourceKind: 'other', sourceTitle: null, matchQuality: 0 };

function reply(payload: unknown) {
  return { ok: true, json: async () => ({ output_text: JSON.stringify(payload) }) };
}

async function post(name: string) {
  const { POST } = await import('./route');
  const req = { json: async () => ({ name }) } as unknown as Parameters<typeof POST>[0];
  return (await POST(req)).json();
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  process.env.OPENAI_API_KEY = 'test-key';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const store = await import('@/lib/corroboration-store');
  store.__clearMemoryCache();
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('the three states are distinct', () => {
  it('corroborates the Acora QRC-2 from its first-party page', async () => {
    fetchMock.mockResolvedValue(reply(GOOD));
    const r = await post(ACORA);
    expect(r.status).toBe('corroborated');
    expect(r.canonicalName).toBe('Acora Acoustics QRC-2');
    expect(r.sourceUrl).toBe('https://www.acoraacoustics.com/qrc-2');
  });

  it('reports a completed-but-unverified lookup as uncorroborated', async () => {
    fetchMock.mockResolvedValue(reply(NOT_FOUND));
    expect((await post('Qwibble Q1')).status).toBe('uncorroborated');
  });

  it('reports a timeout as lookup_unknown, never as uncorroborated', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const r = await post(ACORA);
    expect(r.status).toBe('lookup_unknown');
    expect(r.status).not.toBe('uncorroborated');
  });

  it('reports an unparseable reply as lookup_unknown', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ output_text: 'not json at all' }) });
    expect((await post(ACORA)).status).toBe('lookup_unknown');
  });

  it('reports a missing API key as lookup_unknown', async () => {
    delete process.env.OPENAI_API_KEY;
    expect((await post(ACORA)).status).toBe('lookup_unknown');
  });
});

describe('THE REAL-USER CASE — first call fails, retry succeeds', () => {
  it('retries a malformed source and corroborates on the second attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(MALFORMED))
      .mockResolvedValueOnce(reply(GOOD));

    const r = await post(ACORA);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.status).toBe('corroborated');
    expect(r.attempts).toBe(2);
    // The listener's loudspeaker is identified. Nothing downstream may now say
    // it is unknown, and nothing may ask them to describe it.
    expect(r.canonicalName).toBe('Acora Acoustics QRC-2');
  });

  it('retries an upstream error', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'upstream down' })
      .mockResolvedValueOnce(reply(GOOD));
    expect((await post(ACORA)).status).toBe('corroborated');
  });

  it('still refuses to call a persistent malformed source uncorroborated', async () => {
    fetchMock.mockResolvedValue(reply(MALFORMED));
    const r = await post(ACORA);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.status).toBe('lookup_unknown');
  });

  it('does NOT retry a genuine uncorroborated finding', async () => {
    // Retrying a completed finding until it changes its mind would turn a
    // verification gate into a slot machine.
    fetchMock.mockResolvedValue(reply(NOT_FOUND));
    await post('Qwibble Q1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('caching stores evidence and never stores failure', () => {
  it('serves a corroborated result from cache without a second lookup', async () => {
    fetchMock.mockResolvedValue(reply(GOOD));
    await post(ACORA);
    const second = await post(ACORA);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.cached).toBe(true);
    expect(second.status).toBe('corroborated');
  });

  it('caches a genuine uncorroborated finding', async () => {
    fetchMock.mockResolvedValue(reply(NOT_FOUND));
    await post('Qwibble Q1');
    const second = await post('Qwibble Q1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.cached).toBe(true);
  });

  it('NEVER caches lookup_unknown — the next turn tries again', async () => {
    // The defect this whole repair exists to prevent: one bad minute becoming
    // two weeks of telling a listener their loudspeaker cannot be identified.
    fetchMock.mockRejectedValue(new Error('network down'));
    await post(ACORA);
    expect(fetchMock).toHaveBeenCalledTimes(2);   // both attempts

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(reply(GOOD));
    const recovered = await post(ACORA);
    expect(recovered.cached).toBeUndefined();
    expect(recovered.status).toBe('corroborated');
  });

  it('recovers the real-user case from cache after one good lookup', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    expect((await post(ACORA)).status).toBe('lookup_unknown');

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(reply(GOOD));
    expect((await post(ACORA)).status).toBe('corroborated');

    fetchMock.mockReset();
    const cachedHit = await post(ACORA);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cachedHit.status).toBe('corroborated');
    expect(cachedHit.canonicalName).toBe('Acora Acoustics QRC-2');
  });
});
