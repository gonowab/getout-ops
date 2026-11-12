-- Separat register för prospekt och kontaktade återförsäljare.
begin;
create table reseller_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  contact_name text not null default '',
  notes text not null default '',
  contacted boolean not null default false,
  status text check (status in ('red', 'yellow', 'green')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger reseller_prospects_updated_at before update on reseller_prospects
for each row execute function set_updated_at();
alter table reseller_prospects enable row level security;
commit;
