/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3000',
    NEXT_PUBLIC_CHAT_SERVICE_URL: process.env.CHAT_SERVICE_URL || 'http://localhost:3001',
    NEXT_PUBLIC_FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3003',
  },
};

module.exports = nextConfig;
