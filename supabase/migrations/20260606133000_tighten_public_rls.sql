-- Tighten public API exposure now that privacy-safe views and backend API routes exist.

-- Keep the public directory readable without exposing full seller rows.
-- The view intentionally projects only marketplace-safe fields.
create or replace view public.seller_directory
as
select
  id,
  name,
  seller,
  region,
  category,
  tier,
  wa,
  data - array[
    'address',
    'paymentInfo',
    'contactEmail',
    'phone'
  ]::text[] as data,
  active,
  updated_at
from public.sellers
where active = true;

grant select on public.seller_directory to anon, authenticated;

-- Do not expose raw seller rows to anonymous API clients.
revoke all on table public.sellers from anon;

drop policy if exists sellers_public_read on public.sellers;
drop policy if exists sellers_select_owner_admin on public.sellers;
create policy sellers_select_owner_admin
on public.sellers
for select
to authenticated
using (
  auth_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

grant select, insert, update on table public.sellers to authenticated;

-- Public can view public marketplace images, but uploads should require login.
drop policy if exists "seller_images_client_upload" on storage.objects;
create policy "seller_images_client_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'seller-images'
  and (storage.foldername(name))[1] in ('listing-uploads', 'seller-profiles', 'buyer-profiles')
);
