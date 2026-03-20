/** @type {import('next').NextConfig} */
const nextConfig = {
	// CORS is handled entirely by middleware.ts, which reads CORS_ALLOWED_ORIGIN
	// from the environment and also handles OPTIONS preflight requests.
	reactStrictMode: true,
};

module.exports = nextConfig;
