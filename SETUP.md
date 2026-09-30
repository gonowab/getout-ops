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

## Lokal utveckling (valfritt)

Kräver Node 20+ och Postgres.

```bash
npm install
./scripts/db-reset-local.sh          # skapar databasen getout_dev med testdata
cp .env.example .env.local           # DEV_AUTH=true = inloggning hoppas över lokalt
npm run dev
```

`DEV_AUTH` fungerar aldrig på Vercel, oavsett vad variabeln är satt till.
