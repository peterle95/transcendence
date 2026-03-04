/**
 * GET /api/stats/ranking?type=global|sniper|destroyer|armored|riddled|spender&limit=50
 * Public endpoint – no auth required.
 * Returns leaderboard data linked to real registered users.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/prisma/prisma'

const INCLUDE_USER = { user: { select: { username: true } } }

export async function GET(request: NextRequest) {
  try {
    const sp    = request.nextUrl.searchParams
    const type  = sp.get('type') || 'global'
    const limit = Math.min(parseInt(sp.get('limit') || '50'), 100)

    let title   = ''
    let ranking: any[] = []

    switch (type) {
      case 'sniper':
        title   = 'SNIPER – Best Accuracy'
        ranking = await prisma.globalLeaderboard.findMany({
          where:   { totalShotsFired: { gte: 10 } },
          include: INCLUDE_USER,
          orderBy: { accuracy: 'desc' },
          take:    limit,
        })
        break

      case 'destroyer':
        title   = 'DESTROYER – Most Ships Destroyed'
        ranking = await prisma.globalLeaderboard.findMany({
          include: INCLUDE_USER,
          orderBy: { totalShipsDestroyed: 'desc' },
          take:    limit,
        })
        break

      case 'armored':
        title   = 'ARMORED – Least Ships Lost'
        ranking = await prisma.globalLeaderboard.findMany({
          where:   { totalGamesPlayed: { gte: 3 } },
          include: INCLUDE_USER,
          orderBy: { totalShipsLost: 'asc' },
          take:    limit,
        })
        break

      case 'riddled':
        title   = 'RIDDLED – Most Ships Lost'
        ranking = await prisma.globalLeaderboard.findMany({
          include: INCLUDE_USER,
          orderBy: { totalShipsLost: 'desc' },
          take:    limit,
        })
        break

      case 'spender':
        title   = 'SPENDER – Worst Accuracy'
        ranking = await prisma.globalLeaderboard.findMany({
          where:   { totalShotsFired: { gte: 10 } },
          include: INCLUDE_USER,
          orderBy: { accuracy: 'asc' },
          take:    limit,
        })
        break

      case 'global':
      default:
        title   = 'GLOBAL RANKING – Most Wins'
        ranking = await prisma.globalLeaderboard.findMany({
          include: INCLUDE_USER,
          orderBy: { totalWins: 'desc' },
          take:    limit,
        })
        break
    }

    const data = ranking.map((entry, i) => ({
      rank:     i + 1,
      userId:   entry.playerId,
      username: entry.user?.username ?? 'Unknown',
      totalGamesPlayed:    entry.totalGamesPlayed,
      totalWins:           entry.totalWins,
      totalLosses:         entry.totalLosses,
      totalShipsDestroyed: entry.totalShipsDestroyed,
      totalShipsLost:      entry.totalShipsLost,
      accuracy:            entry.accuracy != null ? Math.round(entry.accuracy) + '%' : '--',
      winRate:             entry.winRate  != null ? Math.round(entry.winRate)  + '%' : '--',
    }))

    return NextResponse.json({ success: true, title, type, count: data.length, data })
  } catch (error) {
    console.error('[stats/ranking]', error)
    return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 })
  }
}
