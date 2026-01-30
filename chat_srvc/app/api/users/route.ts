import { NextResponse } from 'next/server';
import { userHelpers } from '@/lib/userStore';
import type { CreateUserRequest } from '@/types';

// mock users api would be in auth service postgresql db

/**
 * GET /api/users
 * Returns all mock users
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    users: userHelpers.getAllUsers()
  });
}

/**
 * POST /api/users
 * Creates a new mock user
 * 
 * Body: { username: string, email: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as CreateUserRequest;
    const { username, email } = body;

    if (!username || !email) {
      return NextResponse.json(
        { success: false, error: 'Username and email are required' },
        { status: 400 }
      );
    }

    try {
      const newUser = userHelpers.createUser(username, email);

      return NextResponse.json({
        success: true,
        user: newUser
      }, { status: 201 });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 409 }
      );
    }

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
