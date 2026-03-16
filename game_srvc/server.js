const { Server } = require("socket.io");
const http = require("http");

const PORT = Number(process.env.PORT) || 4000;

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

let players = [];

io.on("connection", (socket) => {

  console.log("player connected:", socket.id);

  players.push(socket.id);

  // send current player list
  io.emit("players", players);

  socket.on("move", (data) => {

    console.log("move from", socket.id, data);

    // broadcast to everyone except sender
    socket.broadcast.emit("move", {
      player: socket.id,
      move: data
    });

  });

  socket.on("disconnect", () => {

    console.log("player disconnected:", socket.id);

    players = players.filter(id => id !== socket.id);

    io.emit("players", players);

  });

});

server.listen(PORT, () => {
  console.log(`socket server running on port ${PORT}`);
});