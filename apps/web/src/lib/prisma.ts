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
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient; __prismaFailed?: boolean };

function buildPrismaClient(): PrismaClient | null {
  // Already initialised in this process (dev hot-reload safety)
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;

  // Already tried and failed — don't retry every request
  if (globalForPrisma.__prismaFailed) return null;

  try {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (tursoUrl && tursoToken) {
      // Dynamic require so the adapter is only loaded when credentials exist
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaLibSQL } = require('@prisma/adapter-libsql');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient: PC } = require('@prisma/client');
      const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: tursoToken });
      const client = new PC({ adapter });
      globalForPrisma.__prisma = client;
      return client;
    }

    // In production without Turso creds there is no usable database.
    // Return null instead of creating a SQLite client that will fail.
    if (process.env.NODE_ENV === 'production') {
      console.warn('[prisma] No Turso credentials — database unavailable');
      globalForPrisma.__prismaFailed = true;
      return null;
    }

    // Development — local SQLite file
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient: PC } = require('@prisma/client');
    const client = new PC();
    globalForPrisma.__prisma = client;
    return client;
  } catch (err) {
    console.error('[prisma] Initialisation failed:', err);
    globalForPrisma.__prismaFailed = true;
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
