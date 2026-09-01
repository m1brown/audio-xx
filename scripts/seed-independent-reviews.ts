/**
 * Seed independent-review evidence for named products.
 *
 * OUT OF BAND, deliberately. Independent reviews are site-level product
 * knowledge, so acquisition is a seeding concern rather than something a
 * listener waits for: four search-backed calls do not belong inside an
 * assessment turn. Assessments read what this has already stored.
 *
 *   npx tsx scripts/seed-independent-reviews.ts "dCS Rossini APEX" "…"
 *
 * Identity must be CANONICAL — the designation a publication would use.
 * Listener shorthand ("ARC ref 5") shares no identifying tokens with the real
 * name and would be rejected against its own review.
 */
const PROD = 'https://audio-xx.com';
const realFetch = globalThis.fetch;

const productKeyFor = (name: string) =>
  name.toLowerCase().replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const products = process.argv.slice(2);
  if (products.length === 0) {
    console.error('usage: seed-independent-reviews.ts "<canonical product name>" …');
    process.exit(1);
  }

  for (const name of products) {
    const started = Date.now();
    try {
      const res = await realFetch(`${PROD}/api/independent-reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, productKey: productKeyFor(name), mode: 'acquire' }),
      });
      const json = await res.json();
      const took = Date.now() - started;

      console.log('='.repeat(74));
      console.log(`${name}  ->  ${json.status}  (${took}ms)`);

      for (const o of json.observations ?? []) {
        console.log(`  ADMITTED  [${o.observationType}] ${o.publication}`
          + `${o.reviewer ? ` / ${o.reviewer}` : ''}`);
        console.log(`            product: ${o.productName}`);
        console.log(`            claim:   ${o.claim}`);
        if (o.condition) {
          console.log(`            COND:    ${o.condition.kind} — ${o.condition.description}`);
        }
        if (o.axis) console.log(`            axis:    ${o.axis} = ${o.direction}`);
        console.log(`            source:  ${o.sourceUrl}`);
      }
      for (const r of json.rejected ?? []) {
        console.log(`  REJECTED  ${r.reason}`
          + `${r.productName ? ` — ${r.productName}` : ''}`
          + `${r.detail ? ` (${r.detail})` : ''}`);
      }
      if ((json.observations ?? []).length === 0 && (json.rejected ?? []).length === 0) {
        console.log('  (no candidates returned — zero approved coverage)');
      }
    } catch (err) {
      console.log(`${name}  ->  ERROR  ${String(err).slice(0, 160)}`);
    }
  }
})();
