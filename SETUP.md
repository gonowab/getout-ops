# Driftsättning – GetOut Operations

Engångsuppsättning, ca 20 minuter. Nycklar och lösenord läggs bara in i Supabase och Vercel, aldrig i koden eller i chatten.

## 1. Supabase – databas och inloggning

1. Skapa ett projekt på supabase.com: namn `getout-ops`, region **Stockholm (North EU)**. Spara databaslösenordet i en lösenordshanterare.
2. Öppna **SQL Editor** → New query → klistra in hela `supabase/migrations/0001_init.sql` → **Run**.
3. Vill ni prova med testdata först: kör `supabase/seed.sql` på samma sätt.
   Inför skarp start rensar ni den med `supabase/clear_test_data.sql`.
4. **Authentication → Sign In / Providers**: stäng av *Allow new users to sign up*.
5. **Authentication → Users → Add user → Create new user**: lägg in er fyra med e-post och ett tillfälligt lösenord, och kryssa i *Auto Confirm User*. Var och en byter lösenord under Inställningar i appen.

## 2. Hämta värdena som Vercel behöver

| Variabel i Vercel | Var den finns i Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API (eller *Connect*): Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys: *Publishable key* (heter *anon* på äldre projekt – då används `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys: *Secret key* (heter *service_role* på äldre projekt – då används `SUPABASE_SERVICE_ROLE_KEY`) |
| `DATABASE_URL` | Knappen **Connect** → *Transaction pooler* (port 6543). Byt `[YOUR-PASSWORD]` mot databaslösenordet. |

Secret key och databaslösenordet ger full åtkomst. De ska bara in i Vercel.

## 3. Vercel – driftsättning

1. Logga in på vercel.com med GitHub → **Add New → Project** → importera `getout-ops`.
2. Lägg in de fyra variablerna ovan under **Environment Variables** innan ni trycker **Deploy**.
3. Klart. Varje push till `main` driftsätts automatiskt.

Appen visar inte sidor för sökmotorer, och Supabase publika API är avstängt för alla tabeller – all data går via appens server.

## Shopify (ordrar från webbshoppen)

1. Kör `supabase/migrations/0002_shopify.sql` i Supabase SQL Editor (en gång).
2. Shopify-admin → **Inställningar → Aviseringar → Webhooks** → **Skapa webhook**, tre gånger:
   - Händelse: *Orderskapande*, *Orderuppdatering* respektive *Orderavbokning*
   - Format: JSON
   - URL: `https://getout-ops.vercel.app/api/webhooks/shopify`
3. Under listan står *"Dina webhooks kommer att signeras med …"*. Kopiera nyckeln och lägg in den i Vercel som
   `SHOPIFY_WEBHOOK_SECRET` (typ Secret). Driftsätt om.
4. Testa med **Skicka testavisering** på en webhook. Den syns under Inställningar → Senast från Shopify.

Nya ordrar hamnar under Att packa. Skickas de i Shopify blir de Skickade här och dras från lagret.
Avbryts de i Shopify blir de Makulerade. Äldre, redan skickade ordrar importeras aldrig.
En öppen äldre order hämtas in genom att man ändrar den i Shopify, t.ex. lägger till en tagg.

## Frakt – spårningsnummer till Shopify

1. Kör `supabase/migrations/0004_frakt.sql` i Supabase SQL Editor (en gång).
2. Appen **GetOut ops** i Shopifys Dev Dashboard (dev.shopify.com) med behörigheterna `read_orders`,
   `read_merchant_managed_fulfillment_orders` och `write_merchant_managed_fulfillment_orders`, installerad på butiken.
3. I Vercel: `SHOPIFY_SHOP` (t.ex. `dinbutik.myshopify.com`), `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`
   (från appens Inställningar), samt `POSTNORD_API_KEY` och `POSTNORD_CUSTOMER_NUMBER`.

Allt skickas med PostNord Home Small Prio (tjänstekod 86). Orderns vikt hämtas från Shopify.
När spårningsnumret skickas markeras ordern som skickad i Shopify,
kunden får Shopifys leveransmejl med spårningslänk och ordern blir Skickad här (lagret dras).

## Återförsäljare – uppföljning

Kör `supabase/migrations/0003_aterforsaljare_uppfoljning.sql` i Supabase SQL Editor (en gång) innan sidan **Återförsäljare** används.
Där läggs en leverans in med namn, antal, datum och anteckning. Uppföljningen sätts till en månad efter leveransen och syns som en röd siffra i menyn när det är dags.

## Lokal utveckling (valfritt)

Kräver Node 20+ och Postgres.

```bash
npm install
./scripts/db-reset-local.sh          # skapar databasen getout_dev med testdata
cp .env.example .env.local           # DEV_AUTH=true = inloggning hoppas över lokalt
npm run dev
```

`DEV_AUTH` fungerar aldrig på Vercel, oavsett vad variabeln är satt till.
