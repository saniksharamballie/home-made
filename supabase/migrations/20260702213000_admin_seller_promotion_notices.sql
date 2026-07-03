-- Add seller-visible admin promotion notices for tier/status changes.

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
  prior_tier text;
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
    'adminTierUntil', now() + interval '30 days',
    'adminTierNotice',
      case
        when clean_role = 'seller' and clean_tier <> coalesce(prior_tier, 'standard')
          then 'Your Home-Made seller profile has been boosted to ' || initcap(clean_tier) || ' for this promotion period.'
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

revoke execute on function public.home_made_admin_update_account(uuid, text, text, bigint, boolean) from PUBLIC;
revoke execute on function public.home_made_admin_update_account(uuid, text, text, bigint, boolean) from anon;
grant execute on function public.home_made_admin_update_account(uuid, text, text, bigint, boolean) to authenticated;

-- Rollback notes:
-- Restore the previous public.home_made_admin_update_account(uuid, text, text, bigint, boolean)
-- definition from the earlier admin account controls migration; do not guess replacement SQL.
