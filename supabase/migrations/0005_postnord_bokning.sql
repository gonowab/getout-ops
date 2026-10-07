-- ============================================================
-- 0005: Bokning hos PostNord direkt från appen
-- Körs en gång i Supabase: SQL Editor -> klistra in -> Run.
-- ============================================================

-- När ordern bokades hos PostNord och PostNords boknings-ID (kolli-ID sparas i tracking_number)
alter table orders add column if not exists postnord_booked_at timestamptz;
alter table orders add column if not exists postnord_booking_id text;

-- orders_overview byggs om så att de nya kolumnerna syns (samma vy som i 0004)
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
