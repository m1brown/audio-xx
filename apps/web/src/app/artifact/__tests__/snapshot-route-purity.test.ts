import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The artifact routes must be incapable of reassessing.
 *
 * The runtime proofs elsewhere rig the reasoning entry points to throw. This
 * is the structural half: a route that never IMPORTS reasoning cannot call it,
 * however it is later edited. Nathan's assessment took a whole pass to reach
 * the artifact surface precisely because the route owned a pipeline of its own.
 */
const ROOT = join(process.cwd(), 'apps/web/src');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const importsOf = (src: string) =>
  [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);

/** Anything that could recognise a product or produce an assessment. */
const REASONING = [
  '@/lib/consultation', '@/lib/intent', '@/lib/llm-system-inference',
  '@/product/assessment-pipeline', '@/lib/artifact/synthesizeArtifact',
  '@/lib/relational-explain', '@/lib/evidence/',
];

const RENDER_ONLY = [
  'app/artifact/[id]/page.tsx',
  'app/artifact/s/[token]/page.tsx',
  'app/artifact/SnapshotArtifact.tsx',
  'product/assessment-snapshot.ts',
  'product/snapshot-port-prisma.ts',
  'lib/artifact/snapshot.ts',
];

describe('render-only routes cannot reach reasoning', () => {
  for (const file of RENDER_ONLY) {
    it(`${file} imports no reasoning module`, () => {
      expect(existsSync(join(ROOT, file)), `${file} missing`).toBe(true);
      const offenders = importsOf(read(file))
        .filter((i) => REASONING.some((r) => i.startsWith(r)));
      expect(offenders).toEqual([]);
    });
  }

  it('the private route resolves by view token only', () => {
    const src = read('app/artifact/[id]/page.tsx');
    expect(src).toMatch(/readForView/);
    expect(src).not.toMatch(/readForShare|runArtifactPipeline|searchParams/);
  });

  it('the public route resolves by share token only', () => {
    const src = read('app/artifact/s/[token]/page.tsx');
    expect(src).toMatch(/readForShare/);
    expect(src).not.toMatch(/readForView|runArtifactPipeline/);
  });

  it('the private route is not indexed and carries no share metadata', () => {
    // Printing must not publish. A route the crawler indexes is published.
    const src = read('app/artifact/[id]/page.tsx');
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(src).not.toMatch(/openGraph/);
  });

  it('neither route can mint a share token', () => {
    for (const f of ['app/artifact/[id]/page.tsx', 'app/artifact/s/[token]/page.tsx']) {
      expect(read(f), f).not.toMatch(/\bshare\s*\(|setShareToken|newToken/);
    }
  });

  it('the snapshot never carries the engine input back to a route', () => {
    expect(read('lib/artifact/snapshot.ts')).not.toMatch(/systemText/);
  });
});

describe('the legacy input route is demoted, not canonical', () => {
  const legacy = read('app/artifact/page.tsx');

  it('is marked deprecated where a developer will see it', () => {
    expect(legacy).toMatch(/@deprecated LEGACY generate-from-input route/);
    expect(legacy).toMatch(/RE-ASSESSES rather than rendering/);
  });

  it('names the canonical route so it is not reused by accident', () => {
    expect(legacy).toMatch(/\/artifact\/\[viewToken\]/);
    expect(legacy).toMatch(/Print, Share and View Assessment must never route here/);
  });

  it('still re-runs the engine — which is exactly why it is not canonical', () => {
    expect(importsOf(legacy)).toContain('@/product/assessment-pipeline');
  });
});
