import dbConnect from '@/lib/dbConnect';
import Message from '@/models/Message';
import { authenticateRequest, unauthorizedResponse } from '@/lib/authMiddleware';
import type { SendMessageRequest } from '@/types';

/**
 * POST /api/chat/send
 * 
 * Sends a message from the authenticated user to another user.
 * 
 * Headers Required:
 *   - Authorization: Bearer <token> (from auth_srvc /api/auth/token)
 * 
 * Request Body:
 *   {
 *     "receiver_id": 205,
 *     "content": "Hello there!"
 *   }
 * 
 * Response:
 *   {
 *     "success": true,
 *     "message": { ...message object }
 *   }
 */
export async function POST(request: Request) {
  try {

    const auth = await authenticateRequest(request);

    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(auth.error);
    }

    const sender_id = auth.userId;

    //parse body
    let body: SendMessageRequest;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON body',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { receiver_id, content } = body;

    // inp validation
    if (!receiver_id || typeof receiver_id !== 'number') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'receiver_id is required and must be a number',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'content is required and must be a non-empty string',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const MAX_MESSAGE_LENGTH = 2000;
    if (content.trim().length > MAX_MESSAGE_LENGTH) {
      return new Response(JSON.stringify({
        success: false,
        error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    //to not query self
    if (sender_id === receiver_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cannot send a message to yourself',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    await dbConnect();

    const room_id = Message.generateRoomId(sender_id, receiver_id);

    //create + save msg
    const message = await Message.create({
      sender_id,
      receiver_id,
      content: content.trim(),
      room_id,
    });

    const payload = {
      _id: message._id.toString(),
      sender_id: message.sender_id,
      receiver_id: message.receiver_id,
      content: message.content,
      room_id: message.room_id,
      timestamp: message.timestamp,
    };

    // Broadcast authoritatively from the server after successful save
    if ((global as any).io) {
      // emit to room (which matches room_id)
      (global as any).io.to(room_id).emit('receive_message', payload);
    } else {
      console.warn('Global Socket.io instance not found, message was not broadcasted.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: payload,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in POST /api/chat/send:', error);

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
