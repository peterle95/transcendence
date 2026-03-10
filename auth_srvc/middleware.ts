import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const allowedOrigins = (
	process.env.CORS_ALLOWED_ORIGINS ||
	process.env.CORS_ALLOWED_ORIGIN ||
	'http://localhost:3003,http://localhost:3001,http://localhost:3002'
).split(',').map(o => o.trim())

function getCorsOrigin(request: NextRequest): string | null {
	const origin = request.headers.get('origin')
	if (origin && allowedOrigins.includes(origin)) {
		return origin
	}
	return null
}

export function middleware(request: NextRequest) {
	const origin = getCorsOrigin(request)

	if (request.method === 'OPTIONS') {
		const preflight = new NextResponse(null, { status: 204 })
		if (origin) {
			preflight.headers.set('Access-Control-Allow-Origin', origin)
			preflight.headers.set('Access-Control-Allow-Credentials', 'true')
			preflight.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
			preflight.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept')
			preflight.headers.set('Access-Control-Max-Age', '86400')
		}
		return preflight
	}

	const response = NextResponse.next()

	if (origin) {
		response.headers.set('Access-Control-Allow-Origin', origin)
		response.headers.set('Access-Control-Allow-Credentials', 'true')
		response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
		response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept')
	}

	return response
}

export const config = {
	matcher: '/api/:path*',
}
