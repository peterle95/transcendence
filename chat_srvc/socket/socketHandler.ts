import { Server as SocketIOServer, Socket } from 'socket.io';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000';

interface SocketMessage {
    _id: string;
    sender_id: number;
    receiver_id: number;
    content: string;
    room_id: string;
    timestamp: Date;
}

async function verifySocketToken(token: string): Promise<{ userId: number; username: string } | null> {
    try {
        const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) return null;

        const data = await response.json();
        return { userId: data.userId, username: data.username };
    } catch (error) {
        console.error('[Socket Auth] Token verification error:', error);
        return null;
    }
}

export const socketHandler = (io: SocketIOServer) => {
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            console.warn(`[Socket Auth] Connection rejected: no token provided (${socket.id})`);
            return next(new Error('Authentication token required'));
        }

        const user = await verifySocketToken(token);
        if (!user) {
            console.warn(`[Socket Auth] Connection rejected: invalid token (${socket.id})`);
            return next(new Error('Invalid or expired token'));
        }

        socket.data.userId = user.userId;
        socket.data.username = user.username;
        next();
    });

    io.on('connection', (socket: Socket) => {
        console.log(`Client connected: ${socket.id} (user: ${socket.data.username}, id: ${socket.data.userId})`);

        socket.on('join_room', (roomId: string) => {
            const userId = socket.data.userId;
            const ids = roomId.split('_').map(Number);
            if (!ids.includes(userId)) {
                console.warn(`[Socket] User ${userId} attempted to join unauthorized room ${roomId}`);
                socket.emit('error', { message: 'Not authorized to join this room' });
                return;
            }

            socket.join(roomId);
            console.log(`Socket ${socket.id} joined room ${roomId}`);
        });

        socket.on('leave_room', (roomId: string) => {
            socket.leave(roomId);
            console.log(`Socket ${socket.id} left room ${roomId}`);
        });

        socket.on('new_message', () => {
            console.warn(`Socket ${socket.id} attempted to broadcast 'new_message' via socket, but emission is now server-authoritative.`);
        });

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id} (user: ${socket.data.username})`);
        });
    });
};
