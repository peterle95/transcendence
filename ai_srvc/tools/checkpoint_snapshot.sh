#!/usr/bin/env bash
set -euo pipefail

# Save/restore training checkpoints and model weights inside the ai_models Docker volume.
# Usage:
#   AI_srvc/tools/checkpoint_snapshot.sh save <snapshot_name>
#   AI_srvc/tools/checkpoint_snapshot.sh restore <snapshot_name>
#   AI_srvc/tools/checkpoint_snapshot.sh list
#   AI_srvc/tools/checkpoint_snapshot.sh delete <snapshot_name>
#
# Optional env vars:
#   AI_MODELS_VOLUME (default: transcendence_ai_models)
#   MODELS_ROOT (default: /app/models/train)
#   COMPOSE_FILE (default: <workspace>/docker-compose.yml)

AI_MODELS_VOLUME="${AI_MODELS_VOLUME:-transcendence_ai_models}"
MODELS_ROOT="${MODELS_ROOT:-/app/models/train}"
SNAPSHOTS_DIR="${MODELS_ROOT}/snapshots"
CHECKPOINT_FILE="${MODELS_ROOT}/dqn_training_checkpoint.pt"
MODEL_FILE="${MODELS_ROOT}/dqn_latest.pt"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${WORKSPACE_ROOT}/docker-compose.yml}"

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

compose_snapshot_path() {
  local name="$1"
  echo "${SNAPSHOTS_DIR}/docker-compose_${name}.yml"
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

run_in_volume() {
  local cmd="$1"
  docker run --rm -v "${AI_MODELS_VOLUME}:/app/models" alpine sh -c "$cmd"
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
  local snap_ckpt="${SNAPSHOTS_DIR}/${name}_checkpoint.pt"
  local snap_model="${SNAPSHOTS_DIR}/${name}_model.pt"
  local snap_meta="${SNAPSHOTS_DIR}/${name}.meta"
  local snap_compose
  snap_compose="$(compose_snapshot_path "$name")"

  run_in_volume "
    set -e
    test -f '${CHECKPOINT_FILE}'
    test -f '${MODEL_FILE}'
    mkdir -p '${SNAPSHOTS_DIR}'
    cp '${CHECKPOINT_FILE}' '${snap_ckpt}'
    cp '${MODEL_FILE}' '${snap_model}'
    echo 'saved_at_utc='\"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > '${snap_meta}'
    echo 'source_checkpoint=${CHECKPOINT_FILE}' >> '${snap_meta}'
    echo 'source_model=${MODEL_FILE}' >> '${snap_meta}'
  "

  run_with_workspace "
    set -e
    cp '/workspace/$(basename "$COMPOSE_FILE")' '${snap_compose}'
  "

  echo "Snapshot saved: ${name}"
  echo "Compose snapshot saved: ${snap_compose}"
}

restore_snapshot() {
  local name="$1"
  local snap_ckpt="${SNAPSHOTS_DIR}/${name}_checkpoint.pt"
  local snap_model="${SNAPSHOTS_DIR}/${name}_model.pt"
  local snap_compose
  snap_compose="$(compose_snapshot_path "$name")"

  run_in_volume "
    set -e
    test -f '${snap_ckpt}'
    test -f '${snap_model}'
    cp '${snap_ckpt}' '${CHECKPOINT_FILE}'
    cp '${snap_model}' '${MODEL_FILE}'
  "

  echo "Snapshot restored: ${name}"
  if [[ -f "$snap_compose" ]]; then
    printf "DIFFERENCE IN TRAINING PARAMETERS\n"
    echo "diff $COMPOSE_FILE $snap_compose"
    if ! diff "$COMPOSE_FILE" "$snap_compose"; then
      true
    fi
  else
    echo "Warning: compose snapshot not found for '${name}' (${snap_compose})"
	fi
}

list_snapshots() {
  run_in_volume "
    set -e
    if [ ! -d '${SNAPSHOTS_DIR}' ]; then
      echo 'No snapshots found.'
      exit 0
    fi
    ls -1 '${SNAPSHOTS_DIR}'/*_checkpoint.pt 2>/dev/null | sed 's#^.*/##' | sed 's/_checkpoint.pt$//' | sort -u
  "
}

delete_snapshot() {
  local name="$1"
  local snap_ckpt="${SNAPSHOTS_DIR}/${name}_checkpoint.pt"
  local snap_model="${SNAPSHOTS_DIR}/${name}_model.pt"
  local snap_meta="${SNAPSHOTS_DIR}/${name}.meta"
  local snap_compose
  snap_compose="$(compose_snapshot_path "$name")"

  run_in_volume "
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

  if docker run --rm -v "${AI_MODELS_VOLUME}:/app/models" alpine sh -c "test -f '${snap_compose}'" >/dev/null 2>&1; then
  ensure_compose_exists

    run_with_workspace "
      set +e
      diff '/workspace/$(basename "$COMPOSE_FILE")' '${snap_compose}'
      exit 0
    "
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
  run_with_workspace "
    set -e
    rm -f '${snap_compose}'
  "

main "$@"
