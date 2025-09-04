/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@upstash/redis"],
  },
};

module.exports = nextConfig;
