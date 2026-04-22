import dbConnect from '@/lib/dbConnect';
import Message from '@/models/Message';
import { authenticateRequest, unauthorizedResponse } from '@/lib/authMiddleware';

/**
 * GET /api/chat/history?friend_id=205
 * 
 * Retrieves the chat history between the authenticated user and another user.
 * 
 * Headers Required:
 *   - Authorization: Bearer <token> (from auth_srvc /api/auth/token)
 * 
 * Query Parameters:
 *   - friend_id: The ID of the other user in the conversation
 *   - limit: Number of messages to return (default 50, max 100)
 *   - before: Cursor — only return messages with _id less than this value
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
    const auth = await authenticateRequest(request);
    
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(auth.error);
    }

    const user_id = auth.userId;

    const { searchParams } = new URL(request.url);
    const friend_id_str = searchParams.get('friend_id');
    const explicit_room_id = searchParams.get('room_id');

    let room_id: string;

    if (explicit_room_id && explicit_room_id.startsWith('group_')) {
      const ids = explicit_room_id.slice(6).split('_').map(Number);
      if (ids.some(isNaN) || ids.length < 2 || !ids.includes(user_id)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid group room_id or user not a member' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      room_id = explicit_room_id;
    } else {
      if (!friend_id_str) {
        return new Response(
          JSON.stringify({ success: false, error: 'friend_id or room_id query parameter is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const friend_id = parseInt(friend_id_str, 10);
      if (isNaN(friend_id) || friend_id <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'friend_id must be a valid positive number' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (user_id === friend_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cannot retrieve conversation with yourself' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      room_id = Message.generateRoomId(user_id, friend_id);
    }

    await dbConnect();

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
    const before = searchParams.get('before');

    const messages = await Message.find({
      room_id,
      ...(before ? { _id: { $lt: before } } : {}),
    })
      .sort({ timestamp: -1 })
      .limit(limit)
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
