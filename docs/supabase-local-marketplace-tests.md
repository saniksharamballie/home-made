# Supabase Local Marketplace Regression Tests

These checks exercise the local-only public marketplace projection in
`public.seller_directory`. They use fictional, run-scoped seller rows and refuse
remote Supabase or database configuration.

## Start the lean local stack

```bash
supabase start -x studio,logflare,realtime,imgproxy,edge-runtime,vector,supavisor
```

Do not use `--linked`.

## Reset the local database

```bash
supabase db reset
```

This applies the complete migration chain and local fictional seed data.

## Run the marketplace tests

```bash
npm.cmd run test:marketplace
```

The runner uses:

- `http://127.0.0.1:54321` by default.
- The local Docker Postgres container named from `supabase/config.toml`.
- A local anon key from `supabase status -o env`, or a generated local JWT using
  the Supabase CLI default local JWT secret.
- Local anonymous REST reads for public marketplace assertions.
- Local Docker Postgres SQL for fixture setup, direct metadata checks and
  cleanup.

## Safety

The runner refuses remote values in:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_DB_URL`
- `DATABASE_URL`
- `POSTGRES_URL`

It does not require production credentials, remote Supabase access, Vercel,
PayFast or deployment access.

## Coverage

The suite verifies that:

- Active sellers appear in `seller_directory`.
- Inactive sellers are excluded from `seller_directory`.
- Public fixture counts match active projected rows.
- Category and region values are projected correctly.
- REST category and region filters return matching public rows.
- Delivery, pickup, discount and menu item values retain expected JSON types.
- Only today's `dailyMenus` key is exposed.
- Current and daily menu items are deeply sanitized.
- Seller-level private keys remain absent before and after advert/data updates.
- `data.baseTier` remains unchanged when birthday-month boost applies.
- Birthday-month boost changes only the effective projected tier.
- `seller_directory` remains `security_barrier=true`.
- `seller_directory` remains `security_invoker=false`.

The image privacy diagnostic recursively scans anonymous `seller_directory`
responses for internal storage and ownership metadata in currently projected
image structures, including `images`, `gallery`, `storeImages`, `photos`,
`photoUrls`, `menuImages`, `itemImages`, `listingImages`, `items`, `menu`,
`menuItems`, `menu_items` and `dailyMenus`.

Safe public display URLs may remain. Internal keys such as `imgPath`, `imgName`,
`storagePath`, `storage_key`, `bucket`, `objectPath`, `internalId` and `auth_id`
must not appear anywhere in the anonymous response. If the diagnostic fails,
leave the expectation unchanged and fix the projection in a separate migration
task.

## Frontend-Owned Behaviour

These tests do not reimplement browser-only marketplace logic. A later
browser/UI regression phase should cover:

- `campaign.status` values such as `past` and `deleted`.
- Campaign `endsAt` expiry.
- `sellerUnavailable` ordering rules.
- Gold/Platinum auto-resume behaviour.
- Browser category, suburb, search, dietary and health filtering.
- Cart discount and fulfilment calculations.
- Frontend marketplace-visible counts.

The active directory count is the number of rows returned by
`seller_directory`. The marketplace-visible current-advert count is the frontend
`publicSellers()` result after campaign visibility rules are applied.

Unavailable sellers currently remain visible but non-orderable.

## Cleanup and Recovery

Each run creates fictional seller rows marked with a unique run id. The runner
attempts to delete its own rows at the end.

If cleanup fails or a run is interrupted, recover with:

```bash
supabase db reset
```

Then rerun:

```bash
npm.cmd run test:marketplace
```

## Stop the local stack

```bash
supabase stop
```
