-- Keep profile recovery and Auth synchronization without updating unchanged rows.

create or replace function public.get_home_made_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
  current_user_id uuid;
  user_email text;
begin
  current_user_id := auth.uid();
  user_email := auth.email();

  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  insert into public.profiles as existing_profile (id, email, display_name, role)
  values (
    current_user_id,
    user_email,
    split_part(user_email, '@', 1),
    public.home_made_profile_role(user_email)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    role = case
      when public.home_made_is_admin_email(excluded.email) then 'admin'
      else existing_profile.role
    end,
    updated_at = now()
  where
    existing_profile.email is distinct from excluded.email
    or existing_profile.role is distinct from case
      when public.home_made_is_admin_email(excluded.email) then 'admin'
      else existing_profile.role
    end;

  select * into result
  from public.profiles
  where id = current_user_id;

  return result;
end;
$$;

revoke all privileges on function public.get_home_made_profile() from public;
revoke execute on function public.get_home_made_profile() from anon;
grant execute on function public.get_home_made_profile() to authenticated;
grant execute on function public.get_home_made_profile() to service_role;
