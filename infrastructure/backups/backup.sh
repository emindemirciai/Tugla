#!/usr/bin/env sh
set -eu

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="${BACKUP_DIR:-/backups}"
archive="${backup_dir}/tugla-${timestamp}.dump"

mkdir -p "${backup_dir}"
pg_dump "${DATABASE_URL}" --format=custom --no-owner --file="${archive}"

if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  openssl enc -aes-256-cbc -salt -pbkdf2 -in "${archive}" -out "${archive}.enc" -pass env:BACKUP_ENCRYPTION_KEY
  rm "${archive}"
  archive="${archive}.enc"
fi

find "${backup_dir}" -type f -name 'tugla-*.dump*' -mtime +7 -delete
printf '%s\n' "Backup created: ${archive}"
