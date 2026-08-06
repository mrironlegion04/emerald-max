#!/usr/bin/env bash
#
# Mirrors the CMMS MinIO attachments bucket to a local directory and (optionally)
# to the backups bucket. This covers the object storage that the database dump
# (backup.sh) does NOT contain — without this, uploaded attachments are lost if
# the MinIO volume or host disk fails.
#
# Usage:
#   ./scripts/backup-attachments.sh                        # local mirror + MinIO upload
#   DISABLE_MINIO_UPLOAD=1 ./scripts/backup-attachments.sh # local mirror only
#
# Configuration (environment variables; .env is auto-loaded when present):
#   MINIO_ENDPOINT         MinIO/S3 endpoint        (default: from .env)
#   MAX_MINIO_ACCESS_KEY   MinIO access key         (default: from .env)
#   MAX_MINIO_SECRET_KEY   MinIO secret key         (default: from .env)
#   MINIO_BUCKET_NAME      source bucket            (default: max-attachments)
#   MINIO_BACKUP_BUCKET    remote backup bucket     (default: max-backups)
#   BACKUP_DIR             local backup directory   (default: ./backups)
#   DISABLE_MINIO_UPLOAD   1 to skip the remote mirror entirely
#
# Notes:
#   - The app credential (max_user) needs BOTH policies: read access to
#     MINIO_BUCKET_NAME and read/write access to MINIO_BACKUP_BUCKET. See
#     Docs/Minio.md and ~/emerald/services/minio/policies/.
#   - `mc mirror` is incremental: only new/changed objects are transferred, and
#     objects deleted upstream are kept locally (no --remove), so this doubles as
#     a short deletion-retention window.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }

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

SRC_BUCKET="${MINIO_BUCKET_NAME:-max-attachments}"
BACKUP_BUCKET="${MINIO_BACKUP_BUCKET:-max-backups}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
LOCAL_MIRROR="${BACKUP_DIR}/attachments"
mkdir -p "$LOCAL_MIRROR"

ALIAS="cmms-att-$$"
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

log "Mirroring $SRC_BUCKET -> $LOCAL_MIRROR"
mc mirror --quiet "$ALIAS/$SRC_BUCKET" "$LOCAL_MIRROR"

# mc mirror can exit 0 even when it hit Access Denied (e.g. a broken policy),
# so verify the copy actually happened by comparing object counts.
count_objects() {
  mc ls --recursive "$1" 2>/dev/null | wc -l
}
src_count="$(count_objects "$ALIAS/$SRC_BUCKET")" || {
  log "ERROR: cannot list source bucket $SRC_BUCKET — Access Denied or policy problem?"
  exit 1
}
local_count="$(find "$LOCAL_MIRROR" -type f | wc -l)"
log "Objects: source=$src_count local=$local_count"
if [[ "$local_count" -lt "$src_count" ]]; then
  log "ERROR: local mirror is missing objects (source=$src_count local=$local_count) — policy or read access problem?"
  exit 1
fi

if [[ "${DISABLE_MINIO_UPLOAD:-0}" != "1" ]]; then
  log "Mirroring $LOCAL_MIRROR -> $BACKUP_BUCKET/attachments/"
  mc mirror --quiet "$LOCAL_MIRROR" "$ALIAS/$BACKUP_BUCKET/attachments/"
  remote_count="$(count_objects "$ALIAS/$BACKUP_BUCKET/attachments/")" || {
    log "ERROR: cannot list backup bucket $BACKUP_BUCKET — Access Denied or policy problem?"
    exit 1
  }
  log "Objects: local=$local_count remote=$remote_count"
  if [[ "$remote_count" -lt "$local_count" ]]; then
    log "ERROR: remote mirror is missing objects (local=$local_count remote=$remote_count) — policy or write access problem?"
    exit 1
  fi
  log "UPLOAD_OK $BACKUP_BUCKET/attachments/"
else
  log "Skipped remote upload (DISABLE_MINIO_UPLOAD=1)"
fi

log "Done (local mirror: $LOCAL_MIRROR)"
