# Contributing to CodeBloom

Thanks for helping improve CodeBloom. Before opening a pull request, check existing issues and avoid including unrelated changes.

## Development setup

Follow the cross-platform instructions in the [README](README.md#run-locally-on-windows-macos-or-linux). The short version is to install Git and Node.js 20.9+, clone the repository, then run:

```sh
npm install
npm run dev
```

Public preview pages work without Supabase credentials. Do not connect experiments to production services or run database migrations against a production database.

## Before submitting

Run the project checks from the repository root:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Keep changes focused, add or update tests when behavior changes, and update documentation when setup or user-visible behavior changes. CI verifies the checks on Linux, macOS, and Windows.

## Secrets and generated files

Never commit `.env.local`, database connection strings, service-role keys, access tokens, private keys, or credentials. Use `.env.example` for blank/documented variable names only. Keep generated dependencies/build output and local tooling state untracked. Do not include real user data in fixtures or tests.

## Database changes

Add reviewed, timestamped SQL migrations under `supabase/migrations/`. Describe schema, RLS, and rollout implications in the pull request. Test migrations only against a disposable or explicitly non-production Supabase project; never run destructive SQL against production.
