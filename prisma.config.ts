import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 CLI configuration — connection URLs live here, not in schema.prisma.
// Phase 1 (see plan doc) runs on file-based SQLite so the whole stack works
// with zero external setup; DATABASE_URL overrides this for Phase 4 (Postgres).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
