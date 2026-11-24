import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 4 MB för filen, med plats för övriga multipart-fält.
      bodySizeLimit: 4_250_000,
    },
  },
};

export default nextConfig;
