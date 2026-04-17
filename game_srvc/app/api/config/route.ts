import { NextResponse } from 'next/server';

/**
 * GET /game/api/config
 *
 * Returns runtime capability flags to the static game HTML.
 * The game HTML fetches this once on boot and sets window.REMOTE_MULTIPLAYER_ENABLED
 * so the frontend JS can gate the Multiplayer menu entry without hard-coding env vars
 * into static assets.
 */
export function GET() {
  const remoteMultiplayerEnabled =
    process.env.REMOTE_MULTIPLAYER_ENABLED !== 'false';

  return NextResponse.json(
    { remoteMultiplayerEnabled },
    {
      headers: {
        // Short cache so a redeploy takes effect quickly; must revalidate after 30s.
        'Cache-Control': 'public, max-age=30, must-revalidate',
      },
    }
  );
}
