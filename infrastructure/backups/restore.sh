#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  printf '%s\n' "Usage: restore.sh /backups/tugla-TIMESTAMP.dump[.enc]" >&2
  exit 2
fi

source_file="$1"
restore_file="${source_file}"
temporary_file=""

case "${source_file}" in
  *.enc)
    : "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
    temporary_file="/tmp/tugla-restore.dump"
    openssl enc -d -aes-256-cbc -pbkdf2 -in "${source_file}" -out "${temporary_file}" -pass env:BACKUP_ENCRYPTION_KEY
    restore_file="${temporary_file}"
    ;;
esac

pg_restore --clean --if-exists --no-owner --dbname="${DATABASE_URL}" "${restore_file}"
[ -z "${temporary_file}" ] || rm "${temporary_file}"
