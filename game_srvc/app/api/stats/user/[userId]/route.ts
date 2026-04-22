// GET /api/stats/user/:userId — public, no auth required
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/prisma/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = parseInt(params.userId, 10)
  if (isNaN(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
  }

  try {
    const entry = await prisma.globalLeaderboard.findUnique({
      where: { playerId: userId },
      include: { player: { select: { username: true } } },
    })

    if (!entry) {
      return NextResponse.json({
        playerId: userId,
        username: null,
        totalGamesPlayed: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalShipsDestroyed: 0,
        totalShipsLost: 0,
        totalShotsFired: 0,
        totalShotsHit: 0,
        winRate: null,
        accuracy: null,
      })
    }

    return NextResponse.json({
      playerId: entry.playerId,
      username: entry.player?.username ?? entry.playerName ?? null,
      totalGamesPlayed: entry.totalGamesPlayed,
      totalWins: entry.totalWins,
      totalLosses: entry.totalLosses,
      totalDraws: entry.totalDraws,
      totalShipsDestroyed: entry.totalShipsDestroyed,
      totalShipsLost: entry.totalShipsLost,
      totalShotsFired: entry.totalShotsFired,
      totalShotsHit: entry.totalShotsHit,
      winRate: entry.winRate,
      accuracy: entry.accuracy,
    })
  } catch (error) {
    console.error('[stats/user]', error)
    return NextResponse.json({
      playerId: userId,
      username: null,
      totalGamesPlayed: 0,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      totalShipsDestroyed: 0,
      totalShipsLost: 0,
      totalShotsFired: 0,
      totalShotsHit: 0,
      winRate: null,
      accuracy: null,
    })
  }
}
