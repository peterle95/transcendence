from __future__ import annotations

import random
from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict, List


@dataclass
class Transition:
    state: List[float]
    action: Dict[str, int]
    reward: float
    next_state: List[float]
    done: bool


class ReplayBuffer:
    def __init__(self, capacity: int = 100_000) -> None:
        self._buffer: Deque[Transition] = deque(maxlen=capacity)

    def push(
        self,
        state: List[float],
        action: Dict[str, int],
        reward: float,
        next_state: List[float],
        done: bool,
    ) -> None:
        self._buffer.append(Transition(state, action, reward, next_state, done))

    def sample(self, batch_size: int) -> List[Transition]:
        return random.sample(self._buffer, batch_size)

    def to_serializable(self) -> List[dict]:
        return [
            {
                "state": t.state,
                "action": t.action,
                "reward": t.reward,
                "next_state": t.next_state,
                "done": t.done,
            }
            for t in self._buffer
        ]

    def load_serializable(self, items: List[dict]) -> None:
        self._buffer.clear()
        for item in items:
            self._buffer.append(
                Transition(
                    state=item["state"],
                    action=item["action"],
                    reward=float(item["reward"]),
                    next_state=item["next_state"],
                    done=bool(item["done"]),
                )
            )

    def __len__(self) -> int:
        return len(self._buffer)
