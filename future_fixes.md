# Future Fixes

Remaining issues found during the final audit pass. Listed by priority.

---

## 1. `frontend/next.config.js` — env override breaks auth in Docker (CRITICAL)

The `env` block reads `process.env.AUTH_SERVICE_URL` to set `NEXT_PUBLIC_AUTH_SERVICE_URL`. In Docker, `AUTH_SERVICE_URL` is `http://auth_srvc:3000` (internal hostname), which overrides the `NEXT_PUBLIC_AUTH_SERVICE_URL` that docker-compose explicitly sets to `http://localhost:3000`. The result: the browser tries to reach `http://auth_srvc:3000`, which doesn't resolve from the user's machine. All auth flows break.

**File:** `frontend/next.config.js`

**Fix:** Prefer the `NEXT_PUBLIC_*` vars first:

```js
env: {
  NEXT_PUBLIC_AUTH_SERVICE_URL: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || process.env.AUTH_SERVICE_URL || 'http://localhost:3000',
  NEXT_PUBLIC_CHAT_SERVICE_URL: process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || process.env.CHAT_SERVICE_URL || 'http://localhost:3001',
  NEXT_PUBLIC_GAME_SERVICE_URL: process.env.NEXT_PUBLIC_GAME_SERVICE_URL || process.env.GAME_SERVICE_URL || 'http://localhost:3002',
},
```

---

## 2. Chat friends list always empty — cross-origin cookie issue (HIGH)

`chat_srvc/app/api/friends/route.ts` forwards the `cookie` header to auth_srvc's `GET /api/friends`. But auth_srvc's friends endpoint uses `getServerSession()` which requires the NextAuth session cookie. Since the request originates from chat_srvc's server (not the user's browser direct to auth_srvc), the cookie is empty. The friends list always returns `[]`.

**Files:** `chat_srvc/app/api/friends/route.ts`, `chat_srvc/lib/userStore.ts`

**Fix:** Forward the `Authorization: Bearer <token>` header instead of cookies. Auth_srvc would need a friends endpoint that accepts Bearer tokens, or the chat friends route should use the verified `userId` from `authenticateRequest` and call auth_srvc with a service-to-service token or internal API.

---

## 3. `game_srvc/stats/save` — AI players can cause FK violation (MEDIUM)

The leaderboard update loop skips `null` playerId, but AI players might have `userId: 0` or other non-existent IDs. The `prisma.user.findUnique` returns `null` for these, but the code still proceeds to create a `GlobalLeaderboard` entry with a `playerId` pointing to a non-existent `User`, violating the foreign key constraint.

**File:** `game_srvc/app/api/stats/save/route.ts`

**Fix:** Add a guard after the `findUnique` call:

```ts
const playerUser = await prisma.user.findUnique({ ... });
if (!playerUser) continue;  // Skip AI / non-existent users
```

---

## 4. `auth_srvc/app/api/friends/requests/[id]/route.ts` — missing JSON try/catch (LOW)

This is the one route that wasn't covered in the earlier JSON safety pass. `req.json()` can throw on malformed or empty JSON, and the error falls through to `handleApiError` which returns a generic 500 instead of a clear 400.

**File:** `auth_srvc/app/api/friends/requests/[id]/route.ts`

**Fix:** Wrap `req.json()` in a try/catch and return 400 with `"Invalid JSON body"`.

---

## 5. Missing `.dockerignore` files (LOW)

None of the services have a `.dockerignore`. The `COPY . .` step copies `node_modules`, `.env`, `.git`, and `.next` from the host into the container. Host `node_modules` may contain native addons compiled for the wrong OS (e.g., macOS vs Alpine Linux), causing cryptic crashes.

**Files:** All service root directories (`auth_srvc/`, `chat_srvc/`, `game_srvc/`, `frontend/`)

**Fix:** Add a `.dockerignore` to each service:

```
node_modules
.next
.env
.env.*
.git
```
