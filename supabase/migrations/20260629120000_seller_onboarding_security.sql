-- Launch hardening for seller onboarding, messaging and public image uploads.
-- New sellers must request access; role/listing creation remains admin controlled.

with duplicate_pending as (
  select id
  from (
    select
      id,
      row_number() over (partition by user_id order by created_at desc, id desc) as rn
    from public.seller_access_requests
    where status = 'pending'
  ) ranked
  where rn > 1
)
update public.seller_access_requests sar
set
  status = 'rejected',
  admin_notes = case
    when nullif(trim(sar.admin_notes), '') is null then 'Auto-closed duplicate pending request before launch hardening.'
    else sar.admin_notes
  end
from duplicate_pending d
where sar.id = d.id;

create unique index if not exists uq_seller_access_requests_pending_user
on public.seller_access_requests(user_id)
where status = 'pending';

drop policy if exists sellers_insert_own on public.sellers;
drop policy if exists sellers_insert_admin on public.sellers;
create policy sellers_insert_admin
on public.sellers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists orders_insert_auth on public.orders;
drop policy if exists orders_insert_related on public.orders;
create policy orders_insert_related
on public.orders
for insert
to authenticated
with check (
  auth.uid() = buyer_id
  or exists (
    select 1
    from public.sellers s
    where s.id = orders.seller_id
      and s.auth_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

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
begin
  requested_seller := lower(coalesce(new.raw_user_meta_data->>'seller_intent', 'false')) in ('true', '1', 'yes', 'on');
  request_name := nullif(trim(coalesce(new.raw_user_meta_data->>'seller_request_name', '')), '');
  request_notes := nullif(trim(coalesce(new.raw_user_meta_data->>'seller_request_notes', '')), '');

  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
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
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
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

create or replace function public.home_made_message_can_insert(
  msg_sender uuid,
  msg_from_role text,
  msg_from_id text,
  msg_to_role text,
  msg_to_id text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.role
    from public.profiles p
    where p.id = auth.uid()
  )
  select
    auth.uid() = msg_sender
    and (
      exists (
        select 1
        from me
        where role = 'admin'
          and msg_from_role = 'admin'
      )
      or exists (
        select 1
        from me
        where role = 'buyer'
          and msg_from_role = 'buyer'
          and coalesce(msg_from_id, auth.uid()::text) = auth.uid()::text
          and msg_to_role in ('seller', 'admin')
          and not (msg_to_role = 'seller' and msg_to_id is null)
      )
      or exists (
        select 1
        from public.sellers s
        join me on me.role = 'seller'
        where s.auth_id = auth.uid()
          and s.id::text = msg_from_id
          and msg_from_role = 'seller'
          and msg_to_role in ('buyer', 'admin')
          and not (msg_to_role = 'buyer' and msg_to_id is null)
      )
    );
$$;

grant execute on function public.home_made_message_can_insert(uuid, text, text, text, text) to authenticated;

drop policy if exists messages_insert_auth on public.messages;
create policy messages_insert_auth
on public.messages
for insert
to authenticated
with check (
  public.home_made_message_can_insert(sender_id, from_role, from_id, to_role, to_id)
);

drop policy if exists "seller_images_client_upload" on storage.objects;
create policy "seller_images_client_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'seller-images'
  and (
    (
      (storage.foldername(name))[1] in ('listing-uploads', 'seller-profiles', 'buyer-profiles')
      and auth.uid()::text = (storage.foldername(name))[2]
    )
    or (
      (storage.foldername(name))[1] = 'hero-gallery'
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
    )
  )
);
