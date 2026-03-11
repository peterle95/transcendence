/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AUTH_SERVICE_URL: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:3000',
    NEXT_PUBLIC_CHAT_SERVICE_URL: process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || 'http://localhost:3001',
    NEXT_PUBLIC_GAME_SERVICE_URL: process.env.NEXT_PUBLIC_GAME_SERVICE_URL || 'http://localhost:3002',
  },
};

module.exports = nextConfig;
