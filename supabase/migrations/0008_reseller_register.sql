-- Kör före publicering av den nya återförsäljarsidan. Transaktionen bevarar äldre data.
begin;
alter table customers add column contacts jsonb not null default '[]'::jsonb;
alter table customers add constraint customers_contacts_array check (jsonb_typeof(contacts) = 'array');
update customers set contacts = jsonb_build_array(jsonb_build_object('name', coalesce(contact_name,''), 'email', coalesce(email,'')))
where type = 'aterforsaljare' and (contact_name is not null or email is not null);

create table reseller_notes (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references customers(id) on delete cascade,
 noted_on date,
 body text not null default '',
 created_at timestamptz not null default now()
);
alter table reseller_notes enable row level security;
create index reseller_notes_customer_idx on reseller_notes(customer_id);
insert into reseller_notes(customer_id, noted_on, body)
select id, created_at::date, notes from customers where type = 'aterforsaljare' and notes is not null;

alter table reseller_deliveries add column customer_id uuid references customers(id) on delete restrict;
alter table reseller_deliveries add column order_id uuid unique references orders(id) on delete restrict;
alter table reseller_deliveries add column follow_up_manual boolean not null default false;
alter table reseller_deliveries alter column delivered_on drop not null;
alter table reseller_deliveries alter column delivered_on drop default;
alter table reseller_deliveries alter column follow_up_on drop not null;
alter table reseller_deliveries drop constraint reseller_deliveries_quantity_check;
alter table reseller_deliveries add constraint reseller_deliveries_quantity_check check (quantity >= 0);
-- Bevara alla befintliga uppföljningsdatum, även manuella överenskommelser.
update reseller_deliveries set follow_up_manual = true;

-- Koppla namn endast när de identifierar exakt en befintlig butik. Vid tvetydighet
-- sparas posten separat; slå aldrig ihop olika butiker enbart på namn.
do $$ declare r record; cid uuid; begin
 for r in select distinct lower(btrim(name)) as key, min(name) as name from reseller_deliveries group by lower(btrim(name)) loop
  select case when count(*) = 1 then min(id::text)::uuid end into cid
  from customers where type = 'aterforsaljare' and lower(btrim(name)) = r.key;
  if cid is null then
   insert into customers(name,type) values(r.name,'aterforsaljare') returning id into cid;
  end if;
  update reseller_deliveries set customer_id = cid where lower(btrim(name)) = r.key;
 end loop;
end $$;

-- Ordrar är källan för produkter, pris, adress, vikt och faktura.
-- Äldre fristående leveranser får ingen ny order automatiskt: då riskerar vi
-- dubbel försändelse och dubbel lagerdragning. De kan kopplas i gränssnittet.
create function ensure_reseller_delivery() returns trigger language plpgsql as $$ begin
 if new.customer_id is not null and exists(select 1 from customers where id = new.customer_id and type = 'aterforsaljare') then
  insert into reseller_deliveries(customer_id,order_id,name,quantity,delivered_on,follow_up_on,created_by)
  select new.customer_id,new.id,c.name,0,null,null,new.created_by from customers c where c.id = new.customer_id
  on conflict(order_id) do update set customer_id = excluded.customer_id;
 end if;
 return new;
end $$;
create trigger orders_reseller_delivery after insert or update of customer_id on orders
for each row execute function ensure_reseller_delivery();
insert into reseller_deliveries(customer_id,order_id,name,quantity,delivered_on,follow_up_on,created_by,created_at)
select o.customer_id,o.id,c.name,coalesce((select sum(quantity) from order_lines where order_id=o.id),0),null,null,o.created_by,o.created_at
from orders o join customers c on c.id=o.customer_id where c.type='aterforsaljare';
create index reseller_deliveries_customer_idx on reseller_deliveries(customer_id);
commit;
