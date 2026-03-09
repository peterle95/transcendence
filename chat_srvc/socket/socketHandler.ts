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
    // Middleware to authenticate connections and populate socket.data.userId
    io.use((socket, next) => {
        // TODO: Implement actual connection authentication here.
        // Extract token from socket.handshake.auth.token or headers,
        // verify it, and populate socket.data.userId with the authenticated user ID.
        // const token = socket.handshake.auth.token;
        // if (!isValid(token)) {
        //     return next(new Error("unauthorized"));
        // }
        // socket.data.userId = decodeUser(token).id;

        next();
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
