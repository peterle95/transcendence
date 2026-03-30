from __future__ import annotations

import os
import shutil
import sys
import tempfile
from datetime import datetime

CURRENT_DIR = os.path.dirname(__file__)
APP_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)

from model import load_model

SOURCE_PATH = os.getenv("PROMOTE_SOURCE_PATH", "/app/models/train/dqn_latest.pt")
TARGET_PATH = os.getenv("PROMOTE_TARGET_PATH", "/app/models/live/dqn_latest.pt")
VALIDATE = os.getenv("PROMOTE_VALIDATE", "true").lower() == "true"
CREATE_BACKUP = os.getenv("PROMOTE_BACKUP", "true").lower() == "true"


def ensure_parent(path: str) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def promote() -> None:
    if not os.path.exists(SOURCE_PATH):
        raise FileNotFoundError(f"Source model not found: {SOURCE_PATH}")

    ensure_parent(TARGET_PATH)
    target_dir = os.path.dirname(TARGET_PATH) or "."

    fd, tmp_path = tempfile.mkstemp(prefix=".promote-", suffix=".pt", dir=target_dir)
    os.close(fd)

    try:
        shutil.copy2(SOURCE_PATH, tmp_path)

        if VALIDATE:
            _ = load_model(tmp_path)

        if CREATE_BACKUP and os.path.exists(TARGET_PATH):
            timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
            backup_path = f"{TARGET_PATH}.bak.{timestamp}"
            shutil.copy2(TARGET_PATH, backup_path)
            print(f"[promote] backup created: {backup_path}")

        os.replace(tmp_path, TARGET_PATH)
        print(f"[promote] promoted model {SOURCE_PATH} -> {TARGET_PATH}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    promote()
