/**
 * Durable store for manufacturer evidence — its OWN store, deliberately.
 *
 * Independent-review evidence will get a separate one. They share a
 * consumption shape (`EvidenceItem`), not a table: different provenance
 * regimes, different admission rules, different revalidation cadence, and
 * merging them would let one regime's governance drift into the other's.
 *
 * Keyed by product identity, never by turn, session or assessment. A fact
 * about the Acora QRC-2 belongs to the QRC-2.
 *
 * Same two rules as the corroboration store, for the same reasons:
 * only admissible evidence is written, and storage failure is never an
 * answer — every path degrades to in-memory and then to absence, and absence
 * is a state the licensing layer already handles correctly.
 */

import { prisma } from '../prisma';
import { isAdmissible, type EvidenceItem, type EvidenceTier } from './evidence-types';
import { isFirstPartySource } from './manufacturer-facts';

/** Facts age slowly; a published specification does not change quietly. */
export const FACT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

const memory = new Map<string, EvidenceItem[]>();
let ensured: Promise<boolean> | null = null;

export type FactStoreState =
  | 'unqueried' | 'durable_ok' | 'no_client' | 'ddl_failed' | 'read_failed' | 'write_failed';
let storeState: FactStoreState = 'unqueried';

export function getFactStoreState(): FactStoreState { return storeState; }

async function ensureTable(): Promise<boolean> {
  if (!prisma) { storeState = 'no_client'; return false; }
  if (!ensured) {
    ensured = (async () => {
      try {
        // `retrievedAt` is TEXT for the reason the corroboration store learned
        // the hard way: a JS number bound into an integer column arrives as
        // REAL through the libSQL adapter and every read of a written row then
        // fails. No numeric conversion in the path at all.
        await prisma!.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "ManufacturerFactV1" (
            "productKey"  TEXT NOT NULL,
            "field"       TEXT NOT NULL,
            "value"       TEXT NOT NULL,
            "sourceUrl"   TEXT NOT NULL,
            "quotedText"  TEXT NOT NULL,
            "retrievedAt" TEXT NOT NULL,
            PRIMARY KEY ("productKey", "field")
          )
        `);
        storeState = 'durable_ok';
        return true;
      } catch (err) {
        storeState = 'ddl_failed';
        console.warn('[manufacturer-facts] table unavailable, memory only: %s',
          String(err).slice(0, 160));
        return false;
      }
    })();
  }
  return ensured;
}

const TIER: EvidenceTier = 'manufacturer';

function rowToItem(productKey: string, row: Record<string, unknown>): EvidenceItem {
  return {
    productKey,
    evidenceClass: 'manufacturer',
    tier: TIER,
    scope: 'product',
    field: String(row.field),
    value: String(row.value),
    attribution: {
      sourceUrl: String(row.sourceUrl),
      quotedText: String(row.quotedText),
    },
    retrievedAt: Number(row.retrievedAt),
  };
}

/** Every fact held for a product. Never throws; absence is a valid answer. */
export async function readFacts(productKey: string, now: number): Promise<EvidenceItem[]> {
  const local = memory.get(productKey);
  if (local) {
    return local.filter((f) => now - f.retrievedAt < FACT_TTL_MS
      && isFirstPartySource(f.attribution?.sourceUrl ?? '', productKey));
  }

  if (!(await ensureTable())) return [];
  try {
    const rows = await prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "ManufacturerFactV1" WHERE "productKey" = ?`, productKey,
    );
    const items = (rows ?? [])
      .map((r) => rowToItem(productKey, r))
      .filter((i) => Number.isFinite(i.retrievedAt) && now - i.retrievedAt < FACT_TTL_MS)
      .filter(isAdmissible)
      // Re-checked on read, not only on write. Rows admitted before the
      // first-party rule existed are still here, and production served
      // manualzz.com specs from cache after the write-side fix landed. This
      // retires them as they are read rather than by deleting anything.
      .filter((i) => isFirstPartySource(i.attribution?.sourceUrl ?? '', productKey));
    if (items.length > 0) memory.set(productKey, items);
    return items;
  } catch (err) {
    storeState = 'read_failed';
    console.warn('[manufacturer-facts] read failed: %s', String(err).slice(0, 160));
    return [];
  }
}

/** Persist admissible facts only. Never throws. */
export async function writeFacts(items: EvidenceItem[]): Promise<void> {
  const admissible = items.filter(isAdmissible);
  if (admissible.length === 0) return;

  const key = admissible[0].productKey;
  memory.set(key, [...(memory.get(key) ?? []).filter(
    (e) => !admissible.some((a) => a.field === e.field)), ...admissible]);

  if (!(await ensureTable())) return;
  for (const item of admissible) {
    try {
      await prisma!.$executeRawUnsafe(
        `INSERT INTO "ManufacturerFactV1"
           ("productKey","field","value","sourceUrl","quotedText","retrievedAt")
         VALUES (?,?,?,?,?,?)
         ON CONFLICT("productKey","field") DO UPDATE SET
           "value"=excluded."value",
           "sourceUrl"=excluded."sourceUrl",
           "quotedText"=excluded."quotedText",
           "retrievedAt"=excluded."retrievedAt"`,
        item.productKey, item.field, item.value,
        item.attribution?.sourceUrl ?? '', item.attribution?.quotedText ?? '',
        String(item.retrievedAt),
      );
    } catch (err) {
      storeState = 'write_failed';
      console.warn('[manufacturer-facts] write failed: %s', String(err).slice(0, 160));
      return;
    }
  }
}

/** Test seam — in-process tier only. */
export function __clearFactCache(): void {
  memory.clear();
  ensured = null;
  storeState = 'unqueried';
}
