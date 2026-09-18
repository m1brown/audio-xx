/**
 * Suggested Edits — Slice 1 contribution store (capture only).
 *
 * DOCTRINE (approved design, 2026-09-17):
 *   USERS MAY CONTRIBUTE EVIDENCE.
 *   USERS DO NOT DIRECTLY EDIT AUDIO XX KNOWLEDGE.
 *   THE CONTRIBUTOR TELLS US WHERE TO LOOK.
 *   THE SOURCE DETERMINES WHAT AUDIO XX MAY KNOW.
 *
 * A contribution is an INERT PENDING RECORD: the person's words, the
 * surface they were looking at, the identity in play if one was resolved
 * (their own words when it wasn't), and an optional source URL. Nothing
 * here is evidence. Nothing in this module writes to, reads from, or is
 * read by the catalog, the evidence stores, product identity, or the
 * reasoning lane — review and admission belong to a future slice, and the
 * separation is pinned by tests.
 *
 * Storage follows the house pattern for durable tables
 * (manufacturer-fact-store): CREATE TABLE IF NOT EXISTS through the
 * prisma client, TEXT timestamps (the libSQL adapter's number-binding
 * lesson), graceful no-database degradation.
 */
import { prisma } from '../prisma';

export type ContributionReason = 'wrong' | 'missing' | 'wrong_product' | 'owner_info';

export const CONTRIBUTION_REASONS: readonly ContributionReason[] = [
  'wrong', 'missing', 'wrong_product', 'owner_info',
] as const;

export interface ContributionInput {
  /** Where the affordance lived (e.g. 'dossier_card', 'dossier_card_sparse'). */
  surface: string;
  /** Resolved product identity when the surface had one. */
  productKey?: string;
  /** Product name as displayed to the user (for readable review listings). */
  productName?: string;
  /** The user's own words when Audio XX held no confident identity. Never
   *  silently converted into a canonical product — identity work is review's. */
  typedProduct?: string;
  /** The specific spec/evidence line disputed, when the edit came from one. */
  evidenceRef?: string;
  reason: ContributionReason;
  text: string;
  sourceUrl?: string;
}

export interface ContributionRecord extends ContributionInput {
  id: string;
  userId: string;
  createdAt: string;
  status: 'pending';
}

const LIMITS = {
  text: { min: 3, max: 4000 },
  sourceUrl: 1000,
  smallField: 200,
} as const;

/** Pure validation — exported for tests and shared by the route. Returns an
 *  error string, or null when the input is acceptable. */
export function validateContributionInput(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return 'invalid body';
  const b = raw as Record<string, unknown>;
  if (!CONTRIBUTION_REASONS.includes(b.reason as ContributionReason)) return 'invalid reason';
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (text.length < LIMITS.text.min) return 'tell us what you know';
  if (text.length > LIMITS.text.max) return 'text too long';
  if (b.sourceUrl !== undefined && b.sourceUrl !== null && b.sourceUrl !== '') {
    if (typeof b.sourceUrl !== 'string' || b.sourceUrl.length > LIMITS.sourceUrl) return 'invalid source URL';
    try {
      const u = new URL(b.sourceUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'invalid source URL';
    } catch { return 'invalid source URL'; }
  }
  for (const f of ['surface', 'productKey', 'productName', 'typedProduct', 'evidenceRef'] as const) {
    if (b[f] !== undefined && b[f] !== null
      && (typeof b[f] !== 'string' || (b[f] as string).length > LIMITS.smallField)) {
      return `invalid ${f}`;
    }
  }
  if (typeof b.surface !== 'string' || !b.surface.trim()) return 'invalid surface';
  if (!b.productKey && !b.productName && !b.typedProduct) return 'a product reference is required';
  return null;
}

let ensured: Promise<boolean> | null = null;

async function ensureTable(): Promise<boolean> {
  if (!prisma) return false;
  if (!ensured) {
    ensured = (async () => {
      try {
        await prisma!.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "ContributionV1" (
            "id"           TEXT NOT NULL PRIMARY KEY,
            "userId"       TEXT NOT NULL,
            "createdAt"    TEXT NOT NULL,
            "surface"      TEXT NOT NULL,
            "productKey"   TEXT,
            "productName"  TEXT,
            "typedProduct" TEXT,
            "evidenceRef"  TEXT,
            "reason"       TEXT NOT NULL,
            "text"         TEXT NOT NULL,
            "sourceUrl"    TEXT,
            "status"       TEXT NOT NULL DEFAULT 'pending'
          )
        `);
        return true;
      } catch (err) {
        console.warn('[contributions] table unavailable: %s', String(err).slice(0, 160));
        return false;
      }
    })();
  }
  return ensured;
}

export async function writeContribution(
  userId: string,
  input: ContributionInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!(await ensureTable())) return { ok: false, error: 'store unavailable' };
  const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    await prisma!.$executeRawUnsafe(
      `INSERT INTO "ContributionV1"
        ("id","userId","createdAt","surface","productKey","productName","typedProduct","evidenceRef","reason","text","sourceUrl","status")
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending')`,
      id, userId, new Date().toISOString(), input.surface,
      input.productKey ?? null, input.productName ?? null, input.typedProduct ?? null,
      input.evidenceRef ?? null, input.reason, input.text.trim(), input.sourceUrl || null,
    );
    return { ok: true, id };
  } catch (err) {
    console.warn('[contributions] write failed: %s', String(err).slice(0, 160));
    return { ok: false, error: 'write failed' };
  }
}

/** Submissions by this user in the last hour — the whole Slice-1 rate limit. */
export async function recentContributionCount(userId: string): Promise<number> {
  if (!(await ensureTable())) return 0;
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const rows = await prisma!.$queryRawUnsafe<Array<{ n: number | bigint }>>(
      `SELECT COUNT(*) AS n FROM "ContributionV1" WHERE "userId" = ? AND "createdAt" > ?`,
      userId, since,
    );
    return Number(rows?.[0]?.n ?? 0);
  } catch { return 0; }
}

/** Founder review listing (read-only; Slice 1 has no accept/reject writes). */
export async function listContributions(status = 'pending', limit = 100): Promise<ContributionRecord[]> {
  if (!(await ensureTable())) return [];
  try {
    const rows = await prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "ContributionV1" WHERE "status" = ? ORDER BY "createdAt" DESC LIMIT ?`,
      status, limit,
    );
    return rows as unknown as ContributionRecord[];
  } catch { return []; }
}
