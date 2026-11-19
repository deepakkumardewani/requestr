# Plan: launch-readiness

Source of truth: `SPEC.md` (requirement ids R*, SC*), `INTERVIEW.md`, `REPO_MAP.md`. Paths come from the repo map or are marked `(new)`. Task lists live in `TASKS.md` (not here). Branch: `feature/launch-readiness`.

## 1. Architecture

### 1.1 Analytics pipeline (the spine)

```
call site -> track()/captureError()/submitSurvey()   src/lib/analytics/adapter.ts (new)
          -> consent gate (consent.ts: env, NODE_ENV, webdriver, DNT, GPC, store toggle, e2e override)
          -> dedupe.ts (one-shot, per-session caps) -> scrub.ts (errors only)
          -> httpAdapter.ts: in-memory queue, batch on interval/size/pagehide (sendBeacon)
          -> POST /api/ingest                          src/app/api/ingest/route.ts (new)
             guard: same-origin, body cap, rate limit, bot UA, batch cap, JSON parse (400 on malformed)
             validate.ts: allowlist from events.ts, drop unknown events/props, string max length
          -> AnalyticsSink interface -> posthogSink.ts  (ONLY file that knows PostHog)
             maps: events -> /batch, errors -> $exception + $exception_list, survey -> "survey sent"
             sets $ip null, $geoip_disable true, uses POSTHOG_KEY/POSTHOG_HOST, fetch with timeout
          -> 204 always (except 400 malformed)
```

Modules (all `(new)` under `src/lib/analytics/` unless noted):

- `events.ts`: typed `EventMap`, common props, bucket helpers, allowlist. Single source for client types, server validation, privacy-page test (R15, R47).
- `adapter.ts`: `AnalyticsAdapter` interface + module-level `track`, `captureError`, `submitSurvey`, `setEnabled`; SSR-safe (no-op without `window`).
- `httpAdapter.ts` (real) and `noopAdapter.ts` (dev/test/preview/missing env). Chosen once in a client effect in `AppProviders`.
- `consent.ts`: pure function `resolveConsent(env)` returning `{enabled, reason}`; reasons surfaced to Settings (forced-off label for DNT/GPC).
- `analyticsId.ts`: `rq_analytics_id` lifecycle; distinct from `src/lib/anonUser.ts` (`rq_anon_id`) which is left untouched (A2).
- `scrub.ts`, `dedupe.ts` as in spec.
- `server/posthogSink.ts`, `server/validate.ts` (new). Only `route.ts` and `posthogSink.ts` import `server/*`.
- `src/stores/useAnalyticsStore.ts` (new): persisted opt-out toggle (serializable, persist in actions per project store conventions); the toggle drives `setEnabled`.
- Relay: `src/lib/relay/telemetry.ts` (existing, `RelayEventMap`) gets a sink installed with `setRelayTelemetrySink` that maps to `track()` and keeps dispatching `relay:telemetry`.
- Guards reuse existing patterns: `src/lib/relay/server/guard.ts`, `rateLimit.ts`, `bodyLimit.ts`, `src/lib/redis.ts`.
- Biome `noRestrictedImports` in `biome.json` (existing) enforces R10; a unit test scanning `src/` is the backstop.

### 1.2 Prompt arbitration

`src/stores/usePromptStore.ts` (new): one active slot; ids `tour | analytics-notice | whats-new | backup-nudge | feedback | relay-coach`. API shape: `request(id, {priority, auto})`, `release(id)`, `openUserInitiated(id)`. Priority tour > analytics-notice > whats-new > backup-nudge > feedback; ties broken by stable insertion order. User-initiated opens preempt: the displaced auto prompt is re-queued without consuming its "shown"/snooze state (R43). Each prompt component calls `request` in an effect and `release` in cleanup (route change safe, no timeout). A small `useAutoPromptGate` hook (new, in `src/lib/prompts/` (new)) centralises the common preconditions: route is `/app` or `/chain`, no modal dialog open, not first session (R44/R45). Feedback adds its own idle gate on top (R31). The first-session flag is derived from the same session-day tracker the feedback counters and `days_since_last_bucket` use (`src/lib/prompts/sessionTracker.ts` (new), created in P1 because `app_opened` needs it), kept in localStorage with in-memory fallback, independent of analytics consent (R34).

`RelayOnboarding.tsx` (existing, untouched) is the `relay-coach` holder: a thin adapter in the Relay dock open path calls `openUserInitiated("relay-coach")` without modifying RelayOnboarding itself, if wiring there is not possible without editing it, the minimal hook point is the dock open handler instead (see Risks).

### 1.3 Tour module

- `src/lib/tour/tourAnchors.ts` (new): `TOUR_ANCHORS` const map; `data-tour` attributes applied in the existing components (request URL bar/send, `SampleRequestCards`, save flow, `EnvSelector`, Chains accordion trigger in `SidebarMainTab.tsx`, Relay dock entry). The command palette has no visible trigger (Ctrl+K only), so its step is an element-less centred popover.
- `tourSteps.ts` (new): ordered step definitions referencing the map only; `startTour.ts` (new): resolves visible anchors, bounded wait (named constant, 3s), `MIN_TOUR_STEPS` guard + toast, driver.js instance, destroys on route change, takes the `tour` prompt slot.
- `src/components/tour/TourPopover.tsx` (new): custom React popover (shadcn tokens, step x/N, Back/Next/Skip/close, reduced-motion, focus trap). Rendered via driver.js `popoverClass`/custom render with a React root per popover.
- `src/stores/useTourStore.ts` (new): active flag, trigger (`auto|replay`), current step.
- Completion/skip writes the existing key `rq_onboarding_complete` (kept for backup-restore compatibility in `src/lib/backup/preferences.ts`).
- Removes `src/components/common/OnboardingTour.tsx`, `src/hooks/useFirstTimeUser.ts`, the commented-out use in `src/components/layout/MainLayout.tsx`, and `boarding.js` from `package.json`. The replacement auto-start hook lives with the tour (`src/lib/tour/useTourAutoStart.ts` (new)).
- Replay entry points: `src/components/settings/GeneralSection.tsx` and `src/components/common/CommandPalette.tsx` (both existing).

### 1.4 Feedback

- `src/components/feedback/FeedbackDialog.tsx` (new): rating (required), text (capped), optional validated email, inline error with kept draft, disabled when survey is not configured.
- Entry points: new sidebar-footer item (the layout files under `src/components/layout/`, e.g. `LeftPanel.tsx` / `SidebarMainTab.tsx`, existing) and the command palette.
- Counters and eligibility: `src/lib/feedback/eligibility.ts` (new, pure, unit-testable per SC5) and `src/lib/feedback/feedbackState.ts` (new, versioned localStorage keys, try/catch, ignores future-dated days). Counter increments are called from the same sites that already fire usage events, but are NOT routed through `track()` (they must work with analytics off, R34).
- Submit: `submitSurvey()` goes through the adapter. An explicit submission bypasses the user-consent gate (toggle/DNT/GPC) but not the server/env gate; in that case it carries no analytics id and only `app_version` (R34). This is a distinct code path in `httpAdapter`/`adapter.ts` (`sendSurveyOnce`), not a toggle override.
- Survey availability for the disabled-submit state: computed at build time in `next.config.ts` (existing) from `POSTHOG_FEEDBACK_SURVEY_ID` and `POSTHOG_KEY`, exposed only as the boolean `NEXT_PUBLIC_FEEDBACK_SURVEY_CONFIGURED` (never the id or key) and provided to the dialog through `AppProviders`. This keeps the root layout static and the ingest route a constant 204. In non-production with the R22a e2e override the survey is treated as configured so e2e can exercise submit.

### 1.5 What's New highlights source

- `src/lib/whatsNew/highlights.ts` (new): TS record keyed by version, locale maps `{en, fr, ja}` of plain-language bullet lists; `getHighlights(version, locale)` with `en` fallback; `pickLatestWithHighlights(lastSeen, current)` for skipped versions.
- `NEXT_PUBLIC_APP_VERSION` set in `next.config.ts` (existing) from `package.json` (A9).
- `src/components/whats-new/WhatsNewModal.tsx` (new) + `src/lib/whatsNew/whatsNewState.ts` (new: last-seen version key, returning-user determination via last-seen / `rq_onboarding_complete` / existing saved data). Requests the `whats-new` slot.
- A unit test validates every existing entry (en required, no hashes/prefixes/PR numbers/paths/identifiers).
- Release PRs are auto-generated, so a missing highlights entry is valid; the flow shows nothing.

### 1.6 Backup nudge

- `src/components/backup/BackupNudge.tsx` (new), `src/lib/backup/backupNudgeState.ts` (new: snooze, last-shown session, thresholds as named constants, re-reads `rq_last_backup_export` at show time).
- `src/components/settings/backup/useBackupExport.ts` (existing) writes `rq_last_backup_export` on success and emits `backup_exported`.
- Action opens `ExportBackupDialog` (existing, `src/components/settings/backup/`) as a user-initiated open (takes the slot, R43).
- `src/lib/backup/preferences.ts` (existing): allowlist gains only the analytics opt-out choice; `rq_analytics_id`, feedback counters, snoozes and `rq_last_backup_export` stay out (R40a).

### 1.7 Notice, privacy page, settings

- `src/components/common/AnalyticsNotice.tsx` (new): one-line non-blocking notice; requests `analytics-notice` slot; also mounted on landing pages (no other prompts there); dismissal flag shared.
- `src/app/privacy/page.tsx` (existing) rewritten; `page.spec.tsx` updated; a unit test asserts every event name in `events.ts` appears on the page or a generated list (R47).
- `GeneralSection.tsx` gets the toggle (disabled with explanation under DNT/GPC) and "Replay tour". `src/app/settings/constants.ts` (existing) only changes if a new settings entry is required.

### 1.8 Landing acquisition events

Landing pages under `src/app/(home)`, `src/app/features`, `src/app/compare/[competitor]` are server components. A small client component `src/components/landing/LandingAnalytics.tsx` (new) fires `landing_viewed` (path enum, referrer domain) once per load; `landing_cta_clicked` is fired from the existing CTA component (`src/components/landing/PrimaryCta.tsx`, plus Nav/FinalCta call sites) via an `onClick`. Both go through the same adapter and gating.

## 2. Key design decisions and trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| No browser SDK; first-party JSON to `/api/ingest`, server forwards to PostHog `/batch` (A1) | IP strip and allowlist are enforceable; no auto-attached URL/referrer/device props; no cookies; one swap file (`posthogSink.ts`) | Must hand-build PostHog wire formats (`$exception_list`, `survey sent`); no PostHog SDK conveniences; risk of drift (mitigated by sink unit tests and a live verification in P10) |
| Own random id `rq_analytics_id`, not `rq_anon_id` (A2) | Keeps server rate-limit logs unlinkable to analytics; opt-out can delete without resetting rate limits | Two ids in storage |
| Kill switch `NEXT_PUBLIC_ANALYTICS_ENABLED` default off, Production only (R22) | Previews, dev, CI, e2e can never send; code can merge and deploy dark before the privacy page and provisioning are verified | Build-time inlined flag, so toggling requires a redeploy |
| Server-side allowlist duplicates client check but shares `events.ts` | Client is untrusted; the route is the real enforcement point | Both sides must import the same module (types compile on both) |
| Constant 204 from `/api/ingest` | No oracle for probing the allowlist; upstream failure never surfaces | Harder to debug; mitigated by status-only server logging |
| Arbitration in a Zustand store with preemption + re-queue | Meets "one prompt at a time" across 6 sources with deterministic priority; matches repo convention (`src/stores/`) | Every prompt must release on cleanup; tested with a fake-prompt harness |
| Feedback counters independent of analytics consent | Opted-out users still get the prompt (D2); nothing is sent unless they submit | A user-initiated submit is the one send allowed while opted out; documented on the privacy page |
| Survey availability as a build-time boolean from `next.config.ts` | Client cannot see server env; ingest must stay oracle-free; root layout stays static | Changing the survey env needs a redeploy (same as the kill switch) |
| Highlights in a TS module, separate from `CHANGELOG.md` | User requirement: plain-language copy; type-checked; versioned with code | Maintainer must add an entry per release worth announcing; absent entry shows no modal |
| `rq_onboarding_complete` retained | `src/lib/backup/preferences.ts` already writes it on restore | Legacy name for a new tour |
| Error capture via the same adapter; scrubber on client, sink maps to `$exception` | One privacy boundary; swappable | Scrubbing is best-effort regex; mitigated by corpus test (SC2) |
| Demo video built last with Playwright + Remotion in `scripts/capture/` | Needs final UI (tour overlays, feedback item); dev-only deps | New dev deps `remotion`, `@remotion/cli` (spec-listed) |

## 3. Dependency graph

```
Setup (branch + env docs + Cronitor removal)  -- part of P1
  |
  v
P1 analytics core + /api/ingest + sink + session tracker + Cronitor removal ---> P10 PostHog provisioning (MCP)
  |                                                                                 |
  v                                                                                 v
P2 consent UI (settings toggle) + privacy page + error tracking + relay telemetry   P10 live switch (post-merge, after notice + toggle deployed)
  |
  +--> P3 usage + landing event instrumentation (needs P1; counters hook points shared with P6)
  |
  v
P4 prompt arbitration store + analytics notice  (needs P1/P2 for the notice)
  |
  +--> P5 tour  (needs P1 events, P4 store)
  +--> P6 feedback (needs P1 survey path, P4 store; counters share call sites with P3)
  +--> P7 backup nudge (needs P4; reads useBackupExport)
  +--> P8 releases + What's New (modal needs P4; release-please workflow is independent)

Independent, can start anytime after the branch exists:
  P8a release-please workflow + config (R35, R38a)
  P9a docs split + repo health files (R51, R53, R54)
  P9b README rewrite (R49, R50, R52) -- text final after P2 (privacy wording); media after P11

P11 demo video (needs P5-P8 final UI; screenshots from screens.ts) --> README video wiring (P9b tail)
```

Parallelisation: after P1 lands, {P2, P8a, P9a} are independent; after P4, {P5, P6, P7, P8-modal} are independent of each other but share `MainLayout.tsx`/`AppProviders.tsx` mount points (merge-conflict hotspots, serialise those edits).

## 4. Phases and slices

Each phase leaves the app working and shippable. Analytics stays off in production until the kill switch is turned on (P10, post-merge), so P1-P9 can ship dark.

### P1: Analytics foundation (acquisition of telemetry plumbing, no UI)

Vertical slice: `track()` from any call site reaches a mocked PostHog through the ingest route; Cronitor gone.

- Event map, adapter, noop/http adapters, consent resolver, analytics id, dedupe, session-day tracker (`recordSession`, `isFirstSession`, `getSessionDays`), batching/queue limits (R10, R11, R12, R14, R15, R16, R22, R22a, R24). The R22a override is honoured only outside production and never bypasses DNT, GPC or the toggle.
- `/api/ingest` + `validate.ts` + `posthogSink.ts` with guard/rate-limit/body/batch caps, bot drop, upstream timeout, constant 204 (R13, R23; edge cases for abuse and upstream).
- `AppProviders` client init; Biome restriction (R10); Cronitor removal from `AppProviders` and `package.json`/`bun.lock` (R21).
- `.env.example` documents all analytics env vars (R55).
- First wired event: `app_opened` (proves the pipeline end to end).
- Delivers: R10-R16, R21-R24 (client/server), R22a, R55; SC2 (route test + scrubber seed corpus scaffold), SC9, SC10.
- Checkpoint: `bun run lint:check`, `typecheck`, `test` green; targeted Playwright ingest-shape spec via override passes.

### P2: Consent controls, privacy page, error tracking, Relay telemetry

- `useAnalyticsStore` + Settings "Share anonymous usage data" toggle with DNT/GPC forced-off labelling; opt-out clears queue and deletes `rq_analytics_id`; opt-out choice added to backup `preferences.ts` allowlist (R18, R19, R40a, R48 toggle part).
- `scrub.ts` finalised; window `error`/`unhandledrejection` + `ErrorBoundary.componentDidCatch` -> `captureError()`; sink `$exception` mapping (R25, R26, R27).
- Relay telemetry sink installed (R17); `relay_tool_applied` call site added where Relay applies a change (needed by R30; see Risks).
- Privacy page rewrite, spec update, catalogue-vs-page unit test (R46, R47). Privacy claims shipped before the kill switch is ever enabled.
- Delivers: R17-R19, R25-R27, R40a (analytics part), R46, R47, R48 (toggle); SC3 (opt-out Playwright spec), SC4.

### P3: Product and landing event instrumentation

- Call sites for the remaining catalogue events with bucket helpers: request lifecycle (`request_sent`, `first_request_sent`, `sample_request_used`), save/collection/environment, chains (`chain_created`, `chain_run`), share, import, backup, command palette, shortcuts, settings (`setting_changed`) (R16 full coverage).
- Landing: `LandingAnalytics` + CTA clicks (landing events in catalogue), referrer-domain edge cases.
- Seeded-data leak test over every prop builder (SC2c).
- Delivers: R16 (all call sites), SC2, SC11 (events arriving; funnel built in P10).
- Checkpoint: leak test green; no behaviour change when analytics is off.

### P4: Prompt arbitration + analytics notice

- `usePromptStore` (priorities, preemption, re-queue, release-on-cleanup), `useAutoPromptGate` (route, open modal, first session via the P1 session tracker) (R41, R42, R43, R45, R44 partial).
- `AnalyticsNotice` (app + landing), shared dismissal flag, hidden under DNT/GPC/env-disabled (R20).
- Relay dock open path registers `relay-coach`.
- Delivers: R20, R41-R45; SC8 part (arbitration e2e spec using fake prompts or real notice + replay).
- Checkpoint: unit tests for priority/preemption/same-tick; e2e spec for notice vs. user-initiated open.

### P5: First-run tour

- `driver.js` dependency, anchors, steps, `startTour`, `TourPopover`, `useTourStore`, auto-start (desktop only; suppressed under `navigator.webdriver` unless `window.__RQ_TOUR_E2E__` is set, so existing e2e and capture runs are unaffected; a mid-tour reload restarts the tour), replay from Settings and command palette, MIN_TOUR_STEPS toast, anchor waiting, route-change destroy, i18n (en/fr/ja) (R1-R9).
- Removal of `OnboardingTour.tsx`, `useFirstTimeUser.ts`, `boarding.js`; `RelayOnboarding.tsx` untouched.
- Tour events (`tour_started`, `tour_step_viewed`, `tour_completed`, `tour_skipped`); first-visit sequence tour -> notice (R44).
- Delivers: R1-R9, R44 (full), R48 (replay); SC1, SC8 (tour e2e), plus part of SC9 (boarding.js).

### P6: Feedback

- `FeedbackDialog`, sidebar-footer item, command-palette item, `submitSurvey` + `survey sent` mapping, explicit-submit path that bypasses user consent but not env gate (R28, R29, R34).
- Eligibility, idle gate, snooze/never-ask, counters (R30-R33, R34), integrated with arbitration (R32, R43).
- Survey-availability build-time flag from `next.config.ts`.
- Delivers: R28-R34; SC5 (eligibility unit fixtures), SC3 exception (feedback while opted out).

### P7: Backup nudge

- `rq_last_backup_export` in `useBackupExport`; nudge state, thresholds, snooze, session cap, arbitration, opens `ExportBackupDialog` (R39, R40, R40a rest).
- Delivers: R39, R40, R40a.

### P8: Releases and What's New

- P8a slice (independent, can be done earlier): `release-please.yml`, config, manifest (0.1.0), `CHANGELOG.md`; docs note on repo setting and `ci.yml` limit in `CONTRIBUTING.md` (R35, R38a).
- `NEXT_PUBLIC_APP_VERSION`, highlights module (seeded with a plain-language launch entry for 0.1.0) and validation test, `WhatsNewModal`, returning-user logic, arbitration (R36, R37, R38).
- Delivers: R35-R38, R38a; SC6.

### P9: Docs, repo health, README

- Independent of code phases except wording from P2.
- `docs/CHAIN_BLOCKS.md` (new), merge shortcuts into `docs/SHORTCUTS.md`, `ROADMAP.md`, condense architecture link (R51); `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue and PR templates (R53); topics/keywords/labels via `gh` (R54).
- README rewrite following R49 order with screenshots from `public/screens/`, link-check extending `scripts/capture/verify-assets.mjs`, "Privacy & analytics" consistent with the privacy page (R49, R50, R52).
- Delivers: R49-R54; SC7.

### P10: PostHog provisioning (after P1 deployed dark; completes after production deploy)

- Via official PostHog MCP: confirm US project, create feedback survey (rating 1-5, text, email), record id, create "Launch" dashboard (activation funnel, feature usage, retention, landing -> app conversion), set Vercel env vars if CLI is linked, else manual checklist (R60, R61); fallback `POSTHOG_SETUP.md` (R62).
- Pre-merge verification: a one-off allowlisted test event, survey response and `$exception` sent through the sink arrive and render (R60). Survey and dashboard ids are recorded in `POSTHOG_SETUP.md` (`SURVEY_ID:` / `DASHBOARD_ID:` lines).
- Turning on `NEXT_PUBLIC_ANALYTICS_ENABLED=true` in Production is a post-merge manual PR step, done only once the notice, toggle and rewritten privacy page (P2, P4) are deployed.
- Delivers: R60-R62; SC12; SC11 (dashboard); confirms A1/A3/A4.

### P11: Demo video (last; needs final UI)

- `scripts/capture/demo-record.ts` (new) reusing `scripts/capture/seed.ts` and the scripted Relay stream pattern from `relay-record.ts`; Remotion composition in `scripts/capture/demo/` (new); outputs MP4 (gitignored), poster and GIF under `docs/media/` (new) (R56, R57, R58).
- README hero wires the poster/GIF; documents the manual user-attachments upload step (R59).
- Delivers: R56-R59.

### Final gate

`bun run lint:check`, `bun run typecheck`, `bun run test` plus targeted specs only (tour, arbitration, opt-out, ingest shape). Never the full e2e suite; never `bun run verify` as the gate (it mutates files) (SC8).

## 5. Requirement coverage

| Phase | Requirements | Success criteria |
|---|---|---|
| P1 | R10-R16, R21-R24, R22a, R55 | SC2, SC9 (cronitor), SC10 |
| P2 | R17-R19, R25-R27, R46-R48, R40a (opt-out) | SC3, SC4 |
| P3 | R16 (call sites), landing events | SC2, SC11 |
| P4 | R20, R41-R45 | SC8 |
| P5 | R1-R9, R44 | SC1, SC9 (boarding.js), SC8 |
| P6 | R28-R34 | SC5, SC3 |
| P7 | R39, R40, R40a | |
| P8 | R35-R38a | SC6 |
| P9 | R49-R54 | SC7 |
| P10 | R60-R62 | SC11, SC12 |
| P11 | R56-R59 | |

## 6. Risks and assumptions

- Risk: `relay_tool_applied` has no production call site today (OQ4); P2 adds it. Exact insertion point is in the Relay change-log apply path (`src/lib/relay/changeLog.ts`, existing); confirm during implementation that one emit per applied change, not per entity batch, so R30 counts correctly.
- Risk: the survey-disabled state (R29 edge case) requires server env knowledge; the plan computes a build-time boolean in `next.config.ts`, so static rendering is untouched and the disabled state is honoured (no "treat as available" fallback, which would violate R29).
- Risk: tour auto-start and the analytics notice could break existing e2e and capture runs; tour auto-start is suppressed under `navigator.webdriver` unless `__RQ_TOUR_E2E__` is set, and the notice only appears when analytics is enabled (env or R22a override).
- Risk: `relay-coach` arbitration requires hooking the dock-open path without editing `RelayOnboarding.tsx` (spec says untouched). If impossible, the smallest edit in the dock open handler is used and flagged as an advisory.
- Risk: driver.js with a React-rendered popover (custom popover render, focus trap, Esc/arrows) has integration quirks; P5 starts with a spike step to prove the popover contract before writing the steps.
- Risk: Next inlines `NEXT_PUBLIC_*` at build; the kill-switch must be set at build time in Vercel Production (documented in `.env.example` and PostHog checklist).
- Risk: PostHog `/batch` shapes for `$exception_list` and `survey sent` are from spec assumptions A3/A4, not verified in this plan; P10 verification could force sink adjustments (limited to `posthogSink.ts` by design).
- Risk: release PRs created with `GITHUB_TOKEN` do not run `ci.yml` (R38a); documented, CI untouched.
- Risk: merge-conflict hotspots (`AppProviders.tsx`, `MainLayout.tsx`, `GeneralSection.tsx`, `CommandPalette.tsx`, `messages/{en,fr,ja}/`): P2, P4, P5, P6, P7 each touch them; serialise those slices.
- Assumption: PostHog MCP authentication is the single manual user step; if unavailable at build time, P10 degrades to `POSTHOG_SETUP.md` and never blocks other phases (R62).
- Assumption: Vercel CLI linkage is unknown; env setup may become a PR checklist (R61).
- Assumption: only the E2E override path (R22a) enables the client in non-production; Playwright runs without it make zero calls (SC10).
- Assumption: new i18n keys land in the existing message files under `messages/{en,fr,ja}/` following the structure in `messages/*/index.ts`; the specific file for tour/feedback/notice copy is chosen during implementation.
- Assumption: P9 README text referencing analytics is finalised after P2 so wording matches the privacy page; demo media wiring happens after P11.
- Unresolved: exact list of allowlisted shortcut ids and setting ids for `shortcut_used`/`setting_changed` is not enumerated in the spec; derive from `src/app/settings/constants.ts` (existing, `ShortcutGroup` types) during P3.
