-- ============================================================
-- 0002: Shopify-koppling
-- Körs en gång i Supabase: SQL Editor -> klistra in -> Run.
-- ============================================================

-- Logg över allt Shopify skickar, så att man kan se att kopplingen fungerar
create table if not exists shopify_events (
  id                 bigint generated always as identity primary key,
  webhook_id         text unique,                 -- Shopifys leverans-ID, skyddar mot dubbletter
  topic              text not null,               -- orders/create, orders/updated …
  shopify_order_id   text,
  shopify_order_name text,                        -- #1197
  outcome            text not null,               -- importerad | uppdaterad | oförändrad | ignorerad | fel
  message            text,
  received_at        timestamptz not null default now()
);
create index if not exists shopify_events_received_idx on shopify_events (received_at desc);
alter table shopify_events enable row level security;

-- Webbshoppens varianter kopplas till GAMLA askar (de ska säljas slut först).
-- Byts per region under Inställningar när nya askar ska säljas i webbshoppen.
update products set shopify_variant_id = v.variant
from (values
  ('GO-SKANE-GAMMAL', '61065256173898'),
  ('GO-GBG-GAMMAL',   '61734068781386'),
  ('GO-STHLM-GAMMAL', '61930213572938')
) as v(sku, variant)
where products.sku = v.sku
  and not exists (select 1 from products p2 where p2.shopify_variant_id = v.variant);
