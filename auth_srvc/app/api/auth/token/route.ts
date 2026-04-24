import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { SESSION_TOKEN_COOKIE_NAME } from '@/lib/auth-cookie'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/token
 * Returns the raw NextAuth session JWT for the currently logged-in user.
 * Used by chat_srvc and other services to obtain a Bearer token they can
 * forward to /api/auth/verify for inter-service authentication.
 */
export async function GET(req: NextRequest) {
	const decoded = await getToken({
		req,
		secret: process.env.AUTH_SECRET!,
		cookieName: SESSION_TOKEN_COOKIE_NAME,
	})

	if (!decoded) {
		return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
	}

	// Return the raw signed JWT so callers can use it as a Bearer token
	const raw = await getToken({
		req,
		secret: process.env.AUTH_SECRET!,
		cookieName: SESSION_TOKEN_COOKIE_NAME,
		raw: true,
	})

	return NextResponse.json({ token: raw })
}
