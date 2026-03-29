# Codebase Issues & Fixes

---

## CRITICAL

### 1. `game_srvc` — Runtime crash on token route
**File:** `game_srvc/app/api/auth/token/route.ts` line 10
**Problem:** `ProcessingInstruction.env.AUTH_SERVICE_URL` — `ProcessingInstruction` is a browser DOM interface, not the Node process object. This route crashes at runtime.
**Fix:** Change `ProcessingInstruction.env` to `process.env`.

---

## CHAT SERVICE (`chat_srvc`)

### 2. No message length limit
**File:** `app/api/chat/send/route.ts`
**Problem:** Content is validated as non-empty but there is no upper bound. A client can send a multi-megabyte string which gets saved to MongoDB and broadcast to all room members.
**Fix:** Add a max length check after the empty check:
```ts
const MAX_MESSAGE_LENGTH = 2000;
if (content.trim().length > MAX_MESSAGE_LENGTH) {
  return new Response(JSON.stringify({
    success: false,
    error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
  }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}
```

### 3. No pagination on chat history
**File:** `app/api/chat/history/route.ts`
**Problem:** Returns every message ever sent between two users in a single query with no limit. Will become slow and memory-intensive over time.
**Fix:** Add `limit` (default 50, max 100) and `before` (cursor by `_id`) query parameters:
```ts
const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
const before = searchParams.get('before');
const messages = await Message.find({
  room_id,
  ...(before ? { _id: { $lt: before } } : {}),
})
  .sort({ timestamp: -1 })
  .limit(limit)
  .lean();
```

### 4. `getFriends` only forwards the cookie, not the Bearer token
**File:** `lib/userStore.ts` — `getFriends` function
**Problem:** Only passes the `cookie` header to auth_srvc. In any context where a Bearer token is the only credential (e.g. mobile clients), the request silently returns `[]` instead of the real friends list.
**Fix:** Accept and forward an optional `authorization` header alongside the cookie:
```ts
export async function getFriends(cookie: string, authorization?: string): Promise<User[]> {
  const headers: Record<string, string> = { cookie };
  if (authorization) headers['Authorization'] = authorization;
  const res = await fetch(`${AUTH_SERVICE_URL}/api/friends`, { headers });
  // ...
}
```
And in `app/api/friends/route.ts`, pass the Authorization header through when calling `getFriends`.

### 5. `join_room` authorization can be bypassed with a crafted room ID
**File:** `socket/socketHandler.ts` lines 64–75
**Problem:** `roomId.split('_').map(Number)` produces `NaN` for non-numeric segments. A room ID like `"123_abc"` would result in `[123, NaN]`, and `ids.includes(userId)` would return `true` for user 123, granting access to an unintended room.
**Fix:** Validate that the room ID has exactly two valid numeric parts:
```ts
const ids = roomId.split('_').map(Number);
if (ids.length !== 2 || ids.some(isNaN) || !ids.includes(userId)) {
  socket.emit('error', { message: 'Not authorized to join this room' });
  return;
}
```

### 6. `game_room_start` has no host authorization
**File:** `socket/socketHandler.ts` lines 106–112
**Problem:** Any socket connected to a game room can emit `game_room_start` and trigger `game_room_ready` for all players. There is no check for who created the room.
**Fix:** Track the first socket to join a room as the host. Store the host `socketId` in the `gameRooms` map and gate `game_room_start` behind an identity check:
```ts
// Store host when first player joins
if (!gameRooms.has(roomId)) {
  gameRooms.set(roomId, { host: socket.id, players: new Map() });
}
// In game_room_start:
if (gameRooms.get(roomId)?.host !== socket.id) {
  socket.emit('error', { message: 'Only the host can start the game' });
  return;
}
```

### 7. `game_room_join` allows duplicate slot numbers
**File:** `socket/socketHandler.ts` lines 87–103
**Problem:** No check whether the requested slot is already occupied by another player. Two players can both claim slot 1, corrupting the player list sent to all room members.
**Fix:** Before registering the player, check for slot conflicts:
```ts
const existingPlayers = Array.from(gameRooms.get(roomId)!.values());
if (existingPlayers.some(p => p.slot === slot)) {
  socket.emit('error', { message: `Slot ${slot} is already taken` });
  return;
}
```

### 8. `game_state` relay has no size or rate limit
**File:** `socket/socketHandler.ts` lines 115–117
**Problem:** The server blindly relays any payload the client sends with no throttle or size validation. A malicious or broken client can spam arbitrarily large objects, consuming server bandwidth and potentially degrading all other connections.
**Fix:** Add a simple size guard:
```ts
socket.on('game_state', ({ roomId, ...state }) => {
  const payloadSize = JSON.stringify(state).length;
  if (payloadSize > 4096) {
    console.warn(`[GameRoom] Oversized game_state from ${socket.id} (${payloadSize} bytes)`);
    return;
  }
  socket.to(`game_${roomId}`).emit('game_state', state);
});
```
For rate limiting, track the last emit timestamp per socket and drop events that arrive faster than a defined interval (e.g. 50ms).

### 9. `getAllUsers` in `userStore.ts` is a silent dead stub
**File:** `lib/userStore.ts` lines 10–13
**Problem:** `getAllUsers` logs a warning and returns `[]` silently. Any caller that depends on it gets an empty result with no error, making the failure invisible and hard to debug.
**Fix:** Either remove the function entirely, or throw explicitly:
```ts
export async function getAllUsers(): Promise<never> {
  throw new Error('[userStore] getAllUsers is not supported — use auth_srvc /api/users/search');
}
```

### 10. `game-invite` ALLOWED_ORIGINS hardcodes localhost
**File:** `app/api/game-invite/route.ts` lines 14–18
**Problem:** The CORS allowlist is hardcoded to localhost ports. Any non-localhost deployment will have CORS rejected with no code change.
**Fix:** Read from an environment variable with localhost as the fallback:
```ts
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:3001,http://localhost:3002,http://localhost:3003'
).split(',').map(s => s.trim());
```

### 11. Port and hostname are hardcoded in `server.ts`
**File:** `server.ts` lines 12–13
**Problem:** `const hostname = 'localhost'` and `const port = 3001` are hardcoded, making them impossible to override via environment variables.
**Fix:**
```ts
const port = parseInt(process.env.PORT ?? '3001', 10);
const hostname = process.env.HOSTNAME ?? 'localhost';
```

### 12. `rejectUnauthorized: false` in the socket client
**File:** `app/components/ChatInterface.tsx` line 57
**Problem:** Disables SSL certificate validation on the socket connection. Added to handle self-signed dev certs but will carry into production, leaving the connection vulnerable to man-in-the-middle attacks.
**Fix:** Remove the option entirely, or gate it on `NODE_ENV`:
```ts
const socket = io({
  auth: { token: authToken },
  ...(process.env.NODE_ENV === 'development' ? { rejectUnauthorized: false } : {}),
});
```

### 13. `fetchHistory` is called twice on component mount
**File:** `app/components/ChatInterface.tsx` lines 56–83
**Problem:** `fetchHistory` is called inside the socket `connect` handler and also in a separate `useEffect`. On initial mount both fire, resulting in two identical HTTP requests and two state updates.
**Fix:** Remove the standalone `useEffect` that calls `fetchHistory` and rely only on the one inside the socket `connect` handler, which only fires after the socket is ready and the room has been joined.

### 14. `alert()` used for send errors
**File:** `app/components/ChatInterface.tsx` lines 110 and 113
**Problem:** `alert()` is a blocking browser dialog. It freezes the UI and is poor UX.
**Fix:** Add an error state and render it inline in the component:
```ts
const [sendError, setSendError] = useState<string | null>(null);
// On error:
setSendError(error.error || 'Transmission failed');
// In JSX, render below the input form.
```

### 15. Dead `SocketMessage` interface
**File:** `socket/socketHandler.ts` lines 5–12
**Problem:** The `SocketMessage` interface is declared at the top of the file but never referenced anywhere.
**Fix:** Delete it.

---

## AUTH SERVICE (`auth_srvc`)

### 16. CORS middleware is missing
**File:** `proxy.ts` / `next.config.js`
**Problem:** `next.config.js` comments say CORS is handled by `middleware.ts`, but that file does not exist. `proxy.ts` exports a middleware-style `config` but Next.js only loads a file named exactly `middleware.ts` at the project root. CORS headers from `proxy.ts` are never applied, so browser requests from the frontend (port 3003) to auth (port 3000) may fail CORS.
**Fix:** Rename `proxy.ts` to `middleware.ts` and ensure it exports a proper default middleware function, not just a `config` export.

### 17. Brute-force lockout is in-memory only
**File:** `lib/auth-config.ts` lines 8–12
**Problem:** The `failedLogins` map resets on every server restart. A server restart (crash, redeploy) fully resets all lockout state. This is acknowledged in a comment but is a real production gap.
**Fix (long-term):** Back the lockout with a Redis key with TTL, or a `LoginAttempt` table in Postgres. For now, at minimum the comment correctly documents the limitation.

---

## FRONTEND (`frontend`)

### 18. Hardcoded localhost URLs on the dashboard
**File:** `app/page.tsx`
**Problem:** Links to the game and chat services use hardcoded `http://localhost:3001` and `http://localhost:3002`. Any non-localhost deployment breaks without code changes.
**Fix:** Use environment variables:
```ts
const CHAT_URL = process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || 'http://localhost:3001';
const GAME_URL = process.env.NEXT_PUBLIC_GAME_SERVICE_URL || 'http://localhost:3002';
```

### 19. `frontend` Dockerfile may fail to build
**File:** `frontend/Dockerfile`
**Problem:** `npm ci --only=production` omits devDependencies. Next.js builds often require TypeScript types, ESLint packages, and other tools that live in `devDependencies`. The image build may fail.
**Fix:** Use `npm ci` (without `--only=production`) for the build step, then optionally prune after:
```dockerfile
RUN npm ci
RUN npm run build
RUN npm prune --production
```

---

## GAME SERVICE (`game_srvc`)

### 20. `dockerode` dependency is unused
**File:** `game_srvc/package.json`
**Problem:** `dockerode` is listed as a dependency but is never imported anywhere in the codebase.
**Fix:** Remove it: `npm uninstall dockerode` in `game_srvc/`.

### 21. Prisma `GlobalLeaderboard` schema contradiction
**File:** `game_srvc/prisma/schema.prisma`
**Problem:** `playerId` is a non-optional `Int` (required field) but the relation has `onDelete: SetNull`. Prisma cannot set a required field to null on delete — this is either invalid or will cause a migration error.
**Fix:** Either make `playerId` optional (`Int?`) to allow null on delete, or change `onDelete` to `Cascade` or `Restrict` depending on the desired behavior.

---

## GENERAL / INFRASTRUCTURE

### 22. All Dockerfiles run dev servers in "production" images
**Files:** `auth_srvc/Dockerfile`, `chat_srvc/Dockerfile`
**Problem:** Both use `npm run dev` as their CMD. Dev servers are slower, include hot-reload overhead, and are not appropriate for container deployments.
**Fix:** Change CMD to the production start command:
- `auth_srvc`: `CMD ["npm", "run", "start"]`
- `chat_srvc`: `CMD ["node", "dist/server.js"]` (after compiling `server.ts`)

### 23. CI pipeline is entirely disabled
**File:** `.github/workflows/docker_build.yml`
**Problem:** The entire workflow file is commented out. There is no active CI.
**Fix:** Uncomment and update the workflow. At minimum it should run `npm run build` in each service on every pull request.

### 24. `docker-compose.dev.yml` is referenced but does not exist
**Files:** `docker-compose.dev.txt`, `.github/workflows/docker_build.yml`
**Problem:** Both reference `-f docker-compose.dev.yml` but only `docker-compose.dev.txt` exists (a documentation file, not a Compose file).
**Fix:** Create `docker-compose.dev.yml` with volume mounts and dev overrides as described in `docker-compose.dev.txt`.

### 25. Root `openssl` npm package is redundant
**File:** `package.json` (repo root)
**Problem:** The npm package named `openssl` is not the system OpenSSL. The Docker images install system OpenSSL via Alpine's package manager. The root npm package serves no purpose.
**Fix:** Remove it from the root `package.json`.

### 26. `AI_srvc/algo.py` uses stale Gym API
**File:** `AI_srvc/algo.py`
**Problem:** Uses the classic `gym` API where `env.reset()` returns just `obs`. Modern `gymnasium` returns `(obs, info)`, so the script crashes on any current installation.
**Fix:** Update to the current API:
```python
obs, info = env.reset()
# and for step:
obs, reward, terminated, truncated, info = env.step(action)
done = terminated or truncated
```

---

## MISSING FILES

| Expected file | Referenced by | Action |
|---|---|---|
| `auth_srvc/middleware.ts` | `auth_srvc/next.config.js` comment | Rename `proxy.ts` → `middleware.ts` and wire as proper middleware (see issue 16) |
| `docker-compose.dev.yml` | `docker-compose.dev.txt`, CI workflow | Create it (see issue 24) |
| `frontend/env.example` | `frontend/README.md` | Create with `NEXT_PUBLIC_AUTH_SERVICE_URL`, `NEXT_PUBLIC_CHAT_SERVICE_URL`, `NEXT_PUBLIC_GAME_SERVICE_URL` |
| `frontend/jsconfig.json` | `frontend/README.md` | Already replaced by `tsconfig.json` — update README to reflect this |
| Root `README.md` | — | Create with service overview, ports, and how to run |
| `chat_srvc/README.md` | — | Create with API reference and socket events |
