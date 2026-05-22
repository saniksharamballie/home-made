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
NEXT_PUBLIC_ADMIN_EMAIL=saniksha@gmail.com,sycoticzn@gmail.com
NEXT_PUBLIC_SITE_URL=https://home-made.co.za
```

If Supabase values are missing, the app stays in the original demo fallback mode.

## Supabase

Apply the SQL files in `supabase/migrations` to the Supabase project. They create the runtime tables the existing app currently calls, the public image bucket, and the `profiles` auth role layer used to resolve buyer, seller, and admin access.

The larger production schema supplied with the demo is preserved at `docs/homemade-production-schema.md`.
