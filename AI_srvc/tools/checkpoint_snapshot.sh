#!/usr/bin/env bash
set -euo pipefail

# Save/restore training checkpoints and model weights inside the ai_models Docker volume.
# Usage:
#   AI_srvc/tools/checkpoint_snapshot.sh save <snapshot_name>
#   AI_srvc/tools/checkpoint_snapshot.sh restore <snapshot_name>
#   AI_srvc/tools/checkpoint_snapshot.sh list
#   AI_srvc/tools/checkpoint_snapshot.sh delete <snapshot_name>

AI_MODELS_VOLUME="${AI_MODELS_VOLUME:-transcendence_ai_models}"
MODELS_ROOT="${MODELS_ROOT:-/app/models/train}"
SNAPSHOTS_DIR="${MODELS_ROOT}/snapshots"
CHECKPOINT_FILE="${MODELS_ROOT}/dqn_training_checkpoint.pt"
MODEL_FILE="${MODELS_ROOT}/dqn_latest.pt"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${WORKSPACE_ROOT}/docker-compose.yml}"
COMPOSE_SNAPSHOT_DIR="${COMPOSE_SNAPSHOT_DIR:-${SCRIPT_DIR}/checkpoint_snapshot}"

usage() {
  cat <<'EOF'
Usage:
  checkpoint_snapshot.sh save <snapshot_name>
  checkpoint_snapshot.sh restore <snapshot_name>
  checkpoint_snapshot.sh list
  checkpoint_snapshot.sh delete <snapshot_name>

Examples:
  checkpoint_snapshot.sh save good_wr_55
  checkpoint_snapshot.sh restore good_wr_55
EOF
}

require_snapshot_name() {
  local snapshot_name="${1:-}"

  if [[ -z "$snapshot_name" ]]; then
    echo "Error: snapshot_name is required" >&2
    usage
    exit 1
  fi

  if [[ ! "$snapshot_name" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "Error: invalid snapshot_name '$snapshot_name'" >&2
    echo "Allowed characters: letters, numbers, dot, underscore, dash." >&2
    exit 1
  fi
}

ensure_compose_file() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "Error: docker-compose file not found: $COMPOSE_FILE" >&2
    exit 1
  fi
}

ensure_snapshot_dir() {
  mkdir -p "$COMPOSE_SNAPSHOT_DIR"
}

compose_snapshot_file() {
  local snapshot_name="$1"
  echo "${COMPOSE_SNAPSHOT_DIR}/docker-compose_${snapshot_name}.yml"
}

docker_volume_exec() {
  local script="$1"
  docker run --rm -v "${AI_MODELS_VOLUME}:/app/models" alpine:3.20 sh -c "$script"
}

save_snapshot() {
  local snapshot_name="$1"
  local compose_snapshot
  compose_snapshot="$(compose_snapshot_file "$snapshot_name")"

  docker_volume_exec "
    set -eu
    test -f '${CHECKPOINT_FILE}'
    test -f '${MODEL_FILE}'
    mkdir -p '${SNAPSHOTS_DIR}'
    cp '${CHECKPOINT_FILE}' '${SNAPSHOTS_DIR}/${snapshot_name}_checkpoint.pt'
    cp '${MODEL_FILE}' '${SNAPSHOTS_DIR}/${snapshot_name}_model.pt'
  "

  ensure_snapshot_dir
  cp "$COMPOSE_FILE" "$compose_snapshot"

  printf 'Snapshot saved: %s\n' "$snapshot_name"
  printf 'Compose snapshot saved: %s\n' "$compose_snapshot"
}

restore_snapshot() {
  local snapshot_name="$1"
  local compose_snapshot
  compose_snapshot="$(compose_snapshot_file "$snapshot_name")"

  docker_volume_exec "
    set -eu
    test -f '${SNAPSHOTS_DIR}/${snapshot_name}_checkpoint.pt'
    test -f '${SNAPSHOTS_DIR}/${snapshot_name}_model.pt'
    cp '${SNAPSHOTS_DIR}/${snapshot_name}_checkpoint.pt' '${CHECKPOINT_FILE}'
    cp '${SNAPSHOTS_DIR}/${snapshot_name}_model.pt' '${MODEL_FILE}'
  "

  printf 'Snapshot restored: %s\n' "$snapshot_name"
  if [[ -f "$compose_snapshot" ]]; then
    printf 'DIFFERENCE IN TRAINING PARAMETERS\n'
    diff "$COMPOSE_FILE" "$compose_snapshot" || true
  else
    printf 'Warning: compose snapshot not found for %s\n' "$snapshot_name" >&2
    printf 'Expected file: %s\n' "$compose_snapshot" >&2
  fi
}

list_snapshots() {
  docker_volume_exec "
    set -eu
    if [ ! -d '${SNAPSHOTS_DIR}' ]; then
      exit 0
    fi
    ls -1 '${SNAPSHOTS_DIR}'/*_checkpoint.pt 2>/dev/null | sed 's#.*/##' | sed 's/_checkpoint.pt$//' | sort -u
  "
}

delete_snapshot() {
  local snapshot_name="$1"
  local compose_snapshot
  compose_snapshot="$(compose_snapshot_file "$snapshot_name")"

  docker_volume_exec "
    set -eu
    rm -f '${SNAPSHOTS_DIR}/${snapshot_name}_checkpoint.pt'
    rm -f '${SNAPSHOTS_DIR}/${snapshot_name}_model.pt'
  "

  rm -f "$compose_snapshot"

  printf 'Snapshot deleted: %s\n' "$snapshot_name"
}

main() {
  local action="${1:-}"
  local snapshot_name="${2:-}"

  if [[ -z "$action" ]]; then
    usage
    exit 1
  fi

  ensure_compose_file

  case "$action" in
    save)
      require_snapshot_name "$snapshot_name"
      ensure_snapshot_dir
      save_snapshot "$snapshot_name"
      ;;
    restore)
      require_snapshot_name "$snapshot_name"
      restore_snapshot "$snapshot_name"
      ;;
    list)
      list_snapshots
      ;;
    delete)
      require_snapshot_name "$snapshot_name"
      delete_snapshot "$snapshot_name"
      ;;
    *)
      echo "Error: unknown action '$action'" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"