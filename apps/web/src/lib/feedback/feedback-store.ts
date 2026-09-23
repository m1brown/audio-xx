/**
 * Beta feedback store — the durable half of /api/events.
 *
 * HUMAN BETA REQUIREMENT (readiness mission, 2026-09-22): a beta user can
 * tell us what worked or failed, and Mike can reliably retrieve that
 * feedback with enough context to understand what happened. The
 * `[AXX-EVENT]` log line alone did not meet it — Vercel runtime logs are
 * retained for hours, not weeks, so feedback submitted on Monday was
 * unreadable by Friday.
 *
 * This is the smallest durable repair: `feedback_submitted` events are
 * ALSO written to a table, following the house pattern for durable tables
 * (see contribution-store.ts — shared prisma client, `$executeRawUnsafe`
 * with `CREATE TABLE IF NOT EXISTS`, TEXT timestamps for the libSQL
 * adapter). The log line remains; nothing else about telemetry changes,
 * and a storage failure must never surface to the user session.
 *
 * PII boundary: the signed-in account email is stored WITH the feedback —
 * in a three-listener beta, following up on "this answer was wrong" is the
 * whole point, and the account email is data the user already gave us.
 * Nothing else identifying is added; anonymous feedback stores null.
 */
import { prisma } from '../prisma';

export interface FeedbackRecord {
  id: string;
  createdAt: string;
  userEmail: string | null;
  advisoryId: string | null;
  helped: string | null;
  accurate: string | null;
  wouldReturn: string | null;
  comment: string | null;
  deploySha: string | null;
}

let ensured: Promise<boolean> | null = null;

async function ensureTable(): Promise<boolean> {
  if (!prisma) return false;
  if (!ensured) {
    ensured = (async () => {
      try {
        await prisma!.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "BetaFeedbackV1" (
            "id"          TEXT NOT NULL PRIMARY KEY,
            "createdAt"   TEXT NOT NULL,
            "userEmail"   TEXT,
            "advisoryId"  TEXT,
            "helped"      TEXT,
            "accurate"    TEXT,
            "wouldReturn" TEXT,
            "comment"     TEXT,
            "deploySha"   TEXT
          )
        `);
        return true;
      } catch (err) {
        console.warn('[feedback] table unavailable: %s', String(err).slice(0, 160));
        return false;
      }
    })();
  }
  return ensured;
}

const s = (v: unknown, max = 1000): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : v === true || v === false ? String(v) : typeof v === 'number' ? String(v) : null;

/** Fire-and-forget durable write. Returns false on any failure; never throws. */
export async function writeFeedback(
  userEmail: string | null,
  props: Record<string, unknown>,
): Promise<boolean> {
  if (!(await ensureTable())) return false;
  const id = `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    await prisma!.$executeRawUnsafe(
      `INSERT INTO "BetaFeedbackV1"
        ("id","createdAt","userEmail","advisoryId","helped","accurate","wouldReturn","comment","deploySha")
       VALUES (?,?,?,?,?,?,?,?,?)`,
      id, new Date().toISOString(), userEmail,
      s(props.advisoryId, 120), s(props.helped, 40), s(props.accurate, 40),
      s(props.wouldReturn, 40), s(props.comment, 1000),
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
    );
    return true;
  } catch (err) {
    console.warn('[feedback] write failed: %s', String(err).slice(0, 160));
    return false;
  }
}

/** Founder review listing — newest first. */
export async function listFeedback(limit = 200): Promise<FeedbackRecord[]> {
  if (!(await ensureTable())) return [];
  try {
    const rows = await prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "BetaFeedbackV1" ORDER BY "createdAt" DESC LIMIT ?`,
      limit,
    );
    return rows as unknown as FeedbackRecord[];
  } catch { return []; }
}
