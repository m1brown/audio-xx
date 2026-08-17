/**
 * Durable cache for entity corroboration.
 *
 * A real listener's loudspeaker was reported as unidentifiable because one
 * lookup failed on one turn. The lookup itself is reliable — probing production
 * directly, "Acora QRC-2" corroborates to acoraacoustics.com every time — but
 * the result lived only in a warm lambda's `Map`, so every cold instance
 * re-rolled the dice on every component.
 *
 * Two rules govern everything here:
 *
 *   1. ONLY EVIDENCE IS STORED. `corroborated` and `uncorroborated` are
 *      findings about a product. `lookup_unknown` is a fact about our request,
 *      and writing it down would turn one bad minute into two weeks of telling
 *      a listener their loudspeaker cannot be identified.
 *
 *   2. STORAGE FAILURE IS NEVER AN ANSWER. Every path here is wrapped: no
 *      database, no table, a timeout, a malformed row — all degrade to the
 *      in-process cache and, failing that, to a live lookup. The store can
 *      make corroboration faster and steadier. It can never make it wrong,
 *      and it can never make a turn fail.
 *
 * The table is created on first use with `CREATE TABLE IF NOT EXISTS` and is
 * read by nothing else in the product, so it is additive and independently
 * droppable.
 */

import { prisma } from './prisma';
import {
  isCacheFresh,
  isCacheable,
  type CorroborationRecord,
  type CorroborationStatus,
  type SourceKind,
} from './entity-corroboration';

/**
 * In-process cache. Retained as the first tier even with the durable store in
 * place: it costs nothing, and it absorbs the repeated lookups inside a single
 * assessment turn without a round trip.
 */
const memory = new Map<string, CorroborationRecord>();

/** One attempt to create the table per process. */
let ensured: Promise<boolean> | null = null;

/**
 * Why the durable tier is or is not working, as a non-secret category.
 *
 * The store degrades silently by design, which is right for safety and useless
 * for diagnosis: production reported `memory` on every request and there was no
 * way to tell a missing client from a rejected DDL statement without guessing.
 * This records the category only — never a URL, credential, or row.
 */
export type StoreState =
  | 'unqueried'
  | 'durable_ok'
  | 'no_client'
  | 'ddl_failed'
  | 'read_failed'
  | 'write_failed';

let storeState: StoreState = 'unqueried';
/** Error constructor name only — no message, which could carry a DSN. */
let storeDetail: string | undefined;

export function getStoreDiagnostics(): { state: StoreState; detail?: string } {
  return { state: storeState, detail: storeDetail };
}

async function ensureTable(): Promise<boolean> {
  if (!prisma) { storeState = 'no_client'; return false; }
  if (!ensured) {
    ensured = (async () => {
      try {
        await prisma!.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CorroborationCache" (
            "normalizedName" TEXT PRIMARY KEY,
            "status"         TEXT NOT NULL,
            "canonicalName"  TEXT,
            "brand"          TEXT,
            "sourceUrl"      TEXT,
            "sourceKind"     TEXT,
            "matchQuality"   REAL,
            "checkedAt"      BIGINT NOT NULL
          )
        `);
        storeState = 'durable_ok';
        return true;
      } catch (err) {
        storeState = 'ddl_failed';
        storeDetail = (err as Error)?.constructor?.name ?? 'Error';
        console.warn('[corroboration-store] table unavailable, memory only: %s',
          String(err).slice(0, 160));
        return false;
      }
    })();
  }
  return ensured;
}

/** Look up a fresh record. Memory first, then durable. Never throws. */
export async function readCached(
  normalizedName: string,
  now: number,
): Promise<{ record: CorroborationRecord; tier: 'memory' | 'durable' } | null> {
  const local = memory.get(normalizedName);
  if (local && isCacheFresh(local, now)) return { record: local, tier: 'memory' };

  if (!(await ensureTable())) return null;
  try {
    const rows = await prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "CorroborationCache" WHERE "normalizedName" = ? LIMIT 1`,
      normalizedName,
    );
    const row = rows?.[0];
    if (!row) return null;

    const record: CorroborationRecord = {
      normalizedName,
      status: String(row.status) as CorroborationStatus,
      canonicalName: (row.canonicalName as string) ?? undefined,
      brand: (row.brand as string) ?? undefined,
      sourceUrl: (row.sourceUrl as string) ?? undefined,
      sourceKind: (row.sourceKind as SourceKind) ?? undefined,
      matchQuality: row.matchQuality == null ? undefined : Number(row.matchQuality),
      checkedAt: Number(row.checkedAt),
    };
    // A stored row that has aged out is not an answer. Returning null sends the
    // caller to a live lookup, which is the revalidation step the long positive
    // TTL assumes.
    if (!isCacheFresh(record, now)) return null;

    memory.set(normalizedName, record);
    return { record, tier: 'durable' };
  } catch (err) {
    storeState = 'read_failed';
    storeDetail = (err as Error)?.constructor?.name ?? 'Error';
    console.warn('[corroboration-store] read failed: %s', String(err).slice(0, 160));
    return null;
  }
}

/**
 * A previously corroborated record, freshness ignored.
 *
 * Used ONLY when a live lookup fails. Existence does not expire: a product
 * verified against its manufacturer six months ago has not become
 * unidentifiable because a request timed out today. Without this, one bad
 * lookup silently demotes a component that Audio XX has already verified —
 * which is the failure this whole layer exists to end, merely deferred by the
 * length of the TTL.
 *
 * Deliberately positive-only. A stale `uncorroborated` is not re-asserted:
 * new gear appears, and the short negative TTL exists precisely so absence is
 * rechecked.
 */
export async function readAnyPositive(
  normalizedName: string,
): Promise<CorroborationRecord | null> {
  const local = memory.get(normalizedName);
  if (local?.status === 'corroborated') return local;

  if (!(await ensureTable())) return null;
  try {
    const rows = await prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "CorroborationCache" WHERE "normalizedName" = ? AND "status" = 'corroborated' LIMIT 1`,
      normalizedName,
    );
    const row = rows?.[0];
    if (!row) return null;
    return {
      normalizedName,
      status: 'corroborated',
      canonicalName: (row.canonicalName as string) ?? undefined,
      brand: (row.brand as string) ?? undefined,
      sourceUrl: (row.sourceUrl as string) ?? undefined,
      sourceKind: (row.sourceKind as SourceKind) ?? undefined,
      matchQuality: row.matchQuality == null ? undefined : Number(row.matchQuality),
      checkedAt: Number(row.checkedAt),
    };
  } catch (err) {
    storeState = 'read_failed';
    storeDetail = (err as Error)?.constructor?.name ?? 'Error';
    return null;
  }
}

/** Persist a record, if and only if it is evidence. Never throws. */
export async function writeCached(record: CorroborationRecord): Promise<void> {
  // The single most important line in this file.
  if (!isCacheable(record)) return;

  memory.set(record.normalizedName, record);

  if (!(await ensureTable())) return;
  try {
    await prisma!.$executeRawUnsafe(
      `INSERT INTO "CorroborationCache"
         ("normalizedName","status","canonicalName","brand","sourceUrl","sourceKind","matchQuality","checkedAt")
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT("normalizedName") DO UPDATE SET
         "status"=excluded."status",
         "canonicalName"=excluded."canonicalName",
         "brand"=excluded."brand",
         "sourceUrl"=excluded."sourceUrl",
         "sourceKind"=excluded."sourceKind",
         "matchQuality"=excluded."matchQuality",
         "checkedAt"=excluded."checkedAt"`,
      record.normalizedName,
      record.status,
      record.canonicalName ?? null,
      record.brand ?? null,
      record.sourceUrl ?? null,
      record.sourceKind ?? null,
      record.matchQuality ?? null,
      record.checkedAt,
    );
  } catch (err) {
    storeState = 'write_failed';
    storeDetail = (err as Error)?.constructor?.name ?? 'Error';
    console.warn('[corroboration-store] write failed: %s', String(err).slice(0, 160));
  }
}

/** Test seam — clears the in-process tier only. */
export function __clearMemoryCache(): void {
  memory.clear();
  ensured = null;
  storeState = 'unqueried';
  storeDetail = undefined;
}
