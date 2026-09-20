#!/usr/bin/env bash
set -euo pipefail

# Run on the production VPS with RESTIC_* and S3 credentials supplied by systemd.
readonly project_dir="${SUBSIO_PROJECT_DIR:-/opt/subsio}"
readonly compose_file="$project_dir/compose.production.yaml"
readonly production_env="$project_dir/.env.production"

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required}"

if [[ ! -r "$RESTIC_PASSWORD_FILE" || ! -r "$production_env" || ! -r "$compose_file" ]]; then
  echo "Backup configuration or production Compose files are not readable" >&2
  exit 1
fi

# Reject overlapping manual/timer runs. The lock contains no backup data.
exec 9>/run/lock/subsio-postgres-backup.lock
if ! flock -n 9; then
  echo "Another Subsio PostgreSQL backup is already running" >&2
  exit 1
fi

echo "Starting encrypted PostgreSQL backup at $(date -u +%FT%TZ)"

# --stdin-from-command propagates pg_dump failures instead of saving an empty
# or truncated stream as a successful snapshot.
# The single-quoted command expands PostgreSQL variables inside the container.
# shellcheck disable=SC2016
restic backup \
  --tag subsio-postgres \
  --stdin-filename subsio-postgres.dump \
  --stdin-from-command -- \
  docker compose --env-file "$production_env" -f "$compose_file" \
    exec -T postgres sh -ec \
    'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges'

# Validate the repository before removing any older snapshots.
restic check
restic forget --tag subsio-postgres --keep-within 14d --keep-last 3 --prune

echo "PostgreSQL backup and retention completed at $(date -u +%FT%TZ)"
