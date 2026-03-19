import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function buildPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  // Use Turso adapter when credentials are available (production / Vercel),
  // fall back to local SQLite file for development.
  if (tursoUrl && tursoToken) {
    try {
      const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: tursoToken });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new PrismaClient({ adapter } as any);
    } catch (err) {
      console.error('[prisma] Failed to initialize Turso adapter:', err);
      // Fall through to default client
    }
  }

  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma || buildPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
