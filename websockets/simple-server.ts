import { Server } from "socket.io";
import { createServer } from "http";

/**
 * 1. CREATE AN HTTP SERVER
 * Socket.IO needs an HTTP server to attach to. Even though WebSockets are a
 * different protocol, the initial "handshake" happens over HTTP.
 */
const httpServer = createServer();

/**
 * 2. INITIALIZE SOCKET.IO
 * We attach Socket.IO to our HTTP server.
 * CORS (Cross-Origin Resource Sharing) is essential because our Next.js app 
 * runs on port 3000 and this server runs on port 4000. Without this, the 
 * browser would block the connection for security reasons.
 */
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000", // The URL where your Next.js app is hosted
        methods: ["GET", "POST"]
    }
});

/**
 * 3. LISTEN FOR CONNECTIONS
 * The 'connection' event is the entry point. It fires every time a new 
 * user (browser tab) opens a connection. 
 * 'socket' represents the specific connection to that individual user.
 */
io.on("connection", (socket) => {
    // Every user gets a unique 'id' automatically
    console.log(`Client connected: ${socket.id}`);

    /**
     * EMIT vs ON
     * .emit("name", data) -> SENDS a message
     * .on("name", callback) -> LISTENS for a message
     */

    // Send a welcome message strictly TO THE USER who just connected
    socket.emit("server-message", "Welcome to the WebSocket server!");

    // Listen for a custom 'ping' event from the client
    socket.on("ping", () => {
        console.log(`Received ping from ${socket.id}`);
        // Respond back to the sender
        socket.emit("pong", "Pong from server!");
    });

    /**
     * BROADCASTING
     * Sending a message to everyone EXCEPT the sender.
     */
    socket.on("client-message", (data) => {
        console.log(`Received message from ${socket.id}:`, data);

        // socket.broadcast.emit sends to everyone connected EXCEPT this specific socket.
        // If you wanted to send to EVERYONE (including sender), you'd use io.emit(...)
        socket.broadcast.emit("server-message", `User ${socket.id} says: ${data}`);
    });

    // Handle user leaving or closing the tab
    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

/**
 * 4. START THE SERVER
 * We listen on port 4000. You'll run this with `npm run ws:test`.
 */
const PORT = 4000;
httpServer.listen(PORT, () => {
    console.log(`WebSocket server is running on http://localhost:${PORT}`);
});
