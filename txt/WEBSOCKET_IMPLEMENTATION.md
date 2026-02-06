# WebSocket Implementation for Chat Service

This document describes the WebSocket implementation using Socket.io for the Chat Service.

## Architecture

The Chat Service now includes a dedicated Socket.io server integrated with Next.js.

### Components

1.  **Server (`server.ts`)**: Custom Next.js server entry point that initializes the HTTP server and attaches Socket.io.
2.  **Socket Module (`socket/socketServer.ts`)**: Contains the core logic for connection handling, authentication, room management, and event listeners.
3.  **Client (`app/components/ChatInterface.tsx`)**: React component updated to use `socket.io-client` for real-time bidirectional communication.

## Features

-   **Authentication**: Uses `x-mock-user-id` header (compatible with future JWT implementation).
-   **Connection**: Persistent WebSocket connection.
-   **Messaging**: Real-time sending and receiving of messages.
-   **Persistence**: Messages are saved to MongoDB via Mongoose before being broadcasted.
-   **Rooms**: Users join a personal room `user_{userId}` to receive private messages.

## How to Run

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Development Server**:
    The standard `npm run dev` now uses `ts-node` to run `server.ts`.
    ```bash
    npm run dev
    ```

3.  **Run Tests**:
    To verify the WebSocket functionality, you can run the standalone test script (requires server to be running):
    ```bash
    # Ensure server is running in another terminal
    npx ts-node tests/socket_test_script.ts
    ```

## Future Improvements

-   **JWT Authentication**: Replace mock ID with real JWT validation in `socketServer.ts`.
-   **Presence**: Implement online/offline status using socket connection events.
-   **Typing Indicators**: Add `typing` and `stop_typing` events (scaffolded in server code).
-   **Read Receipts**: Implement `message_read` events.

## Integration with Other Services

-   **Game Service**: Should also implement WebSockets (or reuse this pattern) for real-time game state updates.
-   **Frontend**: The frontend service needs to be updated to connect to the Chat Service's WebSocket port (3001) or via a reverse proxy/gateway if deployed.

