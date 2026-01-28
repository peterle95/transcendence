/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3000',
    CHAT_SERVICE_URL: process.env.CHAT_SERVICE_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
