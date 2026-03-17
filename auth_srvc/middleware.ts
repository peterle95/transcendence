import { NextRequest, NextResponse } from 'next/server';

const CORS_ORIGIN = process.env.CORS_ALLOWED_ORIGIN ?? 'http://localhost:3003';

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': CORS_ORIGIN,
	'Access-Control-Allow-Credentials': 'true',
	'Access-Control-Allow-Methods': 'GET,DELETE,PATCH,POST,PUT,OPTIONS',
	'Access-Control-Allow-Headers':
		'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
};

export function middleware(req: NextRequest) {
	// Handle CORS preflight — browsers send OPTIONS before PATCH/DELETE/PUT
	if (req.method === 'OPTIONS') {
		return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
	}

	// Attach CORS headers to every other API response
	const res = NextResponse.next();
	Object.entries(CORS_HEADERS).forEach(([key, value]) => res.headers.set(key, value));
	return res;
}

export const config = {
	matcher: '/api/:path*',
};
