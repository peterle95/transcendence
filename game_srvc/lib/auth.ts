/**
 * Authentication middleware for game_srvc
 * Verifies JWT tokens from auth_srvc and syncs user data to game_db
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/prisma/prisma';

export interface AuthToken {
  sub: string;      // user id
  userId: number;
  username: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Verify token with auth_srvc
 * Calls auth service to validate JWT and get user claims
 */
export async function verifyTokenWithAuthService(token: string): Promise<AuthToken | null> {
  try {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000';
    
    const response = await fetch(`${authServiceUrl}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('[Auth] Token verification failed:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      sub: data.sub || String(data.userId),
      userId: data.userId || parseInt(data.sub),
      username: data.username,
      email: data.email,
      iat: data.iat,
      exp: data.exp,
    };
  } catch (error) {
    console.error('[Auth] Error verifying token with auth_srvc:', error);
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
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[Auth] Missing or invalid Authorization header');
      return null;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify with auth_srvc
    const authToken = await verifyTokenWithAuthService(token);
    if (!authToken) {
      console.warn('[Auth] Token verification failed');
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
    };
  }

  return {
    authenticated: true,
    user,
    status: 200,
  };
}
