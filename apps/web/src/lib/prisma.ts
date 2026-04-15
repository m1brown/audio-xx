/**
 * Lazy-initialised Prisma client.
 *
 * On Vercel / production the app must work WITHOUT a database — anonymous
 * users never touch Prisma and all API routes wrap db calls in try/catch.
 *
 * This module guarantees:
 *   1. Importing prisma.ts never throws (no work at import time).
 *   2. The real PrismaClient is created on first property access.
 *   3. If initialisation fails the access throws — caught by route try/catch.
 *   4. In production, if Turso creds are absent we skip the SQLite fallback
 *      (there is no SQLite file on Vercel).
 */

import type { PrismaClient } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function buildPrismaClient(): PrismaClient | null {
  // Already initialised in this process (dev hot-reload safety)
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;

  const isDev = process.env.NODE_ENV !== 'production';
  // In development, always use local SQLite unless explicitly opted out.
  // This avoids depending on a remote Turso connection during local dev.
  const forceLocal = process.env.USE_LOCAL_DB === '1' || (isDev && process.env.USE_LOCAL_DB !== '0');

  try {
    if (forceLocal) {
      // Local SQLite — highest priority in dev
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient: PC } = require('@prisma/client');
      const client = new PC();
      globalForPrisma.__prisma = client;
      console.log('[prisma] Connected to local SQLite');
      return client;
    }

    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (tursoUrl && tursoToken) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaLibSQL } = require('@prisma/adapter-libsql');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient: PC } = require('@prisma/client');
      const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: tursoToken });
      const client = new PC({ adapter });
      globalForPrisma.__prisma = client;
      console.log('[prisma] Connected to Turso');
      return client;
    }

    // Production without Turso creds — no usable database.
    console.warn('[prisma] No database credentials available');
    return null;
  } catch (err) {
    console.error('[prisma] Initialisation failed:', err);
    return null;
  }
}

/**
 * Exported as a Proxy typed as PrismaClient.
 *
 * - First property access triggers lazy init.
 * - If init fails (or already failed), the property access throws.
 * - Route-level try/catch turns this into a clean 503.
 * - No other file needs to change its import.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    // Allow certain JS-internal / inspection props to pass through so that
    // things like console.log(prisma) or typeof checks don't trigger init.
    if (prop === 'then' || prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
      return undefined;
    }

    const client = buildPrismaClient();
    if (!client) {
      throw new Error('[prisma] Database is not available');
    }
    return (client as Record<string | symbol, unknown>)[prop];
  },
});
