/**
 * mock auth middleware
 * 
 * this is a placeholder authentication system that will be replaced
 * with JWT validation
 */

import type { AuthResult } from '@/types';

/**
 * 
 * @param request - Next.js request object
 * @returns Authentication result with userId if authenticated
 */
export function authenticateRequest(request: Request): AuthResult {
  const mockUserId = request.headers.get('x-mock-user-id');

  if (!mockUserId) {
    return {
      authenticated: false,
      error: 'Missing x-mock-user-id header',
    };
  }

  const userId = parseInt(mockUserId, 10);

  if (isNaN(userId) || userId <= 0) {
    return {
      authenticated: false,
      error: 'Invalid x-mock-user-id header value',
    };
  }

  return {
    authenticated: true,
    userId,
  };
}

/**
 * 
 * @param message - Error message
 * @returns Next.js Response object with 401 status
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
