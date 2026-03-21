
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
	const origin = process.env.CORS_ALLOWED_ORIGIN || '*' // * allows all origins, TODO: change to the domain name
		const preflight = new NextResponse(null, { status: 204 })
		preflight.headers.set('Access-Control-Allow-Origin', origin)
		preflight.headers.set('Access-Control-Allow-Credentials', 'true')
		preflight.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
		preflight.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization')
		return preflight
	}
	
	const response = NextResponse.next()

	response.headers.set('Access-Control-Allow-Origin', origin)
	response.headers.set('Access-Control-Allow-Credentials', 'true')
	response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
	response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization')

	return response
}

export const config = {
	matcher: '/api/:path*',
}