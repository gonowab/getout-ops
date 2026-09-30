-- ============================================================
-- GetOut Operations – databasschema (MVP)
-- Körs en gång i Supabase: SQL Editor -> klistra in -> Run.
--
-- Appen pratar med databasen direkt från servern (DATABASE_URL).
-- Supabase publika API stängs därför helt med RLS utan policies:
-- ingen kan läsa eller skriva data med den publika nyckeln.
-- ============================================================

-- ---------- Typer ----------
create type customer_type  as enum ('privat', 'foretag', 'aterforsaljare');
create type order_source   as enum ('shopify', 'foretag', 'aterforsaljare', 'annat');
create type order_status   as enum ('ny', 'bekraftad', 'ska_packas', 'skickad', 'levererad', 'avslutad', 'makulerad');
-- "Förfallen" lagras inte – den räknas fram (fakturerad + förfallodatum passerat).
create type invoice_status as enum ('ej_fakturerad', 'fakturerad', 'betald');
create type movement_type  as enum ('inleverans', 'order', 'justering', 'retur');

-- ---------- Användare ----------
-- Inloggning sköts av Supabase Auth. Profilen skapas automatiskt vid första inloggning.
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text,
  created_at  timestamptz not null default now()
);

-- ---------- Produkter ----------
-- En rad per kortlek och ask. Ny region (t.ex. Norrland) = ny rad, ingen kodändring.
create table products (
  id                   smallint generated always as identity primary key,
  sku                  text not null unique,                 -- GO-SKANE-NY
  name                 text not null,                        -- "Upptäck Skåne"
  region               text not null,                        -- "Skåne"
  edition              text not null check (edition in ('gammal', 'ny')),
  sort_order           smallint not null default 0,
  low_stock_threshold  integer  not null default 300,        -- 0 = ingen varning
  shopify_variant_id   text unique,                          -- kopplas i fas 2
  active               boolean  not null default true,
  created_at           timestamptz not null default now()
);

-- ---------- Kunder ----------
create table customers (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  type                 customer_type not null default 'foretag',
  org_number           text,
  contact_name         text,
  email                text,
  phone                text,
  address              text,
  postal_code          text,
  city                 text,
  country              text not null default 'SE',
  invoice_email        text,
  invoice_reference    text,
  notes                text,
  shopify_customer_id  text unique,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index customers_name_idx on customers (lower(name));

-- ---------- Ordrar ----------
create table orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        integer generated always as identity (start with 1001) unique,  -- GO-1001
  customer_id         uuid references customers(id) on delete restrict,
  source              order_source   not null,
  status              order_status   not null default 'ny',
  invoice_status      invoice_status not null default 'ej_fakturerad',
  order_date          date not null default current_date,

  contact_name        text,
  contact_email       text,
  contact_phone       text,

  ship_name           text,
  ship_address        text,
  ship_postal_code    text,
  ship_city           text,
  ship_country        text not null default 'SE',
  tracking_number     text,
  shipped_at          timestamptz,

  invoice_email       text,
  invoice_reference   text,
  invoice_number      text,
  invoice_date        date,
  invoice_due_date    date,
  invoice_pdf_path    text,
  paid_at             date,

  comment             text,

  shopify_order_id    text unique,
  shopify_order_name  text,

  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index orders_status_idx   on orders (status);
create index orders_customer_idx on orders (customer_id);

create table order_lines (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  product_id  smallint not null references products(id),
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(10,2),                                 -- valfritt, kr ex moms
  unique (order_id, product_id)
);

create table order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references orders(id) on delete cascade,
  kind        text not null,                                 -- status | faktura | kommentar | skapad | andrad
  from_value  text,
  to_value    text,
  note        text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index order_events_order_idx on order_events (order_id, created_at);

-- ---------- Lager ----------
-- Saldot lagras aldrig som ett tal – det är summan av alla rörelser.
create table inventory_movements (
  id           bigint generated always as identity primary key,
  product_id   smallint not null references products(id),
  quantity     integer not null check (quantity <> 0),
  type         movement_type not null,
  order_id     uuid references orders(id) on delete set null,
  note         text,
  occurred_at  timestamptz not null default now(),
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index inventory_movements_product_idx on inventory_movements (product_id, occurred_at desc);
create unique index inventory_movements_one_per_order_line
  on inventory_movements (order_id, product_id) where type = 'order';

-- ---------- updated_at ----------
create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();
create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

-- ============================================================
-- Vyer
-- ============================================================

-- totalt       = fysiskt på hyllan (summa rörelser)
-- reserverat   = bekräftade ordrar som inte skickats
-- tillgangligt = det som går att sälja
create view stock_levels as
select
  p.id as product_id, p.sku, p.name, p.region, p.edition, p.sort_order, p.low_stock_threshold,
  coalesce(m.on_hand, 0)                               as totalt,
  coalesce(r.reserved, 0)                              as reserverat,
  coalesce(m.on_hand, 0) - coalesce(r.reserved, 0)     as tillgangligt,
  (p.low_stock_threshold > 0
   and coalesce(m.on_hand, 0) - coalesce(r.reserved, 0) < p.low_stock_threshold) as lagt_saldo
from products p
left join (
  select product_id, sum(quantity)::int as on_hand
  from inventory_movements group by product_id
) m on m.product_id = p.id
left join (
  select ol.product_id, sum(ol.quantity)::int as reserved
  from order_lines ol join orders o on o.id = ol.order_id
  where o.status in ('bekraftad', 'ska_packas')
  group by ol.product_id
) r on r.product_id = p.id
where p.active;

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

-- ============================================================
-- Statusbyte med automatisk lagerdragning, i en transaktion.
--   Till skickad/levererad/avslutad -> lagret dras (en gång)
--   Tillbaka till tidigare status eller makulerad -> dragningen tas bort
-- ============================================================
create function set_order_status(
  p_order_id uuid, p_status order_status, p_user uuid default null, p_note text default null
) returns void language plpgsql as $$
declare
  v_old     order_status;
  v_shipped order_status[] := array['skickad', 'levererad', 'avslutad']::order_status[];
begin
  select status into v_old from orders where id = p_order_id for update;
  if not found then raise exception 'Ordern finns inte'; end if;
  if v_old = p_status then return; end if;

  if p_status = any(v_shipped) and not (v_old = any(v_shipped)) then
    if not exists (select 1 from order_lines where order_id = p_order_id) then
      raise exception 'Ordern har inga produkter';
    end if;

    insert into inventory_movements (product_id, quantity, type, order_id, note, created_by)
    select ol.product_id, -ol.quantity, 'order', p_order_id,
           coalesce(c.name, 'Order') || ' (GO-' || o.order_number || ')', p_user
    from order_lines ol
    join orders o on o.id = ol.order_id
    left join customers c on c.id = o.customer_id
    where ol.order_id = p_order_id
    on conflict do nothing;

    update orders set shipped_at = coalesce(shipped_at, now()) where id = p_order_id;
  end if;

  if v_old = any(v_shipped) and not (p_status = any(v_shipped)) then
    delete from inventory_movements where order_id = p_order_id and type = 'order';
    update orders set shipped_at = null where id = p_order_id;
  end if;

  update orders set status = p_status where id = p_order_id;

  insert into order_events (order_id, kind, from_value, to_value, note, created_by)
  values (p_order_id, 'status', v_old::text, p_status::text, p_note, p_user);
end $$;

-- ============================================================
-- Stäng Supabase publika API (anon/authenticated) helt.
-- Appen använder serveranslutning och påverkas inte.
-- ============================================================
alter table profiles            enable row level security;
alter table products            enable row level security;
alter table customers           enable row level security;
alter table orders              enable row level security;
alter table order_lines         enable row level security;
alter table order_events        enable row level security;
alter table inventory_movements enable row level security;

revoke all on stock_levels, orders_overview, dashboard_counts from anon, authenticated;
revoke execute on function set_order_status(uuid, order_status, uuid, text) from public, anon, authenticated;

-- Privat bucket för faktura-PDF:er (öppnas via tidsbegränsade länkar)
insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- ============================================================
-- Produkter: gammal och ny ask per region
-- Gamla askar har ingen lågt-saldo-varning – de ska säljas slut.
-- ============================================================
insert into products (sku, name, region, edition, sort_order, low_stock_threshold) values
  ('GO-SKANE-GAMMAL', 'Upptäck Skåne',            'Skåne',     'gammal', 1, 0),
  ('GO-GBG-GAMMAL',   'Upptäck Göteborgs Natur',  'Göteborg',  'gammal', 2, 0),
  ('GO-STHLM-GAMMAL', 'Upptäck Stockholms Natur', 'Stockholm', 'gammal', 3, 0),
  ('GO-SKANE-NY',     'Upptäck Skåne',            'Skåne',     'ny',     4, 300),
  ('GO-GBG-NY',       'Upptäck Göteborgs Natur',  'Göteborg',  'ny',     5, 300),
  ('GO-STHLM-NY',     'Upptäck Stockholms Natur', 'Stockholm', 'ny',     6, 300);
