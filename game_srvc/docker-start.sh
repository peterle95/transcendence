#!/bin/sh
set -e

# Run database migrations / push schema (creates tables if they don't exist)
npx prisma db push --accept-data-loss

# Start socket server in background, then run Next.js in foreground.
npm run dev:socket &
SOCKET_PID=$!

cleanup() {
  kill -TERM "$SOCKET_PID" 2>/dev/null || true
  wait "$SOCKET_PID" 2>/dev/null || true
}

trap cleanup INT TERM

npm run dev