-- Launch scaling and privacy hardening for the public marketplace directory.

create index if not exists idx_sellers_public_directory
on public.sellers (active, tier, name);

create index if not exists idx_sellers_public_region
on public.sellers (active, region, category);

create index if not exists idx_sellers_public_category
on public.sellers (active, category, tier);

create index if not exists idx_sellers_updated_at
on public.sellers (updated_at desc);

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
    'addressLine',
    'address_line',
    'exactAddress',
    'exact_address',
    'paymentInfo',
    'payment_info',
    'bank',
    'bankAccount',
    'bank_account',
    'accountNumber',
    'account_number',
    'contactEmail',
    'contact_email',
    'email',
    'phone',
    'mobile',
    'telephone',
    'lat',
    'lng',
    'latitude',
    'longitude',
    'coordinates',
    'coord',
    'coords'
  ]::text[] as data,
  active,
  updated_at
from public.sellers
where active = true;

grant select on public.seller_directory to anon, authenticated;

comment on view public.seller_directory is
  'Public marketplace-safe seller projection. Keep this view lean and avoid exact addresses, bank details, private contact data, or raw coordinates.';
