-- Fishy Friends version 3: catch cards and photos.
-- Run once in Supabase > SQL Editor > New query > Run. Safe to run again.

create table if not exists public.catches (
  id uuid primary key default gen_random_uuid(),
  fish text not null check (char_length(fish) <= 40),
  length_cm numeric(5,1) check (length_cm > 0 and length_cm < 300),
  fight smallint check (fight between 1 and 5),
  kept boolean not null default false,
  spot text check (char_length(spot) <= 80),
  spot_name text check (char_length(spot_name) <= 80),
  bait text check (char_length(bait) <= 80),
  note text check (char_length(note) <= 280),
  tide text check (char_length(tide) <= 30),
  photo_path text check (char_length(photo_path) <= 200),
  author text check (char_length(author) <= 30),
  caught_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists catches_created_idx on public.catches (created_at desc);

create table if not exists public.cheers (
  catch_id uuid not null references public.catches(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (catch_id, user_id)
);

grant select on public.catches, public.cheers to anon, authenticated;
grant insert, delete on public.catches, public.cheers to authenticated;

alter table public.catches enable row level security;
alter table public.cheers enable row level security;

drop policy if exists "catches readable by all" on public.catches;
create policy "catches readable by all" on public.catches for select using (true);
drop policy if exists "catches added by signed in" on public.catches;
create policy "catches added by signed in" on public.catches for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "catches deleted by owner" on public.catches;
create policy "catches deleted by owner" on public.catches for delete to authenticated using (user_id = auth.uid());

drop policy if exists "cheers readable by all" on public.cheers;
create policy "cheers readable by all" on public.cheers for select using (true);
drop policy if exists "cheers added by signed in" on public.cheers;
create policy "cheers added by signed in" on public.cheers for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "cheers removed by owner" on public.cheers;
create policy "cheers removed by owner" on public.cheers for delete to authenticated using (user_id = auth.uid());

-- Photo storage: a public bucket (anyone with the link sees photos), 2 MB max, images only.
-- Each person can only upload into and delete from their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catch-photos', 'catch-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "catch photos upload own folder" on storage.objects;
create policy "catch photos upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "catch photos delete own" on storage.objects;
create policy "catch photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'catch-photos' and owner = auth.uid());

do $$ begin
  begin alter publication supabase_realtime add table public.catches; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.cheers; exception when duplicate_object then null; end;
end $$;
