-- ============================================================
-- 0007: PostNord-etiketter sparas vid bokningen
-- Körs en gång i Supabase: SQL Editor -> klistra in -> Run.
--
-- PostNord skickar etiketten (PDF) direkt i svaret när en försändelse bokas.
-- Den sparas här så att den alltid kan skrivas ut igen.
-- ============================================================

create table if not exists postnord_labels (
  order_id    uuid primary key references orders(id) on delete cascade,
  pdf         bytea not null,
  created_at  timestamptz not null default now()
);
alter table postnord_labels enable row level security;
