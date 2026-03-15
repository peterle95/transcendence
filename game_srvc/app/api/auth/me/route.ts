/**
 * GET /api/auth/me
 * Server-side proxy to auth_srvc session endpoint.
 * Avoids CORS issues when the browser (on port 3002) would try to fetch
 * auth_srvc directly (port 3000) with credentials.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000'
    const cookieHeader = request.headers.get('cookie') || ''

    const res = await fetch(`${authServiceUrl}/api/auth/session`, {
      method: 'GET',
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    })

    if (!res.ok) {
      return NextResponse.json({ user: null }, { status: 200 })
    }

    const data = await res.json()
    const user = data?.user

    if (!user?.id) {
      return NextResponse.json({ user: null }, { status: 200 })
    }

    return NextResponse.json({
      user: {
        id: parseInt(String(user.id), 10),
        username: user.name || `user_${user.id}`,
        email: user.email || null,
      }
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
