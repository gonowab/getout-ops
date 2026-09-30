@AGENTS.md

# GetOut Operations – projektregler

- Allt gränssnitt är på svenska. Skriv alltid "idag", aldrig "i dag".
- Lagersaldo lagras aldrig som ett tal: det är summan av `inventory_movements`. Lagerdragning vid statusbyte sker bara i SQL-funktionen `set_order_status` – duplicera inte den logiken i TypeScript.
- Databasändringar görs som nya filer i `supabase/migrations/` (0002_..., 0003_...). Ändra aldrig en redan körd migration.
- Data läses i `lib/queries.ts` och ändras i server actions under `lib/actions/`. Varje action börjar med `requireUser()`.
- Testa lokalt med `./scripts/db-reset-local.sh` och `DEV_AUTH=true` (se SETUP.md).
