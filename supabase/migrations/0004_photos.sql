-- Storage bucket for optional item photos.
-- Bucket is public-read so <img src=...> works without signed URLs;
-- writes still require an authenticated user via RLS policies below.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-photos',
  'item-photos',
  true,
  5242880,  -- 5 MB
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "auth upload item-photos" on storage.objects;
drop policy if exists "auth update item-photos" on storage.objects;
drop policy if exists "auth delete item-photos" on storage.objects;

create policy "auth upload item-photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-photos');

create policy "auth update item-photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-photos') with check (bucket_id = 'item-photos');

create policy "auth delete item-photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-photos');
