-- Admin tier periods, birthday-month boosts, and seller birthdate locking.

drop function if exists public.home_made_admin_accounts();

create or replace function public.home_made_admin_accounts()
returns table (
  account_id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz,
  updated_at timestamptz,
  buyer_id uuid,
  buyer_name text,
  buyer_phone text,
  seller_id bigint,
  seller_name text,
  seller_region text,
  seller_category text,
  seller_tier text,
  seller_active boolean,
  has_seller boolean,
  seller_data jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select
    p.id as account_id,
    coalesce(p.email, b.email, s.email) as email,
    coalesce(p.display_name, b.name, s.name) as display_name,
    p.role,
    p.created_at,
    p.updated_at,
    b.id as buyer_id,
    b.name as buyer_name,
    b.phone as buyer_phone,
    s.id as seller_id,
    s.name as seller_name,
    s.region as seller_region,
    s.category as seller_category,
    s.tier as seller_tier,
    s.active as seller_active,
    (s.id is not null) as has_seller,
    s.data as seller_data
  from public.profiles p
  left join public.buyers b on b.auth_id = p.id
  left join lateral (
    select ss.*
    from public.sellers ss
    where ss.auth_id = p.id
    order by ss.updated_at desc nulls last, ss.id desc
    limit 1
  ) s on true
  union all
  select
    null::uuid as account_id,
    s.email,
    s.name as display_name,
    'seller'::text as role,
    s.created_at,
    s.updated_at,
    null::uuid as buyer_id,
    null::text as buyer_name,
    null::text as buyer_phone,
    s.id as seller_id,
    s.name as seller_name,
    s.region as seller_region,
    s.category as seller_category,
    s.tier as seller_tier,
    s.active as seller_active,
    true as has_seller,
    s.data as seller_data
  from public.sellers s
  where s.auth_id is null
  order by created_at desc nulls last;
end;
$$;

revoke execute on function public.home_made_admin_accounts() from PUBLIC;
revoke execute on function public.home_made_admin_accounts() from anon;
grant execute on function public.home_made_admin_accounts() to authenticated;

drop function if exists public.home_made_admin_update_account(uuid, text, text, bigint, boolean);
drop function if exists public.home_made_admin_update_account(uuid, text, text, bigint, boolean, timestamptz, boolean);

create or replace function public.home_made_admin_update_account(
  target_user_id uuid,
  new_role text default null,
  seller_tier text default null,
  target_seller_id bigint default null,
  seller_active boolean default null,
  promotion_until timestamptz default null,
  promotion_permanent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  profile_row public.profiles%rowtype;
  clean_role text;
  clean_tier text;
  selected_seller_id bigint;
  request_payload jsonb;
  prior_tier text;
  tier_until timestamptz;
  tier_permanent boolean;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if target_user_id is null then
    raise exception 'Target user is required' using errcode = '22023';
  end if;

  select *
  into profile_row
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Account profile not found' using errcode = 'P0002';
  end if;

  clean_role := lower(coalesce(nullif(trim(new_role), ''), profile_row.role, 'buyer'));
  if clean_role not in ('buyer', 'seller', 'admin') then
    raise exception 'Invalid role: %', clean_role using errcode = '22023';
  end if;

  if target_user_id = auth.uid() and clean_role <> 'admin' then
    raise exception 'You cannot remove your own admin role' using errcode = '42501';
  end if;

  clean_tier := lower(coalesce(nullif(trim(seller_tier), ''), 'standard'));
  if clean_tier not in ('standard', 'gold', 'platinum') then
    raise exception 'Invalid seller tier: %', clean_tier using errcode = '22023';
  end if;

  tier_permanent := coalesce(promotion_permanent, false);
  tier_until := case
    when tier_permanent then null
    else coalesce(promotion_until, now() + interval '30 days')
  end;

  update public.profiles
  set role = clean_role,
      updated_at = now()
  where id = target_user_id;

  if target_seller_id is not null then
    select public.sellers.tier into prior_tier from public.sellers where public.sellers.id = target_seller_id;
  else
    select tier
    into prior_tier
    from public.sellers
    where auth_id = target_user_id
    order by updated_at desc nulls last, id desc
    limit 1;
  end if;

  request_payload := jsonb_build_object(
    'adminAccountUpdatedAt', now(),
    'adminAccountUpdatedBy', auth.uid(),
    'adminRole', clean_role,
    'adminTier', clean_tier,
    'adminTierPrevious', coalesce(prior_tier, 'standard'),
    'adminTierUntil', tier_until,
    'adminTierPermanent', tier_permanent,
    'adminTierNotice',
      case
        when clean_role = 'seller' and clean_tier <> coalesce(prior_tier, 'standard') and tier_permanent
          then 'Your Home-Made seller profile has been set to ' || initcap(clean_tier) || ' Seller.'
        when clean_role = 'seller' and clean_tier <> coalesce(prior_tier, 'standard')
          then 'Your Home-Made seller profile has been boosted to ' || initcap(clean_tier) || ' Seller until ' || to_char(tier_until at time zone 'Africa/Johannesburg', 'DD Mon YYYY HH24:MI') || '.'
        when clean_role = 'seller'
          then 'Your Home-Made seller profile settings were updated by admin.'
        else 'Your Home-Made account role was updated by admin.'
      end
  );

  if clean_role = 'buyer' then
    update public.sellers
    set auth_id = null,
        active = coalesce(seller_active, false),
        data = coalesce(data, '{}'::jsonb) || request_payload,
        updated_at = now()
    where auth_id = target_user_id;

    return jsonb_build_object('ok', true, 'role', clean_role);
  end if;

  if clean_role = 'seller' then
    if target_seller_id is not null then
      update public.sellers
      set auth_id = null,
          updated_at = now()
      where auth_id = target_user_id
        and id <> target_seller_id;

      update public.sellers
      set auth_id = target_user_id,
          email = coalesce(profile_row.email, public.sellers.email),
          name = coalesce(nullif(public.sellers.name, ''), nullif(profile_row.display_name, ''), split_part(coalesce(profile_row.email, ''), '@', 1), 'Home-Made Seller'),
          seller = coalesce(nullif(public.sellers.seller, ''), nullif(profile_row.display_name, ''), split_part(coalesce(profile_row.email, ''), '@', 1), 'Home Chef'),
          tier = clean_tier,
          active = coalesce(seller_active, true),
          data = coalesce(public.sellers.data, '{}'::jsonb) || request_payload,
          updated_at = now()
      where id = target_seller_id
      returning id into selected_seller_id;
    else
      select id
      into selected_seller_id
      from public.sellers
      where auth_id = target_user_id
      order by updated_at desc nulls last, id desc
      limit 1;

      if selected_seller_id is not null then
        update public.sellers
        set tier = clean_tier,
            active = coalesce(seller_active, public.sellers.active),
            data = coalesce(data, '{}'::jsonb) || request_payload,
            updated_at = now()
        where id = selected_seller_id;
      else
        insert into public.sellers (auth_id, email, name, seller, region, category, tier, active, data)
        values (
          target_user_id,
          profile_row.email,
          coalesce(nullif(profile_row.display_name, ''), split_part(coalesce(profile_row.email, ''), '@', 1), 'Home-Made Seller'),
          coalesce(nullif(profile_row.display_name, ''), split_part(coalesce(profile_row.email, ''), '@', 1), 'Home Chef'),
          'Durban CBD',
          'african',
          clean_tier,
          coalesce(seller_active, true),
          request_payload
        )
        returning id into selected_seller_id;
      end if;
    end if;

    if selected_seller_id is null then
      raise exception 'Seller listing could not be linked' using errcode = 'P0002';
    end if;

    update public.seller_access_requests
    set status = 'approved',
        admin_notes = coalesce(nullif(admin_notes, ''), 'Approved through admin account controls.'),
        updated_at = now()
    where user_id = target_user_id
      and status = 'pending';

    return jsonb_build_object('ok', true, 'role', clean_role, 'seller_id', selected_seller_id);
  end if;

  return jsonb_build_object('ok', true, 'role', clean_role);
end;
$$;

revoke execute on function public.home_made_admin_update_account(uuid, text, text, bigint, boolean, timestamptz, boolean) from PUBLIC;
revoke execute on function public.home_made_admin_update_account(uuid, text, text, bigint, boolean, timestamptz, boolean) from anon;
grant execute on function public.home_made_admin_update_account(uuid, text, text, bigint, boolean, timestamptz, boolean) to authenticated;

create or replace function public.home_made_preserve_seller_birthdate()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  old_dob text;
  new_dob text;
  is_admin boolean;
begin
  old_dob := nullif(coalesce(old.data->>'sellerBirthMonth', old.data->>'birthMonth', old.data->>'sellerDob', old.data->>'dateOfBirth', old.data->>'dob', old.data->>'birthDate'), '');
  new_dob := nullif(coalesce(new.data->>'sellerBirthMonth', new.data->>'birthMonth', new.data->>'sellerDob', new.data->>'dateOfBirth', new.data->>'dob', new.data->>'birthDate'), '');

  if old_dob is not null and coalesce(new_dob, '') <> old_dob then
    select exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    ) into is_admin;

    if not coalesce(is_admin, false) then
      if old_dob ~ '^\d{1,2}$' then
        new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{sellerBirthMonth}', to_jsonb(old_dob), true);
        new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{birthMonth}', to_jsonb(old_dob), true);
      else
        new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{sellerDob}', to_jsonb(old_dob), true);
        new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{dateOfBirth}', to_jsonb(old_dob), true);
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sellers_preserve_birthdate on public.sellers;
create trigger sellers_preserve_birthdate
before update of data on public.sellers
for each row
execute function public.home_made_preserve_seller_birthdate();

create or replace view public.seller_directory
with (security_invoker = true)
as
select
  id,
  name,
  seller,
  region,
  category,
  case
    when coalesce(data->>'sellerBirthMonth', data->>'birthMonth') ~ '^\d{1,2}$'
      and coalesce(data->>'sellerBirthMonth', data->>'birthMonth')::int = extract(month from now())::int
      then 'platinum'
    when coalesce(data->>'sellerDob', data->>'dateOfBirth', data->>'dob', data->>'birthDate') ~ '^\d{4}-\d{2}-\d{2}'
      and extract(month from to_date(coalesce(data->>'sellerDob', data->>'dateOfBirth', data->>'dob', data->>'birthDate'), 'YYYY-MM-DD')) = extract(month from now())
      then 'platinum'
    else tier
  end as tier,
  wa,
  (
    coalesce(data, '{}'::jsonb) - array[
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
      'coords',
      'sellerDob',
      'dateOfBirth',
      'dob',
      'birthDate',
      'sellerBirthMonth',
      'birthMonth',
      'birthdayLockedAt',
      'idNumber',
      'id_number'
    ]::text[]
  ) || jsonb_build_object(
    'baseTier', tier,
    'birthdayMonthBoost',
    case
      when coalesce(data->>'sellerBirthMonth', data->>'birthMonth') ~ '^\d{1,2}$'
        then coalesce(data->>'sellerBirthMonth', data->>'birthMonth')::int = extract(month from now())::int
      when coalesce(data->>'sellerDob', data->>'dateOfBirth', data->>'dob', data->>'birthDate') ~ '^\d{4}-\d{2}-\d{2}'
        then extract(month from to_date(coalesce(data->>'sellerDob', data->>'dateOfBirth', data->>'dob', data->>'birthDate'), 'YYYY-MM-DD')) = extract(month from now())
      else false
    end
  ) as data,
  active,
  updated_at
from public.sellers
where active = true;

grant select on public.seller_directory to anon, authenticated;

comment on view public.seller_directory is
  'Public marketplace-safe seller projection. Birthday and ID details are private; birthday-month Platinum is projected without exposing the date.';

-- Rollback notes:
-- Restore public.home_made_admin_accounts(), public.seller_directory, and the prior
-- public.home_made_admin_update_account(uuid, text, text, bigint, boolean) definition from
-- earlier migration versions; remove trigger sellers_preserve_birthdate on public.sellers and function
-- public.home_made_preserve_seller_birthdate() if rolling back birthday locking.
-- Do not guess rollback SQL; take it from the earlier migration version being restored.
-- Future performance consideration: consider an index on sellers(auth_id, updated_at desc, id desc)
-- if admin account listing becomes slow at scale.
