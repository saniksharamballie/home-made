# WhatsApp Contact Privacy

## Two-Phase Rollout

Home-Made uses a two-phase rollout so the private server-side WhatsApp handoff
can be deployed without breaking the previously deployed frontend.

Phase 1 is complete. It was intentionally additive: it added `/api/contact-seller`,
`hasWhatsApp`, and private rate-limit infrastructure, and it kept
`seller_directory.wa` and `seller_directory.data.wa` temporarily for old-client
compatibility.

Phase 2 is implemented locally on the Phase 2 branch as one forward-only
migration. It removes the temporary public contact-number projections from
anonymous `seller_directory` responses after the new frontend/API has been
verified compatible.

The previously proposed extra public contact identifier was removed. The
handoff uses the already-public `seller_directory.id`; rate limiting and
server-side validation are the privacy controls.

## Public Directory Boundary

`public.seller_directory` remains the anonymous marketplace boundary. After
Phase 2 it exposes:

- `id`: the existing public seller id used by the handoff form.
- `hasWhatsApp`: a boolean capability flag calculated from the stored seller
  WhatsApp value.

Anonymous responses no longer expose top-level `wa`, `data.wa`, or phone/contact
aliases such as `phone`, `mobile`, `whatsapp`, `contactNumber`, or `telephone`.
Frontend code must use `hasWhatsApp` as a capability flag and `/api/contact-seller`
as the handoff path. It must not retain, render, log, or use public `wa` to
construct WhatsApp URLs.

Seller owners and admins keep protected access to stored contact values through
authorised `public.sellers` reads.

## Explicit-Click Flow

Public contact buttons submit a hidden POST form to `/api/contact-seller` with
`sellerId` set to `seller_directory.id` and an optional message. The API
validates the request, checks that the seller is active and contactable,
rate-limits the client, and returns a `303` redirect to WhatsApp.

The seller number is not returned in JSON and is not embedded in generated SEO
pages, schema.org data, or new frontend state.

## Rate Limits

The endpoint applies two server-configured limits using HMAC client hashes:

- 6 handoff attempts per 10 minutes by default.
- 20 handoff attempts per 24 hours by default.

The table stores only the HMAC hash, window size/start, count, and timestamps.
It does not store raw IPs, phone numbers, seller names, order messages, user
agents, seller records, or buyer details.

## Environment

Required in production:

- `CONTACT_RATE_LIMIT_SECRET`: server-only HMAC secret for client hashes.

Optional server-only override:

- `CONTACT_SELLER_WHATSAPP_OVERRIDE`: when set to a valid WhatsApp number, all
  validated handoffs redirect to that number instead of each seller row's
  stored number. It does not affect `hasWhatsApp` and does not make sellers
  without stored WhatsApp numbers contactable.

Phase 2 does not remove, rename, inspect, or change
`CONTACT_SELLER_WHATSAPP_OVERRIDE`.

Optional rate-limit tuning:

- `CONTACT_RATE_LIMIT_SHORT_WINDOW_SECONDS`
- `CONTACT_RATE_LIMIT_SHORT_MAX`
- `CONTACT_RATE_LIMIT_DAILY_WINDOW_SECONDS`
- `CONTACT_RATE_LIMIT_DAILY_MAX`

## Origin Behaviour

Production accepts only the approved Home-Made production origins:

- `https://home-made.co.za`
- `https://www.home-made.co.za`

Vercel Preview deployments accept only an exact same-origin browser request for
the currently executing protected Preview deployment. The endpoint checks that
it is running on Vercel Preview, that the `Origin` is HTTPS, that the Origin
hostname exactly matches the request host, and that Vercel deployment metadata
identifies the same `*.vercel.app` deployment host.

Arbitrary `*.vercel.app` origins are still rejected. A request from one Preview
deployment to another Preview deployment is rejected because the Origin does not
match the current request host. No fixed Preview hostname or
`ALLOWED_PREVIEW_ORIGIN` environment variable should be configured.

Localhost and `127.0.0.1` origins are accepted only in local non-Vercel
development. Missing origins are rejected in Vercel environments.

Preview testing can use an authenticated browser session or `vercel curl`
targeted at the exact Preview deployment. `vercel curl` can handle protected
Preview access for the authenticated Vercel project without making the Preview
public.

## Local Tests

Run locally only:

```text
supabase start -x studio,logflare,realtime,imgproxy,edge-runtime,vector,supavisor
supabase db reset
npm.cmd run test:supabase-security
npm.cmd run test:supabase-workflows
npm.cmd run test:marketplace
npm.cmd run test:contact-handoff
npm.cmd run build
npm.cmd run check
git --no-pager diff --check
```

## Phase 1 Rollout Complete

1. Configure `CONTACT_RATE_LIMIT_SECRET`.
2. Optionally configure `CONTACT_SELLER_WHATSAPP_OVERRIDE`.
3. Apply only the additive Phase 1 migration.
4. Verify the old production app still works because `wa` remains temporarily.
5. Deploy the new API/frontend/SEO build.
6. Confirm production contact handoff returns `303`.
7. Confirm generated pages no longer contain direct seller numbers.
8. Confirm the new frontend does not use public `wa`.
9. Leave Phase 1 running briefly for production verification.

Phase 1 did not remove numbers from anonymous `seller_directory`. That was an
intentional temporary compatibility state, not the final privacy boundary.

## Phase 2 Local Implementation

The Phase 2 branch adds one forward-only migration that:

- Removes top-level `seller_directory.wa`.
- Removes nested `seller_directory.data.wa`.
- Retains `seller_directory.id`.
- Retains boolean `hasWhatsApp`.
- Retains active seller filtering, public marketplace fields, image
  sanitisation, menu sanitisation, tier projection, availability, discounts,
  delivery, pickup, category, and region.
- Preserves protected seller-owner/admin access to stored `public.sellers.wa`.
- Leaves `/api/contact-seller`, rate-limit infrastructure, WhatsApp redirect
  behaviour, and the temporary override unchanged.

Do not apply the Phase 2 migration remotely until local reset/tests pass and a
production rollout has been explicitly approved.

## Rollback Considerations

After Phase 2, rolling back to a frontend that requires anonymous `wa` would
break direct WhatsApp links. The safe rollback approach is to keep the
server-side handoff frontend/API deployed, or apply a new forward migration that
temporarily restores the Phase 1 public compatibility projection while a fixed
frontend is redeployed. Do not rewrite migration history.

## Residual Limitation

Phase 2 removes public bulk contact exposure from anonymous directory and
generated-page surfaces. It does not prevent a user from learning the destination
number after a valid explicit WhatsApp handoff, because WhatsApp receives the
redirect destination by design.
