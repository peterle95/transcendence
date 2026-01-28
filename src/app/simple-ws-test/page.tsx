"use client";

import { useEffect, useState } from "react";
import { socket } from "@/src/lib/simple-sockets";

export default function SimpleWsTestPage() {
    // STATE: React monitors these variables. When they change, the UI updates.
    const [isConnected, setIsConnected] = useState(false);
    const [transport, setTransport] = useState("N/A");
    const [logs, setLogs] = useState<string[]>([]);
    const [messageInput, setMessageInput] = useState("");

    /*
     This is where manage the socket connection. 
     It runs once when the component is "mounted" (shown on screen).
     */
    useEffect(() => {
        /*
         DEFINE LISTENERS
         These functions run when the server shouts something at us.
         */
        function onConnect() {
            setIsConnected(true);
            // 'transport' tells us if we are using "polling" or "websocket"
            setTransport(socket.io.engine.transport.name);

            // Socket.IO often starts with polling and "upgrades" to websockets
            socket.io.engine.on("upgrade", (transport: any) => {
                setTransport(transport.name);
            });

            addLog("Connected to server");
        }

        function onDisconnect() {
            setIsConnected(false);
            setTransport("N/A");
            addLog("Disconnected from server");
        }

        function onPong(data: string) {
            addLog(`Received pong: ${data}`);
        }

        function onServerMessage(data: string) {
            addLog(`Server: ${data}`);
        }

        /*
         REGISTER LISTENERS
      "When you hear 'connect', run the onConnect function"
         */
        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("pong", onPong);
        socket.on("server-message", onServerMessage);

        /*
         INITIATE CONNECTION
         Since we set 'autoConnect: false', we must manually call .connect()
         */
        socket.connect();

        /*
         CLEANUP (EXTREMELY IMPORTANT)
         This function runs when the user leaves the page.
         If we don't 'off' these listeners, they will keep running in the 
         background, causing memory leaks and bugs!
         */
        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("pong", onPong);
            socket.off("server-message", onServerMessage);
            socket.disconnect(); // Close the connection when leaving
        };
    }, []);

    // Helper function to show messages in our UI log window
    const addLog = (msg: string) => {
        setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
    };

    /*
     EVENT HANDLERS
     Triggered by button clicks or form submits.
     */
    const handlePing = () => {
        addLog("Sending ping...");
        socket.emit("ping"); // Send 'ping' event to server
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (messageInput.trim()) {
            addLog(`Sending message: ${messageInput}`);
            // Send 'client-message' event to server with our text
            socket.emit("client-message", messageInput);
            setMessageInput(""); // Clear input box
        }
    };

    return (
            <div>
                <header>
                    <h1>WebSocket Test</h1>
                    <div>
                        <div>
                            {/* Visual indicator for connection status */}
                            <span className={`${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                            <span>{isConnected ? "Connected" : "Disconnected"}</span>
                        </div>
                        <div>
                            Transport: <span>{transport}</span>
                        </div>
                    </div>
                </header>

                <section>
                    <div>
                        {/* Toggle button to connect/disconnect */}
                        <button
                            onClick={isConnected ? () => socket.disconnect() : () => socket.connect()}
                            className={`font-medium transition-colors ${isConnected
                                ? "bg-red-900/30 text-red-200 hover:bg-red-900/50"
                                : "bg-green-900/30 text-green-200 hover:bg-green-900/50"
                                }`}
                        >
                            {isConnected ? "Disconnect" : "Connect"}
                        </button>
                        <button
                            onClick={handlePing}
                            disabled={!isConnected}
                        >
                            Send Ping
                        </button>
                    </div>

                    {/* Chat Input Form */}
                    <form onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            placeholder="Type a message..."
                            disabled={!isConnected}
                        />
                        <button
                            type="submit"
                            disabled={!isConnected || !messageInput.trim()}
                        >
                            Send
                        </button>
                    </form>
                </section>

                {/* Log View Window */}
                <section>
                    {logs.length === 0 ? (
                        <div>No logs yet</div>
                    ) : (
                        <div>
                            {logs.map((log, i) => (
                                <div key={i} >
                                    {log}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
    );
}
