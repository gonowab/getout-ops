-- ============================================================
-- 0003: Återförsäljare – uppföljning
-- Körs en gång i Supabase: SQL Editor -> klistra in -> Run.
--
-- En rad per leverans av kortlekar till en återförsäljare, med datum för
-- när vi bör höra av oss igen (standard en månad efter leveransen).
-- ============================================================

create table if not exists reseller_deliveries (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                              -- återförsäljarens namn
  quantity      integer not null check (quantity > 0),      -- antal kortlekar
  delivered_on  date not null default current_date,         -- när de fick kortlekarna
  follow_up_on  date not null,                              -- när vi borde följa upp
  followed_up   boolean not null default false,             -- uppföljning gjord
  note          text,                                       -- fri anteckning
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists reseller_deliveries_follow_up_idx
  on reseller_deliveries (followed_up, follow_up_on);

drop trigger if exists reseller_deliveries_updated_at on reseller_deliveries;
create trigger reseller_deliveries_updated_at before update on reseller_deliveries
  for each row execute function set_updated_at();

-- Samma som övriga tabeller: Supabase publika API är stängt, appen går via servern.
alter table reseller_deliveries enable row level security;
