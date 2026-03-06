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

        // When a message is sent via REST API, the client emits this
        // to broadcast the saved message to others in the room
        socket.on('new_message', (message: SocketMessage) => {
            if (message.room_id) {
                // Check membership before emitting to prevent unauthorized broadcasts
                if (socket.rooms.has(message.room_id)) {
                    // Broadcast to everyone in the room EXCEPT the sender
                    socket.to(message.room_id).emit('receive_message', message);
                } else {
                    console.warn(`Socket ${socket.id} attempted to broadcast to unjoined room ${message.room_id}`);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};
