# WhatsApp Contact Privacy

## Two-Phase Rollout

Home-Made uses a two-phase rollout so the private server-side WhatsApp handoff
can be deployed without breaking the currently deployed frontend.

Phase 1 is intentionally additive. It adds `/api/contact-seller`,
`hasWhatsApp`, and private rate-limit infrastructure, but keeps
`seller_directory.wa` and `seller_directory.data.wa` temporarily for old-client
compatibility.

Phase 2 is a later separate branch and forward-only migration. It removes the
temporary public contact-number projections after the new frontend/API has been
verified live in production.

The previously proposed extra public contact identifier was removed. The
handoff uses the already-public `seller_directory.id`; rate limiting and
server-side validation are the privacy controls.

## Phase 1 Boundary

`public.seller_directory` remains the anonymous marketplace boundary. In Phase
1 it exposes:

- `id`: the existing public seller id used by the handoff form.
- `hasWhatsApp`: a boolean capability flag calculated from the stored seller
  WhatsApp value.
- `wa` and `data.wa`: temporary compatibility fields for old production
  clients only.

New frontend code must not retain, render, log, or use public `wa` to construct
WhatsApp URLs. It may use a transient `Boolean(row.wa)` fallback only when
`hasWhatsApp` is missing during an unexpected transition.

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

## Phase 1 Rollout

1. Configure `CONTACT_RATE_LIMIT_SECRET`.
2. Optionally configure `CONTACT_SELLER_WHATSAPP_OVERRIDE`.
3. Apply only the additive Phase 1 migration.
4. Verify the old production app still works because `wa` remains temporarily.
5. Deploy the new API/frontend/SEO build.
6. Confirm production contact handoff returns `303`.
7. Confirm generated pages no longer contain direct seller numbers.
8. Confirm the new frontend does not use public `wa`.
9. Leave Phase 1 running briefly for production verification.

Phase 1 does not yet remove numbers from anonymous `seller_directory`. That is
an intentional temporary compatibility state, not the final privacy boundary.

## Phase 2 Rollout

A later separate branch must:

- Add one forward-only migration.
- Remove top-level `wa`.
- Remove `data.wa`.
- Retain `hasWhatsApp`.
- Change database tests from temporary compatibility assertions to final privacy
  assertions.
- Apply the migration only after the new frontend/API is confirmed live.

## Rollback Considerations

During Phase 1, the old frontend can still operate because public `wa` remains.
After Phase 2, rolling back the frontend without restoring the old public
projection would break direct WhatsApp links, so Phase 2 must be treated as a
separate verified rollout.

## Residual Limitation

This design prevents bulk directory/static-page harvesting by the new frontend
and generated pages. It does not make seller contact numbers permanently
undiscoverable: a determined user can still learn the number after a valid
explicit handoff to WhatsApp.
