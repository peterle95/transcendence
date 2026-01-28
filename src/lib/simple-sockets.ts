import { io } from "socket.io-client";

/*
 CLIENT-SIDE SOCKET INITIALIZATION
single 'socket' instance that will be used throughout the app.
 By pointing it to "http://localhost:4000", we tell the browser where 
 our separate WebSocket server is living
 */
export const socket = io("http://localhost:4000", {
    /*It means the client won't try to connect the very 
     moment this file is imported. Instead, we manually trigger the 
     connection in our React component using `socket.connect()`.
     This gives us more control over the connection lifecycle
     */
    autoConnect: false,
});
