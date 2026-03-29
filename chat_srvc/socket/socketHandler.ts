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

// ─── Game room registry: roomId → Map<socketId, { userId, username, slot }> ──
const gameRooms = new Map<string, Map<string, { userId: number; username: string; slot: number }>>();

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

        socket.data.userId = Number(user.userId);
        socket.data.username = user.username;
        next();
    });

    io.on('connection', (socket: Socket) => {
        console.log(`Client connected: ${socket.id} (user: ${socket.data.username}, id: ${socket.data.userId})`);

        // Personal notification room — used for game invites and other directed events
        socket.join(`user_${socket.data.userId}`);

        // ── Chat rooms ──────────────────────────────────────────────────────────
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

        // ── Game rooms ──────────────────────────────────────────────────────────
        socket.on('game_room_join', ({ roomId, slot }: { roomId: string; slot: number }) => {
            const gameRoom = `game_${roomId}`;
            socket.join(gameRoom);

            if (!gameRooms.has(roomId)) gameRooms.set(roomId, new Map());
            gameRooms.get(roomId)!.set(socket.id, {
                userId:   socket.data.userId,
                username: socket.data.username,
                slot,
            });

            const players = Array.from(gameRooms.get(roomId)!.values());
            console.log(`[GameRoom] ${socket.data.username} joined room ${roomId} as slot ${slot}. Players: ${players.length}`);

            // Tell everyone in the room the current player list
            io.to(gameRoom).emit('game_room_update', { players });
        });

        // Host explicitly starts the game — broadcast game_room_ready to all in the room
        socket.on('game_room_start', ({ roomId }: { roomId: string }) => {
            const room = gameRooms.get(roomId);
            if (!room) return;
            const totalPlayers = room.size;
            console.log(`[GameRoom] Host started room ${roomId} with ${totalPlayers} players`);
            io.to(`game_${roomId}`).emit('game_room_ready', { totalPlayers });
        });

        // Relay compressed input state to the other player in the same game room
        socket.on('game_state', ({ roomId, ...state }: { roomId: string; [key: string]: unknown }) => {
            socket.to(`game_${roomId}`).emit('game_state', state);
        });

        // One player left the game
        socket.on('game_room_leave', ({ roomId }: { roomId: string }) => {
            socket.leave(`game_${roomId}`);
            cleanupGameRoom(roomId, socket.id);
            io.to(`game_${roomId}`).emit('game_peer_left');
        });

        // ── Cleanup on disconnect ───────────────────────────────────────────────
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id} (user: ${socket.data.username})`);

            // Clean up any game rooms this socket was part of
            gameRooms.forEach((_players, roomId) => {
                if (gameRooms.get(roomId)?.has(socket.id)) {
                    cleanupGameRoom(roomId, socket.id);
                    io.to(`game_${roomId}`).emit('game_peer_left');
                }
            });
        });
    });

    function cleanupGameRoom(roomId: string, socketId: string) {
        const room = gameRooms.get(roomId);
        if (!room) return;
        room.delete(socketId);
        if (room.size === 0) gameRooms.delete(roomId);
    }
};
