-- Admin account controls and signup duplicate-email check.
-- These functions keep sensitive account changes behind admin-only RPCs.

create or replace function public.home_made_account_exists(check_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  clean_email text := lower(trim(coalesce(check_email, '')));
  found_account boolean := false;
begin
  if clean_email = '' or position('@' in clean_email) < 2 then
    return jsonb_build_object('exists', false);
  end if;

  select exists (
    select 1 from auth.users u where lower(u.email) = clean_email
  )
  or exists (
    select 1 from public.profiles p where lower(p.email) = clean_email
  )
  or exists (
    select 1 from public.buyers b where lower(b.email) = clean_email
  )
  or exists (
    select 1 from public.sellers s where lower(s.email) = clean_email
  )
  into found_account;

  return jsonb_build_object('exists', found_account);
end;
$$;

grant execute on function public.home_made_account_exists(text) to anon, authenticated;

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
  has_seller boolean
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
    (s.id is not null) as has_seller
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
    true as has_seller
  from public.sellers s
  where s.auth_id is null
  order by created_at desc nulls last;
end;
$$;

grant execute on function public.home_made_admin_accounts() to authenticated;

create or replace function public.home_made_admin_update_account(
  target_user_id uuid,
  new_role text default null,
  seller_tier text default null,
  target_seller_id bigint default null,
  seller_active boolean default null
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

  update public.profiles
  set role = clean_role,
      updated_at = now()
  where id = target_user_id;

  request_payload := jsonb_build_object(
    'adminAccountUpdatedAt', now(),
    'adminAccountUpdatedBy', auth.uid(),
    'adminRole', clean_role,
    'adminTier', clean_tier
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
            active = coalesce(seller_active, active),
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

grant execute on function public.home_made_admin_update_account(uuid, text, text, bigint, boolean) to authenticated;

create or replace function public.home_made_admin_delete_account(
  target_user_id uuid,
  delete_confirm text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  profile_row public.profiles%rowtype;
  expected text;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot delete your own admin account' using errcode = '42501';
  end if;

  select *
  into profile_row
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Account profile not found' using errcode = 'P0002';
  end if;

  expected := 'DELETE ' || coalesce(profile_row.email, target_user_id::text);
  if trim(coalesce(delete_confirm, '')) <> expected then
    raise exception 'Delete confirmation did not match' using errcode = '22023';
  end if;

  update public.sellers
  set auth_id = null,
      active = false,
      data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
        'adminAccountDeletedAt', now(),
        'adminAccountDeletedBy', auth.uid()
      ),
      updated_at = now()
  where auth_id = target_user_id;

  delete from public.seller_access_requests where user_id = target_user_id;
  delete from public.buyers where auth_id = target_user_id;
  delete from public.profiles where id = target_user_id;
  delete from auth.users where id = target_user_id;

  return jsonb_build_object('ok', true, 'deleted_user_id', target_user_id);
end;
$$;

grant execute on function public.home_made_admin_delete_account(uuid, text) to authenticated;

-- Remove remaining demo SVG advert references from live seller data.
update public.sellers
set data = jsonb_set(coalesce(data, '{}'::jsonb), '{img}', to_jsonb('/images/home-passion-income.jpeg'::text), true),
    updated_at = now()
where lower(coalesce(data->>'img', '')) like '%/demo-ads/%'
   or lower(coalesce(data->>'img', '')) like '%demo-ad%'
   or lower(coalesce(data->>'img', '')) like '%.svg%';

update public.sellers
set data = jsonb_set(coalesce(data, '{}'::jsonb), '{storePic}', to_jsonb('/images/home-passion-income.jpeg'::text), true),
    updated_at = now()
where lower(coalesce(data->>'storePic', '')) like '%/demo-ads/%'
   or lower(coalesce(data->>'storePic', '')) like '%demo-ad%'
   or lower(coalesce(data->>'storePic', '')) like '%.svg%';
