import { Server as SocketIOServer, Socket } from 'socket.io';

export const socketHandler = (io: SocketIOServer) => {
    io.on('connection', (socket: Socket) => {
        console.log('Client connected:', socket.id);

        socket.on('join_room', (roomId: string) => {
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${roomId}`);
        });

        socket.on('send_message', (data: any) => {
            // Broadcast to the room
            if (data.roomId) {
                io.to(data.roomId).emit('receive_message', data);
            } else {
                // Fallback or global broadcast if needed, though usually chat is room-based
                socket.broadcast.emit('receive_message', data);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};
