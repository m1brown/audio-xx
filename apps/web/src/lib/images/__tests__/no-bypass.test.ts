import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Structural guard: no user-visible image may reach a reader except through
 * the admission boundary.
 *
 * This is not stylistic. Ten call sites wrote `p.imageUrl ?? getProductImage(
 * brand, name)` by hand, which restores the exact bypass the resolvers were
 * changed to close: the catalog URL wins outright and faces neither the
 * identity test nor the provenance test. Fixing the resolvers while that
 * pattern remained in the consumers left the boundary looking convergent and
 * behaving as it had before.
 *
 * The pattern is easy to write and reads as a harmless default, which is
 * exactly why it needs a test rather than a convention.
 */

const SRC = 'apps/web/src/';
const OWNER = 'lib/product-images.ts';
const SNAPSHOT = '__diffsnapshot__';

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === 'node_modules' || e === SNAPSHOT) continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const FILES = walk(SRC)
  .filter((f) => !f.includes('__tests__') && !f.includes('/tests/') && !f.endsWith(OWNER))
  .map((f) => [f, readFileSync(f, 'utf8')] as const);

describe('no path bypasses the admission boundary', () => {
  it('nobody hand-writes `imageUrl ?? getProductImage(...)`', () => {
    const offenders = FILES
      .filter(([, s]) => /imageUrl\s*\?\?\s*(getProductImage|getBrandImage)/.test(s))
      .map(([f]) => f);
    expect(offenders, 'use resolveProductImageStrict(brand, name, catalogImageUrl)').toEqual([]);
  });

  it('nobody reads the raw registry outside its owner', () => {
    const offenders = FILES.filter(([, s]) => s.includes('PRODUCT_IMAGE_URLS')).map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it('the deleted brand-level fallback is not reintroduced', () => {
    const offenders = FILES.filter(([, s]) => /\bgetBrandImage\s*\(/.test(s)).map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it('every resolver in the owning module consults admission', () => {
    const src = readFileSync(join(SRC, OWNER), 'utf8');
    // Each function that can return a user-visible URL must reference the
    // boundary — directly, or by delegating to one that does.
    for (const fn of ['getProductImageEntry', 'getProductImage', 'resolveProductImageWithConfidence']) {
      const body = src.slice(src.indexOf(`export function ${fn}`));
      const end = body.indexOf('\nexport ', 1);
      expect(
        /isDisplayable|admitUnregisteredImage/.test(end > 0 ? body.slice(0, end) : body),
        `${fn} does not consult the admission boundary`,
      ).toBe(true);
    }
    for (const fn of ['resolveProductImage', 'resolveProductImageStrict']) {
      const body = src.slice(src.indexOf(`export function ${fn}(`));
      const end = body.indexOf('\nexport ', 1);
      expect(
        /admitUnregisteredImage/.test(end > 0 ? body.slice(0, end) : body),
        `${fn} passes catalogImageUrl through ungoverned`,
      ).toBe(true);
    }
  });

  it('hasFamilyImagery is used only for shopping-pool mechanics, never to render', () => {
    // It is deliberately loose and must never decide what a reader SEES.
    const callers = FILES.filter(([, s]) => /hasFamilyImagery\s*\(/.test(s)).map(([f]) => f);
    expect(callers).toEqual(['apps/web/src/lib/shopping-intent.ts']);
    const src = readFileSync('apps/web/src/lib/shopping-intent.ts', 'utf8');
    for (const m of src.matchAll(/hasFamilyImagery\s*\([^)]*\)/g)) {
      const line = src.slice(0, m.index).split('\n').length;
      const ctx = src.split('\n').slice(line - 8, line + 2).join('\n');
      // It may only feed a boolean predicate, never an imageUrl assignment.
      expect(/imageUrl\s*[:=]/.test(ctx), `hasFamilyImagery feeds rendering at line ${line}`).toBe(false);
    }
  });
});
