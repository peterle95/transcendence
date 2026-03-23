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
    socket.join(`game_${roomId}`);
    if (!gameRooms.has(roomId)) gameRooms.set(roomId, new Map());
    gameRooms.get(roomId).set(socket.id, {
      userId:   socket.data.userId,
      username: socket.data.username,
      slot,
    });
    const players = Array.from(gameRooms.get(roomId).values());
    console.log(`[Room] ${socket.data.username} joined ${roomId} slot ${slot} — ${players.length} players`);
    io.to(`game_${roomId}`).emit("game_room_update", { players });
  });

  socket.on("game_room_start", ({ roomId }) => {
    const room = gameRooms.get(roomId);
    if (!room) return;
    const totalPlayers = room.size;
    console.log(`[Room] Host started ${roomId} with ${totalPlayers} players`);
    io.to(`game_${roomId}`).emit("game_room_ready", { totalPlayers });
  });

  socket.on("game_state", ({ roomId, ...state }) => {
    socket.to(`game_${roomId}`).emit("game_state", state);
  });

  socket.on("game_room_leave", ({ roomId }) => {
    socket.leave(`game_${roomId}`);
    cleanupRoom(roomId, socket.id);
    io.to(`game_${roomId}`).emit("game_peer_left");
  });

  socket.on("disconnect", () => {
    console.log(`disconnected: ${socket.id}`);
    gameRooms.forEach((_players, roomId) => {
      if (gameRooms.get(roomId)?.has(socket.id)) {
        cleanupRoom(roomId, socket.id);
        io.to(`game_${roomId}`).emit("game_peer_left");
      }
    });
  });
});

function cleanupRoom(roomId, socketId) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  room.delete(socketId);
  if (room.size === 0) gameRooms.delete(roomId);
}

server.listen(PORT, () => {
  console.log(`socket server running on port ${PORT}`);
});