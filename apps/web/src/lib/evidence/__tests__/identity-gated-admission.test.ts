/**
 * Identity-gated evidence admission — P1 regression pins (2026-09-18).
 *
 * The incident: the REF 330M tube complement, harvested by a web search for
 * the unresolved user string "ARC ref", was cached under that raw key and
 * rendered on Nathan's preamplifier card, and the initial assessment
 * reasoned from it. The doctrine now enforced at both boundaries:
 *
 *     NO SUFFICIENTLY ESTABLISHED PRODUCT IDENTITY
 *     → NO EXACT-PRODUCT FACT ADMISSION.
 *
 * Established = catalog product, curated brand anchor, or corroborated
 * name (computeComponentProvenance's lattice minus `user`). String
 * equality of a raw key is not identity. The safe finished state is
 * absence; suppressed rows are quarantined, never deleted, and return on
 * their own if the identity is later established.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { establishedIdentity, identityEstablished } from '../identity-admission';
import { readFacts, __clearFactCache } from '../manufacturer-fact-store';
import { writeCached, __clearMemoryCache } from '@/lib/corroboration-store';
import { buildServerDossiers } from '@/lib/assessment/server-dossiers';
import { POST } from '@/app/api/manufacturer-facts/route';

const NOW = Date.now();

/** Production-shaped contamination: the REF 330M power-amp complement under
 *  the unresolved raw key — the actual P1 row, reconstructed locally. */
const ARC_KEY = 'arc ref';
const REF330M_COMPLEMENT =
  '(6) KT170 Power Output; (1) ECC83 & (1) 6H30 input; (1) 6550 & (1) 6H30 Power Supply';

/** A fabricated unresolved key that exists nowhere else. */
const GHOST_KEY = 'zz phantom amp mk9';
/** A fabricated key we corroborate inside the test. */
const VERIFIED_KEY = 'zz verified amp mk9';

async function seedFact(productKey: string, field: string, value: string, sourceHost: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ManufacturerFactV1"
       ("productKey","field","value","sourceUrl","quotedText","retrievedAt")
     VALUES (?,?,?,?,?,?)
     ON CONFLICT("productKey","field") DO UPDATE SET
       "value"=excluded."value","sourceUrl"=excluded."sourceUrl",
       "quotedText"=excluded."quotedText","retrievedAt"=excluded."retrievedAt"`,
    productKey, field, value,
    `https://${sourceHost}/product`, `SPEC: ${value}`, String(NOW),
  );
}

async function removeSeeded() {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "ManufacturerFactV1" WHERE "productKey" IN (?,?,?)`,
    ARC_KEY, GHOST_KEY, VERIFIED_KEY);
  await prisma.$executeRawUnsafe(
    `DELETE FROM "CorroborationCacheV2" WHERE "normalizedName" IN (?,?)`,
    GHOST_KEY, VERIFIED_KEY);
}

beforeAll(async () => {
  await removeSeeded();
  // The reproducer row. Source host chosen exactly as production holds it:
  // audioresearch.com passes the substring first-party test for "arc"
  // (…reseARCh…), which is why the first-party read filter never caught it.
  await seedFact(ARC_KEY, 'tube_complement', REF330M_COMPLEMENT, 'audioresearch.com');
  await seedFact(GHOST_KEY, 'power_output', '100W into 8 ohms', 'zzphantom.com');
  await seedFact(VERIFIED_KEY, 'power_output', '55W into 8 ohms', 'zzverified.com');
  __clearFactCache();
  __clearMemoryCache();
});

afterAll(async () => {
  await removeSeeded();
  __clearFactCache();
  __clearMemoryCache();
});

describe('identity admission — the lattice', () => {
  it('user-description-only identity is not established ("ARC ref")', async () => {
    expect(await establishedIdentity('ARC ref')).toBeNull();
  });

  it('ambiguous/uncorroborated and never-looked-up identities are not established', async () => {
    // 'dynaco a35' holds a durable negative answer; the ghost has nothing.
    expect(await establishedIdentity('dynaco a35')).toBeNull();
    expect(await establishedIdentity(GHOST_KEY)).toBeNull();
  });

  it('catalog identity is established', async () => {
    expect((await establishedIdentity('JOB INTegrated'))?.basis).toBe('catalog');
    expect((await establishedIdentity('Chord Hugo'))?.basis).toBe('catalog');
  });

  it('curated brand anchor is established; a bare brand name alone is not', async () => {
    expect((await establishedIdentity('dCS Rossini Apex'))?.basis).toBe('brand');
    expect((await establishedIdentity('Accuphase E-600'))?.basis).toBe('brand');
    // No model tokens after the brand → not a product identity.
    expect(await establishedIdentity('Accuphase')).not.toEqual({ basis: 'brand' });
  });

  it('corroborated alias resolution still works', async () => {
    const e = await establishedIdentity('ARC Reference 5');
    expect(e?.basis).toBe('corroborated');
    expect(e?.canonicalName).toMatch(/Reference 5/);
  });
});

describe('read-time defense — stale rows under unresolved keys are inert', () => {
  it('the ARC ref reproducer row does not read back', async () => {
    __clearFactCache();
    const facts = await readFacts(ARC_KEY, NOW);
    expect(facts).toEqual([]);
  });

  it('an unresolved ghost key with a held row reads back empty', async () => {
    __clearFactCache();
    expect(await readFacts(GHOST_KEY, NOW)).toEqual([]);
  });

  it('no silent nearest-model substitution: "arc ref" never returns "arc ref 5" facts', async () => {
    __clearFactCache();
    const facts = await readFacts(ARC_KEY, NOW);
    expect(facts).toEqual([]);
    // And the resolved sibling's own facts remain its own.
    const ref5 = await readFacts('arc reference 5', NOW);
    for (const f of ref5) expect(f.productKey).toBe('arc reference 5');
  });

  it('a corroborated identity exposes its legitimate facts', async () => {
    await writeCached({
      normalizedName: VERIFIED_KEY, status: 'corroborated',
      canonicalName: 'ZZ Verified Amp Mk9', brand: 'ZZ',
      sourceUrl: 'https://zzverified.com/mk9', sourceKind: 'manufacturer',
      matchQuality: 0.9, checkedAt: NOW,
    });
    __clearFactCache();
    const facts = await readFacts(VERIFIED_KEY, NOW);
    expect(facts.map((f) => f.field)).toContain('power_output');
  });

  it('resolved products with real evidence are not overblocked (regression)', async () => {
    __clearFactCache();
    // Corroborated exact identity.
    expect((await readFacts('arc reference 5', NOW)).length).toBeGreaterThan(0);
    // Brand-anchored identity (never corroborated by design).
    expect((await readFacts('dcs rossini apex', NOW)).length).toBeGreaterThan(0);
  });
});

describe('write-time defense — acquisition refuses unestablished identity', () => {
  const post = (body: unknown) => POST(new NextRequest('http://localhost/api/manufacturer-facts', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }));

  it('acquisition for an unresolved name is refused server-side (no web search, no write)', async () => {
    __clearFactCache();
    const res = await post({ name: 'ARC ref' });
    const j = await res.json();
    expect(j.status).toBe('none');
    expect(j.identity).toBe('not_established');
    expect(j.facts).toEqual([]);
  });

  it("mode:'read' is honored as read-only — the flag mismatch that defeated the eligibility filter is closed", async () => {
    __clearFactCache();
    const res = await post({ name: GHOST_KEY, mode: 'read' });
    const j = await res.json();
    // Read completed, nothing exposed, and no acquisition occurred
    // (an acquisition would have reported attempts / identity refusal).
    expect(j.status).toBe('none');
    expect(j.facts).toEqual([]);
  });
});

describe('downstream — suppressed facts reach neither dossiers nor reasoning', () => {
  it('an unresolved component keeps its card, without manufactured specifications', async () => {
    __clearFactCache();
    const [dossier] = await buildServerDossiers([{ name: 'ARC ref', role: 'preamplifier' }]);
    expect(dossier).toBeDefined();
    const rendered = JSON.stringify(dossier);
    expect(rendered).not.toContain('KT170');
    expect(rendered).not.toContain(REF330M_COMPLEMENT);
  });

  it('legitimate family/reference evidence under an established identity is untouched (JOB / France II)', async () => {
    __clearFactCache();
    const [dossier] = await buildServerDossiers([{ name: 'JOB INTegrated', role: 'amplifier' }]);
    const rendered = JSON.stringify(dossier);
    // The maker-confirmed JOB 225 circuit-family bridge, with its explicit
    // qualifier, still reaches the dossier (authored evidence path).
    expect(rendered).toContain('JOB 225');
    expect(rendered).toMatch(/circuit|equivalent/i);
  });

  it('the reasoning substrate reads facts only through the gated store', () => {
    // Structural pin: readFacts is the single chokepoint. No module outside
    // the store may query the fact table directly.
    const { readFileSync, readdirSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const root = join(__dirname, '..', '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(p); continue; }
        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
        if (p.endsWith('manufacturer-fact-store.ts')) continue;
        if (p.includes('__tests__')) continue;
        if (readFileSync(p, 'utf8').includes('FROM "ManufacturerFactV1"')) offenders.push(p);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });

  it('identityEstablished agrees with establishedIdentity', async () => {
    expect(await identityEstablished('ARC ref')).toBe(false);
    expect(await identityEstablished('Chord Hugo')).toBe(true);
  });
});
