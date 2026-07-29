import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Reused across hot reloads in dev so we don't exhaust connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Phase 1 (see plan doc) runs on a local file-based SQLite/libSQL database so
// the whole app works with zero external setup. Phase 4 points DATABASE_URL
// at Postgres (or a shared libSQL/Turso db) for production; in production
// with no DATABASE_URL set we fall back to null rather than a throwaway file.
const url =
  process.env.DATABASE_URL ?? (process.env.NODE_ENV === "production" ? undefined : "file:./dev.db");

function createClient(dbUrl: string): PrismaClient {
  const adapter = new PrismaLibSql({ url: dbUrl });
  return new PrismaClient({ adapter });
}

// Null when no database is configured — callers fall back to empty/zeroed
// data instead of crashing.
export const prisma = url ? (globalForPrisma.prisma ?? (globalForPrisma.prisma = createClient(url))) : null;
