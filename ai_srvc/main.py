"""
main.py — entry point ai_srvc

TRAINING_MODE=false -> live inference via Socket.IO client
TRAINING_MODE=true  -> DQN training bootstrap
"""

import asyncio
import logging
import os

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
)

TRAINING_MODE = os.getenv("TRAINING_MODE", "false").lower() == "true"
ROOM_ID = os.getenv("ROOM_ID", "local")
AI_SLOT = int(os.getenv("AI_SLOT", "1"))


async def main() -> None:
    if TRAINING_MODE:
        from training.trainer import Trainer

        trainer = Trainer()
        await trainer.run()
        return

    from socketio_client import serve

    await serve(room_id=ROOM_ID, ai_slot=AI_SLOT)


if __name__ == "__main__":
    asyncio.run(main())
