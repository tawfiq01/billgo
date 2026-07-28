import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Reused across hot reloads in dev so we don't exhaust Postgres connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Null when no DATABASE_URL is configured (e.g. local dev, a fresh preview
// deploy) — callers fall back to empty/zeroed data instead of crashing.
export const prisma = process.env.DATABASE_URL
  ? (globalForPrisma.prisma ?? (globalForPrisma.prisma = createClient()))
  : null;
