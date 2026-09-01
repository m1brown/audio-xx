/**
 * Password-recovery helpers (pre-beta item 3).
 *
 * Design constraints (acceptance criteria of the operational-readiness
 * envelope):
 *  - No account enumeration: the forgot endpoint's observable behaviour
 *    is identical whether or not the email exists.
 *  - No token reuse: tokens are single-use (usedAt) and expire after
 *    RESET_TOKEN_TTL_MS.
 *  - No secrets in logs: the raw token exists only in the emailed link;
 *    the database stores its SHA-256 hash. Nothing in this module logs
 *    tokens or passwords.
 */

import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma';

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Minimum interval between reset emails for one account. */
export const RESET_REQUEST_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Create a reset token for the user, honouring the per-account cooldown.
 * Returns the RAW token (for the email link) or null when inside the
 * cooldown window. Caller must never log the return value.
 */
export async function createResetToken(userId: string): Promise<string | null> {
  const recent = await prisma.passwordResetToken.findFirst({
    where: {
      userId,
      createdAt: { gt: new Date(Date.now() - RESET_REQUEST_COOLDOWN_MS) },
      usedAt: null,
    },
  });
  if (recent) return null;

  const rawToken = randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return rawToken;
}

/**
 * Resolve a raw token to its owning user id if — and only if — the token
 * exists, is unexpired, and has never been used. Does NOT consume it.
 */
export async function verifyResetToken(rawToken: string): Promise<string | null> {
  if (!rawToken || rawToken.length < 20) return null;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row.userId;
}

/**
 * Consume the token (single-use) and invalidate every other outstanding
 * token for the same user, so an older emailed link cannot be replayed
 * after a successful reset.
 */
export async function consumeResetToken(rawToken: string): Promise<void> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!row) return;
  await prisma.passwordResetToken.updateMany({
    where: { userId: row.userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}
