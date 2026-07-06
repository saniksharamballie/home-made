-- Phase 1: add WhatsApp contact handoff support.
--
-- This migration is intentionally additive for a two-phase rollout. It creates
-- the private server-side rate-limit infrastructure and adds a public
-- hasWhatsApp capability flag, while temporarily keeping seller_directory.wa
-- and seller_directory.data->'wa' for currently deployed clients.
--
-- IMPORTANT: top-level wa and data.wa must be removed only by the later
-- Phase 2 migration after the new API/frontend has been verified in production.

create table if not exists public.contact_handoff_rate_limits (
  client_hash text not null,
  window_seconds integer not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_hash, window_seconds, window_start),
  constraint contact_handoff_client_hash_shape check (client_hash ~ '^[a-f0-9]{64}$'),
  constraint contact_handoff_window_seconds_positive check (window_seconds > 0),
  constraint contact_handoff_request_count_nonnegative check (request_count >= 0)
);

alter table public.contact_handoff_rate_limits enable row level security;

revoke all on table public.contact_handoff_rate_limits from public;
revoke all on table public.contact_handoff_rate_limits from anon;
revoke all on table public.contact_handoff_rate_limits from authenticated;

grant select, insert, update, delete on table public.contact_handoff_rate_limits to service_role;

create or replace function public.home_made_contact_handoff_rate_limit(
  input_client_hash text,
  input_window_seconds integer,
  input_max_requests integer,
  input_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_hash text := lower(coalesce(input_client_hash, ''));
  clean_window integer := coalesce(input_window_seconds, 0);
  clean_max integer := coalesce(input_max_requests, 0);
  clean_now timestamptz := coalesce(input_now, now());
  bucket_start timestamptz;
  new_count integer;
begin
  if clean_hash !~ '^[a-f0-9]{64}$' or clean_window <= 0 or clean_max <= 0 then
    return false;
  end if;

  delete from public.contact_handoff_rate_limits old_rows
  where old_rows.ctid in (
    select rl.ctid
    from public.contact_handoff_rate_limits rl
    where rl.window_start < clean_now - interval '2 days'
    order by rl.window_start asc
    limit 250
  );

  bucket_start := to_timestamp(
    floor(extract(epoch from clean_now) / clean_window) * clean_window
  );

  insert into public.contact_handoff_rate_limits (
    client_hash,
    window_seconds,
    window_start,
    request_count,
    created_at,
    updated_at
  )
  values (
    clean_hash,
    clean_window,
    bucket_start,
    1,
    clean_now,
    clean_now
  )
  on conflict (client_hash, window_seconds, window_start)
  do update set
    request_count = public.contact_handoff_rate_limits.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into new_count;

  return new_count <= clean_max;
end;
$$;

revoke all on function public.home_made_contact_handoff_rate_limit(text, integer, integer, timestamptz) from public;
revoke all on function public.home_made_contact_handoff_rate_limit(text, integer, integer, timestamptz) from anon;
revoke all on function public.home_made_contact_handoff_rate_limit(text, integer, integer, timestamptz) from authenticated;
grant execute on function public.home_made_contact_handoff_rate_limit(text, integer, integer, timestamptz) to service_role;

-- Sanitize public seller image structures in the privacy-safe directory.
--
-- The helpers below are deterministic JSON allowlist functions. They perform
-- no table access, use no dynamic SQL, and intentionally run without
-- SECURITY DEFINER. Anonymous directory reads need EXECUTE because the
-- security-definer-like owner-access view calls these functions while serving
-- public marketplace data.

create or replace function public.home_made_public_image_value(input_value jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when input_value is null or jsonb_typeof(input_value) = 'null' then null::jsonb
    when jsonb_typeof(input_value) = 'string' then input_value
    when jsonb_typeof(input_value) = 'object' then nullif(
      jsonb_strip_nulls(jsonb_build_object(
        'url', input_value->'url',
        'src', input_value->'src',
        'image', input_value->'image',
        'img', input_value->'img',
        'photo', input_value->'photo',
        'imageUrl', input_value->'imageUrl',
        'image_url', input_value->'image_url',
        'photoUrl', input_value->'photoUrl',
        'photo_url', input_value->'photo_url',
        'name', input_value->'name',
        'title', input_value->'title',
        'item', input_value->'item',
        'itemName', input_value->'itemName',
        'item_name', input_value->'item_name',
        'alt', input_value->'alt',
        'caption', input_value->'caption',
        'width', input_value->'width',
        'height', input_value->'height',
        'order', input_value->'order',
        'sortOrder', input_value->'sortOrder',
        'sort_order', input_value->'sort_order'
      )),
      '{}'::jsonb
    )
    else null::jsonb
  end;
$$;

create or replace function public.home_made_public_image_array(input_value jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when jsonb_typeof(input_value) = 'array' then coalesce(
      (
        select jsonb_agg(cleaned.image_value order by image_item.ordinality)
        from jsonb_array_elements(input_value) with ordinality as image_item(value, ordinality)
        cross join lateral public.home_made_public_image_value(image_item.value) as cleaned(image_value)
        where cleaned.image_value is not null
      ),
      '[]'::jsonb
    )
    else null::jsonb
  end;
$$;

revoke all on function public.home_made_public_image_value(jsonb) from public;
revoke all on function public.home_made_public_image_array(jsonb) from public;
grant execute on function public.home_made_public_image_value(jsonb) to anon, authenticated;
grant execute on function public.home_made_public_image_array(jsonb) to anon, authenticated;

create or replace view public.seller_directory
with (security_barrier = true, security_invoker = false)
as
select
  s.id,
  s.name,
  s.seller,
  s.region,
  s.category,
  case
    when coalesce(s.data->>'sellerBirthMonth', s.data->>'birthMonth') ~ '^\d{1,2}$'
      and coalesce(s.data->>'sellerBirthMonth', s.data->>'birthMonth')::int = extract(month from now())::int
      then 'platinum'
    when coalesce(s.data->>'sellerDob', s.data->>'dateOfBirth', s.data->>'dob', s.data->>'birthDate') ~ '^\d{4}-\d{2}-\d{2}'
      and extract(month from to_date(coalesce(s.data->>'sellerDob', s.data->>'dateOfBirth', s.data->>'dob', s.data->>'birthDate'), 'YYYY-MM-DD')) = extract(month from now())
      then 'platinum'
    else s.tier
  end as tier,
  -- Phase 1 temporary compatibility: old production clients still read this
  -- top-level wa field directly. Remove only in the later Phase 2 migration.
  s.wa,
  jsonb_strip_nulls(
    jsonb_build_object(
    'name', to_jsonb(s.name),
    'seller', to_jsonb(s.seller),
    'cat', coalesce(s.data->'cat', to_jsonb(s.category)),
    'category', to_jsonb(s.category),
    'region', to_jsonb(s.region),
    'tier', to_jsonb(s.tier),
    'baseTier', to_jsonb(s.tier),
    -- Phase 1 temporary compatibility: old production clients still read
    -- data.wa directly. Remove only in the later Phase 2 migration.
    'wa', to_jsonb(s.wa),
    'hasWhatsApp', to_jsonb(length(regexp_replace(coalesce(s.wa, ''), '\D', '', 'g')) between 9 and 15),
    'desc', s.data->'desc',
    'bio', s.data->'bio',
    'description', s.data->'description',
    'dietary', s.data->'dietary',
    'dietaryTags', s.data->'dietaryTags',
    'dietary_tags', s.data->'dietary_tags',
    'healthTags', s.data->'healthTags',
    'health_tags', s.data->'health_tags',
    'del', s.data->'del',
    'delivery', s.data->'delivery',
    'pu', s.data->'pu',
    'pickup', s.data->'pickup',
    'fee', s.data->'fee',
    'deliveryFee', s.data->'deliveryFee',
    'delivery_fee', s.data->'delivery_fee',
    'minOrder', s.data->'minOrder',
    'maxOrder', s.data->'maxOrder',
    'leadDays', s.data->'leadDays',
    'pricingModel', s.data->'pricingModel',
    'eventTypes', s.data->'eventTypes',
    'serviceTypes', s.data->'serviceTypes',
    'cookingStyle', s.data->'cookingStyle',
    'setupIncluded', s.data->'setupIncluded',
    'equipmentProvided', s.data->'equipmentProvided',
    'depositPct', s.data->'depositPct',
    'travelRadius', s.data->'travelRadius',
    'cancellationPolicy', s.data->'cancellationPolicy',
    'pickupType', s.data->'pickupType',
    'img', public.home_made_public_image_value(s.data->'img'),
    'storePic', public.home_made_public_image_value(s.data->'storePic'),
    'store_pic', public.home_made_public_image_value(s.data->'store_pic'),
    'image', public.home_made_public_image_value(s.data->'image')
    ) ||
    jsonb_build_object(
    'image_url', public.home_made_public_image_value(s.data->'image_url'),
    'photo', public.home_made_public_image_value(s.data->'photo'),
    'photoUrl', public.home_made_public_image_value(s.data->'photoUrl'),
    'photo_url', public.home_made_public_image_value(s.data->'photo_url'),
    'heroImage', public.home_made_public_image_value(s.data->'heroImage'),
    'hero_image', public.home_made_public_image_value(s.data->'hero_image'),
    'avatar', public.home_made_public_image_value(s.data->'avatar'),
    'icon', public.home_made_public_image_value(s.data->'icon'),
    'images', public.home_made_public_image_array(s.data->'images'),
    'gallery', public.home_made_public_image_array(s.data->'gallery'),
    'storeImages', public.home_made_public_image_array(s.data->'storeImages'),
    'store_images', public.home_made_public_image_array(s.data->'store_images'),
    'photos', public.home_made_public_image_array(s.data->'photos'),
    'photoUrls', public.home_made_public_image_array(s.data->'photoUrls'),
    'photo_urls', public.home_made_public_image_array(s.data->'photo_urls'),
    'menuImages', public.home_made_public_image_array(s.data->'menuImages'),
    'menu_images', public.home_made_public_image_array(s.data->'menu_images'),
    'itemImages', public.home_made_public_image_array(s.data->'itemImages'),
    'item_images', public.home_made_public_image_array(s.data->'item_images'),
    'listingImages', public.home_made_public_image_array(s.data->'listingImages'),
    'listing_images', public.home_made_public_image_array(s.data->'listing_images'),
    'items', public_items.items,
    'menu', public_menu.items,
    'menuItems', public_menu_items.items,
    'menu_items', public_menu_items_snake.items,
    'discounts', s.data->'discounts',
    'availability', s.data->'availability',
    'campaign', s.data->'campaign',
    'dailyMenus',
      case
        when s.data->'dailyMenus' ? today.menu_key then
          jsonb_build_object(
            today.menu_key,
            jsonb_strip_nulls(jsonb_build_object(
              'items', today_menu.items,
              'discounts', s.data #> array['dailyMenus', today.menu_key, 'discounts']
            ))
          )
        else '{}'::jsonb
      end,
    'sch', s.data->'sch',
    'schedule', s.data->'schedule',
    'rat', s.data->'rat',
    'rating', s.data->'rating',
    'rev', s.data->'rev',
    'reviews', s.data->'reviews',
    'ord', s.data->'ord',
    'orders', s.data->'orders',
    'e', s.data->'e',
    'emoji', s.data->'emoji',
    'bg', s.data->'bg'
    ) ||
    jsonb_build_object(
    'background', s.data->'background',
    'ec', s.data->'ec',
    'cx', s.data->'cx',
    'yr', s.data->'yr',
    'year', s.data->'year',
    'verified', s.data->'verified',
    'special', s.data->'special',
    'birthdayMonthBoost',
    case
      when coalesce(s.data->>'sellerBirthMonth', s.data->>'birthMonth') ~ '^\d{1,2}$'
        then coalesce(s.data->>'sellerBirthMonth', s.data->>'birthMonth')::int = extract(month from now())::int
      when coalesce(s.data->>'sellerDob', s.data->>'dateOfBirth', s.data->>'dob', s.data->>'birthDate') ~ '^\d{4}-\d{2}-\d{2}'
        then extract(month from to_date(coalesce(s.data->>'sellerDob', s.data->>'dateOfBirth', s.data->>'dob', s.data->>'birthDate'), 'YYYY-MM-DD')) = extract(month from now())
      else false
    end
    )
  ) as data,
  s.active,
  s.updated_at,
  length(regexp_replace(coalesce(s.wa, ''), '\D', '', 'g')) between 9 and 15 as "hasWhatsApp"
from public.sellers s
cross join lateral (
  select (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from now())::int + 1] as menu_key
) today
cross join lateral (
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'n', item.value->'n',
    'name', item.value->'name',
    'title', item.value->'title',
    'item', item.value->'item',
    'item_name', item.value->'item_name',
    'p', item.value->'p',
    'price', item.value->'price',
    'amount', item.value->'amount',
    'svs', item.value->'svs',
    'serves', item.value->'serves',
    'serving', item.value->'serving',
    'portion', item.value->'portion',
    'hot', item.value->'hot',
    'img', public.home_made_public_image_value(item.value->'img'),
    'image', public.home_made_public_image_value(item.value->'image'),
    'image_url', public.home_made_public_image_value(item.value->'image_url'),
    'photo', public.home_made_public_image_value(item.value->'photo'),
    'photoUrl', public.home_made_public_image_value(item.value->'photoUrl'),
    'photo_url', public.home_made_public_image_value(item.value->'photo_url')
  ))) as items
  from jsonb_array_elements(
    case when jsonb_typeof(s.data->'items') = 'array' then s.data->'items' else '[]'::jsonb end
  ) item
) public_items
cross join lateral (
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'n', item.value->'n',
    'name', item.value->'name',
    'title', item.value->'title',
    'item', item.value->'item',
    'item_name', item.value->'item_name',
    'p', item.value->'p',
    'price', item.value->'price',
    'amount', item.value->'amount',
    'svs', item.value->'svs',
    'serves', item.value->'serves',
    'serving', item.value->'serving',
    'portion', item.value->'portion',
    'hot', item.value->'hot',
    'img', public.home_made_public_image_value(item.value->'img'),
    'image', public.home_made_public_image_value(item.value->'image'),
    'image_url', public.home_made_public_image_value(item.value->'image_url'),
    'photo', public.home_made_public_image_value(item.value->'photo'),
    'photoUrl', public.home_made_public_image_value(item.value->'photoUrl'),
    'photo_url', public.home_made_public_image_value(item.value->'photo_url')
  ))) as items
  from jsonb_array_elements(
    case when jsonb_typeof(s.data->'menu') = 'array' then s.data->'menu' else '[]'::jsonb end
  ) item
) public_menu
cross join lateral (
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'n', item.value->'n',
    'name', item.value->'name',
    'title', item.value->'title',
    'item', item.value->'item',
    'item_name', item.value->'item_name',
    'p', item.value->'p',
    'price', item.value->'price',
    'amount', item.value->'amount',
    'svs', item.value->'svs',
    'serves', item.value->'serves',
    'serving', item.value->'serving',
    'portion', item.value->'portion',
    'hot', item.value->'hot',
    'img', public.home_made_public_image_value(item.value->'img'),
    'image', public.home_made_public_image_value(item.value->'image'),
    'image_url', public.home_made_public_image_value(item.value->'image_url'),
    'photo', public.home_made_public_image_value(item.value->'photo'),
    'photoUrl', public.home_made_public_image_value(item.value->'photoUrl'),
    'photo_url', public.home_made_public_image_value(item.value->'photo_url')
  ))) as items
  from jsonb_array_elements(
    case when jsonb_typeof(s.data->'menuItems') = 'array' then s.data->'menuItems' else '[]'::jsonb end
  ) item
) public_menu_items
cross join lateral (
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'n', item.value->'n',
    'name', item.value->'name',
    'title', item.value->'title',
    'item', item.value->'item',
    'item_name', item.value->'item_name',
    'p', item.value->'p',
    'price', item.value->'price',
    'amount', item.value->'amount',
    'svs', item.value->'svs',
    'serves', item.value->'serves',
    'serving', item.value->'serving',
    'portion', item.value->'portion',
    'hot', item.value->'hot',
    'img', public.home_made_public_image_value(item.value->'img'),
    'image', public.home_made_public_image_value(item.value->'image'),
    'image_url', public.home_made_public_image_value(item.value->'image_url'),
    'photo', public.home_made_public_image_value(item.value->'photo'),
    'photoUrl', public.home_made_public_image_value(item.value->'photoUrl'),
    'photo_url', public.home_made_public_image_value(item.value->'photo_url')
  ))) as items
  from jsonb_array_elements(
    case when jsonb_typeof(s.data->'menu_items') = 'array' then s.data->'menu_items' else '[]'::jsonb end
  ) item
) public_menu_items_snake
cross join lateral (
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'n', item.value->'n',
    'name', item.value->'name',
    'title', item.value->'title',
    'item', item.value->'item',
    'item_name', item.value->'item_name',
    'p', item.value->'p',
    'price', item.value->'price',
    'amount', item.value->'amount',
    'svs', item.value->'svs',
    'serves', item.value->'serves',
    'serving', item.value->'serving',
    'portion', item.value->'portion',
    'hot', item.value->'hot',
    'img', public.home_made_public_image_value(item.value->'img'),
    'image', public.home_made_public_image_value(item.value->'image'),
    'image_url', public.home_made_public_image_value(item.value->'image_url'),
    'photo', public.home_made_public_image_value(item.value->'photo'),
    'photoUrl', public.home_made_public_image_value(item.value->'photoUrl'),
    'photo_url', public.home_made_public_image_value(item.value->'photo_url')
  ))) as items
  from jsonb_array_elements(
    case
      when jsonb_typeof(s.data #> array['dailyMenus', today.menu_key, 'items']) = 'array'
        then s.data #> array['dailyMenus', today.menu_key, 'items']
      else '[]'::jsonb
    end
  ) item
) today_menu
where s.active = true;

revoke all on public.seller_directory from public;
revoke all on public.seller_directory from anon;
revoke all on public.seller_directory from authenticated;
grant select on public.seller_directory to anon;
grant select on public.seller_directory to authenticated;

comment on view public.seller_directory is
  'Phase 1 public seller projection. Temporarily keeps top-level wa and data.wa for old-client compatibility, adds hasWhatsApp for server-side handoff, and preserves image/menu allowlists. Phase 2 must remove public contact numbers after the new frontend/API is verified live.';

comment on function public.home_made_public_image_value(jsonb) is
  'Returns a single public image value from a strict allowlist of URL and display metadata fields. It performs no table access.';

comment on function public.home_made_public_image_array(jsonb) is
  'Returns a sanitized public image array, preserving string URL elements and allowlisted object display fields only. It performs no table access.';

comment on table public.contact_handoff_rate_limits is
  'Private service-role-only counters for WhatsApp contact handoff rate limiting. Stores only HMAC client hashes and coarse windows.';

comment on function public.home_made_contact_handoff_rate_limit(text, integer, integer, timestamptz) is
  'Atomically increments a private contact handoff counter for one HMAC client hash and returns whether the configured limit remains available.';
