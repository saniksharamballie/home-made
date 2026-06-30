-- Ensure seller-intent account creation creates admin-review request rows.

create or replace function public.handle_home_made_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_seller boolean;
  request_name text;
  request_notes text;
  display text;
begin
  requested_seller := lower(coalesce(
    new.raw_user_meta_data->>'seller_intent',
    new.raw_user_meta_data->>'sellerIntent',
    'false'
  )) in ('true', '1', 'yes', 'on');

  request_name := nullif(trim(coalesce(
    new.raw_user_meta_data->>'seller_request_name',
    new.raw_user_meta_data->>'sellerRequestName',
    new.raw_user_meta_data->>'sellerName',
    new.raw_user_meta_data->>'store_name',
    new.raw_user_meta_data->>'storeName',
    ''
  )), '');

  request_notes := nullif(trim(coalesce(
    new.raw_user_meta_data->>'seller_request_notes',
    new.raw_user_meta_data->>'sellerRequestNotes',
    new.raw_user_meta_data->>'sellerNotes',
    ''
  )), '');

  display := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'displayName'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Buyer'
  );

  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    display,
    public.home_made_profile_role(new.email)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    role = case
      when public.home_made_is_admin_email(excluded.email) then 'admin'
      else public.profiles.role
    end,
    updated_at = now();

  if requested_seller and request_name is not null then
    insert into public.seller_access_requests (user_id, name, notes, role, display_name, status)
    select
      new.id,
      request_name,
      coalesce(request_notes, ''),
      'buyer',
      display,
      'pending'
    where not exists (
      select 1
      from public.seller_access_requests sar
      where sar.user_id = new.id
        and sar.status = 'pending'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_home_made_auth_user_created on auth.users;
create trigger on_home_made_auth_user_created
after insert on auth.users
for each row execute function public.handle_home_made_new_user();

insert into public.seller_access_requests (user_id, name, notes, role, display_name, status)
select
  u.id,
  nullif(trim(coalesce(
    u.raw_user_meta_data->>'seller_request_name',
    u.raw_user_meta_data->>'sellerRequestName',
    u.raw_user_meta_data->>'sellerName',
    u.raw_user_meta_data->>'store_name',
    u.raw_user_meta_data->>'storeName',
    ''
  )), '') as name,
  coalesce(nullif(trim(coalesce(
    u.raw_user_meta_data->>'seller_request_notes',
    u.raw_user_meta_data->>'sellerRequestNotes',
    u.raw_user_meta_data->>'sellerNotes',
    ''
  )), ''), '') as notes,
  'buyer',
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'displayName'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Buyer'
  ) as display_name,
  'pending'
from auth.users u
where lower(coalesce(
    u.raw_user_meta_data->>'seller_intent',
    u.raw_user_meta_data->>'sellerIntent',
    'false'
  )) in ('true', '1', 'yes', 'on')
  and nullif(trim(coalesce(
    u.raw_user_meta_data->>'seller_request_name',
    u.raw_user_meta_data->>'sellerRequestName',
    u.raw_user_meta_data->>'sellerName',
    u.raw_user_meta_data->>'store_name',
    u.raw_user_meta_data->>'storeName',
    ''
  )), '') is not null
  and not exists (
    select 1
    from public.seller_access_requests sar
    where sar.user_id = u.id
      and sar.status = 'pending'
  );
