/**
 * Prisma adapter for the snapshot port.
 *
 * Thin by design: the access rules live in `assessment-snapshot.ts` and are
 * proved against an in-memory port, so this file contains no decisions — only
 * the four operations the port declares.
 *
 * Every call is wrapped, matching the rule the rest of the app already follows:
 * the site must work without a database, and an anonymous reader must never see
 * a stack trace because Turso was unreachable.
 */
import { prisma } from '@/lib/prisma';
import type { SnapshotPort, SnapshotRow } from './assessment-snapshot';

/* eslint-disable @typescript-eslint/no-explicit-any */
const asRow = (r: any): SnapshotRow => ({
  id: r.id,
  // Legacy rows predate tokenisation and carry NULL; they are unreachable by
  // token, which is correct — they were never given a capability URL.
  viewToken: r.viewToken ?? '',
  shareToken: r.shareToken ?? null,
  userId: r.userId ?? null,
  systemId: r.systemId ?? null,
  snapshotJson: r.snapshotJson ?? '',
  schemaVersion: r.schemaVersion ?? '',
  engineVersion: r.engineVersion ?? '',
  createdAt: r.createdAt,
});

export const prismaSnapshotPort: SnapshotPort = {
  async insert(row) {
    await (prisma as any).assessmentSnapshot.create({
      data: {
        id: row.id,
        viewToken: row.viewToken,
        shareToken: row.shareToken,
        userId: row.userId,
        systemId: row.systemId,
        snapshotJson: row.snapshotJson,
        schemaVersion: row.schemaVersion,
        engineVersion: row.engineVersion,
        createdAt: row.createdAt,
      },
    });
  },

  async findByViewToken(viewToken) {
    try {
      const r = await (prisma as any).assessmentSnapshot.findUnique({ where: { viewToken } });
      return r ? asRow(r) : null;
    } catch { return null; }
  },

  async findByShareToken(shareToken) {
    try {
      const r = await (prisma as any).assessmentSnapshot.findUnique({ where: { shareToken } });
      return r ? asRow(r) : null;
    } catch { return null; }
  },

  async setShareToken(viewToken, shareToken) {
    try {
      const r = await (prisma as any).assessmentSnapshot.update({
        where: { viewToken }, data: { shareToken },
      });
      return r ? asRow(r) : null;
    } catch { return null; }
  },
};
