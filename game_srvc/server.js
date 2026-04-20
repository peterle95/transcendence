/**
 * Space Fleet Battle — server-authoritative game server
 *
 * Runs the full game physics at 60 Hz and broadcasts a world-state
 * snapshot to all clients at ~20 Hz.  Clients send raw key inputs;
 * the server is the single source of truth for positions, HP, and
 * collision outcomes.
 */

const { Server } = require("socket.io");
const https      = require("https");
const http       = require("http");
const path	 = require("path");
const fs         = require("fs");

const projectDir	= process.cwd();
const keyPath		= path.resolve(projectDir, '../certs/key.pem');
const certPath		= path.resolve(projectDir, '../certs/cert.pem');

if (process.env.HTTP === 'https://' && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    tls = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
    };
} else {
    console.warn(`[WARN] SSL certificates not found at ${keyPath} and ${certPath}. Falling back to HTTP server.`);
}

const HOSTNAME		= process.env.HOSTNAME || '0.0.0.0';
const HTTP		= process.env.HTTP || 'https://';

const PORT              = Number(process.env.SOCKET_PORT) || 4000;
const SERVICE_SECRET    = process.env.SERVICE_SECRET || 'inter-service-shared-secret-change-in-production';
const GAME_ROOM_ID      = process.env.GAME_ROOM_ID || 'gameplay-room';
const AUTH_SERVICE_URL  = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000/auth';
const ENABLE_TRAINING_ROOM = process.env.ENABLE_TRAINING_ROOM === 'true';
const REMOTE_MULTIPLAYER_ENABLED = process.env.REMOTE_MULTIPLAYER_ENABLED !== 'false';
const MAX_SLOTS         = 4;
const PHYSICS_HZ        = 60;
const BROADCAST_EVERY   = 2;           // broadcast every N ticks  → 30 Hz (was 3 → 20 Hz)
const TICK_MS           = 1000 / PHYSICS_HZ;
const COUNTDOWN_SECS    = 5;
const RESTART_AFTER_MS  = 6000;        // pause after game-over before new game

/* ═══════════════════════════════════════════════════════════════════════
   CONFIG  (mirrors game.js CFG)
   ═══════════════════════════════════════════════════════════════════════ */
const CFG = Object.freeze({
  WIDTH: 1280, HEIGHT: 720,
  SHIP_SPEED: 2.5, SHIP_ROT_SPEED: 4,
  SHIP_MAX_HP: 20, FLEET_SIZE: 4,
  SHIP_RADIUS: 40, SHIP_INVULN_TIME: 2000,
  WEAPON_MAX_ENERGY: 40, WEAPON_SHOT_COST: 2,
  WEAPON_RECHARGE: 1, WEAPON_RECHARGE_MS: 500,
  LASER_SPEED: 8, LASER_RADIUS: 6, LASER_LIFETIME: 1500,
  METEOR_COUNT: 8,
  METEOR_MIN_SPEED: 0.5, METEOR_MAX_SPEED: 2,
  METEOR_MIN_ROT: -1,    METEOR_MAX_ROT: 1,
  METEOR_RESPAWN_MS: 4000,
  PLAYER_COLORS: ['#4488ff', '#44cc44', '#ff8800', '#ee3333'],
  PLAYER_NAMES:  ['blue', 'green', 'orange', 'red'],
});

/* ═══════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════ */
const degToRad = d => d * Math.PI / 180;
const rand     = (a, b) => Math.random() * (b - a) + a;
const randInt  = (a, b) => Math.floor(rand(a, b + 1));
const clamp    = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2    = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx*dx + dy*dy); };
const DEFAULT_INPUT = Object.freeze({
  seq: 0,
  forward: false,
  backward: false,
  left: false,
  right: false,
  shoot: false,
});

function sanitizeInputState(payload = {}, fallbackSeq = 0) {
  const rawSeq = Number(payload.seq);
  return {
    seq: Number.isFinite(rawSeq) ? Math.max(0, Math.floor(rawSeq)) : fallbackSeq,
    forward: payload.forward === true,
    backward: payload.backward === true,
    left: payload.left === true,
    right: payload.right === true,
    shoot: payload.shoot === true,
  };
}

function wrapPos(obj, margin = 40) {
  if (obj.x < -margin)            obj.x = CFG.WIDTH  + margin;
  if (obj.x > CFG.WIDTH  + margin) obj.x = -margin;
  if (obj.y < -margin)            obj.y = CFG.HEIGHT + margin;
  if (obj.y > CFG.HEIGHT + margin) obj.y = -margin;
}

/* ═══════════════════════════════════════════════════════════════════════
   SHIP
   ═══════════════════════════════════════════════════════════════════════ */
class Ship {
  constructor(playerIdx, shipNum) {
    this.playerIdx = playerIdx;
    this.shipNum   = shipNum;
    this.alive = true;
    this.x = this.y = this.vx = this.vy = this.angularVel = 0;
    this.angle  = 0;
    this.radius = CFG.SHIP_RADIUS;
    this.hp     = CFG.SHIP_MAX_HP;
    this.energy = CFG.WEAPON_MAX_ENERGY;
    this.invulnUntil      = 0;
    this.lastRechargeTime = 0;
    this.spawnSeq = 0;
  }

  spawn(x, y, angle = 0) {
    Object.assign(this, {
      x, y, angle,
      vx: 0, vy: 0, angularVel: 0,
      hp: CFG.SHIP_MAX_HP, energy: CFG.WEAPON_MAX_ENERGY, alive: true,
    });
    this.spawnSeq += 1;
    this.invulnUntil      = Date.now() + CFG.SHIP_INVULN_TIME;
    this.lastRechargeTime = Date.now();
  }

  get isInvulnerable() { return Date.now() < this.invulnUntil; }

  takeDamage(n = 1) {
    if (this.isInvulnerable) return false;
    this.hp = Math.max(0, this.hp - n);
    if (this.hp === 0) this.alive = false;
    return true;
  }

  canShoot()    { return this.energy >= CFG.WEAPON_SHOT_COST; }
  consumeShot() { this.energy -= CFG.WEAPON_SHOT_COST; }

  thrustForward(dt)  { const r = degToRad(this.angle), t = CFG.SHIP_SPEED * dt / 16; this.vx += Math.sin(r) * t; this.vy -= Math.cos(r) * t; }
  thrustBackward(dt) { const r = degToRad(this.angle), t = CFG.SHIP_SPEED * dt / 16; this.vx -= Math.sin(r) * t; this.vy += Math.cos(r) * t; }
  rotateLeft(dt)  { this.angularVel -= 0.4 * dt / 16; }
  rotateRight(dt) { this.angularVel += 0.4 * dt / 16; }

  update(dt) {
    const MAX_AV = CFG.SHIP_ROT_SPEED * 0.8;
    this.angularVel = clamp(this.angularVel, -MAX_AV, MAX_AV);
    this.angle     += this.angularVel * dt / 16;
    this.angularVel *= 0.95;
    this.x  += this.vx * dt / 16;
    this.y  += this.vy * dt / 16;
    this.vx *= 0.98;
    this.vy *= 0.98;
    const MAX_V = CFG.SHIP_SPEED * 2;
    const spd   = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if (spd > MAX_V) { this.vx = this.vx / spd * MAX_V; this.vy = this.vy / spd * MAX_V; }
    wrapPos(this, this.radius);

    const now = Date.now();
    if (this.energy < CFG.WEAPON_MAX_ENERGY && now - this.lastRechargeTime >= CFG.WEAPON_RECHARGE_MS) {
      this.energy = Math.min(this.energy + CFG.WEAPON_RECHARGE, CFG.WEAPON_MAX_ENERGY);
      this.lastRechargeTime = now;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   LASER
   ═══════════════════════════════════════════════════════════════════════ */
class Laser {
  constructor(x, y, angle, ownerIdx) {
    this.x = x; this.y = y; this.angle = angle; this.ownerIdx = ownerIdx;
    this.radius = CFG.LASER_RADIUS;
    this.alive  = true;
    this.born   = Date.now();
  }

  update(dt) {
    const r = degToRad(this.angle);
    this.x += Math.sin(r) * CFG.LASER_SPEED * dt / 16;
    this.y -= Math.cos(r) * CFG.LASER_SPEED * dt / 16;
    if (this.x < -50 || this.x > CFG.WIDTH + 50 || this.y < -50 || this.y > CFG.HEIGHT + 50) this.alive = false;
    if (Date.now() - this.born > CFG.LASER_LIFETIME) this.alive = false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   METEOR
   ═══════════════════════════════════════════════════════════════════════ */
const METEOR_DEFS = [
  { key: 'meteorBrown_big1',   radius: 50 }, { key: 'meteorBrown_big2',   radius: 49 },
  { key: 'meteorBrown_big3',   radius: 45 }, { key: 'meteorBrown_big4',   radius: 48 },
  { key: 'meteorGrey_big1',    radius: 50 }, { key: 'meteorGrey_big2',    radius: 49 },
  { key: 'meteorBrown_med1',   radius: 22 }, { key: 'meteorBrown_med3',   radius: 22 },
  { key: 'meteorGrey_med1',    radius: 22 }, { key: 'meteorGrey_med2',    radius: 22 },
  { key: 'meteorBrown_small1', radius: 14 }, { key: 'meteorBrown_small2', radius: 14 },
  { key: 'meteorGrey_small1',  radius: 14 }, { key: 'meteorGrey_small2',  radius: 14 },
];

class Meteor {
  constructor() { this.alive = true; this.respawnTimer = 0; this._randomise(true); }

  _randomise(initial = false) {
    const def = METEOR_DEFS[randInt(0, METEOR_DEFS.length - 1)];
    Object.assign(this, {
      spriteKey: def.key, radius: def.radius, rot: 0,
      rotSpeed: rand(CFG.METEOR_MIN_ROT, CFG.METEOR_MAX_ROT),
      speed: rand(CFG.METEOR_MIN_SPEED, CFG.METEOR_MAX_SPEED),
      angle: rand(0, 360),
    });
    const mg = this.radius + 10;
    if (initial) { this.x = rand(mg, CFG.WIDTH - mg); this.y = rand(mg, CFG.HEIGHT - mg); return; }
    switch (randInt(0, 3)) {
      case 0: this.x = -mg;            this.y = rand(0, CFG.HEIGHT); break;
      case 1: this.x = CFG.WIDTH + mg; this.y = rand(0, CFG.HEIGHT); break;
      case 2: this.y = -mg;            this.x = rand(0, CFG.WIDTH);  break;
      case 3: this.y = CFG.HEIGHT + mg;this.x = rand(0, CFG.WIDTH);  break;
    }
  }

  update(dt) {
    if (!this.alive) {
      if ((this.respawnTimer -= dt) <= 0) { this.alive = true; this._randomise(false); }
      return;
    }
    const r = degToRad(this.angle);
    this.x   += Math.sin(r) * this.speed * dt / 16;
    this.y   -= Math.cos(r) * this.speed * dt / 16;
    this.rot += this.rotSpeed * dt / 16;
    wrapPos(this, this.radius + 20);
  }

  destroy() { this.alive = false; this.respawnTimer = CFG.METEOR_RESPAWN_MS; }
}

/* ═══════════════════════════════════════════════════════════════════════
   SERVER PLAYER
   ═══════════════════════════════════════════════════════════════════════ */
class ServerPlayer {
  constructor(idx, displayName = '') {
    this.idx         = idx;
    this.alive       = true;
    this.fleetIndex  = 0;
    this.displayName = displayName || CFG.PLAYER_NAMES[idx].toUpperCase();
    this.shootCooldown = 0;
    this.lastProcessedInputSeq = 0;
    this.stats = { shotsFired: 0, shotsHit: 0, shipsLost: 0, shipsDestroyed: 0, wins: 0 };
    this.ships = [];
    for (let i = 1; i <= CFG.FLEET_SIZE; i++) this.ships.push(new Ship(idx, i));
  }

  get currentShip() { return this.ships[this.fleetIndex] || null; }

  spawnCurrent() {
    const ship = this.currentShip;
    if (!ship) return;
    const pos = [
      { x: 200,              y: 200,              angle: 135  },
      { x: CFG.WIDTH - 200,  y: CFG.HEIGHT - 200, angle: -45  },
      { x: CFG.WIDTH - 200,  y: 200,              angle: -135 },
      { x: 200,              y: CFG.HEIGHT - 200, angle: 45   },
    ][this.idx % 4];
    ship.spawn(pos.x, pos.y, pos.angle);
  }

  advanceFleet() {
    this.fleetIndex++;
    this.stats.shipsLost++;
    if (this.fleetIndex >= CFG.FLEET_SIZE) { this.alive = false; return false; }
    this.spawnCurrent();
    return true;
  }

  update(dt) { const s = this.currentShip; if (s && s.alive) s.update(dt); }
}

/* ═══════════════════════════════════════════════════════════════════════
   ROOM STATE
   ═══════════════════════════════════════════════════════════════════════ */
const ROOM = {
  state:       'lobby',    // 'lobby' | 'countdown' | 'playing' | 'gameOver'
  slots:       new Array(MAX_SLOTS).fill(null),  // socketId per slot
  players:     new Array(MAX_SLOTS).fill(null),  // ServerPlayer per slot
  lasers:      [],
  meteors:     [],
  inputBuffer: {},          // playerIdx → { forward, backward, left, right, shoot }
  winner:      null,
  events:      [],          // transient visual events emitted with each world snapshot
  tickNum:     0,
};

const displayNames = {};   // playerIdx → string set by client
const aiServiceSockets = new Map(); // socket.id -> { slot, roomId }
const bridgeClients = new Map(); // socket.id -> { clientId, roomId }
const humanSockets = new Map(); // socket.id -> { socketId, slot, userId, username, email, connectedAt }
const resettingHumanSockets = new Set();
const virtualSlots = new Set(); // slot indexes reserved for AI-only training sessions
const gameAISlots     = new Set(); // slot indexes filled by AI inference during a live game

function isSlotActive(slotIdx) {
  return ROOM.slots[slotIdx] !== null || virtualSlots.has(slotIdx);
}

function findFreeSlot() {
  for (let i = 0; i < MAX_SLOTS; i++) {
    if (!isSlotActive(i)) return i;
  }
  return -1;
}

function connectedCount() { return ROOM.slots.filter(Boolean).length + virtualSlots.size; }
function humanCount() { return ROOM.slots.filter(Boolean).length; }

function sanitizeDisplayName(name, fallback = '') {
  const value = typeof name === 'string' ? name.trim().slice(0, 32) : '';
  return value || fallback;
}

function formatHumanMeta(meta = {}) {
  return {
    socketId: meta.socketId || null,
    slot: Number.isInteger(meta.slot) ? meta.slot : null,
    userId: meta.userId || null,
    username: meta.username || null,
    email: meta.email || null,
    connectedAt: meta.connectedAt || null,
  };
}

async function verifyHumanPlayerToken(token) {
  const bearerToken = typeof token === 'string' ? token.trim() : '';
  if (!bearerToken) return null;

  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const userId = data && data.userId != null ? String(data.userId) : '';
    const username = sanitizeDisplayName(data && data.username, '');
    const email = typeof data?.email === 'string' ? data.email.trim().slice(0, 160) : '';

    if (!userId || !username) return null;
    return { userId, username, email };
  } catch (error) {
    console.warn('online auth verify failed:', error && error.message ? error.message : error);
    return null;
  }
}

function clearHumanSlot(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_SLOTS) return;
  ROOM.slots[slot] = null;
  ROOM.players[slot] = null;
  delete ROOM.inputBuffer[slot];
  delete displayNames[slot];
}

function getAvailableAISlots(roomId = GAME_ROOM_ID) {
  return [...new Set(
    [...aiServiceSockets.values()]
      .filter((meta) => meta.roomId === roomId)
      .map((meta) => meta.slot)
  )].sort((a, b) => a - b);
}

function buildAIServiceStatus(roomId = GAME_ROOM_ID) {
  return {
    roomId,
    availableSlots: getAvailableAISlots(roomId),
  };
}

function buildLobbyStatus() {
  return {
    roomId: GAME_ROOM_ID,
    gameState: ROOM.state,
    humanCount: humanCount(),
  };
}

function emitLobbyStatus(target = io) {
  const payload = buildLobbyStatus();
  target.emit('lobby_status', payload);
  return payload;
}

function emitAIServiceStatus(roomId = GAME_ROOM_ID) {
  const payload = buildAIServiceStatus(roomId);
  bridgeClients.forEach((meta, socketId) => {
    if (meta.roomId !== roomId) return;
    const bridgeSocket = io.sockets.sockets.get(socketId);
    if (bridgeSocket) bridgeSocket.emit('ai_service_status', payload);
  });
  return payload;
}

function emitBridgeAICommand(payload = {}) {
  const roomId = typeof payload.roomId === 'string' ? payload.roomId : GAME_ROOM_ID;
  const bridgeClientId = typeof payload.bridgeClientId === 'string' ? payload.bridgeClientId : '';

  bridgeClients.forEach((meta, socketId) => {
    if (meta.roomId !== roomId) return;
    if (bridgeClientId && meta.clientId !== bridgeClientId) return;

    const bridgeSocket = io.sockets.sockets.get(socketId);
    if (bridgeSocket) bridgeSocket.emit('ai_command', payload);
  });
}

function parseAIInput(payload = {}) {
  const move = Number(payload.movimento || 0);
  const rotate = Number(payload.rotazione || 0);
  const shoot = Number(payload.sparo || 0);
  return {
    seq: Number.isFinite(Number(payload.seq)) ? Math.max(0, Math.floor(Number(payload.seq))) : 0,
    forward: move === 1,
    backward: move === 2,
    left: rotate === 1,
    right: rotate === 2,
    shoot: shoot === 1,
  };
}

function buildAIStateForSlot(slot, dt) {
  const me = ROOM.players[slot];
  const myShip = me && me.currentShip ? me.currentShip : null;
  return {
    roomId: GAME_ROOM_ID,
    slot,
    dt_ms: dt,
    my_ship: myShip ? {
      x: myShip.x,
      y: myShip.y,
      angle: myShip.angle,
      vx: myShip.vx,
      vy: myShip.vy,
      energy: myShip.energy,
      hp: myShip.hp,
      alive: myShip.alive,
      radius: myShip.radius,
    } : { alive: false, hp: 0, energy: 0 },
    enemies: ROOM.players
      .filter((p, idx) => idx !== slot && p && p.alive && p.currentShip)
      .map((p) => ({
        x: p.currentShip.x,
        y: p.currentShip.y,
        angle: p.currentShip.angle,
        hp: p.currentShip.hp,
        alive: p.currentShip.alive,
      })),
    lasers: ROOM.lasers
      .filter((l) => l.alive)
      .map((l) => ({
        x: l.x,
        y: l.y,
        is_enemy: l.ownerIdx !== slot,
      })),
    meteors: ROOM.meteors
      .filter((m) => m.alive)
      .map((m) => ({ x: m.x, y: m.y, radius: m.radius, alive: m.alive })),
  };
}

function clearGameAISlots() {
  gameAISlots.forEach((slot) => {
    virtualSlots.delete(slot);
    if (!ROOM.slots[slot]) {
      ROOM.players[slot] = null;
      delete ROOM.inputBuffer[slot];
      delete displayNames[slot];
    }
  });
  gameAISlots.clear();
}

function hasTrainingVirtualSlots() {
  return [...virtualSlots].some((slot) => !gameAISlots.has(slot));
}

function hasLiveAIServiceForSlot(slot, roomId = GAME_ROOM_ID) {
  for (const meta of aiServiceSockets.values()) {
    if (meta.roomId === roomId && meta.slot === slot) return true;
  }
  return false;
}

function buildFallbackAIInput(slot) {
  const player = ROOM.players[slot];
  const ship = player && player.currentShip ? player.currentShip : null;
  const nextSeq = Math.max(
    ROOM.inputBuffer[slot]?.seq || 0,
    player?.lastProcessedInputSeq || 0
  ) + 1;
  const input = { ...DEFAULT_INPUT, seq: nextSeq };

  if (!player || !player.alive || !ship || !ship.alive) return input;

  let bestTarget = null;
  let bestDist = Infinity;
  ROOM.players.forEach((other, otherSlot) => {
    if (otherSlot === slot || !other || !other.alive) return;
    const otherShip = other.currentShip;
    if (!otherShip || !otherShip.alive) return;
    const distance = dist2(ship, otherShip);
    if (distance < bestDist) {
      bestDist = distance;
      bestTarget = otherShip;
    }
  });

  if (!bestTarget) return input;

  const dx = bestTarget.x - ship.x;
  const dy = bestTarget.y - ship.y;
  let diff = (Math.atan2(dx, -dy) * 180 / Math.PI) - ship.angle;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;

  if (diff > 3) input.right = true;
  else if (diff < -3) input.left = true;

  if (bestDist > 250) input.forward = true;
  else if (bestDist < 120) input.backward = true;

  if (Math.abs(diff) < 12 && ship.canShoot() && player.shootCooldown <= 0) {
    input.shoot = true;
  }

  return input;
}

function spawnFreshParticipant(slot, displayName = '') {
  ROOM.players[slot] = new ServerPlayer(slot, displayName);
  ROOM.players[slot].spawnCurrent();
  ROOM.inputBuffer[slot] = { ...DEFAULT_INPUT };
  return ROOM.players[slot];
}

function removeLiveAISlot(slot) {
  gameAISlots.delete(slot);
  virtualSlots.delete(slot);
  if (ROOM.slots[slot] === null) {
    ROOM.players[slot] = null;
    delete ROOM.inputBuffer[slot];
    delete displayNames[slot];
  }
}

function activateLiveAISlot(slot) {
  if (ROOM.slots[slot] !== null) return false;
  virtualSlots.add(slot);
  gameAISlots.add(slot);
  displayNames[slot] = 'AI';
  if (ROOM.state === 'playing') {
    spawnFreshParticipant(slot, displayNames[slot]);
  }
  return true;
}

function rebalanceLiveAISlots(options = {}) {
  const { allowPreGame = false } = options;
  if ((!allowPreGame && ROOM.state !== 'playing') || humanCount() < 2) return false;

  let changed = false;
  const desiredAISlots = new Set();
  for (let slot = 0; slot < MAX_SLOTS; slot++) {
    if (ROOM.slots[slot] === null) desiredAISlots.add(slot);
  }

  [...gameAISlots]
    .sort((a, b) => a - b)
    .forEach((slot) => {
      if (desiredAISlots.has(slot)) return;
      removeLiveAISlot(slot);
      changed = true;
    });

  [...desiredAISlots]
    .sort((a, b) => a - b)
    .forEach((slot) => {
      if (gameAISlots.has(slot)) return;
      if (activateLiveAISlot(slot)) changed = true;
    });

  return changed;
}

function findJoinableHumanSlot() {
  const inactiveSlot = findFreeSlot();
  if (inactiveSlot !== -1) {
    return { slot: inactiveSlot, replacedAI: false };
  }

  if (ROOM.state !== 'playing') {
    return { slot: -1, replacedAI: false };
  }

  const reusableAISlot = [...gameAISlots]
    .filter((slot) => ROOM.slots[slot] === null)
    .sort((a, b) => a - b)[0];

  if (!Number.isInteger(reusableAISlot)) {
    return { slot: -1, replacedAI: false };
  }

  return { slot: reusableAISlot, replacedAI: true };
}

function resetRoomToLobby() {
  clearCountdownTimer();
  clearRestartTimer();
  clearGameAISlots();
  ROOM.state = 'lobby';
  ROOM.players = new Array(MAX_SLOTS).fill(null);
  ROOM.lasers = [];
  ROOM.meteors = [];
  ROOM.inputBuffer = {};
  ROOM.winner = null;
  ROOM.events = [];
  ROOM.tickNum = 0;
}

function broadcastWorldIfPlaying() {
  if (ROOM.state === 'playing') {
    io.emit('world', serializeWorld());
  }
}

function startTrainingSession(aiSlots = [1, 2]) {
  const uniqueSlots = [...new Set(aiSlots.filter((slot) => Number.isInteger(slot) && slot >= 0 && slot < MAX_SLOTS))];
  if (uniqueSlots.length === 0) return { ok: false, error: 'No valid AI slots provided' };

  ROOM.slots.forEach((socketId) => {
    if (!socketId) return;
    const socket = io.sockets.sockets.get(socketId);
    if (socket) socket.disconnect(true);
  });

  ROOM.slots = new Array(MAX_SLOTS).fill(null);
  Object.keys(displayNames).forEach((key) => delete displayNames[key]);

  // Clear both game AI slots and training slots
  gameAISlots.clear();
  virtualSlots.clear();

  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  // Pre-add training slots before resetGame so fillAISlots sees humanCount=0 and skips
  uniqueSlots.forEach((slot) => {
    virtualSlots.add(slot);
    displayNames[slot] = `AI_${slot}`;
  });

  resetGame();
  io.emit('training_started', { roomId: GAME_ROOM_ID, aiSlots: uniqueSlots });
  console.log(`training session started in room ${GAME_ROOM_ID} with AI slots: ${uniqueSlots.join(',')}`);
  return { ok: true, aiSlots: uniqueSlots };
}

function handleLocalAIBridgeConnection(socket, auth = {}) {
  const roomId = typeof auth.room_id === 'string' ? auth.room_id : GAME_ROOM_ID;
  const rawClientId = typeof auth.bridge_client_id === 'string' ? auth.bridge_client_id.trim() : '';
  const clientId = rawClientId ? rawClientId.slice(0, 64) : socket.id;

  if (roomId !== GAME_ROOM_ID) {
    socket.emit('bridge_rejected', {
      reason: 'room_mismatch',
      expectedRoomId: GAME_ROOM_ID,
      receivedRoomId: roomId,
    });
    socket.disconnect(true);
    return;
  }

  bridgeClients.set(socket.id, { clientId, roomId });

  const statusPayload = buildAIServiceStatus(roomId);
  socket.emit('ai_bridge_ready', { ...statusPayload, bridgeClientId: clientId });
  socket.emit('ai_service_status', statusPayload);
  console.log(`local ai bridge connected: ${socket.id} room=${roomId} client=${clientId}`);

  socket.on('ai_game_state', (payload = {}) => {
    const targetRoomId = typeof payload.roomId === 'string' ? payload.roomId : roomId;
    const aiSlot = Number(payload.slot);
    if (targetRoomId !== roomId) return;
    if (!Number.isInteger(aiSlot) || aiSlot < 0 || aiSlot >= MAX_SLOTS) return;

    const forwardedPayload = {
      ...payload,
      roomId: targetRoomId,
      slot: aiSlot,
      bridgeClientId: clientId,
    };

    aiServiceSockets.forEach((meta, socketId) => {
      if (meta.roomId !== targetRoomId || meta.slot !== aiSlot) return;
      const aiSocket = io.sockets.sockets.get(socketId);
      if (aiSocket) aiSocket.emit('ai_game_state', forwardedPayload);
    });
  });

  socket.on('disconnect', () => {
    bridgeClients.delete(socket.id);
    console.log(`local ai bridge disconnected: ${socket.id} room=${roomId} client=${clientId}`);
  });
}

function handleAIServiceConnection(socket, auth = {}) {
  const roomId = typeof auth.room_id === 'string' ? auth.room_id : GAME_ROOM_ID;
  const aiSlot = Number(auth.ai_slot);

  if (roomId !== GAME_ROOM_ID) {
    socket.emit('service_rejected', { reason: 'room_mismatch', expectedRoomId: GAME_ROOM_ID, receivedRoomId: roomId });
    socket.disconnect(true);
    return;
  }
  if (!Number.isInteger(aiSlot) || aiSlot < 0 || aiSlot >= MAX_SLOTS) {
    socket.emit('service_rejected', { reason: 'invalid_ai_slot', aiSlot });
    socket.disconnect(true);
    return;
  }

  // Register for relay routing only — do NOT add to virtualSlots here.
  // Slots are claimed dynamically in fillAISlots() when a game starts,
  // so humans can join any of the 4 slots in online multiplayer.
  aiServiceSockets.set(socket.id, { slot: aiSlot, roomId });
  if (!displayNames[aiSlot]) displayNames[aiSlot] = `AI_${aiSlot}`;
  if (!ROOM.inputBuffer[aiSlot]) ROOM.inputBuffer[aiSlot] = { ...DEFAULT_INPUT };
  socket.emit('ai_service_connected', { roomId, aiSlot });
  console.log(`ai service connected: ${socket.id} room=${roomId} slot=${aiSlot}`);
  emitAIServiceStatus(roomId);

  socket.on('ai_command', (payload = {}) => {
    const targetRoomId = typeof payload.roomId === 'string' ? payload.roomId : roomId;
    const bridgeClientId = typeof payload.bridgeClientId === 'string' ? payload.bridgeClientId : '';
    if (targetRoomId !== GAME_ROOM_ID) return;

    const relayPayload = {
      roomId: targetRoomId,
      slot: aiSlot,
      ...(bridgeClientId ? { bridgeClientId } : {}),
      movimento: Number(payload.movimento || 0),
      rotazione: Number(payload.rotazione || 0),
      sparo: Number(payload.sparo || 0),
      shoot: Number(payload.sparo || 0) === 1,
    };

    if (bridgeClientId) {
      emitBridgeAICommand(relayPayload);
      return;
    }

    if (ROOM.state !== 'playing') return;
    if (ROOM.slots[aiSlot] !== null) return; // human owns this slot
    if (!virtualSlots.has(aiSlot)) return;
    ROOM.inputBuffer[aiSlot] = parseAIInput(payload);
  });

  socket.on('training_start', (payload = {}, ack) => {
    if (!ENABLE_TRAINING_ROOM) {
      const denied = { ok: false, error: 'training_room_disabled' };
      if (typeof ack === 'function') ack(denied);
      socket.emit('training_start_ack', denied);
      return;
    }

    const rawSlots = Array.isArray(payload.aiSlots)
      ? payload.aiSlots.map((v) => Number(v))
      : [aiSlot, (aiSlot + 1) % MAX_SLOTS];

    const result = startTrainingSession(rawSlots);
    if (typeof ack === 'function') ack(result);
    socket.emit('training_start_ack', result);
  });

  socket.on('disconnect', () => {
    aiServiceSockets.delete(socket.id);
    const hasSameSlotAgent = [...aiServiceSockets.values()].some(
      (meta) => meta.slot === aiSlot && meta.roomId === roomId
    );
    if (!hasSameSlotAgent) {
      if (!gameAISlots.has(aiSlot) && virtualSlots.has(aiSlot)) {
        virtualSlots.delete(aiSlot);
        ROOM.players[aiSlot] = null;
        delete ROOM.inputBuffer[aiSlot];
        delete displayNames[aiSlot];
        io.emit('player_left', { playerIdx: aiSlot });
      }
    }
    console.log(`ai service disconnected: ${socket.id} slot=${aiSlot}`);
    emitAIServiceStatus(roomId);
  });
}

/**
 * Fill every empty online slot with AI once at least two humans are present.
 * External AI services can drive matching slots, otherwise fallback AI does.
 */
function fillAISlots() {
  clearGameAISlots();
  if (!rebalanceLiveAISlots({ allowPreGame: true })) return;
  gameAISlots.forEach((slot) => console.log(`AI filling slot ${slot}`));
}

function resetGame() {
  clearRestartTimer();
  ROOM.lasers    = [];
  ROOM.meteors   = [];
  ROOM.inputBuffer = {};
  ROOM.winner    = null;
  ROOM.events    = [];
  ROOM.players   = new Array(MAX_SLOTS).fill(null);
  ROOM.tickNum   = 0;

  // Auto-fill empty slots with AI services (only when humans are present)
  fillAISlots();

  for (let i = 0; i < MAX_SLOTS; i++) {
    if (isSlotActive(i)) {
      spawnFreshParticipant(i, displayNames[i] || '');
    }
  }
  for (let i = 0; i < CFG.METEOR_COUNT; i++) ROOM.meteors.push(new Meteor());

  ROOM.state = 'playing';
  io.emit('game_start', {});
  console.log('game started with', connectedCount(), 'player(s)');
}

/* ═══════════════════════════════════════════════════════════════════════
   HTTP + SOCKET.IO
   ═══════════════════════════════════════════════════════════════════════ */
const httpsServer = https.createServer(tls, (req, res) => {
  const requestUrl = new URL(req.url, '${HTTP}${HOSTNAME}');

  if (ENABLE_TRAINING_ROOM && requestUrl.pathname === '/training/start') {
    const aiSlots = (requestUrl.searchParams.get('slots') || '1,2')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n));

    const result = startTrainingSession(aiSlots);
    res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ roomId: GAME_ROOM_ID, ...result }));
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', roomId: GAME_ROOM_ID, players: connectedCount(), state: ROOM.state }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('game socket server is running');
});

const defaultOrigins = ['http://localhost:8080', 'https://localhost:8080'];
const allowedOrigins = process.env.SOCKET_IO_ALLOWLIST
  ? process.env.SOCKET_IO_ALLOWLIST.split(',').map(s => s.trim())
  : defaultOrigins;

const io = new Server(httpsServer, { 
  // Custom path injected via docker-compose to align with Nginx's path-routing
  path: process.env.SOCKET_PATH || '/socket.io',
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] } 
});

// Countdown management
let countdownTimer = null;
let restartTimer = null;

function clearCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function clearRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

function startCountdown() {
  if (countdownTimer || ROOM.state !== 'lobby') return;
  ROOM.state = 'countdown';
  let secs = COUNTDOWN_SECS;
  io.emit('countdown', { seconds: secs });
  console.log(`game starting in ${secs}s`);
  countdownTimer = setInterval(() => {
    secs--;
    if (secs > 0) {
      io.emit('countdown', { seconds: secs });
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      resetGame();
    }
  }, 1000);
}

io.on('connection', async (socket) => {
  const auth = socket.handshake && socket.handshake.auth ? socket.handshake.auth : {};
  const bridgeRole = typeof auth.bridge_role === 'string' ? auth.bridge_role : '';
  const isTrustedAIService = typeof auth.service_secret === 'string' && auth.service_secret === SERVICE_SECRET;
  if (bridgeRole === 'local_ai_client') {
    handleLocalAIBridgeConnection(socket, auth);
    return;
  }
  if (isTrustedAIService) {
    handleAIServiceConnection(socket, auth);
    return;
  }

  // Reject human connections when remote multiplayer is disabled (e.g. local dev)
  if (!REMOTE_MULTIPLAYER_ENABLED) {
    socket.emit('remote_multiplayer_disabled', {
      message: 'Remote multiplayer is not enabled on this server.',
    });
    socket.disconnect(true);
    console.log('connection rejected – REMOTE_MULTIPLAYER_ENABLED=false');
    return;
  }

  const playerToken = typeof auth.player_token === 'string' ? auth.player_token : '';
  if (!playerToken.trim()) {
    socket.emit('online_auth_required', {
      message: 'Login required for online multiplayer.',
    });
    socket.disconnect(true);
    console.log('connection rejected - missing online auth token');
    return;
  }

  const verifiedIdentity = await verifyHumanPlayerToken(playerToken);
  if (socket.disconnected) return;
  if (!verifiedIdentity) {
    socket.emit('online_auth_required', {
      message: 'Your session could not be verified. Please log in again.',
    });
    socket.disconnect(true);
    console.log('connection rejected - invalid online auth token');
    return;
  }

  const { slot: playerIdx, replacedAI } = findJoinableHumanSlot();
  if (playerIdx === -1) {
    socket.emit('room_full');
    socket.disconnect(true);
    console.log('connection rejected – room full');
    return;
  }

  if (replacedAI) {
    removeLiveAISlot(playerIdx);
  }
  const verifiedUsername = sanitizeDisplayName(
    verifiedIdentity.username,
    CFG.PLAYER_NAMES[playerIdx].toUpperCase()
  );
  const humanMeta = {
    socketId: socket.id,
    slot: playerIdx,
    userId: verifiedIdentity.userId,
    username: verifiedUsername,
    email: verifiedIdentity.email || '',
    connectedAt: new Date().toISOString(),
  };

  ROOM.slots[playerIdx] = socket.id;
  displayNames[playerIdx] = verifiedUsername;
  humanSockets.set(socket.id, humanMeta);
  if (ROOM.state === 'playing') {
    spawnFreshParticipant(playerIdx, verifiedUsername);
    rebalanceLiveAISlots();
  }
  console.log('online human connected:', formatHumanMeta(humanMeta));

  // Tell this client their slot and current server state
  socket.emit('init', {
    playerIdx,
    roomId: GAME_ROOM_ID,
    existing:  ROOM.slots.map((id, i) => ({ idx: i, connected: isSlotActive(i) })),
    gameState: ROOM.state,
    humanCount: humanCount(),
    identity: {
      userId: humanMeta.userId,
      username: humanMeta.username,
    },
  });

  socket.broadcast.emit('player_joined', { playerIdx });
  emitLobbyStatus();
  broadcastWorldIfPlaying();

  // Kick off countdown only when ≥2 HUMAN players are connected (not AI bots)
  if (ROOM.state === 'lobby' && humanCount() >= 2) startCountdown();

  // ── events from client ──────────────────────────────────────────────
  socket.on('input', (inp) => {
    if (ROOM.state !== 'playing') return;
    const fallbackSeq = ROOM.inputBuffer[playerIdx]?.seq || ROOM.players[playerIdx]?.lastProcessedInputSeq || 0;
    ROOM.inputBuffer[playerIdx] = sanitizeInputState(inp, fallbackSeq);
  });

  socket.on('display_name', () => {
    // Online human display names come from verified auth, not client input.
  });

  socket.on('reset_room', () => {
    const requesterMeta = humanSockets.get(socket.id);
    if (!requesterMeta) return;

    const affectedHumans = [...humanSockets.values()]
      .filter((meta) => Number.isInteger(meta.slot) && ROOM.slots[meta.slot] === meta.socketId)
      .sort((a, b) => a.slot - b.slot);

    console.log('online room reset requested:', {
      requester: formatHumanMeta(requesterMeta),
      sockets: affectedHumans.map((meta) => formatHumanMeta(meta)),
    });

    affectedHumans.forEach((meta) => {
      resettingHumanSockets.add(meta.socketId);
      clearHumanSlot(meta.slot);
    });

    resetRoomToLobby();
    emitLobbyStatus();

    affectedHumans.forEach((meta) => {
      const targetSocket = io.sockets.sockets.get(meta.socketId);
      if (!targetSocket) {
        humanSockets.delete(meta.socketId);
        resettingHumanSockets.delete(meta.socketId);
        return;
      }

      targetSocket.emit('room_reset', {
        message: 'Online room was reset.',
        initiatorUsername: requesterMeta.username,
      });

      setTimeout(() => {
        if (targetSocket.connected) targetSocket.disconnect(true);
      }, 40);
    });
  });

  socket.on('disconnect', () => {
    const meta = humanSockets.get(socket.id) || humanMeta;
    const wasRoomReset = resettingHumanSockets.has(socket.id);

    clearHumanSlot(playerIdx);
    humanSockets.delete(socket.id);
    resettingHumanSockets.delete(socket.id);

    if (wasRoomReset) {
      console.log('online human disconnected during room reset:', formatHumanMeta(meta));
      return;
    }

    io.emit('player_left', { playerIdx });
    console.log('online human disconnected:', formatHumanMeta(meta));

    if (countdownTimer && ROOM.state === 'countdown' && humanCount() < 2) {
      clearCountdownTimer();
      resetRoomToLobby();
      console.log('countdown cancelled: waiting for at least 2 human players');
      console.log('countdown returned room to lobby');
    }

    if (ROOM.state === 'playing') {
      if (humanCount() < 2) {
        resetRoomToLobby();
        if (humanCount() === 0) {
          console.log('all human players left -> lobby');
        } else {
          console.log('live round ended: waiting for at least 2 human players');
        }
      } else if (rebalanceLiveAISlots()) {
        console.log('rebalanced live AI slots after human disconnect');
      }
    } else if (humanCount() === 0) {
      resetRoomToLobby();
      console.log('all human players left -> lobby');
    }

    emitLobbyStatus();
    broadcastWorldIfPlaying();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   WORLD SERIALISATION
   ═══════════════════════════════════════════════════════════════════════ */
function serializeWorld() {
  return {
    tick:    ROOM.tickNum,
    roomId:  GAME_ROOM_ID,
    state:   ROOM.state,
    winner:  ROOM.winner,
    serverTimeMs: Date.now(),
    players: ROOM.players.map(p => p ? {
      idx:         p.idx,
      alive:       p.alive,
      fleetIndex:  p.fleetIndex,
      displayName: p.displayName,
      lastProcessedInputSeq: p.lastProcessedInputSeq,
      stats:       p.stats,
      ship: p.currentShip ? {
        x: p.currentShip.x, y: p.currentShip.y,
        vx: p.currentShip.vx, vy: p.currentShip.vy,
        angle: p.currentShip.angle, angularVel: p.currentShip.angularVel,
        hp: p.currentShip.hp, energy: p.currentShip.energy,
        alive: p.currentShip.alive,
        isInvulnerable: p.currentShip.isInvulnerable,
        spawnSeq: p.currentShip.spawnSeq,
      } : null,
    } : null),
    lasers:  ROOM.lasers.filter(l => l.alive).map(l => ({ x: l.x, y: l.y, angle: l.angle, ownerIdx: l.ownerIdx })),
    meteors: ROOM.meteors.map(m => ({ x: m.x, y: m.y, rot: m.rot, radius: m.radius, spriteKey: m.spriteKey, alive: m.alive })),
    events:  ROOM.events,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   GAME-END CHECK
   ═══════════════════════════════════════════════════════════════════════ */
function checkGameEnd() {
  const alive = ROOM.players.filter(p => p && p.alive);
  if (alive.length > 1) return;

  ROOM.winner = alive[0] ? alive[0].idx : null;
  ROOM.state  = 'gameOver';
  if (ROOM.winner !== null && ROOM.players[ROOM.winner]) ROOM.players[ROOM.winner].stats.wins++;

  io.emit('world', serializeWorld());
  io.emit('game_over', {
    winner:  ROOM.winner,
    players: ROOM.players.filter(Boolean).map(p => ({
      idx: p.idx, displayName: p.displayName, stats: p.stats, fleetIndex: p.fleetIndex,
    })),
  });
  console.log(`game over – winner: slot ${ROOM.winner}`);

  clearRestartTimer();
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (humanCount() >= 2 || hasTrainingVirtualSlots()) {
      resetGame();
      return;
    }

    resetRoomToLobby();
    emitLobbyStatus();
  }, RESTART_AFTER_MS);
}

/* ═══════════════════════════════════════════════════════════════════════
   PHYSICS GAME LOOP  (60 Hz)
   ═══════════════════════════════════════════════════════════════════════ */
function gameTick() {
  if (ROOM.state !== 'playing') return;

  const dt = TICK_MS;
  ROOM.tickNum++;
  ROOM.events = [];

  gameAISlots.forEach((slot) => {
    if (!virtualSlots.has(slot)) return;
    if (!ROOM.players[slot] || !ROOM.players[slot].alive) return;
    if (hasLiveAIServiceForSlot(slot)) return;
    ROOM.inputBuffer[slot] = buildFallbackAIInput(slot);
  });

  // Apply buffered inputs → ship physics
  ROOM.players.forEach(p => {
    if (!p || !p.alive) return;
    const ship = p.currentShip;
    if (!ship || !ship.alive) return;
    const inp = ROOM.inputBuffer[p.idx] || DEFAULT_INPUT;
    p.lastProcessedInputSeq = Number.isFinite(inp.seq) ? inp.seq : p.lastProcessedInputSeq;

    if (inp.forward)  ship.thrustForward(dt);
    if (inp.backward) ship.thrustBackward(dt);
    if (inp.left)     ship.rotateLeft(dt);
    if (inp.right)    ship.rotateRight(dt);

    p.shootCooldown -= dt;
    if (inp.shoot && p.shootCooldown <= 0 && ship.canShoot()) {
      ship.consumeShot();
      p.stats.shotsFired++;
      p.shootCooldown = 180;
      const rad = degToRad(ship.angle);
      ROOM.lasers.push(new Laser(
        ship.x + Math.sin(rad) * 28,
        ship.y - Math.cos(rad) * 28,
        ship.angle, p.idx
      ));
    }
    p.update(dt);
  });

  // Update lasers + meteors
  ROOM.lasers.forEach(l => l.update(dt));
  ROOM.lasers = ROOM.lasers.filter(l => l.alive);
  ROOM.meteors.forEach(m => m.update(dt));

  // Collisions: lasers ↔ ships
  ROOM.lasers.forEach(laser => {
    if (!laser.alive) return;
    ROOM.players.forEach(player => {
      if (!player || player.idx === laser.ownerIdx || !player.alive) return;
      const ship = player.currentShip;
      if (!ship || !ship.alive) return;
      if (dist2(laser, ship) < ship.radius + laser.radius) {
        laser.alive = false;
        const hit = ship.takeDamage(1);
        if (hit) {
          const shooter = ROOM.players[laser.ownerIdx];
          if (shooter) shooter.stats.shotsHit++;
          ROOM.events.push({ type: 'spark', x: laser.x, y: laser.y, color: CFG.PLAYER_COLORS[laser.ownerIdx] });
        }
        if (!ship.alive) {
          ROOM.events.push({ type: 'explosion', x: ship.x, y: ship.y });
          const shooter = ROOM.players[laser.ownerIdx];
          if (shooter) shooter.stats.shipsDestroyed++;
          if (!player.advanceFleet()) checkGameEnd();
        }
      }
    });
  });

  // Collisions: meteors ↔ ships
  ROOM.meteors.forEach(meteor => {
    if (!meteor.alive) return;
    ROOM.players.forEach(player => {
      if (!player || !player.alive) return;
      const ship = player.currentShip;
      if (!ship || !ship.alive) return;
      if (dist2(meteor, ship) < ship.radius + meteor.radius * 0.7) {
        if (ship.takeDamage(1)) ROOM.events.push({ type: 'spark', x: ship.x, y: ship.y, color: '#ffaa33' });
        if (!ship.alive) {
          ROOM.events.push({ type: 'explosion', x: ship.x, y: ship.y });
          if (!player.advanceFleet()) checkGameEnd();
        }
        meteor.angle += 180;
      }
    });
  });

  // Collisions: ships ↔ ships
  for (let i = 0; i < ROOM.players.length; i++) {
    for (let j = i + 1; j < ROOM.players.length; j++) {
      const pa = ROOM.players[i], pb = ROOM.players[j];
      if (!pa || !pb || !pa.alive || !pb.alive) continue;
      const sa = pa.currentShip, sb = pb.currentShip;
      if (!sa || !sa.alive || !sb || !sb.alive) continue;
      if (sa.isInvulnerable || sb.isInvulnerable) continue;

      const dx = sb.x - sa.x, dy = sb.y - sa.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      const md = sa.radius + sb.radius;
      if (d < md && d > 0) {
        const nx = dx / d, ny = dy / d, ov = (md - d) / 2;
        sa.x -= nx * ov; sa.y -= ny * ov;
        sb.x += nx * ov; sb.y += ny * ov;
        const dvx = sa.vx - sb.vx, dvy = sa.vy - sb.vy, dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          const imp = dot * 0.9;
          sa.vx -= imp * nx; sa.vy -= imp * ny;
          sb.vx += imp * nx; sb.vy += imp * ny;
          sa.angularVel += (dvx * ny - dvy * nx) * 0.05;
          sb.angularVel -= (dvx * ny - dvy * nx) * 0.05;
        }
        sa.takeDamage(1); sb.takeDamage(1);
        ROOM.events.push({ type: 'spark', x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2, color: '#ffffff' });
        if (!sa.alive) { ROOM.events.push({ type: 'explosion', x: sa.x, y: sa.y }); if (!pa.advanceFleet()) checkGameEnd(); }
        if (!sb.alive) { ROOM.events.push({ type: 'explosion', x: sb.x, y: sb.y }); if (!pb.advanceFleet()) checkGameEnd(); }
      }
    }
  }

  // Broadcast world snapshot at 20 Hz
  if (ROOM.tickNum % BROADCAST_EVERY === 0) {
    io.emit('world', serializeWorld());

    // Feed registered AI service clients with room-scoped state snapshots.
    aiServiceSockets.forEach((meta, socketId) => {
      if (meta.roomId !== GAME_ROOM_ID) return;
      const aiSocket = io.sockets.sockets.get(socketId);
      if (!aiSocket) return;
      aiSocket.emit('ai_game_state', buildAIStateForSlot(meta.slot, dt));
    });
  }
}

setInterval(gameTick, TICK_MS);

httpsServer.listen(PORT, () => console.log(`socket server running on port ${PORT}`));
