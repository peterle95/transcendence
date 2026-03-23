import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/prisma/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const requiredToken = process.env.AUTH_INTERNAL_API_TOKEN || process.env.SERVICE_SECRET || process.env.INTERNAL_SERVICE_SECRET
    const providedToken = request.headers.get('x-internal-token')

    if (requiredToken && providedToken !== requiredToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        wins: true,
        losses: true,
        points: true,
        shotsFired: true,
        shotsHit: true,
        shipsLost: true,
        shipsDestroyed: true,
      },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({ success: true, count: users.length, users })
  } catch (error) {
    console.error('[internal/stats/report]', error)
    return NextResponse.json({ error: 'Failed to fetch users stats report' }, { status: 500 })
  }
}