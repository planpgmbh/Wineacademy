import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '1337' },
      { protocol: 'http', hostname: 'backend', port: '1337' },
      { protocol: 'https', hostname: 'wineacademy.de' },
      { protocol: 'https', hostname: 'wineacademy.plan-p.de' },
    ],
  },
};

export default nextConfig;
