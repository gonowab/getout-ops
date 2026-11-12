# Återförsäljarhantering: regressionstester

Installera först projektets beroenden med `npm ci`. Testverktygen kan installeras
utan att ändra projektets paketfiler:

```sh
npm install --no-save --package-lock=false tsx @electric-sql/pglite
npx tsx --test tests/resellers.test.ts
node tests/resellers-migration.mjs
```

Databastestet skapar en isolerad Postgres-databas i minnet med PGlite. Det ansluter
aldrig till DATABASE_URL eller Supabase. Det kör alla migrationer, lägger in äldre
exempeldata före 0008 och verifierar bevarad historik, kontakter, fakturering,
frivilliga fält, orderkopplingar och att lagret bara dras en gång.

Därefter körs appens verkliga serverfunktioner och SQL-kompilator mot samma databas.
Auth, Next-cache, fillagring och pg-transport ersätts av testadaptrar. Testet täcker
även transaktionsrollback när man försöker ändra antal på en skickad order.
PDF-uppladdning till Supabase Storage och webbläsarinteraktioner ingår inte i testet.

Om PGlite installerats på annan plats kan `PGLITE_MODULE` ange modulens absoluta
sökväg till `dist/index.js`.
