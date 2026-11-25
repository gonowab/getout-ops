alter table public.mileage_claims
  add column trip_kind text check (trip_kind in ('one-way', 'return'));
