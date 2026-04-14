/**
 * GET /api/auth/token
 * proxy: forwards the session cookie to auth_srvc and returns the JWT.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000/auth'
        const cookieHeader = request.headers.get('cookie') || ''

        const res = await fetch(`${authServiceUrl}/api/auth/token`, {
            method: 'GET',
            headers: cookieHeader ? { cookie: cookieHeader } : {},
        })

        if (!res.ok) {
            return NextResponse.json({ token: null }, { status: 200 })
        }

        const data = await res.json()
        return NextResponse.json({ token: data.token ?? null })
    } catch {
        return NextResponse.json({ token: null }, { status: 200 })
    }
}