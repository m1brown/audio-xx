/**
 * Beta feedback — founder review listing (read-only).
 *
 *   npx tsx apps/web/src/lib/feedback/review-cli.ts [limit]
 *   (or: node scripts/feedback-review.mjs)
 *
 * Prints beta feedback newest-first. Local dev reads dev.db; against
 * production data, run with the Turso environment variables set as the
 * app itself does (same convention as contributions-review).
 */
import { listFeedback } from './feedback-store';

async function main() {
  const limit = Number(process.argv[2] ?? '200');
  const rows = await listFeedback(limit);
  if (rows.length === 0) {
    console.log('No feedback yet.');
    return;
  }
  console.log(`${rows.length} feedback record(s)\n`);
  for (const r of rows) {
    console.log(`── ${r.id} · ${r.createdAt} · sha ${r.deploySha ?? '?'}`);
    console.log(`   from:     ${r.userEmail ?? '(not signed in)'}`);
    console.log(`   advisory: ${r.advisoryId ?? '(none)'}`);
    console.log(`   helped: ${r.helped ?? '—'} · accurate: ${r.accurate ?? '—'} · would return: ${r.wouldReturn ?? '—'}`);
    if (r.comment) console.log(`   comment:  ${String(r.comment).replace(/\s+/g, ' ')}`);
    console.log('');
  }
}
main();
