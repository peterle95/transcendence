/**
 * Space Fleet Battle — server-authoritative game server
 *
 * Runs the full game physics at 60 Hz and broadcasts a world-state
 * snapshot to all clients at ~20 Hz.  Clients send raw key inputs;
 * the server is the single source of truth for positions, HP, and
 * collision outcomes.
 */

const { Server } = require("socket.io");
const http       = require("http");

const PORT              = Number(process.env.SOCKET_PORT) || 4000;
const MAX_SLOTS         = 4;
const PHYSICS_HZ        = 60;
const BROADCAST_EVERY   = 3;           // broadcast every N ticks  → 20 Hz
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
  }

  spawn(x, y, angle = 0) {
    Object.assign(this, {
      x, y, angle,
      vx: 0, vy: 0, angularVel: 0,
      hp: CFG.SHIP_MAX_HP, energy: CFG.WEAPON_MAX_ENERGY, alive: true,
    });
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

function connectedCount() { return ROOM.slots.filter(Boolean).length; }

function resetGame() {
  ROOM.lasers    = [];
  ROOM.meteors   = [];
  ROOM.inputBuffer = {};
  ROOM.winner    = null;
  ROOM.events    = [];
  ROOM.players   = new Array(MAX_SLOTS).fill(null);
  ROOM.tickNum   = 0;

  for (let i = 0; i < MAX_SLOTS; i++) {
    if (ROOM.slots[i] !== null) {
      ROOM.players[i] = new ServerPlayer(i, displayNames[i] || '');
      ROOM.players[i].spawnCurrent();
      ROOM.inputBuffer[i] = {};
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
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', players: connectedCount(), state: ROOM.state }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('game socket server is running');
});

const defaultOrigins = ['http://localhost:3002', 'https://localhost:3002'];
const allowedOrigins = process.env.SOCKET_IO_ALLOWLIST
  ? process.env.SOCKET_IO_ALLOWLIST.split(',').map(s => s.trim())
  : defaultOrigins;

const io = new Server(httpServer, { cors: { origin: allowedOrigins, methods: ['GET', 'POST'] } });

// Countdown management
let countdownTimer = null;

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

io.on('connection', (socket) => {
  const playerIdx = ROOM.slots.indexOf(null);
  if (playerIdx === -1) {
    socket.emit('room_full');
    socket.disconnect(true);
    console.log('connection rejected – room full');
    return;
  }

  ROOM.slots[playerIdx] = socket.id;
  console.log(`player connected: ${socket.id} → slot ${playerIdx}`);

  // Tell this client their slot and current server state
  socket.emit('init', {
    playerIdx,
    existing:  ROOM.slots.map((id, i) => ({ idx: i, connected: id !== null })),
    gameState: ROOM.state,
  });

  // If game already running add player mid-game with invulnerability
  if (ROOM.state === 'playing') {
    ROOM.players[playerIdx] = new ServerPlayer(playerIdx, displayNames[playerIdx] || '');
    ROOM.players[playerIdx].spawnCurrent();
    ROOM.inputBuffer[playerIdx] = {};
  }

  socket.broadcast.emit('player_joined', { playerIdx });

  // Kick off countdown after first connection
  if (connectedCount() === 1 && ROOM.state === 'lobby') startCountdown();

  // ── events from client ──────────────────────────────────────────────
  socket.on('input', (inp) => {
    if (ROOM.state === 'playing') ROOM.inputBuffer[playerIdx] = inp;
  });

  socket.on('display_name', (name) => {
    if (typeof name !== 'string') return;
    displayNames[playerIdx] = name.slice(0, 32);
    if (ROOM.players[playerIdx]) ROOM.players[playerIdx].displayName = displayNames[playerIdx];
  });

  socket.on('disconnect', () => {
    ROOM.slots[playerIdx]   = null;
    ROOM.players[playerIdx] = null;
    delete ROOM.inputBuffer[playerIdx];
    delete displayNames[playerIdx];
    io.emit('player_left', { playerIdx });
    console.log(`player disconnected: slot ${playerIdx}`);

    if (connectedCount() === 0) {
      ROOM.state = 'lobby';
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      console.log('all players left → lobby');
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   WORLD SERIALISATION
   ═══════════════════════════════════════════════════════════════════════ */
function serializeWorld() {
  return {
    tick:    ROOM.tickNum,
    state:   ROOM.state,
    winner:  ROOM.winner,
    players: ROOM.players.map(p => p ? {
      idx:         p.idx,
      alive:       p.alive,
      fleetIndex:  p.fleetIndex,
      displayName: p.displayName,
      stats:       p.stats,
      ship: p.currentShip ? {
        x: p.currentShip.x, y: p.currentShip.y,
        vx: p.currentShip.vx, vy: p.currentShip.vy,
        angle: p.currentShip.angle, angularVel: p.currentShip.angularVel,
        hp: p.currentShip.hp, energy: p.currentShip.energy,
        alive: p.currentShip.alive,
        isInvulnerable: p.currentShip.isInvulnerable,
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

  setTimeout(() => {
    if (connectedCount() > 0) resetGame();
    else ROOM.state = 'lobby';
  }, RESTART_AFTER_MS);
}

/* ═══════════════════════════════════════════════════════════════════════
   PHYSICS GAME LOOP  (60 Hz)
   ═══════════════════════════════════════════════════════════════════════ */
let lastTickTime = Date.now();

function gameTick() {
  if (ROOM.state !== 'playing') return;

  const now = Date.now();
  const dt  = Math.min(now - lastTickTime, 50);
  lastTickTime = now;
  ROOM.tickNum++;
  ROOM.events = [];

  // Apply buffered inputs → ship physics
  ROOM.players.forEach(p => {
    if (!p || !p.alive) return;
    const ship = p.currentShip;
    if (!ship || !ship.alive) return;
    const inp = ROOM.inputBuffer[p.idx] || {};

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
  if (ROOM.tickNum % BROADCAST_EVERY === 0) io.emit('world', serializeWorld());
}

setInterval(gameTick, TICK_MS);
lastTickTime = Date.now();

httpServer.listen(PORT, () => console.log(`socket server running on port ${PORT}`));
