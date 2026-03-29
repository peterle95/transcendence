const { Server } = require("socket.io");
const http = require("http");

const PORT = Number(process.env.SOCKET_PORT) || 4000;
const MAX_SLOTS = 4;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", players: slots.filter(Boolean).length }));
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

// Player slot tracking: index 0-3 → socket.id or null
const slots = new Array(MAX_SLOTS).fill(null);

function freeSlot(socketId) {
  const idx = slots.indexOf(socketId);
  if (idx !== -1) slots[idx] = null;
  return idx;
}

io.on("connection", (socket) => {
  // Assign the first available player slot
  const playerIdx = slots.indexOf(null);
  if (playerIdx === -1) {
    socket.emit("room_full");
    socket.disconnect(true);
    console.log("connection rejected – room full");
    return;
  }

  slots[playerIdx] = socket.id;
  console.log(`player connected: ${socket.id} → slot ${playerIdx}`);

  // Tell the new client their slot and who is already present
  socket.emit("init", {
    playerIdx,
    existing: slots.map((id, i) => ({ idx: i, connected: id !== null })),
  });

  // Tell everyone else a new player joined
  socket.broadcast.emit("player_joined", { playerIdx });

  // ── game state relay ────────────────────────────────────────────────
  socket.on("move", (state) => {
    socket.broadcast.emit("move", { playerIdx, state });
  });

  socket.on("laser", (laserData) => {
    socket.broadcast.emit("laser", { playerIdx, laserData });
  });

  // ── disconnection ───────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const idx = freeSlot(socket.id);
    console.log(`player disconnected: ${socket.id} (slot ${idx})`);
    io.emit("player_left", { playerIdx: idx });
  });
});

server.listen(PORT, () => {
  console.log(`socket server running on port ${PORT}`);
});
