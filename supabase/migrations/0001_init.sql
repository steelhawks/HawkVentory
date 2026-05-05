-- HawkVentory initial schema
-- Run this in Supabase SQL Editor (or via `supabase db push`).

create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  parent_id   uuid references public.locations(id) on delete cascade,
  map_x       real,            -- 0..100 percent of floorplan width  (top-level rooms only)
  map_y       real,            -- 0..100 percent of floorplan height (top-level rooms only)
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists locations_parent_idx on public.locations(parent_id);

create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null check (category in
                  ('tool','robot_part','gear','belt','electronic','fastener','consumable','other')),
  quantity     integer not null default 1 check (quantity >= 0),
  location_id  uuid references public.locations(id) on delete set null,
  notes        text,
  photo_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index if not exists items_location_idx on public.items(location_id);
create index if not exists items_category_idx on public.items(category);
create index if not exists items_name_trgm    on public.items using gin (name gin_trgm_ops);

-- keep updated_at fresh
create or replace function public.tg_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at before update on public.items
  for each row execute function public.tg_set_updated_at();

-- Row Level Security: any authenticated team member can read+write.
-- Tighten later (e.g. delete = mentors only) once we add roles.
alter table public.locations enable row level security;
alter table public.items     enable row level security;

drop policy if exists "auth read locations"   on public.locations;
drop policy if exists "auth write locations"  on public.locations;
drop policy if exists "auth read items"       on public.items;
drop policy if exists "auth write items"      on public.items;

create policy "auth read locations"  on public.locations for select to authenticated using (true);
create policy "auth write locations" on public.locations for all    to authenticated using (true) with check (true);
create policy "auth read items"      on public.items     for select to authenticated using (true);
create policy "auth write items"     on public.items     for all    to authenticated using (true) with check (true);
