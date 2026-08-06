#!/usr/bin/env bash
#
# Restores a CMMS database backup dump into PostgreSQL.
#
# WARNING: restore is destructive — the target database is dropped and
# recreated from the dump (pg_restore --clean). Only run this on a database
# you intend to overwrite.
#
# Usage:
#   ./scripts/restore.sh /path/to/backup.dump [--yes]
#
# Configuration (environment variables; .env is auto-loaded when present):
#   RESTORE_DATABASE_URL  Target PostgreSQL URI. Defaults to DATABASE_URL
#                         (i.e. the same database the app uses — override
#                         unless you really mean to overwrite production).
#   POSTGRES_CONTAINER    Docker container name of the Postgres server
#                         (default: emerald-db). Used so pg_restore version
#                         matches the dump/server version.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }

usage() {
  echo "Usage: $0 /path/to/backup.dump [--yes]" >&2
  exit 1
}

FILE="${1:-${RESTORE_FILE:-}}"
CONFIRM=1
[[ "${2:-}" == "--yes" ]] && CONFIRM=0

[[ -n "$FILE" ]] || usage
[[ -f "$FILE" ]] || { log "ERROR: dump file not found: $FILE"; exit 1; }

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

TARGET_URL="${RESTORE_DATABASE_URL:-${DATABASE_URL:-}}"
[[ -n "$TARGET_URL" ]] || { log "ERROR: DATABASE_URL is not set"; exit 1; }

if [[ "$CONFIRM" -eq 1 ]]; then
  echo ""
  echo "This will DESTROY and re-create the target database:"
  echo "  $TARGET_URL"
  echo "from: $FILE"
  read -r -p "Type 'yes' to continue: " answer
  [[ "$answer" == "yes" ]] || { log "Aborted."; exit 1; }
fi

DB_USER="${TARGET_URL#*://}"
DB_USER="${DB_USER%%:*}"
DB_USER="${DB_USER%%@*}"
DB_NAME="${TARGET_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-emerald-db}"

restored=""
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
  log "Restoring via docker exec $POSTGRES_CONTAINER (pg_restore in server)"
  INNER_FILE="/tmp/cmms-restore-$(basename "$FILE")"
  if docker cp "$FILE" "$POSTGRES_CONTAINER:$INNER_FILE" \
    && docker exec "$POSTGRES_CONTAINER" \
      pg_restore --clean --if-exists --no-owner --no-privileges \
      -U "$DB_USER" -d "$DB_NAME" "$INNER_FILE" \
    && docker exec "$POSTGRES_CONTAINER" rm -f "$INNER_FILE"; then
    restored=1
  else
    docker exec "$POSTGRES_CONTAINER" rm -f "$INNER_FILE" >/dev/null 2>&1 || true
    log "WARN: docker restore failed, falling back to host pg_restore"
  fi
fi

if [[ -z "$restored" ]]; then
  log "Restoring via host pg_restore"
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$TARGET_URL" "$FILE"
fi

log "RESTORE_OK $FILE"
