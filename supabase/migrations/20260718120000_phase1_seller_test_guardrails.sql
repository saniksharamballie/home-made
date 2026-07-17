-- Phase 1 seller-test guardrails.
-- Keep seller-access approval separate from public directory publication, and
-- harden admin seller RPC execute privileges. This migration is intentionally
-- safe to prepare locally; apply it only to the intended Supabase project.

create or replace function public.home_made_approve_seller_access_request(
  request_id uuid,
  seller_name text default null,
  seller_region text default null,
  seller_category text default null,
  seller_whatsapp text default null,
  existing_seller_id bigint default null,
  admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.seller_access_requests%rowtype;
  profile_row public.profiles%rowtype;
  target_seller_id bigint;
  clean_name text;
  clean_region text;
  clean_category text;
  clean_wa text;
  clean_seller text;
  request_payload jsonb;
  target_seller_active boolean;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select *
  into req
  from public.seller_access_requests
  where id = request_id
  for update;

  if not found then
    raise exception 'Seller access request not found' using errcode = 'P0002';
  end if;

  select *
  into profile_row
  from public.profiles
  where id = req.user_id;

  clean_name := coalesce(
    nullif(trim(seller_name), ''),
    nullif(trim(req.name), ''),
    nullif(trim(profile_row.display_name), ''),
    nullif(split_part(coalesce(profile_row.email, ''), '@', 1), ''),
    'Home-Made Seller'
  );
  clean_region := coalesce(nullif(trim(seller_region), ''), 'Durban CBD');
  clean_category := coalesce(nullif(trim(seller_category), ''), 'african');
  clean_wa := nullif(regexp_replace(coalesce(seller_whatsapp, ''), '[^0-9+]', '', 'g'), '');
  clean_seller := coalesce(nullif(trim(req.display_name), ''), nullif(trim(profile_row.display_name), ''), clean_name);
  request_payload := jsonb_build_object(
    'sellerAccessRequestId', req.id,
    'sellerAccessApprovedAt', now(),
    'sellerAccessApprovedBy', auth.uid(),
    'sellerRequestNotes', coalesce(req.notes, ''),
    'sellerPublicActivationRequired', true
  );

  if existing_seller_id is not null then
    update public.sellers
    set
      auth_id = req.user_id,
      email = coalesce(profile_row.email, public.sellers.email),
      name = coalesce(nullif(trim(seller_name), ''), public.sellers.name, clean_name),
      seller = coalesce(nullif(trim(req.display_name), ''), public.sellers.seller, clean_seller),
      region = coalesce(nullif(trim(seller_region), ''), public.sellers.region, clean_region),
      category = coalesce(nullif(trim(seller_category), ''), public.sellers.category, clean_category),
      wa = coalesce(clean_wa, public.sellers.wa),
      active = public.sellers.active,
      data = coalesce(public.sellers.data, '{}'::jsonb) || request_payload,
      updated_at = now()
    where id = existing_seller_id
    returning id, active into target_seller_id, target_seller_active;

    if target_seller_id is null then
      raise exception 'Existing seller listing not found' using errcode = 'P0002';
    end if;
  else
    insert into public.sellers (auth_id, email, name, seller, region, category, wa, active, data)
    values (
      req.user_id,
      profile_row.email,
      clean_name,
      clean_seller,
      clean_region,
      clean_category,
      clean_wa,
      false,
      request_payload
    )
    on conflict (auth_id) do update
    set
      email = excluded.email,
      name = excluded.name,
      seller = excluded.seller,
      region = excluded.region,
      category = excluded.category,
      wa = coalesce(excluded.wa, public.sellers.wa),
      active = public.sellers.active,
      data = coalesce(public.sellers.data, '{}'::jsonb) || excluded.data,
      updated_at = now()
    returning id, active into target_seller_id, target_seller_active;
  end if;

  update public.profiles
  set
    role = 'seller',
    display_name = coalesce(nullif(trim(display_name), ''), clean_seller),
    updated_at = now()
  where id = req.user_id;

  update public.seller_access_requests
  set
    status = 'approved',
    admin_notes = coalesce(nullif(trim(admin_note), ''), 'Approved and linked to seller #' || target_seller_id || '. Public listing activation is managed separately.'),
    updated_at = now()
  where id = req.id;

  return jsonb_build_object('ok', true, 'seller_id', target_seller_id, 'seller_active', target_seller_active);
end;
$$;

revoke execute on function public.home_made_admin_seller_access_requests() from public;
revoke execute on function public.home_made_admin_seller_access_requests() from anon;
grant execute on function public.home_made_admin_seller_access_requests() to authenticated;

revoke execute on function public.home_made_approve_seller_access_request(uuid, text, text, text, text, bigint, text) from public;
revoke execute on function public.home_made_approve_seller_access_request(uuid, text, text, text, text, bigint, text) from anon;
grant execute on function public.home_made_approve_seller_access_request(uuid, text, text, text, text, bigint, text) to authenticated;

revoke execute on function public.home_made_reject_seller_access_request(uuid, text) from public;
revoke execute on function public.home_made_reject_seller_access_request(uuid, text) from anon;
grant execute on function public.home_made_reject_seller_access_request(uuid, text) to authenticated;

-- Rollback notes:
-- Restore public.home_made_approve_seller_access_request(uuid, text, text, text, text, bigint, text)
-- from 20260630100000_admin_seller_request_approval.sql if approval should again activate
-- seller rows immediately. Restore prior EXECUTE grants only after confirming the admin
-- SECURITY DEFINER checks still protect every code path.
