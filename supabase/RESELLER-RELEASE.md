# Publicering av återförsäljarregistret

1. Kör `migrations/0008_reseller_register.sql` en gång i Supabase SQL Editor före
   publicering av den nya koden. Migrationen körs i en transaktion och bevarar
   befintliga kund-ID:n, order-ID:n, fakturor och uppföljningsdatum.
2. Publicera koden via projektets vanliga GitHub/Vercel-flöde.
3. Kontrollera återförsäljarlistan, kontaktuppgifter, äldre leveranser och orderhistorik.

Återförsäljare ligger kvar i den gemensamma databastabellen `customers` för att
bevara orderkopplingar, men visas i ett separat register i gränssnittet.

Äldre fristående leveranser får inte automatiskt nya ordrar. En sådan åtgärd kan
skapa dubbla försändelser och lagerdragningar. Om en äldre leverans redan har en
order kan den kopplas uttryckligen till den ordern i återförsäljarens historik.
Leveransens anteckning och uppföljningsdatum bevaras. Ingen order skapas vid koppling.

Namn matchas med trimning och utan hänsyn till stora/små bokstäver, och endast när
namnet identifierar en enda befintlig återförsäljare. Tvetydiga butiksposter slås inte
ihop automatiskt.

Nya leveranser skapar en order i status Ny. Leveransdatum är ett separat, frivilligt
ankomstdatum och ändrar inte orderns fraktstatus. Vikt är antal × 190 gram, utan
extra emballagevikt. Nya askar visas som standard; äldre askar kan fällas fram.

Uppföljningar räknas i 30 kalenderdagar, inte en kalendermånad. Befintliga datum
bevaras som manuella vid övergången.
