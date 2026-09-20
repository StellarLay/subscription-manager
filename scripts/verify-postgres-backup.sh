#!/usr/bin/env bash
set -euo pipefail

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required}"

if [[ ! -r "$RESTIC_PASSWORD_FILE" ]]; then
  echo "Restic password file is not readable" >&2
  exit 1
fi

verify_dir="$(mktemp -d /var/tmp/subsio-restore-verify.XXXXXXXX)"
container_name="subsio-restore-verify-$$"
container_started=false

cleanup() {
  if [[ "$container_started" == true ]]; then
    docker rm -f "$container_name" >/dev/null 2>&1 || true
  fi
  if [[ "$verify_dir" == /var/tmp/subsio-restore-verify.* ]]; then
    rm -rf -- "$verify_dir"
  fi
}
trap cleanup EXIT

chmod 700 "$verify_dir"
echo "Restoring latest encrypted backup into an isolated test database"
restic restore latest --target "$verify_dir"

archive="$verify_dir/subsio-postgres.dump"
if [[ ! -s "$archive" ]]; then
  echo "Restored PostgreSQL archive is missing or empty" >&2
  exit 1
fi

# No published ports and no connection to production networks or volumes.
docker run --detach --rm \
  --name "$container_name" \
  --network none \
  --tmpfs /var/lib/postgresql/data:rw,size="${SUBSIO_VERIFY_DB_TMPFS_SIZE:-1g}" \
  --volume "$verify_dir:/backup:ro" \
  --env POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:17-alpine >/dev/null
container_started=true

for attempt in {1..60}; do
  # The image starts a temporary PostgreSQL during initdb. Wait for the final
  # PID 1 server, otherwise a readiness check can race its shutdown.
  if [[ "$(docker exec "$container_name" cat /proc/1/comm 2>/dev/null)" == postgres ]] && \
    docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  if (( attempt == 60 )); then
    echo "Isolated PostgreSQL did not become ready" >&2
    exit 1
  fi
  sleep 1
done

if ! docker exec "$container_name" test -r /backup/subsio-postgres.dump; then
  echo "Restored archive is not readable in the isolated container" >&2
  exit 1
fi

docker exec "$container_name" createdb -U postgres subsio_restore_check
docker exec "$container_name" pg_restore -U postgres \
  -d subsio_restore_check --no-owner --no-privileges --exit-on-error \
  /backup/subsio-postgres.dump

table_count="$(docker exec "$container_name" psql -U postgres \
  -d subsio_restore_check -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")"
if [[ ! "$table_count" =~ ^[1-9][0-9]*$ ]]; then
  echo "Restore verification found no application tables" >&2
  exit 1
fi

echo "Restore verification passed: $table_count application tables in an isolated database"
