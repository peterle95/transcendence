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
    io.on('connection', (socket: Socket) => {
        console.log('Client connected:', socket.id);

        // Client joins a chat room (e.g. "1_2")
        socket.on('join_room', (roomId: string) => {
            socket.join(roomId);
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
                // Broadcast to everyone in the room EXCEPT the sender
                socket.to(message.room_id).emit('receive_message', message);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};
