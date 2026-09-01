/**
 * Catalog boundary — advisory renderers do not reach into the engine.
 *
 * Locks the result of the first Catalog-layer extraction
 * (`apps/web/src/lib/catalog/lookups.ts`).
 *
 * Rule: every .tsx file under `apps/web/src/components/advisory/` must be
 * free of **runtime** imports from `@/lib/consultation` or
 * `../../lib/consultation`. Renderers are permitted a **type-only** import
 * (`import type { ... } from '@/lib/consultation'`) so existing
 * presentation-shaped types re-exported from consultation.ts (notably
 * `BrandAuthorityPreview`) can continue to be consumed without forcing
 * their relocation in this commit.
 *
 * Why locked here:
 *   - The five catalog-lookup functions
 *     (findBrandProfileByName, findBrandProfileBySlug, findProductsByBrandSlug,
 *      findProductInProse, findProductByComponentName)
 *     moved to `lib/catalog/lookups.ts`. Renderers must consume them from
 *     the Catalog layer, not from the Assessment/consultation layer.
 *   - A future drift back to `@/lib/consultation` would silently re-open
 *     the Presentation → Domain coupling this commit closed.
 *   - This is a file-system grep, not a build-time lint. It runs as part
 *     of the focused vitest bundle, so any regression fails the same
 *     suite that already runs on every change to the advisory tree.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

const ADVISORY_DIR = join(__dirname, '..', '..', 'components', 'advisory');

function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...listTsxFiles(p));
    else if (entry.endsWith('.tsx')) out.push(p);
  }
  return out;
}

// Matches `import { ... } from '...consultation'` but NOT
// `import type { ... } from '...consultation'`. The test allows type-only
// imports (BrandAuthorityPreview is the lone remaining consumer in
// BrandAuthorityPreview.tsx, and it imports the interface as a type).
const RUNTIME_CONSULTATION_IMPORT = /^\s*import\s+(?!type\b)\{[^}]*\}\s+from\s+['"][^'"]*\/lib\/consultation['"]/m;

describe('Catalog boundary — advisory renderers do not import the engine at runtime', () => {
  const files = listTsxFiles(ADVISORY_DIR);

  it('finds the advisory tree (sanity)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.slice(file.indexOf('components/advisory/'));
    it(`${rel} has no runtime import from @/lib/consultation`, () => {
      const src = readFileSync(file, 'utf-8');
      const match = src.match(RUNTIME_CONSULTATION_IMPORT);
      expect(match, match ? `runtime import found: ${match[0]}` : '').toBeNull();
    });
  }
});
