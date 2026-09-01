import { describe, it, expect, vi } from 'vitest';
import {
  createSnapshot, readForView, readForShare, share, newToken,
  type SnapshotPort, type SnapshotRow,
} from '../assessment-snapshot';
import { snapshotFromProvisional, freezeSnapshot } from '@/lib/artifact/snapshot';

/** In-memory port. The access RULES are what is being proved, not Prisma. */
function memoryPort() {
  const rows: SnapshotRow[] = [];
  const port: SnapshotPort = {
    async insert(r) { rows.push({ ...r }); },
    async findByViewToken(t) { return rows.find((r) => r.viewToken === t) ?? null; },
    async findByShareToken(t) { return rows.find((r) => r.shareToken === t) ?? null; },
    async setShareToken(v, s) {
      const r = rows.find((x) => x.viewToken === v);
      if (r) r.shareToken = s;
      return r ?? null;
    },
  };
  return { port, rows };
}

const ASSESSMENT = snapshotFromProvisional({
  systemSignature: 'Published figures put the Butler Monads at 200 watts into 4 ohms.',
  philosophy: 'Audio XX does not hold enough product-specific listening evidence.',
  followUp: 'Are you running into any limit on volume or dynamic range?',
  actionVerdict: 'no_change',
  // The relation the finding above rests on. Without it the licensing gate
  // correctly replaces the verdict — a signature asserting a power figure with
  // no established relationship behind it is exactly what the gate exists to
  // catch. This suite tests ACCESS, so the fixture carries what production
  // carries rather than relying on an unlicensed stub.
  systemRelations: [{
    components: ['Butler Monads', 'Acora QRC-2'],
    axis: 'power_load', kind: 'reinforcement', tier: 'manufacturer',
  }],
}, {
  engineVersion: 'test', createdAt: '2026-08-22T10:00:00.000Z',
  components: [{ name: 'Butler Monads' }, { name: 'Acora QRC-2' }],
});

describe('anonymous listeners are first-class', () => {
  it('creates and prints a snapshot with no account and no system', async () => {
    const { port, rows } = memoryPort();
    const { viewToken } = await createSnapshot(port, ASSESSMENT);
    expect(rows[0].userId).toBeNull();
    expect(rows[0].systemId).toBeNull();

    const printed = await readForView(port, viewToken);
    expect(printed?.verdict).toContain('200 watts into 4 ohms');
  });

  it('attaches ownership when the listener is signed in', async () => {
    const { port, rows } = memoryPort();
    await createSnapshot(port, ASSESSMENT, { userId: 'u_1', systemId: 's_1' });
    expect(rows[0]).toMatchObject({ userId: 'u_1', systemId: 's_1' });
  });
});

describe('creating is not publishing', () => {
  it('mints no share token at creation', async () => {
    const { port, rows } = memoryPort();
    const res = await createSnapshot(port, ASSESSMENT);
    expect(res.shareToken).toBeNull();
    expect(rows[0].shareToken).toBeNull();
  });

  it('a private snapshot is unreachable publicly, by any identifier', async () => {
    const { port, rows } = memoryPort();
    const { viewToken } = await createSnapshot(port, ASSESSMENT);
    // Neither the view token nor the database id opens the public door.
    expect(await readForShare(port, viewToken)).toBeNull();
    expect(await readForShare(port, rows[0].id)).toBeNull();
  });

  it('resists an ID guess: the database id is not a URL', async () => {
    const { port, rows } = memoryPort();
    await createSnapshot(port, ASSESSMENT);
    expect(await readForView(port, rows[0].id)).toBeNull();
    expect(await readForView(port, '')).toBeNull();
    expect(await readForView(port, 'as_guess')).toBeNull();
  });

  it('PRINTING DOES NOT ALTER ACCESS STATE', async () => {
    const { port, rows } = memoryPort();
    const { viewToken } = await createSnapshot(port, ASSESSMENT);
    const before = JSON.stringify(rows[0]);
    for (let i = 0; i < 5; i++) await readForView(port, viewToken);
    expect(JSON.stringify(rows[0])).toBe(before);
    expect(rows[0].shareToken).toBeNull();
    expect(await readForShare(port, viewToken)).toBeNull();
  });
});

describe('Share alone grants public access', () => {
  it('mints the token and opens the public route', async () => {
    const { port } = memoryPort();
    const { viewToken } = await createSnapshot(port, ASSESSMENT);
    const shared = await share(port, viewToken);
    expect(shared?.shareToken).toBeTruthy();
    expect(shared!.shareToken).not.toBe(viewToken);

    const publicView = await readForShare(port, shared!.shareToken);
    expect(publicView?.verdict).toContain('200 watts into 4 ohms');
  });

  it('is idempotent, so a link already given keeps working', async () => {
    const { port } = memoryPort();
    const { viewToken } = await createSnapshot(port, ASSESSMENT);
    const first = await share(port, viewToken);
    const second = await share(port, viewToken);
    expect(second!.shareToken).toBe(first!.shareToken);
  });

  it('the view token still works, and remains distinct from the share token', async () => {
    const { port } = memoryPort();
    const { viewToken } = await createSnapshot(port, ASSESSMENT);
    const { shareToken } = (await share(port, viewToken))!;
    expect(await readForView(port, viewToken)).toBeTruthy();
    expect(await readForView(port, shareToken)).toBeNull();
  });

  it('tokens carry real entropy and are not derived from the row', async () => {
    const seen = new Set(Array.from({ length: 200 }, () => newToken()));
    expect(seen.size).toBe(200);
    expect(newToken()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});

describe('IMMUTABILITY — a shared assessment does not change under us', () => {
  it('survives engine, catalog and licensing changes', async () => {
    const { port, rows } = memoryPort();
    const { viewToken } = await createSnapshot(port, ASSESSMENT);
    const { shareToken } = (await share(port, viewToken))!;
    const asShared = freezeSnapshot((await readForShare(port, shareToken))!);

    // Everything a re-derivation would have consulted, changed underneath.
    vi.resetModules();
    vi.doMock('@/lib/consultation', () => ({
      buildSystemAssessment: () => { throw new Error('REASONING EXECUTED'); },
    }));

    const stillShared = freezeSnapshot((await readForShare(port, shareToken))!);
    expect(stillShared).toBe(asShared);
    // The stored bytes are the assessment; nothing recomputes them.
    expect(rows[0].snapshotJson).toBe(asShared);
    vi.doUnmock('@/lib/consultation');
    vi.resetModules();
  });

  it('records the schema and engine version of the frozen representation', async () => {
    const { port, rows } = memoryPort();
    await createSnapshot(port, ASSESSMENT);
    expect(rows[0].schemaVersion).toBe('axx.assessment.v1');
    expect(rows[0].engineVersion).toBe('test');
  });
});

describe('ZERO REASONING on both private and public reads', () => {
  it('opens either route with every reasoning entry point rigged to throw', async () => {
    vi.resetModules();
    const boom = (n: string) => () => { throw new Error(`REASONING EXECUTED: ${n}`); };
    vi.doMock('@/lib/consultation', () => ({ buildSystemAssessment: boom('buildSystemAssessment') }));
    vi.doMock('@/lib/llm-system-inference', () => ({
      inferProvisionalSystemAssessment: boom('infer'), buildProvisionalPrompt: boom('prompt'),
    }));
    vi.doMock('@/product/assessment-pipeline', () => ({ runArtifactPipeline: boom('pipeline') }));
    vi.doMock('@/lib/evidence/manufacturer-facts', () => ({ physicalFactsFor: boom('facts') }));

    const mod = await import('../assessment-snapshot');
    const { port } = memoryPort();
    const { viewToken } = await mod.createSnapshot(port as never, ASSESSMENT);
    const { shareToken } = (await mod.share(port as never, viewToken))!;

    expect((await mod.readForView(port as never, viewToken))?.verdict)
      .toContain('200 watts into 4 ohms');
    expect((await mod.readForShare(port as never, shareToken))?.verdict)
      .toContain('200 watts into 4 ohms');
    vi.resetModules();
  });
});
