const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AUTH_SERVICE_URL: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || '/auth',
  },
  async rewrites() {
    // In dev (no Nginx), proxy /auth/* to the auth service directly
    const authUrl = process.env.AUTH_SERVICE_URL;
    if (authUrl) {
      return [
        { source: '/auth/:path*', destination: `${authUrl}/:path*` },
      ];
    }
    return [];
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  },
};

module.exports = nextConfig;

