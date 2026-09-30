# GetOut Operations

Internt verktyg för lager och ordrar. Svarar på fem frågor: vad finns i lager, vilka ordrar ska skickas, vad är skickat, vem väntar på faktura och vad behöver göras idag.

Driftsättning: se [SETUP.md](SETUP.md).

## Sidor

- **Översikt** – orderräknare, lager per region och listan *Att göra idag*
- **Ordrar** – flikar för att hantera, packa, skickade, fakturering och alla. Ny order med knappen eller tangenten `N`.
- **Lager** – totalt, reserverat och tillgängligt per kortlek, samt historik och registrering av inleverans, justering och retur
- **Kunder** – kundregister med ordrar per kund

## Lagerregler

- Saldot är summan av alla lagerrörelser. Inget tal skrivs över.
- **Bekräftad** och **Ska packas** reserverar lager.
- **Skickad** drar lagret. Det sker en gång, i databasen, i samma transaktion som statusbytet.
- Backar man från skickad (eller makulerar) läggs lagret tillbaka.
- Gamla och nya askar är separata produkter. Gamla askar har ingen lågt-saldo-varning.

## Teknik

Next.js 16 (App Router, Server Actions), Tailwind 4, Supabase (Postgres, Auth, Storage), Vercel.
Appen läser och skriver databasen från servern via `DATABASE_URL`. Supabase används för inloggning och faktura-PDF:er.

| Mapp | Innehåll |
|---|---|
| `supabase/migrations` | Databasschema |
| `supabase/seed.sql` | Testdata |
| `lib/queries.ts` | Läsning |
| `lib/actions/` | Alla ändringar (ordrar, lager, kunder, inloggning) |
| `components/` | Gränssnitt |

## Nästa steg

Shopify-import, lagersynk till Shopify, Fortnox, frakt och statistik.
