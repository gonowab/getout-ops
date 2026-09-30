-- ============================================================
-- TESTDATA – för att prova flödet innan riktig data läggs in.
-- Körs efter 0001_init.sql. Rensas med supabase/clear_test_data.sql.
-- Alla kontaktuppgifter är påhittade (@example.se).
-- ============================================================

-- ---------- Kunder ----------
insert into customers (name, type, org_number, contact_name, email, phone, address, postal_code, city, invoice_email, invoice_reference, notes) values
  ('HSB Malmö',              'foretag',        '746000-0001', 'Anna Andersson',   'anna.andersson@example.se', '070-111 11 11', 'Testgatan 1',      '211 11', 'Malmö',     'faktura@example.se', 'Julgåvor 2026',  'Köpte personalgåvor förra året.'),
  ('Kustbyrån Göteborg AB',  'foretag',        '556000-0002', 'Per Håkansson',    'per@example.se',            '070-222 22 22', 'Hamngatan 4',      '411 01', 'Göteborg',  null,                 'PH-4411',        null),
  ('Solna Fastigheter AB',   'foretag',        '556000-0003', 'Lina Ek',          'lina.ek@example.se',        '070-333 33 33', 'Råsundavägen 10',  '169 50', 'Solna',     'ekonomi@example.se', 'Kst 210',        'Vill ha logotyp på asken nästa år.'),
  ('Lunds Konsultgrupp',     'foretag',        '556000-0004', 'Oscar Malm',       'oscar@example.se',          '070-444 44 44', 'Stortorget 2',     '222 23', 'Lund',      null,                 null,             null),
  ('Friluftsbolaget AB',     'foretag',        '556000-0005', 'Karin Sjö',        'karin@example.se',          '070-555 55 55', 'Skogsvägen 8',     '115 21', 'Stockholm', null,                 null,             'Kom via mässan i september.'),
  ('Naturkompaniet Lund',    'aterforsaljare', null,          'Johanna Berg',     'lund@example.se',           '046-12 34 56',  'Klostergatan 3',   '222 22', 'Lund',      null,                 null,             null),
  ('Bokhandeln Ystad',       'aterforsaljare', null,          'Mats Ohlsson',     'mats@example.se',           '0411-12 345',   'Stora Östergatan 5','271 34','Ystad',     null,                 null,             null),
  ('Turistbyrån Höör',       'aterforsaljare', null,          'Eva Lund',         'eva@example.se',            '0413-55 555',   'Stationsgatan 1',  '243 30', 'Höör',      null,                 null,             null),
  ('Erik Svensson',          'privat',         null,          'Erik Svensson',    'erik.s@example.se',         null,            'Parkvägen 12',     '224 56', 'Lund',      null,                 null,             null),
  ('Maria Lindqvist',        'privat',         null,          'Maria Lindqvist',  'maria.l@example.se',        null,            'Vasagatan 3',      '411 24', 'Göteborg',  null,                 null,             null),
  ('Johan Berg',             'privat',         null,          'Johan Berg',       'johan.b@example.se',        null,            'Sveavägen 40',     '111 34', 'Stockholm', null,                 null,             null),
  ('Sara Nilsson',           'privat',         null,          'Sara Nilsson',     'sara.n@example.se',         null,            'Ringvägen 7',      '214 30', 'Malmö',     null,                 null,             null);

-- ---------- Ingående lager ----------
insert into inventory_movements (product_id, quantity, type, note, occurred_at)
select p.id, v.qty, 'inleverans', v.note, now() - (v.days || ' days')::interval
from (values
  ('GO-SKANE-GAMMAL', 520,  'Ingående saldo gamla askar (testdata)', 60),
  ('GO-GBG-GAMMAL',   310,  'Ingående saldo gamla askar (testdata)', 60),
  ('GO-STHLM-GAMMAL', 170,  'Ingående saldo gamla askar (testdata)', 60),
  ('GO-SKANE-NY',     3500, 'Produktion K-Print (testdata)',          20),
  ('GO-GBG-NY',       2500, 'Produktion K-Print (testdata)',          20),
  ('GO-STHLM-NY',     5000, 'Produktion K-Print (testdata)',          20)
) as v(sku, qty, note, days)
join products p on p.sku = v.sku;

insert into inventory_movements (product_id, quantity, type, note, occurred_at)
select id, -4, 'justering', 'Inventering: skadade askar (testdata)', now() - interval '10 days'
from products where sku = 'GO-SKANE-GAMMAL';

-- ---------- Hjälpfunktion för att skapa ordrar ----------
create function pg_temp.seed_order(
  p_customer text, p_source order_source, p_days_ago int, p_lines jsonb, p_status order_status,
  p_unit_price numeric default null, p_invoice invoice_status default 'ej_fakturerad',
  p_invoice_number text default null, p_due_in_days int default null,
  p_comment text default null, p_shopify_name text default null
) returns void language plpgsql as $$
declare
  v_order  uuid;
  v_c      customers%rowtype;
  v_flow   order_status[] := array['ny','bekraftad','ska_packas','skickad','levererad','avslutad']::order_status[];
  v_step   order_status;
begin
  select * into v_c from customers where name = p_customer;

  insert into orders (customer_id, source, order_date, contact_name, contact_email, contact_phone,
                      ship_name, ship_address, ship_postal_code, ship_city,
                      invoice_email, invoice_reference, comment, shopify_order_name, shopify_order_id, created_at)
  values (v_c.id, p_source, current_date - p_days_ago, v_c.contact_name, v_c.email, v_c.phone,
          v_c.name, v_c.address, v_c.postal_code, v_c.city,
          v_c.invoice_email, v_c.invoice_reference, p_comment, p_shopify_name,
          case when p_shopify_name is not null then 'test-' || p_shopify_name end,
          now() - (p_days_ago || ' days')::interval)
  returning id into v_order;

  insert into order_lines (order_id, product_id, quantity, unit_price)
  select v_order, p.id, (l.value)::int, p_unit_price
  from jsonb_each_text(p_lines) l join products p on p.sku = l.key;

  insert into order_events (order_id, kind, to_value, created_at)
  values (v_order, 'skapad', 'ny', now() - (p_days_ago || ' days')::interval);

  -- Gå igenom statusarna i ordning så att tidslinjen och lagret blir rätt
  if p_status = 'makulerad' then
    perform set_order_status(v_order, 'makulerad');
  else
    foreach v_step in array v_flow loop
      exit when array_position(v_flow, v_step) > array_position(v_flow, p_status);
      perform set_order_status(v_order, v_step);
    end loop;
  end if;

  -- Datera lagerrörelser och tidslinje efter orderns datum i stället för nu
  update inventory_movements set occurred_at = now() - (greatest(p_days_ago - 1, 0) || ' days')::interval
  where order_id = v_order;

  with x as (select id, row_number() over (order by id) as rn from order_events where order_id = v_order)
  update order_events e
  set created_at = now() - (p_days_ago || ' days')::interval + ((x.rn - 1) * interval '3 hours')
  from x where e.id = x.id;

  update orders set
    invoice_status   = p_invoice,
    invoice_number   = p_invoice_number,
    invoice_date     = case when p_invoice <> 'ej_fakturerad' and p_source <> 'shopify' then current_date - p_days_ago + 2 end,
    invoice_due_date = case when p_due_in_days is not null then current_date + p_due_in_days end,
    paid_at          = case when p_invoice = 'betald' then current_date - greatest(p_days_ago - 5, 0) end,
    tracking_number  = case when status in ('skickad','levererad','avslutad') then '00370' || lpad((order_number * 7919 % 100000)::text, 5, '0') end
  where id = v_order;
end $$;

-- ---------- Ordrar ----------
-- Företag
select pg_temp.seed_order('HSB Malmö',             'foretag',        34, '{"GO-SKANE-NY": 150}',                    'levererad',  223, 'fakturerad', '1041', -4,  'Personalgåva till alla anställda.');
select pg_temp.seed_order('HSB Malmö',             'foretag',         3, '{"GO-SKANE-NY": 40, "GO-STHLM-NY": 10}',  'skickad',    223, 'ej_fakturerad', null, null, 'Tilläggsbeställning för nyanställda.');
select pg_temp.seed_order('Kustbyrån Göteborg AB', 'foretag',         2, '{"GO-GBG-NY": 120}',                     'bekraftad',  223, 'ej_fakturerad', null, null, 'Leverans senast 1 december.');
select pg_temp.seed_order('Solna Fastigheter AB',  'foretag',         4, '{"GO-STHLM-NY": 200}',                   'ska_packas', 210, 'ej_fakturerad', null, null, null);
select pg_temp.seed_order('Lunds Konsultgrupp',    'foretag',        45, '{"GO-SKANE-GAMMAL": 40, "GO-GBG-GAMMAL": 20}', 'avslutad', 199, 'betald', '1036', -15, null);
select pg_temp.seed_order('Friluftsbolaget AB',    'foretag',         1, '{"GO-STHLM-GAMMAL": 40}',                'ny',         199, 'ej_fakturerad', null, null, 'Förfrågan via mejl – bekräfta pris innan.');

-- Återförsäljare
select pg_temp.seed_order('Naturkompaniet Lund',   'aterforsaljare', 12, '{"GO-SKANE-GAMMAL": 30}',                'levererad',  109, 'fakturerad', '1044', 18,  null);
select pg_temp.seed_order('Bokhandeln Ystad',      'aterforsaljare',  0, '{"GO-SKANE-GAMMAL": 20, "GO-SKANE-NY": 10}', 'ny',      119, 'ej_fakturerad', null, null, 'Ringde in beställningen.');
select pg_temp.seed_order('Turistbyrån Höör',      'aterforsaljare', 25, '{"GO-SKANE-GAMMAL": 15}',                'avslutad',   119, 'betald', '1039', -5,  null);
select pg_temp.seed_order('Naturkompaniet Lund',   'aterforsaljare', 40, '{"GO-GBG-GAMMAL": 10}',                  'levererad',  119, 'fakturerad', '1033', -10, 'Påminnelse skickad.');

-- Shopify
select pg_temp.seed_order('Erik Svensson',   'shopify', 0, '{"GO-SKANE-GAMMAL": 1}',                      'ny',         null, 'betald', null, null, null, '#1287');
select pg_temp.seed_order('Maria Lindqvist', 'shopify', 1, '{"GO-GBG-GAMMAL": 2}',                        'ska_packas', null, 'betald', null, null, null, '#1286');
select pg_temp.seed_order('Johan Berg',      'shopify', 3, '{"GO-STHLM-GAMMAL": 1, "GO-SKANE-GAMMAL": 1}', 'skickad',    null, 'betald', null, null, null, '#1284');
select pg_temp.seed_order('Sara Nilsson',    'shopify', 6, '{"GO-SKANE-GAMMAL": 3}',                      'levererad',  null, 'betald', null, null, 'Julklappar.', '#1279');
select pg_temp.seed_order('Erik Svensson',   'shopify', 9, '{"GO-SKANE-GAMMAL": 1}',                      'makulerad',  null, 'ej_fakturerad', null, null, 'Kunden ångrade köpet.', '#1275');
