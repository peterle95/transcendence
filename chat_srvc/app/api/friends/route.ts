import { NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/authMiddleware';
import { getFriends } from '@/lib/userStore';

/**
 * GET /api/friends
 * Returns the authenticated user's friends list by proxying to auth_srvc.
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated || !auth.userId) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const cookie = request.headers.get('cookie') || '';
    const authorization = request.headers.get('authorization') || undefined;
    const friends = await getFriends(cookie, authorization);

    return NextResponse.json({
      success: true,
      friends,
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch friends' },
      { status: 500 }
    );
  }
}
