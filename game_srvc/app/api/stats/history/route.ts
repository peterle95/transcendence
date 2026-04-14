/**
 * GET /api/stats/history?userId=<id>&limit=20&offset=0
 * Public endpoint – no auth required.
 * Returns paginated match history for a given user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/prisma/prisma'

export async function GET(request: NextRequest) {
  try {
    const sp     = request.nextUrl.searchParams
    const userId = parseInt(sp.get('userId') || '', 10)
    const limit  = Math.min(parseInt(sp.get('limit')  || '20'), 50)
    const offset = Math.max(parseInt(sp.get('offset') || '0'),  0)

    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: 'Missing or invalid userId' }, { status: 400 })
    }

    const [sessions, total] = await Promise.all([
      prisma.gameSession.findMany({
        where: {
          players: {
            some: { playerId: userId },
          },
        },
        include: {
          players: true,
        },
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    offset,
      }),
      prisma.gameSession.count({
        where: {
          players: {
            some: { playerId: userId },
          },
        },
      }),
    ])

    const data = sessions.map((session) => {
      const myStats = session.players.find((p) => p.playerId === userId)
      const opponents = session.players.filter((p) => p.playerId !== userId)

      return {
        sessionId:      session.sessionId,
        gameMode:       session.gameMode,
        duration:       session.duration,
        playedAt:       session.createdAt,
        result:         myStats?.isWinner ? 'win' : 'loss',
        placement:      myStats?.placement ?? null,
        shotsFired:     myStats?.shotsFired ?? 0,
        shotsHit:       myStats?.shotsHit ?? 0,
        shipsLost:      myStats?.shipsLost ?? 0,
        shipsDestroyed: myStats?.shipsDestroyed ?? 0,
        accuracy:       myStats?.accuracy != null ? Math.round(myStats.accuracy) : null,
        playerColor:    myStats?.playerColor ?? null,
        opponents: opponents.map((o) => ({
          playerName:     o.playerName,
          playerColor:    o.playerColor,
          isWinner:       o.isWinner,
          placement:      o.placement,
          shipsDestroyed: o.shipsDestroyed,
        })),
      }
    })

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      count: data.length,
      data,
    })
  } catch (error) {
    console.error('[stats/history]', error)
    return NextResponse.json({ error: 'Failed to fetch game history' }, { status: 500 })
  }
}
