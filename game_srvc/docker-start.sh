#!/bin/sh
set -e

export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/root_transcendence_ca.crt
#script consider value of NODE_ENV and runs accordingly
if [ "$NODE_ENV" = "production" ]; then
npx prisma migrate deploy
npm run start:socket &
SOCKET_PID=$!
trap 'kill -TERM "$SOCKET_PID" 2>/dev/null || true' INT TERM
npm run start
else
npx prisma db push
npm run dev:socket &
SOCKET_PID=$!
trap 'kill -TERM "$SOCKET_PID" 2>/dev/null || true' INT TERM
npm run dev
fi
