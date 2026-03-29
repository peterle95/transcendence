const { Server } = require("socket.io");
const http = require("http");


const PORT = Number(process.env.SOCKET_PORT) || 4000;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://auth_srvc:3000";


const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("game socket server is running");
});

const defaultOrigins = ["http://localhost:3002", "https://localhost:3002"];
const allowedOrigins = process.env.SOCKET_IO_ALLOWLIST
  ? process.env.SOCKET_IO_ALLOWLIST.split(",").map(s => s.trim())
  : defaultOrigins;

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});
// roomId → { host: socketId, players: Map<socketId, { userId, username, slot }> }
const gameRooms = new Map();

async function verifyToken(token) {
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { userId: data.userId, username: data.username };
  } catch {
    return null;
  }
}

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication token required"));
  const user = await verifyToken(token);
  if (!user) return next(new Error("Invalid or expired token"));
  socket.data.userId   = user.userId;
  socket.data.username = user.username;
  next();
});

io.on("connection", (socket) => {
  console.log(`connected: ${socket.id} (${socket.data.username})`);

  // Personal room for directed events (game invites, etc.)
  socket.join(`user_${socket.data.userId}`);

  socket.on("game_room_join", ({ roomId, slot }) => {
    // Issue #6: track first joiner as host
    if (!gameRooms.has(roomId)) {
      gameRooms.set(roomId, { host: socket.id, players: new Map() });
    }

    const room = gameRooms.get(roomId);

    // Issue #7: reject duplicate slot numbers
    const existingPlayers = Array.from(room.players.values());
    if (existingPlayers.some(p => p.slot === slot)) {
      socket.emit("error", { message: `Slot ${slot} is already taken` });
      return;
    }

    socket.join(`game_${roomId}`);
    room.players.set(socket.id, {
      userId:   socket.data.userId,
      username: socket.data.username,
      slot,
    });

    const players = Array.from(room.players.values());
    console.log(`[Room] ${socket.data.username} joined ${roomId} slot ${slot} — ${players.length} players`);
    io.to(`game_${roomId}`).emit("game_room_update", { players });
  });

  socket.on("game_room_start", ({ roomId }) => {
    const room = gameRooms.get(roomId);
    if (!room) return;

    // Issue #6: only the host can start the game
    if (room.host !== socket.id) {
      socket.emit("error", { message: "Only the host can start the game" });
      return;
    }

    const totalPlayers = room.players.size;
    console.log(`[Room] Host started ${roomId} with ${totalPlayers} players`);
    io.to(`game_${roomId}`).emit("game_room_ready", { totalPlayers });
  });

  // Issue #8: guard against oversized payloads and rate-limit to 50ms per socket
  const lastGameState = new Map();
  socket.on("game_state", ({ roomId, ...state }) => {
    const now = Date.now();
    const last = lastGameState.get(socket.id) || 0;
    if (now - last < 50) return;
    lastGameState.set(socket.id, now);

    const payloadSize = JSON.stringify(state).length;
    if (payloadSize > 4096) {
      console.warn(`[Room] Oversized game_state from ${socket.id} (${payloadSize} bytes)`);
      return;
    }

    socket.to(`game_${roomId}`).emit("game_state", state);
  });

  socket.on("game_room_leave", ({ roomId }) => {
    socket.leave(`game_${roomId}`);
    cleanupRoom(roomId, socket.id);
    io.to(`game_${roomId}`).emit("game_peer_left");
    lastGameState.delete(socket.id);
  });

  socket.on("disconnect", () => {
    console.log(`disconnected: ${socket.id}`);
    gameRooms.forEach((_room, roomId) => {
      if (gameRooms.get(roomId)?.players.has(socket.id)) {
        cleanupRoom(roomId, socket.id);
        io.to(`game_${roomId}`).emit("game_peer_left");
      }
    });
  });
});

function cleanupRoom(roomId, socketId) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  room.players.delete(socketId);
  if (room.players.size === 0) gameRooms.delete(roomId);
}

server.listen(PORT, () => {
  console.log(`socket server running on port ${PORT}`);
});