#!/bin/sh
set -e

# Start socket server in background, then run Next.js in foreground.
npm run dev:socket &
SOCKET_PID=$!

cleanup() {
  kill -TERM "$SOCKET_PID" 2>/dev/null || true
  wait "$SOCKET_PID" 2>/dev/null || true
}

trap cleanup INT TERM

npm run dev