import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 CLI configuration — connection URLs live here, not in schema.prisma.
// DATABASE_URL comes from .env locally and from Vercel env vars in CI. The
// placeholder keeps `prisma generate` (run on every install) working when no
// database is configured; commands that actually connect need the real URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
  migrations: {
    seed: "node --env-file=.env prisma/seed.ts",
  },
});
