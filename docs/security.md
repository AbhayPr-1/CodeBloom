# CodeBloom Security, Privacy, Voting, Ranking, and Messaging

**Status:** Project votes, bookmarks, creator follows, comments, and the signed-in live dashboard feed now have API/UI implementations and unit tests. Migration `20261028210000_live_feed_social.sql` is pending on the configured non-production Supabase project, so these actions are not remotely operational/verified yet. Voting on posts/comments, broader production ranking controls, moderation, and messaging remain design/future work. Email auth, profile API/editor, public profile lookup, and atomic project creation are implemented; prior test-project auth/base-schema checks are documented in `docs/progress.md`.

## Current project-only social implementation boundary

The live social migration creates one project vote per user/project, creator follow edges, and comments capped at 2,000 characters. RLS binds every write to the authenticated user; follow reads are private to the follower; comments are readable only for published public projects (or by their author); public vote/comment totals are exposed through aggregate-only views filtered to published public projects. Individual voter identities are not publicly selectable. The API independently verifies the session, rejects cross-origin POSTs, derives author/follower/voter IDs from the server session, validates UUIDs/handles and comment length, and responds with private/no-store feed data. These constraints and handlers have automated tests, but they have not been exercised against a real Supabase session. No rate limiting, moderation/report workflow, comment editing UI, or live feed cursor pagination has shipped; do not use this as a production abuse/moderation solution yet.

## D. Voting and ranking rules

### Vote model

Support votes on projects, posts, and comments. A vote has a value of `+1` (upvote) or `-1` (downvote). The recommended schema has one `votes` table with nullable `project_id`, `post_id`, and `comment_id` foreign keys and a CHECK constraint requiring exactly one target. Create one partial unique index per target type:

```sql
CREATE UNIQUE INDEX votes_one_per_user_project
  ON votes (user_id, project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX votes_one_per_user_post
  ON votes (user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX votes_one_per_user_comment
  ON votes (user_id, comment_id) WHERE comment_id IS NOT NULL;
```

This guarantees at most one active vote by a user per target even under simultaneous requests. RLS `WITH CHECK`/`USING` must bind `user_id = auth.uid()`; the target must be visible and eligible. Users may not vote on their own content if that policy is adopted; enforce that rule in the server/database, not merely in UI.

### Set/change/remove semantics

Expose an idempotent “set my vote” command with desired state `-1`, `0` (no vote), or `+1`:

- No existing row + `+1`/`-1`: insert.
- Existing row + opposite value: update the existing row; keep original `created_at`, set `updated_at`.
- Existing row + same value: no-op.
- Any existing row + `0`: delete only the caller's row.

Validate the target type and ID, authentication, visibility, account status/rate limits, and self-vote policy before applying. The user-scoped database operation plus unique indexes handle duplicate/racing inserts. Prefer a single Postgres RPC or transaction-backed server operation that performs target authorization and insert/update/delete atomically. If using `INSERT ... ON CONFLICT`, conflict inference must match each target partial unique index; a single generic conflict target cannot cover all three indexes, so use target-specific branches in one trusted function or three typed mutations. Return the authoritative resulting vote state and counts. Never accept user ID from a client payload as authority; derive it from `auth.uid()`/validated server session.

### Counts and anti-abuse constraints

Initial vote score is `upvotes - downvotes`, derived from vote rows. Do not trust client counts. Avoid stored counters until measured query cost justifies them; if added later, update them in the same transaction and retain vote rows as authority. Apply rate limits to vote mutations and account creation; use server-side quotas or database-backed throttling rather than relying only on IP. Record abuse signals for review without exposing them publicly. Do not treat an IP address as a user identity, and avoid invasive fingerprinting.

Potential manipulation safeguards for initial launch:

- one account, one active vote per content item enforced in PostgreSQL;
- verified/age thresholds may affect abuse review only, never silently alter counts without a documented policy;
- per-user mutation rate limit and duplicate/rapid reversal monitoring;
- exclude removed/hidden content and suspended accounts according to explicit moderation rules;
- cap each account's influence only if a transparent policy is adopted;
- keep ranking inputs explainable and audit score components;
- do not expose private user risk signals or private moderation notes.

### Initial ranking approach

Use a common vote score `S = upvotes - downvotes` over a declared window. Define `age_hours = max((now - created_at)/1 hour, 0)`. For feed stability, floor age at 0.25 hours. Clamp extreme S to a documented range for ranking only; displayed vote totals remain accurate. All modes use deterministic tie-breaking by `created_at DESC, id DESC` or score then ID. Pagination is keyset/cursor-based; cursor includes all sort keys.

1. **New:** Sort by `created_at DESC, id DESC`; optionally apply editorial/content safety eligibility. No popularity threshold, ensuring discovery for new work.
2. **Hot:** A simple Reddit-style log score with time decay: `hot = log10(max(abs(S),1)) * sign(S) - age_hours / 18`. Use a small minimum-engagement tie-breaker and freshness eligibility, not a hard minimum vote count. Sort by hot score then creation time/id. A small, clearly specified exploration slice can be reserved for recent eligible projects with few votes so early projects are not starved; select deterministically per time bucket to avoid unstable pagination.
3. **Top:** Rank by `S` within a selected fixed period (`24h`, `7d`, `30d`, or all-time), with a recency tie-breaker. Display the chosen period. Default to 7 days; never label lifetime score as a recency feed.
4. **Rising:** Identify recent items (e.g. created within 48 hours) with accelerating engagement: score `rising = recent_net_votes_6h + 0.5 * recent_comments_6h`, with a low absolute activity floor and a recency decay `exp(-age_hours/36)`. Use bounded counts and deterministic tie-breaks. The initial implementation may calculate from indexed event rows over the window; do not claim acceleration if only a single cumulative snapshot exists.
5. **Following:** Filter to authors followed by the current user (and any explicitly followed projects if that feature exists), then sort by `created_at DESC` for the first version. Optionally let the user select Hot within Following later. Exclude hidden/blocked content and apply visibility.

The constants above are starting defaults, not immutable product truths. Put them in one tested ranking module and version/document changes. Add unit tests for time boundaries, negative score, ties, low-vote new items, and score monotonicity. Query the database for candidate sets using indexed time/relationship predicates; avoid fetching the entire corpus into application memory. Only introduce aggregate tables/materialized views after profiling.

### Ranking caveats

- Votes and comments are engagement signals, not quality truth. Keep New accessible and do not rank solely by lifetime totals.
- Scores should not be recalculated from client-provided inputs.
- Downvotes may reduce prominence but should not automatically suppress a post absent a documented threshold/moderation rule.
- Soft-deleted content and visibility changes must be reflected immediately in eligibility.

## E. Acceptance-based private messaging authorization

### Lifecycle and invariants

Request lifecycle: `PENDING -> ACCEPTED` or `PENDING -> DECLINED`; sender may cancel while pending if product permits. Accepted conversations may transition `OPEN -> CLOSED`; closure blocks further ordinary sends. Declined requests never create conversations. No normal message table access is granted to pending or declined request participants.

The authoritative conversation exists only after acceptance. It is linked one-to-one to an accepted request. Exactly the sender and recipient become its two participants; no additional participant may be inserted in the initial design.

### Operation permissions

| Operation | Permission |
|---|---|
| Create request with introductory message | Authenticated sender; recipient exists, differs from sender, is not blocked in either direction; no pending request exists for the unordered pair |
| Read request | Only sender and recipient |
| Cancel pending request | Sender only, while still pending |
| Accept or decline | Recipient only, while still pending and not blocked |
| Read conversation/messages | Accepted conversation participant only; conversation not deleted; block/closure rules applied |
| Send ordinary message | Authenticated participant, conversation open, sender is participant, no block prohibits contact |
| Close conversation | Participant action per product policy; closure is monotonic unless an explicit reopen policy is designed |
| Realtime subscription | Exact participant authorization; never public or based only on an untrusted client-supplied user ID |

### Safe transitions and race handling

Use a narrow database function (for example `accept_chat_request(request_id)`) called by an authenticated server action/user-scoped client. The function obtains actor identity from `auth.uid()` and performs one transaction:

1. Lock the request row `FOR UPDATE`.
2. Verify the request exists, actor is its recipient, status is exactly `pending`, and neither direction is blocked.
3. Atomically update status to `accepted`, set `responded_at/updated_at`.
4. Insert exactly one conversation using unique `chat_request_id` and exactly two participant rows for sender and recipient.
5. Create notification rows in the same transaction if notifications are coupled to acceptance.
6. Return only IDs/status appropriate to those two parties.

Concurrent accept attempts serialize on the request row. The first changes status and creates the conversation; the next sees non-pending state and returns a safe conflict/no-op result. Unique `conversations.chat_request_id` is a second line of defense. If any insertion fails, the transaction rolls back both status transition and conversation creation. Decline uses a similar locked conditional update and cannot create a conversation. The app must handle expected conflict responses without leaking whether an unrelated request exists.

Duplicate pending requests: use an unordered pair uniqueness rule for pending status so simultaneous requests in opposite directions cannot both succeed. A partial unique index on canonicalized pair values is suitable if supported by a stable generated/canonical representation; otherwise add stored generated pair columns or a trigger/serialized RPC. Application pre-checks improve UX but are not sufficient. A declined request may be followed by a new request only according to an explicit cooldown/recipient policy.

Blocking: create request and accept operations lock/check relevant block rows inside the same transaction. A block created after acceptance immediately prevents new messages and may close or restrict the conversation according to product policy. Define precedence explicitly: recommended policy is block prevents future sends in both directions and hides/denies realtime delivery, while prior messages remain accessible only to participants unless moderation/legal requirements mandate otherwise. Do not make one party's block row publicly readable. To avoid race between block and send, both operations should lock a canonical user-pair guard (or relevant rows in consistent order) and recheck block status in the same transaction.

### RLS and server-side enforcement

Enable RLS on `chat_requests`, `conversations`, `conversation_participants`, `messages`, and `user_blocks`. Policies must deny anonymous access. Request select is restricted to sender/recipient. Conversation and message select require an `EXISTS` participant row for `auth.uid()` and active status; message insert requires `sender_id = auth.uid()`, participant membership, open conversation, and no prohibited block. Participant rows are immutable to clients except a user's own `last_read_at`. Only narrow transition functions may mutate request status, create conversations, or modify participants. Revoke direct table updates for status/participant fields where required; grant only function execution to authenticated users and use `SECURITY DEFINER` only with fixed `search_path`, explicit actor checks, minimal privileges, and careful review.

Server Actions must also authenticate and validate payloads, but server checks do not replace RLS. Do not use a service-role client for normal end-user messaging. If it is unavoidable for an internal function, keep credentials server-side and reproduce actor authorization explicitly.

### Realtime isolation

Subscribe only to private, authenticated channels scoped to a conversation ID or user-specific notification topic. Authorize channel membership against the persisted participant rows and open/allowed state. Apply Realtime authorization policies and table RLS; do not assume filtering a public channel in JavaScript is security. Never broadcast message bodies to a public topic. On reconnect, refetch rows through RLS; treat Realtime payloads as notification hints, not durable truth. Test that nonparticipants, pending-request parties, blocked parties per policy, and anonymous users cannot subscribe or infer message IDs/content.

## F. Security and privacy controls

### Authentication and sessions

- Supabase Auth is the identity provider. Use secure, HttpOnly, SameSite cookies as supported by the SSR integration; use HTTPS in production.
- Refresh sessions server-side with the supported Supabase SSR pattern. Protect state-changing routes against CSRF using framework/session protections, origin checks where appropriate, and same-site cookies.
- Validate OAuth callback `state` and redirect destinations; allowlist internal return paths to prevent open redirects.
- Never trust a client-submitted user ID, role, ownership value, or OAuth profile field as authorization.

**Implemented in this branch:** Supabase browser/SSR clients are used for email sign-in/sign-up, code-exchange callback, password recovery/reset, client session observation, and sign-out. The callback and post-auth destination are constrained to local paths. Next.js Proxy refreshes SSR cookies and redirects obvious signed-out requests early, but it is not the authorization boundary: protected pages verify `auth.getUser()` server-side, and Route Handlers authenticate independently. `GET/PATCH /api/profile` derives the profile ID from the verified user, rejects extra update fields through strict validation, restricts PATCH origins, and limits updates to username/display name/bio. Public `/u/:username` reads only username, display name, bio, and creation time under the public profile RLS policy. `POST /api/projects` checks the server user and calls a `SECURITY INVOKER` RPC that atomically writes the project and normalized tags. These code paths do not prove that Supabase Auth delivery, refresh, either migration, or live RLS has been remotely verified; test them in a disposable Supabase project before relying on accounts.

### RLS and ownership

- Enable RLS on every application table and Storage bucket. Revoke broad default access and grant only necessary table operations.
- Policies must use `auth.uid()` and check both row ownership and parent visibility. UI hiding is never an authorization control.
- Public projects/posts/comments can be read anonymously only when the row and its parent are public. Private projects are owner-only until explicit sharing is implemented. Unlisted means not listed/discoverable, not inherently confidential; document whether possession of a link grants access.
- Only project owner may edit/delete a project and manage its media/tags. A hard delete cascades only where intended; consider soft delete/audit needs before production.
- Only content authors may edit/delete their comments/posts; enforce vote ownership and uniqueness in the database.
- The current profile migration permits public profile reads but grants authenticated users updates only to `username`, `display_name`, and `bio`; the API also updates only the caller's `auth.uid()` row. Email, user ID, avatar URL, and timestamps are not editable through this feature.
- Profile and project mutations use user-scoped SSR clients, not a service-role key. The project-creation RPC is `SECURITY INVOKER`, checks `auth.uid()`, and relies on table privileges and RLS; it is granted only to `authenticated`.

### Storage restrictions

- Use a dedicated project-media bucket with explicit read policy. Never make private project objects publicly readable.
- Validate allowed image MIME types, size limits, path format, and project ownership. Do not trust filename extensions or browser-reported MIME alone; inspect/verify server-side where feasible.
- Upload paths should be deterministic under a project namespace and should not permit path traversal. Signed URLs are short-lived and issued only after database authorization.
- Deletion/cleanup is retryable and does not disclose inaccessible object paths.

### Messaging and private data

- Requests, conversations, participant rows, messages, blocks, reports, and moderation data are not public.
- Request transitions, participant creation, message insertion, and block checks are enforced in transactional server/database operations plus RLS.
- Notifications about private activity contain minimal data; clients fetch protected detail after authorization.
- Logs and analytics must not include raw message bodies, access tokens, full signed URLs, or report details unless an explicitly controlled audit requirement exists.

### Administrator privileges

- Do not add a user-editable `is_admin` profile column. Use controlled Supabase Auth app metadata/claims or a protected role-membership table administered only through trusted operations.
- Admin/moderator operations require explicit server-side role checks and database policy/function checks. Apply least privilege and log sensitive actions in `moderation_actions`.
- Avoid routine service-role use for user requests. Store privileged keys only in server environment settings, never with a `NEXT_PUBLIC_` prefix.

### Validation, rate limits, and external URLs

- Validate request bodies with shared TypeScript schemas (e.g. Zod) on server boundaries; enforce corresponding database length/check/enum constraints.
- Normalize and limit text, titles, usernames, tags, and request-intro lengths. Render user content safely; avoid raw HTML unless a strict sanitizer and clear product need exist.
- Rate-limit signup-related mutations, posting, comments, votes, chat requests, and message sends. Prefer a small database-backed or platform-supported mechanism initially; add infrastructure only if demonstrated necessary. Return generic errors that do not reveal private record existence.
- Validate repository URLs as HTTPS URLs on `github.com` (and explicitly approved GitHub domains if needed), parse owner/repository components rather than accepting arbitrary fetch URLs. This prevents SSRF when server-side metadata is fetched. Do not fetch arbitrary user-provided URLs. If project websites are supported, treat them as links only and protect clients against unsafe schemes.
- Apply outbound URL allowlisting and normalize redirect/canonical URLs. Escape content in rendered UI.

### Secrets and environment configuration

- `.env.example` contains names/placeholders only; `.env.local` is ignored by version control.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public configuration values, not secrets. Supabase anon key is safe only when RLS is correct.
- `SUPABASE_SERVICE_ROLE_KEY`, GitHub OAuth client secret, and any privileged GitHub token are server-only. Never import them from client components or expose through API responses, source maps, logs, or public build arguments.
- Rotate exposed credentials promptly. Use separate credentials/projects per environment and restrict OAuth redirect URLs.
- Restrict error messages and telemetry; do not include cookies, bearer tokens, private message content, or personal report details.

## Verification checklist before launch

- Test RLS as anon, owner, unrelated authenticated user, recipient, sender, conversation participant, blocked party, and moderator.
- Race-test duplicate vote inserts, duplicate pending requests, simultaneous acceptance, accept-versus-decline, block-versus-send, and close-versus-send.
- Test invalid UUIDs, forged user IDs, private parent joins, signed URL expiry, wrong storage paths, oversized/mismatched files, unsafe repository URLs, and open redirect attempts.
- Verify unauthorized Realtime subscription is denied and reconnect catches up by protected database query.
- Confirm server-only secrets are absent from client bundles and `.env.local` is ignored.


## Phase 4 code boundary (2026-11-01)

The new publish UI creates a draft first and uploads images directly through the signed-in browser Supabase client. No service-role credential is required. The private bucket's object policy binds its first folder to the project UUID and second folder to `auth.uid()`; project RLS independently enforces ownership. The metadata endpoint verifies the owner/project prefix, size, Storage MIME metadata, and actual PNG/JPEG/WebP signature, then records nonblank alt text and a unique display position. Signed image URLs are issued for one hour only after the project and media rows are readable under RLS. Public project rows become visible only after the owner-authorized publish transition. Failed submissions attempt idempotent object cleanup and remove the draft; any remaining draft stays owner-only under project RLS.

The migration `20261101120000_project_media_updates.sql` is prepared but not applied. These controls have unit/static coverage only; Storage policy behavior, signed URL expiry, cleanup failure paths, and anonymous/unrelated-user RLS denial have not been remotely tested. Do not treat screenshot publishing as operational until the migration is applied to the non-production project and those cases pass.
