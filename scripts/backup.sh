#!/usr/bin/env bash
#
# Backs up the CMMS PostgreSQL database, uploads the dump to MinIO (S3-compatible),
# and prunes local backups older than the retention window.
#
# Usage:
#   ./scripts/backup.sh                              # dump + upload + prune
#   DISABLE_MINIO_UPLOAD=1 ./scripts/backup.sh       # local only
#
# Configuration (environment variables; .env is auto-loaded when present):
#   DATABASE_URL           PostgreSQL connection URI (default: from .env)
#   BACKUP_DIR             local backup directory   (default: ./backups)
#   BACKUP_RETENTION_DAYS  days of local backups to keep (default: 14)
#   POSTGRES_CONTAINER     Docker container name of the Postgres server
#                          (default: emerald-db). Used so pg_dump version
#                          matches the server version.
#   MINIO_ENDPOINT         MinIO/S3 endpoint        (default: from .env)
#   MAX_MINIO_ACCESS_KEY   MinIO access key         (default: from .env)
#   MAX_MINIO_SECRET_KEY   MinIO secret key         (default: from .env)
#   MINIO_BACKUP_BUCKET    bucket for backups       (default: max-backups)
#   DISABLE_MINIO_UPLOAD   1 to skip the MinIO upload entirely
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }

# Load .env without overriding already-exported variables.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-emerald-db}"

STAMP="$(date +%Y%m%d-%H%M%S)"
FILENAME="cmms-${STAMP}.dump"
OUT="${BACKUP_DIR}/${FILENAME}"
mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  log "ERROR: DATABASE_URL is not set"
  exit 1
fi

# Parse user and database name out of the URI for use inside the container.
DB_USER="${DATABASE_URL#*://}"
DB_USER="${DB_USER%%:*}"
DB_USER="${DB_USER%%@*}"
DB_NAME="${DATABASE_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"

duped=""
container_running=""
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
  container_running=1
fi

if [[ -n "$container_running" ]]; then
  log "Dumping via docker exec $POSTGRES_CONTAINER (pg_dump in server)"
  if docker exec "$POSTGRES_CONTAINER" \
    pg_dump --format=custom --no-owner -U "$DB_USER" -d "$DB_NAME" \
    -f "/tmp/${FILENAME}" \
    && docker cp "$POSTGRES_CONTAINER:/tmp/${FILENAME}" "$OUT" \
    && docker exec "$POSTGRES_CONTAINER" rm -f "/tmp/${FILENAME}"; then
    duped=1
  else
    docker exec "$POSTGRES_CONTAINER" rm -f "/tmp/${FILENAME}" >/dev/null 2>&1 || true
    log "WARN: docker dump failed, falling back to host pg_dump"
  fi
fi

if [[ -z "$duped" ]]; then
  log "Dumping via host pg_dump"
  pg_dump --format=custom --no-owner -f "$OUT" "$DATABASE_URL"
fi

if [[ ! -s "$OUT" ]]; then
  log "ERROR: dump file is empty: $OUT"
  exit 1
fi

log "DUMP_OK $OUT ($(du -h "$OUT" | cut -f1))"

cleanup_alias() {
  if [[ -n "${ALIAS:-}" ]]; then
    mc alias remove "$ALIAS" >/dev/null 2>&1 || true
  fi
}
trap cleanup_alias EXIT

if [[ "${DISABLE_MINIO_UPLOAD:-0}" != "1" && -n "${MINIO_ENDPOINT:-}" ]]; then
  BUCKET="${MINIO_BACKUP_BUCKET:-max-backups}"
  ALIAS="cmms-backup-$$"
  if ! mc alias set "$ALIAS" "$MINIO_ENDPOINT" \
    "${MAX_MINIO_ACCESS_KEY:-}" "${MAX_MINIO_SECRET_KEY:-}" >/dev/null; then
    log "ERROR: mc alias set failed — cannot reach MinIO at $MINIO_ENDPOINT"
    exit 1
  fi
  mc mb --ignore-existing "$ALIAS/$BUCKET" >/dev/null 2>&1 || true
  mc cp --quiet "$OUT" "$ALIAS/$BUCKET/$FILENAME"
  log "UPLOAD_OK $BUCKET/$FILENAME"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'cmms-*.dump' -mtime "+$RETENTION_DAYS" -delete
log "Done (keeping ${RETENTION_DAYS} days of local backups)"
