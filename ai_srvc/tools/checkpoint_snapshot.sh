#!/usr/bin/env bash
set -euo pipefail

# Save/restore training checkpoints and model weights.
# Checkpoint/model/meta snapshots are stored in the ai_models volume under:
#   ${MODELS_ROOT}/snapshots
# Compose snapshots are stored on the host workspace under:
#   AI_srvc/tools/checkpoint_snapshots
#
# Usage:
#   AI_srvc/tools/checkpoint_snapshot.sh save <snapshot_name>
#   AI_srvc/tools/checkpoint_snapshot.sh restore <snapshot_name>
#   AI_srvc/tools/checkpoint_snapshot.sh list
#   AI_srvc/tools/checkpoint_snapshot.sh delete <snapshot_name>
#
# Optional env vars:
#   AI_MODELS_VOLUME (default: transcendence_ai_models)
#   MODELS_ROOT (default: /app/models/train)
#   HOST_COMPOSE_SNAPSHOTS_DIR (default: <workspace>/AI_srvc/tools/checkpoint_snapshots)
#   COMPOSE_FILE (default: <workspace>/docker-compose.yml)

AI_MODELS_VOLUME="${AI_MODELS_VOLUME:-transcendence_ai_models}"
MODELS_ROOT="${MODELS_ROOT:-/app/models/train}"
CHECKPOINT_FILE="${MODELS_ROOT}/dqn_training_checkpoint.pt"
MODEL_FILE="${MODELS_ROOT}/dqn_latest.pt"
SNAPSHOTS_DIR="${MODELS_ROOT}/snapshots"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${WORKSPACE_ROOT}/docker-compose.yml}"
HOST_COMPOSE_SNAPSHOTS_DIR="${HOST_COMPOSE_SNAPSHOTS_DIR:-${WORKSPACE_ROOT}/AI_srvc/tools/checkpoint_snapshots}"

usage() {
  cat <<'EOU'
Usage:
  checkpoint_snapshot.sh save <snapshot_name>
  checkpoint_snapshot.sh restore <snapshot_name>
  checkpoint_snapshot.sh list
  checkpoint_snapshot.sh delete <snapshot_name>

Examples:
  checkpoint_snapshot.sh save wr55_stable
  checkpoint_snapshot.sh list
  checkpoint_snapshot.sh restore wr55_stable
EOU
}

checkpoint_snapshot_path() {
  local name="$1"
  echo "${SNAPSHOTS_DIR}/${name}_checkpoint.pt"
}

model_snapshot_path() {
  local name="$1"
  echo "${SNAPSHOTS_DIR}/${name}_model.pt"
}

meta_snapshot_path() {
  local name="$1"
  echo "${SNAPSHOTS_DIR}/${name}.meta"
}

compose_snapshot_path() {
  local name="$1"
  echo "${HOST_COMPOSE_SNAPSHOTS_DIR}/docker-compose_${name}.yml"
}

require_name() {
  local name="${1:-}"
  if [[ -z "$name" ]]; then
    echo "Error: snapshot_name is required" >&2
    usage
    exit 1
  fi
  if [[ ! "$name" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "Error: invalid snapshot_name '$name'. Allowed: letters, numbers, dot, underscore, dash." >&2
    exit 1
  fi
}

ensure_volume_exists() {
  if ! docker volume inspect "$AI_MODELS_VOLUME" >/dev/null 2>&1; then
    echo "Error: Docker volume '$AI_MODELS_VOLUME' not found." >&2
    echo "Tip: set AI_MODELS_VOLUME if your compose project uses a different volume name." >&2
    exit 1
  fi
}

ensure_compose_exists() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "Error: compose file not found at '$COMPOSE_FILE'" >&2
    exit 1
  fi
}

ensure_host_compose_snapshots_dir() {
  mkdir -p "$HOST_COMPOSE_SNAPSHOTS_DIR"
}

run_with_workspace() {
  local cmd="$1"
  docker run --rm \
    -v "${AI_MODELS_VOLUME}:/app/models" \
    -v "${WORKSPACE_ROOT}:/workspace" \
    -w /workspace \
    alpine sh -c "$cmd"
}

save_snapshot() {
  local name="$1"
  local snap_ckpt
  local snap_model
  local snap_meta
  local snap_compose

  snap_ckpt="$(checkpoint_snapshot_path "$name")"
  snap_model="$(model_snapshot_path "$name")"
  snap_meta="$(meta_snapshot_path "$name")"
  snap_compose="$(compose_snapshot_path "$name")"

  ensure_host_compose_snapshots_dir

  run_with_workspace "
    set -e
    test -f '${CHECKPOINT_FILE}'
    test -f '${MODEL_FILE}'
    mkdir -p '${SNAPSHOTS_DIR}'
    cp '${CHECKPOINT_FILE}' '${snap_ckpt}'
    cp '${MODEL_FILE}' '${snap_model}'
  "

  {
    echo "saved_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "source_checkpoint=${CHECKPOINT_FILE}"
    echo "source_model=${MODEL_FILE}"
    echo "source_compose=${COMPOSE_FILE}"
  } > "$snap_meta"

  cp "$COMPOSE_FILE" "$snap_compose"

  echo "Snapshot saved: ${name}"
  echo "Saved checkpoint/model/meta in volume path: ${SNAPSHOTS_DIR}"
  echo "Saved compose snapshot on host: ${snap_compose}"
}

restore_snapshot() {
  local name="$1"
  local snap_ckpt
  local snap_model
  local snap_compose

  snap_ckpt="$(checkpoint_snapshot_path "$name")"
  snap_model="$(model_snapshot_path "$name")"
  snap_compose="$(compose_snapshot_path "$name")"

  run_with_workspace "
    set -e
    test -f '${snap_ckpt}'
    test -f '${snap_model}'
    cp '${snap_ckpt}' '${CHECKPOINT_FILE}'
    cp '${snap_model}' '${MODEL_FILE}'
  "

  echo "Snapshot restored: ${name}"
  if [[ -f "$snap_compose" ]]; then
    echo "DIFFERENCE IN TRAINING PARAMETERS"
    echo "diff $COMPOSE_FILE $snap_compose"
    diff "$COMPOSE_FILE" "$snap_compose" || true
  else
    echo "Warning: compose snapshot not found for '${name}' (${snap_compose})"
  fi
}

list_snapshots() {
  run_with_workspace "
    set -e
    if [ ! -d '${SNAPSHOTS_DIR}' ]; then
      echo 'No snapshots found.'
      exit 0
    fi

    if ! ls -1 '${SNAPSHOTS_DIR}'/*_checkpoint.pt >/dev/null 2>&1; then
      echo 'No snapshots found.'
      exit 0
    fi

    ls -1 '${SNAPSHOTS_DIR}'/*_checkpoint.pt | sed 's#^.*/##' | sed 's/_checkpoint.pt$//' | sort -u
  "
}

delete_snapshot() {
  local name="$1"
  local snap_ckpt
  local snap_model
  local snap_meta
  local snap_compose

  snap_ckpt="$(checkpoint_snapshot_path "$name")"
  snap_model="$(model_snapshot_path "$name")"
  snap_meta="$(meta_snapshot_path "$name")"
  snap_compose="$(compose_snapshot_path "$name")"

  run_with_workspace "
    set -e
    rm -f '${snap_ckpt}' '${snap_model}' '${snap_meta}'
  "

  rm -f "$snap_compose"

  echo "Snapshot deleted: ${name}"
}

main() {
  local action="${1:-}"
  local name="${2:-}"

  if [[ -z "$action" ]]; then
    usage
    exit 1
  fi

  ensure_volume_exists
  ensure_compose_exists

  case "$action" in
    save)
      require_name "$name"
      save_snapshot "$name"
      ;;
    restore)
      require_name "$name"
      restore_snapshot "$name"
      ;;
    list)
      list_snapshots
      ;;
    delete)
      require_name "$name"
      delete_snapshot "$name"
      ;;
    *)
      echo "Error: unknown action '$action'" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
