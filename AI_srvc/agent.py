from __future__ import annotations

import os
import random
from dataclasses import dataclass
from typing import Dict, Optional

import torch
import torch.nn.functional as F

from model import ACTION_CHANNELS, STATE_SIZE, build_model_pair
from replay_buffer import ReplayBuffer


@dataclass
class AgentConfig:
    device: str = "cpu"
    gamma: float = 0.99
    lr: float = 5e-4
    batch_size: int = 64 #specifies the number of transitions (state, action, reward, next state tuples) sampled from the replay buffer for each gradient update.
    epsilon_start: Optional[float] = None
    epsilon_end: Optional[float] = None
    epsilon_decay_steps: Optional[int] = None
    target_update_every: int = 1_000
    replay_capacity: int = 100_000


class DQNAgent:
    def __init__(self, config: Optional[AgentConfig] = None) -> None:
        self.cfg = config or AgentConfig()
        self._apply_env_overrides()
        assert self.cfg.epsilon_start is not None
        assert self.cfg.epsilon_end is not None
        assert self.cfg.epsilon_decay_steps is not None
        self._epsilon_start = float(self.cfg.epsilon_start)
        self._epsilon_end = float(self.cfg.epsilon_end)
        self._epsilon_decay_steps = int(self.cfg.epsilon_decay_steps)
        self.device = self.cfg.device

        self.online, self.target = build_model_pair(device=self.device)
        self.optimizer = torch.optim.Adam(self.online.parameters(), lr=self.cfg.lr)
        self.replay = ReplayBuffer(self.cfg.replay_capacity)

        self.train_steps = 0
        self.epsilon: float = self._epsilon_start

    def _apply_env_overrides(self) -> None:
        """Allow container/runtime overrides without editing source defaults."""
        if (v := os.getenv("DQN_DEVICE")):
            self.cfg.device = v
        if (v := os.getenv("DQN_GAMMA")):
            self.cfg.gamma = float(v)
        if (v := os.getenv("DQN_LR")):
            self.cfg.lr = float(v)
        if (v := os.getenv("DQN_BATCH_SIZE")):
            self.cfg.batch_size = int(v)
        if (v := os.getenv("DQN_EPSILON_START")):
            self.cfg.epsilon_start = float(v)
        if (v := os.getenv("DQN_EPSILON_END")):
            self.cfg.epsilon_end = float(v)
        if (v := os.getenv("DQN_EPSILON_DECAY_STEPS")):
            self.cfg.epsilon_decay_steps = int(v)
        if (v := os.getenv("DQN_TARGET_UPDATE_EVERY")):
            self.cfg.target_update_every = int(v)
        if (v := os.getenv("DQN_REPLAY_CAPACITY")):
            self.cfg.replay_capacity = int(v)

        if self.cfg.epsilon_start is None:
            raise RuntimeError("Missing required DQN epsilon config: set DQN_EPSILON_START or pass AgentConfig.epsilon_start")
        if self.cfg.epsilon_end is None:
            raise RuntimeError("Missing required DQN epsilon config: set DQN_EPSILON_END or pass AgentConfig.epsilon_end")
        if self.cfg.epsilon_decay_steps is None:
            raise RuntimeError("Missing required DQN epsilon config: set DQN_EPSILON_DECAY_STEPS or pass AgentConfig.epsilon_decay_steps")

    def _update_epsilon(self) -> None:
        t = min(self.train_steps, self._epsilon_decay_steps)
        frac = t / max(1, self._epsilon_decay_steps)
        self.epsilon = self._epsilon_start + frac * (self._epsilon_end - self._epsilon_start)

    def select_action(self, state: torch.Tensor, explore: bool = False) -> Dict[str, int]:
        if explore and random.random() < self.epsilon:
            return {k: random.randrange(v) for k, v in ACTION_CHANNELS.items()}
        return self.online.get_action(state.to(self.device))

    def remember(
        self,
        state: torch.Tensor,
        action: Dict[str, int],
        reward: float,
        next_state: torch.Tensor,
        done: bool,
    ) -> None:
        self.replay.push(
            state.tolist(),
            action,
            float(reward),
            next_state.tolist(),
            bool(done),
        )

    def checkpoint_state(self) -> dict:
        return {
            "online_state_dict": self.online.state_dict(),
            "target_state_dict": self.target.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "epsilon": float(self.epsilon),
            "train_steps": int(self.train_steps),
            "replay": self.replay.to_serializable(),
            "applied_runtime_config_updates": {},
        }

    def restore_from_checkpoint(self, state: dict) -> None:
        self.online.load_state_dict(state["online_state_dict"])

        if "target_state_dict" in state:
            self.target.load_state_dict(state["target_state_dict"])
        else:
            self.target.update_from(self.online)

        if "optimizer_state_dict" in state:
            self.optimizer.load_state_dict(state["optimizer_state_dict"])

        self.train_steps = int(state.get("train_steps", 0))

        # Keep checkpoint train progress but always derive epsilon from the
        # currently active schedule (typically env-driven) to avoid stale
        # epsilon values after config changes.
        self._update_epsilon()

        replay_data = state.get("replay", [])
        if isinstance(replay_data, list):
            self.replay.load_serializable(replay_data)

    def train_step(self) -> Optional[float]:
        if len(self.replay) < self.cfg.batch_size:
            return None

        batch = self.replay.sample(self.cfg.batch_size)

        states = torch.tensor([t.state for t in batch], dtype=torch.float32, device=self.device)
        next_states = torch.tensor([t.next_state for t in batch], dtype=torch.float32, device=self.device)
        rewards = torch.tensor([t.reward for t in batch], dtype=torch.float32, device=self.device)
        dones = torch.tensor([t.done for t in batch], dtype=torch.float32, device=self.device)

        online_q = self.online(states)
        target_q_next = self.target(next_states)

        total_loss = torch.tensor(0.0, dtype=torch.float32, device=self.device)
        for channel_name in ACTION_CHANNELS.keys():
            actions = torch.tensor([t.action[channel_name] for t in batch], dtype=torch.long, device=self.device)
            chosen_q = online_q[channel_name].gather(1, actions.unsqueeze(1)).squeeze(1)
            next_q = target_q_next[channel_name].max(dim=1).values.detach()
            target = rewards + (1.0 - dones) * self.cfg.gamma * next_q
            total_loss = total_loss + F.smooth_l1_loss(chosen_q, target)

        self.optimizer.zero_grad()
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(self.online.parameters(), max_norm=10.0)
        self.optimizer.step()

        self.train_steps += 1
        self._update_epsilon()

        if self.train_steps % self.cfg.target_update_every == 0:
            self.target.update_from(self.online)

        return float(total_loss.item())

    @property
    def ready(self) -> bool:
        return len(self.replay) >= self.cfg.batch_size


def random_state_tensor() -> torch.Tensor:
    return torch.rand(STATE_SIZE, dtype=torch.float32)