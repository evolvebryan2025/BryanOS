import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  async rewrites() {
    return isProd
      ? [] // In production, Netlify redirects handle /api/* routing
      : [
          {
            source: "/api/:path*",
            destination: "http://localhost:3005/api/:path*",
          },
        ];
  },
};

export default nextConfig;
