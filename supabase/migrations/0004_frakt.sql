-- ============================================================
-- 0004: Frakt – vikt, fraktsätt och spårning tillbaka till Shopify
-- Körs en gång i Supabase: SQL Editor -> klistra in -> Run.
-- ============================================================

-- Vikt i gram (från Shopify) och vilket PostNord-fraktsätt ordern ska skickas med.
--   home_small       = PostNord Home Small (tjänstekod 11), ca 4 dagar
--   home_small_prio  = PostNord Home Small Prio (tjänstekod 86), ca 1–2 dagar
alter table orders add column if not exists weight_grams integer check (weight_grams is null or weight_grams >= 0);
alter table orders add column if not exists shipping_service text not null default 'home_small'
  check (shipping_service in ('home_small', 'home_small_prio'));
-- När spårningsnumret skickades till Shopify (ordern markerad som skickad där, kunden mejlad)
alter table orders add column if not exists shopify_fulfilled_at timestamptz;

-- orders_overview listar ordrarnas kolumner när vyn skapas, så den måste
-- byggas om för att de nya kolumnerna ska synas. dashboard_counts bygger på den.
drop view if exists dashboard_counts;
drop view if exists orders_overview;

create view orders_overview as
select
  o.*,
  c.name                                   as customer_name,
  c.type                                   as customer_type,
  coalesce(l.total_qty, 0)                 as total_qty,
  (o.invoice_status = 'fakturerad' and o.invoice_due_date < current_date) as is_overdue
from orders o
left join customers c on c.id = o.customer_id
left join (
  select order_id, sum(quantity)::int as total_qty from order_lines group by order_id
) l on l.order_id = o.id;

create view dashboard_counts as
select
  count(*) filter (where status = 'ny')                                      as nya,
  count(*) filter (where status in ('bekraftad', 'ska_packas'))              as att_packa,
  count(*) filter (where status = 'skickad')                                 as skickade,
  count(*) filter (where invoice_status = 'fakturerad' and not is_overdue)   as vantar_betalning,
  count(*) filter (where is_overdue)                                         as forfallna,
  count(*) filter (where status in ('skickad', 'levererad', 'avslutad')
                     and invoice_status = 'ej_fakturerad')                   as ska_faktureras
from orders_overview
where status <> 'makulerad';

revoke all on orders_overview, dashboard_counts from anon, authenticated;
