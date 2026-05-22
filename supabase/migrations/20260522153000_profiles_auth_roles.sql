create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select using (auth.uid() = id);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(lower(email));

create or replace function public.home_made_is_admin_email(email text)
returns boolean
language sql
stable
as $$
  select lower(coalesce(email, '')) in ('saniksha@gmail.com', 'sycoticzn@gmail.com');
$$;

create or replace function public.home_made_profile_role(email text)
returns text
language sql
stable
as $$
  select case when public.home_made_is_admin_email(email) then 'admin' else 'buyer' end;
$$;

create or replace function public.handle_home_made_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

  return new;
end;
$$;

drop trigger if exists on_home_made_auth_user_created on auth.users;
create trigger on_home_made_auth_user_created
after insert on auth.users
for each row execute function public.handle_home_made_new_user();

insert into public.profiles (id, email, display_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  public.home_made_profile_role(u.email)
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  role = case
    when public.home_made_is_admin_email(excluded.email) then 'admin'
    else public.profiles.role
  end,
  updated_at = now();

create or replace function public.get_home_made_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
  user_email text;
begin
  user_email := auth.email();

  insert into public.profiles (id, email, display_name, role)
  values (
    auth.uid(),
    user_email,
    split_part(user_email, '@', 1),
    public.home_made_profile_role(user_email)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    role = case
      when public.home_made_is_admin_email(excluded.email) then 'admin'
      else public.profiles.role
    end,
    updated_at = now();

  select * into result
  from public.profiles
  where id = auth.uid();

  return result;
end;
$$;

grant execute on function public.get_home_made_profile() to authenticated;
