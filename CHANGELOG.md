# Changelog — Full Audit & Fix Log

All fixes applied across the microservices game platform (auth_srvc, chat_srvc, game_srvc, frontend).

---

## Round 1 — Critical Fixes

### 1. Created `game_srvc/prisma/prisma.ts`
- **Problem:** Every route in game_srvc imports `@/prisma/prisma`, but the file didn't exist. The entire game service would crash on startup.
- **Fix:** Created a standard Prisma 5 singleton client with dev-mode query logging.

### 2. Created `POST /api/auth/verify` in auth_srvc
- **Problem:** game_srvc's `lib/auth.ts` calls `POST /api/auth/verify` to validate JWT tokens, but no such endpoint existed. Game auth always failed.
- **Fix:** Created `auth_srvc/app/api/auth/verify/route.ts` — extracts Bearer token, verifies with `jsonwebtoken` using `AUTH_SECRET`, looks up the user in the database, and returns `{ sub, userId, username, email, iat, exp }`.

### 3. Fixed `stats/save` route in game_srvc
- **Problem (a):** Destructured `requireAuth` result as `{ user, response: err }`, but `requireAuth` returns `{ authenticated, user, status }` — shape mismatch caused all saves to fail.
- **Problem (b):** Used `user!.id` but the `AuthToken` interface exposes `userId`, not `id`.
- **Problem (c):** Lines 117–194 were orphaned duplicate code sitting outside any function.
- **Fix:** Corrected destructuring to check `authResult.authenticated`, changed to `user.userId`, removed dead code.

### 4. Fixed game_srvc Dockerfile
- **Problem:** Prisma schema copy was commented out, no `prisma generate`, no migration step.
- **Fix:** Uncommented `COPY prisma ./prisma`, added `RUN npx prisma generate`, CMD runs `npx prisma db push` before starting.

---

## Round 2 — High Priority Fixes

### 5. Fixed frontend session username mismatch
- **File:** `frontend/app/page.tsx`
- **Problem:** Frontend read `data.user.username`, but NextAuth session only exposes `user.name`.
- **Fix:** Changed to `data.user.name`.

### 5b. Fixed `getUserById` to return `draws` and `points`
- **File:** `auth_srvc/lib/profile.ts`
- **Problem:** Profile page renders `draws` and `points` but `getUserById` only selected `username, wins, losses`.
- **Fix:** Added `draws: true, points: true` to the Prisma select clause.

### 6. Replaced mock auth in chat_srvc
- **File:** `chat_srvc/lib/authMiddleware.ts`
- **Problem:** Used `x-mock-user-id` header — anyone could impersonate any user.
- **Fix:** Rewrote to accept `Authorization: Bearer <token>` or `next-auth.session-token` cookie, validates by calling auth_srvc's `/api/auth/verify`.

### 7. Added Socket.IO connection authentication
- **File:** `chat_srvc/socket/socketHandler.ts`
- **Problem:** No authentication on WebSocket connections. Any client could connect and join any room.
- **Fix:** Middleware checks `socket.handshake.auth.token`, verifies via auth_srvc, stores `userId`/`username` on `socket.data`, validates room membership on `join_room`.

### 8. Replaced in-memory userStore with auth_srvc proxy
- **Files:** `chat_srvc/lib/userStore.ts`, `chat_srvc/app/api/users/route.ts`, `chat_srvc/app/api/friends/route.ts`
- **Problem:** Hardcoded mock users (`alice`, `bob`, `charlie`, `david`) in memory.
- **Fix:** Replaced with functions that proxy to auth_srvc (`getUserById`, `getFriends`). API routes now require authentication and proxy to auth_srvc.

### 9. Fixed game_srvc page syntax error
- **File:** `game_srvc/app/page.tsx`
- **Problem:** Stray `}` after return statement, all content commented out.
- **Fix:** Rewrote with clean JSX rendering the game service homepage with a link to Pop Head Wars.

### 10. Added missing frontend `globals.css`
- **Files:** `frontend/app/globals.css`, `frontend/app/layout.tsx`
- **Problem:** No `globals.css` existed and no Tailwind directives were loaded. Every Tailwind class across the entire frontend was dead CSS.
- **Fix:** Created `globals.css` with `@tailwind base/components/utilities`, added import in `layout.tsx`.

---

## Round 3 — Medium Priority Fixes

### 11. Replaced hardcoded service URLs with env vars
- **Files:** `frontend/next.config.js`, `frontend/app/page.tsx`, `docker-compose.yml`
- **Problem:** Chat and Game links were hardcoded to `http://localhost:3001` and `http://localhost:3002`.
- **Fix:** Added `NEXT_PUBLIC_CHAT_SERVICE_URL` and `NEXT_PUBLIC_GAME_SERVICE_URL` env vars, updated page to use them, added to docker-compose.

### 12. Wired auth_srvc CORS middleware
- **Files:** Created `auth_srvc/middleware.ts`, deleted `auth_srvc/proxy.ts`, simplified `auth_srvc/next.config.js`
- **Problem:** `proxy.ts` had CORS logic but was never applied (Next.js requires `middleware.ts`). The `next.config.js` had duplicate CORS headers that didn't handle OPTIONS preflight.
- **Fix:** Created proper `middleware.ts` with multi-origin support, OPTIONS handling with 204, `Access-Control-Max-Age` caching. Removed redundant `headers()` from `next.config.js`.

### 13. Removed unused `axios` from frontend
- **File:** `frontend/package.json`
- **Problem:** `axios` declared as dependency but never used (all calls use `fetch`).
- **Fix:** Removed from dependencies.

### 14. Added `.env.example` files
- **Files:** `chat_srvc/example.env`, `game_srvc/example.env`, `frontend/example.env`
- **Problem:** Only auth_srvc had an `example.env`. New developers had no reference for required env vars.
- **Fix:** Created example files for all three remaining services.

### 15. Added `AUTH_SERVICE_URL` to game_srvc docker-compose
- **File:** `docker-compose.yml`
- **Problem:** game_srvc's `lib/auth.ts` uses `process.env.AUTH_SERVICE_URL` but it was never set.
- **Fix:** Added `AUTH_SERVICE_URL=http://auth_srvc:3000` and `auth_srvc` as a dependency.

---

## Round 4 — Post-Audit Fixes

### Critical

#### C1. Fixed auth token flow (JWE vs JWS)
- **Files:** Created `auth_srvc/app/api/auth/token/route.ts`, updated `auth_srvc/middleware.ts`
- **Problem:** `/api/auth/verify` uses `jwt.verify()` which handles signed JWTs (JWS), but NextAuth uses encrypted JWTs (JWE). Every verification attempt from chat_srvc and game_srvc failed.
- **Fix:** Created `GET /api/auth/token` — given a valid NextAuth session (cookie-based), issues a short-lived signed JWT that other services can verify via `/api/auth/verify`. Updated CORS to allow origins for chat (3001) and game (3002) services.

#### C2. Added missing `await` on `authenticateRequest`
- **Files:** `chat_srvc/app/api/chat/send/route.ts`, `chat_srvc/app/api/chat/history/route.ts`
- **Problem:** `authenticateRequest` became async (calls auth_srvc) but these routes called it without `await`. Result was always a Promise object, so `auth.authenticated` was always `undefined` → every request returned 401.
- **Fix:** Added `await`. Updated stale JSDoc headers that still referenced `x-mock-user-id`.

#### C3. Fixed `stats/ranking` Prisma relation name
- **File:** `game_srvc/app/api/stats/ranking/route.ts`
- **Problem:** Code used `{ user: { select: { username: true } } }` but schema defines the relation as `player`. Prisma threw `Unknown arg 'user'`.
- **Fix:** Changed all 6 `include: INCLUDE_USER` references to `INCLUDE_PLAYER` with `{ player: { ... } }`, and `entry.user?.username` to `entry.player?.username`.

#### C4. Fixed game_srvc Dockerfile migration command
- **File:** `game_srvc/Dockerfile`
- **Problem:** `prisma migrate deploy` requires a `prisma/migrations/` directory which doesn't exist in game_srvc.
- **Fix:** Changed to `prisma db push` which syncs schema directly.

#### C5. Fixed chat frontend to use real authentication
- **Files:** `chat_srvc/app/page.tsx`, `chat_srvc/app/components/ChatInterface.tsx`, `chat_srvc/next.config.js`
- **Problem:** Chat page used mock "Select Your Identity" panel. `ChatInterface` sent `x-mock-user-id` header (ignored by new auth middleware). Socket.IO connected without auth token.
- **Fix:** Chat page now authenticates via auth_srvc session, fetches a signed JWT from `/api/auth/token`, shows the user's friends list. `ChatInterface` accepts `authToken` prop, passes it via `Authorization: Bearer` header on all API calls, and via `auth: { token }` on Socket.IO connection. Added `NEXT_PUBLIC_AUTH_SERVICE_URL` to chat_srvc next.config.

### High

#### H1. Fixed `GlobalLeaderboard.playerName` unique constraint collision
- **File:** `game_srvc/app/api/stats/save/route.ts`
- **Problem:** `playerName` was set to a slot color ("blue", "green", etc.) but has a `@unique` constraint. The second user to ever play as "blue" caused a unique constraint violation.
- **Fix:** Now fetches the actual username from the database and uses that as `playerName`.

#### H2. Fixed leaderboard stats not recalculating
- **File:** `game_srvc/app/api/stats/save/route.ts`
- **Problem:** The `update` block only incremented counters but never recalculated `winRate` or `accuracy`. After the first game, those stats were frozen forever.
- **Fix:** Replaced `upsert` with explicit find → create/update that recalculates `winRate = (wins/games)*100` and `accuracy = (hits/fired)*100` using running totals.

#### H3. Fixed frontend Dockerfile build failure
- **File:** `frontend/Dockerfile`
- **Problem:** `npm ci --only=production` skipped devDependencies, but `npm run build` needs TypeScript, Tailwind, PostCSS, etc.
- **Fix:** Changed to `npm ci` (full install).

#### H4. Fixed register route swallowing "already exists" error
- **File:** `auth_srvc/app/api/register/route.ts`
- **Problem:** "Email or username already exists" was caught and returned as generic 500 "Registration failed".
- **Fix:** Now returns 409 with the actual error message. Also added try/catch around `req.json()`.

### Medium

#### M1. Fixed `validateAddresseeId` rejecting string IDs
- **File:** `auth_srvc/lib/utils/validation.ts`
- **Problem:** Only accepted `typeof number`, but JSON bodies often send string IDs.
- **Fix:** Now accepts both string and number, parses and validates.

#### M2. Fixed chat `/api/users` route
- **File:** `chat_srvc/app/api/users/route.ts`
- **Problem:** Didn't forward `Authorization` or `Cookie` headers when proxying search to auth_srvc.
- **Fix:** Forwards both headers.

#### M3. Fixed invalid `/profile` fallback links
- **Files:** `frontend/app/friends/add/page.tsx`, `frontend/app/friends/pending/page.tsx`
- **Problem:** When `currentUserId` was null, links pointed to `/profile` which doesn't exist (only `/profile/[id]`), causing 404.
- **Fix:** Changed fallback to `/` (home page).

#### M4. Fixed login page CSRF validation
- **File:** `frontend/app/login/page.tsx`
- **Problem:** No check on `csrfResponse.ok`. If CSRF fetch failed, `csrfToken` was `undefined` and login silently failed.
- **Fix:** Now checks response status and shows an error message.

### Low

#### L1. Added "Sign in" link to register page
- **File:** `frontend/app/register/page.tsx`
- **Problem:** Login links to register, but register had no link back to login.
- **Fix:** Added "Already have an account? Sign in" link.

#### L2. Fixed stale `UserHelpers` type
- **File:** `chat_srvc/types/index.ts`
- **Problem:** `UserStore` and `UserHelpers` interfaces reflected the old sync mock API.
- **Fix:** Replaced with `UserStoreHelpers` matching the new async proxy functions.

#### L3. Fixed `PendingRequest.requester.email` type mismatch
- **File:** `frontend/app/friends/pending/page.tsx`
- **Problem:** Interface included `email` field but the API doesn't return it.
- **Fix:** Removed `email` from the type.

#### L5. Added `try/catch` around `req.json()` in auth_srvc routes
- **Files:** `auth_srvc/app/api/register/route.ts`, `auth_srvc/app/api/users/me/route.ts`, `auth_srvc/app/api/friends/requests/route.ts`
- **Problem:** Invalid JSON body caused unhandled exceptions returning generic 500 errors.
- **Fix:** Added explicit try/catch returning 400 "Invalid JSON body".

---

## Files Modified (Summary)

### auth_srvc
| File | Action |
|------|--------|
| `app/api/auth/verify/route.ts` | Created |
| `app/api/auth/token/route.ts` | Created |
| `app/api/register/route.ts` | Fixed error handling + JSON parsing |
| `app/api/users/me/route.ts` | Added JSON parse safety |
| `app/api/friends/requests/route.ts` | Added JSON parse safety |
| `middleware.ts` | Created (replaces `proxy.ts`) |
| `proxy.ts` | Deleted |
| `next.config.js` | Simplified (removed duplicate CORS) |
| `lib/profile.ts` | Added `draws`, `points` to select |
| `lib/utils/validation.ts` | Fixed `validateAddresseeId` |
| `Dockerfile` | Fixed prisma steps |

### chat_srvc
| File | Action |
|------|--------|
| `lib/authMiddleware.ts` | Replaced mock with real JWT verification |
| `lib/userStore.ts` | Replaced in-memory store with auth_srvc proxy |
| `socket/socketHandler.ts` | Added connection auth + room validation |
| `app/page.tsx` | Replaced mock UI with auth-integrated page |
| `app/components/ChatInterface.tsx` | Uses Bearer token + Socket.IO auth |
| `app/api/chat/send/route.ts` | Added `await`, updated docs |
| `app/api/chat/history/route.ts` | Added `await`, updated docs |
| `app/api/users/route.ts` | Replaced mock with auth_srvc proxy |
| `app/api/friends/route.ts` | Replaced mock with auth_srvc proxy |
| `types/index.ts` | Updated stale interfaces |
| `next.config.js` | Added `NEXT_PUBLIC_AUTH_SERVICE_URL` |
| `example.env` | Created |
| `Dockerfile` | Updated |

### game_srvc
| File | Action |
|------|--------|
| `prisma/prisma.ts` | Created |
| `app/page.tsx` | Fixed syntax error |
| `app/api/stats/save/route.ts` | Fixed auth, userId, dead code, leaderboard |
| `app/api/stats/ranking/route.ts` | Fixed relation name `user` → `player` |
| `Dockerfile` | Added prisma steps, fixed migration |
| `example.env` | Created |

### frontend
| File | Action |
|------|--------|
| `app/globals.css` | Created |
| `app/layout.tsx` | Added globals.css import |
| `app/page.tsx` | Fixed username, env var URLs |
| `app/login/page.tsx` | Added CSRF validation |
| `app/register/page.tsx` | Added sign-in link |
| `app/friends/add/page.tsx` | Fixed fallback link |
| `app/friends/pending/page.tsx` | Fixed fallback link + type |
| `next.config.js` | Added chat/game env vars |
| `package.json` | Removed unused axios |
| `example.env` | Created |
| `Dockerfile` | Fixed npm ci, dev mode |

### Root
| File | Action |
|------|--------|
| `docker-compose.yml` | Added env vars for frontend, game_srvc |
