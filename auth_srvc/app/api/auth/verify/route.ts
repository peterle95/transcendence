import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/prisma/prisma'
import { handleOptionsRequest, getCorsHeaders } from '@/lib/cors'

export async function OPTIONS(req: Request) {
  return handleOptionsRequest(req)
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401, headers: corsHeaders })
    }

    const token = authHeader.substring(7)
    const secret = process.env.AUTH_SECRET

    if (!secret) {
      console.error('[auth/verify] AUTH_SECRET is not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500, headers: corsHeaders })
    }

    let decoded: jwt.JwtPayload
    try {
      decoded = jwt.verify(token, secret) as jwt.JwtPayload
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401, headers: corsHeaders })
      }
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })
    }

    const userId = decoded.userId || decoded.sub
    if (!userId) {
      return NextResponse.json({ error: 'Token missing user identifier' }, { status: 401, headers: corsHeaders })
    }

    const numericId = typeof userId === 'string' ? parseInt(userId, 10) : userId

    const user = await prisma.user.findUnique({
      where: { id: numericId },
      select: { id: true, username: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })
    }

    return NextResponse.json({
      sub: String(user.id),
      userId: user.id,
      username: user.username,
      email: user.email,
      iat: decoded.iat,
      exp: decoded.exp,
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('[auth/verify] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}
