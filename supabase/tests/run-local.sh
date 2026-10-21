#!/usr/bin/env bash
# Prova le policy RLS su un Postgres locale usa e getta (serve Postgres 14+ installato).
set -euo pipefail
cd "$(dirname "$0")"
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
DIR=$(mktemp -d); PORT=${PGPORT:-54329}
chmod 755 "$DIR"
if [ "$(id -u)" = 0 ]; then
  chown postgres "$DIR"; RUN=(su postgres -c)
else RUN=(bash -c); fi
run() { "${RUN[@]}" "$*"; }
trap 'run "$PGBIN/pg_ctl -D $DIR/data stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
run "$PGBIN/initdb -D $DIR/data -A trust -U postgres >/dev/null"
run "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start >/dev/null"
PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1 -t -A)
"${PSQL[@]}" -c 'create database t' >/dev/null
PSQL+=(-d t)
"${PSQL[@]}" -f stubs.sql
"${PSQL[@]}" -f ../migrations/0001_gallery.sql
"${PSQL[@]}" -f ../migrations/0002_seed_legacy.sql
"${PSQL[@]}" -f policies.sql
