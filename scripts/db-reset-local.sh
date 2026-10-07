#!/usr/bin/env bash
# Återskapar den lokala utvecklingsdatabasen med schema + testdata.
set -euo pipefail
DB="${LOCAL_DB_NAME:-getout_dev}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
dropdb --if-exists --force "$DB"
createdb "$DB"
psql -q -o /dev/null -v ON_ERROR_STOP=1 -d "$DB" \
  -f "$DIR/scripts/dev-stubs.sql" \
  -f "$DIR/supabase/migrations/0001_init.sql" \
  -f "$DIR/supabase/seed.sql"
# Senare databasändringar (0002, 0003 …) i nummerordning
for f in "$DIR"/supabase/migrations/0*.sql; do
  [ "$(basename "$f")" = "0001_init.sql" ] && continue
  psql -q -o /dev/null -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
psql -q -d "$DB" -c "insert into profiles (id, full_name, email) values ('00000000-0000-0000-0000-000000000001', 'Testanvändare', 'dev@getout.local') on conflict do nothing;"
echo "Klar: $DB"
