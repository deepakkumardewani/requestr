# Spec: launch-readiness

Branch: `feature/launch-readiness` (from `main`). Authoritative intent: `INTERVIEW.md`. Paths come from `REPO_MAP.md` or INTERVIEW.md; paths that exist in the repo but are missing from the map are marked `(exists)`; anything not yet existing is marked `(new)`.

## Objective

Make Requestr launch-ready: a first-run tour, privacy-first anonymous analytics and error tracking behind one swappable adapter, in-app feedback, automated releases with plain-language What's New, a local-data backup nudge, a scannable README with repo health files, and a scripted demo video.

**Users:** first-time and returning developers using Requestr; GitHub visitors deciding whether to try it.
**Why now:** last gap before public launch; without this the launch is blind (no usage data, feedback, or onboarding).

### Success criteria (testable)

- SC1: A fresh browser profile on a desktop viewport (>= 768px, Tailwind `md`) visiting `/app` auto-starts the tour exactly once; reloading does not restart it; Settings and the command palette can replay it.
- SC2: Forwarding is proven at two levels: (a) an `/api/ingest` route unit test with a mocked `fetch` asserts allowlisted events are forwarded to the PostHog `/batch` endpoint with `$geoip_disable: true`, no IP, and unknown events/props dropped; (b) a targeted Playwright spec, enabled by the e2e-only override (R22a), intercepts `/api/ingest` with `page.route` and asserts payload shape. A scrubber unit test over a corpus of seeded request data asserts no captured payload contains any URL, host, header, body, env value, prompt, response, or client IP.
- SC3: With DNT=1, GPC=1, or the Settings toggle off, zero analytics or error requests are made to `/api/ingest` or PostHog. The only exception is an explicit feedback submission by the user (R34), which carries no analytics id and no common props except `app_version`.
- SC4: An unhandled error, an unhandled promise rejection, and an ErrorBoundary crash each produce exactly one `$exception` capture with scrubbed message/stack, and none when opted out.
- SC5: Given unit-test fixtures for the counters in R30-R33, the feedback auto-prompt is shown only when all eligibility rules hold, at most once per session, never within 30 days of a dismiss, never after a submit, and never while another prompt holds the arbitration slot (R41).
- SC6: Merging a release-please PR to `main` produces a git tag and GitHub Release; What's New shows the curated highlights for that version once to returning users.
- SC7: A reader can find hero, demo, features, quick start, and privacy sections in README within 30s (TOC present, all links and image paths resolve via the link-check in R50).
- SC8: `bun run lint:check`, `bun run typecheck`, and `bun run test` pass; targeted e2e specs for tour, prompt arbitration, and opt-out pass.
- SC9: No `boarding.js` or `@cronitorio/cronitor-rum-nextjs` reference remains in `package.json`, `bun.lock`, or `src/`.
- SC11: A landing -> app conversion is measurable: `landing_viewed` and `landing_cta_clicked` arrive (same gating as all events) and the launch dashboard (R60) has a landing -> `app_opened` funnel insight.
- SC12: The PostHog project has the feedback survey (id recorded in env) and a launch dashboard with activation funnel, feature usage, retention, and landing -> app conversion insights, created via the PostHog MCP (R60) or the documented fallback checklist (R62).
- SC10: In `development`, `test`, Vercel preview builds, and Playwright runs without the override, the analytics adapter makes zero network calls and `/api/ingest` refuses to forward (R22).

## Tech stack and commands

Next.js app router, TypeScript, Zustand (`src/stores/`), next-intl (`messages/{en,fr,ja}/`), shadcn UI, Biome, Vitest, Playwright, bun only (never npm). New deps: `driver.js` (runtime); `remotion` + `@remotion/cli` (dev-only, video under `scripts/capture/`). No browser `posthog-js` and no `posthog-node`: the browser adapter posts its own JSON to `/api/ingest`, and the server forwards to PostHog's HTTP `/batch` API with `fetch` (A1).

Commands: `bun install`, `bun run dev` (server always running; do not start), `bun run typecheck`, `bun run lint:check`, `bun run test`, `bun run test:e2e <spec>` (targeted specs only, per project memory), `bun run format`. Note: `bun run verify` runs `lint:write && format && typecheck` (mutates files, no tests), so it is not the gate.

## Project structure (new unless listed)

- `src/lib/analytics/` (new): `events.ts` (typed event map + allowlist, single source of truth), `adapter.ts` (`AnalyticsAdapter` interface + `track`, `captureError`, `submitSurvey`, `setEnabled`), `httpAdapter.ts` (backend-neutral client: batches JSON to `/api/ingest`), `noopAdapter.ts`, `consent.ts` (DNT/GPC/toggle/env resolution), `scrub.ts`, `dedupe.ts` (one-shot and per-session caps), `analyticsId.ts` (analytics-only random id, A2).
- `src/lib/analytics/server/` (new): `posthogSink.ts` (the ONLY file that knows PostHog's wire format: builds `/batch` payloads incl. `$exception_list` and `survey sent`), `validate.ts` (allowlist enforcement shared with `events.ts`).
- `src/app/api/ingest/route.ts` (new): validates, strips IP, enforces allowlist and abuse limits, then delegates to `posthogSink.ts`.
- `src/lib/relay/telemetry.ts` (existing, `RelayEventMap`): installs a sink via `setRelayTelemetrySink` that forwards to `track()` while still dispatching the DOM event.
- `src/stores/useAnalyticsStore.ts`, `usePromptStore.ts`, `useTourStore.ts` (new).
- `src/lib/tour/` (new): `tourAnchors.ts` (`TOUR_ANCHORS` map), `tourSteps.ts`, `startTour.ts`; `src/components/tour/TourPopover.tsx` (new). Replaces `src/components/common/OnboardingTour.tsx` and `src/hooks/useFirstTimeUser.ts`; the key `rq_onboarding_complete` is kept as-is (R6).
- `src/components/feedback/FeedbackDialog.tsx` (new), `src/components/whats-new/WhatsNewModal.tsx` (new), `src/lib/whatsNew/highlights.ts` (new, TS module keyed by version with per-locale copy), `src/components/backup/BackupNudge.tsx` (new), `src/components/common/AnalyticsNotice.tsx` (new).
- Existing files touched: `src/providers/AppProviders.tsx`, `src/components/common/ErrorBoundary.tsx`, `src/components/settings/GeneralSection.tsx`, `src/components/common/CommandPalette.tsx`, `src/components/layout/MainLayout.tsx`, `src/components/settings/backup/useBackupExport.ts`, `src/lib/backup/preferences.ts`, `src/app/privacy/page.tsx` + `page.spec.tsx`, `src/app/settings/constants.ts` (exists), `next.config.ts` (exists), `biome.json` (exists), `.env.example`, `README.md`.
- `.github/workflows/release-please.yml` (new), `release-please-config.json` (new), `.release-please-manifest.json` (new), `CHANGELOG.md` (new). `.github/workflows/ci.yml` (exists) is not changed.
- `docs/` (existing, incl. `docs/SHORTCUTS.md`, `docs/ARCHITECTURE.md`): receives "Chain blocks" (new `docs/CHAIN_BLOCKS.md`) and keyboard-shortcut content (merged into existing `docs/SHORTCUTS.md`). Root: `ROADMAP.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md` (new).
- `scripts/capture/` (existing, has `seed.ts`, `screens.ts`, `relay-record.ts`): `demo-record.ts` and a Remotion composition under `scripts/capture/demo/` (new).

## Code style

Follow `CLAUDE.md` and `~/.claude/skills/code-style`: named constants, functions under ~30 lines, early returns, no silent `catch`, all `localStorage` access in try/catch with in-memory fallback (RelayOnboarding pattern), comments explain why. Example shape:

```ts
export function track<E extends keyof EventMap>(name: E, props: EventMap[E]): void {
  if (!isAnalyticsEnabled()) return;
  adapter.track(name, props);
}
```

## Testing strategy

Vitest unit tests for consent resolution, scrubber, allowlist (client and server), eligibility logic, arbitration store, tour anchor resolution, highlights lookup/validation, analytics id lifecycle. Route tests for `/api/ingest` with mocked `fetch` (pattern of existing route tests, e.g. `src/app/api/proxy/route.spec.ts`). Playwright targeted specs for tour, prompt arbitration, opt-out (no network), and ingest payload shape (via override + `page.route`). No tests under `src/components/reactbits/`. Scenario files in `e2e/scenarios/*.feature.md` per existing convention.

## Boundaries

- Always: allowlist every event/prop on client and server; wrap localStorage; add i18n keys to en/fr/ja; add new env vars to `.env.example`; use `bun`.
- Ask first: adding dependencies beyond those listed; changing CI beyond adding the release workflow.
- Never: send request content or IPs; use `npm`; commit secrets (the PostHog project key is a public write-only key, held server-side only); auto-upload the demo video; add a consent banner.

## Requirements

### Tour
- **R1:** The tour uses `driver.js` with a custom React popover (`TourPopover`) styled in Requestr design language (shadcn tokens, light/dark), showing "step x/N", Back, Next, Skip, and a close button; `boarding.js` is removed from `package.json` and imports.
- **R2:** All anchors are declared once in a `TOUR_ANCHORS` constant map and applied as `data-tour="<id>"` attributes; steps reference the map only (no raw strings).
- **R3:** The tour has ~7 steps in order: URL bar + send (Ctrl+Enter), sample requests, save to collection, environments, Chains canvas, Relay AI dock, command palette (Ctrl+K) / shortcuts (Ctrl+/).
- **R4:** Before starting, only steps whose anchor exists and is visible are kept; the tour waits up to a bounded timeout (named constant, default 3s) for anchors to mount.
- **R5:** If fewer than `MIN_TOUR_STEPS` (default 4) steps resolve, the tour does not start and shows a toast; on first-run auto-start this does not mark the tour complete.
- **R6:** Auto-start occurs once on the first `/app` visit on desktop viewports only (>= 768px, the `md` breakpoint at which `MobileDesktopNotice` hides); completion or skip sets the existing key `rq_onboarding_complete` (kept, not renamed, because `src/lib/backup/preferences.ts` writes it on restore so restored users skip the tour). Auto-start is suppressed under `navigator.webdriver` unless `window.__RQ_TOUR_E2E__ === true`, so automated runs are unaffected (OQ-C); a mid-tour reload restarts the tour (OQ-A).
- **R7:** The tour can be replayed from Settings and from the command palette; replay ignores the completed flag and does not emit first-run side effects.
- **R8:** `OnboardingTour.tsx` and its commented-out use at `MainLayout.tsx:208` are removed; `RelayOnboarding.tsx` is untouched and never runs while the tour is active.
- **R9:** Tour copy lives in `messages/{en,fr,ja}/`; Esc, arrow keys, and focus trapping work; reduced-motion disables animation.

### Analytics
- **R10:** All product code calls only `track()` / `captureError()` / `submitSurvey()` from `src/lib/analytics`; a Biome `noRestrictedImports` rule (or a unit test scanning `src/`) forbids any PostHog import and any import of `src/lib/analytics/server/*` outside `src/lib/analytics/` and `src/app/api/ingest/`.
- **R11:** Swapping the backend requires changing exactly one file, `src/lib/analytics/server/posthogSink.ts` (or replacing it with another sink implementing the same `AnalyticsSink` interface); the client adapter and wire format to `/api/ingest` are backend-neutral. The client interface covers `track`, `captureError`, `submitSurvey`, `setEnabled`.
- **R12:** No analytics cookies are set and no third-party script is loaded in the browser: no PostHog SDK, no autocapture, no pageview capture, no session recording, no feature-flag/remote-config/surveys calls. PostHog host (EU or US) comes from server env `POSTHOG_HOST`.
- **R13:** The client sends JSON batches to `/api/ingest` (single route). The route never forwards `X-Forwarded-For` or any client IP, sets `$ip: null` and `$geoip_disable: true` on every forwarded event, and drops events/props not in the allowlist before calling the sink.
- **R14:** The anonymous distinct id is a random UUID stored in a dedicated localStorage key (`rq_analytics_id`, new), never derived from user data and NOT the existing `rq_anon_id` (which is sent as the Relay/share rate-limit header and must stay unlinkable to analytics). It is deleted on opt-out (a fresh one is generated on re-opt-in) and is never included in backups.
- **R15:** The typed `EventMap` in `events.ts` is the allowlist source for both client and server; unknown event names or props fail typecheck at call sites and are dropped at runtime and in the route.
- **R16:** Events and props are exactly those in the catalogue below; forbidden data (see catalogue) is never sent; a unit test feeds seeded request data through every call site's prop builder and asserts no leak.
- **R17:** `src/lib/relay/telemetry.ts` events are forwarded via a sink installed with `setRelayTelemetrySink`, mapped per the catalogue (`relay_*` names), and still dispatch the local DOM event `relay:telemetry` as today.
- **R18:** Analytics is ON by default; DNT (`navigator.doNotTrack === "1"`) and GPC (`navigator.globalPrivacyControl === true`) disable it automatically and the Settings toggle shows disabled with an explanation.
- **R19:** Settings -> General (`GeneralSection.tsx`) has a "Share anonymous usage data" toggle persisted in a Zustand store (`useAnalyticsStore`); turning it off stops capture immediately in the same session, clears the in-memory queue, and deletes `rq_analytics_id`.
- **R20:** A one-line non-blocking notice on first visit explains collection and links to the privacy page and settings; it never blocks input, is arbitrated per R41, and is not shown when analytics is disabled by DNT/GPC/env. Dismissing it records a flag so it never reappears.
- **R21:** `useCronitor`/`CronitorTracker` are removed from `AppProviders.tsx` and `@cronitorio/cronitor-rum-nextjs` from `package.json` and `bun.lock`.
- **R22:** Analytics (client and server) is disabled unless `NEXT_PUBLIC_ANALYTICS_ENABLED === "true"` (default off; set only in the Vercel Production environment, so preview deploys never send) AND `POSTHOG_KEY`/`POSTHOG_HOST` are set on the server. The client additionally no-ops when `NODE_ENV` is `development` or `test`, or `navigator.webdriver` is true. When disabled, all calls are no-ops with no console errors, and `/api/ingest` returns 204 without forwarding.
- **R22a:** E2e override: a Playwright spec may set a test-only flag (e.g. `window.__RQ_ANALYTICS_E2E__ = true` via `addInitScript`) that enables the client adapter only when `NODE_ENV !== "production"`; it routes to `/api/ingest`, which the spec intercepts with `page.route`. The override is ignored in production builds and never enables server forwarding. Precedence: it bypasses only the env-flag, `NODE_ENV` and webdriver gates; DNT, GPC and the Settings toggle still win. Under the override the feedback survey is treated as configured (OQ-D).
- **R23:** `/api/ingest` enforces a body-size cap, per-IP rate limit (reusing `src/lib/relay/server/rateLimit.ts` / `bodyLimit.ts` patterns, Upstash via `src/lib/redis.ts` (exists) with memory fallback; the IP is used only as a hashed, expiring rate-limit key and never logged or forwarded), same-origin check (`guard.ts` pattern), a max events-per-batch, and returns 204 on accepted/dropped to avoid oracle behavior; malformed JSON returns 400.
- **R24:** The client batches events (flush on interval, batch size, and `pagehide` via `navigator.sendBeacon`) and applies a client-side cap (named constant) per session to limit runaway loops; `dedupe.ts` prevents repeating one-shot events (e.g. `first_request_sent`).

### Error tracking
- **R25:** `window` `error` and `unhandledrejection` handlers plus `ErrorBoundary.componentDidCatch` call `captureError()`, which sends a neutral error record through `/api/ingest`; `posthogSink.ts` maps it to a PostHog `$exception` event with `$exception_list`.
- **R26:** Captured errors pass through `scrub.ts`: message truncated, URLs/hosts/query strings, header-like and `Bearer`/token patterns, and env-value substrings redacted; stack frames keep only file:line (no column source snippets); no component props, component stack text containing props, request state, or breadcrumbs of request data. The ErrorBoundary fallback UI is unchanged.
- **R27:** Error capture respects opt-out/DNT/GPC and env gating (R18, R22), is deduped (same fingerprint at most once per session) and capped per session, and errors thrown inside the analytics module itself are logged to console and never re-captured (no recursion).

### Feedback
- **R28:** A "Feedback" item exists in the sidebar footer (new, there is no help menu today) and in the command palette, and opens `FeedbackDialog` at any time (no eligibility checks; arbitration per R43).
- **R29:** The dialog collects a 1-5 rating (required), optional text (max length constant), optional contact email (validated, optional); submit calls `submitSurvey()`, which `posthogSink.ts` turns into a PostHog `survey sent` event (`$survey_id`, `$survey_response_<question_id>` props). The dialog states that the text and email are sent as written; the contact email is the only PII field, sent only if entered, and the privacy page states this. The free text is not run through the request-data scrubber (user-authored), but is length-capped.
- **R30:** Auto-prompt eligibility: sessions on at least 3 separate calendar days (local-date strings) AND (>= 10 successful requests OR >= 1 chain run OR >= 1 Relay action, where a Relay action is a `relay_tool_applied`), counted locally.
- **R31:** Never in the first session; only when idle (no request in flight, no chain run active, no input/textarea/editor focused, no pointer/key activity in the last idle-window constant).
- **R32:** Never while the tour, What's New, backup nudge, or analytics notice is showing (via arbitration, R41).
- **R33:** Dismiss snoozes 30 days; submit sets "never auto-ask again"; at most one auto-prompt per session.
- **R34:** Feedback counters and state live in localStorage (try/catch) under versioned keys. Counters are kept locally regardless of analytics consent. Opted-out users (toggle/DNT/GPC) still get the auto-prompt under the same R30-R33 rules (user decision: timing is computed locally and nothing is sent unless they submit). A user-initiated feedback submission is always sent, even when analytics is off (DNT/GPC/toggle), because it is an explicit action; in that case it carries no analytics id, no common props except `app_version`, and no `feedback_*` tracking events are emitted.

### Releases & What's New
- **R35:** `.github/workflows/release-please.yml` runs on push to `main` (`googleapis/release-please-action`, `release-type: node`, permissions `contents: write`, `pull-requests: write`), opens a release PR that bumps `package.json` version and updates `CHANGELOG.md`; merging creates a tag and GitHub Release with notes. The manifest bootstraps at the current version `0.1.0`.
- **R36:** A curated highlights source (`src/lib/whatsNew/highlights.ts`), separate from `CHANGELOG.md`, is keyed by version with plain, non-technical copy per locale; a unit test validates every existing entry (en copy required, no commit hashes, `feat:`/`fix:` prefixes, PR/issue numbers, file paths, or code identifiers). A missing entry is not a test failure (release PRs are auto-generated); it simply means no modal (R38).
- **R37:** `WhatsNewModal` shows once per version to returning users only and dismissal records the version. A returning user is one with a stored last-seen version, or (for users who pre-date this feature) `rq_onboarding_complete` set or existing saved data; a genuinely new user records the current version silently and sees no modal. Never together with the tour (arbitration).
- **R38:** The app version is exposed to the client at build time (`NEXT_PUBLIC_APP_VERSION` set in `next.config.ts` from `package.json`); a version with no highlights entry, or an entry with an empty list, shows no modal.
- **R38a:** The release workflow and docs note two manual repo settings/limits: "Allow GitHub Actions to create and approve pull requests" must be enabled, and release PRs opened with `GITHUB_TOKEN` do not trigger `ci.yml` (maintainer re-runs or uses a PAT; CI is not changed in this feature). Conventional-commit PR titles with squash merges are documented in `CONTRIBUTING.md` as the expected merge style.

### Backup nudge
- **R39:** A gentle, dismissible "export a backup" reminder appears only once the user has real data (thresholds as named constants: >= N saved requests or >= 1 chain/collection with content) and no backup export in the last 30 days. Last export is tracked via a new localStorage timestamp (`rq_last_backup_export`, new) written by `useBackupExport` on success.
- **R40:** The nudge's action opens the existing export dialog (`ExportBackupDialog`); dismiss snoozes 14 days; at most one nudge per session; it obeys arbitration and never shows in the first session.
- **R40a:** Backup scope for new keys: `src/lib/backup/preferences.ts` continues to carry only its explicit allowlist. `rq_analytics_id`, feedback counters, prompt snoozes, and the last-export timestamp are never carried; the analytics opt-out choice is carried (so restoring onto a new browser keeps the user's privacy choice).

### Prompt arbitration
- **R41:** A single `usePromptStore` (Zustand) grants at most one active prompt among `tour`, `whats-new`, `feedback`, `backup-nudge`, `analytics-notice`, `relay-coach`; requests are queued by priority and granted only when the current one is released.
- **R42:** Priority (highest first): tour > analytics-notice > whats-new > backup-nudge > feedback. `relay-coach` (RelayOnboarding) is user-initiated by opening Relay and blocks auto prompts while open.
- **R43:** User-initiated opens (Feedback item, tour replay, Export backup, opening Relay) always open immediately and take the slot; any auto prompt currently showing is hidden and re-queued without consuming its snooze or "shown" state.
- **R44:** First visit sequence: on desktop the tour runs first and the analytics notice shows after it ends or is skipped; on mobile (no tour) the notice shows directly; What's New, backup nudge, and feedback are skipped in session one.
- **R45:** Auto prompts are shown only on `/app` and `/chain` routes, and not while a modal dialog is open.

### Privacy page & Settings
- **R46:** `src/app/privacy/page.tsx` is rewritten to remove both existing no-analytics claims (line ~36 "We run no analytics or ad trackers" and line ~109 "No analytics, tracking scripts...") and list exactly: what is collected (the catalogue), what is never collected, the anonymous analytics id (separate from the rate-limit id), no cookies, IP stripped and geo-IP disabled, PostHog as processor and region, how to opt out (toggle/DNT/GPC), feedback text/email, and error reports; `page.spec.tsx` is updated.
- **R47:** The privacy page content is derived from or checked against `events.ts` (a unit test asserts every event name in the catalogue appears on the page or in a generated list).
- **R48:** Settings has a "Replay tour" action and the analytics toggle; `SETTINGS_SECTIONS` additions follow `src/app/settings/constants.ts` (exists).

### README & docs
- **R49:** README follows the order: hero (logo, one-liner, badges, live-app CTA https://requestr-api.vercel.app/, demo video) -> TOC -> Why -> Features with screenshots (HTTP/GraphQL/WebSocket, Chains, Relay AI agent as its own section, encrypted sharing, health monitoring, toolbox, import) -> Quick start -> Privacy & analytics -> Tech stack -> Contributing -> License. Key claims are pulled from the landing page (`src/app/(home)`).
- **R50:** Screenshots come from existing `public/screens/` or are regenerated via `scripts/capture/screens.ts`; every README image/link path resolves (a link-check script, e.g. extending `scripts/capture/verify-assets.mjs`).
- **R51:** "Chain blocks & keyboard shortcuts" content moves to `docs/` (chain blocks -> new `docs/CHAIN_BLOCKS.md`; shortcuts merged into existing `docs/SHORTCUTS.md`, no duplicate file) and is linked; the "Self-hosting: client IP header" section is removed; Roadmap moves to `ROADMAP.md`; the README "Architecture" section is condensed to a link to `docs/ARCHITECTURE.md`.
- **R52:** README's "Privacy & analytics" section replaces the current "Privacy" section (which says nothing leaves the machine) and is consistent with the privacy page (same claims, no stronger).

### Repo health
- **R53:** `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue templates (bug, feature, feedback), and a PR template exist; `SECURITY.md` points to GitHub private vulnerability reporting (advisories) as the primary channel, with `LEGAL_CONTACT_EMAIL` from `src/components/legal/constants.ts` (exists) as fallback.
- **R54:** GitHub topics and `package.json` keywords are reviewed and refreshed; `good first issue` and `help wanted` labels are created (via `gh`) and a handful of starter issues proposed in the PR description (not auto-created).
- **R55:** `.env.example` documents `NEXT_PUBLIC_ANALYTICS_ENABLED` (kill switch, default off), `POSTHOG_KEY` (public project key, server-only), `POSTHOG_HOST` (launch value US `https://us.i.posthog.com`; EU `https://eu.i.posthog.com` possible later), and `POSTHOG_FEEDBACK_SURVEY_ID`, with comments.

### Demo video
- **R56:** A Playwright script (`scripts/capture/demo-record.ts`, new) records the real app on seeded deterministic data (reusing `scripts/capture/seed.ts`) at high resolution with fixed viewport and no real network (mocked routes, incl. a scripted Relay stream as in `relay-record.ts`).
- **R57:** A Remotion composition produces a ~60-90s video with title card, zoom-ins on the active area, per-scene captions, speed ramps (fast through typing/waiting, normal at payoff), and an end card with the URL; scenes: send request, chain run, Relay builds something, encrypted share.
- **R58:** Outputs: an MP4 (<= 10MB, gitignored, for the manual upload), plus a poster image (<= 300KB) and GIF fallback (<= 5MB) committed under `docs/media/` (new); the README shows the video via the user-attachments URL once uploaded and the poster/GIF as fallback.
- **R59:** The final GitHub upload (user-attachments URL via drag-drop) is a manual user step documented in the PR; the build does not attempt it. Until then the README links the poster/GIF.

### PostHog provisioning (via official PostHog MCP)
- **R60:** The build agent provisions PostHog through the official PostHog MCP server (`claude mcp add --transport http posthog https://mcp.posthog.com/mcp`; the user authenticates once, the only manual step). Using it, the agent: creates or confirms the US-region project; creates the feedback survey (API mode: rating 1-5, open text, email) and records its id as `POSTHOG_FEEDBACK_SURVEY_ID`; creates a "Launch" dashboard with insights for the activation funnel, feature usage, retention, and landing -> app conversion (as defined under the catalogue); and verifies events arrive after the production deploy (or via a one-off allowlisted test event).
- **R61:** Vercel env vars (`POSTHOG_KEY`, `POSTHOG_HOST=https://us.i.posthog.com`, `POSTHOG_FEEDBACK_SURVEY_ID`, and `NEXT_PUBLIC_ANALYTICS_ENABLED=true` in Production only) are set with `vercel env add` if the Vercel CLI is logged in and linked; otherwise they are listed as a manual checklist in the PR.
- **R62:** If the PostHog MCP is unavailable at build time, provisioning falls back to a documented manual checklist (`agent_docs/launch-readiness/POSTHOG_SETUP.md`, new) covering the same steps; this never blocks other work.

## Analytics event catalogue

Common props attached by the adapter to every event (allowlisted): `app_version`, `locale`, `viewport_class` (`desktop|tablet|mobile`), `session_day_index` (bucketed: `1|2|3-6|7+`), `theme` (`light|dark`). No other props allowed; no `$current_url`, `$referrer`, `$pathname`, user agent, or device props are ever sent. Event names are `snake_case` (the sink maps errors to `$exception` and feedback to `survey sent`).

| Event | Area | Allowed props | Fires when |
|---|---|---|---|
| `landing_viewed` | acquisition | `path` (enum of known landing/marketing routes, e.g. `/`, `/features`, `/compare`, `/privacy`, `/terms`; unknown -> `other`; never query/hash), `referrer_domain` (hostname only from `document.referrer`, lowercased; same-site or empty -> `direct`) | once per landing page load |
| `landing_cta_clicked` | acquisition | `cta_id` (enum, e.g. `hero_open_app`, `nav_open_app`, `final_open_app`), `path` (same enum) | "Open app" CTA clicked |
| `app_opened` | retention | `is_first_session` bool, `days_since_last_bucket` (`0|1|2-6|7-29|30+`) | once per page session on `/app` |
| `tour_started` | funnel | `trigger` (`auto|replay`) | tour begins |
| `tour_step_viewed` | funnel | `step_id` (enum from `TOUR_ANCHORS`), `index` | each step shown |
| `tour_completed` | funnel | `steps_seen` int | last step Next |
| `tour_skipped` | funnel | `step_id`, `index` | Skip/close |
| `first_request_sent` | funnel | `protocol`, `source` | once ever per browser |
| `request_sent` | usage | `method` (enum, non-standard -> `other`), `protocol` (`http|graphql|websocket|socketio`), `status_class` (`2xx|3xx|4xx|5xx|error`), `duration_bucket` (`<100ms|<500ms|<2s|2s+`), `source` (`manual|sample|history|chain|relay`) | request completes |
| `sample_request_used` | funnel | `sample_id` (enum from built-in samples) | sample inserted |
| `request_saved` | funnel | `is_first` bool | save to collection |
| `collection_created` | usage | none | created |
| `environment_created` | funnel | `variable_count_bucket` | created |
| `environment_switched` | usage | none | active env changed |
| `chain_created` | funnel | `source` (`manual|relay|import`) | created |
| `chain_run` | usage | `status` (`success|failed|stopped`), `node_count_bucket`, `duration_bucket`, `has_loop` bool, `has_subchain` bool | run ends |
| `relay_opened` | usage | none (from `RelayEventMap`) | dock opened |
| `relay_message_sent` | usage | `length_bucket` (`<50|<200|<1000|1000+`, mapped from `length`; text never sent) | user sends |
| `relay_tool_applied` | usage | `entity` (enum of change-log entity kinds) | Relay applies a change |
| `relay_undo` | usage | `entity` (same enum) | change undone |
| `relay_confirm_declined` | usage | none | user declines a confirm |
| `relay_error` | errors | `code` (`RelayErrorCode` enum) | Relay error |
| `relay_permission_mode_changed` | usage | `from`, `to` (`RelayPermissionMode` enum) | mode changed |
| `share_created` | usage | `expiry_bucket` | encrypted share made (no id, no URL, no key) |
| `share_opened` | usage | none | share link opened |
| `import_completed` | usage | `source_type` (`curl|postman|openapi|hub|backup`), `item_count_bucket` | import done |
| `backup_exported` | retention | `mode`, `size_bucket` | export done |
| `backup_imported` | usage | `mode` (`merge|replace`) | restore done |
| `command_palette_opened` | usage | none | opened |
| `shortcut_used` | usage | `shortcut_id` (enum) | allowlisted shortcuts only |
| `setting_changed` | usage | `setting_id` (enum), `value_kind` (`bool|enum`); boolean/enum values only, never free text | allowlisted settings (the analytics toggle itself is never tracked) |
| `whats_new_shown` / `whats_new_dismissed` | lifecycle | `version` | modal |
| `feedback_prompt_shown` / `feedback_prompt_dismissed` | lifecycle | `trigger` (`auto|menu`) | prompt (only when analytics on) |
| `feedback_submitted` | lifecycle | `rating` 1-5, `has_text` bool, `has_email` bool (survey body via `submitSurvey`) | submit (only when analytics on) |
| `backup_nudge_shown` / `backup_nudge_accepted` / `backup_nudge_dismissed` | lifecycle | none | nudge |
| `$exception` | errors | scrubbed `message`, `type`, frames (file:line), `source` (`window|boundary|promise`) | error captured |

Forbidden everywhere (enforced by allowlist + scrubber): request/response URLs, hosts, paths, query strings, headers, bodies, env names/values, collection/request/chain names, Relay prompts/responses/attachments, share ids/keys, raw error text containing URLs, IP address, full page URL/query/hash and full referrer URL (only the landing `path` enum and `referrer_domain` are allowed), user agent beyond coarse `viewport_class`, free-text from any user field except the opt-in feedback text/email.

Landing -> app conversion (PostHog insight): `landing_viewed` -> `landing_cta_clicked` -> `app_opened`, broken down by `referrer_domain`. Activation funnel: `app_opened(first)` -> `tour_*` -> `first_request_sent` -> `request_saved` -> `chain_run` or `relay_opened`. Retention: `app_opened` by `days_since_last_bucket`; feature usage: counts of `request_sent`, `chain_run`, `relay_*`, `share_created`.

## Edge cases

**Analytics**
- Adblock or blocked `/api/ingest`: failures are logged once at debug level (not thrown), no retry storm (max 1 retry with backoff, then drop); the app is unaffected. First-party route reduces blocking.
- Offline: events are queued in memory up to a cap (named constant), flushed on reconnect, dropped beyond the cap; nothing persisted to disk.
- Opt-out mid-session: queue is cleared, `rq_analytics_id` deleted, adapter disabled, further `track`/`captureError` no-op; no "opted out" event is sent.
- Re-opt-in: a new random id is generated (no link to the previous one).
- DNT/GPC: evaluated at init and on toggle; if either is set the toggle is forced off and labelled.
- SSR: `track()` is safe to import server-side and no-ops without `window`; the adapter initializes only in a client effect in `AppProviders`.
- Dev/test/e2e/preview: no-op (R22); only the R22a override enables the client, and only in non-production builds against an intercepted route.
- Missing env: no-op, no warnings in production console; `/api/ingest` returns 204 without forwarding.
- `/api/ingest` abuse: body cap, batch cap, rate limit, same-origin check, allowlist drop, no echo of payload, constant 204; malformed JSON returns 400.
- PostHog upstream down/slow: the route forwards with a timeout constant, logs status only (no payload), and still returns 204.
- Bot traffic: client drops events when `navigator.webdriver` is true; the server drops batches whose UA matches a known-bot list, without storing or forwarding the UA.
- Payload size: per-prop string max length; unknown prop dropped; oversize event dropped.
- Landing/marketing pages: only `landing_viewed` and `landing_cta_clicked` are sent, through the same adapter and the same opt-out/DNT/GPC/env gating (R18, R22); the opt-out set in the app applies there too (shared store/key). The R20 notice is also shown on a first landing visit (no other prompts exist there) and its dismissal is shared with the app.
- Referrer edge cases: missing, invalid, or same-site referrer -> `direct`; IP-literal or `localhost` referrers -> `other`.

**Tour**
- Small screens: below `md` no auto-start; manual replay shows the MIN_TOUR_STEPS toast if too few anchors are visible.
- Missing anchors (panel collapsed, feature disabled, e.g. `NEXT_PUBLIC_RELAY_ENABLED` off): step skipped; step count recomputed so "x/N" stays correct.
- Tab not open / empty state: the first anchors exist in the empty state; if the URL bar is absent the tour waits (R4) then aborts without marking complete.
- Restored from backup: `rq_onboarding_complete` is set by restore, so no auto-start.
- Re-play while a prompt is showing: replay takes the slot per R43; replay mid-tour restarts cleanly with no duplicated overlays.
- Resize/route change mid-tour: tour destroys itself on route change (releasing the slot); resize refreshes positions.

**Feedback**
- Submitting offline or route error: show an inline error and keep the draft; do not close.
- Survey id env missing: submit button disabled with an explanatory message; manual entry still visible.
- Invalid email: inline validation, field optional.
- Multiple tabs: eligibility/snooze state read at show-time from localStorage to avoid double prompts; BroadcastChannel not required (A7).
- Clock changes: day counting uses stored local dates, ignoring future-dated entries.
- localStorage unavailable (private mode): counters in memory, so auto-prompt effectively never fires (needs 3 days); manual feedback still works.

**What's New**
- First-ever visit: record version, show nothing. Version bump with no or empty highlights entry: show nothing. Multiple versions skipped: show only the latest version that has highlights.
- Existing users at launch (no stored version, but onboarding complete or saved data): treated as returning (R37).
- Locale missing a highlights translation: fall back to `en`.
- Tour active or analytics notice pending: modal deferred (arbitration), not dropped.

**Backup nudge**
- Data detection read failure: no nudge. Backup done in another tab: last-export timestamp re-read before showing. Restore-in-progress: suppressed.

**Prompt arbitration**
- A granted prompt unmounts unexpectedly (route change): release in cleanup so the queue does not deadlock; a safety timeout is not used.
- Two requesters in the same tick: priority wins deterministically (stable order).

**Releases**
- Merge commits with non-conventional titles are ignored by release-please; only conventional commits produce changelog entries. A release with only `chore`/`ci` commits produces no release PR.

**Demo/README**
- Video too large: GitHub user-attachments videos are limited to 10MB on free plans, so the MP4 is encoded to <= 10MB (R58); the committed poster/GIF covers slow connections and the period before manual upload.

## Assumptions

- A1: PostHog Cloud, US region (`POSTHOG_HOST=https://us.i.posthog.com`, user decision). No browser SDK; the server forwards allowlisted events to PostHog's `/batch` endpoint with `fetch` using the public project key from server env `POSTHOG_KEY`. This keeps the IP strip and allowlist enforceable (the browser SDK compresses payloads and auto-attaches URL/referrer/device props) and makes the server sink the single swap point. The `/api/ingest` route is an implementation detail the user did not veto.
- A2: "Memory persistence" in a PostHog SDK would reset the id each page load and break retention. The spec therefore uses its own random id (`rq_analytics_id`) in localStorage (not a cookie), consistent with the user's "anonymous random id". `src/lib/anonUser.ts` (`rq_anon_id`) is deliberately NOT reused: it is sent to our server as the Relay/share rate-limit header, so reuse would link server-side request logs to analytics, and clearing it on opt-out would reset rate limits.
- A3: PostHog Surveys in API mode accept responses as `survey sent` events with `$survey_id` and `$survey_response_<question_id>` props; the survey (rating 1-5, open text, email) is created via the PostHog MCP (R60, fallback R62) and its id provided via `POSTHOG_FEEDBACK_SURVEY_ID`.
- A4: Error events are built server-side in `posthogSink.ts` as `$exception` with `$exception_list` from the scrubbed client record.
- A5: Bot detection by `navigator.webdriver` and UA is best-effort.
- A7: No cross-tab synchronization beyond reading localStorage at show-time.
- A8: Release-please uses the `node` release type with `package.json` as version source; the repo already uses conventional commits (recent history confirms `feat(...)`/`fix(...)`/`chore(...)`).
- A9: `NEXT_PUBLIC_APP_VERSION` is derived in `next.config.ts` from `package.json`.
- A10: Desktop is `>= 768px` (Tailwind `md`), the breakpoint at which `MobileDesktopNotice` (`md:hidden`) hides.
- A11: Highlights are translated to en/fr/ja at release time; fallback to en.
- A12: Backup-nudge thresholds (N=5 saved requests, 30-day interval, 14-day snooze) and idle window (3s) are tunable constants.

## Out of scope

Self-hosting docs; user accounts; a self-built analytics backend (future; the server sink is the seam); an opt-in consent banner; session recording/heatmaps; A/B testing and feature flags; server-side (route handler) error tracking; landing-page analytics beyond `landing_viewed`/`landing_cta_clicked`; automatic upload of the demo video to GitHub; changes to `ci.yml`; localization of the privacy page beyond existing message structure unless already localized.

## Resolved (from code)

- OQ1 (was): `src/lib/anonUser.ts` persists `rq_anon_id` and is used by `ShareModal.tsx` and `useRelayChat.ts` as a rate-limit id -> not reused; separate `rq_analytics_id` (R14, A2).
- OQ3 (was): highlights are a TS module keyed by version with locale maps (`src/lib/whatsNew/highlights.ts`).
- OQ4 (was): `RelayEventMap` has 7 stable events; all forwarded 1:1 with `length` bucketed and `entity`/`code`/mode as enums (catalogue). `relay_tool_applied` is defined but has no production call site today; the plan adds it where Relay applies a change (needed for R30).

## Decided by the user (post-audit)

- D1 (was OQ2): PostHog region US (`https://us.i.posthog.com`); provisioning is done by the build agent via the PostHog MCP with a single user auth step (R60-R62, A1, R55).
- D2 (was OQ5): opted-out users still get the feedback auto-prompt; nothing is sent unless they submit (R34).
- D3 (was OQ6): landing pages send minimal analytics, `landing_viewed` (path enum + referrer domain) and `landing_cta_clicked`, under the same gating; landing -> app conversion is a success criterion and dashboard insight (SC11, catalogue).

## Open questions

Raised in plan review. Each has a default already applied in SPEC/PLAN/TASKS; none blocks the build.

- OQ-A: Mid-tour reload. Default: a mid-tour reload restarts the tour; SC1 "reload does not restart" is tested after skip or completion (T5.8). Alternative: persist a started marker on the first step so a mid-tour reload never restarts.
- OQ-B: Seed a What's New entry for the current version. Default: seed one plain-language launch entry for 0.1.0 (T8.2). Alternative: no entry, SC6 proven by unit tests only.
- OQ-C: Tour auto-start under automation. Default: suppressed under `navigator.webdriver` unless `window.__RQ_TOUR_E2E__ === true` (R6, T5.4). Alternative: set `rq_onboarding_complete` in the QA seed (`qa:seed:build`) and capture scripts.
- OQ-D: Feedback submit under the e2e override. Default: survey treated as configured in non-production when the R22a override is set (T6.4). Alternative: dummy survey env in `.env.local`.
- OQ-E: Survey-configured flag source. Default: build-time boolean from `next.config.ts` (T6.4). Alternative: a root-layout prop (risks opting pages out of static rendering).
- OQ-F: Production analytics switch timing. Default: post-merge manual step after the notice and toggle are deployed (T10.6). Alternative: switch in-build after a preview deploy.
- OQ-G: Phase 11 task kind. Default: keep `gate` with Verify steps that execute the tooling. Alternative: retag as `implementation`.
