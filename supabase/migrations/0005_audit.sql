-- Audit: track *who* created each row (items, boms, bom_items, locations).
--
-- Two pieces:
--   1) public.profiles  — a readable mirror of auth.users (so the frontend can
--      show "added by Farhan" instead of a uuid). Auth.users is restricted, this
--      table is read-only-public for authenticated users.
--   2) tg_set_created_by — a BEFORE INSERT trigger that fills created_by with
--      auth.uid() when the client didn't pass it. Belt + suspenders.

------------------------------------------------------------------
-- Profiles
------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Sync a profile row whenever a user signs up or has their email changed.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any users that already exist get a profile row.
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;

drop policy if exists "auth read profiles"   on public.profiles;
drop policy if exists "self update profile"  on public.profiles;

create policy "auth read profiles"  on public.profiles for select to authenticated using (true);
create policy "self update profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

------------------------------------------------------------------
-- Add created_by where it's missing
------------------------------------------------------------------
alter table public.locations add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.bom_items add column if not exists created_by uuid references auth.users(id) on delete set null;

------------------------------------------------------------------
-- Auto-set created_by from the request's auth context if not provided.
------------------------------------------------------------------
create or replace function public.tg_set_created_by() returns trigger language plpgsql as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;

drop trigger if exists items_set_created_by      on public.items;
drop trigger if exists boms_set_created_by       on public.boms;
drop trigger if exists locations_set_created_by  on public.locations;
drop trigger if exists bom_items_set_created_by  on public.bom_items;

create trigger items_set_created_by      before insert on public.items      for each row execute function public.tg_set_created_by();
create trigger boms_set_created_by       before insert on public.boms       for each row execute function public.tg_set_created_by();
create trigger locations_set_created_by  before insert on public.locations  for each row execute function public.tg_set_created_by();
create trigger bom_items_set_created_by  before insert on public.bom_items  for each row execute function public.tg_set_created_by();

------------------------------------------------------------------
-- Realtime broadcast for profiles (so newly-signed-up teammates show up live)
------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
