-- Fourge co-op mode: durable shared boards.
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query
-- -> paste -> Run. Safe to re-run (idempotent).
--
-- Threat model: these are shared rooms gated by an unguessable id, holding no
-- sensitive data (just words found in a public daily puzzle). So the policies
-- are intentionally open (anyone who knows the room id can read/append). That's
-- the right amount of security for a friendly word game.

create table if not exists public.coop_rooms (
  id          text primary key,
  day         int  not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.coop_found_words (
  room_id     text not null references public.coop_rooms(id) on delete cascade,
  word        text not null,
  player_id   text not null,
  player_name text,
  points      int  not null default 0,
  is_quartile boolean not null default false,
  found_at    timestamptz not null default now(),
  primary key (room_id, word)            -- idempotent: same word can't double-count
);

alter table public.coop_rooms       enable row level security;
alter table public.coop_found_words enable row level security;

-- Open read/append policies (drop-if-exists so the script is re-runnable).
drop policy if exists "coop_rooms_read"   on public.coop_rooms;
drop policy if exists "coop_rooms_insert" on public.coop_rooms;
drop policy if exists "coop_words_read"   on public.coop_found_words;
drop policy if exists "coop_words_insert" on public.coop_found_words;

create policy "coop_rooms_read"   on public.coop_rooms       for select using (true);
create policy "coop_rooms_insert" on public.coop_rooms       for insert with check (true);
create policy "coop_words_read"   on public.coop_found_words for select using (true);
create policy "coop_words_insert" on public.coop_found_words for insert with check (true);

-- Make sure the anon (publishable) role can use the tables.
grant select, insert on public.coop_rooms       to anon, authenticated;
grant select, insert on public.coop_found_words to anon, authenticated;

-- Enable realtime change feeds on the shared word list.
do $$
begin
  begin
    alter publication supabase_realtime add table public.coop_found_words;
  exception when duplicate_object then null;  -- already added
  end;
end $$;
