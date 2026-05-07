-- Multi-location: items become "types"; physical stock is recorded per location.
--
-- New table: item_stocks(item_id, location_id, quantity, in_use). Each item can
-- have many stocks — e.g. RoboRIO has 2 in Lab and 3 in Closet. The original
-- items.quantity / items.in_use / items.location_id stay around as denormalized
-- "totals" maintained by trigger so existing card/BOM code keeps working.

-- Defensive function definitions (in case earlier migrations didn't run cleanly).
create or replace function public.tg_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.tg_set_created_by() returns trigger language plpgsql as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;

create table if not exists public.item_stocks (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id)     on delete cascade,
  location_id  uuid          references public.locations(id) on delete set null,
  quantity     integer not null default 0 check (quantity >= 0),
  in_use       integer not null default 0 check (in_use >= 0 and in_use <= quantity),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index if not exists item_stocks_item_idx     on public.item_stocks(item_id);
create index if not exists item_stocks_location_idx on public.item_stocks(location_id);

drop trigger if exists item_stocks_set_updated_at on public.item_stocks;
create trigger item_stocks_set_updated_at before update on public.item_stocks
  for each row execute function public.tg_set_updated_at();

drop trigger if exists item_stocks_set_created_by on public.item_stocks;
create trigger item_stocks_set_created_by before insert on public.item_stocks
  for each row execute function public.tg_set_created_by();

-- Roll up stocks → items.{quantity,in_use,location_id}.
-- The temporary mismatch between (new) items.quantity and items.in_use during the
-- update would normally trip the in_use<=quantity check, so we drop it first and
-- let the trigger guarantee the invariant by always updating both fields together.
alter table public.items drop constraint if exists items_in_use_range;

create or replace function public.tg_sync_item_totals() returns trigger language plpgsql as $$
declare
  target uuid := coalesce(new.item_id, old.item_id);
  total_qty integer;
  total_in_use integer;
  primary_loc uuid;
  loc_count integer;
begin
  select coalesce(sum(quantity), 0),
         coalesce(sum(in_use), 0),
         count(distinct location_id) filter (where location_id is not null)
    into total_qty, total_in_use, loc_count
  from public.item_stocks where item_id = target;

  if loc_count = 1 then
    select location_id into primary_loc
    from public.item_stocks
    where item_id = target and location_id is not null
    order by quantity desc nulls last
    limit 1;
  else
    primary_loc := null;  -- multi-location or no stocks → null sentinel
  end if;

  update public.items set
    quantity    = total_qty,
    in_use      = total_in_use,
    location_id = primary_loc
  where id = target;
  return null;
end $$;

drop trigger if exists item_stocks_sync_totals on public.item_stocks;
create trigger item_stocks_sync_totals
  after insert or update or delete on public.item_stocks
  for each row execute function public.tg_sync_item_totals();

-- Backfill: every existing item with stock or in-use units gets a single stock row.
insert into public.item_stocks (item_id, location_id, quantity, in_use, created_by)
select id, location_id, quantity, in_use, created_by
from public.items
where (quantity > 0 or in_use > 0)
  and not exists (select 1 from public.item_stocks s where s.item_id = items.id);

-- RLS
alter table public.item_stocks enable row level security;

drop policy if exists "auth read item_stocks"  on public.item_stocks;
drop policy if exists "auth write item_stocks" on public.item_stocks;

create policy "auth read item_stocks"  on public.item_stocks for select to authenticated using (true);
create policy "auth write item_stocks" on public.item_stocks for all    to authenticated using (true) with check (true);

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'item_stocks'
  ) then
    alter publication supabase_realtime add table public.item_stocks;
  end if;
end $$;
