# CodeBloom Phase 2 Implementation Plan

## Goal and boundaries

Deliver the next roadmap phase: a polished, responsive developer-community interface with a coherent dark/light design system, accessible shell, useful page states, and clearly disclosed preview interactions. Preserve the plain-local Next.js App Router project and existing architecture. Do not begin Phase 3 authentication/profile implementation or claim that project publishing, votes, comments, notifications, messaging, GitHub metadata, or deployment are production-ready.

The current tree includes Supabase browser/server helpers and one migration covering profiles, projects, tags, and bookmarks. These remain a partial foundation; no UI claim will imply that unimplemented domains have database policies. Keep `.env.local` private, never print its values, and do not test live credentials as a substitute for implementation evidence.

## Implementation approach

- Reuse the existing Next.js 16 App Router routes, strict TypeScript, Tailwind CSS 4 entry point, Lucide, Zod, and existing Supabase client helpers.
- Keep route-specific content in `components/feed-view.tsx` and shared navigation/theme in `components/app-shell.tsx` and `components/theme-provider.tsx`.
- Keep demo records in `lib/demo-data.ts`; keep preview-only votes/bookmarks clearly labeled. Shared bookmarks may use the existing browser-local `CommunityProvider` storage. Do not present browser-local state as synced data.
- Use `app/globals.css` as the single Tailwind/global styling entry point and organize semantic dark/light tokens, component patterns, responsive behavior, focus states, and reduced-motion support there.
- Correct route manifest and catch-all route behavior as route coverage is made explicit. Ensure unknown paths produce a not-found page rather than silently showing the home feed.
- Add only focused tests for stable Phase 2 contracts. Run typecheck, lint, Vitest, production build, and route/HTTP smoke checks where the local environment permits.

## Design direction

Reuse `docs/design-direction.md`: a calm, product-first developer-community aesthetic, dark-first with a fully usable light theme, neutral surfaces, restrained violet/blue accents, readable project content, and minimal decoration. Use a desktop navigation rail, central reading column, and optional context rail; collapse to a single-column/mobile navigation without horizontal overflow. Keep focus visible, labels semantic, empty/error/success states explicit, and respect reduced motion. Brand essence: an open workshop for developers sharing work and useful feedback; curious, practical, welcoming. The existing CodeBloom wordmark and four-petal mark remain the identity; accents and card artwork should support project content rather than dominate it.

## Project structure in scope

```text
app/
  layout.tsx                 # metadata, providers, shared app shell
  page.tsx                   # community home/feed
  [...slug]/page.tsx         # project and community preview routes
  api/projects/route.ts      # existing server handler; not expanded in this UI phase
  globals.css                # global tokens, components and breakpoints
components/
  app-shell.tsx              # responsive shared navigation and context panel
  theme-provider.tsx         # stored/system theme preference
  feed-view.tsx              # feed, explore, project detail and preview pages
  project-card.tsx           # project card and showcase presentation
  community-provider.tsx     # browser-local preview state only
  ui/                        # shared controls, headings and state notices
lib/
  demo-data.ts               # explicitly synthetic presentation records
  supabase/                  # existing browser/server/config helpers
  validation/                # existing Zod project input schema
public/manus-routes.json     # route inventory for preview tooling
supabase/migrations/         # existing first migration; no new domain schema in this phase
tests/unit/                  # route and input tests, plus focused Phase 2 tests
docs/                        # architecture, security, design, roadmap, setup, progress
```

Use kebab-case filenames, PascalCase React components, camelCase TypeScript, and keep component logic local unless it is clearly reusable.

## Explicitly deferred

Phase 3 auth/session/profile lifecycle; Phase 4 project/media management and production publishing; Phase 5 server-backed posts/comments/votes/ranking/moderation; Phase 6 GitHub API metadata; Phase 7 acceptance-gated messaging; Phase 8 search/follows/notifications/relationships; Phase 9 security/performance audit; Phase 10 deployment/release. Supabase URL/key presence alone does not establish any of these capabilities.

## Landing page refresh

Keep the existing CodeBloom editorial/terminal-inspired visual identity and extend its public landing page with useful paths into the project preview, project topics, and a short FAQ. Prefer content derived from the sample project fixtures; label fixture counts and showcase cards as preview data rather than real community activity. Replace the simulated blocking first-load screen with immediate content and subtle section/card reveal transitions. Add a single delegated click-feedback handler so opt-in sound and supported device vibration apply consistently to interactive controls; expose independent sound and haptic toggles, and honor reduced-motion preferences. Use no external media or new runtime dependencies.

## Public landing SEO and performance

Keep the landing page and `/explore` content in the initial HTML, add accurate route-specific metadata and a crawlable sitemap for only those substantive public routes, and noindex the remaining catch-all preview/authenticated routes until their detail content and status are resolved server-side. Accept an explicitly configured HTTPS production origin through `NEXT_PUBLIC_SITE_URL`; omit canonical, absolute sharing, and sitemap URLs when it is unset or invalid. Reduce the public landing route's client/CSS payload by moving its stylesheet to the route and separating static project artwork from interactive project-card dependencies. Keep social preview generation server-side and outside the landing client bundle; add no external runtime dependency.

## Site-wide UI transitions and sign-up theme alignment

Extend the existing interaction language with brief, consistent transitions for shared links, buttons, form fields, cards, and state feedback, plus restrained hover/focus/pressed affordances in the app shell. Preserve the current layout and authentication behavior; align the sign-up page's wordmark lockup, two-tone brand accents, panel treatment, and interactive form states with the existing dark/light theme tokens. Apply reduced-motion preferences globally so new and existing interface motion is suppressed consistently; do not add animation packages or decorative autoplay.

## Scroll-led landing story

Replace the static about introduction with a focused three-chapter scroll narrative: explanatory chapter copy remains in semantic HTML on the left, while a sticky, CSS-illustrated CodeBloom product scene changes to reflect the active chapter. Use a small IntersectionObserver scoped to the story to synchronize the scene; keep all core story copy visible and functional when scripting is unavailable, stack the illustration and chapters on mobile, and suppress decorative scene transitions for reduced motion. Define explicit dark and light theme tokens for the stage, faux interface, and mobile previews so contrast and surfaces remain cohesive across theme changes. On genuine chapter changes, play a short chapter-specific procedural motif and a distinctive vibration pattern, honoring existing sound/haptic controls and avoiding repeat cues for repeated observer notifications or initial load. Reuse the existing landing palette and type; do not add external media, scroll dependencies, or unsupported claims about live member activity.

## Landing brand intro

Precede the existing home content with a full-viewport CodeBloom wordmark and a short CSS particle-dissolve reveal. Use deterministic lightweight spans rather than a video/canvas or external asset; theme the overlay for dark and light mode. Make it skippable, run once per browser session, and bypass it for reduced-motion preferences. Keep the underlying landing content intact and inert only while the overlay is visible; the intro itself makes no sound and requests no haptics.
