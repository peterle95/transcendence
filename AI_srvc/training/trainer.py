from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, Optional

import socketio
import torch

from agent import DQNAgent
from model import load_model, save_model
from socketio_client import build_state_vector

log = logging.getLogger("trainer")

MODEL_PATH = os.getenv("MODEL_PATH", "/app/models/dqn_latest.pt")
TRAIN_STEPS = int(os.getenv("TRAIN_STEPS", "5000"))
SAVE_EVERY = int(os.getenv("SAVE_EVERY", "500"))
GAME_SVC_URL = os.getenv("GAME_SVC_URL", "http://game_srvc:4000")
SERVICE_SECRET = os.getenv("SERVICE_SECRET", "inter-service-shared-secret-change-in-production")
ROOM_ID = os.getenv("ROOM_ID", "local")
AI_SLOT = int(os.getenv("AI_SLOT", "1"))
TRAIN_AI_SLOTS = os.getenv("TRAIN_AI_SLOTS", "1,2")
STATE_TIMEOUT_S = float(os.getenv("TRAIN_STATE_TIMEOUT_S", "15"))
TRAIN_RESUME = os.getenv("TRAIN_RESUME", "true").lower() == "true"
TRAIN_CHECKPOINT_PATH = os.getenv("TRAIN_CHECKPOINT_PATH", "/app/models/dqn_training_checkpoint.pt")

REWARD_WIN = float(os.getenv("REWARD_WIN", "1.0"))
REWARD_DEATH = float(os.getenv("REWARD_DEATH", "-1.0"))
REWARD_HIT = float(os.getenv("REWARD_HIT", "0.02"))
REWARD_HURT = float(os.getenv("REWARD_HURT", "-0.02"))


class Trainer:
    """Live trainer driven by ai_game_state snapshots from game_srvc."""

    def __init__(self) -> None:
        self.agent = DQNAgent()
        self._target_steps: Optional[int] = TRAIN_STEPS if TRAIN_STEPS > 0 else None
        self._recent_losses: list[float] = []
        self._recent_rewards: list[float] = []
        self._session_transitions = 0
        self._session_episodes = 0
        self._total_transitions = 0
        self._total_episodes = 0
        self._last_state: Optional[Any] = None
        self._last_action: Optional[Dict[str, int]] = None
        self._last_metrics: Optional[Dict[str, float]] = None
        self._got_first_state = asyncio.Event()
        self._finished = asyncio.Event()

        self._ensure_artifact_dirs()

        self._resume_if_available()

    def _should_finish_session(self) -> bool:
        return self._target_steps is not None and self._session_transitions >= self._target_steps

    @staticmethod
    def _ensure_parent_dir(file_path: str) -> None:
        parent = os.path.dirname(file_path)
        if parent:
            os.makedirs(parent, exist_ok=True)

    def _ensure_artifact_dirs(self) -> None:
        self._ensure_parent_dir(MODEL_PATH)
        self._ensure_parent_dir(TRAIN_CHECKPOINT_PATH)

    def _resume_if_available(self) -> None:
        if not TRAIN_RESUME:
            return

        if os.path.exists(TRAIN_CHECKPOINT_PATH):
            try:
                checkpoint = torch.load(TRAIN_CHECKPOINT_PATH, map_location="cpu")
                self.agent.restore_from_checkpoint(checkpoint["agent"])
                trainer_state = checkpoint.get("trainer", {})
                self._total_transitions = int(trainer_state.get("total_transitions", 0))
                self._total_episodes = int(trainer_state.get("total_episodes", 0))
                log.info(
                    "resume enabled: loaded full checkpoint from %s (total_transitions=%d total_episodes=%d replay=%d)",
                    TRAIN_CHECKPOINT_PATH,
                    self._total_transitions,
                    self._total_episodes,
                    len(self.agent.replay),
                )
                return
            except Exception:
                log.exception("failed to load training checkpoint, trying model-only resume")

        if os.path.exists(MODEL_PATH):
            try:
                resumed = load_model(MODEL_PATH)
                self.agent.online.load_state_dict(resumed.state_dict())
                self.agent.target.update_from(self.agent.online)
                log.info("resume fallback: loaded model weights from %s", MODEL_PATH)
            except Exception:
                log.exception("failed to load existing model, starting from fresh weights")

    def _save_checkpoint(self) -> None:
        self._ensure_artifact_dirs()
        checkpoint = {
            "agent": self.agent.checkpoint_state(),
            "trainer": {
                "total_transitions": int(self._total_transitions),
                "total_episodes": int(self._total_episodes),
            },
        }
        torch.save(checkpoint, TRAIN_CHECKPOINT_PATH)

    @staticmethod
    def _extract_metrics(payload: dict) -> Dict[str, float]:
        my_ship = payload.get("my_ship") or {}
        my_alive = bool(my_ship.get("alive", True)) and float(my_ship.get("hp", 0.0)) > 0.0
        enemies = payload.get("enemies", []) or []
        alive_enemies = sum(1 for e in enemies if e.get("alive", True) and float(e.get("hp", 0.0)) > 0.0)
        enemy_hp_total = float(sum(float(e.get("hp", 0.0)) for e in enemies if e.get("alive", True)))

        return {
            "my_hp": float(my_ship.get("hp", 0.0)),
            "my_alive": 1.0 if my_alive else 0.0,
            "enemy_hp_total": enemy_hp_total,
            "alive_enemies": float(alive_enemies),
        }

    @staticmethod
    def _compute_reward(
        prev_metrics: Dict[str, float],
        curr_metrics: Dict[str, float],
    ) -> tuple[float, bool]:
        # Small shaping terms: keep objective on win/loss, but speed up learning.
        enemy_hp_delta = prev_metrics["enemy_hp_total"] - curr_metrics["enemy_hp_total"]
        my_hp_delta = prev_metrics["my_hp"] - curr_metrics["my_hp"]

        reward = 0.0

        if enemy_hp_delta > 0.0:
            reward += REWARD_HIT * enemy_hp_delta
        if my_hp_delta > 0.0:
            reward += REWARD_HURT * my_hp_delta

        my_dead = curr_metrics["my_alive"] < 0.5
        enemies_dead = curr_metrics["alive_enemies"] <= 0.0
        done = my_dead or enemies_dead

        if my_dead:
            reward += REWARD_DEATH
        elif enemies_dead:
            reward += REWARD_WIN

        return reward, done

    def _record_training_step(self, reward: float) -> None:
        self._recent_rewards.append(reward)
        if len(self._recent_rewards) > 200:
            self._recent_rewards.pop(0)

        loss = self.agent.train_step()
        if loss is not None:
            self._recent_losses.append(loss)
            if len(self._recent_losses) > 200:
                self._recent_losses.pop(0)

    async def _emit_command(self, sio: socketio.AsyncClient, action: Dict[str, int]) -> None:
        if not sio.connected:
            return
        await sio.emit(
            "ai_command",
            {
                "roomId": ROOM_ID,
                "slot": AI_SLOT,
                **action,
            },
        )

    async def _on_state(self, sio: socketio.AsyncClient, payload: dict) -> None:
        self._got_first_state.set()

        state = build_state_vector(payload)
        curr_metrics = self._extract_metrics(payload)

        if self._last_state is not None and self._last_action is not None and self._last_metrics is not None:
            reward, done = self._compute_reward(self._last_metrics, curr_metrics)
            self.agent.remember(self._last_state, self._last_action, reward, state, done)

            self._session_transitions += 1
            self._total_transitions += 1
            self._record_training_step(reward)

            if done:
                self._session_episodes += 1
                self._total_episodes += 1
                self._last_state = None
                self._last_action = None
                self._last_metrics = None

                await self._emit_command(sio, {"movimento": 0, "rotazione": 0, "sparo": 0})

                if self._should_finish_session():
                    self._finished.set()
                return

        action = self.agent.select_action(state, explore=True)
        await self._emit_command(sio, action)

        self._last_state = state
        self._last_action = action
        self._last_metrics = curr_metrics

        if self._session_transitions % 100 == 0 and self._session_transitions > 0:
            avg_reward = sum(self._recent_rewards) / len(self._recent_rewards) if self._recent_rewards else 0.0
            avg_loss = sum(self._recent_losses) / len(self._recent_losses) if self._recent_losses else 0.0
            log.info(
                "session_transition=%d total_transition=%d epsilon=%.4f replay=%d avg_reward=%.4f avg_loss=%.6f session_episodes=%d total_episodes=%d",
                self._session_transitions,
                self._total_transitions,
                self.agent.epsilon,
                len(self.agent.replay),
                avg_reward,
                avg_loss,
                self._session_episodes,
                self._total_episodes,
            )

        if self._session_transitions % SAVE_EVERY == 0 and self._session_transitions > 0:
            self._ensure_artifact_dirs()
            save_model(self.agent.online, MODEL_PATH)
            self._save_checkpoint()
            log.info(
                "checkpoint saved at session_transition=%d total_transition=%d -> %s and %s",
                self._session_transitions,
                self._total_transitions,
                MODEL_PATH,
                TRAIN_CHECKPOINT_PATH,
            )

        if self._should_finish_session():
            self._finished.set()

    async def run(self) -> None:
        if self._target_steps is None:
            log.info(
                "live training started: continuous mode room=%s slot=%d",
                ROOM_ID,
                AI_SLOT,
            )
        else:
            log.info(
                "live training started: target_transitions=%d room=%s slot=%d",
                self._target_steps,
                ROOM_ID,
                AI_SLOT,
            )

        sio = socketio.AsyncClient(reconnection=True, reconnection_attempts=0)

        @sio.event
        async def connect() -> None:
            log.info("trainer connected to game socket")

        @sio.event
        async def disconnect() -> None:
            log.warning("trainer disconnected from game socket")

        @sio.on("ai_game_state")
        async def on_game_state(payload: dict) -> None:
            try:
                await self._on_state(sio, payload)
            except Exception:
                log.exception("error while processing ai_game_state")

        await sio.connect(
            GAME_SVC_URL,
            auth={
                "service_secret": SERVICE_SECRET,
                "room_id": ROOM_ID,
                "ai_slot": AI_SLOT,
            },
            transports=["websocket"],
        )

        # Ask training-enabled game_srvc instance to bootstrap an AI-only room.
        ai_slots = [int(s.strip()) for s in TRAIN_AI_SLOTS.split(',') if s.strip().isdigit()]
        if not ai_slots:
            ai_slots = [AI_SLOT, (AI_SLOT + 1) % 4]
        ack = await sio.call(
            "training_start",
            {"roomId": ROOM_ID, "aiSlots": ai_slots},
            timeout=10,
        )
        if not ack or not ack.get("ok"):
            await sio.disconnect()
            raise RuntimeError(f"Training session bootstrap failed: {ack}")
        log.info("training room bootstrap acknowledged: room=%s slots=%s", ROOM_ID, ai_slots)

        try:
            await asyncio.wait_for(self._got_first_state.wait(), timeout=STATE_TIMEOUT_S)
        except TimeoutError as exc:
            await sio.disconnect()
            raise RuntimeError(
                "No ai_game_state received. Verify ai_train_bot is running and training_start bootstrap succeeded for the configured ROOM_ID/AI_SLOT."
            ) from exc

        while not self._finished.is_set():
            await asyncio.sleep(0.1)

        self._ensure_artifact_dirs()
        save_model(self.agent.online, MODEL_PATH)
        self._save_checkpoint()
        log.info(
            "live training completed: session_transitions=%d session_episodes=%d total_transitions=%d total_episodes=%d model=%s checkpoint=%s",
            self._session_transitions,
            self._session_episodes,
            self._total_transitions,
            self._total_episodes,
            MODEL_PATH,
            TRAIN_CHECKPOINT_PATH,
        )

        await sio.disconnect()
