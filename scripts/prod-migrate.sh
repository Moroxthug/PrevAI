#!/usr/bin/env bash
# Applies ONE migration from migrations/v2 to the production database.
#   bash scripts/prod-migrate.sh migrations/v2/0016_sec4_link_preventivo.sql
# Reads DATABASE_URL from .env.production, switches the pooler port 6543 to the
# session port 5432, forces sslmode=require, runs psql in a single transaction
# stopping at the first error. Every migration in migrations/v2 is idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."

file="${1:-}"
case "$file" in
  migrations/v2/*.sql) ;;
  *) echo "usage: bash scripts/prod-migrate.sh migrations/v2/<file>.sql" >&2; exit 2 ;;
esac
[ -f "$file" ] || { echo "not found: $file" >&2; exit 2; }

url="$(grep -E '^DATABASE_URL=' .env.production | head -1 | cut -d= -f2- | tr -d '\r"'"'"'')"
[ -n "$url" ] || { echo "DATABASE_URL missing in .env.production" >&2; exit 2; }
url="${url/:6543/:5432}"
case "$url" in
  *sslmode=*) ;;
  *\?*) url="$url&sslmode=require" ;;
  *) url="$url?sslmode=require" ;;
esac

psql_bin="psql"
command -v psql >/dev/null 2>&1 || psql_bin="/c/Program Files/PostgreSQL/17/bin/psql.exe"
PGCONNECT_TIMEOUT=20 "$psql_bin" "$url" -X -v ON_ERROR_STOP=1 -1 -f "$file"
