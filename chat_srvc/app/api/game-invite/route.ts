/**
 * POST /api/game-invite
 * Sends a real-time game invite to another user via Socket.io.
 * The target user receives a `game_invite_received` event on their
 * personal socket room (`user_<targetUserId>`).
 *
 * Body: { targetUserId: number }
 * Auth: Bearer token required (identifies the inviter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authMiddleware';

const ALLOWED_ORIGINS = (
  //   process.env.ALLOWED_ORIGINS || 'http://localhost:3001,http://localhost:3002,http://localhost:3003'
  process.env.ALLOWED_ORIGINS || process.env.PUBLIC_URL || ''
).split(',').map(s => s.trim());

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin':      origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods':     'POST, OPTIONS',
      'Access-Control-Allow-Headers':     'Content-Type, Authorization',
    };
  }
  return {};
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  const auth = await authenticateRequest(request);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  let targetUserId: number;
  let gameRoomId: string | undefined;
  let slot = 1;
  try {
    const body = await request.json();
    targetUserId = parseInt(body.targetUserId, 10);
    if (isNaN(targetUserId)) throw new Error('invalid');
    gameRoomId = typeof body.gameRoomId === 'string' ? body.gameRoomId : undefined;
    if (typeof body.slot === 'number' && body.slot >= 1 && body.slot <= 3) slot = body.slot;
  } catch {
    return NextResponse.json({ error: 'targetUserId (number) is required' }, { status: 400, headers });
  }

  if (targetUserId === auth.user.userId) {
    return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400, headers });
  }

  const io = (global as any).io;
  if (!io) {
    return NextResponse.json({ error: 'Socket.io not available' }, { status: 503, headers });
  }

  // const gameUrl = process.env.NEXT_PUBLIC_GAME_SERVICE_URL || 'http://localhost:3002';
  const gameUrl = process.env.NEXT_PUBLIC_GAME_SERVICE_URL || '/game';

  io.to(`user_${targetUserId}`).emit('game_invite_received', {
    inviterId:       auth.user.userId,
    inviterUsername: auth.user.username,
    gameUrl,
    gameRoomId:      gameRoomId ?? null,
    slot,
    sentAt:          new Date().toISOString(),
  });

  console.log(`[GameInvite] ${auth.user.username} (${auth.user.userId}) invited user ${targetUserId}`);

  return NextResponse.json({ success: true }, { headers });
}
