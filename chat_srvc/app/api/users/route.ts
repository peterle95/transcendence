import { NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/authMiddleware';

// Must include auth_srvc Next.js basePath `/auth`.
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000/auth';

/**
 * GET /api/users?search=<query>
 * With search param: proxies user search to auth_srvc.
 * Without search param: returns the authenticated user's friends as a user list.
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated || !auth.userId) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    if (search) {
      const authHeader = request.headers.get('Authorization');
      const headers: Record<string, string> = {};
      if (authHeader) headers['Authorization'] = authHeader;

      const cookie = request.headers.get('cookie');
      if (cookie) headers['cookie'] = cookie;

      const res = await fetch(
        `${AUTH_SERVICE_URL}/api/users/search?username=${encodeURIComponent(search)}`,
        { headers }
      );
      if (!res.ok) {
        return NextResponse.json({ success: false, error: 'Search failed' }, { status: res.status });
      }
      const data = await res.json();
      return NextResponse.json({ success: true, users: data.data ? [data.data] : data.users || [] });
    }

    return NextResponse.json({ success: true, users: [] });
  } catch (error) {
    console.error('Error in GET /api/users:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
