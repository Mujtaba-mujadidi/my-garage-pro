import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  // Include workspace packages in the production trace (pnpm monorepo)
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@mygaragepro/shared"],
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:4000";
    return [
      {
        source: "/api/backend/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
