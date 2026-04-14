/**
 * Authentication middleware for chat_srvc
 * 
 * Verifies identity by forwarding the JWT token to auth_srvc's /api/auth/verify endpoint.
 * Accepts token from:
 *   1. Authorization: Bearer <token> header
 *   2. next-auth.session-token cookie (for same-domain / reverse-proxy setups)
 */

import type { AuthResult } from '@/types';

// Must include auth_srvc Next.js basePath `/auth` (see auth_srvc/next.config.js).
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000/auth';

interface VerifiedUser {
  userId: number;
  username: string;
  email: string;
}

export async function authenticateRequest(request: Request): Promise<AuthResult & { user?: VerifiedUser }> {
  const token = extractToken(request);

  if (!token) {
    return {
      authenticated: false,
      error: 'Missing authentication token',
    };
  }

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        authenticated: false,
        error: data.error || 'Token verification failed',
      };
    }

    const data = await response.json();

    return {
      authenticated: true,
      userId: data.userId,
      user: {
        userId: data.userId,
        username: data.username,
        email: data.email,
      },
    };
  } catch (error) {
    console.error('[Auth] Error verifying token with auth_srvc:', error);
    return {
      authenticated: false,
      error: 'Authentication service unavailable',
    };
  }
}

function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/next-auth\.session-token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

export function unauthorizedResponse(message: string = 'Unauthorized'): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
    }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
