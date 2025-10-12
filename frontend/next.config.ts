import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '1337' },
      { protocol: 'http', hostname: 'backend', port: '1337' },
      { protocol: 'http', hostname: 'backend-staging', port: '1337' },
      { protocol: 'https', hostname: 'wineacademymain.plan-p.de' },
      { protocol: 'https', hostname: 'wineacademy.plan-p.de' },
    ],
  },
};

export default nextConfig;
