# CodeBloom Development Roadmap

The sequence below preserves the requested ten phases. Each phase should end with a reviewable checkpoint, automated verification appropriate to its scope, and updated documentation. Private messaging remains deferred until its transactional authorization and RLS tests are ready.

| Phase | Scope and exit criteria |
|---|---|
| **1. Foundation, architecture, database design, repository setup** | Complete architecture, design principles, database/security contracts, roadmap, progress notes, environment template, and repository conventions. Initialize Next.js/TypeScript/tooling and Supabase project configuration only after reviewing schema and access-control decisions. Keep migrations minimal and tested; do not turn unreviewed design notes into permissive production policies. |
| **2. Design system, responsive application shell, UI components** | Implement dark-first theme plus functional light theme, accessible theme preference, responsive navigation/shell, typography/tokens, project and discussion primitives, and loading/error/success/empty states. Verify keyboard accessibility, contrast, responsive behavior, and reduced motion. |
| **3. Authentication, sessions, developer profiles** | Configure Supabase Auth and SSR cookie/session flow; implement profile creation/editing, OAuth callback safety, profile ownership RLS, and auth tests. GitHub login remains optional unless selected for sign-in. |
| **4. Project publishing, media, project detail pages, updates** | Implement project create/edit/delete, project visibility, Storage ownership restrictions, screenshot metadata, detail pages, and project updates. Validate URLs and uploads. Test owner vs unrelated-user access and cleanup behavior. |
| **5. Community feeds, voting, comments, ranking, moderation foundations** | Add posts, nested comments, atomic one-vote rules, New/Hot/Top/Rising/Following feeds, basic reports/moderation records, and ranking tests. Use transparent ranking defaults and resist duplicate/spam votes. |
| **6. GitHub integration and repository metadata** | Add server-side GitHub REST adapter, safe repository normalization, bounded caching, README/topic/language/release summary handling, rate-limit backoff, and stale/error UI. Ensure basic startup/public browsing works without OAuth or token. |
| **7. Secure private messaging with acceptance-based requests** | Add pending request lifecycle, duplicate prevention, atomic accept/decline, exactly two conversation participants, closed-conversation behavior, blocks, strict RLS, and authorized Realtime. Require concurrency and negative-authorization tests before enabling. |
| **8. Search, notifications, follows, project relationships, reputation** | Add indexed search, durable notification records and authorized realtime hints, follow graph, typed project relationships, and carefully documented reputation signals. Keep notifications private where they reference private activity. |
| **9. Security audit, comprehensive testing, performance improvements** | Review RLS and Storage policies, threat-model OAuth and external fetches, test abuse/concurrency/Realtime, run Playwright and accessibility checks, profile feeds, add measured indexes/caches, and verify secret handling. |
| **10. Deployment, configuration verification, documentation, final polish** | Configure production and preview environments, apply reviewed migrations, validate redirect domains, secrets, backups/operational limits, smoke tests, deployment rollback procedure, and current documentation. Confirm Vercel/Supabase plan eligibility and usage terms. |

## Sequencing rationale

The requested phase ordering is retained. Phase 4 precedes Phase 5 because feed entities, project visibility, and media ownership depend on stable project/profile records. Phase 6 follows the first community feed so repository metadata can be integrated into an already defined project card and feed contract; repository links and mock adapters can be prototyped earlier without credentials. Phase 7 follows the platform's initial identity and content foundation because accepted conversations depend on stable profiles, block semantics, notifications, RLS helpers, and realtime authorization. Phase 9 consolidates verification after major domains exist; each earlier phase still requires tests and security review rather than deferring basic correctness until Phase 9.

## Scope controls

Do not build every future feature during Phase 1. Avoid microservices, Redis, paid services, AI recommendations, and full Git hosting unless requirements and measured needs justify them. Use service abstractions only where there is a concrete domain boundary or reuse. Maintain the documented rule that a message request is not a conversation: ordinary messaging begins only after recipient acceptance.


## Current checkpoint — Phase 4 in progress (2026-11-01)

Code now includes draft-first project publishing, private screenshot uploads, server-side media validation, live project detail retrieval, and owner-authored project updates. The Phase 4 SQL migration is pending and has not changed the non-production database. Remaining Phase 4 exit work: reconcile migration history; apply the reviewed schema/bucket policies to the test project; exercise create/publish/detail/update and failure cleanup; verify anon/unrelated-user denial and signed URL expiry; then implement project edit/delete UX. Phase 5 remains deferred until those checks are complete.
