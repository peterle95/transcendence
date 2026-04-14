/**
 * Public URL prefix for this app (must match `basePath` in next.config.js).
 * Client-side fetch() must use this — `/api/...` alone hits the site root (e.g. frontend), not chat.
 */
export const CHAT_PUBLIC_BASE = process.env.NEXT_PUBLIC_CHAT_BASE_PATH || '/chat';
