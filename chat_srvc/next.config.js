/** @type {import('next').NextConfig} */
const basePath = '/chat';

const nextConfig = {
  reactStrictMode: true,
  basePath,
  env: {
    // Client fetch() uses absolute paths from the site origin; basePath is not applied automatically.
    NEXT_PUBLIC_CHAT_BASE_PATH: basePath,
    // NEXT_PUBLIC_AUTH_SERVICE_URL: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:3000',
    NEXT_PUBLIC_AUTH_SERVICE_URL: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || '/auth',
  },
  
  // Optionally suppress hydration warnings in development
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
};

module.exports = nextConfig;
