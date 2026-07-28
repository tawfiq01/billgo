import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray lockfile elsewhere on disk otherwise
  // makes Turbopack guess the wrong root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
