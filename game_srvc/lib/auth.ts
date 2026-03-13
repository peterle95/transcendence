/**
 * Authentication middleware for game_srvc
 * Verifies authenticated session via auth_srvc and syncs user data to game_db
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';

export interface AuthToken {
  sub: string;      // user id (string)
  userId: number;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify current authenticated session with auth_srvc
 * Uses existing NextAuth endpoint to avoid auth_srvc changes
 */
export async function verifySessionWithAuthService(request: NextRequest): Promise<AuthToken | null> {
  try {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000';
    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(`${authServiceUrl}/api/auth/session`, {
      method: 'GET',
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });

    if (!response.ok) {
      console.error('[Auth] Session verification failed:', response.status);
      return null;
    }

    const data = await response.json();
    const user = data?.user;
    const rawUserId = user?.id;
    const userId = typeof rawUserId === 'string' ? parseInt(rawUserId, 10) : Number(rawUserId);

    if (!user || Number.isNaN(userId)) {
      return null;
    }

    const username = user.name || `user_${userId}`;
    const email = user.email || `user_${userId}@local.invalid`;

    return {
      sub: String(userId),
      userId,
      username,
      email,
    };
  } catch (error) {
    console.error('[Auth] Error verifying session with auth_srvc:', error);
    return null;
  }
}

/**
 * Sync user data to game_db (create or update User record)
 */
export async function syncUserToGameDb(authToken: AuthToken): Promise<any> {
  try {
    const user = await prisma.user.upsert({
      where: { id: authToken.userId },
      update: {
        username: authToken.username,
        email: authToken.email,
      },
      create: {
        id: authToken.userId,
        username: authToken.username,
        email: authToken.email,
      },
    });
    return user;
  } catch (error) {
    console.error('[Auth] Error syncing user to gameDb:', error);
    throw error;
  }
}

/**
 * Extract and verify auth token from request headers
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthToken | null> {
  try {
    // Verify current browser session with auth_srvc
    const authToken = await verifySessionWithAuthService(request);
    if (!authToken) {
      console.warn('[Auth] Session verification failed');
      return null;
    }

    // Sync user to game_db
    await syncUserToGameDb(authToken);

    return authToken;
  } catch (error) {
    console.error('[Auth] Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Middleware guard for protected API routes
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      authenticated: false,
      error: 'Unauthorized',
      status: 401,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return {
    authenticated: true,
    user,
    status: 200,
  };
}
