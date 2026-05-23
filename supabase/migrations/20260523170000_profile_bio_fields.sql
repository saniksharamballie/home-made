alter table public.buyers
  add column if not exists data jsonb not null default '{}'::jsonb;

drop policy if exists "seller_images_client_upload" on storage.objects;
create policy "seller_images_client_upload"
on storage.objects
for insert
with check (
  bucket_id = 'seller-images'
  and (storage.foldername(name))[1] in ('listing-uploads', 'seller-profiles', 'buyer-profiles')
);
