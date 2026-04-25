/**
 * ===================================================================
 *  SPACE FLEET BATTLE – Canvas-based space shooter (1-4 players)
 * ===================================================================
 *
 *  Controls 
 *  --------
 *  Player 1 (Blue)  – Arrows + Space
 *  Player 2 (Green) – W A S D  + Tab
 *
 *  Remote / AI players are handled through the exported API.
 *
 *  Game Rules (from Game Manual)
 *  • Each player owns a fleet of 4 ships.
 *  • Ships appear one at a time; when one is destroyed the next spawns.
 *  • Each ship has 20 HP.
 *  • Laser weapon is infinite but uses energy (50 units).
 *    – Each shot costs 1 unit.
 *    – Recharge rate: 1 unit every 500 ms.
 *  • Meteorites roam the arena and damage ships on contact.
 *  • Last fleet standing wins.
 * ===================================================================
 */

/* ─── asset root (relative from the HTML page that loads this script) ── */
const ASSET_ROOT = '/assets';

/* ═══════════════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════════════ */
const CFG = Object.freeze({
  /* canvas */
  WIDTH:  1280,
  HEIGHT: 720,
  BG_COLOR: '#0b0e2a',

  /* ship */
  SHIP_SPEED:       2.5,
  SHIP_ROT_SPEED:   4,          // degrees per frame
  SHIP_MAX_HP:      20,
  FLEET_SIZE:       4,
  SHIP_RADIUS:      40,         // collision radius
  SHIP_INVULN_TIME: 2000,       // ms invulnerability on spawn

  /* weapon */
  WEAPON_MAX_ENERGY:  40,
  WEAPON_SHOT_COST:   2,
  WEAPON_RECHARGE:    1,        // per tick
  WEAPON_RECHARGE_MS: 500,      // ms between recharge ticks
  LASER_SPEED:        8,
  LASER_RADIUS:       6,
  LASER_LIFETIME:     1500,     // ms

  /* meteorites */
  METEOR_COUNT:       8,
  METEOR_MIN_SPEED:   0.5,
  METEOR_MAX_SPEED:   2,
  METEOR_MIN_ROT:     -1,
  METEOR_MAX_ROT:     1,
  METEOR_RESPAWN_MS:  4000,

  /* HUD */
  BAR_WIDTH:   200,
  BAR_HEIGHT:  14,
  BAR_PADDING: 10,

  /* colours per player slot */
  PLAYER_COLORS: ['#4488ff', '#44cc44', '#ff8800', '#ee3333'],
  PLAYER_NAMES:  ['blue', 'green', 'orange', 'red'],
});

/* ═══════════════════════════════════════════════════════════════════════
   UTILITY HELPERS
   ═══════════════════════════════════════════════════════════════════════ */
function degToRad(d) { return d * Math.PI / 180; }
function radToDeg(r) { return r * 180 / Math.PI; }
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function wrapPos(obj, w, h, margin = 40) {
  if (obj.x < -margin)  obj.x = w + margin;
  if (obj.x > w + margin) obj.x = -margin;
  if (obj.y < -margin)  obj.y = h + margin;
  if (obj.y > h + margin) obj.y = -margin;
}

const ONLINE_CFG = Object.freeze({
  STEP_MS: 1000 / 60,
  LOCAL_RENDER_BASE: 0.18,
  LOCAL_SNAP_DISTANCE: 180,
  REMOTE_RENDER_DELAY_MS: 100,
  REMOTE_MAX_EXTRAPOLATION_MS: 100,
  WORLD_QUEUE_MAX: 90,
  REMOTE_BUFFER_MAX: 40,
});

function normalizeAngle(angle) {
  let out = angle;
  while (out > 180) out -= 360;
  while (out < -180) out += 360;
  return out;
}

function shortestAngleDelta(target, current) {
  let diff = target - current;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

function wrapCoordinate(value, size, margin = CFG.SHIP_RADIUS) {
  const span = size + margin * 2;
  return ((value + margin) % span + span) % span - margin;
}

function unwrapCoordinate(rawValue, previousRawValue, previousUnwrappedValue, size) {
  let delta = rawValue - previousRawValue;
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return previousUnwrappedValue + delta;
}

function createContinuousState(x, y, angle = 0) {
  return {
    rawX: x,
    rawY: y,
    unwrappedX: x,
    unwrappedY: y,
    angle: normalizeAngle(angle),
  };
}

function advanceContinuousState(state, x, y, angle = 0) {
  if (!state) return createContinuousState(x, y, angle);
  return {
    rawX: x,
    rawY: y,
    unwrappedX: unwrapCoordinate(x, state.rawX, state.unwrappedX, CFG.WIDTH),
    unwrappedY: unwrapCoordinate(y, state.rawY, state.unwrappedY, CFG.HEIGHT),
    angle: normalizeAngle(angle),
  };
}

function applyForwardThrust(state, dt) {
  const rad = degToRad(state.angle);
  const thrust = CFG.SHIP_SPEED * dt / 16;
  state.vx += Math.sin(rad) * thrust;
  state.vy -= Math.cos(rad) * thrust;
}

function applyBackwardThrust(state, dt) {
  const rad = degToRad(state.angle);
  const thrust = CFG.SHIP_SPEED * dt / 16;
  state.vx -= Math.sin(rad) * thrust;
  state.vy += Math.cos(rad) * thrust;
}

function applyRotateLeft(state, dt) {
  state.angularVel -= 0.4 * dt / 16;
}

function applyRotateRight(state, dt) {
  state.angularVel += 0.4 * dt / 16;
}

function rechargeShipEnergy(state, nowMs) {
  if (!Number.isFinite(state.lastRechargeTime)) state.lastRechargeTime = nowMs;
  if (state.energy < CFG.WEAPON_MAX_ENERGY &&
      nowMs - state.lastRechargeTime >= CFG.WEAPON_RECHARGE_MS) {
    state.energy = Math.min(state.energy + CFG.WEAPON_RECHARGE, CFG.WEAPON_MAX_ENERGY);
    state.lastRechargeTime = nowMs;
  }
}

function updateShipPhysics(state, dt, nowMs = performance.now()) {
  const maxAngular = CFG.SHIP_ROT_SPEED * 0.8;
  state.angularVel = clamp(state.angularVel, -maxAngular, maxAngular);
  state.angle = normalizeAngle(state.angle + state.angularVel * dt / 16);
  state.angularVel *= 0.95;

  state.x += state.vx * dt / 16;
  state.y += state.vy * dt / 16;

  state.vx *= 0.98;
  state.vy *= 0.98;

  const maxSpeed = CFG.SHIP_SPEED * 2;
  const speed = Math.sqrt(state.vx ** 2 + state.vy ** 2);
  if (speed > maxSpeed) {
    state.vx = (state.vx / speed) * maxSpeed;
    state.vy = (state.vy / speed) * maxSpeed;
  }

  wrapPos(state, CFG.WIDTH, CFG.HEIGHT, state.radius || CFG.SHIP_RADIUS);
  rechargeShipEnergy(state, nowMs);
}

function applyShipInput(state, input, dt) {
  if (!state || !state.alive) return;
  if (input.forward) applyForwardThrust(state, dt);
  if (input.backward) applyBackwardThrust(state, dt);
  if (input.left) applyRotateLeft(state, dt);
  if (input.right) applyRotateRight(state, dt);
}

function stepShipState(state, input, dt, nowMs = performance.now()) {
  if (!state || !state.alive) return;
  applyShipInput(state, input, dt);
  updateShipPhysics(state, dt, nowMs);
}

function createShipStateFromSnapshot(snapshot, nowMs = performance.now()) {
  return {
    x: snapshot.x,
    y: snapshot.y,
    vx: snapshot.vx,
    vy: snapshot.vy,
    angle: normalizeAngle(snapshot.angle),
    angularVel: snapshot.angularVel,
    hp: snapshot.hp,
    energy: snapshot.energy,
    alive: snapshot.alive,
    radius: CFG.SHIP_RADIUS,
    spawnSeq: snapshot.spawnSeq || 0,
    lastRechargeTime: nowMs,
  };
}

function createShipStateFromShip(ship, nowMs = performance.now()) {
  return {
    x: ship.x,
    y: ship.y,
    vx: ship.vx,
    vy: ship.vy,
    angle: normalizeAngle(ship.angle),
    angularVel: ship.angularVel,
    hp: ship.hp,
    energy: ship.energy,
    alive: ship.alive,
    radius: ship.radius,
    spawnSeq: ship.spawnSeq || 0,
    lastRechargeTime: nowMs,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   SOCKET MANAGER  (server-authoritative online multiplayer)
   ═══════════════════════════════════════════════════════════════════════ */
class SocketManager {
  /**
   * @param {string} url  e.g. "http://localhost:4000"
   */
  constructor(url, options = {}) {
    this.playerIdx        = null;   // slot assigned by server (0-3)
    this.connected        = false;
    this.serverGameState  = 'lobby'; // 'lobby'|'countdown'|'playing'|'gameOver'
    this.humanCount       = 0;
    this.hasReceivedWorld = false;
    this.countdown        = null;   // seconds remaining, or null
    this.worldQueue       = [];     // ordered authoritative snapshots
    this.pendingGameOver  = null;   // latest game_over payload
    this.gameRestarted    = false;  // flipped true when server sends game_start
    this.identity         = null;
    this.isAuthenticated  = false;
    this.pendingSystemMessage = null;

    if (typeof io === 'undefined') {
      console.warn('[SocketManager] socket.io client not loaded – online mode unavailable');
      this.socket = null;
      return;
    }

    const opts = { transports: ['websocket'] };
    if (options && typeof options.playerToken === 'string' && options.playerToken) {
      opts.auth = {
        player_token: options.playerToken,
      };
    }
    if (typeof window !== 'undefined') {
      opts.path = '/game/socket.io/';
    }
    this.socket = io(url, opts);

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[SocketManager] connected as', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.hasReceivedWorld = false;
      this.worldQueue = [];
      console.log('[SocketManager] disconnected');
    });

    this.socket.on('init', ({ playerIdx, gameState, humanCount, identity }) => {
      this.playerIdx       = playerIdx;
      this.serverGameState = gameState || 'lobby';
      this.humanCount      = Number.isInteger(humanCount) ? humanCount : this.humanCount;
      this.identity        = identity || null;
      this.isAuthenticated = Boolean(identity && identity.userId);
      this.hasReceivedWorld = false;
      console.log('[SocketManager] assigned slot', playerIdx, '| serverState:', gameState);
    });

    this.socket.on('lobby_status', ({ gameState, humanCount }) => {
      this.serverGameState = typeof gameState === 'string' ? gameState : this.serverGameState;
      this.humanCount = Number.isInteger(humanCount) ? humanCount : this.humanCount;
      if (this.serverGameState === 'lobby') this.countdown = null;
    });

    this.socket.on('countdown', ({ seconds }) => {
      this.serverGameState = 'countdown';
      this.countdown       = seconds;
    });

    this.socket.on('game_start', () => {
      this.serverGameState = 'playing';
      this.hasReceivedWorld = false;
      this.countdown       = null;
      this.gameRestarted   = true;
      this.worldQueue      = [];
    });

    this.socket.on('world', (world) => {
      const snapshot = {
        ...world,
        receivedAtMs: performance.now(),
      };
      this.worldQueue.push(snapshot);
      if (this.worldQueue.length > ONLINE_CFG.WORLD_QUEUE_MAX) {
        this.worldQueue.splice(0, this.worldQueue.length - ONLINE_CFG.WORLD_QUEUE_MAX);
      }
      this.hasReceivedWorld = true;
      this.serverGameState = snapshot.state;
    });

    this.socket.on('game_over', (data) => {
      this.pendingGameOver = data;
      this.serverGameState = 'gameOver';
    });

    this.socket.on('player_joined', ({ playerIdx }) => {
      console.log('[SocketManager] player joined slot', playerIdx);
    });

    this.socket.on('player_left', ({ playerIdx }) => {
      console.log('[SocketManager] player left slot', playerIdx);
    });

    this.socket.on('online_auth_required', (payload = {}) => {
      this.pendingSystemMessage = {
        title: 'Login Required',
        message: typeof payload.message === 'string' && payload.message
          ? payload.message
          : 'Login required for online multiplayer.',
      };
    });

    this.socket.on('room_reset', (payload = {}) => {
      const initiator = typeof payload.initiatorUsername === 'string' && payload.initiatorUsername
        ? payload.initiatorUsername
        : '';
      const baseMessage = typeof payload.message === 'string' && payload.message
        ? payload.message
        : 'Online room was reset.';
      this.pendingSystemMessage = {
        title: 'Online Room Reset',
        message: initiator
          ? `${baseMessage} Requested by ${initiator}.`
          : baseMessage,
      };
    });

    this.socket.on('remote_multiplayer_disabled', (payload = {}) => {
      this.pendingSystemMessage = {
        title: 'Mode Unavailable',
        message: typeof payload.message === 'string' && payload.message
          ? payload.message
          : 'Remote multiplayer is not enabled on this server.',
      };
    });

    this.socket.on('room_full', () => {
      console.warn('[SocketManager] room is full – cannot join');
      this.pendingSystemMessage = {
        title: 'Room Full',
        message: 'The online room is full right now. Please try again in a moment.',
      };
    });

    this.socket.on('already_in_game', (payload = {}) => {
      console.warn('[SocketManager] already connected to this game from another session');
      this.pendingSystemMessage = {
        title: 'Already In Game',
        message: typeof payload.message === 'string' && payload.message
        ? payload.message
        : 'You are already connected to this game from another session.',
    };
    });
  }

  /**
   * Send a fixed-step input packet to the server.
   * @param {{ seq, forward, backward, left, right, shoot }} inputs
   */
  emitInput(inputs) {
    if (!this.socket || !this.connected || this.playerIdx === null) return;
    this.socket.emit('input', inputs);
  }

  drainWorldQueue() {
    if (this.worldQueue.length === 0) return [];
    return this.worldQueue.splice(0, this.worldQueue.length);
  }

  consumeSystemMessage() {
    const message = this.pendingSystemMessage;
    this.pendingSystemMessage = null;
    return message;
  }

  requestRoomReset() {
    if (!this.socket || !this.connected || !this.isAuthenticated) return;
    this.socket.emit('reset_room');
  }

  disconnect() {
    this.worldQueue = [];
    if (this.socket) this.socket.disconnect();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   ASSET LOADER
   ═══════════════════════════════════════════════════════════════════════ */
class AssetLoader {
  constructor() {
    this.images = {};
    this._queue = [];
  }

  enqueue(key, src) {
    this._queue.push({ key, src });
  }

  loadAll() {
    const promises = this._queue.map(({ key, src }) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => { this.images[key] = img; resolve(); };
        img.onerror = () => {
          console.warn(`Asset not found: ${src}`);
          resolve(); // non-blocking
        };
        img.src = src;
      });
    });
    return Promise.all(promises);
  }

  get(key) { return this.images[key] || null; }
}

/* ═══════════════════════════════════════════════════════════════════════
   INPUT MANAGER
   ═══════════════════════════════════════════════════════════════════════ */
class InputManager {
  constructor() {
    this.keys = {};
    this._gameplayKeys = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'Tab',
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
    ]);

    this._onDown = (e) => {
      const keys = this._getEventKeys(e);
      keys.forEach((key) => {
        this.keys[key] = true;
      });
      if (keys.some((key) => this._gameplayKeys.has(key))) {
        e.preventDefault();
      }
    };
    this._onUp = (e) => {
      const keys = this._getEventKeys(e);
      keys.forEach((key) => {
        this.keys[key] = false;
      });
      if (keys.some((key) => this._gameplayKeys.has(key))) {
        e.preventDefault();
      }
    };
    this._onBlur = () => this.clear();
    this._onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        this.clear();
      }
    };
  }

  attach() {
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup',   this._onUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  detach() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup',   this._onUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this.clear();
  }

  clear() { this.keys = {}; }

  _normalizeKey(value) {
    if (typeof value !== 'string' || !value) return null;

    switch (value) {
      case ' ':
      case 'Space':
      case 'Spacebar':
        return 'Space';
      case 'Tab':
        return 'Tab';
      case 'ArrowUp':
      case 'Up':
        return 'ArrowUp';
      case 'ArrowDown':
      case 'Down':
        return 'ArrowDown';
      case 'ArrowLeft':
      case 'Left':
        return 'ArrowLeft';
      case 'ArrowRight':
      case 'Right':
        return 'ArrowRight';
      default:
        if (value.length === 1) {
          const upper = value.toUpperCase();
          if (['W', 'A', 'S', 'D'].includes(upper)) {
            return `Key${upper}`;
          }
        }
        return value;
    }
  }

  _getEventKeys(event) {
    const out = [];
    const add = (value) => {
      const normalized = this._normalizeKey(value);
      if (normalized && !out.includes(normalized)) {
        out.push(normalized);
      }
    };

    add(event.code);
    add(event.key);
    return out;
  }

  isDown(code) { return !!this.keys[code]; }
}

/* ═══════════════════════════════════════════════════════════════════════
   PARTICLE (simple explosion / thruster)
   ═══════════════════════════════════════════════════════════════════════ */
class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt / 16;
    this.y += this.vy * dt / 16;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx) {
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   LASER
   ═══════════════════════════════════════════════════════════════════════ */
class Laser {
  constructor(x, y, angle, ownerIdx, assets) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.ownerIdx = ownerIdx;
    this.speed = CFG.LASER_SPEED;
    this.radius = CFG.LASER_RADIUS;
    this.alive = true;
    this.born = performance.now();

    // pick laser sprite
    const colorName = CFG.PLAYER_NAMES[ownerIdx];
    const laserColorMap = { blue: 'Blue', green: 'Green', orange: 'Red', red: 'Red' };
    const laserKey = `laser_${laserColorMap[colorName]}_01`;
    this.sprite = assets.get(laserKey);
  }

  update(dt) {
    const rad = degToRad(this.angle);
    this.x += Math.sin(rad) * this.speed * dt / 16;
    this.y -= Math.cos(rad) * this.speed * dt / 16;

    // off screen = dead
    if (this.x < -50 || this.x > CFG.WIDTH + 50 ||
        this.y < -50 || this.y > CFG.HEIGHT + 50) {
      this.alive = false;
    }
    // lifetime
    if (performance.now() - this.born > CFG.LASER_LIFETIME) {
      this.alive = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(degToRad(this.angle));
    if (this.sprite) {
      ctx.drawImage(this.sprite, -this.sprite.width / 2, -this.sprite.height / 2);
    } else {
      ctx.fillStyle = CFG.PLAYER_COLORS[this.ownerIdx];
      ctx.fillRect(-2, -10, 4, 20);
    }
    ctx.restore();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   METEOR
   ═══════════════════════════════════════════════════════════════════════ */
const METEOR_DEFS = [
  { key: 'meteorBrown_big1',   radius: 50 },
  { key: 'meteorBrown_big2',   radius: 49 },
  { key: 'meteorBrown_big3',   radius: 45 },
  { key: 'meteorBrown_big4',   radius: 48 },
  { key: 'meteorGrey_big1',    radius: 50 },
  { key: 'meteorGrey_big2',    radius: 49 },
  { key: 'meteorBrown_med1',   radius: 22 },
  { key: 'meteorBrown_med3',   radius: 22 },
  { key: 'meteorGrey_med1',    radius: 22 },
  { key: 'meteorGrey_med2',    radius: 22 },
  { key: 'meteorBrown_small1', radius: 14 },
  { key: 'meteorBrown_small2', radius: 14 },
  { key: 'meteorGrey_small1',  radius: 14 },
  { key: 'meteorGrey_small2',  radius: 14 },
];

class Meteor {
  constructor(assets) {
    this.assets = assets;
    this.alive = true;
    this.respawnTimer = 0;
    this._randomise(true);
  }

  _randomise(initial = false) {
    const def = METEOR_DEFS[randInt(0, METEOR_DEFS.length - 1)];
    this.spriteKey = def.key;
    this.radius = def.radius;
    this.rot = 0;
    this.rotSpeed = rand(CFG.METEOR_MIN_ROT, CFG.METEOR_MAX_ROT);
    this.speed = rand(CFG.METEOR_MIN_SPEED, CFG.METEOR_MAX_SPEED);
    this.angle = rand(0, 360);
    // spawn at random edge
    const side = randInt(0, 3);
    const margin = this.radius + 10;
    if (initial) {
      this.x = rand(margin, CFG.WIDTH - margin);
      this.y = rand(margin, CFG.HEIGHT - margin);
    } else {
      switch (side) {
        case 0: this.x = -margin;            this.y = rand(0, CFG.HEIGHT); break;
        case 1: this.x = CFG.WIDTH + margin;  this.y = rand(0, CFG.HEIGHT); break;
        case 2: this.y = -margin;            this.x = rand(0, CFG.WIDTH);  break;
        case 3: this.y = CFG.HEIGHT + margin;  this.x = rand(0, CFG.WIDTH);  break;
      }
    }
  }

  update(dt) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.alive = true;
        this._randomise(false);
      }
      return;
    }
    const rad = degToRad(this.angle);
    this.x += Math.sin(rad) * this.speed * dt / 16;
    this.y -= Math.cos(rad) * this.speed * dt / 16;
    this.rot += this.rotSpeed * dt / 16;
    wrapPos(this, CFG.WIDTH, CFG.HEIGHT, this.radius + 20);
  }

  destroy() {
    this.alive = false;
    this.respawnTimer = CFG.METEOR_RESPAWN_MS;
  }

  draw(ctx) {
    if (!this.alive) return;
    const sprite = this.assets.get(this.spriteKey);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(degToRad(this.rot));
    if (sprite) {
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    } else {
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   SHIP
   ═══════════════════════════════════════════════════════════════════════ */
class Ship {
  constructor(playerIdx, shipNum, assets) {
    this.playerIdx = playerIdx;
    this.shipNum = shipNum;              // 1-4
    this.assets = assets;
    this.hp = CFG.SHIP_MAX_HP;
    this.alive = true;
    this.angle = 0;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
	this.angularVel = 0;
    this.radius = CFG.SHIP_RADIUS;
    this.invulnUntil = 0;

    // weapon energy
    this.energy = CFG.WEAPON_MAX_ENERGY;
    this.lastRechargeTime = 0;
    this.spawnSeq = 0;

    // sprite key
    const color = CFG.PLAYER_NAMES[playerIdx];
    this.spriteKey = `playerShip${shipNum}_${color}`;
  }

  spawn(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle || 0;
    this.hp = CFG.SHIP_MAX_HP;
    this.energy = CFG.WEAPON_MAX_ENERGY;
    this.alive = true;
    this.vx = 0;
    this.vy = 0;
    this.angularVel = 0;
    this.spawnSeq += 1;
    this.invulnUntil = performance.now() + CFG.SHIP_INVULN_TIME;
    this.lastRechargeTime = performance.now();
  }

  get isInvulnerable() {
    return performance.now() < this.invulnUntil;
  }

  takeDamage(amount = 1) {
    if (this.isInvulnerable) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return true;
  }

  /* movement helpers called by Player */

//   thrustForward(dt) {
//     const rad = degToRad(this.angle);
//     this.x += Math.sin(rad) * CFG.SHIP_SPEED * dt / 16;
//     this.y -= Math.cos(rad) * CFG.SHIP_SPEED * dt / 16;
//   }

//   thrustBackward(dt) {
//     const rad = degToRad(this.angle);
//     this.x -= Math.sin(rad) * CFG.SHIP_SPEED * dt / 16;
//     this.y += Math.cos(rad) * CFG.SHIP_SPEED * dt / 16;
//   }


thrustForward(dt) {
  applyForwardThrust(this, dt);
}

thrustBackward(dt) {
  applyBackwardThrust(this, dt);
}


rotateLeft(dt) {
  applyRotateLeft(this, dt);
}

rotateRight(dt) {
  applyRotateRight(this, dt);
}

  rechargeWeapon(now) {
    rechargeShipEnergy(this, now);
  }

  canShoot() {
    return this.energy >= CFG.WEAPON_SHOT_COST;
  }

  consumeShot() {
    this.energy -= CFG.WEAPON_SHOT_COST;
  }

update(dt) {
  updateShipPhysics(this, dt, performance.now());
}

  draw(ctx) {
    if (!this.alive) return;
    const sprite = this.assets.get(this.spriteKey);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(degToRad(this.angle));

    // blink when invulnerable
    if (this.isInvulnerable && Math.floor(performance.now() / 100) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    if (sprite) {
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    } else {
      // fallback triangle
      ctx.fillStyle = CFG.PLAYER_COLORS[this.playerIdx];
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-14, 16);
      ctx.lineTo(14, 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   PLAYER
   ═══════════════════════════════════════════════════════════════════════ */
class Player {
  /**
   * @param {number}   idx        0-3
   * @param {string}   type       'local' | 'remote'
   * @param {object}   controls   { forward, backward, left, right, shoot }
   * @param {AssetLoader} assets
   */
  constructor(idx, type, controls, assets) {
    this.idx = idx;
    this.type = type;
    this.controls = controls;
    this.assets = assets;
    this.fleetIndex = 0;           // which ship in fleet is active (0-3)
    this.ships = [];
    this.alive = true;
    this.shootCooldown = 0;
    this.displayName = null;       // set externally (username or 'AI')
    this.userId = null;            // set externally (from auth service)
    this.isAI = false;
    this._networkState = null;

    // stats (for global rankings)
    this.stats = {
      shotsFired: 0,
      shotsHit: 0,
      shipsLost: 0,
      shipsDestroyed: 0,
      wins: 0,
    };

    // build fleet
    for (let i = 1; i <= CFG.FLEET_SIZE; i++) {
      this.ships.push(new Ship(idx, i, assets));
    }

    this.resetOnlineState();
  }

  resetOnlineState() {
    this._pendingInputs = [];
    this._nextInputSeq = 0;
    this._predictedShipState = null;
    this._predictedContinuous = null;
    this._renderContinuous = null;
    this._remoteSnapshots = [];
    this._onlineMeta = null;
    this._latestServerTimeMs = 0;
    this._latestReceiptTimeMs = 0;
  }

  applyNetworkState(state) {
    this._networkState = state || null;
  }

  get currentShip() {
    return this.ships[this.fleetIndex] || null;
  }

  /** Bring the current ship on screen */
  spawnCurrent() {
    const ship = this.currentShip;
    if (!ship) return;
    // spawn positions for up to 4 players (corners-ish)
    const positions = [
      { x: 200,              y: 200,              angle: 135 },
      { x: CFG.WIDTH - 200,  y: CFG.HEIGHT - 200, angle: -45 },
      { x: CFG.WIDTH - 200,  y: 200,              angle: -135 },
      { x: 200,              y: CFG.HEIGHT - 200,  angle: 45  },
    ];
    const pos = positions[this.idx % positions.length];
    ship.spawn(pos.x, pos.y, pos.angle);
  }

  /** Advance to next ship in fleet; returns false if fleet exhausted */
  advanceFleet() {
    this.fleetIndex++;
    this.stats.shipsLost++;
    if (this.fleetIndex >= CFG.FLEET_SIZE) {
      this.alive = false;
      return false;
    }
    this.spawnCurrent();
    return true;
  }

  handleInput(input, dt) {
    const ship = this.currentShip;
    if (!ship || !ship.alive) return null;

    if (this.type === 'local') {
      if (input.isDown(this.controls.forward))  ship.thrustForward(dt);
      if (input.isDown(this.controls.backward)) ship.thrustBackward(dt);
      if (input.isDown(this.controls.left))     ship.rotateLeft(dt);
      if (input.isDown(this.controls.right))    ship.rotateRight(dt);

      this.shootCooldown -= dt;
      if (input.isDown(this.controls.shoot) && this.shootCooldown <= 0 && ship.canShoot()) {
        ship.consumeShot();
        this.stats.shotsFired++;
        this.shootCooldown = 180;   // ms cooldown between shots
        return this._createLaser(ship);
      }
    } else if (this.type === 'remote') {
      const s = this._networkState;
      if (!s) return null;

      // AI remote commands are incremental controls like local input.
      const hasIncremental =
        Number.isFinite(Number(s.movimento)) ||
        Number.isFinite(Number(s.rotazione)) ||
        Number.isFinite(Number(s.sparo));

      if (hasIncremental) {
        const movimento = Number(s.movimento) || 0;
        const rotazione = Number(s.rotazione) || 0;

        if (movimento === 1) ship.thrustForward(dt);
        else if (movimento === 2) ship.thrustBackward(dt);

        if (rotazione === 1) ship.rotateLeft(dt);
        else if (rotazione === 2) ship.rotateRight(dt);
      } else {
        // Fallback for legacy remote peers sending absolute transforms.
        ship.x     = s.x;
        ship.y     = s.y;
        ship.angle = s.angle;
      }

      this.shootCooldown -= dt;
      if ((s.shoot || Number(s.sparo) === 1) && this.shootCooldown <= 0 && ship.canShoot()) {
        ship.consumeShot();
        this.stats.shotsFired++;
        this.shootCooldown = 180;
        return this._createLaser(ship);
      }
    } 
    return null;
  }

   _createLaser(ship) {
    const rad = degToRad(ship.angle);
    const tipX = ship.x + Math.sin(rad) * 28;
    const tipY = ship.y - Math.cos(rad) * 28;
    return new Laser(tipX, tipY, ship.angle, this.idx, this.assets);
  }

  update(dt) {
    const ship = this.currentShip;
    if (ship && ship.alive) ship.update(dt);
  }

  /**
   * Apply a state snapshot received from the socket server.
   * Used by 'remote' type players to mirror the authoritative client.
   * @param {{ x,y,vx,vy,angle,angularVel,hp,energy,fleetIndex,alive }} state
   */
  applyRemoteState(state) {
    // Advance fleet index to match remote (ship was lost on their end)
    while (this.fleetIndex < state.fleetIndex && this.fleetIndex < CFG.FLEET_SIZE) {
      this.fleetIndex++;
      this.stats.shipsLost++;
    }
    this.alive = state.alive;

    const ship = this.currentShip;
    if (!ship) return;
    ship.x          = state.x;
    ship.y          = state.y;
    ship.vx         = state.vx;
    ship.vy         = state.vy;
    ship.angle      = state.angle;
    ship.angularVel = state.angularVel;
    ship.hp         = state.hp;
    ship.energy     = state.energy;
    ship.alive      = state.alive;
  }

  draw(ctx) {
    const ship = this.currentShip;
    if (ship && ship.alive) ship.draw(ctx);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   HUD
   ═══════════════════════════════════════════════════════════════════════ */
class HUD {
  constructor(players) {
    this.players = players;
  }

  draw(ctx) {
    const pad = CFG.BAR_PADDING;
    const bw  = CFG.BAR_WIDTH;
    const bh  = CFG.BAR_HEIGHT;
    // Top offset so nothing is cut off at the canvas edge
    const topOffset = 24;

    this.players.forEach((player, i) => {
      if (!player) return;
      const ship = player.currentShip;

      // position: 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right
      let bx, by;
      switch (i) {
        case 0: bx = pad;                       by = topOffset; break;
        case 1: bx = CFG.WIDTH - bw - pad;      by = topOffset; break;
        case 2: bx = pad;                       by = CFG.HEIGHT - (bh * 2 + pad * 3 + 14); break;
        case 3: bx = CFG.WIDTH - bw - pad;      by = CFG.HEIGHT - (bh * 2 + pad * 3 + 14); break;
        default: return;
      }

      const color = CFG.PLAYER_COLORS[i];
      const colorName = CFG.PLAYER_NAMES[i];
      const labelName = player.displayName || colorName.toUpperCase();

      // ── player label (name + fleet count) ──
      ctx.fillStyle = color;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(
        `${labelName}  Fleet: ${CFG.FLEET_SIZE - player.fleetIndex}/${CFG.FLEET_SIZE}`,
        bx, by + 12
      );

      // ── fleet ship icons ──
      const lifeSprite = this.players[0]?.assets?.get(`playerLife1_${colorName}`);
      for (let s = player.fleetIndex; s < CFG.FLEET_SIZE; s++) {
        const ix = bx + (s - player.fleetIndex) * 24;
        if (lifeSprite) {
          ctx.drawImage(lifeSprite, ix, by + 16, 20, 20);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(ix, by + 18, 16, 10);
        }
      }

      if (!ship || !ship.alive) {
        ctx.globalAlpha = 0.3;
      }

      // ── HP bar ──
      const barY = by + 40;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, barY, bw, bh);
      const hpRatio = ship ? ship.hp / CFG.SHIP_MAX_HP : 0;
      ctx.fillStyle = hpRatio > 0.5 ? '#44dd44' : hpRatio > 0.25 ? '#ddaa22' : '#dd3333';
      ctx.fillRect(bx, barY, bw * hpRatio, bh);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, barY, bw, bh);
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText('HP', bx + 4, barY + bh - 3);

      // ── Energy bar ──
      const enY = barY + bh + 4;
      ctx.fillStyle = '#222';
      ctx.fillRect(bx, enY, bw, bh);
      const enRatio = ship ? ship.energy / CFG.WEAPON_MAX_ENERGY : 0;
      ctx.fillStyle = color;
      ctx.fillRect(bx, enY, bw * enRatio, bh);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(bx, enY, bw, bh);
      ctx.fillStyle = '#fff';
      ctx.fillText('EN', bx + 4, enY + bh - 3);

      ctx.globalAlpha = 1;
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   GAME STATE ENUM
   ═══════════════════════════════════════════════════════════════════════ */
const STATE = Object.freeze({
  MENU:      'menu',
  PLAYING:   'playing',
  GAME_OVER: 'gameOver',
  RANKING: 'ranking',
});

/* ═══════════════════════════════════════════════════════════════════════
   MAIN GAME CLASS
   ═══════════════════════════════════════════════════════════════════════ */
class Game {
  /**
   * @param {HTMLCanvasElement}  canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx  = canvas.getContext('2d');
    this.assets = new AssetLoader();
    this.input = new InputManager();
    this.state = STATE.MENU;

    this.players   = [];
    this.lasers    = [];
    this.meteors   = [];
    this.particles = [];
    this.hud = null;

    this.bgImage  = null;
    this.lastTime = 0;

    this.selectedMode = null;     // for menu
    this.winner = null;

    // stats collected across games
    this.globalStats = {};
    this.mainMenu = null;
    if (typeof window !== 'undefined' && typeof window.MainMenuController === 'function') {
      this.mainMenu = new window.MainMenuController(this);
    }
    this._isPausedByMenu = false;
    this._teardownInGameMenu = null;

    this._rafId = null;

    /** @type {SocketManager|null} Active in 'online' mode only. */
    this.socketMgr = null;
    this._onlineInputAccumulator = 0;

    // Local AI bridge (client local physics + ai_srvc commands over socket relay)
    this.networkSocket = null;
    this.networkRoomId = (typeof window !== 'undefined' && window.GAME_ROOM_ID)
      ? window.GAME_ROOM_ID
      : 'gameplay-room';
    this._aiBridgeClientId = null;
    this._availableAISlots = new Set();
    this._lastInputSend = 0;
    this._onlineJoinNonce = 0;
    this._onlineJoinPendingMessage = '';
    this._onlineNoticeText = '';
    this._onlineNoticeUntil = 0;
  }

  _disconnectAIBridge() {
    if (this.networkSocket) {
      this.networkSocket.disconnect();
      this.networkSocket = null;
    }
    this._aiBridgeClientId = null;
    this._setAvailableAISlots([]);
  }

  _createAIBridgeClientId() {
    return `local-ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  _setAvailableAISlots(slots = []) {
  const normalizedSlots = Array.isArray(slots)
    ? slots
        .map((slot) => Number(slot))
        .filter((slot) => Number.isInteger(slot) && slot >= 0 && slot < 4)
    : [];

  this._availableAISlots = new Set(normalizedSlots);

  this.players.forEach((player) => {
    if (!(player && player.type === 'remote' && player.isAI)) return;

    if (!this._availableAISlots.has(player.idx)) {
      player.applyNetworkState({
        slot: player.idx,
        movimento: 0,
        rotazione: 0,
        sparo: 0,
        shoot: false,
      });
    }
  });

  this._syncLocalAIStatusLabels();
}

  _syncLocalAIStatusLabels() {
    this.players.forEach((player) => {
      if (!(player && player.type === 'remote' && player.isAI)) return;
      player.displayName = this._availableAISlots.has(player.idx) ? 'AI' : 'AI (offline)';
    });
  }

  _connectAIBridge() {
    if (this.networkSocket || typeof io === 'undefined') return;
    if (!this._aiBridgeClientId) {
      this._aiBridgeClientId = this._createAIBridgeClientId();
    }

    const socketPort = (typeof window !== 'undefined' && window.GAME_SOCKET_PORT)
      ? window.GAME_SOCKET_PORT
      : 4000;
    
    const socketUrl = typeof window !== 'undefined'
      ? window.location.origin
      : `http://localhost:${socketPort}`;

    const opts = {
      transports: ['websocket'],
      auth: {
        bridge_role: 'local_ai_client',
        room_id: this.networkRoomId,
        bridge_client_id: this._aiBridgeClientId,
      },
    };
    if (typeof window !== 'undefined') {
      opts.path = '/game/socket.io/';
    }

    this.networkSocket = io(socketUrl, opts);
    this.networkSocket.on('connect', () => {
      console.log('[AIBridge] connected to', socketUrl, '| room=', this.networkRoomId, '| client=', this._aiBridgeClientId);
    });
    this.networkSocket.on('disconnect', () => {
      console.log('[AIBridge] disconnected');
      this._setAvailableAISlots([]);
    });
    this.networkSocket.on('ai_bridge_ready', (payload = {}) => {
      if (payload.roomId !== this.networkRoomId) return;
      if (typeof payload.bridgeClientId === 'string' && payload.bridgeClientId) {
        this._aiBridgeClientId = payload.bridgeClientId;
      }
      this._setAvailableAISlots(payload.availableSlots);
      console.log('[AIBridge] ready | available slots:', [...this._availableAISlots].join(',') || 'none');
    });
    this.networkSocket.on('ai_service_status', (payload = {}) => {
      if (payload.roomId !== this.networkRoomId) return;
      this._setAvailableAISlots(payload.availableSlots);
      console.log('[AIBridge] AI service status | available slots:', [...this._availableAISlots].join(',') || 'none');
    });
    this.networkSocket.on('ai_command', (payload) => {
      if (!payload || payload.roomId !== this.networkRoomId) return;
      if (payload.bridgeClientId && payload.bridgeClientId !== this._aiBridgeClientId) return;
      this.onAICommand(payload);
    });
  }

  /* ─── asset registration ─────────────────────────────────────── */
  _registerAssets() {
    const a = this.assets;

    // background
    a.enqueue('bg', `${ASSET_ROOT}/Backgrounds/blue.png`);

    // ships + life icons  (4 ships × 4 colours)
    for (const color of CFG.PLAYER_NAMES) {
      for (let i = 1; i <= 4; i++) {
        a.enqueue(`playerShip${i}_${color}`, `${ASSET_ROOT}/PNG/playerShip${i}_${color}.png`);
      }
      // life icons
      for (let l = 1; l <= 3; l++) {
        a.enqueue(`playerLife${l}_${color}`, `${ASSET_ROOT}/PNG/UI/playerLife${l}_${color}.png`);
      }
    }

    // lasers (Blue, Green, Red — no orange sprites, orange player uses Red lasers)
    for (const lc of ['Blue', 'Green', 'Red']) {
      for (let n = 1; n <= 16; n++) {
        const nn = String(n).padStart(2, '0');
        a.enqueue(`laser_${lc}_${nn}`, `${ASSET_ROOT}/PNG/Lasers/laser${lc}${nn}.png`);
      }
    }

    // meteors
    for (const def of METEOR_DEFS) {
      a.enqueue(def.key, `${ASSET_ROOT}/PNG/Meteors/${def.key}.png`);
    }

    // explosion frames
    for (let i = 0; i <= 19; i++) {
      const nn = String(i).padStart(2, '0');
      a.enqueue(`fire${nn}`, `${ASSET_ROOT}/PNG/Effects/fire${nn}.png`);
    }

    // damage overlays
    for (let s = 1; s <= 3; s++) {
      for (let d = 1; d <= 3; d++) {
        a.enqueue(`damage_${s}_${d}`, `${ASSET_ROOT}/PNG/Damage/playerShip${s}_damage${d}.png`);
      }
    }
  }

  /* ─── init ───────────────────────────────────────────────────── */
  async init() {
    this.canvas.width  = CFG.WIDTH;
    this.canvas.height = CFG.HEIGHT;
    this.input.attach();
    if (this.mainMenu) {
      this.mainMenu.attach();
    }
    if (typeof window !== 'undefined' && typeof window.attachInGameMenu === 'function') {
      this._teardownInGameMenu = window.attachInGameMenu(this);
    }
    this._registerAssets();
    await this.assets.loadAll();
    this.bgImage = this.assets.get('bg');
    this._loop(performance.now());
  }

  destroy() {
    this.input.detach();
    if (this.mainMenu) {
      this.mainMenu.detach();
    }
    if (typeof this._teardownInGameMenu === 'function') {
      this._teardownInGameMenu();
      this._teardownInGameMenu = null;
    }
    if (typeof window !== 'undefined' && typeof window.hideGlobalStatsScreen === 'function') {
      window.hideGlobalStatsScreen();
    }
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._onlineJoinNonce += 1;
    this._onlineJoinPendingMessage = '';
    if (this.socketMgr) {
      this.socketMgr.disconnect();
      this.socketMgr = null;
    }
    this._disconnectAIBridge();
  }

  cancelCurrentSession() {
    if (typeof document !== 'undefined') {
      const inGameMenu = document.getElementById('in-game-menu-overlay');
      if (inGameMenu) inGameMenu.remove();
    }
    if (typeof window !== 'undefined' && typeof window.hideGlobalStatsScreen === 'function') {
      window.hideGlobalStatsScreen();
    }
    this.players = [];
    this.lasers = [];
    this.meteors = [];
    this.particles = [];
    this.hud = null;
    this.winner = null;
    this.selectedMode = null;
    this._isPausedByMenu = false;
    this._onlineJoinNonce += 1;
    this._onlineJoinPendingMessage = '';
    this._onlineNoticeText = '';
    this._onlineNoticeUntil = 0;
    if (this.socketMgr) {
      this.socketMgr.disconnect();
      this.socketMgr = null;
    }
    this._disconnectAIBridge();
    this.state = STATE.MENU;
    if (this.mainMenu) {
      this.mainMenu.reset(300);
    }
  }

  /* ─── game modes ─────────────────────────────────────────────── */
  _showSystemModal(title, message) {
    if (typeof document === 'undefined') {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`${title}\n\n${message}`);
      }
      return;
    }

    const existing = document.getElementById('space-fleet-system-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'space-fleet-system-modal';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0, 0, 0, 0.8)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1200';

    const panel = document.createElement('div');
    panel.style.background = '#1a1d36';
    panel.style.border = '2px solid #ffcc00';
    panel.style.padding = '36px';
    panel.style.borderRadius = '16px';
    panel.style.maxWidth = '620px';
    panel.style.textAlign = 'center';
    panel.style.color = '#fff';
    panel.style.fontFamily = 'monospace';
    panel.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.45)';

    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.style.margin = '0 0 18px';
    heading.style.fontSize = '30px';
    heading.style.color = '#ffcc00';

    const body = document.createElement('p');
    body.textContent = message;
    body.style.margin = '0 0 28px';
    body.style.fontSize = '18px';
    body.style.lineHeight = '1.6';
    body.style.color = '#ddd';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'OK';
    button.style.background = '#ff4400';
    button.style.color = '#fff';
    button.style.border = 'none';
    button.style.padding = '12px 40px';
    button.style.fontSize = '20px';
    button.style.fontFamily = 'monospace';
    button.style.fontWeight = 'bold';
    button.style.borderRadius = '8px';
    button.style.cursor = 'pointer';

    const close = () => {
      overlay.remove();
      if (this.mainMenu) this.mainMenu.setCooldown(300);
    };

    button.addEventListener('click', close);
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === 'Escape' || event.key === ' ') {
        event.preventDefault();
        close();
      }
    });

    panel.appendChild(heading);
    panel.appendChild(body);
    panel.appendChild(button);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    button.focus();
  }

  _returnToMenuWithMessage(title, message) {
    this.cancelCurrentSession();
    this._showSystemModal(title, message);
  }

  async _fetchOnlineAuthToken() {
    if (typeof fetch === 'undefined') return null;

    try {
      const response = await fetch('/game/api/auth/token', {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) return null;
      const data = await response.json();
      return (data && typeof data.token === 'string' && data.token) ? data.token : null;
    } catch (error) {
      console.warn('[Online] token fetch failed', error);
      return null;
    }
  }

  async _beginOnlineJoin(socketUrl, joinNonce) {
    this._onlineJoinPendingMessage = 'Authenticating online...';
    const token = await this._fetchOnlineAuthToken();

    if (this._onlineJoinNonce !== joinNonce || this.selectedMode !== 'online') return;

    if (!token) {
      this._onlineJoinPendingMessage = '';
      this._returnToMenuWithMessage('Login Required', 'Log in before joining Online multiplayer.');
      return;
    }

    const mgr = new SocketManager(socketUrl, { playerToken: token });
    if (!mgr.socket) {
      this._onlineJoinPendingMessage = '';
      this._returnToMenuWithMessage('Online Unavailable', 'The online room could not be opened right now.');
      return;
    }

    if (this._onlineJoinNonce !== joinNonce || this.selectedMode !== 'online') {
      mgr.disconnect();
      return;
    }

    this.socketMgr = mgr;
    this._onlineJoinPendingMessage = 'Connecting to online room...';

    mgr.socket.once('init', ({ playerIdx, gameState, identity }) => {
      if (this.socketMgr !== mgr || this._onlineJoinNonce !== joinNonce) return;

      this._onlineJoinPendingMessage = '';
      const player = this.players[playerIdx];
      if (player) {
        player.displayName = identity && identity.username
          ? identity.username
          : CFG.PLAYER_NAMES[playerIdx].toUpperCase();
        player.userId = identity && identity.userId ? identity.userId : null;
      }

      if (gameState === 'playing') {
        this._showOnlineNotice('Joining live match...', 2400);
      } else {
        this._onlineNoticeText = '';
        this._onlineNoticeUntil = 0;
      }
    });
  }

  requestOnlineRoomReset() {
    if (!this.socketMgr) return;
    this.socketMgr.requestRoomReset();
  }

  _consumeOnlineSystemMessage() {
    if (!this.socketMgr) return false;
    const systemMessage = this.socketMgr.consumeSystemMessage();
    if (!systemMessage) return false;

    this._onlineJoinPendingMessage = '';
    this._returnToMenuWithMessage(systemMessage.title, systemMessage.message);
    return true;
  }

  _setupPlayers(mode) {
    this.players = [];
    this.lasers  = [];
    this.meteors = [];
    this.particles = [];
    this.winner  = null;
    this._onlineInputAccumulator = 0;
    this._onlineJoinNonce += 1;
    this._onlineJoinPendingMessage = '';
    if (this.socketMgr) {
      this.socketMgr.disconnect();
      this.socketMgr = null;
    }
    this._disconnectAIBridge();

    const p1Controls = {
      forward:  'ArrowUp',
      backward: 'ArrowDown',
      left:     'ArrowLeft',
      right:    'ArrowRight',
      shoot:    'Space',
    };
    const p2Controls = {
      forward:  'KeyW',
      backward: 'KeyS',
      left:     'KeyA',
      right:    'KeyD',
      shoot:    'Tab',
    };

    const createMLAIPlayer = (idx) => {
      const player = new Player(idx, 'remote', {}, this.assets);
      player.isAI = true;
      player.displayName = 'AI';
      player.userId = null;
      return player;
    };

    if (mode === 'solo') {
      this.players.push(new Player(0, 'local', p1Controls, this.assets));
      this.players.push(createMLAIPlayer(1));
    } else if (mode === 'local2') {
      this.players.push(new Player(0, 'local', p1Controls, this.assets));
      this.players.push(new Player(1, 'local', p2Controls, this.assets));
    } else if (mode === 'local3') {
      this.players.push(new Player(0, 'local', p1Controls, this.assets));
      this.players.push(new Player(1, 'local', p2Controls, this.assets));
      this.players.push(createMLAIPlayer(2));
    } else if (mode === 'local4') {
      this.players.push(new Player(0, 'local', p1Controls, this.assets));
      this.players.push(new Player(1, 'local', p2Controls, this.assets));
      this.players.push(createMLAIPlayer(2));
      this.players.push(createMLAIPlayer(3));
    } else if (mode === 'online') {
      // All 4 slots are view-only; the server owns all physics.
      // We identify ourselves by playerIdx from 'init' and send key inputs.
      for (let i = 0; i < 4; i++) {
        this.players.push(new Player(i, 'remote', {}, this.assets));
      }

      const socketPort = (typeof window !== 'undefined' && window.GAME_SOCKET_PORT)
        ? window.GAME_SOCKET_PORT
        : 4000;
      // Connect to the root domain and let Nginx route the path
      const socketUrl = typeof window !== 'undefined'
        ? window.location.origin
        : `http://localhost:${socketPort}`;
      const joinNonce = this._onlineJoinNonce;
      this._onlineJoinPendingMessage = 'Authenticating online...';
      this._beginOnlineJoin(socketUrl, joinNonce);
    }

    // Assign display names and user IDs
    const currentUser = typeof window !== 'undefined' ? window.currentUser : null;
    this.players.forEach(p => {
      if (p.type === 'remote' && p.isAI) {
        p.displayName = 'AI';
        p.userId = null;
      } else if (p.type === 'remote') {
        p.displayName = CFG.PLAYER_NAMES[p.idx].toUpperCase();
        p.userId = null;
      } else if (p.idx === 0 && currentUser) {
        p.displayName = currentUser.username;
        p.userId = currentUser.id;
      } else {
        p.displayName = CFG.PLAYER_NAMES[p.idx].toUpperCase();
        p.userId = null;
      }
    });

    this._syncLocalAIStatusLabels();


    if (mode === 'online') {
      this.players.forEach((player) => this._clearOnlinePlayerState(player));
    } else {
      // spawn first ships
      this.players.forEach(p => p.spawnCurrent());
    }

    const hasLocalAI = this.players.some((player) => player && player.type === 'remote' && player.isAI);
    if (hasLocalAI) {
      this._connectAIBridge();
    }

    // create meteors
    for (let i = 0; i < CFG.METEOR_COUNT; i++) {
      this.meteors.push(new Meteor(this.assets));
    }
    if (mode === 'online') {
      this.meteors.forEach((meteor) => { meteor.alive = false; });
    }

    this.hud = new HUD(this.players);
  }

  /* ─── main loop ──────────────────────────────────────────────── */
  _loop = (timestamp) => {
    const dt = Math.min(timestamp - this.lastTime, 50); // cap to avoid spiral
    this.lastTime = timestamp;

    switch (this.state) {
      case STATE.MENU:
        if (this.mainMenu) {
          this.mainMenu.update(dt);
          this.mainMenu.draw();
        }
        break;
      case STATE.PLAYING:
        if (!this._isPausedByMenu) {
          this._update(dt);
        }
        this._draw();
        break;
      case STATE.GAME_OVER: this._drawGameOver(); break;
      case STATE.RANKING:   this._drawRanking();  break;
    }

    this._rafId = requestAnimationFrame(this._loop);
  };

  /* ═══════════════════  GAME OVER  ═════════════════════════════ */
  _gameOverCooldown = 0;

  _drawGameOver() {
    // If the HTML ranking overlay is showing, just keep drawing the background
    // and let the overlay handle user interaction.
    if (document.getElementById('ranking-overlay')) {
      this._drawBackground();
      this._drawMeteors();
      return;
    }

    const ctx = this.ctx;
    this._drawBackground();
    this._drawMeteors();

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);

    ctx.textAlign = 'center';

    if (this.winner != null) {
      const color = CFG.PLAYER_COLORS[this.winner.idx];
      const name  = CFG.PLAYER_NAMES[this.winner.idx].toUpperCase();

      ctx.fillStyle = color;
      ctx.font = 'bold 52px monospace';
      ctx.fillText(`${name} WINS!`, CFG.WIDTH / 2, CFG.HEIGHT / 2 - 40);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 44px monospace';
      ctx.fillText('DRAW!', CFG.WIDTH / 2, CFG.HEIGHT / 2 - 40);
    }

    // stats
    ctx.font = '16px monospace';
    ctx.fillStyle = '#ccc';
    let sy = CFG.HEIGHT / 2 + 20;
    this.players.forEach((p) => {
      const name = CFG.PLAYER_NAMES[p.idx].toUpperCase();
      const acc  = p.stats.shotsFired > 0
        ? Math.round((p.stats.shotsHit / p.stats.shotsFired) * 100) + '%'
        : '--';
      ctx.fillStyle = CFG.PLAYER_COLORS[p.idx];
      ctx.fillText(
        `${name}  Ships lost: ${p.stats.shipsLost}  Destroyed: ${p.stats.shipsDestroyed}  Accuracy: ${acc}`,
        CFG.WIDTH / 2, sy
      );
      sy += 28;
    });

    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Press Enter to return to menu', CFG.WIDTH / 2, CFG.HEIGHT - 50);
    ctx.textAlign = 'left';

    if (this.input.isDown('Enter') || this.input.isDown('Space')) {
      if (this._gameOverCooldown <= 0) {
        this.state = STATE.MENU;
        if (this.mainMenu) {
          this.mainMenu.reset(300);
        }
      }
    }
    this._gameOverCooldown -= 16;
  }

  _drawRanking() {
    // If the HTML ranking overlay is showing, just keep drawing the background
    // and let the overlay handle user interaction.
    if (document.getElementById('ranking-overlay')) {
      this._drawBackground();
      this._drawMeteors();
      return;
    }

    const ctx = this.ctx;
    this._drawBackground();
    this._drawMeteors();

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);

    ctx.textAlign = 'center';

    if (this.winner != null) {
      const color = CFG.PLAYER_COLORS[this.winner.idx];
      const name  = CFG.PLAYER_NAMES[this.winner.idx].toUpperCase();

      ctx.fillStyle = color;
      ctx.font = 'bold 52px monospace';
      ctx.fillText(`${name} WINS!`, CFG.WIDTH / 2, CFG.HEIGHT / 2 - 40);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 44px monospace';
      ctx.fillText('DRAW!', CFG.WIDTH / 2, CFG.HEIGHT / 2 - 40);
    }

    // stats
    ctx.font = '16px monospace';
    ctx.fillStyle = '#ccc';
    let sy = CFG.HEIGHT / 2 + 20;
    this.players.forEach((p) => {
      const name = CFG.PLAYER_NAMES[p.idx].toUpperCase();
      const acc  = p.stats.shotsFired > 0
        ? Math.round((p.stats.shotsHit / p.stats.shotsFired) * 100) + '%'
        : '--';
      ctx.fillStyle = CFG.PLAYER_COLORS[p.idx];
      ctx.fillText(
        `${name}  Ships lost: ${p.stats.shipsLost}  Destroyed: ${p.stats.shipsDestroyed}  Accuracy: ${acc}`,
        CFG.WIDTH / 2, sy
      );
      sy += 28;
    });

    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Press Enter to return to menu', CFG.WIDTH / 2, CFG.HEIGHT - 50);
    ctx.textAlign = 'left';

    if (this.input.isDown('Enter') || this.input.isDown('Space')) {
      if (this._gameOverCooldown <= 0) {
        this.state = STATE.MENU;
        if (this.mainMenu) {
          this.mainMenu.reset(300);
        }
      }
    }
    this._gameOverCooldown -= 16;
  }

  /** Feed authoritative position from a peer into their remote player slot */
  onPeerState(state) {
    const remote = this.players.find(p => p.type === 'remote' && p.idx === state.slot);
    if (remote) remote.applyNetworkState(state);
  }

  onAICommand(state) {
    const aiRemote = this.players.find(p => p.type === 'remote' && p.isAI && p.idx === state.slot);
    if (aiRemote) aiRemote.applyNetworkState(state);
  }

  /* ═══════════════════  UPDATE  ════════════════════════════════ */
  _update(dt) {
    // Online mode: server owns all physics.  Client only sends inputs and
    // renders the world state it receives.  Skip local simulation entirely.
    if (this.socketMgr) {
      this._handleOnlineUpdate(dt);
      return;
    }
    if (this.selectedMode === 'online') {
      return;
    }

    const now = performance.now();

    // ── player input & laser creation ──
    this.players.forEach(p => {
      if (!p.alive) return;
      const laser = p.handleInput(this.input, dt);
      if (laser) this.lasers.push(laser);
      p.update(dt);
    });

    // ── update lasers ──
    this.lasers.forEach(l => l.update(dt));
    this.lasers = this.lasers.filter(l => l.alive);

    // ── update meteors ──
    this.meteors.forEach(m => m.update(dt));

    // ── update particles ──
    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => p.alive);

    // ── send AI state snapshots to ai_srvc through Socket.IO bridge ──
    if (this.networkSocket && this.networkSocket.connected && this.networkRoomId && now - this._lastInputSend > 33) {
      this.players.forEach(p => {
        if (!(p.type === 'remote' && p.isAI) || !p.alive) return;
        const ship = p.currentShip;
        if (!ship || !ship.alive) return;

        this.networkSocket.emit('ai_game_state', {
          roomId: this.networkRoomId,
          slot: p.idx,
          bridgeClientId: this._aiBridgeClientId,
          dt_ms: dt,
          my_ship: {
            x: ship.x,
            y: ship.y,
            angle: ship.angle,
            vx: ship.vx,
            vy: ship.vy,
            energy: ship.energy,
            hp: ship.hp,
            alive: ship.alive,
            radius: ship.radius,
          },
          enemies: this.players
            .filter(other => other !== p && other.alive)
            .map(other => {
              const os = other.currentShip;
              return os ? {
                x: os.x,
                y: os.y,
                angle: os.angle,
                hp: os.hp,
                alive: os.alive,
              } : null;
            })
            .filter(Boolean),
          lasers: this.lasers.map(l => ({
            x: l.x,
            y: l.y,
            is_enemy: l.ownerIdx !== p.idx,
          })),
          meteors: this.meteors
            .filter(m => m.alive)
            .map(m => ({ x: m.x, y: m.y, radius: m.radius, alive: m.alive })),
        });
      });
      this._lastInputSend = now;
    }

    // ── collisions: lasers ↔ ships ──
    this.lasers.forEach(laser => {
      if (!laser.alive) return;
      this.players.forEach(player => {
        if (player.idx === laser.ownerIdx) return; // no friendly fire
        if (!player.alive) return;
        const ship = player.currentShip;
        if (!ship || !ship.alive) return;

        if (dist(laser, ship) < ship.radius + laser.radius) {
          laser.alive = false;
          const hit = ship.takeDamage(1);
          if (hit) {
            // track accuracy
            const shooter = this.players.find(p => p.idx === laser.ownerIdx);
            if (shooter) shooter.stats.shotsHit++;
            // spark particles
            this._spawnSparks(laser.x, laser.y, CFG.PLAYER_COLORS[laser.ownerIdx]);
          }
          // ship destroyed?
          if (!ship.alive) {
            this._spawnExplosion(ship.x, ship.y);
            const shooter = this.players.find(p => p.idx === laser.ownerIdx);
            if (shooter) shooter.stats.shipsDestroyed++;
            if (!player.advanceFleet()) {
              this._checkGameEnd();
            }
          }
        }
      });
    });

    // ── collisions: meteors ↔ ships ──
    this.meteors.forEach(meteor => {
      if (!meteor.alive) return;
      this.players.forEach(player => {
        if (!player.alive) return;
        const ship = player.currentShip;
        if (!ship || !ship.alive) return;
        if (dist(meteor, ship) < ship.radius + meteor.radius * 0.7) {
          const hit = ship.takeDamage(1);
          if (hit) {
            this._spawnSparks(ship.x, ship.y, '#ffaa33');
          }
          if (!ship.alive) {
            this._spawnExplosion(ship.x, ship.y);
            if (!player.advanceFleet()) {
              this._checkGameEnd();
            }
          }
          // bounce meteor away
          meteor.angle += 180;
        }
      });
    });

	// ── collisions: ships ↔ ships ──
for (let i = 0; i < this.players.length; i++) {
  for (let j = i + 1; j < this.players.length; j++) {
    const pa = this.players[i];
    const pb = this.players[j];
    if (!pa.alive || !pb.alive) continue;
    const sa = pa.currentShip;
    const sb = pb.currentShip;
    if (!sa || !sa.alive || !sb || !sb.alive) continue;
    if (sa.isInvulnerable || sb.isInvulnerable) continue;

    const dx = sb.x - sa.x;
    const dy = sb.y - sa.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    const minDist = sa.radius + sb.radius;

    if (d < minDist && d > 0) {
      // Normalizza vettore di collisione
      const nx = dx / d;
      const ny = dy / d;

      // Separa le navi per evitare overlap
      const overlap = (minDist - d) / 2;
      sa.x -= nx * overlap;
      sa.y -= ny * overlap;
      sb.x += nx * overlap;
      sb.y += ny * overlap;

      // Scambia velocità lungo l'asse di collisione (rimbalzo elastico, masse uguali)
      const dvx = sa.vx - sb.vx;
      const dvy = sa.vy - sb.vy;
      const dot = dvx * nx + dvy * ny;

      if (dot > 0) { // si stanno avvicinando
        const impulse = dot * 0.9; // 0.9 = leggermente anelastico
        sa.vx -= impulse * nx;
        sa.vy -= impulse * ny;
        sb.vx += impulse * nx;
        sb.vy += impulse * ny;

        // Trasferisci un po' di rotazione dall'impatto
        sa.angularVel += (dvx * ny - dvy * nx) * 0.05;
        sb.angularVel -= (dvx * ny - dvy * nx) * 0.05;
      }

      // Danno reciproco
      sa.takeDamage(1);
      sb.takeDamage(1);
      this._spawnSparks((sa.x + sb.x) / 2, (sa.y + sb.y) / 2, '#ffffff');

      // Controlla se qualcuna è distrutta
      if (!sa.alive) {
        this._spawnExplosion(sa.x, sa.y);
        if (!pa.advanceFleet()) this._checkGameEnd();
      }
      if (!sb.alive) {
        this._spawnExplosion(sb.x, sb.y);
        if (!pb.advanceFleet()) this._checkGameEnd();
      }
    }
  }
}

    // ── collisions: lasers ↔ meteors ──
    this.lasers.forEach(laser => {
      if (!laser.alive) return;
      this.meteors.forEach(meteor => {
        if (!meteor.alive) return;
        if (dist(laser, meteor) < meteor.radius + laser.radius) {
          laser.alive = false;
          this._spawnSparks(laser.x, laser.y, '#aaa');
          // large meteors take a few hits, small ones are destroyed
          if (meteor.radius < 20) {
            meteor.destroy();
            this._spawnSparks(meteor.x, meteor.y, '#aaa');
          } else {
            meteor.angle += rand(-40, 40);
          }
        }
      });
    });

  }

  _checkGameEnd() {
    const alive = this.players.filter(p => p.alive);
    console.log('[checkGameEnd] alive:', alive.length, '| showRankingScreen:', typeof window.showRankingScreen);
    if (alive.length <= 1) {
      this.winner = alive[0] || null;
      this.state = STATE.GAME_OVER;
      this._gameOverCooldown = 800;

      // Show ranking overlay if available
      if (typeof window !== 'undefined' && typeof window.showRankingScreen === 'function') {
        const mode = this.selectedMode || ('local' + this.players.length);
        console.log('[checkGameEnd] calling showRankingScreen, mode:', mode);
        window.showRankingScreen(this.players, this.winner, mode, () => {
          this.state = STATE.MENU;
          if (this.mainMenu) {
            this.mainMenu.reset(300);
          }
        });
      } else {
        console.warn('[checkGameEnd] showRankingScreen not found – gameOver_stats.js loaded?');
      }
    }
  }

  /* ══════════════════  ONLINE MODE (server-authoritative)  ═════ */

  /**
   * Called by _update() instead of the local physics block when in online mode.
   * Sends raw inputs to server; applies pending world snapshots; handles events.
   */
  _getOnlineInputState() {
    return {
      forward: this.input.isDown('ArrowUp'),
      backward: this.input.isDown('ArrowDown'),
      left: this.input.isDown('ArrowLeft'),
      right: this.input.isDown('ArrowRight'),
      shoot: this.input.isDown('Space'),
    };
  }

  _applyAuthoritativeShipState(ship, snapshot) {
    if (!ship || !snapshot) return;
    ship.vx = snapshot.vx;
    ship.vy = snapshot.vy;
    ship.angularVel = snapshot.angularVel;
    ship.hp = snapshot.hp;
    ship.energy = snapshot.energy;
    ship.alive = snapshot.alive;
    ship.spawnSeq = snapshot.spawnSeq || 0;
    if (snapshot.isInvulnerable) ship.invulnUntil = performance.now() + 200;
  }

  _snapShipToContinuous(ship, continuous) {
    if (!ship || !continuous) return;
    ship.x = wrapCoordinate(continuous.unwrappedX, CFG.WIDTH, ship.radius);
    ship.y = wrapCoordinate(continuous.unwrappedY, CFG.HEIGHT, ship.radius);
    ship.angle = normalizeAngle(continuous.angle);
  }

  _clearOnlinePlayerState(player) {
    if (!player) return;
    player.resetOnlineState();
    player.fleetIndex = 0;
    player.alive = false;
    player.ships.forEach((ship) => {
      ship.alive = false;
      ship.vx = 0;
      ship.vy = 0;
      ship.angularVel = 0;
    });
  }

  _ensureLocalPrediction(player) {
    const ship = player && player.currentShip;
    if (!player || !ship || !ship.alive || player._predictedShipState) return;
    player._predictedShipState = createShipStateFromShip(ship);
    player._predictedContinuous = createContinuousState(ship.x, ship.y, ship.angle);
    if (!player._renderContinuous) {
      player._renderContinuous = createContinuousState(ship.x, ship.y, ship.angle);
    }
    player._onlineMeta = {
      fleetIndex: player.fleetIndex,
      alive: ship.alive,
      spawnSeq: ship.spawnSeq || 0,
    };
  }

  _replayPendingLocalInputs(player) {
    if (!player || !player._predictedShipState || !player._predictedContinuous) return;
    let replayNow = performance.now() - player._pendingInputs.length * ONLINE_CFG.STEP_MS;
    player._pendingInputs.forEach((input) => {
      stepShipState(player._predictedShipState, input, ONLINE_CFG.STEP_MS, replayNow);
      player._predictedContinuous = advanceContinuousState(
        player._predictedContinuous,
        player._predictedShipState.x,
        player._predictedShipState.y,
        player._predictedShipState.angle
      );
      replayNow += ONLINE_CFG.STEP_MS;
    });
  }

  _applyOwnSnapshot(player, ps) {
    const ship = player.currentShip;
    if (!ship || !ps.ship) return;

    const snapshot = ps.ship;
    const nextMeta = {
      fleetIndex: ps.fleetIndex,
      alive: snapshot.alive,
      spawnSeq: snapshot.spawnSeq || 0,
    };
    const previousMeta = player._onlineMeta;
    const discontinuity =
      !previousMeta ||
      previousMeta.fleetIndex !== nextMeta.fleetIndex ||
      previousMeta.alive !== nextMeta.alive ||
      previousMeta.spawnSeq !== nextMeta.spawnSeq;

    const ackSeq = Number.isFinite(ps.lastProcessedInputSeq) ? ps.lastProcessedInputSeq : 0;
    player._pendingInputs = player._pendingInputs.filter((input) => input.seq > ackSeq);
    player._predictedShipState = createShipStateFromSnapshot(snapshot);
    player._predictedContinuous = createContinuousState(snapshot.x, snapshot.y, snapshot.angle);
    this._replayPendingLocalInputs(player);

    this._applyAuthoritativeShipState(ship, snapshot);

    const target = player._predictedContinuous;
    if (!player._renderContinuous || discontinuity) {
      player._renderContinuous = { ...target };
      this._snapShipToContinuous(ship, player._renderContinuous);
    } else {
      const dx = target.unwrappedX - player._renderContinuous.unwrappedX;
      const dy = target.unwrappedY - player._renderContinuous.unwrappedY;
      if (Math.hypot(dx, dy) > ONLINE_CFG.LOCAL_SNAP_DISTANCE) {
        player._renderContinuous = { ...target };
        this._snapShipToContinuous(ship, player._renderContinuous);
      }
    }

    player._onlineMeta = nextMeta;
  }

  _applyRemoteSnapshot(player, ps, world) {
    const ship = player.currentShip;
    if (!ship || !ps.ship) return;

    const snapshot = ps.ship;
    const nextMeta = {
      fleetIndex: ps.fleetIndex,
      alive: snapshot.alive,
      spawnSeq: snapshot.spawnSeq || 0,
    };
    const previousMeta = player._onlineMeta;
    const discontinuity =
      !previousMeta ||
      previousMeta.fleetIndex !== nextMeta.fleetIndex ||
      previousMeta.alive !== nextMeta.alive ||
      previousMeta.spawnSeq !== nextMeta.spawnSeq;

    if (discontinuity) {
      player._remoteSnapshots = [];
      player._renderContinuous = createContinuousState(snapshot.x, snapshot.y, snapshot.angle);
      this._snapShipToContinuous(ship, player._renderContinuous);
    }

    const previousSample = player._remoteSnapshots[player._remoteSnapshots.length - 1];
    const continuous = previousSample
      ? advanceContinuousState(previousSample, snapshot.x, snapshot.y, snapshot.angle)
      : createContinuousState(snapshot.x, snapshot.y, snapshot.angle);

    player._remoteSnapshots.push({
      rawX: snapshot.x,
      rawY: snapshot.y,
      unwrappedX: continuous.unwrappedX,
      unwrappedY: continuous.unwrappedY,
      angle: normalizeAngle(snapshot.angle),
      vx: snapshot.vx,
      vy: snapshot.vy,
      angularVel: snapshot.angularVel,
      serverTimeMs: Number(world.serverTimeMs) || Date.now(),
      receivedAtMs: Number(world.receivedAtMs) || performance.now(),
    });
    player._remoteSnapshots = player._remoteSnapshots
      .filter((sample) => sample.serverTimeMs >= (Number(world.serverTimeMs) || 0) - 1000);
    if (player._remoteSnapshots.length > ONLINE_CFG.REMOTE_BUFFER_MAX) {
      player._remoteSnapshots.splice(0, player._remoteSnapshots.length - ONLINE_CFG.REMOTE_BUFFER_MAX);
    }

    player._latestServerTimeMs = Number(world.serverTimeMs) || Date.now();
    player._latestReceiptTimeMs = Number(world.receivedAtMs) || performance.now();
    player._onlineMeta = nextMeta;
    this._applyAuthoritativeShipState(ship, snapshot);
  }

  _sampleRemoteRenderTarget(player, nowMs) {
    if (!player || player._remoteSnapshots.length === 0) return null;

    const samples = player._remoteSnapshots;
    const latest = samples[samples.length - 1];
    const renderServerTime =
      latest.serverTimeMs +
      Math.max(0, nowMs - latest.receivedAtMs) -
      ONLINE_CFG.REMOTE_RENDER_DELAY_MS;

    if (renderServerTime <= samples[0].serverTimeMs) {
      const first = samples[0];
      return {
        unwrappedX: first.unwrappedX,
        unwrappedY: first.unwrappedY,
        angle: first.angle,
      };
    }

    for (let i = 0; i < samples.length - 1; i++) {
      const current = samples[i];
      const next = samples[i + 1];
      if (renderServerTime >= current.serverTimeMs && renderServerTime <= next.serverTimeMs) {
        const span = Math.max(1, next.serverTimeMs - current.serverTimeMs);
        const t = clamp((renderServerTime - current.serverTimeMs) / span, 0, 1);
        return {
          unwrappedX: current.unwrappedX + (next.unwrappedX - current.unwrappedX) * t,
          unwrappedY: current.unwrappedY + (next.unwrappedY - current.unwrappedY) * t,
          angle: normalizeAngle(current.angle + shortestAngleDelta(next.angle, current.angle) * t),
        };
      }
    }

    const extraMs = Math.min(
      Math.max(0, renderServerTime - latest.serverTimeMs),
      ONLINE_CFG.REMOTE_MAX_EXTRAPOLATION_MS
    );
    return {
      unwrappedX: latest.unwrappedX + latest.vx * extraMs / 16,
      unwrappedY: latest.unwrappedY + latest.vy * extraMs / 16,
      angle: normalizeAngle(latest.angle + latest.angularVel * extraMs / 16),
    };
  }

  _updateRemoteRenders(nowMs, ownIdx) {
    this.players.forEach((player, idx) => {
      if (!player || idx === ownIdx) return;
      const ship = player.currentShip;
      const target = this._sampleRemoteRenderTarget(player, nowMs);
      if (!ship || !target) return;
      player._renderContinuous = {
        rawX: target.unwrappedX,
        rawY: target.unwrappedY,
        unwrappedX: target.unwrappedX,
        unwrappedY: target.unwrappedY,
        angle: target.angle,
      };
      this._snapShipToContinuous(ship, player._renderContinuous);
    });
  }

  _updateLocalRender(player, dt) {
    const ship = player && player.currentShip;
    const target = player && player._predictedContinuous;
    if (!ship || !target) return;

    if (!player._renderContinuous) {
      player._renderContinuous = { ...target };
      this._snapShipToContinuous(ship, player._renderContinuous);
      return;
    }

    const dx = target.unwrappedX - player._renderContinuous.unwrappedX;
    const dy = target.unwrappedY - player._renderContinuous.unwrappedY;
    if (Math.hypot(dx, dy) > ONLINE_CFG.LOCAL_SNAP_DISTANCE) {
      player._renderContinuous = { ...target };
    } else {
      const alpha = 1 - Math.pow(ONLINE_CFG.LOCAL_RENDER_BASE, dt / 16);
      player._renderContinuous.unwrappedX += dx * alpha;
      player._renderContinuous.unwrappedY += dy * alpha;
      player._renderContinuous.angle = normalizeAngle(
        player._renderContinuous.angle + shortestAngleDelta(target.angle, player._renderContinuous.angle) * alpha
      );
    }

    this._snapShipToContinuous(ship, player._renderContinuous);
  }

  _handleOnlineUpdate(dt) {
    const mgr = this.socketMgr;
    if (!mgr) return;
    if (this._consumeOnlineSystemMessage()) return;

    if (mgr.gameRestarted) {
      mgr.gameRestarted = false;
      this._resetOnlineGame();
    }

    mgr.drainWorldQueue().forEach((world) => this._applyWorldSnapshot(world));

    const ownIdx = mgr.playerIdx;
    const ownPlayer = ownIdx !== null ? this.players[ownIdx] : null;
    if (ownPlayer) this._ensureLocalPrediction(ownPlayer);

    if (ownPlayer && mgr.connected && mgr.serverGameState === 'playing') {
      this._onlineInputAccumulator += dt;
      while (this._onlineInputAccumulator >= ONLINE_CFG.STEP_MS) {
        const input = {
          seq: ownPlayer._nextInputSeq + 1,
          ...this._getOnlineInputState(),
        };
        ownPlayer._nextInputSeq = input.seq;
        ownPlayer._pendingInputs.push(input);
        if (ownPlayer._pendingInputs.length > ONLINE_CFG.WORLD_QUEUE_MAX * 2) {
          ownPlayer._pendingInputs.shift();
        }
        if (ownPlayer._predictedShipState) {
          stepShipState(ownPlayer._predictedShipState, input, ONLINE_CFG.STEP_MS);
          ownPlayer._predictedContinuous = advanceContinuousState(
            ownPlayer._predictedContinuous,
            ownPlayer._predictedShipState.x,
            ownPlayer._predictedShipState.y,
            ownPlayer._predictedShipState.angle
          );
        }
        mgr.emitInput(input);
        this._onlineInputAccumulator -= ONLINE_CFG.STEP_MS;
      }
      this._updateLocalRender(ownPlayer, dt);
    } else {
      this._onlineInputAccumulator = 0;
    }

    this._updateRemoteRenders(performance.now(), ownIdx);

    if (mgr.pendingGameOver && this.state !== STATE.GAME_OVER) {
      const data = mgr.pendingGameOver;
      mgr.pendingGameOver = null;
      this.winner = (data.winner !== null && data.winner !== undefined)
        ? (this.players[data.winner] || null)
        : null;
      this.state = STATE.GAME_OVER;
      this._gameOverCooldown = 800;
      if (typeof window !== 'undefined' && typeof window.showRankingScreen === 'function') {
        window.showRankingScreen(this.players, this.winner, 'online', () => {
          this.cancelCurrentSession();
         if (this.mainMenu) this.mainMenu.reset(300); 
        });
      }
    }

    this.particles.forEach((particle) => particle.update(dt));
    this.particles = this.particles.filter((particle) => particle.alive);
    return;
    /*

    // ── 1. Client-side prediction for own player ─────────────────────────
    // Apply inputs immediately at 60 fps so the ship feels instant.
    // The server will reconcile via soft correction in _applyWorldSnapshot.
    if (mgr.gameRestarted) {
      mgr.gameRestarted = false;
      this._resetOnlineGame();
    }

    mgr.drainWorldQueue().forEach((world) => this._applyWorldSnapshot(world));

    const ownIdx = mgr.playerIdx;
    const ownPlayer = ownIdx !== null ? this.players[ownIdx] : null;
    if (ownPlayer) this._ensureLocalPrediction(ownPlayer);

    // ── 2. Interpolate remote players toward their authoritative targets ──
    // Frame-rate-independent lerp: alpha = 1 - 0.65^(dt/16)
    // At 60 fps each frame closes ~35 % of remaining gap → smooth without lag.
    if (ownPlayer && mgr.connected && mgr.serverGameState === 'playing') {
    this.players.forEach((p, i) => {
      if (i === ownIdx || !p || !p._remoteTarget) return;
      const ship   = p.currentShip;
      const target = p._remoteTarget;
      if (!ship || !target) return;

      const dx = target.x - ship.x;
      const dy = target.y - ship.y;
      ship.x = Math.abs(dx) > CFG.WIDTH / 2
        ? target.x
        : ship.x + dx * LERP;
      ship.y = Math.abs(dy) > CFG.HEIGHT / 2
        ? target.y
        : ship.y + dy * LERP;

      // Angle: shortest-path interpolation to handle 0°/360° wrap
      let da = target.angle - ship.angle;
      while (da >  180) da -= 360;
      while (da < -180) da += 360;
      ship.angle += da * LERP;
    });

    // ── 3. Send inputs to server ──────────────────────────────────────────
    if (ownIdx !== null && mgr.connected) {
      mgr.emitInput({
        forward:  this.input.isDown('ArrowUp'),
        backward: this.input.isDown('ArrowDown'),
        left:     this.input.isDown('ArrowLeft'),
        right:    this.input.isDown('ArrowRight'),
        shoot:    this.input.isDown('Space'),
      });
    }

    // ── 4. Apply latest server snapshot (with reconciliation) ─────────────
    if (mgr.pendingWorld) {
      this._applyWorldSnapshot(mgr.pendingWorld);
      mgr.pendingWorld = null;
    }

    // ── 5. Server-initiated game-over ─────────────────────────────────────
    if (mgr.pendingGameOver && this.state !== STATE.GAME_OVER) {
      const data = mgr.pendingGameOver;
      mgr.pendingGameOver = null;
      this.winner = (data.winner !== null && data.winner !== undefined)
        ? (this.players[data.winner] || null)
        : null;
      this.state = STATE.GAME_OVER;
      this._gameOverCooldown = 800;
      if (typeof window !== 'undefined' && typeof window.showRankingScreen === 'function') {
        window.showRankingScreen(this.players, this.winner, 'online', () => {
          this.state = STATE.PLAYING;
        });
      }
    }

    // ── 6. Server started a new game ──────────────────────────────────────
    if (mgr.gameRestarted) {
      mgr.gameRestarted = false;
      this._resetOnlineGame();
    }

    // ── 7. Client-side particles (purely visual) ──────────────────────────
    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => p.alive);
    */
  }

  /** Reset local view state between online rounds. */
  _resetOnlineGame() {
    this.winner = null;
    this.lasers = [];
    this.particles = [];
    this._onlineInputAccumulator = 0;
    this.meteors.forEach((meteor) => { meteor.alive = false; });
    this.players.forEach((player) => {
      player.fleetIndex = 0;
      player.alive = true;
      player.resetOnlineState();
      player.ships.forEach((ship) => {
        ship.alive = false;
        ship.vx = 0;
        ship.vy = 0;
        ship.angularVel = 0;
      });
    });
    if (this.state === STATE.GAME_OVER) this.state = STATE.PLAYING;
    return;

    this.winner      = null;
    this.lasers      = [];
    this.particles   = [];
    // fleetIndex / ship positions will be corrected by the next world snapshot
    this.players.forEach(p => { p.fleetIndex = 0; p.alive = true; });
    if (this.state === STATE.GAME_OVER) this.state = STATE.PLAYING;
  }

  /**
   * Apply a world snapshot sent by the server.
   * Sets positions, HP, fleet state, lasers, and meteor positions.
   * Spawns client-side particles for visual events in the snapshot.
   */
  _applyWorldSnapshot(world) {
    this.players.forEach((player, i) => {
      const ps = world.players[i];
      if (!player) return;
      if (!ps) {
        this._clearOnlinePlayerState(player);
        return;
      }

      player.fleetIndex = ps.fleetIndex;
      player.alive = ps.alive;
      player.displayName = ps.displayName;
      if (ps.stats) player.stats = ps.stats;

      const ship = player.currentShip;
      if (!ship || !ps.ship) {
        player.resetOnlineState();
        if (ship) ship.alive = false;
        player._onlineMeta = {
          fleetIndex: ps.fleetIndex,
          alive: ps.alive,
          spawnSeq: 0,
        };
        return;
      }

      if (this.socketMgr && i === this.socketMgr.playerIdx) {
        this._applyOwnSnapshot(player, ps);
      } else {
        this._applyRemoteSnapshot(player, ps, world);
      }
    });

    this.lasers = world.lasers.map((laser) =>
      new Laser(laser.x, laser.y, laser.angle, laser.ownerIdx, this.assets)
    );

    world.meteors.forEach((meteorState, i) => {
      const meteor = this.meteors[i];
      if (!meteor) return;
      meteor.x = meteorState.x;
      meteor.y = meteorState.y;
      meteor.rot = meteorState.rot;
      meteor.alive = meteorState.alive;
      meteor.spriteKey = meteorState.spriteKey;
      meteor.radius = meteorState.radius;
    });

    (world.events || []).forEach((event) => {
      if (event.type === 'spark') this._spawnSparks(event.x, event.y, event.color);
      if (event.type === 'explosion') this._spawnExplosion(event.x, event.y);
    });
    return;

    world.players.forEach((ps, i) => {
      if (!ps) return;
      const player = this.players[i];
      if (!player) return;

      player.fleetIndex  = ps.fleetIndex;
      player.alive       = ps.alive;
      player.displayName = ps.displayName;
      if (ps.stats) player.stats = ps.stats;

      const ownPlayer = this.socketMgr && i === this.socketMgr.playerIdx;
      const ship = player.currentShip;

      if (ship && ps.ship) {
        if (ownPlayer) {
          // Own player: soft reconciliation — preserve local prediction, nudge toward server truth.
          // Hard-sync authoritative state (HP, energy, alive) immediately.
          if (!ps.ship.alive) {
            ship.alive = false;
            ship.hp    = 0;
          } else {
            const CORRECTION = 0.2;
            ship.x      += (ps.ship.x     - ship.x)     * CORRECTION;
            ship.y      += (ps.ship.y     - ship.y)     * CORRECTION;
            ship.vx     += (ps.ship.vx    - ship.vx)    * CORRECTION;
            ship.vy     += (ps.ship.vy    - ship.vy)    * CORRECTION;
            ship.hp      = ps.ship.hp;
            ship.energy  = ps.ship.energy;
            ship.alive   = ps.ship.alive;
          }
        } else {
          // Remote players: store authoritative target, lerp toward it each frame.
          player._remoteTarget = ps.ship;
          // Hard-sync HP/alive immediately so health bars and death are responsive.
          ship.hp    = ps.ship.hp;
          ship.alive = ps.ship.alive;
        }
        if (ps.ship.isInvulnerable) ship.invulnUntil = performance.now() + 200;
      }
    });

    // Server-authoritative lasers (replace client list entirely)
    this.lasers = world.lasers.map(l =>
      new Laser(l.x, l.y, l.angle, l.ownerIdx, this.assets)
    );

    // Sync meteor positions/state
    world.meteors.forEach((ms, i) => {
      const m = this.meteors[i];
      if (!m) return;
      m.x        = ms.x;
      m.y        = ms.y;
      m.rot      = ms.rot;
      m.alive    = ms.alive;
      m.spriteKey = ms.spriteKey;
      m.radius   = ms.radius;
    });

    (world.events || []).forEach(ev => {
      if (ev.type === 'spark')     this._spawnSparks(ev.x, ev.y, ev.color);
      if (ev.type === 'explosion') this._spawnExplosion(ev.x, ev.y);
    });
  }

  /** Overlay drawn on top of the game canvas while waiting for the server. */
  _drawOnlineOverlay() {
    const mgr = this.socketMgr;
    if (!mgr) {
      if (this.selectedMode === 'online' && this._onlineJoinPendingMessage) {
        return this._drawWaitMessage(this._onlineJoinPendingMessage);
      }
      return;
    }
    if (!mgr.connected)                        return this._drawWaitMessage('Connecting to server…');
    if (mgr.serverGameState === 'countdown' && mgr.countdown !== null)
                                               return this._drawWaitMessage(`Game starts in  ${mgr.countdown}s`);
    if (mgr.serverGameState === 'lobby') {
       const hCount = mgr.humanCount ?? 1; // can be enhanced by server later
       return this._drawWaitMessage(`Waiting for players… (${hCount}/2 needed)`);
    }
    if (mgr.serverGameState === 'playing') {
      this._drawOnlineNotice();
    }
  }

  _drawWaitMessage(msg) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 34px monospace';
    ctx.fillText(msg, CFG.WIDTH / 2, CFG.HEIGHT / 2);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  _showOnlineNotice(msg, durationMs = 2200) {
    this._onlineNoticeText = msg;
    this._onlineNoticeUntil = performance.now() + durationMs;
  }

  _drawOnlineNotice() {
    if (!this._onlineNoticeText) return;
    if (performance.now() > this._onlineNoticeUntil) {
      this._onlineNoticeText = '';
      this._onlineNoticeUntil = 0;
      return;
    }

    const ctx = this.ctx;
    const text = this._onlineNoticeText;
    ctx.save();
    ctx.font = 'bold 22px monospace';
    const textWidth = ctx.measureText(text).width;
    const width = textWidth + 48;
    const height = 42;
    const x = (CFG.WIDTH - width) / 2;
    const y = 28;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, CFG.WIDTH / 2, y + 28);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  _spawnSparks(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = rand(0, 360);
      const s = rand(1, 4);
      this.particles.push(new Particle(
        x, y,
        Math.cos(degToRad(a)) * s,
        Math.sin(degToRad(a)) * s,
        rand(200, 500),
        color,
        rand(2, 5)
      ));
    }
  }

  _spawnExplosion(x, y) {
    for (let i = 0; i < 30; i++) {
      const a = rand(0, 360);
      const s = rand(1, 6);
      const colors = ['#ff4400', '#ffaa00', '#ffcc44', '#fff', '#ff6622'];
      this.particles.push(new Particle(
        x, y,
        Math.cos(degToRad(a)) * s,
        Math.sin(degToRad(a)) * s,
        rand(300, 900),
        colors[randInt(0, colors.length - 1)],
        rand(3, 10)
      ));
    }
  }

  /* ═══════════════════  DRAW  ══════════════════════════════════ */
  _drawBackground() {
    const ctx = this.ctx;
    if (this.bgImage) {
      // tile the background
      const bw = this.bgImage.width;
      const bh = this.bgImage.height;
      for (let x = 0; x < CFG.WIDTH; x += bw) {
        for (let y = 0; y < CFG.HEIGHT; y += bh) {
          ctx.drawImage(this.bgImage, x, y);
        }
      }
    } else {
      ctx.fillStyle = CFG.BG_COLOR;
      ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
    }
  }

  _drawMeteors() {
    this.meteors.forEach(m => m.draw(this.ctx));
  }

  _draw() {
    const ctx = this.ctx;
    if (this.socketMgr && this._consumeOnlineSystemMessage()) {
      return;
    }

    // In online mode, show a waiting overlay until the server game is running
    if ((this.selectedMode === 'online' && !this.socketMgr) ||
        (this.socketMgr && this.socketMgr.serverGameState !== 'playing')) {
      this._drawBackground();
      this._drawOnlineOverlay();
      return;
    }

    this._drawBackground();

    // meteors
    this._drawMeteors();

    // lasers
    this.lasers.forEach(l => l.draw(ctx));

    // ships
    this.players.forEach(p => p.draw(ctx));

    // particles
    this.particles.forEach(p => p.draw(ctx));

    // HUD
    if (this.hud && (!this.socketMgr || this.socketMgr.hasReceivedWorld)) {
      this.hud.draw(ctx);
    }

    // Countdown / connecting overlay (drawn over the live game if needed)
    if (this.socketMgr) this._drawOnlineOverlay();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   BOOTSTRAP – auto-start if a <canvas id="gameCanvas"> exists,
   otherwise export for manual usage.
   ═══════════════════════════════════════════════════════════════════════ */
function startGame(canvas) {
  const game = new Game(canvas);
  game.init().then(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const autoMode = params.get('mode');
      if (autoMode === 'online' && window.REMOTE_MULTIPLAYER_ENABLED !== false) {
        game.selectedMode = 'online';
        game._setupPlayers('online');
        game.state = 'playing';
      }
    }
  });
  return game;
}

// Auto-start when DOM is ready
if (typeof document !== 'undefined') {
  const _boot = () => {
    let canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'gameCanvas';
      document.body.appendChild(canvas);
    }
    window.__spaceFleetGame = startGame(canvas);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }
}

// Expose for external integration (e.g. Next.js page, remote multiplayer)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Game, startGame, CFG, STATE };
} else if (typeof window !== 'undefined') {
  window.SpaceFleetBattle = { Game, startGame, CFG, STATE };
}
