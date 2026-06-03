create table if not exists public.city_waitlist_leads (
  id uuid primary key default gen_random_uuid(),
  city text not null default 'Cape Town',
  preferred_contact text not null check (preferred_contact in ('email','mobile')),
  email text,
  mobile text,
  source text not null default 'homepage-coming-soon',
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint city_waitlist_contact_present check (
    (preferred_contact = 'email' and email is not null and length(trim(email)) between 5 and 180)
    or
    (preferred_contact = 'mobile' and mobile is not null and length(regexp_replace(mobile, '\D', '', 'g')) between 9 and 16)
  )
);

alter table public.city_waitlist_leads enable row level security;

drop policy if exists city_waitlist_public_insert on public.city_waitlist_leads;
create policy city_waitlist_public_insert on public.city_waitlist_leads
for insert
to anon, authenticated
with check (
  preferred_contact in ('email','mobile')
  and city in ('Cape Town','Gauteng','Other')
);

drop policy if exists city_waitlist_admin_read on public.city_waitlist_leads;
create policy city_waitlist_admin_read on public.city_waitlist_leads
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

create index if not exists idx_city_waitlist_leads_created_at
on public.city_waitlist_leads(created_at desc);

create index if not exists idx_city_waitlist_leads_city
on public.city_waitlist_leads(city);

grant insert on table public.city_waitlist_leads to anon, authenticated;
grant select on table public.city_waitlist_leads to authenticated;
