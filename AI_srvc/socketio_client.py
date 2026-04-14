"""
server/socketio_client.py — Client Socket.io per ai_srvc
=========================================================

Si connette al Socket.io server di game_srvc (porta 4000).
Per ogni evento 'ai_game_state' ricevuto, calcola il comando
DQN e lo rimanda come 'ai_command'.

Autenticazione: usa SERVICE_SECRET invece del token JWT utente.
"""

import asyncio
import logging
import math
import os
import time
from dataclasses import dataclass
from typing import Optional

import torch
import socketio

from model import (
    DQNNetwork,
    load_model,
    STATE_SIZE,
    N_LASERS, N_METEORS, N_ENEMIES,
    FEATURES_MY_SHIP, FEATURES_ENEMY,
    FEATURES_LASER, FEATURES_METEOR,
)

log = logging.getLogger("socketio_client")

GAME_SVC_URL    = os.getenv("GAME_SVC_URL",    "http://game_srvc:4000")
SERVICE_SECRET  = os.getenv("SERVICE_SECRET",  "inter-service-shared-secret-change-in-production")
MODEL_PATH      = os.getenv("MODEL_PATH",      "/app/models/dqn_latest.pt")
AI_SLOT         = int(os.getenv("AI_SLOT",     "1"))
ROOM_ID         = os.getenv("ROOM_ID",         "local")
SOCKET_PATH     = os.getenv("SOCKET_PATH",     "/socket.io")
MODEL_AUTO_RELOAD = os.getenv("MODEL_AUTO_RELOAD", "true").lower() == "true"
MODEL_RELOAD_INTERVAL_S = float(os.getenv("MODEL_RELOAD_INTERVAL_S", "5"))
BOT_MODE = os.getenv("BOT_MODE", "model").lower()

CANVAS_W  = 1280
CANVAS_H  = 720
DIAGONAL  = math.sqrt(CANVAS_W**2 + CANVAS_H**2)
SHIP_SPEED = 2.5
SHIP_ROT_SPEED = 4.0
MAX_SPEED  = SHIP_SPEED * 2.0
MAX_ENERGY = 40
MAX_HP     = 20
MAX_RADIUS = 50
WEAPON_SHOT_COST = 2
WEAPON_RECHARGE = 1
WEAPON_RECHARGE_MS = 500


# ─── Local ship simulation (JS Ship port) ───────────────────────────────────

def _wrap_pos(x: float, y: float, w: float, h: float, margin: float) -> tuple[float, float]:
    if x < -margin:
        x = w + margin
    elif x > w + margin:
        x = -margin

    if y < -margin:
        y = h + margin
    elif y > h + margin:
        y = -margin

    return x, y


def _angle_diff_deg(a: float, b: float) -> float:
    diff = (a - b) % 360.0
    if diff > 180.0:
        diff -= 360.0
    return diff


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _extract_dt_ms(data: dict, now_ms: float, last_tick_ms: Optional[float]) -> float:
    for key in ("dt_ms", "delta_ms", "dt", "delta"):
        raw = data.get(key)
        if isinstance(raw, (int, float)) and raw > 0:
            # If a server ever sends seconds, convert to ms.
            return raw * 1000.0 if raw < 10.0 else float(raw)

    if last_tick_ms is None:
        return 1000.0 / 30.0

    # Keep tick time stable even with temporary network jitter spikes.
    return _clamp(now_ms - last_tick_ms, 8.0, 100.0)


@dataclass
class ShipState:
    x: float = 0.0
    y: float = 0.0
    angle: float = 0.0
    vx: float = 0.0
    vy: float = 0.0
    angular_vel: float = 0.0
    radius: float = 40.0
    energy: float = float(MAX_ENERGY)
    hp: float = float(MAX_HP)
    alive: bool = True
    initialized: bool = False
    last_recharge_ms: float = 0.0

    def sync_from_server(self, my_ship: dict, now_ms: float) -> None:
        if not my_ship:
            return

        prev_alive = self.alive
        prev_hp = self.hp
        server_alive = bool(my_ship.get("alive", True))
        server_hp = float(my_ship.get("hp", self.hp))
        server_energy = float(my_ship.get("energy", self.energy))

        self.hp = server_hp
        self.alive = server_alive and server_hp > 0
        self.energy = _clamp(server_energy, 0.0, float(MAX_ENERGY))
        self.radius = float(my_ship.get("radius", self.radius))

        server_x = float(my_ship.get("x", self.x))
        server_y = float(my_ship.get("y", self.y))
        server_angle = float(my_ship.get("angle", self.angle))

        # First snapshot, respawn, or death: hard-sync full kinematics.
        if (
            not self.initialized
            or not self.alive
            or (not prev_alive and self.alive)
            or (prev_hp < MAX_HP and server_hp >= MAX_HP)
        ):
            self.x = server_x
            self.y = server_y
            self.angle = server_angle
            self.vx = float(my_ship.get("vx", 0.0))
            self.vy = float(my_ship.get("vy", 0.0))
            self.angular_vel = 0.0
            self.last_recharge_ms = now_ms
            self.initialized = True
            return

        # Keep a local predicted state, but gently correct drift.
        self.x += (server_x - self.x) * 0.15
        self.y += (server_y - self.y) * 0.15
        self.angle += _angle_diff_deg(server_angle, self.angle) * 0.2

        self.initialized = True

    def thrust_forward(self, dt_ms: float) -> None:
        rad = math.radians(self.angle)
        thrust = SHIP_SPEED * dt_ms / 16.0
        self.vx += math.sin(rad) * thrust
        self.vy -= math.cos(rad) * thrust

    def thrust_backward(self, dt_ms: float) -> None:
        rad = math.radians(self.angle)
        thrust = SHIP_SPEED * dt_ms / 16.0
        self.vx -= math.sin(rad) * thrust
        self.vy += math.cos(rad) * thrust

    def rotate_left(self, dt_ms: float) -> None:
        self.angular_vel -= 0.4 * dt_ms / 16.0

    def rotate_right(self, dt_ms: float) -> None:
        self.angular_vel += 0.4 * dt_ms / 16.0

    def can_shoot(self) -> bool:
        return self.energy >= WEAPON_SHOT_COST

    def consume_shot(self) -> None:
        self.energy = max(0.0, self.energy - WEAPON_SHOT_COST)

    def recharge_weapon(self, now_ms: float) -> None:
        if self.energy < MAX_ENERGY and now_ms - self.last_recharge_ms >= WEAPON_RECHARGE_MS:
            self.energy = min(float(MAX_ENERGY), self.energy + WEAPON_RECHARGE)
            self.last_recharge_ms = now_ms

    def apply_command(self, command: dict, dt_ms: float) -> None:
        movimento = int(command.get("movimento", 0) or 0)
        rotazione = int(command.get("rotazione", 0) or 0)
        sparo = int(command.get("sparo", 0) or 0)

        if movimento == 1:
            self.thrust_forward(dt_ms)
        elif movimento == 2:
            self.thrust_backward(dt_ms)

        if rotazione == 1:
            self.rotate_left(dt_ms)
        elif rotazione == 2:
            self.rotate_right(dt_ms)

        if sparo == 1 and self.can_shoot():
            self.consume_shot()

    def tick(self, dt_ms: float, now_ms: float) -> None:
        if not self.alive:
            return

        max_angular = SHIP_ROT_SPEED * 0.8
        self.angular_vel = _clamp(self.angular_vel, -max_angular, max_angular)
        self.angle += self.angular_vel * dt_ms / 16.0
        self.angular_vel *= 0.95

        self.x += self.vx * dt_ms / 16.0
        self.y += self.vy * dt_ms / 16.0

        self.vx *= 0.98
        self.vy *= 0.98

        speed = math.sqrt(self.vx * self.vx + self.vy * self.vy)
        if speed > MAX_SPEED:
            self.vx = (self.vx / speed) * MAX_SPEED
            self.vy = (self.vy / speed) * MAX_SPEED

        self.x, self.y = _wrap_pos(self.x, self.y, CANVAS_W, CANVAS_H, self.radius)
        self.recharge_weapon(now_ms)

    def as_dict(self) -> dict:
        return {
            "x": self.x,
            "y": self.y,
            "angle": self.angle,
            "vx": self.vx,
            "vy": self.vy,
            "energy": self.energy,
            "hp": self.hp,
            "alive": self.alive,
            "radius": self.radius,
        }


# ─── State builder ────────────────────────────────────────────────────────────

def extract_damage_metrics(data: dict, my_slot: int) -> dict:
    """
    Extract damage metrics from payload damage_events for reward calculation.
    
    Returns {
        'player_inflicted_damage': sum of damage caused by player's laser hits,
        'total_damage_received': sum of all damage received (any source),
        'player_laser_hits': count of successful laser hits by player,
        'meteor_damage_received': sum of damage from meteors,
        'collision_damage_received': sum of damage from ship collisions,
    }
    """
    damage_events = data.get("damage_events", []) or []
    
    player_inflicted = 0.0
    total_received = 0.0
    laser_hits = 0
    meteor_dmg = 0.0
    collision_dmg = 0.0
    
    for event in damage_events:
        amount = float(event.get("amount", 0))
        target_slot = event.get("target_slot", -1)
        source_slot = event.get("source_slot", -1)
        damage_source = event.get("damage_source", "unknown")
        
        # Count damage player inflicted (player_laser only)
        if damage_source == "player_laser" and source_slot == my_slot:
            player_inflicted += amount
            laser_hits += 1
        
        # Count damage player received
        if target_slot == my_slot:
            total_received += amount
            if damage_source == "meteor":
                meteor_dmg += amount
            elif damage_source == "ship_collision":
                collision_dmg += amount
    
    return {
        "player_inflicted_damage": player_inflicted,
        "total_damage_received": total_received,
        "player_laser_hits": laser_hits,
        "meteor_damage_received": meteor_dmg,
        "collision_damage_received": collision_dmg,
    }


def build_state_vector(data: dict, my_ship_override: Optional[dict] = None) -> torch.Tensor:
    """Converte il payload Socket.io in un tensore da STATE_SIZE float."""
    features = []
    my = my_ship_override or data.get("my_ship") or {}

    x     = my.get("x", 0)
    y     = my.get("y", 0)
    angle = math.radians(my.get("angle", 0))

    features += [
        x / CANVAS_W,
        y / CANVAS_H,
        math.sin(angle),
        math.cos(angle),
        my.get("vx", 0) / MAX_SPEED,
        my.get("vy", 0) / MAX_SPEED,
        my.get("energy", 0) / MAX_ENERGY,
        my.get("hp", MAX_HP) / MAX_HP,
    ]

    def dist_sq(obj):
        dx = obj.get("x", 0) - x
        dy = obj.get("y", 0) - y
        return dx*dx + dy*dy

    enemies = sorted(
        [e for e in data.get("enemies", []) if e.get("alive", True)],
        key=dist_sq
    )[:N_ENEMIES]

    for e in enemies:
        dx = e.get("x", 0) - x
        dy = e.get("y", 0) - y
        ea = math.radians(e.get("angle", 0))
        features += [
            dx / CANVAS_W,
            dy / CANVAS_H,
            math.sqrt(dx*dx + dy*dy) / DIAGONAL,
            math.sin(ea),
            math.cos(ea),
            e.get("hp", MAX_HP) / MAX_HP,
        ]
    features += [0.0] * (FEATURES_ENEMY * (N_ENEMIES - len(enemies)))

    lasers = sorted(data.get("lasers", []), key=dist_sq)[:N_LASERS]
    for l in lasers:
        features += [
            (l.get("x", 0) - x) / CANVAS_W,
            (l.get("y", 0) - y) / CANVAS_H,
            1.0 if l.get("is_enemy", False) else 0.0,
        ]
    features += [0.0] * (FEATURES_LASER * (N_LASERS - len(lasers)))

    meteors = sorted(
        [m for m in data.get("meteors", []) if m.get("alive", True)],
        key=dist_sq
    )[:N_METEORS]
    for m in meteors:
        features += [
            (m.get("x", 0) - x) / CANVAS_W,
            (m.get("y", 0) - y) / CANVAS_H,
            m.get("radius", 0) / MAX_RADIUS,
        ]
    features += [0.0] * (FEATURES_METEOR * (N_METEORS - len(meteors)))

    assert len(features) == STATE_SIZE, \
        f"state size mismatch: atteso {STATE_SIZE}, ottenuto {len(features)}"

    return torch.tensor(features, dtype=torch.float32)


def _angle_to_target_deg(src_x: float, src_y: float, dst_x: float, dst_y: float) -> float:
    dx = dst_x - src_x
    dy = dst_y - src_y
    return math.degrees(math.atan2(dx, -dy))


def _choose_scripted_action(data: dict, ship_state: ShipState) -> dict:
    my_ship = data.get("my_ship") or {}
    enemies = [e for e in data.get("enemies", []) if e.get("alive", True)]
    meteors = [m for m in data.get("meteors", []) if m.get("alive", True)]

    ship_x = float(my_ship.get("x", ship_state.x))
    ship_y = float(my_ship.get("y", ship_state.y))
    ship_angle = float(my_ship.get("angle", ship_state.angle))
    ship_energy = float(my_ship.get("energy", ship_state.energy))

    def _dist_sq(obj: dict) -> float:
        dx = float(obj.get("x", 0.0)) - ship_x
        dy = float(obj.get("y", 0.0)) - ship_y
        return dx * dx + dy * dy

    target = min(enemies, key=_dist_sq) if enemies else None
    nearest_meteor = min(meteors, key=_dist_sq) if meteors else None

    move = 0
    rot = 0
    shoot = 0

    if nearest_meteor is not None:
        meteor_dx = ship_x - float(nearest_meteor.get("x", 0.0))
        meteor_dy = ship_y - float(nearest_meteor.get("y", 0.0))
        meteor_dist = math.sqrt(meteor_dx * meteor_dx + meteor_dy * meteor_dy)
    else:
        meteor_dist = float("inf")

    if target is not None:
        target_x = float(target.get("x", 0.0))
        target_y = float(target.get("y", 0.0))
        target_dist = math.sqrt((target_x - ship_x) ** 2 + (target_y - ship_y) ** 2)
        desired_angle = _angle_to_target_deg(ship_x, ship_y, target_x, target_y)

        if meteor_dist < 170.0 and nearest_meteor is not None:
            desired_angle = _angle_to_target_deg(
                float(nearest_meteor.get("x", 0.0)),
                float(nearest_meteor.get("y", 0.0)),
                ship_x,
                ship_y,
            )
            move = 1
        else:
            if target_dist > 260.0:
                move = 1
            elif target_dist < 110.0:
                move = 2

            if abs(_angle_diff_deg(desired_angle, ship_angle)) < 12.0 and target_dist < 600.0 and ship_energy >= 2.0:
                shoot = 1

        angle_delta = _angle_diff_deg(desired_angle, ship_angle)
        if angle_delta > 12.0:
            rot = 2
        elif angle_delta < -12.0:
            rot = 1
    elif nearest_meteor is not None:
        desired_angle = _angle_to_target_deg(
            float(nearest_meteor.get("x", 0.0)),
            float(nearest_meteor.get("y", 0.0)),
            ship_x,
            ship_y,
        )
        angle_delta = _angle_diff_deg(desired_angle, ship_angle)
        move = 1
        if angle_delta > 12.0:
            rot = 2
        elif angle_delta < -12.0:
            rot = 1

    return {"movimento": move, "rotazione": rot, "sparo": shoot}


# ─── Client Socket.io ─────────────────────────────────────────────────────────

def create_client(model: Optional[DQNNetwork], ai_slot: int, room_id: str, bot_mode: str = "model") -> socketio.AsyncClient:
    """
    Crea e configura il client Socket.io.
    Restituisce il client già decorato con gli event handler.
    """
    sio = socketio.AsyncClient(reconnection=True, reconnection_attempts=0)
    ship_state = ShipState()
    last_tick_ms: Optional[float] = None
    active_model = model
    last_reload_check_s = 0.0
    last_model_mtime: Optional[float] = None

    if os.path.exists(MODEL_PATH):
      try:
          last_model_mtime = os.path.getmtime(MODEL_PATH)
      except OSError:
          last_model_mtime = None

    if bot_mode == "scripted":
        log.info("scripted opponent mode active (room=%s slot=%d)", room_id, ai_slot)

    @sio.event
    async def connect():
        log.info("connesso a game_srvc (room=%s slot=%d)", room_id, ai_slot)

    @sio.event
    async def disconnect():
        log.warning("disconnesso da game_srvc — riconnessione automatica...")

    @sio.event
    async def connect_error(data):
        log.error("errore connessione: %s", data)

    @sio.on("ai_game_state")
    async def on_game_state(data):
        """
        Riceve lo stato del gioco da game_srvc e risponde con il comando AI.
        Chiamato ~30 volte al secondo (throttling lato JS).
        """
        nonlocal last_tick_ms, active_model, last_reload_check_s, last_model_mtime
        now_ms = time.monotonic() * 1000.0
        dt_ms = _extract_dt_ms(data, now_ms, last_tick_ms)
        last_tick_ms = now_ms
        bridge_client_id = data.get("bridgeClientId")
        if not isinstance(bridge_client_id, str) or not bridge_client_id:
            bridge_client_id = None

        if bot_mode != "scripted":
            # Hot-reload promoted model in live inference mode.
            now_s = now_ms / 1000.0
            if MODEL_AUTO_RELOAD and now_s - last_reload_check_s >= MODEL_RELOAD_INTERVAL_S:
                last_reload_check_s = now_s
                if os.path.exists(MODEL_PATH):
                    try:
                        current_mtime = os.path.getmtime(MODEL_PATH)
                        if last_model_mtime is None or current_mtime > last_model_mtime:
                            reloaded = load_model(MODEL_PATH)
                            reloaded.eval()
                            active_model = reloaded
                            last_model_mtime = current_mtime
                            log.info("live model hot-reloaded from %s", MODEL_PATH)
                    except Exception as e:
                        log.warning("model hot-reload skipped: %s", e)

        # Aggiorna lo stato locale con l'ultima snapshot autorevole.
        my_ship = data.get("my_ship") or {}
        ship_state.sync_from_server(my_ship, now_ms)

        # Se la nave non è viva, manda noop.
        if not ship_state.alive:
            noop_payload = {
                "roomId":    room_id,
                "slot":      ai_slot,
                "movimento": 0,
                "rotazione": 0,
                "sparo":     0,
            }
            if bridge_client_id:
                noop_payload["bridgeClientId"] = bridge_client_id
            await sio.emit("ai_command", noop_payload)
            return

        try:
            if bot_mode == "scripted":
                action = _choose_scripted_action(data, ship_state)
            else:
                # Usa lo stato locale predetto come input della rete.
                state = build_state_vector(data, my_ship_override=ship_state.as_dict())
                assert active_model is not None
                action = active_model.get_action(state)

            # Replica del tick JS: applica comando e integra fisica localmente.
            ship_state.apply_command(action, dt_ms)
            ship_state.tick(dt_ms, now_ms)

            command_payload = {
                "roomId":    room_id,
                "slot":      ai_slot,
                **action,       # movimento, rotazione, sparo
            }
            if bridge_client_id:
                command_payload["bridgeClientId"] = bridge_client_id
            await sio.emit("ai_command", command_payload)
        except Exception as e:
            log.error("errore calcolo azione: %s", e)
            error_payload = {
                "roomId": room_id, "slot": ai_slot,
                "movimento": 0, "rotazione": 0, "sparo": 0,
            }
            if bridge_client_id:
                error_payload["bridgeClientId"] = bridge_client_id
            await sio.emit("ai_command", error_payload)

    return sio


async def serve(room_id: str = ROOM_ID, ai_slot: int = AI_SLOT):
    """
    Entry point: carica il modello e mantiene la connessione attiva.
    Chiamato da main.py in modalità TRAINING_MODE=false.
    """
    if BOT_MODE == "scripted":
        log.info("starting scripted opponent, no model load")
        model = None
    elif os.path.exists(MODEL_PATH):
        model = load_model(MODEL_PATH)
        log.info("modello caricato da %s", MODEL_PATH)
        model.eval()
    else:
        log.warning("modello non trovato — uso rete non addestrata")
        model = DQNNetwork()
        model.eval()

    sio = create_client(model, ai_slot, room_id, bot_mode=BOT_MODE)

    await sio.connect(
        GAME_SVC_URL,
        auth={
            "service_secret": SERVICE_SECRET,
            "ai_slot":        ai_slot,
            "room_id":        room_id,
        },
        transports=["websocket"],   # forza WebSocket puro, salta il polling HTTP
        socketio_path=SOCKET_PATH.strip("/") or "socket.io",
    )

    await sio.wait()  # rimane connesso finché il processo non viene killato


if __name__ == "__main__":
    asyncio.run(serve())
