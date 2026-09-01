/**
 * Assessment snapshot persistence and access.
 *
 * THE ACCESS MODEL (founder, 2026-08-22):
 *
 *   Snapshot creation does not make it public. View/Print operate on the
 *   private snapshot. Explicit Share mints the token. Public access resolves
 *   only through the token. Printing must never mint a share token or alter
 *   access state.
 *
 * TWO TOKENS, NOT ONE, AND NEVER THE DATABASE ID.
 *
 *   viewToken   minted at creation. The private capability behind View, Print
 *               and Save PDF. Unguessable, because an anonymous listener has
 *               no account to authenticate against — the URL they hold IS
 *               their claim to the assessment.
 *   shareToken  minted ONLY by an explicit Share. Null until then, so a
 *               snapshot that was merely printed cannot be reached publicly.
 *
 * The `cuid` primary key never appears in a URL. It is sequential enough in
 * its timestamp prefix to be worth guessing at, and "do not expose predictable
 * database IDs as public share URLs" is the rule.
 *
 * PERSISTENCE IS A PORT. The access rules are the part worth proving, and
 * proving them against a real database would test Prisma rather than the
 * rules. The store takes a `SnapshotPort`; production passes the Prisma
 * adapter and tests pass an in-memory one.
 */
import { randomBytes } from 'node:crypto';
import {
  ASSESSMENT_SCHEMA_V1, parseSnapshot, freezeSnapshot,
  type AssessmentSnapshotV1,
} from '@/lib/artifact/snapshot';

/** 128 bits, base64url. Not a database id, not derived from one. */
export function newToken(): string {
  return randomBytes(16).toString('base64url');
}

export interface SnapshotRow {
  id: string;
  viewToken: string;
  shareToken: string | null;
  userId: string | null;
  systemId: string | null;
  snapshotJson: string;
  schemaVersion: string;
  engineVersion: string;
  createdAt: Date;
}

/** The persistence port. Deliberately tiny — four operations, no queries. */
export interface SnapshotPort {
  insert(row: SnapshotRow): Promise<void>;
  findByViewToken(token: string): Promise<SnapshotRow | null>;
  findByShareToken(token: string): Promise<SnapshotRow | null>;
  setShareToken(viewToken: string, shareToken: string): Promise<SnapshotRow | null>;
}

export interface CreateResult {
  viewToken: string;
  /** Always null at creation. Creating an assessment does not publish it. */
  shareToken: null;
}

/**
 * Persist an assessment the listener has already been shown.
 *
 * `userId` and `systemId` are optional by design: an anonymous listener may
 * create, view and print a snapshot without an account. Requiring sign-in to
 * print a page would put an account wall in front of the sharing loop.
 */
export async function createSnapshot(
  port: SnapshotPort,
  snapshot: AssessmentSnapshotV1,
  owner: { userId?: string | null; systemId?: string | null } = {},
): Promise<CreateResult> {
  const viewToken = newToken();
  await port.insert({
    id: `as_${newToken()}`,
    viewToken,
    shareToken: null,
    userId: owner.userId ?? null,
    systemId: owner.systemId ?? null,
    snapshotJson: freezeSnapshot(snapshot),
    schemaVersion: ASSESSMENT_SCHEMA_V1,
    engineVersion: snapshot.engineVersion,
    createdAt: new Date(snapshot.createdAt),
  });
  return { viewToken, shareToken: null };
}

/**
 * Read a snapshot for View / Print.
 *
 * Resolves ONLY by view token. A database id or a share token passed here does
 * not resolve, which is what makes "not publicly accessible through an ID
 * guess" a property of the code rather than of the id format.
 *
 * Read-only in the strictest sense: it mints nothing and writes nothing, so
 * printing cannot alter access state.
 */
export async function readForView(
  port: SnapshotPort, viewToken: string,
): Promise<AssessmentSnapshotV1 | null> {
  if (!viewToken) return null;
  const row = await port.findByViewToken(viewToken);
  return row ? parseSnapshot(row.snapshotJson) : null;
}

/**
 * Read a snapshot for public access.
 *
 * Resolves ONLY by share token, and only where one has been minted. A snapshot
 * that was created and printed but never shared is unreachable here even if
 * its view token is known.
 */
export async function readForShare(
  port: SnapshotPort, shareToken: string,
): Promise<AssessmentSnapshotV1 | null> {
  if (!shareToken) return null;
  const row = await port.findByShareToken(shareToken);
  if (!row?.shareToken) return null;
  return parseSnapshot(row.snapshotJson);
}

/**
 * The explicit Share action. The ONLY thing that grants public access.
 *
 * Idempotent: sharing twice returns the same token rather than rotating it, so
 * a link already given to someone keeps working.
 */
export async function share(
  port: SnapshotPort, viewToken: string,
): Promise<{ shareToken: string } | null> {
  const row = await port.findByViewToken(viewToken);
  if (!row) return null;
  if (row.shareToken) return { shareToken: row.shareToken };
  const shareToken = newToken();
  const updated = await port.setShareToken(viewToken, shareToken);
  return updated ? { shareToken } : null;
}
