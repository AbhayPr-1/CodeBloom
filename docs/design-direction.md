# CodeBloom Interface Design Direction

**Status:** Phase 2 design system and responsive shell implemented. The content and account interactions remain preview data unless explicitly described as server-backed; this document does not claim that later product features are complete.

## Product-first visual principles

The interface presents CodeBloom as a modern developer community: focused, information-rich, calm, and familiar to people who browse repositories and technical discussions. Project descriptions, repository links, authorship, and community activity take visual priority over decorative chrome.

The design starts in dark mode and provides a complete light theme. An explicit theme choice is saved in the browser; absent a saved choice, the interface follows the operating-system appearance preference. The theme control is available in the shared header and settings page. Semantic tokens keep contrast and surfaces consistent between themes.

Neutral backgrounds and surfaces support restrained violet and blue accents for actions, selection, links, and focus. Gradients and shadows are limited to subtle panel treatment. Product surfaces use short functional transitions for focus, hover, press, and state changes, with no decorative autoplay; the public landing page adds one-time, reduced-motion-aware section reveals, and the sign-up flow shares the same brand accents, wordmark, and surfaces. Project artwork is lightweight CSS illustration used only to make demo project cards scannable; it is not presented as submitted screenshots.

## Layout and responsive behavior

Wide layouts use a desktop navigation sidebar, central feed/project/discussion column, and a contextual panel for community highlights. The context panel collapses before the main reading column becomes cramped. At mobile widths the app uses a compact header/menu, single content column, and bottom navigation. Forms, cards, project details, and discussion placeholders reflow without horizontal scrolling.

Project cards keep names, summaries, authors, repository labels, topics, and actions readable. Focus-visible outlines, labelled search/action controls, a skip link, current-page navigation state, reduced-motion support, and touch-sized controls are included. Empty search, missing content, preview, success, and error states have distinct language and affordances.

## Typography and content hierarchy

The interface uses a system sans-serif stack to avoid runtime font downloads and stay reliable in local builds. A restrained monospaced face is reserved for repository identifiers and small technical labels. Page titles, project names, summaries, metadata, and helper copy follow a consistent hierarchy with readable line-height and bounded text measure.

## Theme tokens and component patterns

`app/globals.css` contains the dark and light values for background, surfaces, borders, foreground, muted text, violet, blue, success, warning, destructive and focus colors, along with layout and responsive rules. Shared patterns include the app shell, navigation item, button, project card, showcase artwork, feed filter group, page heading, preview note, empty state, form, notification list, privacy callout and community tile.

Core project actions have accessible labels and feedback. Demo voting and browser-local bookmarks are clearly identified as preview interactions and are not treated as server records. Messaging preview copy states that pending requests do not grant ordinary conversation access; no live chat is exposed.

## Interaction and state principles

Search, demo feed sorting, theme, and local preview bookmarks have visible behavior. Feed ordering over fixtures is a demonstrative client-side sort only; the explainable, recency-aware server ranking and Following feed remain in the planned community-feed phase. Form errors and sign-in failures use recovery-oriented messages without exposing raw provider errors in the interface. Success text distinguishes local preview data from a request submitted through a configured API.

This UI phase does not verify Supabase credentials or project setup, account registration/session refresh, RLS enforcement, storage policies, GitHub OAuth, or production deployment. Refer to `docs/progress.md` and `docs/setup.md` for the current boundary.
