# CodeBloom Setup and Environment Guide

## Current repository status

The repository contains a Next.js App Router application, strict TypeScript, Tailwind CSS 4 styling, a responsive public landing and project preview, Supabase SSR/browser auth helpers, Auth route handling, server-side page/API guards, profile read/update APIs, an authenticated profile editor, public profile lookup, and project creation via an atomic RPC. Public browsing works without Supabase; live Auth and database behavior still require a real account and verified project setup.

## Clone, install, and run

Install Git and Node.js 20.9 or later on Windows, macOS, or Linux. The bootstrap uses Corepack when available; otherwise it requires the pinned pnpm version `12.11.2`. If needed, install it with `npm install --global pnpm@12.11.2`.

The commands below are the same in macOS/Linux shells and Windows PowerShell:

```sh
git clone https://github.com/Abhayrajput29/CodeBloom.git
cd CodeBloom
node scripts/install.mjs --start
```

The Node bootstrap runs `pnpm install --frozen-lockfile`, creates `.env.local` from `.env.example` only if it does not already exist, and then starts the local development server. Existing local credentials are preserved. Open [http://localhost:3000](http://localhost:3000) and press Ctrl+C in the terminal to stop the server. For a later quick start after dependencies are installed, run `pnpm dev`. To install dependencies and prepare `.env.local` without starting the server, run `node scripts/install.mjs`.

The first dependency installation needs access to the package registry. No Supabase or GitHub credentials are needed to browse local fixtures.

The GitHub Actions workflow in `.github/workflows/ci.yml` automatically installs locked dependencies and runs type-check, lint, unit tests and the production build on pushes and pull requests. It requires no secrets and does not deploy. GitHub runs it after the repository is pushed to GitHub; local setup does not execute the workflow.

## Email authentication and route protection

Email/password sign-in and registration, email-confirmation callback, password recovery/reset, session refresh, and sign-out use Supabase Auth. In Supabase Dashboard, enable the Email provider, set a local Site URL, and allow both `http://localhost:3000/auth/callback` and `http://127.0.0.1:3000/auth/callback`; use the callback matching the browser origin. For deployment, separately configure the production site URL and exact HTTPS callback allowlist. Never use a service-role key for these flows. The app never treats UI hiding as the security boundary: protected pages verify `auth.getUser()` on the server; `/api/profile`, `/api/projects`, `/api/feed`, and `/api/social` independently authenticate writes/feeds and rely on RLS. Authenticated users can update only their own public username/display name/bio. Public `/`, `/explore`, and profile pages are viewable without signing in. Live votes, bookmarks, creator follows, comments, and the signed-in dashboard feed are implemented in code; the new social migration must be applied to the non-production project before those endpoints can work. Community membership and chat remain unimplemented.

Registration sends a confirmation link to `/auth/callback`; recovery uses the same code-exchange route and then `/reset-password`. Supabase Auth must have email confirmation behavior configured as intended for the project. Allowed redirect URLs, provider status, deliverability and actual email links must be tested manually with a real test account before relying on them.

## Environment variables

Copy `.env.example` to `.env.local` only when you need service-backed features. Keep `.env.local` untracked and do not paste its values into issues or chat. Use separate configuration for local, test, preview, and production environments.

| Variable | Required when | Visibility / notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Using the partial Supabase client/project API | Public URL; browser-visible. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Using Supabase | Preferred browser-safe key for new projects; safe only with correct RLS. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy Supabase projects only | Backward-compatible public client key; prefer the publishable key above for new projects. |
| `SUPABASE_SERVICE_ROLE_KEY` | Only for a narrowly justified trusted server task | Privileged; server-only; not needed for normal user-scoped reads/writes. |
| `GITHUB_TOKEN` | Optional future GitHub API adapter | Server-only; public repository reads work without it under conservative rate limits. |
| `PLAYWRIGHT_BASE_URL` | Optional browser tests against a running app | Non-secret URL. |
| `NEXT_PUBLIC_SITE_URL` | Production deployment only | Exact HTTPS origin with scheme + host only; enables absolute canonical/share URLs and a sitemap. Leave blank until the real public domain is known. |

The normal UI, local fixtures, theme choice, and unit tests do not require Supabase or GitHub credentials. GitHub OAuth is not needed to initialize or browse the preview. If selected later, configure OAuth credentials in Supabase Auth provider settings and keep the provider secret there—not in browser code.

## Partial Supabase setup

The configured non-production test project has the base migrations applied: `20261027153000_profiles_projects.sql` and `20261027204500_auth_profiles_atomic_projects.sql`. The base tables/RLS were verified directly; the user-reported runner output confirms the follow-up migration committed and passed its post-apply checks. A third additive migration, `20261028210000_live_feed_social.sql`, is **not yet applied**. It adds votes, follows, comments, privacy-preserving aggregate views, and the required RLS/grants; until applied, the dashboard feed/social API returns a clear unavailable/migration message. For a new project, apply all migrations in timestamp order using a migration workflow that tracks history. The follow-up adds HTTPS constraints as `NOT VALID` to avoid blocking on legacy rows. Inspect rows that fail the new rules, remediate them deliberately, then run `ALTER TABLE public.projects VALIDATE CONSTRAINT projects_repository_url_https_check;` and `ALTER TABLE public.projects VALIDATE CONSTRAINT projects_demo_url_https_check;`. Community membership, notifications, accepted-request messaging, and media storage remain unimplemented. Verify each policy and database behavior independently; never infer production security from the presence of a publishable key.

### Direct runner used for the test project (already applied)

The optional runner `scripts/apply_phase3_followup.py` reads only the exact follow-up migration file. It connects over TLS, checks that the host or pooler username identifies the authorized test project `zijxeexudzeysaqicyqb`, verifies the base tables and refuses if the follow-up RPC/constraints already exist. If `SUPABASE_DB_URL` is not set, it asks for the URI using a hidden terminal prompt. It defaults to preflight-only. `--apply` is required to execute; the migration runs in one PostgreSQL transaction and is rolled back on an error or failed postcondition. Do not use a Supabase publishable/anon key here: this requires the database's PostgreSQL URI connection string and password. Treat the URI as a secret; rotate the database password if the URI is disclosed.

1. In the Supabase Dashboard for the test project, open **Project Settings → Database** and copy its PostgreSQL connection URI; replace the displayed password placeholder with the newly rotated database password locally. If the password contains URI-reserved characters, percent-encode them in the URI (for example, `@` as `%40`). Use the session pooler URI if the direct database hostname is not reachable from your network. Never paste the URI into chat, source code, `.env.local`, or a command argument.
2. In the CodeBloom terminal, create a local ignored virtual environment and install the PostgreSQL driver:

   ```sh
   python3 -m venv .work/tools/phase3-db-venv
   .work/tools/phase3-db-venv/bin/python -m pip install 'psycopg[binary]>=3.2,<4'
   ```

3. Run a preflight first. The script itself asks for the connection URI invisibly; enter it at the prompt and press Return:

   ```sh
   .work/tools/phase3-db-venv/bin/python scripts/apply_phase3_followup.py
   ```

4. The follow-up migration has already been applied to this test project. Do not run the apply command again. It is shown here as an audit trail of the command used:

   ```sh
   .work/tools/phase3-db-venv/bin/python scripts/apply_phase3_followup.py --apply --confirm-test-project zijxeexudzeysaqicyqb
   ```

   The script prompts for the URI again because it is deliberately not saved between runs. If `SUPABASE_DB_URL` is set in your terminal, unset it after use with `unset SUPABASE_DB_URL`.

The runner never prints or saves the connection URI. Direct SQL execution does not register the file in Supabase CLI's migration history; do not later apply either migration with `supabase db push` without first reconciling migration history. Signup confirmation email delivery, callback, and automatic session login have been verified with a test account; profile editing and authenticated project creation still need end-to-end testing.

### Live dashboard social migration (pending)

`scripts/apply_live_social.py` is a separate guarded runner for `20261028210000_live_feed_social.sql`. It checks the exact non-production project ref, verifies the base schema and refuses if any new social table/view already exists, then applies the additive DDL in one transaction and checks tables, RLS, policies, and grants. It defaults to preflight-only; it is not run automatically by the app. The same ignored Python environment and hidden DB-URI prompt shown above may be used. Applying it changes the connected test database, so first confirm the target is the non-production CodeBloom project. Direct execution does not register the migration in Supabase CLI history; reconcile migration history before any future `supabase db push`. Live end-to-end actions also need an existing published project and a signed-in test account; test comments should be removed after verification or use a disposable project/account.

The project form uses `POST /api/projects` when the Supabase URL and publishable/legacy anon key are both configured and requires an authenticated account; an anonymous POST was locally verified to return 401. Project and tag rows are written in one user-scoped Postgres transaction; no authenticated live submission was validated. `/settings/profile` reads/writes the signed-in user's own row through `GET/PATCH /api/profile`; public `/u/:username` reads the allowlisted public fields and otherwise falls back only to explicitly labelled preview fixtures. The dashboard requests live projects and social aggregates via `GET /api/feed`; `POST /api/social` handles account-owned votes, bookmarks, follows, and comments. These endpoints have route tests but have not yet been exercised against the remote database. The base migration and follow-up are verified on the test project; the new social migration awaits application. Signup confirmation and automatic login were verified with a test account; profile updates, authenticated project creation, recovery, and logout/relogin still need validation.

## Validation

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The production build script uses `next build --webpack`. See `docs/progress.md` for the current test count/check results. Run a local dev server with `pnpm dev`; `GET /manus-routes.json` should return the current page route inventory. Do not include API endpoints or assets in that UI route inventory.

`node scripts/install.mjs` completed in the current checkout and preserved the existing `.env.local`; pnpm reused 438 cached packages and downloaded none. This verifies the bootstrap path against the current frozen lockfile but is not a clean-clone or new-package download test. `pnpm-workspace.yaml` continues to deny the `unrs-resolver` build script. The GitHub Actions workflow has been added but cannot run until the repository exists on GitHub.

## Configuration required before production use

Apply the reviewed migration in a non-production Supabase project, verify RLS with anonymous/user/owner negative tests, configure Supabase Auth URL allowlists and password/email policies, and test the implemented sign-up/sign-in/recovery/callback/session/sign-out lifecycle with a test account. Configure Storage buckets/policies only when media is implemented. Before deployment, set encrypted provider environment variables, verify callback/redirect hosts, run security and accessibility tests, and test the production build on the intended Vercel/Supabase projects. This repository has not been deployed or verified against live Supabase services.
