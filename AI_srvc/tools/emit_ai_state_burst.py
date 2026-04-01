import asyncio
import copy
import os

import socketio

GAME_SVC_URL = os.getenv("GAME_SVC_URL", "http://game_srvc:4000")
SERVICE_SECRET = os.getenv("SERVICE_SECRET", "inter-service-shared-secret-change-in-production")
ROOM_ID = os.getenv("ROOM_ID", "testburst")
AI_SLOT = int(os.getenv("AI_SLOT", "7"))
TICKS = int(os.getenv("TICKS", "25"))


async def main() -> None:
    sio = socketio.AsyncClient()

    await sio.connect(
        GAME_SVC_URL,
        auth={"service_secret": SERVICE_SECRET},
        transports=["websocket"],
    )

    base_payload = {
        "roomId": ROOM_ID,
        "slot": AI_SLOT,
        "my_ship": {
            "x": 200,
            "y": 200,
            "angle": 90,
            "vx": 0,
            "vy": 0,
            "energy": 30,
            "hp": 20,
            "alive": True,
            "radius": 40,
        },
        "enemies": [
            {"x": 800, "y": 400, "angle": 180, "hp": 20, "alive": True}
        ],
        "lasers": [],
        "meteors": [],
        "dt_ms": 33,
    }

    for i in range(TICKS):
        payload = copy.deepcopy(base_payload)
        payload["tick"] = i
        payload["my_ship"]["x"] = 200 + i * 3
        payload["my_ship"]["y"] = 200 + (i % 5)
        await sio.emit("ai_game_state", payload)
        await asyncio.sleep(0.02)

    print(f"emitted {TICKS} ai_game_state ticks for room={ROOM_ID} slot={AI_SLOT}")
    await asyncio.sleep(1.0)
    await sio.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
