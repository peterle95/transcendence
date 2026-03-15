#!/bin/sh
set -e

# Run database migrations / push schema (force-reset to avoid FK constraint
# violations from stale data in previous schema versions)
npx prisma db push --force-reset

# Start socket server in background, then run Next.js in foreground.
npm run dev:socket &
SOCKET_PID=$!

cleanup() {
  kill -TERM "$SOCKET_PID" 2>/dev/null || true
  wait "$SOCKET_PID" 2>/dev/null || true
}

trap cleanup INT TERM

npm run dev