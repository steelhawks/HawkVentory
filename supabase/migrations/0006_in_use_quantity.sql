-- Convert items.in_use from boolean → integer count.
--   Before: in_use bool      → "this part is allocated, all of stock"
--   After:  in_use integer   → "N of `quantity` are currently allocated"
-- Migration is lossless: items previously flagged in_use carry over with
-- in_use = quantity (i.e. all units allocated). Untouched items get 0.

alter table public.items alter column in_use drop default;

alter table public.items
  alter column in_use type integer using (case when in_use then quantity else 0 end);

alter table public.items alter column in_use set default 0;
alter table public.items alter column in_use set not null;

-- 0 ≤ in_use ≤ quantity
alter table public.items drop constraint if exists items_in_use_range;
alter table public.items
  add constraint items_in_use_range check (in_use >= 0 and in_use <= quantity);

-- Replace the old boolean index with a partial integer index on rows that matter.
drop index if exists items_in_use_idx;
create index items_in_use_idx on public.items (in_use) where in_use > 0;
