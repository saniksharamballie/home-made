insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-images',
  'seller-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "seller_images_public_read" on storage.objects;
create policy "seller_images_public_read"
on storage.objects
for select
using (bucket_id = 'seller-images');

drop policy if exists "seller_images_client_upload" on storage.objects;
create policy "seller_images_client_upload"
on storage.objects
for insert
with check (
  bucket_id = 'seller-images'
  and (storage.foldername(name))[1] in ('listing-uploads', 'seller-profiles')
);
