# Supabase Local Seller/Admin Workflow Tests

These checks exercise seller-owner and admin workflows against the local
Supabase Docker stack only. They refuse remote Supabase and database URLs and
use fictional `example.test` identities created uniquely for each run.

## Start the lean local stack

```bash
supabase start -x studio,logflare,realtime,imgproxy,edge-runtime,vector,supavisor
```

## Reset the local database

```bash
supabase db reset
```

This applies the complete migration chain and fictional local seed data.
Running after a reset is preferred so the test database is predictable.

## Run the workflow tests

```bash
npm.cmd run test:supabase-workflows
```

The runner uses:

- `http://127.0.0.1:54321` by default.
- The local Docker Postgres container named from `supabase/config.toml`.
- Local anon and service-role keys from `supabase status -o env`, or generated
  local JWTs using the Supabase CLI default local JWT secret.
- Confirmed fictional local Auth users under `example.test`.

The script exits with a non-zero status if any assertion fails.

## Safety

The runner refuses remote values in:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_DB_URL`
- `DATABASE_URL`
- `POSTGRES_URL`

It does not require production credentials, remote database passwords, Vercel,
PayFast, or hosted Supabase access.

## Cleanup and recovery

Each run creates unique fictional Auth, profile, seller, buyer and request data.
The runner attempts to remove its own records at the end through local Postgres.

If a run is interrupted or cleanup fails, recover with:

```bash
supabase db reset
```

Then rerun:

```bash
npm.cmd run test:supabase-workflows
```

## Stop the local stack

```bash
supabase stop
```
