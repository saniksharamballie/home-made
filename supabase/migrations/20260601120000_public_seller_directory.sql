create or replace view public.seller_directory
with (security_invoker = true)
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

comment on view public.seller_directory is
  'Privacy-safe public seller fields for storefront pages and approximate map pins. Exact addresses, payment details and coordinates remain private.';
