-- Loopcoach: één tabel, elke gebruiker ziet alleen zijn eigen rijen.
-- Plak dit in Supabase → SQL Editor → New query → Run.
create table if not exists public.docs (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  key        text not null check (char_length(key) <= 64),   -- bv. weights/2026-10-08, sessions/2026-10-08, state/plan
  data       jsonb not null check (pg_column_size(data) < 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.docs enable row level security;

drop policy if exists "eigen data" on public.docs;
create policy "eigen data" on public.docs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
