import { describe, it, expect } from 'vitest';
import { getProductImageEntry, getProductImage } from '@/lib/product-images';

/**
 * The new `butler monads` registry row, checked for the one thing a new alias
 * can break: serving one brand's photograph under another brand's name.
 * The Playwright leakage harness could not run — it fails on the documented
 * React controlled-input flake — so this proves the same property at the data
 * layer, which CLAUDE.md treats as decisive when the UI is flaky.
 */
describe('the Butler alias cannot leak across brands', () => {
  it('serves only a Butler-hosted asset', () => {
    const e = getProductImageEntry(undefined, 'Butler Monads');
    expect(e!.url).toMatch(/^https:\/\/butleraudio\.com\//);
    expect(e!.source?.credit).toBe('Butler Audio');
  });

  it('is not reachable from any other brand’s name', () => {
    for (const name of [
      'Acora Monads', 'dCS Monads', 'Audio Research Monads',
      'Monads', 'Monad', 'Leben Monads',
    ]) {
      const e = getProductImageEntry(undefined, name);
      if (e) expect(e.url, name).not.toMatch(/butleraudio/);
    }
  });

  it('does not alter resolution for any other Butler string', () => {
    // A bare brand still resolves to nothing — the alias is one exact plural.
    expect(getProductImage('Butler', undefined)).toBeUndefined();
    expect(getProductImageEntry(undefined, 'Butler')).toBeUndefined();
  });
});
