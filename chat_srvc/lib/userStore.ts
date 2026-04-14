/**
 * Auth service proxy helpers for chat_srvc
 * Replaces the old in-memory mock user store with real auth_srvc API calls.
 */

import type { User } from '@/types';

// Must include auth_srvc Next.js basePath `/auth`.
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000/auth';

export async function getAllUsers(): Promise<never> {
  throw new Error('[userStore] getAllUsers is not supported — use auth_srvc /api/users/search');
}

export async function getUserById(userId: number, cookie?: string): Promise<User | null> {
  try {
    const headers: Record<string, string> = {};
    if (cookie) headers['cookie'] = cookie;

    const res = await fetch(`${AUTH_SERVICE_URL}/api/users/${userId}`, { headers });
    if (!res.ok) return null;

    const data = await res.json();
    return { id: userId, username: data.username, email: '' };
  } catch (error) {
    console.error('[userStore] getUserById error:', error);
    return null;
  }
}

export async function getFriends(cookie: string, authorization?: string): Promise<User[]> {
  try {
    const headers: Record<string, string> = { cookie };
    if (authorization) headers['Authorization'] = authorization;
    const res = await fetch(`${AUTH_SERVICE_URL}/api/friends`, { headers });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.data || []).map((f: any) => ({
      id: f.id,
      username: f.username,
      email: '',
    }));
  } catch (error) {
    console.error('[userStore] getFriends error:', error);
    return [];
  }
}
