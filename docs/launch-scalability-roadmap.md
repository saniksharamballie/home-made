# Home-Made Launch Scalability Roadmap

## Shipped Guardrails

- Browser/PWA history now records in-app navigation so Back returns to the previous Home-Made page instead of immediately closing the app.
- Browse results use a shared filter/sort pipeline and render in pages with a Show more control.
- Home page All Listings is now a preview that hands off to Browse for the full result set.
- Seller photos, menu item thumbnails, seller thumbs, listing detail hero images, and home hero images use Supabase image rendering when possible.
- Public seller directory is hardened through a lean `security_invoker` view and supporting indexes.

## Next Refactor

- Split the single HTML/JS file into a framework structure with route modules, shared data clients, UI components, and feature folders.
- Move sensitive admin and seller workflows behind backend API routes or Supabase RPC functions.
- Replace broad seller fetches with server-side pagination, typed filters, and count queries.
- Keep public marketplace views intentionally small; add new public views only when a page requires them.
- Add image upload validation, generated responsive sizes, and documented limits for seller/gallery uploads.
- Add monitoring for auth failures, seller request approval, image upload errors, message sends, and checkout/WhatsApp handoff.
- Add smoke tests for guest browsing, login, buyer-to-seller approval, seller dashboard load, advert creation, messaging, safety, and markets.
