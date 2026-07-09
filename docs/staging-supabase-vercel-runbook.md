# Home-Made Staging Supabase and Vercel Runbook

## 1. Purpose

This runbook exists to define the minimum safe staging setup before any future work touches publish, save, upload, or real seller-row generation paths.

Staging is required before changing or actively testing:

- `goLiveListing`
- `buildPublishedSeller`
- `sellerRowForSave`
- `syncPublishedSeller`
- `persistPublishedSeller`
- seller edit/prefill flows
- image upload
- Supabase writes
- storage uploads
- generated seller-page data built from real seller rows

This document is planning-only. It does not authorise production writes, staging creation by guesswork, or remote mutation without an explicit follow-up task.

## 2. Current production baseline

- `main` / `origin/main` baseline: `4a3ad02531901e95126fc95e7b195f6ff6ae5f88`
- Production status: healthy
- Current production service worker: `hm-prod-v66`
- Publish, save, and image-upload paths must not be tested on production without explicit approval

## 3. Staging architecture

Target setup:

1. A separate hosted Supabase staging project
2. A Vercel preview or staging deployment wired only to the staging Supabase project
3. A stable staging-safe URL used for auth redirect configuration
4. A staging-only public storage bucket and matching policies for seller image flows
5. A staging-only contact/WhatsApp safety override
6. A clearly labelled seller/account convention: `AGENT TEST - DELETE`
7. A defined cleanup process for seller rows and uploaded storage objects

Principles:

- Staging must never share hosted credentials with production
- Preview/staging auth redirects must never resolve to the production domain
- Preview/staging SEO and generated seller-page data must come from staging-only rows when real-row testing begins
- Any contact handoff in staging must route to a controlled sink, not a real seller destination

## 4. Critical safety warnings

- Never reuse production service-role keys in preview or staging
- Never run `supabase db push` while linked to production
- Never test image upload against production storage
- Never create an `AGENT TEST - DELETE` seller on production
- Never set preview `NEXT_PUBLIC_SITE_URL` to the production domain
- Never leave preview `NEXT_PUBLIC_SUPABASE_URL` unset when the codebase has hosted fallback behaviour
- Never print secret values in logs, terminal captures, docs, or reports

## 5. Environment variable inventory

Values are intentionally omitted. Record names only.

### Client-visible and runtime-visible variables

| Variable | Visibility | Production required | Staging required | Must staging differ from production | Purpose / code path |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client-visible | Yes | Yes | Yes | Browser Supabase client config and build-time seller-directory reads |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-visible | Yes | Yes | Yes | Browser anon access and build-time public view reads |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Client-visible | Yes | Yes | Usually | Client-visible admin contact/config usage |
| `NEXT_PUBLIC_SITE_URL` | Client-visible | Yes | Yes | Yes | Auth redirect base and public canonical/site URL usage |
| `VERCEL` | Runtime-provided | Yes | Yes | No | Detects Vercel runtime in API logic |
| `VERCEL_ENV` | Runtime-provided | Yes | Yes | Environment-specific | Distinguishes production / preview / development runtime behaviour |

### Server-only variables

| Variable | Visibility | Production required | Staging required | Must staging differ from production | Purpose / code path |
| --- | --- | --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Yes | Yes | Yes | Privileged server-side Supabase access |
| `SUPABASE_SECRET_KEY` | Server-only | Optional alias | Optional alias | Yes if used | Alternate service-role env name in server code |
| `CONTACT_RATE_LIMIT_SECRET` | Server-only | Yes | Yes | Yes | Contact-handoff rate-limit hashing/guarding |
| `CONTACT_SELLER_WHATSAPP_OVERRIDE` | Server-only | Optional | Strongly recommended | Yes | Staging contact safety sink for WhatsApp handoff |
| `CONTACT_RATE_LIMIT_SHORT_WINDOW_SECONDS` | Server-only | Optional | Optional | Usually | Contact-handoff short window tuning |
| `CONTACT_RATE_LIMIT_SHORT_MAX` | Server-only | Optional | Optional | Usually | Contact-handoff short window cap |
| `CONTACT_RATE_LIMIT_DAILY_WINDOW_SECONDS` | Server-only | Optional | Optional | Usually | Contact-handoff daily window tuning |
| `CONTACT_RATE_LIMIT_DAILY_MAX` | Server-only | Optional | Optional | Usually | Contact-handoff daily window cap |

### Local-only variables

These are for local development or local Supabase/testing flows and should be documented separately from hosted staging configuration:

- `LOCAL_SUPABASE_URL`
- `LOCAL_SUPABASE_ANON_KEY`
- `LOCAL_SUPABASE_SERVICE_ROLE_KEY`
- `LOCAL_SUPABASE_CONTAINER`
- `LOCAL_SUPABASE_DB_HOST`
- `LOCAL_SUPABASE_DB_URL`
- `SUPABASE_URL`
- `SUPABASE_DB_URL`
- `DATABASE_URL`
- `POSTGRES_URL`

## 6. Database and storage requirements

Staging should use the full migration chain, not a hand-picked subset, before publish/save/upload work is attempted.

High-level required objects include:

- `profiles`
- `buyers`
- `sellers`
- `seller_access_requests`
- `contact_handoff_rate_limits`
- `orders`
- `messages`
- `notifications`
- `app_settings`
- `unfulfilled_searches`
- `city_waitlist_leads`
- `seller_directory` view
- `get_home_made_profile()`
- `home_made_contact_handoff_rate_limit(...)`
- seller access and admin approval/rejection RPCs
- `seller-images` bucket
- policy areas covering `listing-uploads`, `seller-profiles`, and `buyer-profiles`

Important note:

- Migrations can establish most schema, RLS, RPC, view, and storage-policy structure
- Hosted Supabase dashboard settings still require manual setup for:
  - Auth site URL
  - redirect URLs
  - email/signup settings
  - staged email behaviour

## 7. Test seller plan

Staging-only seller convention:

- Visible seller name: `AGENT TEST - DELETE`
- Listing/store title prefix: `AGENT TEST - DELETE`
- Email convention: a team-controlled mailbox alias such as `agent-test-delete+<date-or-ticket>@<controlled-domain>`
- Contact approach: use a dummy or controlled staging-only sink; do not use a real seller phone number
- Images: synthetic images only
- Storage prefix: use a clearly segregated prefix such as `agent-test-delete/`

Cleanup steps:

1. Remove uploaded staging storage objects under the test prefix
2. Deactivate or delete the staging seller row
3. Remove related staging access-request rows if created
4. Remove the staging auth account only in staging
5. Recheck generated staging seller pages or directory outputs to confirm removal

Warning:

- Never create this seller on production

## 8. Future development gates

| Area | VM tests required | Browser tests required | Staging required | Test seller required | Production writes allowed | Production smoke allowed | Release lane |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `buildPublishedSeller` | Yes | Light targeted smoke | Usually for integrated verification | Usually | No | Yes, read-only | Medium-gated |
| `sellerRowForSave` | Yes | Yes | Yes | Yes | No | Limited read-only | Slow-gated |
| `syncPublishedSeller` | Yes | Yes | Yes | Yes | No | Limited read-only | Slow-gated |
| `persistPublishedSeller` | Yes | Yes | Yes | Yes | No | Limited read-only | Staging-only |
| `goLiveListing` | Yes | Yes | Yes | Yes | No | Limited read-only | Staging-only |
| `uploadListingImg` | Limited | Yes | Yes | Yes | No | No | Staging-only |
| `uploadMenuItemImg` | Limited | Yes | Yes | Yes | No | No | Staging-only |
| `sellerPrefillPost` | Limited | Yes | Yes | Yes | No | Limited read-only | Slow-gated |
| generated seller pages | Yes where possible | Yes | Yes for real-row verification | Usually | No | Yes, read-only | Slow-gated |
| contact/privacy flow | Existing automated checks plus targeted additions | Yes | Recommended | No for read-only smoke | No | Yes, carefully | Medium-gated |

## 9. Implementation phases

### Phase 1: Env and docs inventory

- Owner / manual action: engineering
- Commands if applicable: read-only inspection only
- Must not be run against production: no remote write commands
- Verification:
  - environment variable names documented
  - publish/save/upload touchpoints mapped
  - storage and contact safety requirements documented
- Rollback / cleanup: docs-only

### Phase 2: Create hosted staging Supabase project manually

- Owner / manual action: manual setup in hosted Supabase
- Commands if applicable: none required in this runbook
- Must not be run against production:
  - do not link CLI to production by mistake
  - do not copy production service-role secrets into staging documentation or preview config
- Verification:
  - separate project exists
  - project URL is distinct from production
  - auth settings can be configured independently
- Rollback / cleanup:
  - delete unused staging project only if created by mistake and confirmed unused

### Phase 3: Apply migrations to staging

- Owner / manual action: engineering
- Commands if applicable:
  - `supabase link --project-ref <staging-project-ref>`
  - `supabase db push`
- Must not be run against production:
  - never run `supabase db push` while linked to production
- Verification:
  - full migration chain applied to staging
  - required tables, view, RPCs, and policies present
- Rollback / cleanup:
  - if migration application is wrong, fix in staging only before any user-like testing

### Phase 4: Verify storage bucket and policies

- Owner / manual action: engineering
- Commands if applicable: read-only inspection or policy verification tooling as approved
- Must not be run against production:
  - no production bucket creation
  - no production upload attempts
- Verification:
  - `seller-images` bucket exists in staging
  - intended policy areas behave correctly for staging auth roles
- Rollback / cleanup:
  - remove staging-only test objects if any safe verification upload was later approved

### Phase 5: Configure Vercel preview/staging env vars

- Owner / manual action: engineering or deploy owner
- Commands if applicable: manual dashboard configuration or approved env-management workflow
- Must not be run against production:
  - do not point preview at production Supabase
  - do not set preview `NEXT_PUBLIC_SITE_URL` to production
- Verification:
  - preview build resolves staging-only public config
  - preview server-side routes resolve staging-only server secrets
  - contact override points to a safe sink
- Rollback / cleanup:
  - remove or replace incorrect preview env vars immediately

### Phase 6: Seed `AGENT TEST - DELETE` seller/account

- Owner / manual action: engineering with explicit approval
- Commands if applicable: depends on chosen seller provisioning path
- Must not be run against production:
  - never create this account or seller in production
  - never use a real phone number
- Verification:
  - test account exists in staging only
  - seller row and access state are clearly labelled
  - no real contact path is exposed
- Rollback / cleanup:
  - delete or deactivate test account and seller
  - remove related storage objects

### Phase 7: Browser smoke in staging

- Owner / manual action: engineering / QA
- Commands if applicable: local or preview browser testing only
- Must not be run against production:
  - no production listing submission
  - no production image upload
- Verification:
  - auth redirects stay on staging-safe URLs
  - seller post/edit/publish flows operate only on staging
  - generated staging seller outputs reflect staging rows only
- Rollback / cleanup:
  - remove test rows and storage artifacts after verification runs as needed

### Phase 8: Only then touch publish-flow refactors

- Owner / manual action: engineering
- Commands if applicable: normal local build/test workflow plus staging validation
- Must not be run against production:
  - no production seller writes for refactor validation
- Verification:
  - VM tests pass
  - browser staging checks pass
  - publish/save/upload boundaries are validated without touching production
- Rollback / cleanup:
  - revert code changes locally or in branch
  - clean staging test artifacts

## 10. Final recommendation

Set up separate Supabase staging and Vercel preview/staging before any further publish, save, or upload work.

Pure VM-tested helper work may continue locally, but anything crossing publish, save, storage, or generated seller-data boundaries must wait for staging.
