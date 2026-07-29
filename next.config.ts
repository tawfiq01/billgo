import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray lockfile elsewhere on disk otherwise
  // makes Turbopack guess the wrong root.
  turbopack: {
    root: __dirname,
  },
  // proxy.ts needs the Node.js runtime (not Edge) to query Prisma/SQLite
  // directly for session lookups — see proxy.ts for details. Required at
  // runtime in Next 16.2.10 despite not yet being in this version's shipped
  // NextConfig types.
  experimental: {
    // @ts-expect-error -- nodeMiddleware works at runtime but isn't in this Next version's types yet
    nodeMiddleware: true,
  },
};

export default nextConfig;
