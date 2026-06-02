create table if not exists public.unfulfilled_searches (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  region text not null default 'Durban',
  category text not null default 'all',
  filters jsonb not null default '{}'::jsonb,
  result_count integer not null default 0 check (result_count = 0),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.unfulfilled_searches enable row level security;

drop policy if exists unfulfilled_searches_public_insert on public.unfulfilled_searches;
create policy unfulfilled_searches_public_insert on public.unfulfilled_searches
for insert
to anon, authenticated
with check (
  result_count = 0
  and length(trim(query)) between 2 and 160
);

drop policy if exists unfulfilled_searches_admin_read on public.unfulfilled_searches;
create policy unfulfilled_searches_admin_read on public.unfulfilled_searches
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create index if not exists idx_unfulfilled_searches_created_at
on public.unfulfilled_searches(created_at desc);

create index if not exists idx_unfulfilled_searches_query
on public.unfulfilled_searches(lower(query));

grant insert on table public.unfulfilled_searches to anon, authenticated;
grant select on table public.unfulfilled_searches to authenticated;
