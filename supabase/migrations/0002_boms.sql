-- HawkVentory: BOMs (Bill of Materials) and "in use" status
-- Run after 0001_init.sql.

-- Per-item "currently installed/in use" flag
alter table public.items
  add column if not exists in_use boolean not null default false;

create index if not exists items_in_use_idx on public.items(in_use);

-- BOMs: a named list of parts for a subsystem (Intake, Drivetrain, etc.)
create table if not exists public.boms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  color       text not null default 'crimson',  -- ui chip color: crimson|amber|emerald|sky|violet|zinc
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists boms_name_idx on public.boms(name);

drop trigger if exists boms_set_updated_at on public.boms;
create trigger boms_set_updated_at before update on public.boms
  for each row execute function public.tg_set_updated_at();

-- BOM line items: link a BOM to an inventory item, or a free-text "wishlist" entry.
create table if not exists public.bom_items (
  id              uuid primary key default gen_random_uuid(),
  bom_id          uuid not null references public.boms(id) on delete cascade,
  item_id         uuid references public.items(id) on delete set null,
  label           text,                                     -- used when item_id is null
  quantity_needed integer not null default 1 check (quantity_needed > 0),
  notes           text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  -- Either a real item or a free-text label must be provided
  constraint bom_items_target_check check (item_id is not null or label is not null)
);

create index if not exists bom_items_bom_idx  on public.bom_items(bom_id);
create index if not exists bom_items_item_idx on public.bom_items(item_id);

-- RLS
alter table public.boms      enable row level security;
alter table public.bom_items enable row level security;

drop policy if exists "auth read boms"       on public.boms;
drop policy if exists "auth write boms"      on public.boms;
drop policy if exists "auth read bom_items"  on public.bom_items;
drop policy if exists "auth write bom_items" on public.bom_items;

create policy "auth read boms"       on public.boms      for select to authenticated using (true);
create policy "auth write boms"      on public.boms      for all    to authenticated using (true) with check (true);
create policy "auth read bom_items"  on public.bom_items for select to authenticated using (true);
create policy "auth write bom_items" on public.bom_items for all    to authenticated using (true) with check (true);
