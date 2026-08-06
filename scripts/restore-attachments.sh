#!/usr/bin/env bash
#
# Restores the CMMS MinIO attachments bucket from the backups bucket.
#
# WARNING: restore overwrites objects in the target bucket with the versions in
# the backup (mc mirror --overwrite). It does NOT delete extra objects, so keys
# uploaded after the backup are preserved. Run a test-restore into a scratch
# bucket before a real restore:
#
#   ATTACHMENTS_RESTORE_TARGET=max-attachments-restore-test \
#     ./scripts/restore-attachments.sh --yes
#
# Usage:
#   ./scripts/restore-attachments.sh [--yes]
#
# Configuration (environment variables; .env is auto-loaded when present):
#   MINIO_ENDPOINT          MinIO/S3 endpoint        (default: from .env)
#   MAX_MINIO_ACCESS_KEY    MinIO access key         (default: from .env)
#   MAX_MINIO_SECRET_KEY    MinIO secret key         (default: from .env)
#   MINIO_BUCKET_NAME       restore target bucket    (default: max-attachments)
#   MINIO_BACKUP_BUCKET     backup source bucket     (default: max-backups)
#   ATTACHMENTS_RESTORE_TARGET  overrides the target bucket (for test-restores)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }

CONFIRM=1
[[ "${1:-}" == "--yes" ]] && CONFIRM=0

# Load .env values but never override variables already set in the environment
# (so e.g. MAX_MINIO_ACCESS_KEY=root-creds ./script works for test-restores).
if [[ -f .env ]]; then
  set -a
  while IFS='=' read -r key val; do
    case "$key" in ''|\#*) continue ;; esac
    if [[ -z "${!key:-}" ]]; then
      export "$key"="$val"
    fi
  done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env)
  set +a
fi

if [[ -z "${MINIO_ENDPOINT:-}" || -z "${MAX_MINIO_ACCESS_KEY:-}" || -z "${MAX_MINIO_SECRET_KEY:-}" ]]; then
  log "ERROR: MINIO_ENDPOINT, MAX_MINIO_ACCESS_KEY and MAX_MINIO_SECRET_KEY must be set"
  exit 1
fi

if ! command -v mc >/dev/null 2>&1; then
  log "ERROR: 'mc' (MinIO Client) is not installed"
  exit 1
fi

BACKUP_BUCKET="${MINIO_BACKUP_BUCKET:-max-backups}"
SRC_PREFIX="${ATTACHMENTS_RESTORE_SOURCE:-$BACKUP_BUCKET/attachments/}"
TARGET="${ATTACHMENTS_RESTORE_TARGET:-${MINIO_BUCKET_NAME:-max-attachments}}"

if [[ "$CONFIRM" -eq 1 ]]; then
  echo ""
  echo "This will OVERWRITE objects in the target bucket:"
  echo "  $TARGET"
  echo "with the contents of: $SRC_PREFIX"
  echo "Objects not present in the backup are left untouched."
  read -r -p "Type 'yes' to continue: " answer
  [[ "$answer" == "yes" ]] || { log "Aborted."; exit 1; }
fi

ALIAS="cmms-att-restore-$$"
cleanup_alias() {
  if [[ -n "${ALIAS:-}" ]]; then
    mc alias remove "$ALIAS" >/dev/null 2>&1 || true
  fi
}
trap cleanup_alias EXIT

if ! mc alias set "$ALIAS" "$MINIO_ENDPOINT" \
  "$MAX_MINIO_ACCESS_KEY" "$MAX_MINIO_SECRET_KEY" >/dev/null; then
  log "ERROR: mc alias set failed — cannot reach MinIO at $MINIO_ENDPOINT"
  exit 1
fi

log "Restoring $SRC_PREFIX -> $TARGET"
mc mirror --overwrite --quiet "$ALIAS/$SRC_PREFIX" "$ALIAS/$TARGET"

# mc mirror can exit 0 even when it hit Access Denied (e.g. the credential lacks
# rights on the target), so verify the copy actually happened by comparing counts.
count_objects() {
  mc ls --recursive "$1" 2>/dev/null | wc -l
}
src_count="$(count_objects "$ALIAS/$SRC_PREFIX")" || {
  log "ERROR: cannot list backup source $SRC_PREFIX — Access Denied or policy problem?"
  exit 1
}
dest_count="$(count_objects "$ALIAS/$TARGET")" || {
  log "ERROR: cannot list target bucket $TARGET — Access Denied or policy problem?"
  log "TIP: $MAX_MINIO_ACCESS_KEY can only write to max-attachments; test-restores into a scratch"
  log "     bucket must use the MinIO root/admin credentials (MINIO_ROOT_USER / MINIO_ROOT_PASSWORD)."
  exit 1
}
log "Objects: source=$src_count target=$dest_count"
if [[ "$dest_count" -lt "$src_count" ]]; then
  log "ERROR: restore is missing objects (source=$src_count target=$dest_count)"
  log "TIP: $MAX_MINIO_ACCESS_KEY can only write to max-attachments; test-restores into a scratch"
  log "     bucket must use the MinIO root/admin credentials (MINIO_ROOT_USER / MINIO_ROOT_PASSWORD)."
  exit 1
fi
log "RESTORE_OK $TARGET"
