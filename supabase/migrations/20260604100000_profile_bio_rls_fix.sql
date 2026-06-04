alter table public.buyers enable row level security;
alter table public.profiles enable row level security;

grant select, insert, update on table public.buyers to authenticated;
grant select, insert on table public.profiles to authenticated;
revoke update on table public.profiles from authenticated;
grant update (email, display_name, updated_at) on table public.profiles to authenticated;

drop policy if exists buyers_select_own on public.buyers;
create policy buyers_select_own on public.buyers
for select to authenticated
using (auth.uid() = auth_id);

drop policy if exists buyers_upsert_own on public.buyers;
drop policy if exists buyers_insert_own on public.buyers;
create policy buyers_insert_own on public.buyers
for insert to authenticated
with check (auth.uid() = auth_id);

drop policy if exists buyers_update_own on public.buyers;
create policy buyers_update_own on public.buyers
for update to authenticated
using (auth.uid() = auth_id)
with check (auth.uid() = auth_id);

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (auth.uid() = id and role = 'buyer');

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
