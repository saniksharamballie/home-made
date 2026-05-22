# Home-Made

Production deployment package for Home-Made.co.za.

This keeps the original single-page demo behavior intact, then adds:

- Vercel static/PWA deployment config
- build-time Supabase environment injection
- production service worker
- Supabase compatibility migration for the demo runtime tables
- GitHub Actions placeholders for Vercel deploys

## Local build

```bash
npm install
npm run build
npm run check
```

The built app is emitted to `public/index.html`.

## Required Vercel environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ADMIN_EMAIL=saniksha@gmail.com
NEXT_PUBLIC_SITE_URL=https://home-made.co.za
```

If Supabase values are missing, the app stays in the original demo fallback mode.

## Supabase

Apply `supabase/migrations/20260522120000_home_made_runtime.sql` to the Supabase project. It creates the runtime tables the existing app currently calls: `buyers`, `sellers`, `orders`, `messages`, `notifications`, and public/read-write policies scoped for the current prototype-to-production bridge.

The larger production schema supplied with the demo is preserved at `docs/homemade-production-schema.md`.
