-- Admin workflow for buyer-to-seller conversion requests.
-- Approval must update the request, seller ownership and profile role together.

create or replace function public.home_made_admin_seller_access_requests()
returns table (
  id uuid,
  user_id uuid,
  profile_email text,
  request_name text,
  notes text,
  role text,
  display_name text,
  status text,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  linked_seller_id bigint,
  linked_seller_name text
)
language plpgsql
security definer
set search_path = public
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
    sar.id,
    sar.user_id,
    p.email as profile_email,
    sar.name as request_name,
    sar.notes,
    sar.role,
    sar.display_name,
    sar.status,
    sar.admin_notes,
    sar.created_at,
    sar.updated_at,
    s.id as linked_seller_id,
    s.name as linked_seller_name
  from public.seller_access_requests sar
  left join public.profiles p on p.id = sar.user_id
  left join public.sellers s on s.auth_id = sar.user_id
  order by
    case sar.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    sar.created_at desc;
end;
$$;

grant execute on function public.home_made_admin_seller_access_requests() to authenticated;

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
    'sellerRequestNotes', coalesce(req.notes, '')
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
      active = true,
      data = coalesce(public.sellers.data, '{}'::jsonb) || request_payload,
      updated_at = now()
    where id = existing_seller_id
    returning id into target_seller_id;

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
      true,
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
      active = true,
      data = coalesce(public.sellers.data, '{}'::jsonb) || excluded.data,
      updated_at = now()
    returning id into target_seller_id;
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
    admin_notes = coalesce(nullif(trim(admin_note), ''), 'Approved and linked to seller #' || target_seller_id || '.'),
    updated_at = now()
  where id = req.id;

  return jsonb_build_object('ok', true, 'seller_id', target_seller_id);
end;
$$;

grant execute on function public.home_made_approve_seller_access_request(uuid, text, text, text, text, bigint, text) to authenticated;

create or replace function public.home_made_reject_seller_access_request(
  request_id uuid,
  admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  update public.seller_access_requests
  set
    status = 'rejected',
    admin_notes = coalesce(nullif(trim(admin_note), ''), 'Rejected from Home-Made admin dashboard.'),
    updated_at = now()
  where id = request_id
  returning id into updated_id;

  if updated_id is null then
    raise exception 'Seller access request not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('ok', true, 'request_id', updated_id);
end;
$$;

grant execute on function public.home_made_reject_seller_access_request(uuid, text) to authenticated;
