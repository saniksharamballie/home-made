-- Reset application-facing grants on public.sellers to the least-privilege
-- allowlist required by the app: SELECT, INSERT, and UPDATE for authenticated.
--
-- This intentionally removes DELETE, TRUNCATE, REFERENCES, TRIGGER, and
-- MAINTAIN from authenticated. No RLS policies are changed, anon is not granted
-- raw public.sellers access, and public.seller_directory is not modified.
--
-- Service-role API routes and SECURITY DEFINER functions remain unaffected
-- because this migration revokes only PUBLIC, anon, and authenticated grants.

revoke all privileges
on table public.sellers
from public;

revoke all privileges
on table public.sellers
from anon;

revoke all privileges
on table public.sellers
from authenticated;

grant select, insert, update
on table public.sellers
to authenticated;
