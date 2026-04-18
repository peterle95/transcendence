(function (global) {
  const EMIT_INTERVAL_MS = 33;
  const MAX_SLOTS = 4;

  function normalizeAISlots(slots = []) {
    if (!Array.isArray(slots)) return [];
    return slots
      .map((slot) => Number(slot))
      .filter((slot) => Number.isInteger(slot) && slot >= 0 && slot < MAX_SLOTS);
  }

  function isRemoteAIPlayer(player) {
    return Boolean(player && player.type === 'remote' && player.isAI);
  }

  class LocalDQNBridge {
    constructor(options = {}) {
      this.roomId = options.roomId || global.GAME_ROOM_ID || 'gameplay-room';
      this.onCommand = typeof options.onCommand === 'function' ? options.onCommand : () => {};
      this.onAvailabilityChange = typeof options.onAvailabilityChange === 'function'
        ? options.onAvailabilityChange
        : () => {};
      this.socket = null;
      this.clientId = null;
      this.availableSlots = new Set();
      this.lastEmitMs = 0;
    }

    connect() {
      if (this.socket || typeof global.io === 'undefined') return;
      if (!this.clientId) this.clientId = this._createClientId();

      const socketPort = global.GAME_SOCKET_PORT || 4000;
      const socketUrl = global.location
        ? global.location.origin
        : `http://localhost:${socketPort}`;

      const options = {
        transports: ['websocket'],
        auth: {
          bridge_role: 'local_ai_client',
          room_id: this.roomId,
          bridge_client_id: this.clientId,
        },
      };

      if (global.location) {
        // Use runtime socket path from config, fallback to default
        options.path = global.GAME_SOCKET_PATH || '/game/socket.io/';
      }

      this.socket = global.io(socketUrl, options);
      this.socket.on('connect', () => {
        console.log('[LocalDQNBridge] connected to', socketUrl, '| room=', this.roomId, '| client=', this.clientId);
      });
      this.socket.on('disconnect', () => {
        console.log('[LocalDQNBridge] disconnected');
        this._setAvailableSlots([]);
      });
      this.socket.on('ai_bridge_ready', (payload = {}) => {
        if (payload.roomId !== this.roomId) return;
        if (typeof payload.bridgeClientId === 'string' && payload.bridgeClientId) {
          this.clientId = payload.bridgeClientId;
        }
        this._setAvailableSlots(payload.availableSlots);
        console.log('[LocalDQNBridge] ready | available slots:', [...this.availableSlots].join(',') || 'none');
      });
      this.socket.on('ai_service_status', (payload = {}) => {
        if (payload.roomId !== this.roomId) return;
        this._setAvailableSlots(payload.availableSlots);
        console.log('[LocalDQNBridge] AI service status | available slots:', [...this.availableSlots].join(',') || 'none');
      });
      this.socket.on('ai_command', (payload = {}) => {
        if (payload.roomId !== this.roomId) return;
        if (payload.bridgeClientId && payload.bridgeClientId !== this.clientId) return;
        this.onCommand(payload);
      });
    }

    disconnect() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      this.clientId = null;
      this.lastEmitMs = 0;
      this._setAvailableSlots([]);
    }

    hasAvailableSlot(slot) {
      return this.availableSlots.has(slot);
    }

    maybeEmitGameState(players, lasers, meteors, dt, nowMs = global.performance ? global.performance.now() : Date.now()) {
      if (!this.socket || !this.socket.connected || !this.roomId) return;
      if (nowMs - this.lastEmitMs < EMIT_INTERVAL_MS) return;

      let emitted = false;

      players.forEach((player) => {
        if (!isRemoteAIPlayer(player) || !player.alive) return;
        const ship = player.currentShip;
        if (!ship || !ship.alive) return;

        emitted = true;
        this.socket.emit('ai_game_state', {
          roomId: this.roomId,
          slot: player.idx,
          bridgeClientId: this.clientId,
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
          enemies: players
            .filter((other) => other !== player && other.alive)
            .map((other) => {
              const otherShip = other.currentShip;
              return otherShip ? {
                x: otherShip.x,
                y: otherShip.y,
                angle: otherShip.angle,
                hp: otherShip.hp,
                alive: otherShip.alive,
              } : null;
            })
            .filter(Boolean),
          lasers: lasers.map((laser) => ({
            x: laser.x,
            y: laser.y,
            is_enemy: laser.ownerIdx !== player.idx,
          })),
          meteors: meteors
            .filter((meteor) => meteor.alive)
            .map((meteor) => ({
              x: meteor.x,
              y: meteor.y,
              radius: meteor.radius,
              alive: meteor.alive,
            })),
        });
      });

      if (emitted) {
        this.lastEmitMs = nowMs;
      }
    }

    _createClientId() {
      return `local-ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    _setAvailableSlots(slots = []) {
      this.availableSlots = new Set(normalizeAISlots(slots));
      this.onAvailabilityChange(this.availableSlots);
    }
  }

  global.LocalDQNBridge = LocalDQNBridge;
})(typeof window !== 'undefined' ? window : globalThis);
