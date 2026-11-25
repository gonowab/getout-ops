begin;

create table public.mileage_addresses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  address text not null check (char_length(trim(address)) between 1 and 180)
);

create unique index mileage_addresses_name_idx on public.mileage_addresses (lower(name));
alter table public.mileage_addresses enable row level security;
revoke all on public.mileage_addresses from anon, authenticated;

commit;
