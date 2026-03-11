import { NextResponse } from "next/server"

const allowedOrigins = [
	'http://localhost:3003',
	'http://localhost:3001',
	'http://localhost:3002'
]

export function getCorsHeaders(origin: string | null): Record<string, string> {
	const headers: Record<string, string> = {}
	
	if (origin && allowedOrigins.includes(origin)) {
		headers['Access-Control-Allow-Origin'] = origin
		headers['Access-Control-Allow-Credentials'] = 'true'
		headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
		headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept'
	}
	
	return headers
}

export function handleOptionsRequest(req: Request): NextResponse {
	const origin = req.headers.get('origin')
	const headers = getCorsHeaders(origin)
	
	return new NextResponse(null, {
		status: 204,
		headers: {
			...headers,
			'Access-Control-Max-Age': '86400',
		}
	})
}

export function jsonWithCors(data: any, req: Request, options: { status?: number } = {}) {
	const origin = req.headers.get('origin')
	const corsHeaders = getCorsHeaders(origin)
	
	return NextResponse.json(data, {
		status: options.status || 200,
		headers: corsHeaders
	})
}
