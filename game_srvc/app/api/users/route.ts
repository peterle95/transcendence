/**
 * GET /api/users/lookup?username=<username>
 * Returns a user's id and username from the game DB (used by host to invite players).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/prisma/prisma'

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request)
    if(!authResult.authenticated) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const username = request.nextUrl.searchParams.get('username')?.trim()
    if (!username) {
        return NextResponse.json({ error: 'username parameter is required'}, {status: 400})
    }
    const user = await prisma.user.findUnique({
        where: { username },
        select: { id: true, username: true },
    })

    if (!user) {
        return NextResponse.json(
            { error: 'User not found. They must have logged in at least once!' },
            { status: 404}
        )
    }

    return NextResponse.json({ id: user.id, username: user.username })
}