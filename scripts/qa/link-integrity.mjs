#!/usr/bin/env node
/**
 * link-integrity.mjs — domain-level liveness check for catalog retailer_links.
 *
 * Extracts every retailer_links URL from apps/web/src/lib/products/*.ts,
 * then checks each unique DOMAIN: DNS lookup + HTTPS request (8s timeout,
 * browser UA). Known bot-blockers answering 403/429 count as ALIVE.
 * Exit 1 listing NXDOMAIN / refused / parked domains; exit 0 otherwise.
 *
 * Usage: node scripts/qa/link-integrity.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup } from 'node:dns/promises';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRODUCTS_DIR = join(REPO, 'apps/web/src/lib/products');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const BOT_BLOCKERS = [
  'ebay', 'audiogon', 'amazon', 'crutchfield', 'cambridgeaudio', 'bhphotovideo',
  'dcsaudio', 'technics', 'jbl', 'wiimhome', 'usaudiomart', 'reverb', 'hifishark',
];
const PARKED_HOSTS = ['hugedomains.com', 'dan.com', 'sedo.com', 'afternic.com'];

function extractDomains() {
  const domains = new Set();
  const entryRe = /\{\s*label:\s*'(?:[^'\\]|\\.)*',\s*url:\s*'((?:[^'\\]|\\.)*)'\s*\}/g;
  for (const file of readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(PRODUCTS_DIR, file), 'utf8');
    for (const m of source.matchAll(entryRe)) {
      try { domains.add(new URL(m[1]).hostname); } catch { domains.add(`INVALID-URL:${m[1]}`); }
    }
  }
  return [...domains].sort();
}

async function probe(host) {
  if (host.startsWith('INVALID-URL:')) return { host, status: 'invalid-url' };
  try { await lookup(host); } catch { return { host, status: 'nxdomain' }; }
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(`https://${host}/`, {
        method, redirect: 'follow', headers: { 'user-agent': UA },
        signal: AbortSignal.timeout(8000),
      });
      const finalHost = new URL(res.url).hostname;
      if (PARKED_HOSTS.some((p) => finalHost === p || finalHost.endsWith(`.${p}`)))
        return { host, status: `parked (-> ${finalHost})` };
      const blocked = BOT_BLOCKERS.some((b) => host.includes(b));
      if (res.ok || (res.status >= 300 && res.status < 400)) return { host, status: 'alive' };
      if (blocked && (res.status === 403 || res.status === 429))
        return { host, status: `alive (bot-blocked ${res.status})` };
      if (res.status >= 400 && res.status < 500) return { host, status: `alive (http ${res.status})` };
      if (method === 'GET') return { host, status: `http ${res.status}` };
    } catch (err) {
      if (method === 'GET') {
        const msg = String(err?.cause?.code || err?.name || err);
        if (msg.includes('ECONNREFUSED')) return { host, status: 'refused' };
        return { host, status: `unreachable (${msg})` };
      }
    }
  }
  return { host, status: 'unknown' };
}

const domains = extractDomains();
console.log(`Checking ${domains.length} unique retailer_links domains...`);
const results = [];
const CONCURRENCY = 8;
for (let i = 0; i < domains.length; i += CONCURRENCY) {
  results.push(...(await Promise.all(domains.slice(i, i + CONCURRENCY).map(probe))));
}

const FATAL = ['nxdomain', 'refused', 'invalid-url'];
const dead = results.filter(
  (r) => FATAL.includes(r.status) || r.status.startsWith('parked'),
);
const flaky = results.filter((r) => r.status.startsWith('unreachable') || r.status.startsWith('http '));

for (const r of results) if (r.status !== 'alive') console.log(`  ${r.host}: ${r.status}`);
console.log(`\n${results.length} domains: ${results.filter((r) => r.status.startsWith('alive')).length} alive, ${dead.length} dead, ${flaky.length} unreachable/other (not fatal — timeouts and TLS oddities happen; investigate if persistent)`);

if (dead.length > 0) {
  console.error(`\nFAIL — dead domains:\n${dead.map((r) => `  ${r.host}: ${r.status}`).join('\n')}`);
  process.exit(1);
}
console.log('PASS — no NXDOMAIN/refused/parked domains.');
