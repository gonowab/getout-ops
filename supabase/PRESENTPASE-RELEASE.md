# Presentpåse i nya Shopify-ordrar

Publicera appändringen i Vercel och kör sedan
`supabase/migrations/0009_presentpase.sql` i Supabase SQL Editor.
Migration 0006 (Shopify-produktkopplingar) måste redan vara körd.

Migrationen lägger till **Presentpåse till kortlek** med SKU `GO-PRESENTPASE`
och kopplar Shopify-variant `64311209886026` (produkt `16189372203338`).
Ingen order skrivs om. Importerade ordrar kompletteras inte i efterhand.

Tillbehör har `edition = null`. Kortlekar behåller `gammal`/`ny`.
Påsen visas i orderlistan och som en egen rad i orderdetaljen.
Packsummeringen räknar kortlekar och tillbehör separat.

Påsarna använder appens vanliga lagerhantering: reserveras vid bekräftelse och
lagerförs en gång när ordern markeras skickad. Registrera det verkliga ingående
lagret via **Lager → Registrera**. Migrationen gissar inget lagersaldo och flyttar
inte Shopifys saldo till appen.

Verifiering utan produktionsdata:

```sh
PGLITE_MODULE=/sökväg/till/@electric-sql/pglite/dist/index.js node tests/presentpase.mjs
```

Testet kör appens riktiga Shopify-import och SQL mot Postgres i minnet och täcker
kortlek med påse, kortlek utan påse, enbart påse, antal och nettopriser,
webhookdubbletter, oförändrade befintliga ordrar, packsummering och lagerdragning.
