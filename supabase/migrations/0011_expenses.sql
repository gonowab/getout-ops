create table public.expenses (
  id uuid primary key,
  person text not null check (person in ('Noah', 'Ludvig', 'Oskar', 'Filip')),
  reason text not null check (char_length(trim(reason)) between 1 and 160),
  amount_ore integer not null check (amount_ore between 1 and 99999999),
  receipt bytea not null check (octet_length(receipt) between 4 and 900000),
  submitted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  status_updated_at timestamptz
);

create index expenses_status_created_at_idx on public.expenses (status, created_at desc);
alter table public.expenses enable row level security;
revoke all on public.expenses from anon, authenticated;
