/**
 * Public URL prefix for this app (must match `basePath` in next.config.js).
 * Client-side fetch() must use this — `/api/...` alone hits the site root (e.g. frontend), not chat.
 */
export const CHAT_PUBLIC_BASE = process.env.NEXT_PUBLIC_CHAT_BASE_PATH || '/chat';

/**
 * Socket.IO path (must match server `SOCKET_PATH` in docker-compose and nginx `/chat/socket.io`).
 * Baked via next.config `env` so the client never falls back to root `/socket.io` (frontend 404).
 */
export const CHAT_SOCKET_PATH =
  process.env.NEXT_PUBLIC_CHAT_SOCKET_PATH || '/chat/socket.io/';
