-- One-to-many: each item can have multiple photos.
-- items.photo_url stays as the cached "primary" photo (lowest sort_order),
-- updated by trigger so existing cards/thumbnails keep working unchanged.

create table if not exists public.item_photos (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items(id) on delete cascade,
  url         text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists item_photos_item_idx on public.item_photos(item_id, sort_order);

-- Sync items.photo_url to the lowest-sort_order photo whenever item_photos changes.
create or replace function public.tg_sync_item_primary_photo() returns trigger language plpgsql as $$
declare
  target uuid := coalesce(new.item_id, old.item_id);
begin
  update public.items set photo_url = (
    select url from public.item_photos
    where item_id = target
    order by sort_order, created_at
    limit 1
  ) where id = target;
  return null;
end $$;

drop trigger if exists item_photos_sync_primary on public.item_photos;
create trigger item_photos_sync_primary
  after insert or update or delete on public.item_photos
  for each row execute function public.tg_sync_item_primary_photo();

-- Defensive: re-create tg_set_created_by here too, in case 0005 didn't run cleanly.
create or replace function public.tg_set_created_by() returns trigger language plpgsql as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;

drop trigger if exists item_photos_set_created_by on public.item_photos;
create trigger item_photos_set_created_by before insert on public.item_photos
  for each row execute function public.tg_set_created_by();

-- Backfill: any existing items.photo_url becomes the first row in item_photos.
insert into public.item_photos (item_id, url, sort_order)
select i.id, i.photo_url, 0 from public.items i
where i.photo_url is not null
  and not exists (select 1 from public.item_photos p where p.item_id = i.id);

-- RLS
alter table public.item_photos enable row level security;

drop policy if exists "auth read item_photos"  on public.item_photos;
drop policy if exists "auth write item_photos" on public.item_photos;

create policy "auth read item_photos"  on public.item_photos for select to authenticated using (true);
create policy "auth write item_photos" on public.item_photos for all    to authenticated using (true) with check (true);

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'item_photos'
  ) then
    alter publication supabase_realtime add table public.item_photos;
  end if;
end $$;
