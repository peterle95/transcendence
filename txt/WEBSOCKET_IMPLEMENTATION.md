# WebSocket Implementation Guide

## Overview
The chat service now uses a custom Node.js server to support WebSockets via Socket.IO, running alongside the Next.js application.

## Architecture
- **Server**: A custom `server.ts` replaces the standard `next start` command. It initializes an HTTPS server using Node's `https` module and attaches Socket.IO to it.
- **SSL**: Self-signed certificates are used for development to support HTTPS.
- **Socket Handler**: Logic for socket events is encapsulated in `socket/socketHandler.ts`.

## Setup

### Prerequisites
- `openssl` (for generating certificates)
- `ts-node` (for running the TypeScript server)

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Generate SSL certificates (if they don't exist):
   ```bash
   mkdir -p certs
   openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj '/CN=localhost'
   ```

### Running the Server
To start the development server with WebSocket support:
```bash
npm run dev
```
This command runs `ts-node server.ts`.

## Client Connection
Clients should connect to the secure WebSocket URL:
```javascript
import { io } from "socket.io-client";

const socket = io("https://localhost:3001", {
  secure: true,
  rejectUnauthorized: false // Needed for self-signed certs in dev
});
```
