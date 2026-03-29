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
    this._onDown = (e) => {
      this.keys[e.code] = true;
      // prevent scroll on arrow keys / space / tab
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onUp = (e) => { this.keys[e.code] = false; };
  }

  attach() {
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup',   this._onUp);
  }

  detach() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup',   this._onUp);
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
  const rad = degToRad(this.angle);
  const thrust = CFG.SHIP_SPEED * dt / 16;
  this.vx += Math.sin(rad) * thrust;
  this.vy -= Math.cos(rad) * thrust;
}

thrustBackward(dt) {
  const rad = degToRad(this.angle);
  const thrust = CFG.SHIP_SPEED * dt / 16;
  this.vx -= Math.sin(rad) * thrust;
  this.vy += Math.cos(rad) * thrust;
}


rotateLeft(dt) {
  this.angularVel -= 0.4 * dt / 16;
}

rotateRight(dt) {
  this.angularVel += 0.4 * dt / 16;
}

  rechargeWeapon(now) {
    if (this.energy < CFG.WEAPON_MAX_ENERGY &&
        now - this.lastRechargeTime >= CFG.WEAPON_RECHARGE_MS) {
      this.energy = Math.min(this.energy + CFG.WEAPON_RECHARGE, CFG.WEAPON_MAX_ENERGY);
      this.lastRechargeTime = now;
    }
  }

  canShoot() {
    return this.energy >= CFG.WEAPON_SHOT_COST;
  }

  consumeShot() {
    this.energy -= CFG.WEAPON_SHOT_COST;
  }

update(dt) {
	// Rotational Inertia
  const MAX_ANGULAR = CFG.SHIP_ROT_SPEED * 0.8;
  this.angularVel = clamp(this.angularVel, -MAX_ANGULAR, MAX_ANGULAR);
  this.angle += this.angularVel * dt / 16;
  this.angularVel *= 0.95; // rotational friction
  
  // Apply speed to position
  this.x += this.vx * dt / 16;
  this.y += this.vy * dt / 16;

  // Deceleration (light space drag)
  const DRAG = 0.98; // 1.0 = no friction, 0.95 = fast break
  this.vx *= DRAG;
  this.vy *= DRAG;

  // Clamp max speed
  const MAX_SPEED = CFG.SHIP_SPEED * 2;
  const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
  if (speed > MAX_SPEED) {
    this.vx = (this.vx / speed) * MAX_SPEED;
    this.vy = (this.vy / speed) * MAX_SPEED;
  }

  // Wrap at edges (margin = radius ship icon)
  wrapPos(this, CFG.WIDTH, CFG.HEIGHT, this.radius);

  // Recharge weapon
  this.rechargeWeapon(performance.now());
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
   * @param {string}   type       'local' | 'ai' | 'remote'
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
    } else if (this.type === 'ai') {
      return this._aiControl(dt, ship);
    }

    return null;
  }

  /** Set by the network layer consumed in handleInput for 'remote' players */

  _networkState = null;

  applyNetworkState(state) {
    this._networkState = state;
  }

  /* ── simple AI ──────────────────────────────────────────────────── */
  _aiTarget  = null;
  _aiTimer   = 0;

  _aiControl(dt, ship) {
    this._aiTimer -= dt;

    // pick a target every 2s or if current target dead
    if (this._aiTimer <= 0 || !this._aiTarget || !this._aiTarget.alive) {
      this._aiTimer = 2000;
      this._aiTarget = null;
    }

    if (!this._aiTarget) {
      // find a target – provided externally via game loop
      return null; // game loop will set _aiTarget
    }

    const target = this._aiTarget;
    const dx = target.x - ship.x;
    const dy = target.y - ship.y;
    const desiredAngle = radToDeg(Math.atan2(dx, -dy));
    let diff = desiredAngle - ship.angle;
    // normalise to -180..180
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    if (diff > 3)       ship.rotateRight(dt);
    else if (diff < -3) ship.rotateLeft(dt);

    const distance = dist(ship, target);
    if (distance > 250)      ship.thrustForward(dt);
    else if (distance < 120) ship.thrustBackward(dt);

    // shoot when roughly aimed
    this.shootCooldown -= dt;
    if (Math.abs(diff) < 12 && this.shootCooldown <= 0 && ship.canShoot()) {
      ship.consumeShot();
      this.stats.shotsFired++;
      this.shootCooldown = 250;
      return this._createLaser(ship);
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

    this._rafId         = null;
    this._destroyed     = false;
    this.playerUserIds  = [];
    this.gameStartTime  = null;
    this.networkSocket  = null;
    this.networkRoomId  = null;
    this.mySlot         = 0;
    this.totalPlayers   = 2;
    this._lastInputSend = 0;
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
    if (this._destroyed) return;
    this.bgImage = this.assets.get('bg');
    this._loop(performance.now());
  }

  destroy() {
    this._destroyed = true;
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
  }

  cancelCurrentSession() {
    this.players = [];
    this.lasers = [];
    this.meteors = [];
    this.particles = [];
    this.hud = null;
    this.winner = null;
    this.selectedMode = null;
    this._isPausedByMenu = false;
    this.state = STATE.MENU;
    if (this.mainMenu) {
      this.mainMenu.reset(300);
    }
  }

  /* ─── game modes ─────────────────────────────────────────────── */
  _setupPlayers(mode) {
    this.players = [];
    this.lasers  = [];
    this.meteors = [];
    this.particles = [];
    this.winner  = null;

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

    if (mode === 'solo') {
      this.players.push(new Player(0, 'local', p1Controls, this.assets));
      this.players.push(new Player(1, 'ai',    {},          this.assets));
    } else if (mode === 'local2') {
      this.players.push(new Player(0, 'local', p1Controls, this.assets));
      this.players.push(new Player(1, 'local', p2Controls, this.assets));
    } else if (mode === 'local3') {
      this.players.push(new Player(0, 'local', p1Controls, this.assets));
      this.players.push(new Player(1, 'local', p2Controls, this.assets));
      this.players.push(new Player(2, 'ai',    {},          this.assets));
    } else if (mode === 'local4') {
      this.players.push(new Player(0, 'local', p1Controls, this.assets));
      this.players.push(new Player(1, 'local', p2Controls, this.assets));
      this.players.push(new Player(2, 'ai',    {},          this.assets));
      this.players.push(new Player(3, 'ai',    {},          this.assets));
    }else if (mode === 'online') {
      const total = Math.max(2, Math.min(4, this.totalPlayers || 2));
      for(let i = 0; i < total; i++) {
        if (i == this.mySlot)
          this.players.push(new Player(i, 'local', p1Controls, this.assets));
        else
          this.players.push(new Player(i, 'remote', {}, this.assets));
      }
	} else if (mode === 'vs_ai_ml') {
		this.players.push(new Player(0, 'local',  p1Controls, this.assets));
		const aiPlayer = new Player(1, 'remote', {}, this.assets);
		aiPlayer.isAI = true;
		this.players.push(aiPlayer);
	}

    // Assign display names and user IDs
    const currentUser = typeof window !== 'undefined' ? window.currentUser : null;
    this.players.forEach(p => {
      if (p.type === 'ai' || (p.type === 'remote' && p.isAI)) {
        p.displayName = 'AI';
        p.userId = null;
      } else if (p.idx === 0 && currentUser) {
        p.displayName = currentUser.username;
        p.userId = currentUser.id;
      } else {
        p.displayName = CFG.PLAYER_NAMES[p.idx].toUpperCase();
        p.userId = null;
      }
    });


    // spawn first ships
    this.players.forEach(p => p.spawnCurrent());
    this.gameStartTime = performance.now();

    // create meteors
    for (let i = 0; i < CFG.METEOR_COUNT; i++) {
      this.meteors.push(new Meteor(this.assets));
    }

    this.hud = new HUD(this.players);
  }

  /* ─── main loop ──────────────────────────────────────────────── */
  _loop = (timestamp) => {
    if (this._destroyed) return;
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
      case STATE.GAME_OVER: this._drawGameOver();   break;
	  case STATE.GAME_OVER: this._drawRanking();   break;
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
    const now = performance.now();
    if (this.networkSocket && this.networkRoomId && now - this._lastInputSend > 33) {
      this._lastInputSend = now;
      const local = this.players.find(p => p.type === 'local');
      if (local) {
        const ship = local.currentShip;
        if (ship && ship.alive) {
          this.networkSocket.emit('game_state', {
            roomId:     this.networkRoomId,
            slot:       this.mySlot,
            x:          ship.x,
            y:          ship.y,
            angle:      ship.angle,
            fleetIndex: local.fleetIndex,
            alive:      local.alive,
            shoot:      this.input.isDown('Space'),
          });
        }
      }
    }
    // ── AI target assignment ──
    this.players.forEach(p => {
      if (p.type === 'ai' && p.alive) {
        const ship = p.currentShip;
        if (!ship || !ship.alive) return;
        // pick closest enemy ship
        let bestDist = Infinity;
        let bestTarget = null;
        this.players.forEach(other => {
          if (other === p || !other.alive) return;
          const os = other.currentShip;
          if (!os || !os.alive) return;
          const d = dist(ship, os);
          if (d < bestDist) { bestDist = d; bestTarget = os; }
        });
        p._aiTarget = bestTarget;
      }
    });

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
    if (this.networkSocket && this.networkRoomId && now - this._lastInputSend > 33) {
      this.players.forEach(p => {
        if (!(p.type === 'remote' && p.isAI) || !p.alive) return;
        const ship = p.currentShip;
        if (!ship || !ship.alive) return;

        this.networkSocket.emit('ai_game_state', {
          roomId: this.networkRoomId,
          slot: p.idx,
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

      // Fire spaceFleetGameOver for the HTML lobby stats overlay
      const sorted = [...this.players].sort((a, b) => {
        if (a === this.winner) return -1;
        if (b === this.winner) return 1;
        if (b.stats.shipsDestroyed !== a.stats.shipsDestroyed)
          return b.stats.shipsDestroyed - a.stats.shipsDestroyed;
        return a.stats.shipsLost - b.stats.shipsLost;
      });
      const placements = new Map(sorted.map((p, i) => [p.idx, i + 1]));
      const duration = this.gameStartTime
        ? Math.round(performance.now() - this.gameStartTime)
        : 0;
      this.canvas.dispatchEvent(new CustomEvent('spaceFleetGameOver', {
        bubbles: true,
        detail: {
          mode:       this.selectedMode,
          duration,
          winnerSlot: this.winner ? this.winner.idx : null,
          players: this.players.map(p => ({
            slot:           p.idx,
            userId:         this.playerUserIds[p.idx] ?? null,
            shotsFired:     p.stats.shotsFired,
            shotsHit:       p.stats.shotsHit,
            shipsLost:      p.stats.shipsLost,
            shipsDestroyed: p.stats.shipsDestroyed,
            isWinner:       this.winner === p,
            placement:      placements.get(p.idx) ?? this.players.length,
          })),
        },
      }));

      // Show ranking overlay if available (standalone usage with gameOver_stats.js)
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
    if (this.hud) this.hud.draw(ctx);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   BOOTSTRAP – auto-start if a <canvas id="gameCanvas"> exists,
   otherwise export for manual usage.
   ═══════════════════════════════════════════════════════════════════════ */
function startGame(canvas) {
  const game = new Game(canvas);
  game.init();
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
