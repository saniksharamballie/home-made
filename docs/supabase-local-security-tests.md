# Supabase Local Security Tests

These checks verify the local Supabase security boundary for `public.seller_directory`
and `public.sellers`. They are local-only and refuse remote Supabase URLs or
remote database hosts.

## Start the lean local stack

```bash
supabase start
```

On Windows, if Studio or analytics health checks get in the way, start the lean
services needed by these tests:

```bash
supabase start -x studio,logflare,realtime,imgproxy,edge-runtime,vector,supavisor
```

## Reset the local database

```bash
supabase db reset
```

This applies the complete migration chain and local fictional seed data from
`supabase/migrations`.

## Run the security tests

```bash
npm run test:supabase-security
```

The runner uses:

- `http://127.0.0.1:54321` by default for REST checks.
- The local Docker Postgres container named from `supabase/config.toml`.
- A generated local anon JWT using Supabase CLI's default local JWT secret,
  unless `LOCAL_SUPABASE_ANON_KEY` is supplied.

Optional local-only overrides:

```bash
LOCAL_SUPABASE_URL=http://127.0.0.1:54321 npm run test:supabase-security
LOCAL_SUPABASE_CONTAINER=supabase_db_yemdirpmtqzzduxtgfqh npm run test:supabase-security
```

The script exits with a non-zero status if any check fails.

## Stop the local stack

```bash
supabase stop
```
