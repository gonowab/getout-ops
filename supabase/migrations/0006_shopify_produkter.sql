-- ============================================================
-- 0006: Fler Shopify-produkter per kortlek
-- Körs en gång i Supabase: SQL Editor -> klistra in -> Run.
--
-- När en kortlek säljs som en egen produkt i Shopify (t.ex. "Upptäck Skånes Natur –
-- nytt utseende") kopplas produktens variant-ID här till rätt kortlek. Kopplingen under
-- Inställningar (gammal/ny ask) finns kvar som förut, det här är ett tillägg.
-- ============================================================

create table if not exists shopify_variants (
  shopify_variant_id text primary key,                         -- Shopifys variant-ID
  product_id         integer not null references products(id) on delete cascade,
  title              text,                                    -- produktens namn i Shopify
  created_at         timestamptz not null default now()
);
alter table shopify_variants enable row level security;

-- Skånes nya ask säljs som en egen produkt sedan oktober 2026
insert into shopify_variants (shopify_variant_id, product_id, title)
select '64071120027978', id, 'Upptäck Skånes Natur – nytt utseende'
from products where sku = 'GO-SKANE-NY'
on conflict (shopify_variant_id) do nothing;
