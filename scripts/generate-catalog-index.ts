/**
 * Generates the static catalog typeahead index for the System Builder
 * (MVP M1). Sources the REAL product catalog — the TypeScript modules in
 * apps/web/src/lib/products/ — and writes a small committed JSON that the
 * client bundles directly: no API, no DB, instant suggestions.
 *
 * Run after editing any product module:
 *
 *   npx tsx scripts/generate-catalog-index.ts
 *
 * A sync test (product suite: catalog-index.test.ts) fails when the
 * product modules and the committed index drift.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAC_PRODUCTS } from '../apps/web/src/lib/products/dacs';
import { AMPLIFIER_PRODUCTS } from '../apps/web/src/lib/products/amplifiers';
import { SPEAKER_PRODUCTS } from '../apps/web/src/lib/products/speakers';
import { HEADPHONE_PRODUCTS } from '../apps/web/src/lib/products/headphones';
import { TURNTABLE_PRODUCTS } from '../apps/web/src/lib/products/turntables';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = resolve(root, 'apps/web/src/product/catalog-index.json');

interface IndexEntry { id: string; brand: string; name: string; category: string }

const all = [
  ...DAC_PRODUCTS,
  ...AMPLIFIER_PRODUCTS,
  ...SPEAKER_PRODUCTS,
  ...HEADPHONE_PRODUCTS,
  ...TURNTABLE_PRODUCTS,
] as Array<{ id: string; brand: string; name: string; category: string }>;

const seen = new Set<string>();
const entries: IndexEntry[] = [];
for (const p of all) {
  if (!p?.id || !p.brand || !p.name || !p.category) continue;
  if (seen.has(p.id)) continue;
  seen.add(p.id);
  entries.push({ id: p.id, brand: p.brand, name: p.name, category: p.category });
}
entries.sort((a, b) => (a.brand + ' ' + a.name).localeCompare(b.brand + ' ' + b.name));

writeFileSync(outPath, JSON.stringify(entries, null, 1) + '\n');
console.log(`catalog-index: wrote ${entries.length} entries → ${outPath}`);
