import { NextResponse } from 'next/server';
import { userHelpers } from '@/lib/userStore';
import type { AddFriendRequest } from '@/types';

// mock friends user store api for demo
// in actual prod, this would be in auth_service with relational db 

/**
 * GET /api/friends?user_id={userId}
 * Returns list of friends for the specified user
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdStr = searchParams.get('user_id');
    
    if (!userIdStr) {
      return NextResponse.json(
        { success: false, error: 'user_id is required' },
        { status: 400 }
      );
    }
    
    const userId = parseInt(userIdStr, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: 'user_id must be a valid number' },
        { status: 400 }
      );
    }

    const friends = userHelpers.getFriends(userId);

    return NextResponse.json({
      success: true,
      friends
    });

  } catch (error) {
    console.error('Error fetching friends:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch friends' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/friends
 * Adds a friend relationship (bidirectional)
 * 
 * Body: { senderId: number, receiverId: number }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as AddFriendRequest;
    const { senderId, receiverId } = body;

    if (!senderId || !receiverId) {
      return NextResponse.json(
        { success: false, error: 'senderId and receiverId are required' },
        { status: 400 }
      );
    }

    if (senderId === receiverId) {
      return NextResponse.json(
        { success: false, error: 'Cannot add yourself as a friend' },
        { status: 400 }
      );
    }

    try {
      userHelpers.addFriendship(senderId, receiverId);

      return NextResponse.json({
        success: true,
        message: 'Friend added successfully'
      }, { status: 201 });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const statusCode = errorMessage.includes('do not exist') ? 404 : 409;
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: statusCode }
      );
    }

  } catch (error) {
    console.error('Error adding friend:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add friend' },
      { status: 500 }
    );
  }
}
