from __future__ import annotations

import asyncio
import logging
import math
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import socketio
import torch

from agent import DQNAgent
from model import load_model, save_model
from socketio_client import build_state_vector, extract_damage_metrics

log = logging.getLogger("trainer")


TRAINING_ENV_KEYS = [
    "GAME_SVC_URL",
    "SOCKET_PATH",
    "SERVICE_SECRET",
    "MODEL_PATH",
    "ROOM_ID",
    "AI_SLOT",
    "TRAIN_AI_SLOTS",
    "TRAIN_CHECKPOINT_PATH",
    "TRAIN_AUDIT_LOG_PATH",
    "TRAIN_AUDIT_EVERY",
    "WIN_RATE_WINDOW_EPISODES",
    "TRAINING_SCENARIO",
    "TRAIN_STEPS",
    "DQN_EPSILON_START",
    "DQN_EPSILON_END",
    "DQN_EPSILON_DECAY_STEPS",
    "DQN_LR",
    "TRAINING_MODE",
    "TRAIN_EVAL_ONLY",
    "TRAIN_RESUME",
    "REWARD_WIN",
    "REWARD_DEATH",
    "REWARD_HIT",
    "REWARD_HURT_METEOR",
    "REWARD_HURT_LASER",
    "REWARD_ALIVE_STEP",
    "REWARD_METEOR_DANGER",
    "METEOR_DANGER_DISTANCE_NORM",
    "REWARD_ROTATE_DANGER",
    "REWARD_ROTATE_STEP",
    "ROTATION_DANGER_DISTANCE_NORM",
    "REWARD_APPROACH_ENEMY",
    "REWARD_AIM_ENEMY",
    "REWARD_WASTED_SHOT",
    "REWARD_LOW_ENERGY",
    "LOW_ENERGY_THRESHOLD",
    "LOG_LEVEL",
]


def _env_required(name: str) -> str:
    value = os.getenv(name)
    if value is None:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


MODEL_PATH = os.getenv("MODEL_PATH", "/app/models/dqn_latest.pt")
TRAIN_STEPS = int(os.getenv("TRAIN_STEPS", "5000"))
SAVE_EVERY = int(os.getenv("SAVE_EVERY", "500"))
GAME_SVC_URL = os.getenv("GAME_SVC_URL", "http://game_srvc:4000")
SOCKET_PATH = os.getenv("SOCKET_PATH", "/game/socket.io/")
SERVICE_SECRET = os.getenv("SERVICE_SECRET", "inter-service-shared-secret-change-in-production")
ROOM_ID = os.getenv("ROOM_ID", "local")
AI_SLOT = int(os.getenv("AI_SLOT", "1"))
TRAIN_AI_SLOTS = os.getenv("TRAIN_AI_SLOTS", "1,2")
STATE_TIMEOUT_S = float(os.getenv("TRAIN_STATE_TIMEOUT_S", "15"))
TRAIN_CONNECT_RETRY_BASE_S = float(os.getenv("TRAIN_CONNECT_RETRY_BASE_S", "1.0"))
TRAIN_CONNECT_RETRY_MAX_S = float(os.getenv("TRAIN_CONNECT_RETRY_MAX_S", "15.0"))
TRAIN_CONNECT_RETRY_JITTER_S = float(os.getenv("TRAIN_CONNECT_RETRY_JITTER_S", "0.5"))
TRAIN_RESUME = os.getenv("TRAIN_RESUME", "true").lower() == "true"
TRAIN_EVAL_ONLY = os.getenv("TRAIN_EVAL_ONLY", "false").lower() == "true"
TRAIN_CHECKPOINT_PATH = os.getenv("TRAIN_CHECKPOINT_PATH", "/app/models/dqn_training_checkpoint.pt")
TRAIN_AUDIT_LOG_PATH = os.getenv("TRAIN_AUDIT_LOG_PATH", "/app/training/AI_Training_Log.md")
TRAIN_DASHBOARD_AUTO = os.getenv("TRAIN_DASHBOARD_AUTO", "true").lower() == "true"
TRAIN_DASHBOARD_PATH = os.getenv("TRAIN_DASHBOARD_PATH", "/app/training/training_dashboard.html")
TRAIN_AUDIT_EVERY = int(os.getenv("TRAIN_AUDIT_EVERY", "100"))
WIN_RATE_WINDOW_EPISODES = int(os.getenv("WIN_RATE_WINDOW_EPISODES", "50"))

REWARD_WIN = float(_env_required("REWARD_WIN"))
REWARD_DEATH = float(_env_required("REWARD_DEATH"))
REWARD_HIT = float(_env_required("REWARD_HIT"))
REWARD_HURT_METEOR = float(_env_required("REWARD_HURT_METEOR"))
REWARD_HURT_LASER = float(_env_required("REWARD_HURT_LASER"))
REWARD_ALIVE_STEP = float(_env_required("REWARD_ALIVE_STEP"))
REWARD_METEOR_DANGER = float(_env_required("REWARD_METEOR_DANGER"))
REWARD_WASTED_SHOT = float(_env_required("REWARD_WASTED_SHOT"))
REWARD_ROTATE_STEP = float(_env_required("REWARD_ROTATE_STEP"))
REWARD_ROTATE_DANGER = float(_env_required("REWARD_ROTATE_DANGER"))
METEOR_DANGER_DISTANCE_NORM = float(_env_required("METEOR_DANGER_DISTANCE_NORM"))
ROTATION_DANGER_DISTANCE_NORM = float(_env_required("ROTATION_DANGER_DISTANCE_NORM"))
REWARD_APPROACH_ENEMY = float(_env_required("REWARD_APPROACH_ENEMY"))
REWARD_AIM_ENEMY = float(os.getenv("REWARD_AIM_ENEMY", "0.0"))
REWARD_LOW_ENERGY = float(_env_required("REWARD_LOW_ENERGY"))
LOW_ENERGY_THRESHOLD = float(_env_required("LOW_ENERGY_THRESHOLD"))


class Trainer:
    """Live trainer driven by ai_game_state snapshots from game_srvc."""

    def __init__(self) -> None:
        self.agent = DQNAgent()
        self._target_steps: Optional[int] = TRAIN_STEPS if TRAIN_STEPS > 0 else None
        self._recent_losses: list[float] = []
        self._recent_rewards: list[float] = []
        self._recent_episode_wins: list[int] = []
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
        self._log_raw_training_env()
        self._log_effective_training_config()

    @staticmethod
    def _log_raw_training_env() -> None:
        # Log raw env strings so runtime config can be audited exactly as injected.
        entries = []
        for key in TRAINING_ENV_KEYS:
            value = os.getenv(key)
            entries.append(f"{key}={value if value is not None else '<missing>'}")

        log.info("raw training env: %s", " | ".join(entries))

    def _append_session_start_header(self) -> None:
        self._ensure_artifact_dirs()
        self._ensure_audit_log_header()

        timestamp = datetime.now(timezone.utc).isoformat()
        avg_reward = 0.0
        avg_loss = 0.0
        win_rate_pct = 0.0
        epsilon_start = float(self.agent.cfg.epsilon_start if self.agent.cfg.epsilon_start is not None else 0.0)
        epsilon_end = float(self.agent.cfg.epsilon_end if self.agent.cfg.epsilon_end is not None else 0.0)
        epsilon_decay_steps = int(self.agent.cfg.epsilon_decay_steps if self.agent.cfg.epsilon_decay_steps is not None else 0)

        session_lines = [
            "## New Training Session\n",
            f"- UTC Time: {timestamp}\n",
            "- Event: session_start\n",
            f"- Episodes: session={self._session_episodes}; total={self._total_episodes}\n",
            f"- Transitions: session={self._session_transitions}; total={self._total_transitions}\n",
            f"- Epsilon Start: {epsilon_start:.4f}\n",
            f"- Epsilon End: {epsilon_end:.4f}\n",
            f"- Epsilon Now: {self.agent.epsilon:.4f}\n",
            f"- Replay: {len(self.agent.replay)}\n",
            f"- Avg Reward: {avg_reward:.6f}\n",
            f"- Avg Loss: {avg_loss:.6f}\n",
            f"- Win Rate ({WIN_RATE_WINDOW_EPISODES} ep): {win_rate_pct:.1f}%\n",
            "\n### Session Parameters\n\n",
            "| Parameter | Value |\n",
            "| --- | --- |\n",
            f"| UTC Time | {timestamp} |\n",
            f"| Event | session_start |\n",
            f"| TRAIN_STEPS | {TRAIN_STEPS} |\n",
            f"| TRAIN_RESUME | {TRAIN_RESUME} |\n",
            f"| TRAIN_AUDIT_EVERY | {TRAIN_AUDIT_EVERY} |\n",
            f"| WIN_RATE_WINDOW_EPISODES | {WIN_RATE_WINDOW_EPISODES} |\n",
            f"| Epsilon Start | {epsilon_start:.4f} |\n",
            f"| Epsilon End | {epsilon_end:.4f} |\n",
            f"| Epsilon Decay Steps | {epsilon_decay_steps} |\n",
            f"| Epsilon Now | {self.agent.epsilon:.4f} |\n",
            f"| Reward Hurt Meteor | {REWARD_HURT_METEOR:.6f} |\n",
            f"| Reward Hurt Laser | {REWARD_HURT_LASER:.6f} |\n",
            f"| Reward Aim Enemy | {REWARD_AIM_ENEMY:.6f} |\n",
            f"| Replay Capacity | {int(self.agent.cfg.replay_capacity)} |\n",
            f"| Batch Size | {int(self.agent.cfg.batch_size)} |\n",
            f"| Learning Rate | {float(self.agent.cfg.lr):.6f} |\n",
            f"| Gamma | {float(self.agent.cfg.gamma):.4f} |\n",
            "\n### Session ENV\n\n",
            "| ENV | Value |\n",
            "| --- | --- |\n",
        ]

        for key in TRAINING_ENV_KEYS:
            value = os.getenv(key)
            session_lines.append(f"| {key} | {value if value is not None else '<missing>'} |\n")

        session_lines.append("\n### Initial Metrics\n\n")
        session_lines.append("| UTC Time | Event | Episodes | Transitions | Epsilon Start | Epsilon End | Epsilon Now | Replay | Avg Reward | Avg Loss | Win Rate | Runtime Config Updates |\n")
        session_lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n")
        session_lines.append(
            f"| {timestamp} | session_start | session={self._session_episodes}; total={self._total_episodes} | "
            f"session={self._session_transitions}; total={self._total_transitions} | {epsilon_start:.4f} | {epsilon_end:.4f} | {self.agent.epsilon:.4f} | "
            f"{len(self.agent.replay)} | {avg_reward:.6f} | {avg_loss:.6f} | {win_rate_pct:.1f}% | - |\n"
        )
        session_lines.append("\n---\n\n")

        with open(TRAIN_AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
            f.writelines(session_lines)

    def _log_effective_training_config(self) -> None:
        epsilon_start = float(self.agent.cfg.epsilon_start if self.agent.cfg.epsilon_start is not None else 0.0)
        epsilon_end = float(self.agent.cfg.epsilon_end if self.agent.cfg.epsilon_end is not None else 0.0)
        epsilon_decay_steps = int(self.agent.cfg.epsilon_decay_steps if self.agent.cfg.epsilon_decay_steps is not None else 0)

        log.info(
            "effective training config: steps=%s resume=%s eval_only=%s model=%s checkpoint=%s epsilon_start=%.4f epsilon_end=%.4f epsilon_decay_steps=%d epsilon_now=%.4f train_steps=%d replay_capacity=%d batch_size=%d lr=%.6f gamma=%.4f",
            "continuous" if self._target_steps is None else self._target_steps,
            TRAIN_RESUME,
            TRAIN_EVAL_ONLY,
            MODEL_PATH,
            TRAIN_CHECKPOINT_PATH,
            epsilon_start,
            epsilon_end,
            epsilon_decay_steps,
            float(self.agent.epsilon),
            int(self.agent.train_steps),
            int(self.agent.cfg.replay_capacity),
            int(self.agent.cfg.batch_size),
            float(self.agent.cfg.lr),
            float(self.agent.cfg.gamma),
        )

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
        self._ensure_parent_dir(TRAIN_AUDIT_LOG_PATH)
        self._ensure_parent_dir(TRAIN_DASHBOARD_PATH)

    @staticmethod
    def _refresh_dashboard() -> None:
        if not TRAIN_DASHBOARD_AUTO:
            return

        try:
            from training.generate_training_dashboard import generate_dashboard

            parsed_sessions, parsed_events = generate_dashboard(
                Path(TRAIN_AUDIT_LOG_PATH),
                Path(TRAIN_DASHBOARD_PATH),
            )
            log.info(
                "dashboard auto-refreshed: %s (sessions=%d events=%d)",
                TRAIN_DASHBOARD_PATH,
                parsed_sessions,
                parsed_events,
            )
        except Exception:
            log.exception("failed to auto-refresh dashboard at checkpoint")

    def _ensure_audit_log_header(self) -> None:
        table_header = (
            "## Training Events (v2)\n\n"
            "Format: one line per event with explicit labels for every value.\n"
            "Example:\n"
            "| UTC Time: 2026-04-03T17:44:05.130830+00:00 | Event: checkpoint | Episodes: session=10; total=1200 | Transitions: session=1542; total=900000 | Epsilon Start: 1.0000 | Epsilon End: 0.2000 | Replay: 100000 | Avg Reward: 0.012345 | Avg Loss: 0.098765 | Runtime Config Updates: - |\n\n"
        )

        if not os.path.exists(TRAIN_AUDIT_LOG_PATH) or os.path.getsize(TRAIN_AUDIT_LOG_PATH) == 0:
            with open(TRAIN_AUDIT_LOG_PATH, "w", encoding="utf-8") as f:
                f.write("# AI Training Log\n\n")
                f.write(table_header)
            return

        with open(TRAIN_AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
            content = f.read()

        if "## Training Events (v2)" in content:
            return

        with open(TRAIN_AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write("\n\n---\n\n")
            f.write(table_header)

    def _append_audit_log(self, event: str, applied_updates: Optional[dict] = None) -> None:
        self._ensure_artifact_dirs()
        self._ensure_audit_log_header()

        avg_reward = sum(self._recent_rewards) / len(self._recent_rewards) if self._recent_rewards else 0.0
        avg_loss = sum(self._recent_losses) / len(self._recent_losses) if self._recent_losses else 0.0
        win_rate = self._recent_win_rate()
        win_rate_pct = win_rate * 100.0

        timestamp = datetime.now(timezone.utc).isoformat()
        updates_text = "-" if not applied_updates else "; ".join(
            f"{key}: {value[0]} -> {value[1]}" for key, value in applied_updates.items()
        )
        epsilon_start = float(self.agent.cfg.epsilon_start if self.agent.cfg.epsilon_start is not None else 0.0)
        epsilon_end = float(self.agent.cfg.epsilon_end if self.agent.cfg.epsilon_end is not None else 0.0)

        with open(TRAIN_AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(
                f"| UTC Time: {timestamp} | Event: {event} | Episodes: session={self._session_episodes}; total={self._total_episodes} | "
                f"Transitions: session={self._session_transitions}; total={self._total_transitions} | Epsilon Start: {epsilon_start:.4f} | Epsilon End: {epsilon_end:.4f} | "
                f"Replay: {len(self.agent.replay)} | Avg Reward: {avg_reward:.6f} | Avg Loss: {avg_loss:.6f} | "
                f"Win Rate ({WIN_RATE_WINDOW_EPISODES} ep): {win_rate_pct:.1f}% | Runtime Config Updates: {updates_text} |\n"
            )

        if event == "checkpoint":
            self._refresh_dashboard()

    def _recent_win_rate(self) -> float:
        if not self._recent_episode_wins:
            return 0.0
        return sum(self._recent_episode_wins) / len(self._recent_episode_wins)

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

    def _save_checkpoint(self) -> dict:
        self._ensure_artifact_dirs()
        agent_state = self.agent.checkpoint_state()
        applied_updates = agent_state.get("applied_runtime_config_updates", {})
        checkpoint = {
            "agent": agent_state,
            "trainer": {
                "total_transitions": int(self._total_transitions),
                "total_episodes": int(self._total_episodes),
            },
        }
        torch.save(checkpoint, TRAIN_CHECKPOINT_PATH)
        return applied_updates if isinstance(applied_updates, dict) else {}

    def _build_model_metadata(self) -> dict:
        return {
            "source": "training",
            "saved_at_utc": datetime.now(timezone.utc).isoformat(),
            "session_transitions": int(self._session_transitions),
            "total_transitions": int(self._total_transitions),
            "session_episodes": int(self._session_episodes),
            "total_episodes": int(self._total_episodes),
            "train_steps": int(self.agent.train_steps),
            "epsilon": float(self.agent.epsilon),
        }

    @staticmethod
    def _extract_metrics(payload: dict) -> Dict[str, float]:
        my_ship = payload.get("my_ship") or {}
        my_slot = int(payload.get("slot", AI_SLOT))
        my_alive = bool(my_ship.get("alive", True)) and float(my_ship.get("hp", 0.0)) > 0.0
        enemies = payload.get("enemies", []) or []
        meteors = payload.get("meteors", []) or []
        alive_enemies = sum(1 for e in enemies if e.get("alive", True) and float(e.get("hp", 0.0)) > 0.0)
        enemy_hp_total = float(sum(float(e.get("hp", 0.0)) for e in enemies if e.get("alive", True)))

        my_x = float(my_ship.get("x", 0.0))
        my_y = float(my_ship.get("y", 0.0))
        my_angle_rad = math.radians(float(my_ship.get("angle", 0.0)))
        nearest_meteor_norm = 1.0
        nearest_enemy_norm = 1.0
        nearest_enemy_alignment = 0.0
        for e in enemies:
            if not e.get("alive", True) or float(e.get("hp", 0.0)) <= 0.0:
                continue
            dx = float(e.get("x", 0.0)) - my_x
            dy = float(e.get("y", 0.0)) - my_y
            dist = (dx * dx + dy * dy) ** 0.5
            dist_norm = dist / max(1.0, 1470.0)
            if dist_norm < nearest_enemy_norm:
                nearest_enemy_norm = dist_norm
                if dist > 0.0:
                    # Ship nose vector in world-space (same convention as thrustForward).
                    forward_x = math.sin(my_angle_rad)
                    forward_y = -math.cos(my_angle_rad)
                    enemy_dir_x = dx / dist
                    enemy_dir_y = dy / dist
                    nearest_enemy_alignment = max(-1.0, min(1.0, forward_x * enemy_dir_x + forward_y * enemy_dir_y))

        for m in meteors:
            if not m.get("alive", True):
                continue
            dx = float(m.get("x", 0.0)) - my_x
            dy = float(m.get("y", 0.0)) - my_y
            dist_norm = (dx * dx + dy * dy) ** 0.5 / max(1.0, 1470.0)
            if dist_norm < nearest_meteor_norm:
                nearest_meteor_norm = dist_norm

        damage_metrics = extract_damage_metrics(payload, my_slot)

        return {
            "my_hp": float(my_ship.get("hp", 0.0)),
            "my_alive": 1.0 if my_alive else 0.0,
            "my_energy": float(my_ship.get("energy", 0.0)),
            "enemy_hp_total": enemy_hp_total,
            "alive_enemies": float(alive_enemies),
            "nearest_enemy_norm": float(nearest_enemy_norm),
            "enemy_aim_alignment": float(nearest_enemy_alignment),
            "nearest_meteor_norm": float(nearest_meteor_norm),
            "player_inflicted_damage": float(damage_metrics.get("player_inflicted_damage", 0.0)),
            "total_damage_received": float(damage_metrics.get("total_damage_received", 0.0)),
            "meteor_damage_received": float(damage_metrics.get("meteor_damage_received", 0.0)),
            "collision_damage_received": float(damage_metrics.get("collision_damage_received", 0.0)),
            "laser_damage_received": float(
                max(
                    0.0,
                    float(damage_metrics.get("total_damage_received", 0.0))
                    - float(damage_metrics.get("meteor_damage_received", 0.0))
                    - float(damage_metrics.get("collision_damage_received", 0.0)),
                )
            ),
        }

    @staticmethod
    def _compute_reward(
        prev_metrics: Dict[str, float],
        curr_metrics: Dict[str, float],
        prev_action: Optional[Dict[str, int]] = None,
    ) -> tuple[float, bool, Optional[bool]]:
        # Causal reward: count only damage directly inflicted by player's laser hits.
        player_inflicted_damage = curr_metrics["player_inflicted_damage"]
        my_hp_delta = prev_metrics["my_hp"] - curr_metrics["my_hp"]
        my_energy_delta = prev_metrics["my_energy"] - curr_metrics["my_energy"]
        meteor_damage_received = max(0.0, curr_metrics.get("meteor_damage_received", 0.0))
        laser_damage_received = max(0.0, curr_metrics.get("laser_damage_received", 0.0))
        hurt_meteor_coeff = float(REWARD_HURT_METEOR or 0.0)
        hurt_laser_coeff = float(REWARD_HURT_LASER or 0.0)

        reward = 0.0

        # Small survival bonus to prefer stable behavior.
        reward += REWARD_ALIVE_STEP

        if player_inflicted_damage > 0.0:
            reward += REWARD_HIT * player_inflicted_damage

        # Prefer event-level damage attribution when available.
        if meteor_damage_received > 0.0:
            reward += hurt_meteor_coeff * meteor_damage_received
        if laser_damage_received > 0.0:
            reward += hurt_laser_coeff * laser_damage_received

        # Fallback for frames with HP decrease but no damage event attribution.
        if my_hp_delta > 0.0 and meteor_damage_received <= 0.0 and laser_damage_received <= 0.0:
            reward += hurt_meteor_coeff * my_hp_delta

        prev_danger = max(0.0, METEOR_DANGER_DISTANCE_NORM - prev_metrics["nearest_meteor_norm"])
        curr_danger = max(0.0, METEOR_DANGER_DISTANCE_NORM - curr_metrics["nearest_meteor_norm"])
        reward += REWARD_METEOR_DANGER * (curr_danger - prev_danger)

        # Reward moving closer to the nearest alive enemy, but never penalize backing off.
        enemy_approach_delta = prev_metrics["nearest_enemy_norm"] - curr_metrics["nearest_enemy_norm"]
        reward += REWARD_APPROACH_ENEMY * max(0.0, enemy_approach_delta)

        # Reward keeping the ship nose pointed at the nearest enemy.
        # Weighted by proximity so this matters more in combat distance.
        aim_alignment = max(0.0, curr_metrics.get("enemy_aim_alignment", 0.0))
        aim_proximity = max(0.0, 1.0 - curr_metrics["nearest_enemy_norm"])
        aim_score = aim_alignment * aim_proximity
        reward += REWARD_AIM_ENEMY * aim_score
        if prev_action is not None and int(prev_action.get("sparo", 0) or 0) == 1:
            reward += 0.5 * REWARD_AIM_ENEMY * aim_score

        # Penalize spending energy without causal hit confirmation.
        if my_energy_delta > 0.0 and player_inflicted_damage <= 0.0:
            reward += REWARD_WASTED_SHOT * my_energy_delta

        # Penalize low energy state (continuous shooting drains energy fast).
        if curr_metrics["my_energy"] < LOW_ENERGY_THRESHOLD:
            reward += REWARD_LOW_ENERGY

        # Anti-spin shaping: discourage persistent rotation, especially near meteors.
        if prev_action is not None and int(prev_action.get("rotazione", 0) or 0) != 0:
            reward += REWARD_ROTATE_STEP
            if curr_metrics["nearest_meteor_norm"] <= ROTATION_DANGER_DISTANCE_NORM:
                reward += REWARD_ROTATE_DANGER

        my_dead = curr_metrics["my_alive"] < 0.5
        enemies_dead = curr_metrics["alive_enemies"] <= 0.0
        done = my_dead or enemies_dead
        won: Optional[bool] = None

        if my_dead:
            reward += REWARD_DEATH
            won = False
        elif enemies_dead:
            reward += REWARD_WIN
            won = True

        return reward, done, won

    def _record_training_step(self, reward: float) -> None:
        self._recent_rewards.append(reward)
        if len(self._recent_rewards) > 200:
            self._recent_rewards.pop(0)

        if TRAIN_EVAL_ONLY:
            return

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
            reward, done, won = self._compute_reward(self._last_metrics, curr_metrics, self._last_action)
            if not TRAIN_EVAL_ONLY:
                self.agent.remember(self._last_state, self._last_action, reward, state, done)

            self._session_transitions += 1
            self._total_transitions += 1
            self._record_training_step(reward)

            if done:
                self._session_episodes += 1
                self._total_episodes += 1
                if won is not None:
                    self._recent_episode_wins.append(1 if won else 0)
                    if len(self._recent_episode_wins) > WIN_RATE_WINDOW_EPISODES:
                        self._recent_episode_wins.pop(0)
                if self._total_episodes % TRAIN_AUDIT_EVERY == 0:
                    self._append_audit_log(event="episode")
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
            win_rate = self._recent_win_rate()
            win_rate_pct = win_rate * 100.0
            log.info(
                "session_transition=%d total_transition=%d epsilon=%.4f replay=%d avg_reward=%.4f avg_loss=%.6f win_rate_%dep=%.1f%% session_episodes=%d total_episodes=%d",
                self._session_transitions,
                self._total_transitions,
                self.agent.epsilon,
                len(self.agent.replay),
                avg_reward,
                avg_loss,
                WIN_RATE_WINDOW_EPISODES,
                win_rate_pct,
                self._session_episodes,
                self._total_episodes,
            )

        if self._session_transitions % SAVE_EVERY == 0 and self._session_transitions > 0:
            if TRAIN_EVAL_ONLY:
                self._append_audit_log(event="checkpoint")
            else:
                self._ensure_artifact_dirs()
                save_model(self.agent.online, MODEL_PATH, metadata=self._build_model_metadata())
                applied_updates = self._save_checkpoint()
                self._append_audit_log(event="checkpoint", applied_updates=applied_updates)

                if applied_updates:
                    log.info("runtime config applied at checkpoint: %s", applied_updates)

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

        self._append_session_start_header()
        self._append_audit_log(event="session_start")

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

        attempt = 0
        while True:
            attempt += 1
            try:
                await sio.connect(
                    GAME_SVC_URL,
                    auth={
                        "service_secret": SERVICE_SECRET,
                        "room_id": ROOM_ID,
                        "ai_slot": AI_SLOT,
                    },
                    transports=["websocket"],
                    socketio_path=SOCKET_PATH.strip("/") or "socket.io",
                )
                break
            except Exception as exc:
                delay = min(TRAIN_CONNECT_RETRY_MAX_S, TRAIN_CONNECT_RETRY_BASE_S * (2 ** max(0, attempt - 1)))
                delay += random.uniform(0.0, max(0.0, TRAIN_CONNECT_RETRY_JITTER_S))
                log.warning(
                    "trainer connect failed (attempt=%d, room=%s, slot=%d, path=%s): %s. retry in %.2fs",
                    attempt,
                    ROOM_ID,
                    AI_SLOT,
                    SOCKET_PATH,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)

        # Ask training-enabled game_srvc instance to bootstrap an AI-only room.
        ai_slots = [int(s.strip()) for s in TRAIN_AI_SLOTS.split(',') if s.strip().isdigit()]
        if not ai_slots:
            ai_slots = [AI_SLOT, (AI_SLOT + 1) % 4]
        bootstrap_attempt = 0
        while True:
            bootstrap_attempt += 1
            try:
                ack = await sio.call(
                    "training_start",
                    {"roomId": ROOM_ID, "aiSlots": ai_slots},
                    timeout=10,
                )
                if ack and ack.get("ok"):
                    break
                raise RuntimeError(f"training_start returned not ok: {ack}")
            except Exception as exc:
                delay = min(TRAIN_CONNECT_RETRY_MAX_S, TRAIN_CONNECT_RETRY_BASE_S * (2 ** max(0, bootstrap_attempt - 1)))
                delay += random.uniform(0.0, max(0.0, TRAIN_CONNECT_RETRY_JITTER_S))
                log.warning(
                    "training_start bootstrap failed (attempt=%d, room=%s slots=%s): %s. retry in %.2fs",
                    bootstrap_attempt,
                    ROOM_ID,
                    ai_slots,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)
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

        self._ensure_audit_log_header()
        if TRAIN_EVAL_ONLY:
            self._append_audit_log(event="session_end")
            log.info(
                "evaluation session completed: session_transitions=%d session_episodes=%d total_transitions=%d total_episodes=%d (no model/checkpoint update)",
                self._session_transitions,
                self._session_episodes,
                self._total_transitions,
                self._total_episodes,
            )
        else:
            self._ensure_artifact_dirs()
            save_model(self.agent.online, MODEL_PATH, metadata=self._build_model_metadata())
            applied_updates = self._save_checkpoint()
            self._append_audit_log(event="session_end", applied_updates=applied_updates)

            try:
                await sio.call(
                    "training_complete",
                    {"roomId": ROOM_ID, "trainSteps": TRAIN_STEPS, "slot": AI_SLOT},
                    timeout=10,
                )
            except Exception:
                log.exception("failed to notify game server about training completion")

            log.info(
                "live training completed: session_transitions=%d session_episodes=%d total_transitions=%d total_episodes=%d model=%s checkpoint=%s",
                self._session_transitions,
                self._session_episodes,
                self._total_transitions,
                self._total_episodes,
                MODEL_PATH,
                TRAIN_CHECKPOINT_PATH,
            )
