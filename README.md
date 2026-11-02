# CodeBloom

**Discover. Discuss. Build upon.**

CodeBloom is a project-centered developer community for discovering software, sharing work in progress, discussing technical decisions, and learning from other implementations.

## Run locally on Windows, macOS, or Linux

### Requirements

Install [Git](https://git-scm.com/downloads) and [Node.js 20.9 or later](https://nodejs.org/en/download).

### Install and start

Open Terminal on macOS/Linux or PowerShell on Windows, then run these same commands:

```sh
git clone https://github.com/Abhayrajput29/CodeBloom.git
cd CodeBloom
npm install
npm run dev
```

`npm install` installs the locked dependencies and creates `.env.local` from `.env.example` only when `.env.local` does not already exist. It never overwrites an existing local environment file. When the server reports it is ready, open [http://localhost:3000](http://localhost:3000). Press **Ctrl+C** in the terminal to stop it.

The first installation requires access to the package registry.

### Optional Supabase configuration

Public browsing and the local preview work without Supabase credentials. To use the service-backed authentication and database features, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local` (the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported). Configure Supabase Email Auth and allow the local callback URLs `http://localhost:3000/auth/callback` and `http://127.0.0.1:3000/auth/callback`.

Never expose a Supabase service-role key in browser code or in a variable prefixed with `NEXT_PUBLIC_`. Review [Setup and environment configuration](docs/setup.md) and [Security and privacy](docs/security.md) before connecting a Supabase project. Database-backed features require the appropriate migrations; the social migration and several live-service end-to-end checks are still pending. Do not treat the local preview fixtures as live community data.

### Public deployment URL and SEO

Set `NEXT_PUBLIC_SITE_URL` in the production environment to the exact HTTPS origin (scheme and host only, for example `https://your-real-domain.example`). This enables absolute canonical and social-preview URLs plus the sitemap. Leave it unset for local development; the app deliberately omits absolute SEO URLs rather than guessing a public domain. Only the substantive homepage and project-exploration page are currently included in the sitemap; application, auth, and client-resolved detail routes are not indexed yet.

## Development commands

Run these from the project directory on any supported platform:

```sh
npm run dev        # start the local development server
npm run typecheck  # TypeScript check
npm run lint       # ESLint
npm test           # unit tests
npm run build      # production build
```

GitHub Actions runs the type-check, lint, unit tests, and production build on Linux, macOS, and Windows for pushes, pull requests, and manual dispatch. It does not deploy the app and does not require secrets. See [Contributing](CONTRIBUTING.md) before opening a pull request.

## Project status

The application includes a public landing and project preview, Supabase email-auth flows, profile APIs and editing, draft-first project publishing, private-bucket screenshot uploads, live project detail data, and owner-authored progress updates. These Phase 4 paths depend on the reviewed migration `20261101120000_project_media_updates.sql`, which is prepared but not yet applied; live Storage/RLS behavior has not yet been verified. Public preview content may be fixture data. Project editing/deletion, the pending social migration, community membership, private chat, notification delivery, GitHub metadata, and deployment remain incomplete or unverified.

## Documentation

- [Setup and environment configuration](docs/setup.md)
- [Contributing](CONTRIBUTING.md)
- [Architecture](docs/architecture.md)
- [Database schema and RLS design](docs/database-schema.md)
- [Security and privacy](docs/security.md)
- [GitHub integration](docs/github-integration.md)
- [Design direction](docs/design-direction.md)
- [Development roadmap](docs/development-roadmap.md)
- [Progress and next steps](docs/progress.md)

## Stack

Next.js App Router, React, strict TypeScript, Tailwind CSS 4, Lucide, Supabase SSR/browser clients, and Zod.
