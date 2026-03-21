#!/bin/sh
set -e

# Run database migrations (safe for production – never wipes data)
npx prisma migrate deploy || npx prisma db push --accept-data-loss

# Start socket server in background, then run Next.js in foreground.
npm run start:socket &
SOCKET_PID=$!

cleanup() {
  kill -TERM "$SOCKET_PID" 2>/dev/null || true
  wait "$SOCKET_PID" 2>/dev/null || true
}

trap cleanup INT TERM

npm start