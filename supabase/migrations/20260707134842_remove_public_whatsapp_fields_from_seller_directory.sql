-- Phase 2: final removal of temporary public WhatsApp compatibility fields.
--
-- Phase 1 intentionally kept seller_directory.wa and seller_directory.data->'wa'
-- while the server-side /api/contact-seller handoff and hasWhatsApp flag rolled
-- out. This forward-only migration removes those public bulk contact values
-- from the anonymous seller_directory projection while preserving the stored
-- public.sellers.wa value for protected owner/admin workflows and server-side
-- contact handoff.

drop view if exists public.seller_directory;

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
  jsonb_strip_nulls(
    jsonb_build_object(
    'name', to_jsonb(s.name),
    'seller', to_jsonb(s.seller),
    'cat', coalesce(s.data->'cat', to_jsonb(s.category)),
    'category', to_jsonb(s.category),
    'region', to_jsonb(s.region),
    'tier', to_jsonb(s.tier),
    'baseTier', to_jsonb(s.tier),
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
  'Phase 2 public seller projection. Removes the temporary top-level wa and data.wa compatibility fields from anonymous marketplace responses, retains hasWhatsApp for server-side handoff, and preserves image/menu allowlists.';
