import dbConnect from '@/lib/dbConnect';
import Message from '@/models/Message';
import { authenticateRequest, unauthorizedResponse } from '@/lib/authMiddleware';

/**
 * GET /api/chat/history?friend_id=205
 * 
 * Retrieves the chat history between the authenticated user and another user.
 * 
 * Headers Required:
 *   - x-mock-user-id: The ID of the current user (e.g., "101")
 * 
 * Query Parameters:
 *   - friend_id: The ID of the other user in the conversation
 * 
 * Response:
 *   {
 *     "success": true,
 *     "messages": [ ...array of message objects ],
 *     "room_id": "101_205",
 *     "count": 42
 *   }
 */
export async function GET(request: Request) {
  try {
    const auth = authenticateRequest(request);
    
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(auth.error);
    }

    const user_id = auth.userId;

    const { searchParams } = new URL(request.url);
    const friend_id_str = searchParams.get('friend_id');

    if (!friend_id_str) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'friend_id query parameter is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const friend_id = parseInt(friend_id_str, 10);

    if (isNaN(friend_id) || friend_id <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'friend_id must be a valid positive number',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    //don't query self
    if (user_id === friend_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cannot retrieve conversation with yourself',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    await dbConnect();

    //room_id
    const room_id = Message.generateRoomId(user_id, friend_id);

    // messages sorted by timestamp
    const messages = await Message.find({ room_id })
      .sort({ timestamp: 1 })
      .select('_id sender_id receiver_id content room_id timestamp')
      .lean();

    return new Response(
      JSON.stringify({
        success: true,
        messages,
        room_id,
        count: messages.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/chat/history:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
