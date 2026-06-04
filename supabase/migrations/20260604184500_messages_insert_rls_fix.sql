drop policy if exists messages_insert_auth on public.messages;
create policy messages_insert_auth
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and from_role in ('buyer', 'seller', 'admin')
  and to_role in ('buyer', 'seller', 'admin')
);

grant insert on table public.messages to authenticated;
