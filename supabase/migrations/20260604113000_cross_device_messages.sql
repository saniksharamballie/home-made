alter table public.messages
  add column if not exists app_id text unique,
  add column if not exists from_role text,
  add column if not exists from_label text,
  add column if not exists from_id text,
  add column if not exists to_role text,
  add column if not exists to_label text,
  add column if not exists to_id text,
  add column if not exists client_ts bigint,
  add column if not exists read boolean not null default false;

create or replace function public.home_made_message_related(
  msg_sender uuid,
  msg_recipient uuid,
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
  select
    auth.uid() = msg_sender
    or auth.uid() = msg_recipient
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
    or (
      msg_from_role = 'buyer'
      and auth.uid() = msg_sender
    )
    or (
      msg_to_role = 'buyer'
      and (
        msg_to_id is null
        or msg_to_id = auth.uid()::text
        or auth.uid() = msg_recipient
      )
    )
    or (
      msg_from_role = 'seller'
      and exists (
        select 1
        from public.sellers
        where sellers.auth_id = auth.uid()
          and sellers.id::text = msg_from_id
      )
    )
    or (
      msg_to_role = 'seller'
      and (
        msg_to_id is null
        or exists (
          select 1
          from public.sellers
          where sellers.auth_id = auth.uid()
            and sellers.id::text = msg_to_id
        )
      )
    );
$$;

grant execute on function public.home_made_message_related(uuid, uuid, text, text, text, text) to authenticated;

drop policy if exists messages_select_app_related on public.messages;
create policy messages_select_app_related
on public.messages
for select
to authenticated
using (
  public.home_made_message_related(sender_id, recipient_id, from_role, from_id, to_role, to_id)
);

drop policy if exists messages_update_app_related on public.messages;
create policy messages_update_app_related
on public.messages
for update
to authenticated
using (
  public.home_made_message_related(sender_id, recipient_id, from_role, from_id, to_role, to_id)
)
with check (
  public.home_made_message_related(sender_id, recipient_id, from_role, from_id, to_role, to_id)
);

create index if not exists idx_messages_app_id on public.messages(app_id);
create index if not exists idx_messages_sender_created on public.messages(sender_id, created_at desc);
create index if not exists idx_messages_app_roles on public.messages(to_role, to_id, read);

grant select, insert, update on table public.messages to authenticated;
