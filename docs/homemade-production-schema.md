# Home-Made — Production Implementation Schema
**v4.8 → Production | Supabase · Vercel · GitHub**
> Real Food. Real Homes. Durban (eThekwini)

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [GitHub Repository Structure](#2-github-repository-structure)
3. [Supabase: Auth Configuration](#3-supabase-auth-configuration)
4. [Supabase: Database Roles & Permissions](#4-supabase-database-roles--permissions)
5. [Supabase: Full Schema — All Tables](#5-supabase-full-schema--all-tables)
6. [Supabase: Row-Level Security (RLS) Policies](#6-supabase-row-level-security-rls-policies)
7. [Supabase: Database Functions & Triggers](#7-supabase-database-functions--triggers)
8. [Supabase: Storage Buckets](#8-supabase-storage-buckets)
9. [Supabase: Realtime Subscriptions](#9-supabase-realtime-subscriptions)
10. [Supabase: Edge Functions](#10-supabase-edge-functions)
11. [Vercel: Project & Environment Configuration](#11-vercel-project--environment-configuration)
12. [Vercel: Deployment Rules & Build Config](#12-vercel-deployment-rules--build-config)
13. [Feature Gates & Tier Enforcement](#13-feature-gates--tier-enforcement)
14. [PWA & Service Worker](#14-pwa--service-worker)
15. [Offline Queue Mapping](#15-offline-queue-mapping)
16. [Data Migration: Prototype → Production](#16-data-migration-prototype--production)
17. [Environment Variables Master List](#17-environment-variables-master-list)
18. [Dependency Map](#18-dependency-map)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│   Browser PWA (standalone)  ·  Mobile (iOS/Android via PWA)     │
└─────────────────────┬────────────────────────────────────────────┘
                      │  HTTPS
┌─────────────────────▼────────────────────────────────────────────┐
│                       VERCEL EDGE                                │
│  Next.js 14 App Router  ·  Edge Middleware  ·  API Routes        │
│  Static Assets  ·  sw.js  ·  PWA Manifest                       │
└──────┬──────────────────────────────────────┬────────────────────┘
       │ Supabase JS SDK                      │ Anthropic API
┌──────▼──────────────────────┐     ┌─────────▼──────────────┐
│       SUPABASE               │     │   ANTHROPIC CLAUDE API  │
│  Auth (Magic Link + OTP)    │     │   AI Pricing Advisor    │
│  PostgreSQL (pgvector)      │     │   Discover Engine       │
│  Storage (images/docs)      │     └────────────────────────┘
│  Realtime (messages/alerts) │
│  Edge Functions (cron/hooks)│     ┌────────────────────────┐
│  RLS Policies               │     │   WHATSAPP BUSINESS API │
└─────────────────────────────┘     │   Order Notifications   │
                                     │   (via Twilio/Vonage)   │
                                     └────────────────────────┘
```

**Stack:**
- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, Leaflet.js (map)
- **Backend:** Supabase (Postgres 15, Auth, Storage, Realtime, Edge Functions)
- **Hosting:** Vercel (production + preview environments)
- **External:** WhatsApp Business API, Anthropic Claude API, Google Fonts CDN, jsDelivr CDN

---

## 2. GitHub Repository Structure

```
homemade-app/
├── .github/
│   ├── workflows/
│   │   ├── preview.yml          # Deploy preview on PR
│   │   ├── production.yml       # Deploy to prod on merge to main
│   │   ├── db-migrations.yml    # Run Supabase migrations on merge
│   │   └── e2e-tests.yml        # Playwright tests on PR
│   └── CODEOWNERS
│
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root layout (PWA meta, fonts)
│   ├── page.tsx                 # Root redirect → /home
│   ├── (app)/
│   │   ├── home/page.tsx
│   │   ├── browse/page.tsx
│   │   ├── map/page.tsx
│   │   ├── post/page.tsx        # Seller listing creation
│   │   ├── profile/page.tsx
│   │   ├── detail/[sellerId]/page.tsx
│   │   ├── trends/page.tsx
│   │   ├── admin/page.tsx       # Admin-only
│   │   ├── events/page.tsx
│   │   ├── checkin/page.tsx
│   │   ├── rate/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── messages/page.tsx
│   │   ├── safety/page.tsx
│   │   └── wantlist/page.tsx
│   │
│   └── api/
│       ├── auth/callback/route.ts    # Supabase OAuth callback
│       ├── rating-token/route.ts     # Generate rating tokens
│       ├── checkin/route.ts          # QR check-in validation
│       ├── upgrade/route.ts          # Tier upgrade webhook
│       ├── ai-price/route.ts         # Claude pricing advisor
│       └── webhooks/
│           ├── payment/route.ts      # Payment provider webhook
│           └── wa-delivery/route.ts  # WhatsApp delivery receipts
│
├── components/
│   ├── ui/                      # Shadcn-style base components
│   ├── sellers/                 # SellerCard, SellerDetail, etc.
│   ├── map/                     # LeafletMap, MapPin, etc.
│   ├── events/                  # EventCard, CheckInQR, Passport
│   ├── auth/                    # LoginModal, AuthGuard
│   ├── cart/                    # OrderBasket, CartFAB
│   ├── admin/                   # AdminDashboard, KPICard, etc.
│   └── shared/                  # Toast, Modal, Skeleton, etc.
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   ├── server.ts            # Server-side Supabase client
│   │   └── admin.ts             # Service-role client (Edge Functions)
│   ├── constants/
│   │   ├── categories.ts        # CATS array
│   │   ├── dietary.ts           # DIETARY + HEALTH_FILTERS
│   │   ├── regions.ts           # REGIONS array
│   │   ├── tiers.ts             # TIERS + FEATURE_GATES
│   │   └── badges.ts            # BADGES array
│   ├── utils/
│   │   ├── qr-token.ts          # 30-min QR token logic
│   │   ├── rating-token.ts      # 128-bit rating token logic
│   │   ├── trust-score.ts       # Rating trust scorer
│   │   ├── diet-lock.ts         # applyDietLock
│   │   └── format.ts            # Currency, date helpers
│   └── types/
│       └── database.types.ts    # Supabase generated types
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_functions_triggers.sql
│   │   ├── 004_storage_buckets.sql
│   │   └── 005_seed_data.sql
│   ├── functions/               # Edge Functions (Deno)
│   │   ├── rating-token/
│   │   ├── send-wa-notification/
│   │   ├── expire-tokens/       # Cron: every hour
│   │   ├── upgrade-seller/
│   │   └── ai-pricing/
│   └── config.toml
│
├── public/
│   ├── sw.js                    # Service Worker (production)
│   ├── manifest.json            # PWA manifest
│   └── icons/                   # App icons (192, 512px)
│
├── middleware.ts                 # Vercel Edge: auth guard + role check
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local.example
└── package.json
```

### GitHub Branch Strategy

| Branch | Purpose | Deploy Target |
|--------|---------|---------------|
| `main` | Production-ready code | Vercel Production |
| `develop` | Integration branch | Vercel Preview |
| `feature/*` | Feature development | Vercel Preview (PR) |
| `hotfix/*` | Emergency production fixes | Vercel Production (fast-track) |

### GitHub Actions — Key Workflows

**`production.yml`** (on push to `main`):
```yaml
- uses: supabase/setup-cli@v1
- run: supabase db push               # Apply pending migrations
- uses: vercel/action@v1              # Deploy to production
  with:
    vercel-args: '--prod'
```

**`preview.yml`** (on PR):
```yaml
- run: supabase db push --db-url ${{ secrets.SUPABASE_PREVIEW_DB_URL }}
- uses: vercel/action@v1              # Deploy preview URL
- run: pnpm test:e2e                  # Playwright smoke tests
```

---

## 3. Supabase Auth Configuration

### Auth Providers

| Provider | Config | Notes |
|----------|--------|-------|
| **Email (Magic Link)** | Enabled | Primary sign-in for buyers/sellers |
| **Phone OTP** | Enabled (SMS via Twilio) | South African numbers (+27) |
| **Google OAuth** | Enabled | Social sign-in |
| **Anonymous** | Enabled | Guest browsing |

### Auth Settings (Dashboard → Auth → Settings)

```toml
[auth]
site_url = "https://homemade.durban"
additional_redirect_urls = [
  "https://preview-*.vercel.app",
  "http://localhost:3000"
]
jwt_expiry = 3600                      # 1 hour
refresh_token_reuse_interval = 10
enable_signup = true
double_confirm_changes = true
enable_confirmations = true            # Email confirmation required

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true
otp_exp = 3600
otp_length = 6

[auth.sms]
enable_signup = true
enable_confirmations = true
otp_exp = 300                          # 5 min
otp_length = 6
template = "Your Home-Made verification code is: {{ .Code }}"

[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"
redirect_uri = "https://[project].supabase.co/auth/v1/callback"
```

### Custom Email Templates

| Template | Subject |
|----------|---------|
| Confirm signup | "Welcome to Home-Made 🍳 — Confirm your email" |
| Magic Link | "Your Home-Made sign-in link" |
| Change email | "Confirm your new email address — Home-Made" |
| Reset password | "Reset your Home-Made password" |

---

## 4. Supabase Database Roles & Permissions

### Postgres Roles

```sql
-- Supabase built-in roles used in RLS
-- anon       → unauthenticated / guest users
-- authenticated → signed-in users (all roles)
-- service_role → Edge Functions / admin operations (bypasses RLS)

-- Application-level roles stored in profiles.role column:
-- 'guest'    → browsing only (maps to Supabase anon)
-- 'buyer'    → authenticated buyer
-- 'seller'   → authenticated seller (has seller_profiles row)
-- 'admin'    → platform admin (can see all data)
```

### Role Capabilities Matrix

| Capability | Guest (anon) | Buyer | Seller | Admin |
|-----------|-------------|-------|--------|-------|
| Browse sellers | ✅ | ✅ | ✅ | ✅ |
| View listings | ✅ | ✅ | ✅ | ✅ |
| View map | ✅ | ✅ | ✅ | ✅ |
| View events | ✅ | ✅ | ✅ | ✅ |
| Send WhatsApp order | ✅ (limited) | ✅ | ✅ | ✅ |
| Save sellers (want list) | ❌ | ✅ | ✅ | ✅ |
| Submit ratings | ❌ | ✅ | ❌ | ✅ |
| QR check-in | ❌ | ✅ | ✅ | ✅ |
| Send messages | ❌ | ✅ | ✅ | ✅ |
| Create listings | ❌ | ❌ | ✅ | ✅ |
| Manage stock | ❌ | ❌ | ✅ | ✅ |
| View analytics | ❌ | ❌ | ✅ (tier-gated) | ✅ |
| Create events | ❌ | ❌ | ✅ | ✅ |
| Issue rating tokens | ❌ | ❌ | ✅ | ✅ |
| Admin dashboard | ❌ | ❌ | ❌ | ✅ |
| Manage all users | ❌ | ❌ | ❌ | ✅ |
| Approve verifications | ❌ | ❌ | ❌ | ✅ |

---

## 5. Supabase Full Schema — All Tables

### Table: `profiles`
Central user table linked to `auth.users`. Created automatically on signup via trigger.

```sql
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE,
  phone         TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'buyer'
                  CHECK (role IN ('guest', 'buyer', 'seller', 'admin')),
  -- Buyer preferences
  dietary_prefs TEXT[]   DEFAULT '{}',      -- e.g. ['Halaal','Vegan']
  health_filters TEXT[]  DEFAULT '{}',      -- e.g. ['Low Sugar','Keto']
  diet_lock     BOOLEAN  DEFAULT FALSE,     -- lock dietary filter globally
  health_lock   BOOLEAN  DEFAULT FALSE,     -- lock health filter globally
  fav_cats      TEXT[]   DEFAULT '{}',      -- e.g. ['indian','african']
  spice_pref    TEXT     DEFAULT 'medium'
                  CHECK (spice_pref IN ('mild','medium','hot','extra-hot')),
  region_pref   TEXT,                       -- preferred browse region
  -- Notifications
  notif_email   BOOLEAN  DEFAULT TRUE,
  notif_sms     BOOLEAN  DEFAULT FALSE,
  notif_push    BOOLEAN  DEFAULT FALSE,
  push_token    TEXT,                       -- FCM token for push
  -- Meta
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT TRUE,
  onboarded     BOOLEAN DEFAULT FALSE       -- completed onboarding flow
);

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);
```

---

### Table: `seller_profiles`
Extended profile for sellers. One-to-one with `profiles` where `role='seller'`.

```sql
CREATE TABLE public.seller_profiles (
  id              UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Identity
  shop_name       TEXT NOT NULL,
  bio             TEXT,
  emoji           TEXT NOT NULL DEFAULT '🍳',
  bg_color        TEXT NOT NULL DEFAULT '#F4E4C1',  -- CSS color
  -- Location
  region          TEXT NOT NULL,                     -- e.g. 'Umhlanga'
  suburb          TEXT,
  lat             DECIMAL(10, 7),
  lng             DECIMAL(10, 7),
  -- Category & Tags
  category        TEXT NOT NULL
                    CHECK (category IN ('african','indian','baked','bbq','vegan',
                                         'italian','asian','desserts','seafood',
                                         'street','catering')),
  dietary_tags    TEXT[]   DEFAULT '{}',             -- e.g. ['Halaal','Vegan']
  health_tags     TEXT[]   DEFAULT '{}',             -- e.g. ['Low GI','High Protein']
  -- Tier & Subscription
  tier            TEXT NOT NULL DEFAULT 'standard'
                    CHECK (tier IN ('standard','gold','platinum')),
  tier_expires_at TIMESTAMPTZ,                       -- NULL = no expiry (legacy free)
  subscription_id TEXT,                              -- payment provider subscription ID
  -- Ratings (denormalised for performance)
  rating          DECIMAL(3,2) DEFAULT 0.0,
  review_count    INTEGER DEFAULT 0,
  -- Catering-specific
  min_order_pax   INTEGER,                           -- minimum pax for catering
  lead_days       INTEGER,                           -- advance notice required
  service_types   TEXT[],                            -- e.g. ['Buffet','Plated']
  -- Verification
  verification_level TEXT DEFAULT 'bronze'
                    CHECK (verification_level IN ('bronze','silver','gold','platinum')),
  verified_at     TIMESTAMPTZ,
  -- Contact (internal only — not exposed to anon)
  whatsapp_number TEXT,                              -- stored encrypted
  -- Availability
  available_days  TEXT[]   DEFAULT '{}',             -- e.g. ['Mon','Tue','Wed']
  order_cutoff    TEXT,                              -- e.g. "18:00"
  delivery_fee    DECIMAL(10,2),
  offers_delivery BOOLEAN DEFAULT FALSE,
  offers_pickup   BOOLEAN DEFAULT TRUE,
  -- Status
  is_active       BOOLEAN DEFAULT TRUE,
  is_suspended    BOOLEAN DEFAULT FALSE,
  suspended_reason TEXT,
  -- Analytics counters (updated by triggers)
  wa_intent_count INTEGER DEFAULT 0,
  profile_view_count INTEGER DEFAULT 0,
  -- Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seller_profiles_region ON public.seller_profiles(region);
CREATE INDEX idx_seller_profiles_category ON public.seller_profiles(category);
CREATE INDEX idx_seller_profiles_tier ON public.seller_profiles(tier);
CREATE INDEX idx_seller_profiles_rating ON public.seller_profiles(rating DESC);
CREATE INDEX idx_seller_profiles_active ON public.seller_profiles(is_active);
-- For geo queries
CREATE INDEX idx_seller_profiles_geo ON public.seller_profiles USING GIST (
  ll_to_earth(lat, lng)
) WHERE lat IS NOT NULL AND lng IS NOT NULL;
```

---

### Table: `menu_items`
Individual food items per seller. Replaces the `SELLERS[].items` array.

```sql
CREATE TABLE public.menu_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  price           DECIMAL(10,2) NOT NULL,
  -- Images
  image_url       TEXT,                    -- Supabase Storage URL
  image_path      TEXT,                    -- storage bucket path
  -- Stock
  stock_current   INTEGER,                 -- NULL = unlimited
  stock_capacity  INTEGER,                 -- typical batch size
  -- Tags
  dietary_tags    TEXT[]  DEFAULT '{}',
  health_tags     TEXT[]  DEFAULT '{}',
  -- Status
  is_available    BOOLEAN DEFAULT TRUE,
  is_featured     BOOLEAN DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,       -- display order
  -- Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Tier enforcement: enforced by RLS / API
  -- Standard: max 5, Gold: max 12, Platinum: max 20
  CONSTRAINT menu_item_price_positive CHECK (price >= 0)
);

CREATE INDEX idx_menu_items_seller ON public.menu_items(seller_id);
CREATE INDEX idx_menu_items_available ON public.menu_items(seller_id, is_available);
```

---

### Table: `seller_images`
Photo gallery for seller profiles.

```sql
CREATE TABLE public.seller_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  public_url      TEXT NOT NULL,
  is_primary      BOOLEAN DEFAULT FALSE,
  caption         TEXT,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seller_images_seller ON public.seller_images(seller_id);
```

---

### Table: `ratings`
Verified buyer reviews. Token-gated, single-use.

```sql
CREATE TABLE public.ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  buyer_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Token verification (replaces client-side ADM.ratingTokens)
  token           TEXT NOT NULL UNIQUE,     -- 128-bit hex token
  token_id        UUID REFERENCES public.rating_tokens(id),
  order_code      TEXT,                     -- ORD-XXXXXX reference
  -- Review content
  stars           SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment         TEXT,                     -- required for 1–2 stars
  -- Trust scoring
  trust_score     SMALLINT DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  trust_flags     TEXT[]   DEFAULT '{}',
  is_suspicious   BOOLEAN DEFAULT FALSE,
  -- Anti-fraud
  device_fingerprint TEXT,
  same_device_as_seller BOOLEAN DEFAULT FALSE,
  dwell_ms        INTEGER,                  -- time spent on rating form
  buyer_ref       TEXT,                     -- display name from order
  -- Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash         TEXT                      -- hashed IP for rate limiting
);

CREATE INDEX idx_ratings_seller ON public.ratings(seller_id);
CREATE INDEX idx_ratings_buyer ON public.ratings(buyer_id);
CREATE INDEX idx_ratings_created ON public.ratings(created_at DESC);
```

---

### Table: `rating_tokens`
Single-use tokens issued by sellers to buyers after an order.

```sql
CREATE TABLE public.rating_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  buyer_ref       TEXT NOT NULL,            -- buyer name from order
  order_code      TEXT NOT NULL,            -- ORD-XXXXXX
  token           TEXT NOT NULL UNIQUE,     -- 128-bit crypto random hex
  -- Status
  is_used         BOOLEAN DEFAULT FALSE,
  used_at         TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL      -- 72 hours from creation
                    DEFAULT (NOW() + INTERVAL '72 hours'),
  -- Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id)
);

CREATE INDEX idx_rating_tokens_seller ON public.rating_tokens(seller_id);
CREATE INDEX idx_rating_tokens_token ON public.rating_tokens(token);
CREATE INDEX idx_rating_tokens_expires ON public.rating_tokens(expires_at);
-- Partial index for pending tokens
CREATE INDEX idx_rating_tokens_pending ON public.rating_tokens(seller_id, expires_at)
  WHERE is_used = FALSE;
```

---

### Table: `events`
Market events and food festivals. Replaces `EVENTS` array.

```sql
CREATE TABLE public.events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Display
  name            TEXT NOT NULL,
  description     TEXT,
  emoji           TEXT NOT NULL DEFAULT '🍽️',
  bg_color        TEXT NOT NULL DEFAULT '#E8F4F0',
  -- Schedule
  event_date      DATE NOT NULL,
  start_time      TEXT,                     -- e.g. "08:00"
  end_time        TEXT,                     -- e.g. "14:00"
  -- Location
  venue           TEXT NOT NULL,
  address         TEXT,
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7),
  region          TEXT,
  -- Status
  status          TEXT DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming','live','past','cancelled')),
  -- Promo
  promo_code      TEXT,
  promo_pct       SMALLINT DEFAULT 0,
  -- Features
  has_lucky_draw  BOOLEAN DEFAULT FALSE,
  -- Analytics (denormalised)
  checkin_count   INTEGER DEFAULT 0,
  -- Timeline data for analytics chart (10-element array, hourly)
  timeline_data   INTEGER[] DEFAULT '{}',
  -- Organiser
  organiser_id    UUID REFERENCES public.profiles(id),
  -- Meta
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_events_status ON public.events(status);
```

---

### Table: `event_sellers`
Many-to-many: which sellers participate in which events.

```sql
CREATE TABLE public.event_sellers (
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seller_id   UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  is_featured BOOLEAN DEFAULT FALSE,        -- featured/headliner seller
  stall_number TEXT,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, seller_id)
);

CREATE INDEX idx_event_sellers_event ON public.event_sellers(event_id);
CREATE INDEX idx_event_sellers_seller ON public.event_sellers(seller_id);
```

---

### Table: `checkins`
QR code check-ins at events. Replaces `CHECKIN_STORE` localStorage.

```sql
CREATE TABLE public.checkins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seller_id   UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  -- QR token verification
  qr_token    TEXT NOT NULL,
  token_window INTEGER NOT NULL,            -- 30-min window number
  -- Location verification
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  -- Meta
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One check-in per buyer per event
  UNIQUE(buyer_id, event_id)
);

CREATE INDEX idx_checkins_buyer ON public.checkins(buyer_id);
CREATE INDEX idx_checkins_event ON public.checkins(event_id);
CREATE INDEX idx_checkins_seller ON public.checkins(seller_id);
```

---

### Table: `badges`
Gamification badge definitions. Replaces `BADGES` constant.

```sql
CREATE TABLE public.badges (
  id          TEXT PRIMARY KEY,             -- e.g. 'first_steps'
  emoji       TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_key TEXT NOT NULL,               -- 'checkins_total','events_unique', etc.
  trigger_n   INTEGER NOT NULL,            -- threshold to earn
  is_active   BOOLEAN DEFAULT TRUE
);

-- Seed data
INSERT INTO public.badges VALUES
  ('first_steps',   '🗺️', 'First Steps',      'First ever market check-in',          'checkins_total', 1,  TRUE),
  ('explorer',      '🧺', 'Market Explorer',  'Attended 3 different events',          'events_unique',  3,  TRUE),
  ('stall_hopper',  '🍽️', 'Stall Hopper',     'Checked in at 5 different sellers',    'sellers_unique', 5,  TRUE),
  ('regular',       '🏆', 'Market Regular',   '10 total check-ins',                   'checkins_total', 10, TRUE),
  ('dbn_foodie',    '👑', 'Durban Foodie',    '3 events in one calendar month',       'events_monthly', 3,  TRUE),
  ('super_supp',    '⭐', 'Super Supporter',  'Checked in at a Platinum seller stall','plat_checkin',   1,  TRUE);
```

---

### Table: `user_badges`
Earned badges per user.

```sql
CREATE TABLE public.user_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL REFERENCES public.badges(id),
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON public.user_badges(user_id);
```

---

### Table: `saved_sellers`
Buyer's want list / saved sellers. Replaces `ST.saved` array.

```sql
CREATE TABLE public.saved_sellers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id   UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes       TEXT,                         -- private buyer notes
  UNIQUE(buyer_id, seller_id)
);

CREATE INDEX idx_saved_sellers_buyer ON public.saved_sellers(buyer_id);
CREATE INDEX idx_saved_sellers_seller ON public.saved_sellers(seller_id);
```

---

### Table: `messages`
In-app messaging. Replaces `MESSAGES` array.

```sql
CREATE TABLE public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  -- Status
  is_read     BOOLEAN DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  -- Thread
  parent_id   UUID REFERENCES public.messages(id),
  -- Type
  msg_type    TEXT DEFAULT 'general'
                CHECK (msg_type IN ('general','order_inquiry','support','admin_notice')),
  -- Meta
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- No peer-to-peer within same role (enforced by RLS + API)
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX idx_messages_recipient ON public.messages(recipient_id, is_read);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_thread ON public.messages(parent_id);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);
```

---

### Table: `notifications`
System alerts and notifications. Replaces `ALERTS` array.

```sql
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
                CHECK (type IN ('new_rating','new_message','tier_expiry','order_reminder',
                                'badge_earned','event_reminder','system','marketing')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  emoji       TEXT DEFAULT '🔔',
  action_url  TEXT,                         -- deep link
  is_read     BOOLEAN DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  -- Delivery
  sent_email  BOOLEAN DEFAULT FALSE,
  sent_sms    BOOLEAN DEFAULT FALSE,
  sent_push   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);
```

---

### Table: `seller_analytics`
Aggregated daily analytics per seller. Powers seller dashboard.

```sql
CREATE TABLE public.seller_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  -- Traffic
  profile_views   INTEGER DEFAULT 0,
  wa_intents      INTEGER DEFAULT 0,        -- WhatsApp button taps
  cart_opens      INTEGER DEFAULT 0,
  -- Conversions (estimated)
  orders_est      INTEGER DEFAULT 0,
  -- Engagement
  saves           INTEGER DEFAULT 0,        -- new saves that day
  map_pins_shown  INTEGER DEFAULT 0,
  discover_shown  INTEGER DEFAULT 0,
  -- Search
  search_appearances INTEGER DEFAULT 0,
  search_clicks   INTEGER DEFAULT 0,
  UNIQUE(seller_id, date)
);

CREATE INDEX idx_analytics_seller ON public.seller_analytics(seller_id, date DESC);
```

---

### Table: `seller_verification`
Document-based verification requests.

```sql
CREATE TABLE public.seller_verification (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  -- Verification items (mirrors prototype hygieneScore checklist)
  has_id_doc          BOOLEAN DEFAULT FALSE,
  has_food_cert       BOOLEAN DEFAULT FALSE,
  has_kitchen_photo   BOOLEAN DEFAULT FALSE,
  has_health_cert     BOOLEAN DEFAULT FALSE,
  has_business_reg    BOOLEAN DEFAULT FALSE,   -- for gold/platinum
  -- Document storage paths
  id_doc_path         TEXT,
  food_cert_path      TEXT,
  kitchen_photo_path  TEXT,
  health_cert_path    TEXT,
  business_reg_path   TEXT,
  -- Status
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','in_review','approved','rejected')),
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  -- Current level (mirrors SELLER_VERIFICATION prototype object)
  current_level   TEXT DEFAULT 'bronze'
                    CHECK (current_level IN ('bronze','silver','gold','platinum')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_seller ON public.seller_verification(seller_id);
CREATE INDEX idx_verification_status ON public.seller_verification(status);
```

---

### Table: `orders`
Order records created when buyer taps "Send via WhatsApp". Enables rating token issuance.

```sql
CREATE TABLE public.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code      TEXT NOT NULL UNIQUE,     -- ORD-XXXXXX
  seller_id       UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  buyer_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  buyer_name      TEXT NOT NULL,
  -- Items snapshot (JSON to preserve price at time of order)
  items           JSONB NOT NULL DEFAULT '[]',
  -- e.g. [{"name":"Bunny Chow","qty":2,"price":85.00,"item_id":"..."}]
  subtotal        DECIMAL(10,2) NOT NULL,
  delivery_fee    DECIMAL(10,2) DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL,
  -- Fulfilment
  fulfil_type     TEXT NOT NULL DEFAULT 'pickup'
                    CHECK (fulfil_type IN ('pickup','delivery')),
  special_notes   TEXT,
  -- Promo applied
  promo_code      TEXT,
  discount_pct    SMALLINT DEFAULT 0,
  -- Status
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','completed','cancelled')),
  -- Rating
  rating_token_issued BOOLEAN DEFAULT FALSE,
  -- Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wa_sent_at      TIMESTAMPTZ                -- when WA message was sent
);

CREATE INDEX idx_orders_seller ON public.orders(seller_id);
CREATE INDEX idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX idx_orders_code ON public.orders(order_code);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
```

---

### Table: `subscriptions`
Seller tier subscriptions and payment tracking.

```sql
CREATE TABLE public.subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL CHECK (tier IN ('standard','gold','platinum')),
  -- Payment
  payment_provider TEXT DEFAULT 'payfast'
                    CHECK (payment_provider IN ('payfast','peach','stripe')),
  provider_sub_id TEXT,                     -- provider's subscription ID
  amount_zar      DECIMAL(10,2) NOT NULL,   -- R249 or R499
  billing_cycle   TEXT DEFAULT 'monthly'
                    CHECK (billing_cycle IN ('monthly','annual')),
  -- Dates
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ,              -- NULL = active recurring
  cancelled_at    TIMESTAMPTZ,
  -- Status
  status          TEXT DEFAULT 'active'
                    CHECK (status IN ('active','cancelled','expired','past_due','trial')),
  -- Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_seller ON public.subscriptions(seller_id, status);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
```

---

### Table: `offline_queue`
Server-side persistence for actions queued offline (fallback for edge cases).

```sql
CREATE TABLE public.offline_queue (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('rating','want_list','checkin','order')),
  payload     JSONB NOT NULL,
  queued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed   BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error       TEXT
);

CREATE INDEX idx_offline_queue_user ON public.offline_queue(user_id, processed);
```

---

### Table: `reports`
Buyer reports on suspicious sellers/listings.

```sql
CREATE TABLE public.reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_id   UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL
                CHECK (reason IN ('fake_listing','bad_food','scam','hygiene',
                                   'harassment','wrong_info','other')),
  details     TEXT,
  status      TEXT DEFAULT 'open'
                CHECK (status IN ('open','investigating','resolved','dismissed')),
  reviewed_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_seller ON public.reports(seller_id);
CREATE INDEX idx_reports_status ON public.reports(status);
```

---

### Table: `behavior_events`
Anonymous/identified behavior tracking for Discover engine and analytics.

```sql
CREATE TABLE public.behavior_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id  TEXT,
  event_type  TEXT NOT NULL,               -- 'view','wa_intent','save','search',etc.
  seller_id   UUID REFERENCES public.seller_profiles(id) ON DELETE SET NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for scale
CREATE INDEX idx_behavior_user ON public.behavior_events(user_id, event_type);
CREATE INDEX idx_behavior_seller ON public.behavior_events(seller_id, event_type);
CREATE INDEX idx_behavior_created ON public.behavior_events(created_at DESC);
```

---

## 6. Supabase Row-Level Security (RLS) Policies

All tables have RLS enabled. The helper function below is used throughout.

```sql
-- Helper: get role from profiles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: check if user owns a seller profile
CREATE OR REPLACE FUNCTION public.owns_seller(seller_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seller_profiles
    WHERE id = seller_uuid AND id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

### RLS: `profiles`

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read public profile fields (display_name, avatar, role)
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (TRUE);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- Trigger creates profile on signup; no INSERT policy needed for users
```

### RLS: `seller_profiles`

```sql
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

-- Public read (needed for browse/map)
CREATE POLICY "sellers_select_public" ON public.seller_profiles
  FOR SELECT USING (is_active = TRUE AND is_suspended = FALSE);

-- Admins can see all sellers including suspended
CREATE POLICY "sellers_select_admin" ON public.seller_profiles
  FOR SELECT USING (public.is_admin());

-- Sellers can update their own profile
CREATE POLICY "sellers_update_own" ON public.seller_profiles
  FOR UPDATE USING (auth.uid() = id);

-- New seller profiles can be inserted by authenticated users with seller role
CREATE POLICY "sellers_insert_own" ON public.seller_profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id AND
    public.get_user_role() = 'seller'
  );

-- Admins can do everything
CREATE POLICY "sellers_admin_all" ON public.seller_profiles
  FOR ALL USING (public.is_admin());
```

### RLS: `menu_items`

```sql
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read available menu items
CREATE POLICY "menu_select_public" ON public.menu_items
  FOR SELECT USING (is_available = TRUE);

-- Sellers can manage their own items (with tier limit enforced in API)
CREATE POLICY "menu_insert_own" ON public.menu_items
  FOR INSERT WITH CHECK (public.owns_seller(seller_id));

CREATE POLICY "menu_update_own" ON public.menu_items
  FOR UPDATE USING (public.owns_seller(seller_id));

CREATE POLICY "menu_delete_own" ON public.menu_items
  FOR DELETE USING (public.owns_seller(seller_id));

CREATE POLICY "menu_admin_all" ON public.menu_items
  FOR ALL USING (public.is_admin());
```

### RLS: `ratings`

```sql
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-suspicious ratings
CREATE POLICY "ratings_select_public" ON public.ratings
  FOR SELECT USING (is_suspicious = FALSE);

-- Authenticated buyers can submit ratings (token validated in API)
CREATE POLICY "ratings_insert_buyer" ON public.ratings
  FOR INSERT WITH CHECK (
    auth.uid() = buyer_id AND
    public.get_user_role() IN ('buyer','admin')
  );

-- Admins see all
CREATE POLICY "ratings_admin_all" ON public.ratings
  FOR ALL USING (public.is_admin());
```

### RLS: `rating_tokens`

```sql
ALTER TABLE public.rating_tokens ENABLE ROW LEVEL SECURITY;

-- Sellers can see and create tokens for their own sellers
CREATE POLICY "tokens_select_own" ON public.rating_tokens
  FOR SELECT USING (public.owns_seller(seller_id));

CREATE POLICY "tokens_insert_own" ON public.rating_tokens
  FOR INSERT WITH CHECK (public.owns_seller(seller_id));

-- Admins see all
CREATE POLICY "tokens_admin_all" ON public.rating_tokens
  FOR ALL USING (public.is_admin());
```

### RLS: `messages`

```sql
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own messages (inbox + outbox)
CREATE POLICY "messages_select_own" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

-- Authenticated users can send messages
CREATE POLICY "messages_insert_auth" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    auth.uid() IS NOT NULL AND
    -- No peer-to-peer within same role (buyer→buyer, seller→seller blocked in API)
    (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'guest'
  );

-- Recipient can mark as read
CREATE POLICY "messages_update_recipient" ON public.messages
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "messages_admin_all" ON public.messages
  FOR ALL USING (public.is_admin());
```

### RLS: `checkins`

```sql
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Users can see their own check-ins
CREATE POLICY "checkins_select_own" ON public.checkins
  FOR SELECT USING (auth.uid() = buyer_id);

-- Sellers can see check-ins for their events
CREATE POLICY "checkins_select_seller" ON public.checkins
  FOR SELECT USING (public.owns_seller(seller_id));

-- Authenticated users can check in
CREATE POLICY "checkins_insert_auth" ON public.checkins
  FOR INSERT WITH CHECK (
    auth.uid() = buyer_id AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "checkins_admin_all" ON public.checkins
  FOR ALL USING (public.is_admin());
```

### RLS: `events`

```sql
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can view active events
CREATE POLICY "events_select_public" ON public.events
  FOR SELECT USING (is_active = TRUE);

-- Sellers can create events
CREATE POLICY "events_insert_seller" ON public.events
  FOR INSERT WITH CHECK (
    auth.uid() = organiser_id AND
    public.get_user_role() IN ('seller','admin')
  );

-- Organiser or admin can update
CREATE POLICY "events_update_own" ON public.events
  FOR UPDATE USING (
    auth.uid() = organiser_id OR public.is_admin()
  );

CREATE POLICY "events_admin_all" ON public.events
  FOR ALL USING (public.is_admin());
```

### RLS: `saved_sellers`

```sql
ALTER TABLE public.saved_sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_select_own" ON public.saved_sellers
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "saved_insert_own" ON public.saved_sellers
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "saved_delete_own" ON public.saved_sellers
  FOR DELETE USING (auth.uid() = buyer_id);
```

### RLS: `seller_analytics`

```sql
ALTER TABLE public.seller_analytics ENABLE ROW LEVEL SECURITY;

-- Sellers can only see their own analytics
CREATE POLICY "analytics_select_own" ON public.seller_analytics
  FOR SELECT USING (public.owns_seller(seller_id));

-- Only service_role (edge functions) can insert/update
-- (no user-facing INSERT policy — written by triggers)

CREATE POLICY "analytics_admin_all" ON public.seller_analytics
  FOR ALL USING (public.is_admin());
```

### RLS: `notifications`

```sql
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
-- Insert via service_role (Edge Functions / triggers only)
```

### RLS: `orders`

```sql
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_buyer" ON public.orders
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "orders_select_seller" ON public.orders
  FOR SELECT USING (public.owns_seller(seller_id));

CREATE POLICY "orders_insert_buyer" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id OR auth.uid() IS NOT NULL);

CREATE POLICY "orders_admin_all" ON public.orders
  FOR ALL USING (public.is_admin());
```

### RLS: `reports`

```sql
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert_auth" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "reports_admin_all" ON public.reports
  FOR ALL USING (public.is_admin());
```

---

## 7. Supabase Database Functions & Triggers

### Trigger: Auto-create profile on signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Trigger: Update `updated_at` timestamp

```sql
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all relevant tables
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_seller_profiles_updated_at
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- (repeat for: menu_items, events, subscriptions, seller_verification, orders)
```

### Trigger: Recalculate seller rating after new rating

```sql
CREATE OR REPLACE FUNCTION public.recalculate_seller_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.seller_profiles
  SET
    rating = (
      SELECT ROUND(AVG(stars)::NUMERIC, 2)
      FROM public.ratings
      WHERE seller_id = NEW.seller_id AND is_suspicious = FALSE
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.ratings
      WHERE seller_id = NEW.seller_id AND is_suspicious = FALSE
    )
  WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_rating_recalculate
  AFTER INSERT OR UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_seller_rating();
```

### Trigger: Increment event check-in count

```sql
CREATE OR REPLACE FUNCTION public.increment_event_checkins()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.events
  SET checkin_count = checkin_count + 1
  WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_checkin_count
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.increment_event_checkins();
```

### Trigger: Award badges after check-in

```sql
CREATE OR REPLACE FUNCTION public.evaluate_badges()
RETURNS TRIGGER AS $$
DECLARE
  v_stats RECORD;
BEGIN
  -- Compute stats for the buyer
  SELECT
    COUNT(*)                                  AS checkins_total,
    COUNT(DISTINCT event_id)                  AS events_unique,
    COUNT(DISTINCT seller_id)                 AS sellers_unique,
    MAX(monthly_count)                        AS events_monthly,
    BOOL_OR(is_plat)                          AS plat_checkin
  INTO v_stats
  FROM (
    SELECT
      c.event_id, c.seller_id,
      COUNT(*) OVER (PARTITION BY DATE_TRUNC('month', c.checked_in_at)) AS monthly_count,
      (sp.tier = 'platinum') AS is_plat
    FROM public.checkins c
    JOIN public.seller_profiles sp ON sp.id = c.seller_id
    WHERE c.buyer_id = NEW.buyer_id
  ) sub;

  -- Insert earned badges (on conflict do nothing)
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT NEW.buyer_id, b.id
  FROM public.badges b
  WHERE b.is_active = TRUE
    AND CASE b.trigger_key
      WHEN 'checkins_total'  THEN v_stats.checkins_total  >= b.trigger_n
      WHEN 'events_unique'   THEN v_stats.events_unique   >= b.trigger_n
      WHEN 'sellers_unique'  THEN v_stats.sellers_unique  >= b.trigger_n
      WHEN 'events_monthly'  THEN v_stats.events_monthly  >= b.trigger_n
      WHEN 'plat_checkin'    THEN v_stats.plat_checkin    = TRUE
      ELSE FALSE
    END
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_evaluate_badges
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.evaluate_badges();
```

### Function: Enforce menu item tier limits

```sql
CREATE OR REPLACE FUNCTION public.check_menu_item_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_tier TEXT;
  v_count INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT tier INTO v_tier FROM public.seller_profiles WHERE id = NEW.seller_id;
  SELECT COUNT(*) INTO v_count FROM public.menu_items WHERE seller_id = NEW.seller_id;

  v_limit := CASE v_tier
    WHEN 'platinum' THEN 20
    WHEN 'gold'     THEN 12
    ELSE 5
  END;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Menu item limit reached for % tier (max %)', v_tier, v_limit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_menu_item_limit
  BEFORE INSERT ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.check_menu_item_limit();
```

### Function: Validate rating token

```sql
CREATE OR REPLACE FUNCTION public.validate_and_consume_token(p_token TEXT)
RETURNS TABLE(is_valid BOOLEAN, seller_id UUID, order_code TEXT, error_msg TEXT) AS $$
DECLARE
  v_token_row public.rating_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token_row
  FROM public.rating_tokens
  WHERE token = p_token
  FOR UPDATE;  -- lock to prevent race conditions

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Token not found';
    RETURN;
  END IF;

  IF v_token_row.is_used THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Token already used';
    RETURN;
  END IF;

  IF NOW() > v_token_row.expires_at THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Token expired';
    RETURN;
  END IF;

  -- Mark as used
  UPDATE public.rating_tokens
  SET is_used = TRUE, used_at = NOW()
  WHERE id = v_token_row.id;

  RETURN QUERY SELECT TRUE, v_token_row.seller_id, v_token_row.order_code, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 8. Supabase Storage Buckets

```sql
-- Run in Supabase Dashboard → Storage → Create Bucket
-- Or via migration using storage schema
```

| Bucket Name | Public | Purpose | Max File Size |
|-------------|--------|---------|---------------|
| `seller-images` | ✅ Yes | Seller food photos, kitchen pics | 5 MB |
| `seller-avatars` | ✅ Yes | Seller profile avatar/emoji fallback | 2 MB |
| `verification-docs` | ❌ Private | ID docs, food certs, health certs | 10 MB |
| `event-images` | ✅ Yes | Event hero images | 5 MB |

### Storage Policies

```sql
-- seller-images: authenticated sellers can upload to their own folder
CREATE POLICY "seller_images_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'seller-images' AND
  auth.uid()::TEXT = (storage.foldername(name))[1]
);

CREATE POLICY "seller_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'seller-images');

-- verification-docs: only uploader and admins can access
CREATE POLICY "verification_docs_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'verification-docs' AND
  auth.uid()::TEXT = (storage.foldername(name))[1]
);

CREATE POLICY "verification_docs_owner_or_admin"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'verification-docs' AND (
    auth.uid()::TEXT = (storage.foldername(name))[1] OR
    public.is_admin()
  )
);
```

### Storage Path Conventions

```
seller-images/
  {seller_id}/
    primary.jpg
    gallery-1.jpg
    gallery-2.jpg
    menu-{item_id}.jpg

seller-avatars/
  {seller_id}.jpg

verification-docs/
  {seller_id}/
    id-doc.pdf
    food-cert.pdf
    kitchen-photo.jpg
    health-cert.pdf

event-images/
  {event_id}/
    hero.jpg
```

---

## 9. Supabase Realtime Subscriptions

Enable Realtime on these tables in the Dashboard → Database → Replication:

| Table | Events | Use Case |
|-------|--------|---------|
| `messages` | INSERT | Live message badge / unread count |
| `notifications` | INSERT | Real-time notification bell |
| `ratings` | INSERT | Seller dashboard live rating feed |
| `checkins` | INSERT | Event check-in count live update |
| `events` | UPDATE | Status changes (live/ended) |
| `seller_profiles` | UPDATE | Stock/availability changes |

### Client Subscription Example (Next.js)

```typescript
// lib/realtime/messages.ts
export function subscribeToMessages(userId: string, onNew: (msg: Message) => void) {
  return supabase
    .channel('messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `recipient_id=eq.${userId}`
    }, (payload) => onNew(payload.new as Message))
    .subscribe();
}
```

---

## 10. Supabase Edge Functions

### `expire-tokens` (Cron — runs every hour)

```typescript
// supabase/functions/expire-tokens/index.ts
// Scheduled via Supabase Dashboard → Edge Functions → Schedule
// Cron: "0 * * * *"

Deno.serve(async () => {
  const { error } = await adminClient
    .from('rating_tokens')
    .update({ is_used: true })
    .lt('expires_at', new Date().toISOString())
    .eq('is_used', false);
  // Also clean behavior_events older than 90 days
  return new Response(JSON.stringify({ ok: !error }));
});
```

### `generate-rating-token` (HTTP)

Validates order code, creates token, sends WhatsApp to buyer with link.

```typescript
// Input: { seller_id, buyer_name, order_code, wa_number }
// Output: { token, rating_url, expires_at }
// Auth: seller JWT required
```

### `upgrade-seller` (HTTP — payment webhook)

Called by PayFast/Peach webhook after successful payment.

```typescript
// 1. Verify webhook signature
// 2. UPDATE seller_profiles SET tier = ..., tier_expires_at = ...
// 3. INSERT INTO subscriptions
// 4. INSERT INTO notifications (tier upgrade notice)
// 5. Send upgrade confirmation email via Resend/Sendgrid
```

### `ai-pricing-advisor` (HTTP)

Calls Anthropic Claude API to give seller pricing recommendations.
Gated: `platinum` tier only (checked via JWT).

```typescript
// Input: { seller_id, items: [{name, current_price}], region, category }
// Calls Claude with competitor pricing context
// Output: { recommendations: [{item, suggestion, reasoning}] }
```

### `send-wa-notification` (HTTP)

Sends WhatsApp Business API messages for order confirmations and rating reminders.

```typescript
// Input: { to, type: 'order_confirm'|'rating_reminder', payload }
// Uses Twilio/Vonage WhatsApp Business API
```

---

## 11. Vercel: Project & Environment Configuration

### Project Settings

```
Framework Preset:     Next.js
Root Directory:       ./
Build Command:        pnpm build
Output Directory:     .next
Install Command:      pnpm install
Node.js Version:      20.x
```

### Domains

| Domain | Environment |
|--------|-------------|
| `homemade.durban` | Production |
| `www.homemade.durban` | Production (redirect) |
| `dev.homemade.durban` | Preview (develop branch) |
| `*.vercel.app` | PR Previews |

### Environment Variables Per Environment

(See full list in [Section 17](#17-environment-variables-master-list))

---

## 12. Vercel: Deployment Rules & Build Config

### `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA headers
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options',   value: 'nosniff' },
        { key: 'X-Frame-Options',           value: 'DENY' },
        { key: 'X-XSS-Protection',          value: '1; mode=block' },
        { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',        value: 'geolocation=(self), camera=(self)' },
      ],
    },
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'fonts.gstatic.com' },
    ],
  },
  // Redirect www → apex
  redirects: async () => [
    { source: '/', destination: '/home', permanent: false },
  ],
};
```

### Edge Middleware (`middleware.ts`)

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  // Protected routes
  const protectedRoutes = ['/post', '/profile', '/messages', '/wantlist'];
  const sellerRoutes = ['/post', '/admin'];
  const adminRoutes = ['/admin'];

  const path = req.nextUrl.pathname;

  if (protectedRoutes.some(r => path.startsWith(r)) && !session) {
    return NextResponse.redirect(new URL('/home?auth=required', req.url));
  }

  if (adminRoutes.some(r => path.startsWith(r))) {
    // Fetch role from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session?.user?.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/home', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'],
};
```

### Vercel `vercel.json`

```json
{
  "crons": [],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/manifest.json",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=86400" }]
    }
  ]
}
```

---

## 13. Feature Gates & Tier Enforcement

This replaces the client-side `FEATURE_GATES` and `softLock()` functions with server-enforced rules.

### Feature Gate Table

```sql
CREATE TABLE public.feature_gates (
  feature_key   TEXT PRIMARY KEY,
  min_tier      TEXT NOT NULL CHECK (min_tier IN ('standard','gold','platinum')),
  description   TEXT
);

INSERT INTO public.feature_gates VALUES
  ('analytics_basic',        'gold',     'Basic seller analytics'),
  ('analytics_advanced',     'platinum', 'Full analytics dashboard'),
  ('ai_pricing',             'platinum', 'Claude AI pricing advisor'),
  ('trending_boost',         'platinum', 'Top trending placement'),
  ('trending_limited',       'gold',     'Featured in trending'),
  ('map_pin_boost',          'gold',     'Boosted map pin'),
  ('post_extra_listings',    'gold',     'More than 5 menu items'),
  ('conversion_insights',    'platinum', 'Conversion rate insights'),
  ('peak_demand_timing',     'platinum', 'Peak demand analytics'),
  ('competitive_benchmark',  'platinum', 'Competitor benchmark data'),
  ('homepage_carousel',      'platinum', 'Homepage featured carousel'),
  ('discount_bulk',          'gold',     'Bulk discount codes'),
  ('discount_smart',         'platinum', 'Smart/dynamic discounts');
```

### Server-Side Gate Check (API Route)

```typescript
// lib/utils/feature-gate.ts
export async function checkFeatureAccess(
  sellerId: string,
  featureKey: string
): Promise<boolean> {
  const { data: seller } = await supabase
    .from('seller_profiles')
    .select('tier, tier_expires_at')
    .eq('id', sellerId)
    .single();

  if (!seller) return false;

  // Check tier hasn't expired
  if (seller.tier_expires_at && new Date(seller.tier_expires_at) < new Date()) {
    // Downgrade to standard
    await supabase.from('seller_profiles')
      .update({ tier: 'standard' })
      .eq('id', sellerId);
    return featureKey === 'standard';
  }

  const { data: gate } = await supabase
    .from('feature_gates')
    .select('min_tier')
    .eq('feature_key', featureKey)
    .single();

  if (!gate) return true; // Unknown feature = open

  const TIER_ORDER = { standard: 0, gold: 1, platinum: 2 };
  return (TIER_ORDER[seller.tier] ?? 0) >= (TIER_ORDER[gate.min_tier] ?? 0);
}
```

---

## 14. PWA & Service Worker

### `public/sw.js` (production file)

```javascript
const CACHE_VERSION = 'hm-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const IMG_CACHE   = `${CACHE_VERSION}-img`;
const DATA_CACHE  = `${CACHE_VERSION}-data`;

const SHELL_ASSETS = [
  '/',
  '/home',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  const VALID = [SHELL_CACHE, IMG_CACHE, DATA_CACHE];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !VALID.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Strategy: images = stale-while-revalidate; navigation = cache-first;
//           API = network-first
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Supabase API — network first, cache fallback
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Images — stale while revalidate
  if (request.destination === 'image') {
    e.respondWith(staleWhileRevalidate(request, IMG_CACHE));
    return;
  }

  // Navigation — cache first (app shell)
  if (request.mode === 'navigate') {
    e.respondWith(
      caches.match('/').then(cached => cached || fetch(request))
    );
    return;
  }

  e.respondWith(networkFirst(request, DATA_CACHE));
});
```

### `public/manifest.json`

```json
{
  "name": "Home-Made — Real Food. Real Homes.",
  "short_name": "Home-Made",
  "description": "Buy and sell homemade food in your community",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FDF6EE",
  "theme_color": "#E55A18",
  "orientation": "portrait-primary",
  "categories": ["food", "shopping", "lifestyle"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "shortcuts": [
    { "name": "Browse",  "url": "/browse",  "icons": [{"src": "/icons/browse.png","sizes":"96x96"}] },
    { "name": "Map",     "url": "/map",     "icons": [{"src": "/icons/map.png",   "sizes":"96x96"}] },
    { "name": "Markets", "url": "/events",  "icons": [{"src": "/icons/market.png","sizes":"96x96"}] }
  ]
}
```

---

## 15. Offline Queue Mapping

The client-side `hm_offline_queue` localStorage actions map to these server endpoints when flushed:

| Queue Action Type | Flush Endpoint | Table Written |
|------------------|---------------|---------------|
| `rating` | `POST /api/ratings` | `ratings` |
| `want_list` | `POST /api/saved-sellers` | `saved_sellers` |
| `checkin` | `POST /api/checkin` | `checkins` |
| `order` | `POST /api/orders` | `orders` |

The `offline_queue` Supabase table serves as a server-side backup for actions submitted while offline that couldn't be flushed client-side (e.g. app was closed before coming back online). The client IndexedDB or localStorage queue is the primary; the server table is a safety net populated via a background sync API route.

---

## 16. Data Migration: Prototype → Production

### Step 1: Seed Categories & Regions

```sql
-- Regions (from REGIONS constant)
INSERT INTO public.feature_gates ... -- (already shown above)

-- Badges (from BADGES constant)
INSERT INTO public.badges ... -- (already shown above)
```

### Step 2: Migrate Seller Data

The prototype `SELLERS` array (30 demo listings) maps to:

| Prototype Field | Table | Column |
|----------------|-------|--------|
| `s.id` | `seller_profiles` | Create new UUID; map old int IDs |
| `s.name` | `seller_profiles` | `shop_name` |
| `s.e` | `seller_profiles` | `emoji` |
| `s.bg` | `seller_profiles` | `bg_color` |
| `s.region` | `seller_profiles` | `region` |
| `s.cat` | `seller_profiles` | `category` |
| `s.dietary` | `seller_profiles` | `dietary_tags` |
| `s.healthTags` | `seller_profiles` | `health_tags` |
| `s.rat` | `seller_profiles` | `rating` |
| `s.rev` | `seller_profiles` | `review_count` |
| `s.tier` | `seller_profiles` | `tier` |
| `s.lat / s.lng` | `seller_profiles` | `lat / lng` |
| `s.wa` | `seller_profiles` | `whatsapp_number` (encrypted) |
| `s.items[]` | `menu_items` | One row per item |
| `s.bio` | `seller_profiles` | `bio` |
| `STOCK[id][i]` | `menu_items` | `stock_current` |
| `CAPACITY[id][i]` | `menu_items` | `stock_capacity` |
| `SELLER_VERIFICATION[id]` | `seller_verification` | `current_level` |

### Step 3: Migrate Events

The prototype `EVENTS` array maps directly to the `events` and `event_sellers` tables.

### Step 4: Migrate Hardcoded Alerts

`ALERTS` array → seed `notifications` table (admin-to-all-users type).

### Step 5: Create Admin Account

```sql
-- After creating admin user in Supabase Auth Dashboard:
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@homemade.durban';
```

---

## 17. Environment Variables Master List

### Vercel — Production

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # Server-only, never exposed to client

# App
NEXT_PUBLIC_APP_URL=https://homemade.durban
NEXT_PUBLIC_SITE_NAME=Home-Made

# Anthropic (AI pricing advisor — Platinum feature)
ANTHROPIC_API_KEY=sk-ant-...

# WhatsApp Business API (Twilio or Vonage)
WA_API_PROVIDER=twilio                   # or 'vonage'
WA_ACCOUNT_SID=AC...
WA_AUTH_TOKEN=...
WA_PHONE_NUMBER=+27...                   # WhatsApp Business number

# Payment (PayFast — South Africa primary)
PAYFAST_MERCHANT_ID=...
PAYFAST_MERCHANT_KEY=...
PAYFAST_PASSPHRASE=...
PAYFAST_SANDBOX=false

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Email (Resend or Sendgrid)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@homemade.durban

# SMS (Supabase handles via Twilio — set in Supabase dashboard, not Vercel)

# Leaflet / Map tiles (no key needed for OSM default)
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_...         # Optional: PostHog analytics
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### Vercel — Preview / Staging

Same as production but with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://[preview-project-ref].supabase.co
PAYFAST_SANDBOX=true
NEXT_PUBLIC_APP_URL=https://dev.homemade.durban
```

### Supabase Edge Functions (set via `supabase secrets set`)

```env
ANTHROPIC_API_KEY=sk-ant-...
WA_ACCOUNT_SID=AC...
WA_AUTH_TOKEN=...
WA_PHONE_NUMBER=+27...
RESEND_API_KEY=re_...
PAYFAST_PASSPHRASE=...
```

---

## 18. Dependency Map

### NPM Packages

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "leaflet": "^1.9.4",
    "qrcode": "^1.5.3",              // server-side QR generation
    "react-leaflet": "^4.2.1",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "clsx": "^2.1.0",
    "zustand": "^4.5.0"              // replaces ST global state object
  },
  "devDependencies": {
    "@playwright/test": "^1.44.0",
    "supabase": "^1.170.0",          // Supabase CLI
    "@types/leaflet": "^1.9.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0"
  }
}
```

### External Service Dependencies

| Service | Purpose | SA Alternative |
|---------|---------|---------------|
| Supabase | DB, Auth, Storage, Realtime | (Primary choice) |
| Vercel | Hosting, Edge Functions | Cloudflare Pages |
| Anthropic Claude | AI pricing advisor (Platinum) | OpenAI GPT-4 |
| PayFast | ZAR payments | Peach Payments / Yoco |
| Twilio | WhatsApp Business API, SMS OTP | Vonage |
| Resend | Transactional email | Sendgrid |
| OpenStreetMap + Leaflet | Map tiles | Google Maps (paid) |
| Google Fonts | Typography (Playfair Display, DM Sans) | Self-hosted fallback |
| PostHog | Product analytics | Mixpanel |

### Internal Dependency Graph

```
auth.users
  └── profiles (1:1 via trigger)
        ├── seller_profiles (1:1, role=seller)
        │     ├── menu_items (1:many)
        │     ├── seller_images (1:many)
        │     ├── seller_analytics (1:many by date)
        │     ├── seller_verification (1:1)
        │     ├── subscriptions (1:many)
        │     ├── rating_tokens (1:many)
        │     ├── event_sellers (many:many → events)
        │     └── reports (many:many ← profiles)
        │
        ├── ratings (buyer → seller)
        ├── saved_sellers (buyer → seller)
        ├── checkins (buyer → event → seller)
        ├── user_badges (buyer → badges)
        ├── messages (many:many ← profiles)
        ├── notifications (1:many)
        ├── orders (buyer → seller)
        └── offline_queue (1:many)

events
  ├── event_sellers (many:many → seller_profiles)
  └── checkins (many:many → profiles)

badges (static seed data)
  └── user_badges (many:many → profiles)

feature_gates (static seed data)
  └── (referenced by API/Edge Functions)
```

---

*Document generated from prototype analysis of Home-Made v4.8*
*Last updated: May 2026*
