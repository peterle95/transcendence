import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import jwt from 'jsonwebtoken'
import { authOptions } from '@/lib/auth-config'
import { handleOptionsRequest, getCorsHeaders } from '@/lib/cors'

export async function OPTIONS(req: Request) {
  return handleOptionsRequest(req)
}

/**
 * GET /api/auth/token
 * 
 * Requires a valid NextAuth session (cookie-based).
 * Returns a short-lived signed JWT that other services can verify
 * via POST /api/auth/verify.
 */
export async function GET(req: Request) {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: corsHeaders })
    }

    const secret = process.env.AUTH_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500, headers: corsHeaders })
    }

    const token = jwt.sign(
      {
        userId: parseInt(session.user.id, 10),
        name: session.user.name,
      },
      secret,
      { expiresIn: '1h', subject: session.user.id }
    )

    return NextResponse.json({ token }, { headers: corsHeaders })
  } catch (error) {
    console.error('[auth/token] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}
