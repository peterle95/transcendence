import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/prisma/prisma'

export const dynamic = 'force-dynamic'

interface StatsDelta {
  userId: number
  shotsFired: number
  shotsHit: number
  shipsLost: number
  shipsDestroyed: number
  isWinner: boolean
}

interface SyncBody {
  updates: StatsDelta[]
}

function isValidDelta(value: unknown): value is StatsDelta {
  if (!value || typeof value !== 'object') return false
  const v = value as StatsDelta
  return Number.isInteger(v.userId)
    && Number.isFinite(v.shotsFired)
    && Number.isFinite(v.shotsHit)
    && Number.isFinite(v.shipsLost)
    && Number.isFinite(v.shipsDestroyed)
    && typeof v.isWinner === 'boolean'
}

export async function POST(request: NextRequest) {
  try {
    const requiredToken = process.env.AUTH_INTERNAL_API_TOKEN || process.env.SERVICE_SECRET
    const providedToken = request.headers.get('x-internal-token')

    if (requiredToken && providedToken !== requiredToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as SyncBody
    const updates = Array.isArray(body?.updates) ? body.updates : []

    if (!updates.length || !updates.every(isValidDelta)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const results = await Promise.all(
      updates.map(async (delta) => {
        const result = await prisma.user.updateMany({
          where: { id: delta.userId },
          data: {
            shotsFired: { increment: Math.max(0, Math.trunc(delta.shotsFired)) },
            shotsHit: { increment: Math.max(0, Math.trunc(delta.shotsHit)) },
            shipsLost: { increment: Math.max(0, Math.trunc(delta.shipsLost)) },
            shipsDestroyed: { increment: Math.max(0, Math.trunc(delta.shipsDestroyed)) },
            losses: delta.isWinner ? undefined : { increment: 1 },
            wins: delta.isWinner ? { increment: 1 } : undefined,
          },
        })

        return {
          userId: delta.userId,
          updated: result.count > 0,
        }
      })
    )

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('[internal/stats/sync]', error)
    return NextResponse.json({ error: 'Failed to sync stats' }, { status: 500 })
  }
}
