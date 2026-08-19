/**
 * Durable store for independent-review observations.
 *
 * SLICE 2: storage only. No acquisition, no retrieval consumption, no D-12
 * use, no UI.
 *
 * Its OWN store, separate from manufacturer facts. They share the
 * `EvidenceItem` consumption shape and nothing below it: a maker states what
 * they built, a reviewer states what they heard, and the two regimes have
 * different admission rules, different revalidation needs and different
 * failure modes. One table would let one regime's governance drift into the
 * other's.
 *
 * Three rules, two of them learned the hard way elsewhere in this codebase:
 *
 *   ONLY EVIDENCE IS STORED. Nothing synthetic. A product with no approved
 *   coverage produces no row, because "we looked and found nothing" is a
 *   finding held by the acquisition layer, not a row here.
 *
 *   STORAGE FAILURE IS NEVER AN ANSWER. Every path degrades to the in-process
 *   cache and then to absence. Absence is a state the licensing layer already
 *   handles; a database error must never become an evidentiary claim.
 *
 *   RULES APPLY ON READ AS WELL AS WRITE. The manufacturer store shipped a
 *   first-party fix that production ignored, because rows admitted under the
 *   older policy were already cached. Publication approval is therefore
 *   re-checked on the way out: if a publication ever leaves the whitelist, its
 *   observations stop being served without a migration or a deletion.
 */

import { prisma } from '../prisma';
import { isWhitelistedSource } from './source-whitelist';
import type {
  ReviewObservation, ObservationType, ObservationCondition,
} from './independent-review';

/** A published review does not change; the paraphrase is revalidated. */
export const OBSERVATION_TTL_MS = 180 * 24 * 60 * 60 * 1000;

const memory = new Map<string, ReviewObservation[]>();
let ensured: Promise<boolean> | null = null;

export type ReviewStoreState =
  | 'unqueried' | 'durable_ok' | 'no_client' | 'ddl_failed' | 'read_failed' | 'write_failed';
let storeState: ReviewStoreState = 'unqueried';

export function getReviewStoreState(): ReviewStoreState { return storeState; }

/**
 * The identity of one observation.
 *
 * Idempotency without merging. Re-running acquisition over the same article
 * must not multiply rows, and two genuinely different observations must never
 * collapse into one — which is why every field that could distinguish them is
 * in the key:
 *
 *   productKey        the same sentence about a different product is different
 *                     evidence, and exact-variant separation depends on it
 *   publication       two publications agreeing are two observations, not one
 *   sourceUrl         a follow-up article is a separate source
 *   observationType   a measurement and a listening note are different claims
 *   claim             several observations come from one review
 *   condition         "glorious" and "glorious after 500 hours" are NOT the
 *                     same claim, and collapsing them would erase the licence
 *
 * `reviewer` and `quote` are deliberately absent: re-acquisition may attribute
 * a byline it missed before, or add a quotation, and neither makes it a new
 * observation. Those fields update in place.
 */
export function observationId(o: {
  productKey: string; publication: string; sourceUrl: string;
  observationType: ObservationType; claim: string; condition?: ObservationCondition;
}): string {
  const norm = (v: string) => (v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const parts = [
    norm(o.productKey), norm(o.publication), norm(o.sourceUrl),
    o.observationType, norm(o.claim),
    o.condition ? `${o.condition.kind}:${norm(o.condition.description)}` : '',
  ].join(' ');
  // FNV-1a. Deterministic and dependency-free; this is a dedup key rather
  // than a security boundary.
  let h = 0x811c9dc5;
  for (let i = 0; i < parts.length; i++) {
    h ^= parts.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${norm(o.publication).replace(/[^a-z0-9]/g, '')}-${h.toString(16)}`;
}

async function ensureTable(): Promise<boolean> {
  if (!prisma) { storeState = 'no_client'; return false; }
  if (!ensured) {
    ensured = (async () => {
      try {
        // Dates are TEXT throughout. The corroboration store established what
        // a JS number does to an integer column through the libSQL adapter:
        // writes succeed and every read of a written row fails.
        await prisma!.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "IndependentReviewV1" (
            "observationId"    TEXT PRIMARY KEY,
            "productKey"       TEXT NOT NULL,
            "productName"      TEXT NOT NULL,
            "publication"      TEXT NOT NULL,
            "reviewer"         TEXT,
            "sourceUrl"        TEXT NOT NULL,
            "publishedAt"      TEXT,
            "observationType"  TEXT NOT NULL,
            "claim"            TEXT NOT NULL,
            "quote"            TEXT,
            "axis"             TEXT,
            "direction"        TEXT,
            "conditionKind"    TEXT,
            "conditionText"    TEXT,
            "retrievedAt"      TEXT NOT NULL
          )
        `);
        storeState = 'durable_ok';
        return true;
      } catch (err) {
        storeState = 'ddl_failed';
        console.warn('[independent-review] table unavailable, memory only: %s',
          String(err).slice(0, 160));
        return false;
      }
    })();
  }
  return ensured;
}

function rowToObservation(row: Record<string, unknown>): ReviewObservation {
  const kind = row.conditionKind as ObservationCondition['kind'] | null;
  return {
    productKey: String(row.productKey),
    productName: String(row.productName),
    publication: String(row.publication),
    reviewer: (row.reviewer as string) ?? undefined,
    sourceUrl: String(row.sourceUrl),
    publishedAt: (row.publishedAt as string) ?? undefined,
    observationType: String(row.observationType) as ObservationType,
    claim: String(row.claim),
    quote: (row.quote as string) ?? undefined,
    axis: (row.axis as string) ?? undefined,
    direction: (row.direction as string) ?? undefined,
    condition: kind ? { kind, description: String(row.conditionText ?? '') } : undefined,
    retrievedAt: Number(row.retrievedAt),
  };
}

/**
 * Observations held for a product. Never throws; absence is a valid answer.
 *
 * Publication approval is re-checked here, not only at admission — see the
 * header. A row whose publication has since left the whitelist stops being
 * served, without a migration.
 */
export async function readObservations(
  productKey: string,
  now: number,
): Promise<ReviewObservation[]> {
  const fresh = (o: ReviewObservation) =>
    Number.isFinite(o.retrievedAt)
    && now - o.retrievedAt < OBSERVATION_TTL_MS
    && isWhitelistedSource(o.publication);

  const local = memory.get(productKey);
  if (local) return local.filter(fresh);

  if (!(await ensureTable())) return [];
  try {
    const rows = await prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "IndependentReviewV1" WHERE "productKey" = ?`, productKey,
    );
    const items = (rows ?? []).map(rowToObservation).filter(fresh);
    if (items.length > 0) memory.set(productKey, items);
    return items;
  } catch (err) {
    storeState = 'read_failed';
    console.warn('[independent-review] read failed: %s', String(err).slice(0, 160));
    return [];
  }
}

/**
 * Persist observations idempotently. Never throws.
 *
 * Writing an empty list is a no-op: a product with no approved coverage
 * produces no row, and there is no "we found nothing" record here to be
 * mistaken for evidence later.
 */
export async function writeObservations(observations: ReviewObservation[]): Promise<void> {
  // Defensive, matching the read side. Admission rejects a non-approved
  // publication upstream; this makes it impossible for one to reach storage
  // even if a future caller forgets to check. 6moons cannot be written.
  const admissible = observations.filter(
    (o) => o.publication && isWhitelistedSource(o.publication));
  if (admissible.length === 0) return;

  for (const o of admissible) {
    const id = observationId(o);
    const existing = memory.get(o.productKey) ?? [];
    memory.set(o.productKey, [...existing.filter((e) => observationId(e) !== id), o]);
  }

  if (!(await ensureTable())) return;
  for (const o of admissible) {
    try {
      await prisma!.$executeRawUnsafe(
        `INSERT INTO "IndependentReviewV1"
           ("observationId","productKey","productName","publication","reviewer","sourceUrl",
            "publishedAt","observationType","claim","quote","axis","direction",
            "conditionKind","conditionText","retrievedAt")
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT("observationId") DO UPDATE SET
           "reviewer"=excluded."reviewer",
           "quote"=excluded."quote",
           "axis"=excluded."axis",
           "direction"=excluded."direction",
           "publishedAt"=excluded."publishedAt",
           "retrievedAt"=excluded."retrievedAt"`,
        observationId(o), o.productKey, o.productName, o.publication,
        o.reviewer ?? null, o.sourceUrl, o.publishedAt ?? null,
        o.observationType, o.claim, o.quote ?? null,
        o.axis ?? null, o.direction ?? null,
        o.condition?.kind ?? null, o.condition?.description ?? null,
        String(o.retrievedAt),
      );
    } catch (err) {
      storeState = 'write_failed';
      console.warn('[independent-review] write failed: %s', String(err).slice(0, 160));
      return;
    }
  }
}

/** Test seam — in-process tier only. */
export function __clearReviewCache(): void {
  memory.clear();
  ensured = null;
  storeState = 'unqueried';
}
