insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-draft-images',
  'seller-draft-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists seller_draft_images_owner_insert on storage.objects;
-- New private draft objects may only be created for an inactive seller owned
-- by the authenticated user. Published/active sellers must use finalization.
create policy seller_draft_images_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'seller-draft-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (storage.foldername(name))[3] ~ '^[0-9]+$'
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.sellers s
    where s.id::text = (storage.foldername(name))[3]
      and s.auth_id = auth.uid()
      and s.active = false
  )
);

drop policy if exists seller_draft_images_owner_select on storage.objects;
-- Ownership remains sufficient for reads after activation so the seller can
-- preview or recover any residual private draft object.
create policy seller_draft_images_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'seller-draft-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (storage.foldername(name))[3] ~ '^[0-9]+$'
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.sellers s
    where s.id::text = (storage.foldername(name))[3]
      and s.auth_id = auth.uid()
  )
);

drop policy if exists seller_draft_images_owner_delete on storage.objects;
-- Ownership remains sufficient for deletes after activation so residual
-- private draft objects can still be cleaned up safely.
create policy seller_draft_images_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'seller-draft-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (storage.foldername(name))[3] ~ '^[0-9]+$'
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.sellers s
    where s.id::text = (storage.foldername(name))[3]
      and s.auth_id = auth.uid()
  )
);
