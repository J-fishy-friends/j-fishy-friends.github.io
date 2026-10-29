-- Fishy Friends: run once in Supabase > SQL Editor > New query > Run.
-- Creates shared cast-point pins and spot comments.
-- Everyone can read. Anyone using the app can add. Only the person who added something can delete it.
-- Also turn on: Authentication > Sign In / Providers > "Allow anonymous sign-ins".

create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  spot text not null check (char_length(spot) <= 80),
  name text not null check (char_length(name) between 1 and 60),
  fish text[] not null default '{}',
  note text check (char_length(note) <= 280),
  lat double precision check (lat between -45 and -9),
  lon double precision check (lon between 110 and 155),
  author text check (char_length(author) <= 30),
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  spot text not null check (char_length(spot) <= 80),
  body text not null check (char_length(body) between 1 and 400),
  author text check (char_length(author) <= 30),
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists pins_spot_idx on public.pins (spot);
create index if not exists comments_spot_idx on public.comments (spot, created_at desc);

-- Access for the app (needed because "Automatically expose new tables" is off).
-- Visitors sign in anonymously behind the scenes, so the app runs as "authenticated".
grant usage on schema public to anon, authenticated;
grant select on public.pins, public.comments to anon, authenticated;
grant insert, delete on public.pins, public.comments to authenticated;

alter table public.pins enable row level security;
alter table public.comments enable row level security;

drop policy if exists "pins readable by all" on public.pins;
create policy "pins readable by all" on public.pins for select using (true);
drop policy if exists "pins added by signed in" on public.pins;
create policy "pins added by signed in" on public.pins for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "pins deleted by owner" on public.pins;
create policy "pins deleted by owner" on public.pins for delete to authenticated using (user_id = auth.uid());

drop policy if exists "comments readable by all" on public.comments;
create policy "comments readable by all" on public.comments for select using (true);
drop policy if exists "comments added by signed in" on public.comments;
create policy "comments added by signed in" on public.comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "comments deleted by owner" on public.comments;
create policy "comments deleted by owner" on public.comments for delete to authenticated using (user_id = auth.uid());

-- Live updates so a friend's new pin appears without refreshing.
do $$ begin
  begin alter publication supabase_realtime add table public.pins; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end;
end $$;
