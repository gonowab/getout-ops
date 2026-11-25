begin;

create table public.mileage_claims (
  id uuid primary key,
  driver text not null check (driver in ('Noah', 'Ludvig', 'Oskar', 'Filip')),
  travel_date date not null,
  origin text not null check (char_length(trim(origin)) between 1 and 180),
  destination text not null check (char_length(trim(destination)) between 1 and 180),
  distance_tenths integer not null check (distance_tenths between 1 and 100000),
  purpose text not null check (char_length(trim(purpose)) between 1 and 160),
  fuel_ore integer not null check (fuel_ore between 0 and 99999999),
  fuel_payer text,
  recipients text[] not null check (
    cardinality(recipients) between 1 and 4
    and array_position(recipients, null) is null
    and recipients <@ array['Noah', 'Ludvig', 'Oskar', 'Filip']::text[]
  ),
  amounts jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  submitted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  status_updated_at timestamptz,
  check (
    (fuel_ore = 0 and fuel_payer is null)
    or (fuel_ore > 0 and fuel_payer is not null and fuel_payer in ('Noah', 'Ludvig', 'Oskar', 'Filip'))
  )
);

create index mileage_claims_travel_date_idx on public.mileage_claims (travel_date desc, created_at desc);
alter table public.mileage_claims enable row level security;
revoke all on public.mileage_claims from anon, authenticated;

commit;
