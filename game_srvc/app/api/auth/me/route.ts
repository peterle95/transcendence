/**
 * GET /game/api/auth/me (Next.js basePath '/game')
 * Server-side proxy to auth_srvc session endpoint.
 * Avoids CORS (Cross Origin Resources Sharing) issues when the browser 
 * (on port 3002) would try to fetch
 * auth_srvc directly (port 3000) with credentials.
 * CORS (Cross-Origin Resource Sharing) in Next.js is a security 
 * mechanism that allows controlled access to resources on a different 
 * origin (domain, protocol, or port) than the one serving the web 
 * application.  It prevents malicious websites from making unauthorized 
 * requests to your server while enabling legitimate cross-origin communication.

 * This route.ts acts as a proxy server-side:

browser -> game_srvc (same origin of frontend game)
game_srvc -> auth_srvc via fetch backend-to-backend
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
