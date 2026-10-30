-- Fishy Friends version 5a: crews. Run once in Supabase > SQL Editor > New query > Run. Safe to run again.
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists crews_name_unique on public.crews (lower(name));
alter table public.catches add column if not exists crew_id uuid references public.crews(id) on delete set null;
create index if not exists catches_crew_idx on public.catches (crew_id, caught_at);

grant select on public.crews to anon, authenticated;
grant insert, delete on public.crews to authenticated;
alter table public.crews enable row level security;
drop policy if exists "crews readable by all" on public.crews;
create policy "crews readable by all" on public.crews for select using (true);
drop policy if exists "crews added by signed in" on public.crews;
create policy "crews added by signed in" on public.crews for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "crews deleted by creator" on public.crews;
create policy "crews deleted by creator" on public.crews for delete to authenticated using (user_id = auth.uid());
