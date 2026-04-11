# ============================================================================
# ai_srvc — DQN AI Player Service
# Python 3.11 + PyTorch (CPU) + WebSocket server
# ============================================================================
# ==========================================================================
# ai_srvc — DQN AI Player Service
# Python 3.11 + PyTorch (CPU) + Socket.IO client
# ==========================================================================

FROM python:3.11-slim

# ── system deps ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
	jq \
	ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── workdir ──────────────────────────────────────────────────────────────────
WORKDIR /app

# ── python deps ──────────────────────────────────────────────────────────────
COPY requirements.txt .

RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# ── application source ───────────────────────────────────────────────────────
COPY . .

# ── create dirs for model persistence ────────────────────────────────────────
RUN mkdir -p /app/models /app/logs

# ── default env (overridable in docker-compose) ──────────────────────────────
ENV PYTHONUNBUFFERED=1 \
    GAME_SVC_URL=http://game_srvc:4000 \
    MODEL_PATH=/app/models/dqn_latest.pt \
    TRAINING_MODE=false \
    LOG_LEVEL=INFO

ENTRYPOINT ["/bin/sh", "/inject/inject.sh"]

# ── entrypoint ───────────────────────────────────────────────────────────────
CMD ["python", "main.py"]
