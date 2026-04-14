from __future__ import annotations

import asyncio
import logging
import math
import os
import time
from typing import Any

import socketio

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
)
log = logging.getLogger("training_spectator")

GAME_SVC_URL = os.getenv("GAME_SVC_URL", "http://game_srvc_train:4000")
SERVICE_SECRET = os.getenv("SERVICE_SECRET", "inter-service-shared-secret-change-in-production")
ROOM_ID = os.getenv("ROOM_ID", "training-room")
AI_SLOT = int(os.getenv("AI_SLOT", "1"))
PRINT_INTERVAL_S = float(os.getenv("SPECTATOR_PRINT_INTERVAL_S", "1.0"))


def _dist(a: dict[str, Any], b: dict[str, Any]) -> float:
    ax, ay = float(a.get("x", 0.0)), float(a.get("y", 0.0))
    bx, by = float(b.get("x", 0.0)), float(b.get("y", 0.0))
    return math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)


async def main() -> None:
    sio = socketio.AsyncClient(reconnection=True, reconnection_attempts=0)

    state: dict[str, Any] = {}
    last_print = 0.0

    @sio.event
    async def connect() -> None:
        log.info("connected to training game socket room=%s slot=%d", ROOM_ID, AI_SLOT)

    @sio.event
    async def disconnect() -> None:
        log.warning("disconnected from training game socket")

    @sio.on("ai_game_state")
    async def on_game_state(payload: dict[str, Any]) -> None:
        nonlocal state, last_print
        state = payload or {}

        now = time.time()
        if now - last_print < PRINT_INTERVAL_S:
            return
        last_print = now

        my_ship = state.get("my_ship") or {}
        enemies = state.get("enemies", []) or []
        meteors = state.get("meteors", []) or []
        lasers = state.get("lasers", []) or []

        alive_enemies = [e for e in enemies if e.get("alive", True)]
        enemy_hp = sum(float(e.get("hp", 0.0)) for e in alive_enemies)
        my_hp = float(my_ship.get("hp", 0.0))
        my_alive = bool(my_ship.get("alive", False))

        nearest_enemy = min((_dist(my_ship, e) for e in alive_enemies), default=float("inf"))
        nearest_meteor = min((_dist(my_ship, m) for m in meteors if m.get("alive", True)), default=float("inf"))

        log.info(
            "spectator | my_alive=%s my_hp=%.1f enemy_count=%d enemy_hp_total=%.1f lasers=%d meteors=%d nearest_enemy=%.1f nearest_meteor=%.1f",
            my_alive,
            my_hp,
            len(alive_enemies),
            enemy_hp,
            len(lasers),
            len([m for m in meteors if m.get("alive", True)]),
            nearest_enemy if nearest_enemy != float("inf") else -1.0,
            nearest_meteor if nearest_meteor != float("inf") else -1.0,
        )

    await sio.connect(
        GAME_SVC_URL,
        auth={
            "service_secret": SERVICE_SECRET,
            "room_id": ROOM_ID,
            "ai_slot": AI_SLOT,
        },
        transports=["websocket"],
    )

    await sio.wait()


if __name__ == "__main__":
    asyncio.run(main())
