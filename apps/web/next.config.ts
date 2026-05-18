import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
