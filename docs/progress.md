# CodeBloom Progress

## Current checkpoint

**Phase 4 implementation in progress: draft-first project publishing, media, live details, and updates.** The publishing flow now creates a draft, validates/uploads up to five private screenshot objects, registers accessible alt text, and publishes only after upload completion; public/owner project detail responses include signed media URLs and progress updates. Migration `20261101120000_project_media_updates.sql` is prepared but **not applied**. The separate social migration `20261028210000_live_feed_social.sql` also remains unapplied, so the live feed/social actions are not remotely operational. The base and Phase 3 migrations remain verified on the non-production project; live Phase 4 behavior, project edit/delete UI, and production behavior are not yet verified.

## Delivered

- Responsive shared shell: desktop navigation, central reading column, contextual discovery rail, mobile menu and bottom navigation, active-route states, keyboard skip link and focus-visible treatment.
- Dark/light tokens and theme selection: follows OS preference until an explicit choice is saved in browser storage.
- Guest Explore retains synthetic project fixtures, search, preview sorting, profile/community previews, browser-local bookmarks, and demo-only votes. The signed-in dashboard now uses the authenticated live feed and live action endpoints.
- Preview screens for publishing, notifications, messages, communities, and settings. Pending requests do not open ordinary conversations; private messaging remains unavailable.
- Accessible loading, error, success, empty and not-found treatments; reduced-motion styles; external link parsing restricted to HTTPS and GitHub repository URLs.
- Route manifest and focused tests for routes, preview sorting, project input validation, and external URLs.
- Cross-platform `scripts/install.mjs` bootstrap uses pinned pnpm and frozen-lockfile installation, preserves `.env.local`, and initializes it from the safe template only when absent. `.github/workflows/ci.yml` automates validation on pushes and pull requests.
- Public root landing with project previews, topic links, How-it-works section, CTA, theme support and responsive motion-reduced layout; signed-in visits route to the dashboard while guest Explore/project/profile pages remain open. Signup/login use a shared responsive story/form layout, matching-password validation, safe return destinations, and a first-run dashboard guide after signup or email confirmation.
- Supabase email sign-in/sign-up, confirmation callback, recovery/reset, safe return paths, client session subscription and sign-out; server `auth.getUser()` guards dashboard, publish, personal pages, and an authenticated project-creation API.
- Guest social controls keep the accessible sign-in/create-account prompt. Signed-in project votes, bookmarks, creator follows, and comments now have validated API contracts and RLS-backed storage in the pending social migration; the live mutations have not yet been exercised against Supabase. Community membership and chat remain unimplemented.
- `/settings/profile` is linked from the signed-in account menu and shell; `GET/PATCH /api/profile` verifies the server user, restricts writable profile fields, and the public `/u/:username` route prefers allowlisted live Supabase fields over clearly labelled preview fixtures.
- A follow-up migration hardens profile creation, backfills accounts predating the trigger, limits profile column updates, enforces HTTPS GitHub/demo URLs for new/updated project rows, and adds `create_project_with_tags` as an authenticated `SECURITY INVOKER` transaction. On 2026-10-28 the user ran it against the configured non-production project through `scripts/apply_phase3_followup.py`; their terminal reported successful commit and postconditions. Direct SQL did not add a Supabase CLI migration-history entry. The runner uses dry-run default, test-project-ref checks, TLS, one transaction, and postconditions.

## Automated validation (current tree, 2026-10-30)

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 12 files, 49 tests passed, including live feed mapping, feed/action API authorization, social mutation payloads, auth journey, and safe redirect coverage.
- `pnpm build` — passed with the Webpack production builder; Next detected `/api/feed`, `/api/social`, and `/api/projects/[slug]`.

Earlier frontend smoke checks against a built preview passed for landing/signup, confirmation and password mismatch handling, signed-out dashboard redirect, and 390px layouts. The browser smoke pass for this live-feed change could not run: local policy denied loopback bind/connect to port 3000. No signup or live social action was submitted, and no new database row was created. The prior real test-account email-confirmation/callback/session check remains valid. `node scripts/install.mjs` previously completed from cache; clean clone, GitHub Actions, and Vercel deployment remain unverified. The temporary preview is stopped.

`scripts/apply_phase3_followup.py`: Python syntax/help, migration-boundary, direct/pooler project-ref, and refusal guards passed. `psycopg` 3.3.6 is installed in the ignored `.work/tools/phase3-db-venv`. On 2026-10-28 the user ran the hidden-prompt preflight and then the apply command. Their terminal reported “Migration applied and committed successfully; all post-apply checks passed.” The connection URI/password was not saved in the repository. This was direct SQL execution and did not add a Supabase CLI migration-history entry.

## Data and security boundary

- Preview projects and community/activity/message content remain synthetic. The `/dashboard` feed now returns database-backed project rows only (never silently falls back to sample feed content); guest `/explore` remains the explicitly labelled fixture preview.
- Migrations `20261027153000_profiles_projects.sql` and `20261027204500_auth_profiles_atomic_projects.sql` define the verified base project/profile tables, bookmarks, profile hardening/backfill, and atomic project-write RPC. Migrations `20261028210000_live_feed_social.sql` and `20261101120000_project_media_updates.sql` are prepared but **not applied**. No production schema or records were changed.
- `.env.local` remains Git-ignored and secret values were not printed. Test-project base schema/RLS, Phase 3 follow-up postconditions, signup confirmation, email delivery, callback exchange, and test-account login were previously verified. New live-feed/action behavior has unit/API-mock coverage only; remote project reads/actions and authenticated profile/project writes remain unverified.
- GitHub API/OAuth integration, accepted-request messaging, production ranking, moderation, comprehensive security tests and deployment remain outstanding.

## Manual setup before using service-backed actions

The base and Phase 3 follow-up migrations have been applied to the configured non-production project; do not rerun either migration. Both the social migration and new Phase 4 project media/updates migration are pending. Direct SQL runs did not register earlier migrations in Supabase CLI history; reconcile migration history before any `supabase db push`. Apply only reviewed additive migrations to the non-production project, then test draft isolation, upload MIME/size/path restrictions, publish visibility, signed URL access/expiry, update ownership, and anonymous/unrelated-user RLS denial. No production schema or records were changed.

## Next phase

Next: reconcile the Supabase migration history; apply the pending social and Phase 4 migrations to the non-production project only; run end-to-end publish-with/without-images, project detail, update, and RLS negative tests with disposable data and cleanup. Then finish project edit/delete UX, verify profile/project writes and auth recovery/logout, and continue to Phase 5 only after the Phase 4 checks pass. No production deployment/data changes were made.


## Local startup hydration fix (2026-10-31)

The landing-page hydration warning was traced to CSS particle offsets computed with `Math.sin`/`Math.cos` during module rendering; those floating-point style attributes could differ between server and browser runtimes. The intro now generates the scatter offsets with deterministic integer arithmetic. After a fresh page reload, the browser console returned zero errors. `pnpm typecheck`, `pnpm lint`, all 71 Vitest tests, and `git diff --check` passed. The Webpack dev server remains available at `http://127.0.0.1:3000`; production build was not rerun while it was active.


## Phase 4 implementation and local validation (2026-11-01)

Implemented the draft-first publish form, owner-scoped private screenshot upload/registration, signature and size validation, publish transition, project-detail signed media and update reads, owner-authored project updates, and screenshot cover images in the live feed. Added migration `20261101120000_project_media_updates.sql` with `project_media`, `project_updates`, the private bucket, RLS/Storage policies, and a draft-with-tags RPC. Updated README, architecture, schema, security, and roadmap notes. The migration remains unapplied and its history must be reconciled; no Supabase writes or external service configuration were changed.

Validation actually run: `pnpm test` passed (16 files, 77 tests); `pnpm typecheck` passed; `pnpm lint` passed; `pnpm build` passed using Next.js 16.4.3 with Webpack and included the new media, publish, updates, and project routes. Migration static checks and `git diff --check` passed. No end-to-end upload, signed URL expiry, RLS negative test, production deployment, or remote migration application was performed. Project edit/delete UX and Phase 5 work remain outstanding.

The local development preview was started with Webpack at `http://127.0.0.1:3000`; the loopback health check returned HTTP 200. It remains running for local inspection.
