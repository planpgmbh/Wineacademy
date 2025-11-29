import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '1337' },
      { protocol: 'http', hostname: 'backend', port: '1337' },
      { protocol: 'http', hostname: 'backend-staging', port: '1337' },
      { protocol: 'https', hostname: 'main.wineacademy.de' },
      { protocol: 'https', hostname: 'staging.wineacademy.de' },
      { protocol: 'https', hostname: 'wineacademy.de' },
      { protocol: 'https', hostname: 'www.wineacademy.de' },
    ],
  },
};

export default nextConfig;
