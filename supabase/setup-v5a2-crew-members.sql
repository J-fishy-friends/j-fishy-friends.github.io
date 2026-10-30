-- Fishy Friends: crew members and dispersing crews. Run once in Supabase > SQL Editor > New query > Run. Safe to run again.
create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists crew_members_unique on public.crew_members (crew_id, user_id, lower(name));

grant select on public.crew_members to anon, authenticated;
grant insert, delete on public.crew_members to authenticated;
alter table public.crew_members enable row level security;
drop policy if exists "members readable by all" on public.crew_members;
create policy "members readable by all" on public.crew_members for select using (true);
drop policy if exists "members join as themselves" on public.crew_members;
create policy "members join as themselves" on public.crew_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "members leave as themselves" on public.crew_members;
create policy "members leave as themselves" on public.crew_members for delete to authenticated using (user_id = auth.uid());
-- Dispersing a crew: only the person who made it can delete it (already set up). Its members are removed with it,
-- and its catches stay but are no longer linked to a crew.
