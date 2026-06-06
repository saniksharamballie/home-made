create table if not exists public.seller_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text not null default '',
  role text not null default 'buyer',
  display_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_access_requests enable row level security;

drop trigger if exists trg_seller_access_requests_updated_at on public.seller_access_requests;
create trigger trg_seller_access_requests_updated_at
before update on public.seller_access_requests
for each row execute function public.touch_updated_at();

drop policy if exists seller_access_requests_insert_own on public.seller_access_requests;
create policy seller_access_requests_insert_own
on public.seller_access_requests
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists seller_access_requests_select_own_admin on public.seller_access_requests;
create policy seller_access_requests_select_own_admin
on public.seller_access_requests
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists seller_access_requests_update_admin on public.seller_access_requests;
create policy seller_access_requests_update_admin
on public.seller_access_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create index if not exists idx_seller_access_requests_user_created
on public.seller_access_requests(user_id, created_at desc);

create index if not exists idx_seller_access_requests_status_created
on public.seller_access_requests(status, created_at desc);

grant select, insert, update on table public.seller_access_requests to authenticated;
