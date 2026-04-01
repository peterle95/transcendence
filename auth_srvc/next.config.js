/** @type {import('next').NextConfig} */
const nextConfig = {
	// CORS is handled entirely by middleware.ts, which reads CORS_ALLOWED_ORIGIN
	// from the environment and also handles OPTIONS preflight requests.
	reactStrictMode: true,
	// basePath '/auth' aligns the internal Next.js routing with the public URL
	// (NEXTAUTH_URL = ${PUBLIC_URL}/auth). Nginx must NOT strip the /auth prefix
	// when proxying — it must proxy /auth/... → http://auth_upstream/auth/...
	// so the container receives the full path. See nginx/transcendance.conf.
	basePath: '/auth',
};

module.exports = nextConfig;
