-- Enable Supabase realtime broadcasts for HawkVentory tables.
-- Tables created via SQL aren't auto-added to supabase_realtime, so our
-- postgres_changes subscriptions silently get no events. This fixes that.

do $$
declare
  t text;
begin
  for t in select unnest(array['items','locations','boms','bom_items']) loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
