#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/opt/central-cop-escalonamentos
cd "$root"
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
image=node:24.21.0-alpine3.23@sha256:9ec4a2e289874ed0d722e1772ec2de45d2801541db8612f3638b26f128c69ac2
encrypt() {
 docker run --rm -i --network none --read-only --cap-drop ALL --security-opt no-new-privileges --memory 128m --cpus .25 \
  -v "$root/backups:/backups" -v "$root/.backup-key:/run/secrets/cop-backup-key:ro" \
  -v "$root/deploy/backup.mjs:/app/backup.mjs:ro" "$image" node /app/backup.mjs encrypt "$1"
}
docker exec central-cop-escalonamentos-db-1 pg_dump -U postgres -d postgres --format=custom --no-owner --no-acl | encrypt "$stamp.database.enc"
tar -cf - .env deploy supabase scripts | encrypt "$stamp.configuration.enc"
printf 'Central COP backup completed: %s\n' "$stamp"
