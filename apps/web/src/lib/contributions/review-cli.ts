/**
 * Suggested Edits Slice 1 — founder review listing (read-only).
 *
 *   npx tsx apps/web/src/lib/contributions/review-cli.ts [status] [limit]
 *   (or: node scripts/contributions-review.mjs)
 *
 * Prints pending contributions in a readable form. Slice 1 deliberately
 * has NO accept/reject writes: if a contribution proves valuable, the
 * founder uses the existing evidence-authoring path outside this feature.
 * Local dev reads dev.db; against production data, run with the Turso
 * environment variables set as the app itself does.
 */
import { listContributions } from './contribution-store';

async function main() {
  const status = process.argv[2] ?? 'pending';
  const limit = Number(process.argv[3] ?? '100');
  const rows = await listContributions(status, limit);
  if (rows.length === 0) {
    console.log(`No ${status} contributions.`);
    return;
  }
  console.log(`${rows.length} ${status} contribution(s)\n`);
  for (const r of rows) {
    const product = r.productKey ?? r.productName ?? r.typedProduct ?? '(no product reference)';
    const typed = r.typedProduct && r.typedProduct !== product ? ` · typed: "${r.typedProduct}"` : '';
    console.log(`── ${r.id} · ${r.createdAt}`);
    console.log(`   from:    ${r.userId}`);
    console.log(`   product: ${product}${typed}${r.productKey ? '' : '  [identity unresolved]'}`);
    console.log(`   surface: ${r.surface}${r.evidenceRef ? ` · re: ${r.evidenceRef}` : ''}`);
    console.log(`   reason:  ${r.reason}`);
    console.log(`   text:    ${String(r.text).replace(/\s+/g, ' ').slice(0, 500)}`);
    console.log(`   source:  ${r.sourceUrl ?? '(none — lead only; licenses nothing)'}`);
    console.log('');
  }
}
main();
