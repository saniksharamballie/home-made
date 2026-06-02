drop policy if exists "seller_images_admin_hero_upload" on storage.objects;
create policy "seller_images_admin_hero_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'seller-images'
  and (storage.foldername(name))[1] = 'hero-gallery'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
