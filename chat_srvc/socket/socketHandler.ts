import { Server as SocketIOServer, Socket } from 'socket.io';

// Matches the existing Message type from @/types
interface SocketMessage {
    _id: string;
    sender_id: number;
    receiver_id: number;
    content: string;
    room_id: string;
    timestamp: Date;
}

export const socketHandler = (io: SocketIOServer) => {
    // Middleware to authenticate connections via auth_srvc session
    io.use(async (socket, next) => {
        try {
            const cookie = socket.handshake.headers.cookie || '';
            if (!cookie) {
                return next(new Error('unauthorized: no session cookie'));
            }

            const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000';
            const res = await fetch(`${authUrl}/api/auth/session`, {
                headers: { cookie },
            });

            if (!res.ok) {
                return next(new Error('unauthorized: auth service rejected'));
            }

            const data = await res.json();
            if (!data?.user?.id) {
                return next(new Error('unauthorized: no valid session'));
            }

            socket.data.userId = typeof data.user.id === 'string'
                ? parseInt(data.user.id, 10)
                : data.user.id;
            socket.data.username = data.user.name || `user_${socket.data.userId}`;
            next();
        } catch (err) {
            console.error('[socketHandler] Auth middleware error:', err);
            next(new Error('unauthorized: auth check failed'));
        }
    });

    io.on('connection', (socket: Socket) => {
        console.log('Client connected:', socket.id);

        // Client joins a chat room (e.g. "1_2")
        socket.on('join_room', (roomId: string) => {
            // TODO: Optional: Verify that socket.data.userId is authorized
            // to join this specific roomId (e.g., if roomId is "userId_peerId").
            socket.join(roomId); // Server adds socket to room
            console.log(`Socket ${socket.id} joined room ${roomId}`);
        });

        // Client leaves a chat room
        socket.on('leave_room', (roomId: string) => {
            socket.leave(roomId);
            console.log(`Socket ${socket.id} left room ${roomId}`);
        });

        // The 'new_message' event has been centralized to the server-side REST API
        // in chat_srvc/app/api/chat/send/route.ts. The server now emits this authoritatively 
        // after a successful DB save. We log a warning if clients still try to emit it.
        socket.on('new_message', () => {
            console.warn(`Socket ${socket.id} attempted to broadcast 'new_message' via socket, but emission is now server-authoritative.`);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};
