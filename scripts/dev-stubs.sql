-- Endast för lokal utveckling: skapar det Supabase annars tillhandahåller
-- (auth-schema, storage-schema och roller) så att migrationen kan köras
-- mot en vanlig Postgres. Körs ALDRIG i Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean);

-- Utvecklingsanvändare (används när appen körs lokalt utan Supabase Auth)
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000001', 'dev@getout.local')
on conflict do nothing;
