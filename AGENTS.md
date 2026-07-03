# Home-Made Codex Instructions

## 1. Project overview

Home-Made is a production Progressive Web App deployed on Vercel.

The application is currently built primarily from:

`src/homemade-map-cleaned-1.html`

The build process generates production files in `public/`, including:

* `public/index.html`
* SEO landing pages
* Legal pages
* `public/env.js`
* `public/sitemap.xml`

The application uses Supabase for database, authentication and seller-related functionality.

The application includes:

* Buyer accounts
* Seller accounts
* Seller adverts
* Seller availability
* Seller dashboards
* Admin tools
* Marketplace filtering
* Ratings and favourites
* PWA installation and offline support
* Supabase migrations
* Vercel API routes
* Generated SEO pages
* PayFast-related files, although PayFast is currently paused

Preserve the existing application architecture unless the task specifically requires an architectural change.

---

## 2. Core working rules

Before making changes:

1. Inspect the relevant files and existing implementation.
2. Identify the exact functions, styles, markup and data flows involved.
3. Check whether the feature is implemented more than once.
4. Reuse existing components, utilities, variables and design patterns.
5. Make the smallest change that safely fulfils the request.
6. Do not change unrelated functionality.
7. Do not introduce speculative improvements outside the requested scope.
8. Do not add dependencies without explaining why they are necessary.
9. Do not deploy unless explicitly instructed to deploy.
10. Do not commit unless explicitly instructed to commit.

When the task affects authentication, database security, service-worker behaviour, payments, deployment, migrations or major architecture, inspect the implementation and present a concise plan before editing unless the user explicitly requests immediate implementation.

---

## 3. Scope control

Each task or thread should focus on one primary system.

Recommended scopes are:

* PWA caching and offline behaviour
* Seller and admin workflows
* Marketplace and seller adverts
* Authentication and account state
* Visual and responsive changes
* Icons, photos and image assets
* Payments
* Supabase migrations and security
* Deployment
* Testing
* Architecture and gradual source extraction

Do not combine unrelated systems in a single implementation unless they are directly dependent on one another.

Do not perform incidental refactoring while fixing a targeted bug.

Do not make visual changes while completing a data, security, caching or database task unless the visual change is required for the requested behaviour.

---

## 4. Source and generated files

Make application changes in:

`src/homemade-map-cleaned-1.html`

unless the task specifically concerns:

* `public/sw.js`
* Static assets
* API routes
* Supabase migrations
* Documentation
* Build scripts
* Deployment configuration
* Generated SEO content
* Other explicitly named files

Do not edit `public/index.html` as the primary source of an application change if it is generated from the source HTML.

After changing the source application, run the build and confirm that the generated output reflects the source change.

When generated files change, clearly distinguish between:

* Source changes
* Generated changes
* Build metadata
* Sitemap or SEO changes
* Service-worker changes

Do not manually overwrite generated files without determining how they are produced.

---

## 5. Large source file safety

`src/homemade-map-cleaned-1.html` is a very large, interconnected source file.

Before editing it:

1. Locate the exact relevant markup, functions and styles.
2. Search for duplicate IDs, functions, labels, selectors and event handlers.
3. Identify all callers and related code paths.
4. Check for desktop and mobile variants.
5. Check for buyer, seller and admin variants.
6. Make the smallest targeted edit.
7. Avoid broad search-and-replace operations.
8. Avoid reformatting unrelated sections.
9. Review the resulting diff carefully.
10. Confirm that unrelated sections were not changed.

Do not rewrite the entire file to fix a local problem.

Do not extract multiple major systems during one refactor.

When gradually modularising the application, extract one bounded area at a time and preserve behaviour with tests.

Good early extraction candidates include:

* Configuration constants
* Storage-key constants
* Supabase client setup
* Shared formatting helpers
* Shared validation helpers

Do not begin by simultaneously extracting authentication, seller cards, marketplace logic and the admin dashboard.

---

## 6. Required checks

Before reporting a code-changing task as complete, run the checks that are relevant and available.

At minimum:

1. Run `git status --short`.
2. Run `npm run build`.
3. Run `npm run check`.
4. Review the final diff.
5. Check for unrelated changes.
6. Report any check that could not be run.

Do not claim a check passed unless it was actually run and completed successfully.

If a command fails:

* Include the command that failed.
* Include the useful part of the error.
* Explain whether the failure was caused by the current change.
* Do not hide or ignore the failure.

The repository currently uses these scripts:

```text
npm run dev
npm run build
npm run start
npm run check
```

Do not claim that linting, unit tests, type checking or Playwright tests passed unless those tools have actually been added and run.

---

## 7. Visual and responsive verification

For any visual, layout, icon, image or responsive change, use browser-based inspection.

Test the affected area at appropriate widths, including:

* Mobile
* Tablet where relevant
* Desktop

For important UI changes, inspect the relevant versions of:

* Home page
* Browse or marketplace page
* Seller card
* Seller details
* Login or account interface
* Seller dashboard
* Admin dashboard
* Navigation
* Modals
* Empty states
* Loading states
* Error states

Check for:

* Cropped text
* Text overflowing icons or containers
* Horizontal scrolling
* Incorrect wrapping
* Duplicate labels
* Incorrect icon alignment
* Cut-off images
* Broken aspect ratios
* Inconsistent padding
* Overlapping controls
* Hidden buttons
* Keyboard-navigation problems
* Missing focus indicators
* Console errors

Do not declare visual work complete based only on a successful build.

When screenshots or marked-up images are supplied, follow the marked areas precisely and do not modify unmarked areas without a clear reason.

---

## 8. Home-Made design rules

Preserve the established Home-Made visual identity.

Do not replace the supplied Home-Made logo, icons or artwork with generic generated alternatives unless explicitly requested.

Use the supplied bitmap or PNG icon assets when those assets are part of the approved design.

Avoid:

* Generic clipart
* Unrequested illustration styles
* Random stock artwork
* Unapproved icon substitutions
* Duplicated text inside icons
* Text embedded incorrectly into icon artwork
* Unnecessary gradients
* Visual changes outside the requested area

Use photography for food, seller and marketplace imagery where photography is expected.

Maintain consistency between:

* Mobile and desktop presentation
* Buyer and seller views
* Account badges
* Marketplace tier badges
* Admin status indicators

Seller account identity may use explicit labels such as:

* `Gold Seller`
* `Platinum Seller`

Compact marketplace cards should normally use shorter badges such as:

* `Gold`
* `Platinum`

Do not change badge wording without checking the context in which it appears.

---

## 9. Accessibility rules

Use semantic HTML wherever practical.

For interactive elements:

* Provide accessible names.
* Preserve keyboard access.
* Use buttons for actions and links for navigation.
* Ensure focus indicators remain visible.
* Avoid clickable non-semantic elements without keyboard support.
* Associate labels with form fields.
* Provide useful validation and error messages.
* Do not rely on colour alone to communicate state.
* Preserve adequate text contrast.
* Ensure touch targets are reasonably sized.
* Add appropriate alternative text to meaningful images.
* Hide purely decorative images from assistive technology where appropriate.

When modifying a modal:

* Move focus into the modal.
* Keep keyboard focus within it where practical.
* Support Escape when appropriate.
* Return focus to the triggering control when closed.
* Ensure the close control has an accessible name.

Do not reduce accessibility to achieve a visual effect.

---

## 10. PWA and service-worker rules

The service worker must not indiscriminately cache all network requests.

Never cache:

* Supabase Auth requests
* Authenticated Supabase REST responses
* Personalised account data
* Admin data
* Seller dashboard data
* `/api/*` responses
* Payment responses
* Mutating requests
* Requests containing sensitive user information

Do not cache authenticated or personalised data in a way that could expose one user’s information after logout or account switching.

Recommended strategies:

* Navigation: network-first with a reliable offline fallback
* Versioned static assets: cache-first where appropriate
* Public images and icons: stale-while-revalidate where appropriate
* Authentication and personalised data: network only
* API routes: network only unless a specific safe exception is documented
* Mutations: network only, with a deliberate offline queue only where already supported

Avoid caching opaque cross-origin responses indiscriminately.

When changing service-worker behaviour:

1. Inspect `public/sw.js`.
2. Locate any inline or fallback service-worker implementation.
3. Confirm whether both implementations must be updated.
4. Document the caching strategy for each request category.
5. Confirm that old caches are removed safely.
6. Test installation and activation.
7. Test online behaviour.
8. Test offline behaviour.
9. Test refresh behaviour.
10. Test logout and account switching.
11. Confirm changed seller or advert data is not replaced with stale cached data.

Do not change service-worker or cache-version markers unless required.

When changing a version marker, report:

* Previous value
* New value
* Every file containing the value
* Why the version change was necessary

---

## 11. Supabase security rules

Prefer privacy-safe public seller data through the approved public directory view, such as `seller_directory`.

Do not expose unrestricted raw seller records to anonymous users.

For Supabase changes:

* Preserve Row Level Security.
* Verify policies for anonymous users.
* Verify policies for authenticated buyers.
* Verify policies for sellers.
* Verify policies for admins.
* Use RLS-safe RPCs or server-side API routes for privileged mutations.
* Do not rely only on hidden UI controls for authorisation.
* Do not place service-role credentials in browser code.
* Do not expose private environment-variable values.
* Do not log access tokens, passwords or sensitive personal information.
* Add indexes where required for new query patterns.
* Include grants where required.
* Include rollback notes for significant migrations where practical.

Before creating a new migration:

1. Inspect existing migrations.
2. Check whether the object or policy already exists.
3. Use safe, repeatable SQL where practical.
4. Confirm the migration filename and timestamp.
5. Confirm whether it has been applied locally or remotely.
6. Do not claim it has been applied remotely without evidence.

Do not alter production data destructively without explicit approval.

---

## 12. Authentication and application state

Do not treat `localStorage` as authoritative storage for:

* Seller roles
* Admin roles
* Subscription tiers
* Orders
* Payment state
* Seller approval
* Account ownership
* Privileged permissions
* Security-sensitive user data

`localStorage` may be used for:

* Non-sensitive UI preferences
* Dismissed notices
* Temporary drafts
* Carefully designed offline queues
* Device-specific presentation preferences

When user-specific local data is stored:

* Namespace it appropriately.
* Clear it on logout where required.
* Prevent it from leaking between accounts.
* Define how it synchronises with server data.
* Handle failed synchronisation visibly.
* Do not silently overwrite newer server data.

Test:

* Login
* Logout
* Account switching
* Buyer-to-seller transitions
* Seller-to-admin transitions where applicable
* Refresh after authentication
* Expired sessions
* Offline-to-online synchronisation

---

## 13. Seller tiers and pricing

The canonical seller tiers are:

* Standard: Free
* Gold: R149 per month
* Platinum: R299 per month

Do not introduce alternative prices without explicit instruction.

Do not hardcode inconsistent prices in different parts of the application.

Where possible, pricing and tier benefits should come from one canonical source.

If trials are mentioned in the interface:

* Verify that the backend supports the trial.
* Verify the trial duration.
* Verify eligibility rules.
* Verify start and expiry behaviour.
* Verify downgrade behaviour.
* Remove or mark trial messaging as pending when backend enforcement is not available.

Do not promise a trial in public-facing copy unless it is technically supported.

---

## 14. PayFast and payments

PayFast functionality is currently paused.

Do not unpause, expose or deploy active PayFast checkout without explicit instruction.

Do not alter production payment credentials.

Do not display secret merchant keys, passphrases or environment-variable values.

Before changing payment functionality:

1. Inspect all frontend payment flags.
2. Inspect related API routes.
3. Inspect environment-variable usage.
4. Inspect webhook or notification handling.
5. Confirm sandbox versus production mode.
6. Confirm signature verification.
7. Confirm duplicate-payment protection.
8. Confirm failed and cancelled payment behaviour.
9. Confirm subscription activation and expiry behaviour.
10. Present an implementation and testing plan before editing.

Payment work should use a separate thread or worktree where practical.

Never test production payments without explicit approval.

---

## 15. Data and catalogue correctness

Do not mask an incomplete catalogue result by adding a superficial fallback without identifying the root cause.

When listings, adverts or sellers appear missing, inspect:

* Service-worker caching
* Supabase query filters
* RLS policies
* Public directory views
* Client-side filtering
* Client-side merging
* Pagination
* Local fallback data
* Seller availability
* Advert status
* Tier restrictions
* Expiry dates
* Account ownership
* Stale localStorage values

Do not treat a one-row result as only a visual problem.

Clearly distinguish between:

* Data absent from the database
* Data hidden by RLS
* Data excluded by a query
* Data removed by client filtering
* Data replaced by stale cache
* Data overwritten by local fallback state
* Data hidden by UI state

---

## 16. Images and asset handling

Preserve original approved image assets.

Do not crop text, logos or important artwork.

When adding or changing images:

* Use appropriate dimensions.
* Preserve aspect ratio.
* Avoid stretching.
* Avoid unnecessary file size.
* Reserve layout dimensions to reduce content movement.
* Prefer suitable modern formats when supported by the existing workflow.
* Keep transparent backgrounds where required.
* Do not convert a true transparent PNG to a white-background image.
* Check mobile and desktop cropping.
* Provide an appropriate fallback.
* Avoid replacing photography with clipart.

Do not regenerate supplied branded artwork unless explicitly requested.

---

## 17. Dependencies

Do not add a production dependency without explaining:

* Why it is needed
* Why the current stack cannot perform the task
* Its maintenance status
* Its approximate impact
* Any security or deployment implications

Prefer existing browser APIs and current project utilities when suitable.

Do not replace working infrastructure merely to modernise it.

Do not update unrelated dependencies during a targeted task.

When a lockfile exists, preserve and update it consistently.

When adding a lockfile, explain which package manager generated it.

---

## 18. Testing improvements

The project currently has limited automated verification.

When adding tests, start with a small, stable smoke-test suite.

High-value initial browser tests include:

* Mobile home page loads
* Browse page loads with filters cleared
* Multiple seller adverts appear correctly
* Seller detail view opens
* Login interface opens and closes
* Buyer login and logout
* Seller dashboard access
* Admin users or account-management view
* PWA navigation and back behaviour
* Offline fallback
* Service-worker update behaviour

Keep the first test suite small and reliable.

Do not create a large fragile test suite in one task.

Do not use visual snapshots for highly dynamic content without controlling the data and viewport.

---

## 19. Git safety

Never:

* Reset user changes without approval
* Discard user changes without approval
* Force checkout over modified files
* Force-push
* Rewrite shared history
* Commit secrets
* Commit temporary Codex attachments
* Commit `.codex-remote-attachments`
* Mix unrelated changes in one commit

Before proposing a commit:

1. Run `git status --short`.
2. Review the diff.
3. Separate source and generated changes.
4. Identify migrations.
5. Identify temporary files.
6. Confirm that production state can be reproduced.
7. Propose a clear commit structure.

Do not commit unless explicitly instructed.

Use focused commit messages that explain the actual change.

---

## 20. Deployment rules

Do not deploy unless the user explicitly requests deployment or the task explicitly includes deployment.

Before deployment:

1. Run `npm run build`.
2. Run `npm run check`.
3. Review `git status --short`.
4. Review relevant generated output.
5. Check service-worker and cache versions where applicable.
6. Confirm environment configuration.
7. Confirm no secret values are present in client files.
8. Confirm the intended production version.

After deployment, report:

* Build result
* Check result
* Deployment URL
* Production alias
* Application version marker
* Service-worker or cache version marker where relevant
* Whether live production HTML contains the expected version
* Any warnings or unverified behaviour

Do not state that production is updated until the live deployment has been verified.

---

## 21. Documentation rules

Keep documentation aligned with the actual application.

Do not describe the current application as Next.js, Tailwind or App Router unless the repository has actually migrated to that architecture.

When documentation describes a future architecture, label it clearly as:

* Proposed
* Planned
* Aspirational
* Migration target

Do not present a proposed architecture as the current implementation.

Update affected documentation when behaviour or architecture materially changes.

---

## 22. Thread and worktree guidance

Use a new thread when moving to a substantially different system.

Use a separate worktree for:

* Major refactors
* Payment integration
* Risky database changes
* Large service-worker rewrites
* Experimental architecture migrations

Do not allow parallel agents to edit the same large HTML source file simultaneously.

Parallel agents may be used safely for bounded, read-only work such as:

* Accessibility audit
* Service-worker audit
* Security review
* Test-gap analysis
* Documentation review
* Performance audit

The primary implementation agent must reconcile findings before files are changed.

---

## 23. Completion report

After completing a code-changing task, provide:

### Summary

A concise explanation of what changed.

### Files changed

List each changed file and why it changed.

### Verification

List every command and check performed, with the result.

### Visual verification

For visual work, state which pages and viewport sizes were inspected.

### Risks and limitations

State anything that could not be verified.

### Manual testing

Provide specific steps the user can follow.

### Deployment

State clearly whether deployment was performed.

### Git state

State whether changes remain uncommitted.

Do not describe a task as complete when important requested behaviour remains unverified.
