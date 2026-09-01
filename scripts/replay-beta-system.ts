/**
 * Replay the beta system against production and report the FULL evidence path.
 *
 * Written because the previous ad-hoc harness recorded only the resulting
 * basis. When one replay showed three components at `user`, there was no way
 * to tell whether corroboration had returned `uncorroborated` (a finding about
 * the products) or `lookup_unknown` (a failure of our request) — two different
 * causes with two different fixes, and the distinction had already been the
 * whole point of an earlier repair.
 *
 * Every component now records its corroboration status, its cache tier, the
 * store's own health, and the basis that follows. Read-only: it calls the
 * production API and the local copy of the reasoning modules, and writes
 * nothing.
 *
 *   npx tsx scripts/replay-beta-system.ts [runs]
 */
const PROD = 'https://audio-xx.com';
const realFetch = globalThis.fetch;
globalThis.fetch = (async (u: any, i?: any) =>
  realFetch(String(u).startsWith('/') ? PROD + String(u) : u, i)) as typeof fetch;

import { buildSystemAssessment } from '../apps/web/src/lib/consultation';
import { extractSubjectMatches } from '../apps/web/src/lib/intent';
import { inferProvisionalSystemAssessment, computeComponentProvenance }
  from '../apps/web/src/lib/llm-system-inference';
import { tierFor } from '../apps/web/src/lib/entity-corroboration';

const QUERY = 'Assess my system: Pre-amp: ARC ref 5 Amps: Butler Monads '
  + 'Dac/Streamer: dCS Rossini Apex Speakers: Acora QRC-2';
const CHAIN = ['dac', 'preamplifier', 'amplifier', 'speaker'];
const EXPECTED: Record<string, string> = {
  'dCS Rossini Apex': 'brand',
  'ARC ref 5': 'model',
  'Butler Monads': 'model',
  'Acora QRC-2': 'model',
};
/** Prose that contradicts an evidence state where the component IS identified. */
const CONTRADICTION =
  /\b(?:unknown|unidentified|unverified|not identified|cannot be assessed until|indeterminate due to)\b/i;

async function lookup(name: string) {
  try {
    const r = await fetch('/api/corroborate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const j: any = await r.json();
    return { name, status: j.status as string, tier: (j.cacheTier ?? '-') as string,
      store: (j.store ?? '-') as string, storeDetail: j.storeDetail as string | undefined };
  } catch (e) {
    return { name, status: 'lookup_unknown', tier: 'exception', store: 'exception',
      storeDetail: String(e).slice(0, 120) };
  }
}

(async () => {
  const runs = Number(process.argv[2] ?? 5);
  const seen: string[] = [];
  let last: any = null;
  let storeDetailSeen: string | undefined;

  for (let run = 1; run <= runs; run++) {
    const res: any = buildSystemAssessment(
      QUERY, extractSubjectMatches(QUERY), undefined, undefined, undefined);
    const ordered = [...res.components].sort(
      (a: any, b: any) => CHAIN.indexOf(a.role) - CHAIN.indexOf(b.role));
    const names = ordered.map((c: any) => c.displayName);
    const known = res.components
      .filter((c: any) => c.product || c.brandProfile)
      .map((c: any) => ({ name: c.displayName, character: c.character,
        source: (c.product ? 'product' : 'brand') as 'product' | 'brand' }));
    const unresolved = ordered
      .filter((c: any) => c.unresolved || (!c.product && !c.brandProfile))
      .map((c: any) => ({ name: c.displayName, role: c.role }));

    const results = await Promise.all(unresolved.map((u: any) => lookup(u.name)));
    storeDetailSeen ??= results.find((r) => r.storeDetail)?.storeDetail;
    const corroborated = results.filter((r) => r.status === 'corroborated').map((r) => r.name);
    const incomplete = results
      .filter((r) => r.status !== 'corroborated' && r.status !== 'uncorroborated')
      .map((r) => r.name);

    const pre = computeComponentProvenance(
      names, known.map((k: any) => ({ name: k.name, source: k.source })), corroborated);
    const provisional: any = await inferProvisionalSystemAssessment(
      res.query, names, known, unresolved, corroborated, incomplete);

    const corrSet = new Set(corroborated.map((c) => c.toLowerCase().trim()));
    const rendered = ordered.map((c: any) => ({
      name: c.displayName,
      basis: tierFor(!!c.product, !!c.brandProfile,
        corrSet.has(c.displayName.toLowerCase().trim()) ? 'corroborated' : 'uncorroborated'),
    }));

    const basisMap = Object.fromEntries(pre.map((p: any) => [p.name, p.basis]));
    const prose = [provisional?.systemSignature, provisional?.philosophy, provisional?.tendencies]
      .filter(Boolean).join('\n');
    // A contradiction only counts where the evidence says the component IS
    // identified. Saying "unverified" about a genuinely unverified product is
    // correct behaviour, not a defect.
    const identified = pre.filter((p: any) => p.basis !== 'user').map((p: any) => p.name);
    const contradictions = prose.split(/(?<=[.!?])\s+/).filter((sentence) =>
      CONTRADICTION.test(sentence) && identified.some((n: string) =>
        n.split(/\s+/).some((t) => t.length >= 3 && sentence.includes(t))));

    console.log('─'.repeat(74));
    console.log(`RUN ${run}`);
    for (const c of ordered) {
      const r = results.find((x) => x.name === c.displayName);
      console.log(`  ${c.displayName.padEnd(18)} status=${(r?.status ?? 'curated').padEnd(15)}`
        + ` tier=${(r?.tier ?? '-').padEnd(14)} basis=${basisMap[c.displayName]}`);
    }
    console.log(`  store=${results[0]?.store}`
      + `  | expected basis: ${JSON.stringify(basisMap) === JSON.stringify(EXPECTED) ? 'MATCH' : '*** MISMATCH ***'}`
      + `  | pre==rendered: ${JSON.stringify(pre) === JSON.stringify(rendered) ? 'YES' : '*** NO ***'}`);
    console.log(`  verdict=${provisional?.actionVerdict}`
      + `  | contradictions: ${contradictions.length || 'none'}`);
    contradictions.forEach((c) => console.log('     !', c.trim().slice(0, 140)));

    seen.push(JSON.stringify(basisMap));
    last = provisional;
  }

  console.log('\n' + '='.repeat(74));
  console.log(`STABILITY across ${runs} runs: `
    + (new Set(seen).size === 1 ? 'IDENTICAL' : `*** ${new Set(seen).size} DISTINCT STATES ***`));
  if (storeDetailSeen) console.log(`STORE DETAIL: ${storeDetailSeen}`);
  console.log('\n=== FINAL ASSESSMENT ===');
  for (const k of ['systemSignature', 'philosophy', 'tendencies']) {
    console.log(`\n[${k}]\n${last?.[k] ?? '—'}`);
  }
  console.log(`\n[question]\n${last?.nextQuestion ?? last?.followUp ?? '—'}`);
})();
