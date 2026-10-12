import type { NextConfig } from "next";

/**
 * Static export only: no API routes, Server Actions or SSR runtime. All
 * business logic lives in apps/api; entity pages are client shells that read
 * IDs from the query string (?id=) and authorize through the API.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const config: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@atlas/contracts", "@atlas/domain", "@atlas/demo-seed"],
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default config;
