import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { SESSION_TOKEN_COOKIE_NAME } from '@/lib/auth-cookie'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/verify
 * Verifies a Bearer token issued by /api/auth/token.
 * Used by chat_srvc (and other services) to authenticate inbound requests.
 *
 * Returns: { userId, username, email }
 */
export async function POST(req: NextRequest) {
	const authHeader = req.headers.get('Authorization')
	const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

	if (!bearerToken) {
		return NextResponse.json({ error: 'No token provided' }, { status: 401 })
	}

	// Reconstruct a synthetic request that has the token as the NextAuth cookie
	// so getToken can decode and verify it using the shared AUTH_SECRET.
	const syntheticReq = new NextRequest('https://localhost', {
		headers: { cookie: `${SESSION_TOKEN_COOKIE_NAME}=${bearerToken}` },
	})

	const decoded = await getToken({
		req: syntheticReq,
		secret: process.env.AUTH_SECRET!,
		cookieName: SESSION_TOKEN_COOKIE_NAME,
	})

	if (!decoded) {
		return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
	}

	return NextResponse.json({
		userId: decoded.userId,
		username: decoded.name,
		email: decoded.email,
	})
}
