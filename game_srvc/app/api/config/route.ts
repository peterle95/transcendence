import { NextResponse } from 'next/server';

/**
 * GET /game/api/config
 *
 * Returns runtime capability flags and socket configuration to the static game HTML.
 * The game HTML fetches this once on boot and sets window globals
 * so the frontend JS can use runtime config instead of hardcoded values.
 */
export function GET() {
  const remoteMultiplayerEnabled =
    process.env.REMOTE_MULTIPLAYER_ENABLED !== 'false';

  // Socket configuration - use env vars or sensible defaults
  const socketPath = process.env.SOCKET_PATH || '/game/socket.io/';
  const gameRoomId = process.env.GAME_ROOM_ID || 'gameplay-room';

  return NextResponse.json(
    {
      remoteMultiplayerEnabled,
      socketPath,
      gameRoomId,
    },
    {
      headers: {
        // Short cache so a redeploy takes effect quickly; must revalidate after 30s.
        'Cache-Control': 'public, max-age=30, must-revalidate',
      },
    }
  );
}
