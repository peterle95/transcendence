
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CORS_HEADERS = {
	'Access-Control-Allow-Credentials': 'true',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
}

function resolveOrigin(request: NextRequest): string | null {
	const allowedOrigins = (process.env.CORS_ALLOWED_ORIGIN || 'http://localhost:3003')
		.split(',')
		.map(o => o.trim())
		.filter(Boolean)

	const requestOrigin = request.headers.get('origin')
	if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
		return requestOrigin
	}
	return null
}

export function proxy(request: NextRequest) {
	const origin = resolveOrigin(request)

	if (request.method === 'OPTIONS') {
		const preflight = new NextResponse(null, { status: 204 })
		if (origin) preflight.headers.set('Access-Control-Allow-Origin', origin)
		Object.entries(CORS_HEADERS).forEach(([k, v]) => preflight.headers.set(k, v))
		return preflight
	}

	const response = NextResponse.next()
	if (origin) response.headers.set('Access-Control-Allow-Origin', origin)
	Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
	return response
}

export const config = {
	matcher: '/api/:path*',
}

