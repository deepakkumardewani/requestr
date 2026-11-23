# Tasks: launch-readiness

Inputs: `SPEC.md` (authoritative, ids R1-R62 plus R22a, R38a, R40a and SC1-SC12), `PLAN.md` (Phases P1-P11, mapped 1:1 to Phase 1-11 below), `REPO_MAP.md`, `INTERVIEW.md`. Planning artifact only; no feature code is written by this document. Commands: `bun`/`bunx` only, never `npm`. Never start the dev server (always running at `https://requestly.localhost/app`). Branch: `feature/launch-readiness`. Task-authoring rules: `~/.claude/docs/task-conventions.md`.

## Conventions

- **Kinds.** `implementation` (source plus the existing colocated specs it breaks; no new specs), `unit` (unit-test-engineer), `e2e` (e2e-engineer), `gate`, `walkthrough`, `dod`. Order in a phase: implementation, `Unit:`, `E2E:`, checkpoint.
- **Harness.** The project already has Playwright, Vitest, the seeded `e2e/qa/` harness and `E2E_SERVER` prod-server mode, so no Phase 0 setup task is needed. E2E specs live in `e2e/qa/launch-readiness/<area>.spec.ts`, run only targeted: `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test <spec> --repeat-each=3`. Never the full suite; never `bun run verify` as a gate (it mutates files).
- **Unit acceptance (every `Unit:` task).** Every listed file reaches >= 80% lines, branches, functions and statements (target > 95%); no `.skip`, `.only`, `it.fails` unless the source has a real bug. Verify: `bunx vitest run <specs> --coverage --coverage.include=<src files> --coverage.reporter=text`.
- **i18n.** Locales `en`, `fr`, `ja`. New strings go to all three in the same task, in the existing namespaces `messages/{en,fr,ja}/common.json` or `settings.json` (each counts as three files).
- **Project rules.** No tests under `src/components/reactbits/`. Zustand stores in `src/stores/use<Name>Store.ts`. All `localStorage` access in try/catch with in-memory fallback. Functions under about 30 lines, named constants, no silent catches. UI tasks use the `impeccable` skill (never `frontend-design`).
- **Analytics ships dark.** `NEXT_PUBLIC_ANALYTICS_ENABLED` defaults off; nothing in Phases 1-9 sends to PostHog in production until the deliberate switch in T10.6.
- **PostHog MCP.** Phase 10 provisioning tasks need the PostHog MCP connected (`claude mcp add --transport http posthog https://mcp.posthog.com/mcp`, one user auth). Each has a documented manual fallback in `POSTHOG_SETUP.md` and never blocks other phases.
- **E2E analytics override.** Playwright sets `navigator.webdriver` and the dev server runs with `NODE_ENV=development` and the kill switch off, so analytics (and the analytics notice) are off in e2e by default. Any scenario that asserts something is or is not sent, or that the notice shows, sets `window.__RQ_ANALYTICS_E2E__ = true` via `addInitScript` and intercepts `/api/ingest` with `page.route`; otherwise "sends nothing" passes vacuously. The override is ignored in production builds, so these specs run against the dev server, not `E2E_SERVER=prod`. Tour auto-start is likewise suppressed under `navigator.webdriver` unless `window.__RQ_TOUR_E2E__ = true` is set (T5.4), so existing suites see no overlay.
- **Phase 10 and 11 kinds.** Phase 10 tasks are external operations (PostHog MCP, Vercel) and stay `gate`. Phase 11 is dev-only tooling under `scripts/capture/` (not shipped app code); its tasks stay `gate`, but every Verify executes the tooling (record, render, size check) so the gate proves behaviour, not just file existence.
- **Manual user steps (not automated).** PostHog MCP auth; enabling "Allow GitHub Actions to create and approve pull requests"; the demo video GitHub user-attachments upload; Vercel env vars when the CLI is not linked.

---

## Phase 1: Analytics foundation

**Adds:** A privacy-first analytics pipeline with no UI: a typed event allowlist, a swappable client adapter and a same-origin `/api/ingest` route that forwards to PostHog from the server only. Cronitor is removed; everything stays off until the kill switch is turned on.
**Try in UI:** No UI in this phase. Run `bunx vitest run src/app/api/ingest/route.spec.ts` and confirm the route tests pass ; Open `.env.example` and confirm the four analytics variables are documented ; Run `grep -rn cronitor package.json src` and confirm nothing is found.

### ✅ T1.1 ☐ Event map and allowlist
- **Kind:** implementation
- **Spec:** R15, R16
- **Risk:** high
- **Surfaces:** security, logic
- **Files:** `src/lib/analytics/events.ts` (new)
- **Creates:** `EventMap`, `COMMON_PROPS`, `EVENT_ALLOWLIST`, `bucketDuration`, `bucketCount`
- **Do:** Define the typed `EventMap` for every catalogue event in SPEC with its allowed props, the allowlisted common props (`app_version`, `locale`, `viewport_class`, `session_day_index`, `theme`), enum value lists, string max-length constants, and pure bucket helpers. Export an `EVENT_ALLOWLIST` runtime structure derived from the same definitions, usable on client and server.
- **Acceptance:**
  - Calling a not-yet-defined event or prop fails typecheck.
  - `EVENT_ALLOWLIST` lists exactly the catalogue events, `$exception` and the survey event, with per-event allowed prop names.
  - Bucket helpers return only the catalogue bucket strings.
- **Verify:** `bun run typecheck`
- **Depends on:** none

### ✅ T1.2 ☐ Consent, analytics id, dedupe, session tracker
- **Kind:** implementation
- **Spec:** R14, R22, R22a, R18
- **Risk:** high
- **Surfaces:** security, logic
- **Files:** `src/lib/analytics/consent.ts` (new), `src/lib/analytics/analyticsId.ts` (new), `src/lib/analytics/dedupe.ts` (new), `src/lib/prompts/sessionTracker.ts` (new)
- **Creates:** `resolveConsent`, `getAnalyticsId`, `clearAnalyticsId`, `shouldSendOnce`, `__RQ_ANALYTICS_E2E__`, `recordSession`, `isFirstSession`, `getSessionDays`
- **Do:** `resolveConsent(env)` is pure and returns `{enabled, reason}` from `NEXT_PUBLIC_ANALYTICS_ENABLED`, `NODE_ENV`, `navigator.webdriver`, DNT (`navigator.doNotTrack === "1"`), GPC, the store toggle (passed in) and the e2e override flag `window.__RQ_ANALYTICS_E2E__`. Precedence (R22a): the override is honoured only when `NODE_ENV !== "production"`; when honoured it bypasses the env-flag, `NODE_ENV` and webdriver gates, but never DNT, GPC or the toggle. `analyticsId.ts` stores a random UUID in `rq_analytics_id` (try/catch, memory fallback), never reading `rq_anon_id`; `clearAnalyticsId` deletes it. `dedupe.ts` offers one-shot-ever and per-session once/cap helpers. `sessionTracker.ts` records local-date strings of session days in localStorage (try/catch, memory fallback), ignores future-dated entries and is independent of analytics consent; it is created here because `app_opened` and the `session_day_index` common prop need it (prompts and feedback reuse it later).
- **Acceptance:**
  - Disabled with a named reason for each of: env off, development, test, webdriver, DNT, GPC, toggle off.
  - The override enables only outside production and never in a production build; with the override set, DNT, GPC or toggle off still disable.
  - The id is a UUID, regenerates after `clearAnalyticsId`, and is independent of `rq_anon_id`.
  - localStorage failure falls back to memory without throwing.
  - `isFirstSession` is true only on the first recorded day; future-dated entries are ignored.
- **Verify:** `bun run typecheck`
- **Depends on:** T1.1

### ✅ T1.3 ☐ Adapter, noop and HTTP client
- **Kind:** implementation
- **Spec:** R11, R12, R24, R22
- **Risk:** high
- **Surfaces:** logic, security
- **Files:** `src/lib/analytics/adapter.ts` (new), `src/lib/analytics/noopAdapter.ts` (new), `src/lib/analytics/httpAdapter.ts` (new)
- **Creates:** `AnalyticsAdapter`, `track`, `captureError`, `submitSurvey`, `setEnabled`, `initAnalytics`, `createHttpAdapter`, `noopAdapter`
- **Uses:** `resolveConsent`, `getAnalyticsId`, `shouldSendOnce`, `EventMap`, `getSessionDays`
- **Do:** `adapter.ts` exposes the `AnalyticsAdapter` interface and module-level `track`/`captureError`/`submitSurvey`/`setEnabled`, SSR-safe (no-op without `window`), with an `initAnalytics` that picks noop or HTTP once. `httpAdapter.ts` queues in memory (capped), attaches common props, batches JSON to `/api/ingest` on interval, batch size and `pagehide` via `navigator.sendBeacon`, applies a per-session cap, offline queue with flush on reconnect, max 1 retry with backoff then drop, logs a failure once at debug level. Errors inside the module are logged and never re-captured. `submitSurvey` sends via a distinct path that skips the user-consent gate (toggle/DNT/GPC) but not the env gate and carries no analytics id and only `app_version`.
- **Acceptance:**
  - With analytics disabled all calls are no-ops with no console errors and no network.
  - Batches flush on interval, size and `pagehide`; the queue never exceeds its cap; a blocked route causes at most one retry.
  - No call sets a cookie or loads a script.
- **Verify:** `bun run typecheck`
- **Depends on:** T1.2

### ✅ T1.4 ☐ Server validation and PostHog sink
- **Kind:** implementation
- **Spec:** R11, R12, R13
- **Risk:** high
- **Surfaces:** security, logic
- **Files:** `src/lib/analytics/server/validate.ts` (new), `src/lib/analytics/server/posthogSink.ts` (new)
- **Creates:** `validateBatch`, `AnalyticsSink`, `posthogSink`
- **Uses:** `EVENT_ALLOWLIST`
- **Do:** `validate.ts` drops unknown events and props using `EVENT_ALLOWLIST`, enforces the per-prop string max length and drops oversize events. `posthogSink.ts` is the only file that knows PostHog: builds the `/batch` payload from `POSTHOG_KEY`/`POSTHOG_HOST`, sets `$ip: null` and `$geoip_disable: true` on every event, maps error records to `$exception` with `$exception_list`, maps survey submissions to `survey sent` with `$survey_id` (from `POSTHOG_FEEDBACK_SURVEY_ID`) and `$survey_response_<question_id>` props, uses `fetch` with a timeout constant, logs status only.
- **Acceptance:**
  - Unknown event names and props never reach the sink.
  - Every forwarded event has `$geoip_disable: true`, `$ip: null` and no client IP.
  - Upstream failure or timeout resolves without throwing and without logging payload.
  - No other file imports PostHog wire details.
- **Verify:** `bun run typecheck`
- **Depends on:** T1.1

### ✅ T1.5 ☐ `/api/ingest` route
- **Kind:** implementation
- **Spec:** R13, R22, R23
- **Risk:** high
- **Surfaces:** security
- **Files:** `src/app/api/ingest/route.ts` (new), `src/lib/relay/server/guard.ts` (edit), `src/lib/relay/server/rateLimit.ts` (edit), `src/lib/relay/server/bodyLimit.ts` (edit)
- **Creates:** `/api/ingest`, `POST`
- **Uses:** `validateBatch`, `posthogSink`, `readBodyWithLimit`, `isSameOrigin`
- **Do:** Implement `POST` per PLAN 1.1: same-origin check, body-size cap via `readBodyWithLimit`, per-IP rate limit reusing the relay rate-limit pattern with a hashed expiring key (IP never logged or forwarded), max events per batch, bot-UA drop without storing the UA, JSON parse (400 on malformed), `validateBatch`, then the sink. Return 204 for accepted, dropped, upstream-failed and disabled (`NEXT_PUBLIC_ANALYTICS_ENABLED !== "true"` or missing `POSTHOG_KEY`/`POSTHOG_HOST`: 204 without forwarding). Never echo the payload. Touch the three relay server files only if a small generic export is needed; otherwise leave them unchanged.
- **Acceptance:**
  - Malformed JSON returns 400; everything else returns 204.
  - Disabled env, rate-limited, bot and foreign-origin requests never reach `fetch`.
  - Forwarded requests carry no `X-Forwarded-For` or client IP.
- **Verify:** `bun run typecheck`
- **Depends on:** T1.4

### ✅ T1.6 ☐ Provider init, Cronitor removal, `app_opened`
- **Kind:** implementation
- **Spec:** R21, R12, R22
- **Risk:** medium
- **Surfaces:** logic
- **Files:** `src/providers/AppProviders.tsx` (edit), `src/providers/AppProviders.spec.tsx` (edit), `package.json` (edit), `bun.lock` (edit), `src/app/app/page.tsx` (edit)
- **Uses:** `initAnalytics`, `track`, `recordSession`, `getSessionDays`
- **Do:** Remove `useCronitor`/`CronitorTracker` from `AppProviders.tsx` and `@cronitorio/cronitor-rum-nextjs` from `package.json` via `bun remove`. Call `recordSession` and `initAnalytics` in a client effect only. Fire `app_opened` (with `is_first_session` and `days_since_last_bucket`) once per page session on `/app`. Update `AppProviders.spec.tsx`.
- **Acceptance:**
  - `grep -rn cronitor package.json bun.lock src` finds nothing.
  - `app_opened` is queued once per page session and is a no-op when analytics is disabled.
- **Verify:** `bunx vitest run src/providers/AppProviders.spec.tsx` ; `grep -rn "cronitor" package.json bun.lock src` (expect no output)
- **Depends on:** T1.3

### ✅ T1.7 ☐ Env docs and import boundary rule
- **Kind:** implementation
- **Spec:** R10, R55
- **Risk:** low
- **Surfaces:** security
- **Files:** `.env.example` (edit), `biome.json` (edit)
- **Do:** Document `NEXT_PUBLIC_ANALYTICS_ENABLED` (kill switch, default off, Production only, build-time inlined), `POSTHOG_KEY` (public, server-only), `POSTHOG_HOST` (US `https://us.i.posthog.com` launch value, EU `https://eu.i.posthog.com` possible), `POSTHOG_FEEDBACK_SURVEY_ID` with comments. Add a Biome `noRestrictedImports` rule forbidding any `posthog` import and imports of `src/lib/analytics/server/*` outside `src/lib/analytics/` and `src/app/api/ingest/` (via an override for those paths).
- **Acceptance:**
  - `.env.example` has all four variables with comments.
  - `bun run lint:check` passes on the repo.
- **Verify:** `bun run lint:check`
- **Depends on:** T1.5

### ✅ T1.8 ☐ Unit: event map, consent, id, dedupe, session tracker
- **Kind:** unit
- **Spec:** R10, R14, R15, R22, R22a
- **Risk:** medium
- **Surfaces:** security, logic
- **Files:** `src/lib/analytics/events.ts` (edit), `src/lib/analytics/consent.ts` (edit), `src/lib/analytics/analyticsId.ts` (edit), `src/lib/analytics/dedupe.ts` (edit), `src/lib/prompts/sessionTracker.ts` (edit), `src/lib/analytics/importBoundary.spec.ts` (new)
- **Do:** Write `events.spec.ts`, `consent.spec.ts`, `analyticsId.spec.ts`, `dedupe.spec.ts`, `sessionTracker.spec.ts` beside the sources. Also write `src/lib/analytics/importBoundary.spec.ts` scanning `src/` and asserting no PostHog import and no `analytics/server/*` import outside the allowed folders (R10 backstop).
- **Acceptance:** Per-file coverage >= 80%; consent matrix covers every reason incl. the override in production and the override never bypassing DNT/GPC/toggle; id lifecycle covers opt-out clear and regenerate; session tracker covers first session, future dates and storage failure; boundary scan fails on a seeded violation fixture.
- **Verify:** `bunx vitest run src/lib/analytics/events.spec.ts src/lib/analytics/consent.spec.ts src/lib/analytics/analyticsId.spec.ts src/lib/analytics/dedupe.spec.ts src/lib/prompts/sessionTracker.spec.ts src/lib/analytics/importBoundary.spec.ts --coverage --coverage.include=src/lib/analytics/events.ts --coverage.include=src/lib/analytics/consent.ts --coverage.include=src/lib/analytics/analyticsId.ts --coverage.include=src/lib/analytics/dedupe.ts --coverage.include=src/lib/prompts/sessionTracker.ts --coverage.reporter=text`
- **Depends on:** T1.7

### ✅ T1.9 ☐ Unit: adapter and HTTP client
- **Kind:** unit
- **Spec:** R11, R24
- **Risk:** low
- **Surfaces:** logic
- **Files:** `src/lib/analytics/adapter.ts` (edit), `src/lib/analytics/httpAdapter.ts` (edit), `src/lib/analytics/noopAdapter.ts` (edit)
- **Do:** Write `adapter.spec.ts`, `httpAdapter.spec.ts`, `noopAdapter.spec.ts`: batching triggers, caps, offline queue, single retry, `sendBeacon` on pagehide, SSR no-op, survey path without id and with only `app_version`, no `document.cookie` write and no script injection (R12).
- **Acceptance:** Per-file coverage >= 80%; no network when disabled; recursion guard proven; no cookie set and no script element added.
- **Verify:** `bunx vitest run src/lib/analytics/adapter.spec.ts src/lib/analytics/httpAdapter.spec.ts src/lib/analytics/noopAdapter.spec.ts --coverage --coverage.include=src/lib/analytics/adapter.ts --coverage.include=src/lib/analytics/httpAdapter.ts --coverage.include=src/lib/analytics/noopAdapter.ts --coverage.reporter=text`
- **Depends on:** T1.8

### ✅ T1.10 ☐ Unit: ingest route, validate and sink
- **Kind:** unit
- **Spec:** R13, R22a, R23
- **Risk:** high
- **Surfaces:** security
- **Files:** `src/app/api/ingest/route.ts` (edit), `src/lib/analytics/server/validate.ts` (edit), `src/lib/analytics/server/posthogSink.ts` (edit)
- **Do:** Write `route.spec.ts` (pattern of `src/app/api/proxy/route.spec.ts`), `validate.spec.ts`, `posthogSink.spec.ts` with a mocked `fetch`. Cover SC2(a): allowlisted events forwarded to `/batch` with `$geoip_disable: true`, no IP, unknown events/props dropped; 400 on malformed JSON; 204 without any `fetch` when disabled (env flag off or missing `POSTHOG_KEY`/`POSTHOG_HOST`), including requests that carry any client-side e2e override marker (R22a: the override never enables server forwarding); rate limit, body cap, batch cap, bot UA, cross-origin; upstream failure still 204; IP and UA never logged; `$exception_list` and `survey sent` shapes.
- **Acceptance:** Per-file coverage >= 80%; no test asserts payload echo; the disabled-env case proves `fetch` is never called.
- **Verify:** `bunx vitest run src/app/api/ingest/route.spec.ts src/lib/analytics/server/validate.spec.ts src/lib/analytics/server/posthogSink.spec.ts --coverage --coverage.include=src/app/api/ingest/route.ts --coverage.include=src/lib/analytics/server/validate.ts --coverage.include=src/lib/analytics/server/posthogSink.ts --coverage.reporter=text`
- **Depends on:** T1.8

### ✅ T1.11 ☐ E2E: ingest payload shape and no-send defaults
- **Kind:** e2e
- **Scenarios:**
  - `@critical` with the e2e override, `app_opened` posts to `/api/ingest` and the payload matches the allowlist shape with no URL or IP (SC2b)
  - `@critical` without the override, `/app` makes zero requests to `/api/ingest` (SC10)
  - `@high` with the override, the browser makes no request to any PostHog host and sets no cookie (R12; server-side forwarding is proven in T1.10)
- **Spec:** `e2e/qa/launch-readiness/analytics-ingest.spec.ts`, R22a, R12
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/launch-readiness/analytics-ingest.spec.ts` (new), `agent_docs/qa/analytics-ingest/` (new, proof screenshots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/analytics-ingest.spec.ts --repeat-each=3`
- **Depends on:** T1.6

🔶 **Checkpoint 1**: `bun run lint:check`, `bun run typecheck`, `bun run test` green; ingest e2e spec green; no Cronitor reference remains (SC9 part, SC10).

---

## Phase 2: Consent controls, privacy page, error tracking, Relay telemetry

**Adds:** A "Share anonymous usage data" switch in Settings that honours Do-Not-Track and Global Privacy Control, a rewritten privacy page listing exactly what is collected, scrubbed error reports, and Relay telemetry folded into the same pipeline.
**Try in UI:** Open Settings -> General and toggle "Share anonymous usage data" off then on ; Open `/privacy` and read the collected-data list ; Trigger a render error and confirm the fallback UI is unchanged.

### ✅ T2.1 ☐ Analytics store, toggle and backup preference
- **Kind:** implementation
- **Spec:** R19, R48, R40a, R18
- **Risk:** high
- **Surfaces:** ui, logic, security
- **Files:** `src/stores/useAnalyticsStore.ts` (new), `src/components/settings/GeneralSection.tsx` (edit), `src/components/settings/GeneralSection.spec.tsx` (edit), `src/lib/backup/preferences.ts` (edit), `src/lib/backup/preferences.spec.ts` (edit)
- **Creates:** `useAnalyticsStore`, `BACKUP_PREFERENCE_KEYS` entry for the analytics opt-out key
- **Uses:** `setEnabled`, `clearAnalyticsId`, `resolveConsent`, `BACKUP_PREFERENCE_KEYS`
- **Do:** Run the `impeccable` skill for the toggle row, then implement. The store persists the toggle (serializable, persist in actions). Turning it off calls `setEnabled(false)`, clears the in-memory queue and deletes `rq_analytics_id`; turning it on generates a new id. Under DNT/GPC the toggle is forced off, disabled and labelled with an explanation. Add the opt-out storage key to `BACKUP_PREFERENCE_KEYS`; `rq_analytics_id`, feedback counters, snoozes and `rq_last_backup_export` stay out of the allowlist. Add i18n keys to `settings.json` in all three locales in T2.2.
- **Acceptance:**
  - Toggling off stops capture in the same session and removes `rq_analytics_id`.
  - DNT/GPC forces the toggle off with a visible reason.
  - The opt-out choice is carried by backup preferences; the other new keys are not.
- **Verify:** `bunx vitest run src/components/settings/GeneralSection.spec.tsx src/lib/backup/preferences.spec.ts`
- **Depends on:** T1.6

### ✅ T2.2 ☐ Settings toggle copy (i18n)
- **Kind:** implementation
- **Spec:** R19, R18
- **Risk:** low
- **Surfaces:** ui
- **Files:** `messages/en/settings.json` (edit), `messages/fr/settings.json` (edit), `messages/ja/settings.json` (edit)
- **Do:** Add label, description, DNT/GPC forced-off explanation and disabled-by-environment strings for the analytics toggle in en/fr/ja.
- **Acceptance:** Keys exist in all three locales and the existing message parity spec stays green.
- **Verify:** `bunx vitest run src/i18n`
- **Depends on:** T2.1

### ✅ T2.3 ☐ Scrubber
- **Kind:** implementation
- **Spec:** R26
- **Risk:** high
- **Surfaces:** security, logic
- **Files:** `src/lib/analytics/scrub.ts` (new)
- **Creates:** `scrubError`, `ScrubbedError`
- **Do:** Pure function turning an error plus a source into a neutral record: message truncated, URLs/hosts/query strings, header-like and `Bearer`/token patterns and env-value substrings redacted; stack frames keep only file:line; no component props, component stack text or breadcrumbs.
- **Acceptance:** A corpus of seeded request data (URLs, hosts, headers, tokens, bodies) embedded in error messages and stacks never survives scrubbing.
- **Verify:** `bun run typecheck`
- **Depends on:** T1.1

### ✅ T2.4 ☐ Error capture wiring
- **Kind:** implementation
- **Spec:** R25, R27
- **Risk:** high
- **Surfaces:** security, logic
- **Files:** `src/lib/analytics/adapter.ts` (edit), `src/providers/AppProviders.tsx` (edit), `src/providers/AppProviders.spec.tsx` (edit), `src/components/common/ErrorBoundary.tsx` (edit), `src/components/common/ErrorBoundary.spec.tsx` (edit)
- **Uses:** `captureError`, `scrubError`, `shouldSendOnce`
- **Do:** Register `window` `error` and `unhandledrejection` handlers in the provider client effect and call `captureError` from `ErrorBoundary.componentDidCatch` with source `boundary`. Dedupe by fingerprint once per session, cap per session, respect opt-out/DNT/GPC/env, and never re-capture errors thrown inside the analytics module. The ErrorBoundary fallback UI is unchanged.
- **Acceptance:**
  - Each of window error, unhandled rejection and boundary crash yields exactly one capture.
  - No capture when disabled; the same fingerprint is sent at most once per session.
- **Verify:** `bunx vitest run src/components/common/ErrorBoundary.spec.tsx src/providers/AppProviders.spec.tsx`
- **Depends on:** T2.3, T1.6

### ✅ T2.5 ☐ Relay telemetry sink and `relay_tool_applied`
- **Kind:** implementation
- **Spec:** R17
- **Risk:** high
- **Surfaces:** security, logic
- **Files:** `src/lib/relay/telemetry.ts` (edit), `src/lib/relay/telemetry.spec.ts` (edit), `src/lib/relay/changeLog.ts` (edit), `src/lib/relay/changeLog.spec.ts` (edit), `src/providers/AppProviders.tsx` (edit)
- **Creates:** `relayTelemetryToTrack`
- **Uses:** `setRelayTelemetrySink`, `RelayEventMap`, `track`
- **Do:** Install a telemetry sink via `setRelayTelemetrySink` in the provider effect that maps `RelayEventMap` events to `relay_*` catalogue events (length bucketed, entity/code/mode as enums, text never sent) while still dispatching the `relay:telemetry` DOM event. Emit `relay_tool_applied` once per applied change (not per entity batch) in the change-log apply path so R30 counts correctly.
- **Acceptance:**
  - The DOM event still fires; a matching analytics event is queued when enabled.
  - `relay_tool_applied` fires once per applied change.
  - No forwarded prop contains message text, prompt, response or entity names (only buckets and enums).
- **Verify:** `bunx vitest run src/lib/relay/telemetry.spec.ts src/lib/relay/changeLog.spec.ts`
- **Depends on:** T2.4

### ✅ T2.6 ☐ Privacy page rewrite
- **Kind:** implementation
- **Spec:** R46
- **Risk:** medium
- **Surfaces:** ui
- **Files:** `src/app/privacy/page.tsx` (edit), `src/app/privacy/page.spec.tsx` (edit)
- **Do:** Run `impeccable` for readability, then remove both no-analytics claims (about lines 36 and 109) and list exactly: collected events (rendered from `EVENT_ALLOWLIST`), never collected, the anonymous analytics id (separate from the rate-limit id), no cookies, IP stripped and geo-IP disabled, PostHog as processor with the US region, opt-out via toggle/DNT/GPC, feedback text/email sent as written (email is the only PII, only if entered), error reports. Update `page.spec.tsx`.
- **Acceptance:** The old claims are gone; each required topic appears; the spec passes.
- **Verify:** `bunx vitest run src/app/privacy/page.spec.tsx`
- **Depends on:** T2.1

### ✅ T2.7 ☐ Unit: stores, scrubber, error capture and catalogue-vs-page
- **Kind:** unit
- **Spec:** R19, R25, R26, R27, R47
- **Risk:** high
- **Surfaces:** security
- **Files:** `src/stores/useAnalyticsStore.ts` (edit), `src/lib/analytics/scrub.ts` (edit), `src/lib/relay/telemetry.ts` (edit), `src/lib/analytics/adapter.ts` (edit), `src/components/common/ErrorBoundary.tsx` (edit)
- **Do:** Write `useAnalyticsStore.spec.ts` and `scrub.spec.ts` (including the SC2 seeded-corpus no-leak test) beside the sources, and extend `telemetry.spec.ts`, `adapter.spec.ts` (error capture added in T2.4: fingerprint dedupe once per session, per-session cap, no capture when opted out, errors inside the analytics module never re-captured) and `ErrorBoundary.spec.tsx` (a boundary crash yields exactly one `captureError` with source `boundary`; fallback UI unchanged). Write `src/app/privacy/catalogue.spec.ts` asserting every event name in `EVENT_ALLOWLIST` appears on the privacy page output (R47).
- **Acceptance:** Per-file coverage >= 80%; the corpus test fails if a URL, host, header, token or env value survives; each SC4 source yields exactly one capture and none when opted out; the catalogue test fails when an event is missing from the page.
- **Verify:** `bunx vitest run src/stores/useAnalyticsStore.spec.ts src/lib/analytics/scrub.spec.ts src/lib/relay/telemetry.spec.ts src/lib/analytics/adapter.spec.ts src/components/common/ErrorBoundary.spec.tsx src/app/privacy/catalogue.spec.ts --coverage --coverage.include=src/stores/useAnalyticsStore.ts --coverage.include=src/lib/analytics/scrub.ts --coverage.include=src/lib/relay/telemetry.ts --coverage.include=src/lib/analytics/adapter.ts --coverage.include=src/components/common/ErrorBoundary.tsx --coverage.reporter=text`
- **Depends on:** T2.6, T2.5

### ✅ T2.8 ☐ E2E: opt-out sends nothing
- **Kind:** e2e
- **Scenarios:**
  - `@critical` with the override enabled and DNT=1, no `/api/ingest` request is made (SC3)
  - `@critical` with the override enabled and GPC=1, no `/api/ingest` request is made (SC3)
  - `@critical` with the override enabled, toggling "Share anonymous usage data" off in Settings stops requests in the same session and `rq_analytics_id` is removed (SC3)
  - `@high` the toggle shows disabled with an explanation under DNT
  - `@high` with the override, an uncaught page error produces exactly one `$exception` batch entry with no URL in the message (SC4)
  - `@high` with the override, an unhandled promise rejection produces exactly one `$exception` entry (SC4)
  - `@high` with the override and the toggle off, an uncaught page error produces no `/api/ingest` request (SC4)
- **Spec:** `e2e/qa/launch-readiness/analytics-optout.spec.ts`, R18, R19, R25, R27
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/launch-readiness/analytics-optout.spec.ts` (new)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/analytics-optout.spec.ts --repeat-each=3`
- **Depends on:** T2.7

🔶 **Checkpoint 2**: Toggle, DNT/GPC, scrubbed errors, Relay events and the privacy page are in place; `bun run lint:check`, `bun run typecheck`, `bun run test` and the opt-out spec green (SC3, SC4).

---

## Phase 3: Product and landing event instrumentation

**Adds:** Every remaining catalogue event is wired with safe, bucketed props, including landing-page views and "Open app" clicks, with no change in behaviour when analytics is off.
**Try in UI:** With analytics off, send a request, save it and create a chain and confirm the app behaves exactly as before ; Open the landing page and click an "Open app" button and confirm it still navigates ; Inspect the network tab and confirm no ingest request is made in dev.

### ✅ T3.1 ☐ Prop builders
- **Kind:** implementation
- **Spec:** R16
- **Risk:** high
- **Surfaces:** security, logic
- **Files:** `src/lib/analytics/propBuilders.ts` (new), `src/lib/analytics/events.ts` (edit)
- **Creates:** `buildRequestSentProps`, `buildChainRunProps`, `buildLandingProps`, `referrerDomain`, `landingPathEnum`
- **Uses:** `bucketDuration`, `bucketCount`
- **Do:** One pure builder per instrumented event that takes domain objects and returns only allowlisted props: method enum (non-standard to `other`), `status_class`, `duration_bucket`, node-count buckets, landing `path` enum (unknown to `other`, never query/hash), `referrerDomain` (hostname only, lowercased; same-site, empty or invalid to `direct`; IP-literal or `localhost` to `other`). Derive `shortcut_id` and `setting_id` enums from `src/app/settings/constants.ts`.
- **Acceptance:** Builders accept seeded request data and their output contains only allowlisted props with enum or bucket values.
- **Verify:** `bun run typecheck`
- **Depends on:** T1.1

### ✅ T3.2 ☐ Request lifecycle events
- **Kind:** implementation
- **Spec:** R16
- **Risk:** high
- **Surfaces:** security, logic
- **Files:** `src/hooks/useSendRequest.ts` (edit), `src/hooks/useSendRequest.spec.ts` (edit), `src/components/common/SampleRequestCards.tsx` (edit), `src/hooks/useSaveRequest.ts` (edit), `src/hooks/useSaveRequest.spec.ts` (edit)
- **Uses:** `track`, `buildRequestSentProps`, `shouldSendOnce`
- **Do:** Emit `request_sent` on completion (source `manual|sample|history|chain|relay`), `first_request_sent` once ever per browser, `sample_request_used`, and `request_saved`. Keep the local feedback counters out of this path (they are separate, T6.2).
- **Acceptance:** Events carry only builder props; behaviour and existing specs unchanged when analytics is disabled.
- **Verify:** `bunx vitest run src/hooks/useSendRequest.spec.ts src/hooks/useSaveRequest.spec.ts`
- **Depends on:** T3.1, T1.6

### ✅ T3.3 ☐ Collection and environment events
- **Kind:** implementation
- **Spec:** R16
- **Risk:** medium
- **Surfaces:** security, logic
- **Files:** `src/stores/useCollectionsStore.ts` (edit), `src/stores/useCollectionsStore.spec.ts` (edit), `src/stores/useEnvironmentsStore.ts` (edit), `src/stores/useEnvironmentsStore.spec.ts` (edit)
- **Uses:** `track`, `bucketCount`
- **Do:** Emit `collection_created`, `environment_created` (variable-count bucket) and `environment_switched` at the store actions that perform them; no names or values in props.
- **Acceptance:** Each event fires once per action with allowlisted props only; store specs green.
- **Verify:** `bunx vitest run src/stores/useCollectionsStore.spec.ts src/stores/useEnvironmentsStore.spec.ts`
- **Depends on:** T3.1

### ✅ T3.4 ☐ Chain events
- **Kind:** implementation
- **Spec:** R16
- **Risk:** medium
- **Surfaces:** security, logic
- **Files:** `src/stores/useChainStore.ts` (edit), `src/stores/useChainStore.spec.ts` (edit), `src/hooks/useChainRun.ts` (edit), `src/hooks/useChainRun.spec.ts` (edit)
- **Uses:** `track`, `buildChainRunProps`
- **Do:** Emit `chain_created` (source `manual|relay|import`) and `chain_run` at run end (status, node-count bucket, duration bucket, `has_loop`, `has_subchain`); no chain or node names.
- **Acceptance:** One `chain_run` per run end including failed and stopped; specs green.
- **Verify:** `bunx vitest run src/stores/useChainStore.spec.ts src/hooks/useChainRun.spec.ts`
- **Depends on:** T3.1

### ✅ T3.5 ☐ Share and import events
- **Kind:** implementation
- **Spec:** R16
- **Risk:** high
- **Surfaces:** security, logic
- **Files:** `src/components/request/ShareModal.tsx` (edit), `src/components/request/ShareModal.spec.tsx` (edit), `src/lib/shareLink.ts` (edit), `src/lib/shareLink.spec.ts` (edit), `src/components/import/ImportDialog.tsx` (edit)
- **Uses:** `track`, `bucketCount`
- **Do:** Emit `share_created` (expiry bucket only; no id, URL or key), `share_opened` where an incoming share link is resolved (start from `shareLink.ts` and grep for its caller), and `import_completed` (source type, item-count bucket).
- **Acceptance:** No share id, URL or key appears in any prop; specs green.
- **Verify:** `bunx vitest run src/components/request/ShareModal.spec.tsx src/lib/shareLink.spec.ts`
- **Depends on:** T3.1

### ✅ T3.6 ☐ Backup, palette, shortcut and setting events
- **Kind:** implementation
- **Spec:** R16
- **Risk:** low
- **Surfaces:** logic
- **Files:** `src/components/settings/backup/useBackupExport.ts` (edit), `src/components/settings/backup/useBackupImport.ts` (edit), `src/components/common/CommandPalette.tsx` (edit), `src/components/common/CommandPalette.spec.tsx` (edit), `src/hooks/useKeyboardShortcuts.ts` (edit)
- **Uses:** `track`, `bucketCount`
- **Do:** Emit `backup_exported` (mode, size bucket), `backup_imported` (mode), `command_palette_opened`, and `shortcut_used` for allowlisted shortcut ids only. Settings changes (`setting_changed`, boolean/enum only, never the analytics toggle) are emitted from `GeneralSection.tsx` in T3.7.
- **Acceptance:** Events carry enums/buckets only; the palette spec stays green.
- **Verify:** `bunx vitest run src/components/common/CommandPalette.spec.tsx src/hooks/useKeyboardShortcuts.spec.ts`
- **Depends on:** T3.1

### ✅ T3.7 ☐ Setting-changed events
- **Kind:** implementation
- **Spec:** R16
- **Risk:** medium
- **Surfaces:** security, logic
- **Files:** `src/components/settings/GeneralSection.tsx` (edit), `src/components/settings/GeneralSection.spec.tsx` (edit), `src/components/settings/AppearanceSection.tsx` (edit), `src/components/settings/AppearanceSection.spec.tsx` (edit)
- **Uses:** `track`
- **Do:** Emit `setting_changed` with an enum `setting_id` and `value_kind` for allowlisted settings only; never for the analytics toggle and never with free text.
- **Acceptance:** The analytics toggle emits nothing; other allowlisted settings emit once per change.
- **Verify:** `bunx vitest run src/components/settings/GeneralSection.spec.tsx src/components/settings/AppearanceSection.spec.tsx`
- **Depends on:** T3.6, T2.1

### ✅ T3.8 ☐ Landing analytics
- **Kind:** implementation
- **Spec:** R16
- **Risk:** high
- **Surfaces:** security, logic
- **Files:** `src/components/landing/LandingAnalytics.tsx` (new), `src/components/landing/PrimaryCta.tsx` (edit), `src/components/landing/nav/LandingNav.tsx` (edit), `src/components/landing/sections/FinalCta.tsx` (edit), `src/app/(home)/layout.tsx` (edit)
- **Creates:** `LandingAnalytics`
- **Uses:** `track`, `buildLandingProps`, `initAnalytics`
- **Do:** A small client component fires `landing_viewed` once per load (path enum, referrer domain); CTA components fire `landing_cta_clicked` with a `cta_id` enum (`hero_open_app`, `nav_open_app`, `final_open_app`) via `onClick` without changing navigation. The adapter is initialised for landing routes through the same client init and gating (shared opt-out store and key). Mount `LandingAnalytics` in the home layout; extend to the features and compare layouts only if the same component can be reused without new files.
- **Acceptance:** One `landing_viewed` per load; CTA clicks still navigate; nothing is sent when disabled; no prop carries a full URL, query, hash or full referrer (only the `path` enum and `referrer_domain`).
- **Verify:** `bunx vitest run src/components/landing/Nav.spec.tsx src/components/landing/nav/LandingNav.spec.tsx`
- **Depends on:** T3.1

### ✅ T3.9 ☐ Unit: prop builders and leak test
- **Kind:** unit
- **Spec:** R16
- **Risk:** high
- **Surfaces:** security
- **Files:** `src/lib/analytics/propBuilders.ts` (edit)
- **Do:** Write `propBuilders.spec.ts` feeding seeded request data (URLs, hosts, headers, bodies, env values, prompts, share ids) through every builder and asserting no output value contains any seeded string and every key is allowlisted (SC2c); cover referrer edge cases.
- **Acceptance:** Coverage >= 80%; the leak test fails if a builder passes a raw URL through.
- **Verify:** `bunx vitest run src/lib/analytics/propBuilders.spec.ts --coverage --coverage.include=src/lib/analytics/propBuilders.ts --coverage.reporter=text`
- **Depends on:** T3.8, T3.5, T3.4, T3.2

### ✅ T3.10 ☐ E2E: landing events and app events under override
- **Kind:** e2e
- **Scenarios:**
  - `@critical` with the override, landing load posts `landing_viewed` with path `/` and referrer `direct` (SC11)
  - `@critical` with the override, clicking the hero "Open app" CTA posts `landing_cta_clicked` and navigates to `/app` (SC11)
  - `@high` with the override, sending a request posts `request_sent` whose payload contains no URL, host or header from the request
  - `@high` with the override and DNT=1, the landing page sends nothing
- **Spec:** `e2e/qa/launch-readiness/analytics-events.spec.ts`, R16
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/launch-readiness/analytics-events.spec.ts` (new)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/analytics-events.spec.ts --repeat-each=3`
- **Depends on:** T3.9

🔶 **Checkpoint 3**: Leak test green, landing events fire under the same gating, no behaviour change with analytics off; `bun run lint:check`, `bun run typecheck`, `bun run test` green (SC2, SC11 events).

---

## Phase 4: Prompt arbitration and analytics notice

**Adds:** One prompt at a time across the app: a shared arbiter decides between the tour, notice, What's New, backup reminder, feedback and the Relay coach, and a one-line non-blocking notice explains the anonymous analytics.
**Try in UI:** With analytics enabled (env flag on, or `window.__RQ_ANALYTICS_E2E__ = true` set before load in dev), open the app in a fresh profile and confirm a one-line notice appears without blocking input ; Dismiss it and reload to confirm it does not return ; Open Relay while a prompt is showing and confirm only Relay's coach is visible.

### ✅ T4.1 ☐ Auto-prompt gate
- **Kind:** implementation
- **Spec:** R44, R45
- **Risk:** medium
- **Surfaces:** logic
- **Files:** `src/lib/prompts/useAutoPromptGate.ts` (new)
- **Creates:** `useAutoPromptGate`
- **Uses:** `isFirstSession`
- **Do:** The session tracker already exists (T1.2). `useAutoPromptGate` returns true only on `/app` and `/chain` routes, not while a modal dialog is open, and not in the first session (`isFirstSession`).
- **Acceptance:** Gate false off-route, with an open dialog and in the first session; true otherwise.
- **Verify:** `bun run typecheck`
- **Depends on:** T1.2

### ✅ T4.2 ☐ Prompt arbitration store
- **Kind:** implementation
- **Spec:** R41, R42, R43
- **Risk:** medium
- **Surfaces:** logic
- **Files:** `src/stores/usePromptStore.ts` (new)
- **Creates:** `usePromptStore`, `PromptId`, `request`, `release`, `openUserInitiated`
- **Do:** One active slot among `tour | analytics-notice | whats-new | backup-nudge | feedback | relay-coach`. `request(id, {priority, auto})` queues by priority (tour > analytics-notice > whats-new > backup-nudge > feedback) with stable insertion order for ties and grants only when the slot is free; `release(id)` frees and grants the next; `openUserInitiated(id)` takes the slot immediately, hides any showing auto prompt and re-queues it without consuming its shown or snooze state.
- **Acceptance:** Two same-tick requests resolve deterministically; preemption re-queues; release on unmount never deadlocks.
- **Verify:** `bun run typecheck`
- **Depends on:** none

### ✅ T4.3 ☐ Analytics notice and mounting
- **Kind:** implementation
- **Spec:** R20, R44
- **Risk:** medium
- **Surfaces:** ui
- **Files:** `src/components/common/AnalyticsNotice.tsx` (new), `src/providers/AppProviders.tsx` (edit), `src/providers/AppProviders.spec.tsx` (edit), `messages/en/common.json` (edit), `messages/fr/common.json` (edit)
- **Creates:** `AnalyticsNotice`
- **Uses:** `usePromptStore`, `useAutoPromptGate`, `useAnalyticsStore`
- **Do:** Run `impeccable` for a quiet one-line notice with links to the privacy page and Settings; request the `analytics-notice` slot, release on cleanup; dismissal sets a shared flag (try/catch) so it never reappears; hidden when analytics is disabled by DNT/GPC/env; never blocks input. Mount for app and landing routes (landing has no other prompts, so it bypasses the app-route gate). The `ja` copy is added in T4.4. Update the provider spec.
- **Acceptance:** Notice shows once on first visit, never after dismissal, and not when disabled by DNT/GPC/env.
- **Verify:** `bunx vitest run src/providers/AppProviders.spec.tsx`
- **Depends on:** T4.1, T4.2, T2.1

### ✅ T4.4 ☐ Notice copy (ja) and Relay coach registration
- **Kind:** implementation
- **Spec:** R42, R43
- **Risk:** medium
- **Surfaces:** ui, logic
- **Files:** `messages/ja/common.json` (edit), `src/components/relay/RelayDock.tsx` (edit), `src/components/relay/RelayDock.spec.tsx` (edit)
- **Uses:** `usePromptStore`, `openUserInitiated`
- **Do:** Add the `ja` notice strings. Register `relay-coach` by calling `openUserInitiated("relay-coach")` from the dock open path and releasing on close, without editing `RelayOnboarding.tsx`; if impossible, use the smallest edit in the dock open handler and flag it as an advisory.
- **Acceptance:** Opening Relay takes the slot and hides any auto prompt; closing releases it; `RelayOnboarding.tsx` is unmodified.
- **Verify:** `bunx vitest run src/components/relay/RelayDock.spec.tsx` ; `git diff --stat src/components/relay/RelayOnboarding.tsx` (expect no output)
- **Depends on:** T4.2, T4.3

### ✅ T4.5 ☐ Unit: arbitration store and gate
- **Kind:** unit
- **Spec:** R41, R42, R43, R45
- **Risk:** low
- **Surfaces:** logic
- **Files:** `src/stores/usePromptStore.ts` (edit), `src/lib/prompts/useAutoPromptGate.ts` (edit)
- **Do:** Write `usePromptStore.spec.ts` (priority order, same-tick determinism, preemption and re-queue without consuming state, release-on-cleanup using a fake-prompt harness) and `useAutoPromptGate.spec.ts` (route, open dialog, first session). The session tracker is covered in T1.8.
- **Acceptance:** Per-file coverage >= 80%.
- **Verify:** `bunx vitest run src/stores/usePromptStore.spec.ts src/lib/prompts/useAutoPromptGate.spec.ts --coverage --coverage.include=src/stores/usePromptStore.ts --coverage.include=src/lib/prompts/useAutoPromptGate.ts --coverage.reporter=text`
- **Depends on:** T4.4

### ✅ T4.6 ☐ E2E: notice and arbitration
- **Kind:** e2e
- **Scenarios:**
  - `@critical` with the override, a fresh profile on mobile width sees the notice directly; dismissing it persists across reload (R20)
  - `@critical` with the override, opening Relay while the notice shows hides the notice and shows only Relay's coach (R43)
  - `@high` with the override and DNT=1 (or GPC), the notice never appears
  - `@high` with the override, the notice never blocks typing in the URL bar
- **Spec:** `e2e/qa/launch-readiness/prompt-arbitration.spec.ts`, R20, R41, R43, R44
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/launch-readiness/prompt-arbitration.spec.ts` (new), `agent_docs/qa/prompt-arbitration/` (new, proof screenshots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/prompt-arbitration.spec.ts --repeat-each=3`
- **Depends on:** T4.5

🔶 **Checkpoint 4**: One prompt at a time proven by unit and e2e; `bun run lint:check`, `bun run typecheck`, `bun run test` and the arbitration spec green (SC8 part).

---

## Phase 5: First-run tour

**Adds:** A guided first-run tour of about 7 steps in Requestr's own design, started once on desktop, replayable from Settings and the command palette; the old dead tour and its dependency are removed.
**Try in UI:** Open `/app` in a fresh desktop profile and confirm the tour starts and shows "Step 1/7" ; Press Skip, reload, and confirm it does not restart ; Open the command palette or Settings and choose "Replay tour".

### ✅ T5.1 ☐ Spike: driver.js with a React popover
- **Kind:** implementation
- **Spec:** R1, R9
- **Risk:** medium
- **Surfaces:** ui
- **Files:** `package.json` (edit), `bun.lock` (edit), `src/components/tour/TourPopover.tsx` (new), `src/stores/useTourStore.ts` (new)
- **Creates:** `TourPopover`, `useTourStore`
- **Do:** Run `impeccable`, then `bun add driver.js`. Prove the popover contract before writing steps: `TourPopover` rendered per popover through driver.js custom rendering shows "step x/N", Back, Next, Skip and a close button with shadcn tokens in light and dark, Esc and arrow keys, focus trap, and animation off under reduced motion. `useTourStore` holds active flag, trigger (`auto|replay`) and current step. Record the working integration in the task Log.
- **Acceptance:** A one-step demo tour renders the custom popover, keyboard navigation works, reduced motion disables animation.
- **Verify:** `bun run typecheck` ; `grep -n "driver.js" package.json`
- **Depends on:** none

### ✅ T5.2 ☐ Anchors and steps
- **Kind:** implementation
- **Spec:** R2, R3, R9
- **Risk:** low
- **Surfaces:** ui
- **Files:** `src/lib/tour/tourAnchors.ts` (new), `src/lib/tour/tourSteps.ts` (new), `messages/en/common.json` (edit), `messages/fr/common.json` (edit), `messages/ja/common.json` (edit)
- **Creates:** `TOUR_ANCHORS`, `TOUR_STEPS`
- **Do:** Declare `TOUR_ANCHORS` once (url-bar-send, sample-requests, save-to-collection, environments, chains, relay-dock) and define the ordered steps referencing the map only (no raw strings): URL bar + send (Ctrl+Enter), sample requests, save to collection, environments, Chains canvas, Relay AI dock, command palette (Ctrl+K) / shortcuts (Ctrl+/). The command palette has no always-visible trigger (it opens only from Ctrl+K), so the last step is an element-less centred popover that always resolves. Add tour copy in en/fr/ja.
- **Acceptance:** Seven steps in the specified order; the last step has no anchor; no raw anchor strings outside the map; copy exists in all locales.
- **Verify:** `bunx vitest run src/i18n`
- **Depends on:** T5.1

### ✅ T5.3 ☐ Apply `data-tour` attributes
- **Kind:** implementation
- **Spec:** R2
- **Risk:** low
- **Surfaces:** ui
- **Files:** `src/components/common/SampleRequestCards.tsx` (edit), `src/components/environment/EnvSelector.tsx` (edit), `src/components/request/UrlBar.tsx` (edit), `src/components/relay/RelayToggleButton.tsx` (edit), `src/components/layout/SidebarMainTab.tsx` (edit)
- **Uses:** `TOUR_ANCHORS`
- **Do:** Apply `data-tour={TOUR_ANCHORS.<id>}` to existing elements that are visible on a fresh `/app`: sample cards, environment selector, the URL input plus Send button group and the Save button in `UrlBar.tsx` (`url-bar-send`, `save-to-collection`), Relay toggle, and the always-visible Chains accordion trigger in `SidebarMainTab.tsx` (not `ChainList`, which sits inside collapsible content). Existing specs stay green.
- **Acceptance:** Each listed element exposes the matching attribute and is visible on a fresh `/app` at desktop width; no layout change.
- **Verify:** `bunx vitest run src/components/environment src/components/request/UrlBar.spec.tsx src/components/relay/RelayToggleButton.spec.tsx src/components/layout/SidebarMainTab.spec.tsx`
- **Depends on:** T5.2

### ✅ T5.4 ☐ Start logic and auto-start
- **Kind:** implementation
- **Spec:** R4, R5, R6, R8
- **Risk:** medium
- **Surfaces:** logic, ui
- **Files:** `src/lib/tour/startTour.ts` (new), `src/lib/tour/useTourAutoStart.ts` (new), `src/components/layout/MainLayout.tsx` (edit), `src/components/layout/MainLayout.spec.tsx` (edit)
- **Creates:** `startTour`, `useTourAutoStart`, `MIN_TOUR_STEPS`, `TOUR_ANCHOR_WAIT_MS`
- **Uses:** `TOUR_STEPS`, `TourPopover`, `useTourStore`, `usePromptStore`
- **Do:** `startTour` filters to steps whose anchor exists and is visible, waits up to `TOUR_ANCHOR_WAIT_MS` (3s) for anchors to mount, aborts with a toast when fewer than `MIN_TOUR_STEPS` (4) resolve without marking complete on auto-start, takes the `tour` slot, destroys on route change (releasing the slot) and refreshes positions on resize. `useTourAutoStart` starts once on `/app` when `rq_onboarding_complete` is unset and the viewport is desktop (>= 768px); it does not auto-start under `navigator.webdriver` unless `window.__RQ_TOUR_E2E__ === true` (keeps existing e2e and capture runs unaffected). Completion or skip sets `rq_onboarding_complete`; a mid-tour reload restarts the tour (SPEC OQ-A). Mount the hook in `MainLayout.tsx` and remove the commented-out `OnboardingTour` use.
- **Acceptance:**
  - Below 768px no auto-start; with `rq_onboarding_complete` set no auto-start; under webdriver without `__RQ_TOUR_E2E__` no auto-start.
  - Fewer than four visible anchors yields a toast and no start; step count "x/N" reflects only resolved steps.
- **Verify:** `bunx vitest run src/components/layout/MainLayout.spec.tsx`
- **Depends on:** T5.3, T4.2

### ✅ T5.5 ☐ Replay entry points and tour events
- **Kind:** implementation
- **Spec:** R7, R48, R44
- **Risk:** medium
- **Surfaces:** ui, logic
- **Files:** `src/components/settings/GeneralSection.tsx` (edit), `src/components/settings/GeneralSection.spec.tsx` (edit), `src/components/common/CommandPalette.tsx` (edit), `src/components/common/CommandPalette.spec.tsx` (edit), `src/lib/tour/startTour.ts` (edit)
- **Uses:** `startTour`, `track`, `openUserInitiated`
- **Do:** Add a "Replay tour" action in Settings -> General and the command palette; replay ignores the completed flag, takes the slot as a user-initiated open, restarts cleanly mid-tour with no duplicate overlays and emits no first-run side effects. Emit `tour_started`, `tour_step_viewed`, `tour_completed`, `tour_skipped`. After the tour ends or is skipped the analytics notice shows (first-visit sequence).
- **Acceptance:** Replay works with the flag set; events fire with allowlisted props; replay mid-tour leaves a single overlay.
- **Verify:** `bunx vitest run src/components/settings/GeneralSection.spec.tsx src/components/common/CommandPalette.spec.tsx`
- **Depends on:** T5.4, T3.6

### ✅ T5.6 ☐ Remove the old tour
- **Kind:** implementation
- **Spec:** R1, R8
- **Risk:** low
- **Surfaces:** logic
- **Files:** `src/components/common/OnboardingTour.tsx` (edit), `src/hooks/useFirstTimeUser.ts` (edit), `src/hooks/useFirstTimeUser.spec.ts` (edit), `package.json` (edit), `bun.lock` (edit)
- **Do:** Delete `OnboardingTour.tsx`, `useFirstTimeUser.ts` and its spec with `git rm`, and remove `boarding.js` via `bun remove boarding.js`. Confirm no remaining import. `RelayOnboarding.tsx` is untouched.
- **Acceptance:** `grep -rn "boarding.js\|OnboardingTour\|useFirstTimeUser" package.json bun.lock src` is empty (SC9).
- **Verify:** `grep -rn "boarding.js\|OnboardingTour\|useFirstTimeUser" package.json bun.lock src` (expect no output) ; `bun run typecheck`
- **Depends on:** T5.4

### ✅ T5.7 ☐ Unit: tour logic
- **Kind:** unit
- **Spec:** R4, R5, R6
- **Risk:** low
- **Surfaces:** logic
- **Files:** `src/lib/tour/startTour.ts` (edit), `src/lib/tour/useTourAutoStart.ts` (edit), `src/lib/tour/tourSteps.ts` (edit), `src/stores/useTourStore.ts` (edit)
- **Do:** Write specs for anchor resolution (visible-only, bounded wait), `MIN_TOUR_STEPS` guard with toast and no-complete, auto-start gating (desktop, flag, route, webdriver suppression and the `__RQ_TOUR_E2E__` opt-in), replay ignoring the flag, step list order, and store transitions. Do not test anything under `src/components/reactbits/`.
- **Acceptance:** Per-file coverage >= 80%.
- **Verify:** `bunx vitest run src/lib/tour/startTour.spec.ts src/lib/tour/useTourAutoStart.spec.ts src/lib/tour/tourSteps.spec.ts src/stores/useTourStore.spec.ts --coverage --coverage.include=src/lib/tour/startTour.ts --coverage.include=src/lib/tour/useTourAutoStart.ts --coverage.include=src/lib/tour/tourSteps.ts --coverage.include=src/stores/useTourStore.ts --coverage.reporter=text`
- **Depends on:** T5.6, T5.5

### ✅ T5.8 ☐ E2E: first-run tour
- **Kind:** e2e
- **Scenarios:**
  - `@critical` with `__RQ_TOUR_E2E__`, a fresh desktop profile auto-starts the tour on `/app`; after completing it, reload does not restart it (SC1)
  - `@critical` Skip sets completion and the tour does not return after reload
  - `@critical` with both `__RQ_TOUR_E2E__` and the analytics override, after the tour is skipped the analytics notice appears (R44 first-visit sequence)
  - Note: every scenario sets `window.__RQ_TOUR_E2E__ = true` via `addInitScript`, so negative cases (mobile width, flag set, restored profile) fail for the right reason rather than passing because webdriver suppresses auto-start.
  - `@critical` below 768px the tour does not auto-start
  - `@high` Settings "Replay tour" and the command palette item both start the tour when already completed
  - `@high` Esc closes the tour and focus returns to the app
  - `@high` a restored-from-backup profile (flag set) does not auto-start
- **Spec:** `e2e/qa/launch-readiness/tour.spec.ts`, R6, R7, R9, R44
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/launch-readiness/tour.spec.ts` (new)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/tour.spec.ts --repeat-each=3`
- **Depends on:** T5.7

🔶 **Checkpoint 5**: Tour works end to end and the old tour and `boarding.js` are gone; `bun run lint:check`, `bun run typecheck`, `bun run test` and the tour spec green (SC1, SC9).

---

## Phase 6: Feedback

**Adds:** A "Feedback" item in the sidebar footer and the command palette that opens a rating dialog, plus one gentle auto-prompt after the user has really used the app; it works even when analytics is off.
**Try in UI:** Click "Feedback" in the sidebar footer: without PostHog env the submit button is disabled with an explanation; with the survey env set (or `window.__RQ_ANALYTICS_E2E__ = true` in dev) submit a 4-star rating ; Open the command palette and choose Feedback ; Enter an invalid email and confirm inline validation and that the draft is kept on failure.

### ✅ T6.1 ☐ Eligibility and state
- **Kind:** implementation
- **Spec:** R30, R31, R33, R34
- **Risk:** medium
- **Surfaces:** logic
- **Files:** `src/lib/feedback/eligibility.ts` (new), `src/lib/feedback/feedbackState.ts` (new)
- **Creates:** `isFeedbackEligible`, `readFeedbackState`, `recordFeedbackDismiss`, `recordFeedbackSubmit`, `incrementFeedbackCounter`
- **Uses:** `getSessionDays`
- **Do:** `eligibility.ts` is pure: sessions on >= 3 separate calendar days AND (>= 10 successful requests OR >= 1 chain run OR >= 1 Relay action); never first session; not within 30 days of a dismiss; never after submit; at most one auto-prompt per session; idle (no request in flight, no chain run, no focused input/textarea/editor, no pointer or key activity within the idle-window constant, 3s). `feedbackState.ts` keeps counters and state in versioned localStorage keys (try/catch, memory fallback, ignores future-dated days), independent of analytics consent.
- **Acceptance:** Unit-fixture inputs produce the SC5 outcomes; counters keep working with analytics off.
- **Verify:** `bun run typecheck`
- **Depends on:** T4.1

### ✅ T6.2 ☐ Counter call sites
- **Kind:** implementation
- **Spec:** R30, R34
- **Risk:** low
- **Surfaces:** logic
- **Files:** `src/hooks/useSendRequest.ts` (edit), `src/hooks/useSendRequest.spec.ts` (edit), `src/hooks/useChainRun.ts` (edit), `src/hooks/useChainRun.spec.ts` (edit), `src/lib/relay/changeLog.ts` (edit)
- **Uses:** `incrementFeedbackCounter`
- **Do:** Increment successful-request, chain-run and Relay-action counters at the same sites that emit analytics events, but not through `track()` so they work with analytics off.
- **Acceptance:** Counters increment once per success, chain run and applied Relay change; specs green.
- **Verify:** `bunx vitest run src/hooks/useSendRequest.spec.ts src/hooks/useChainRun.spec.ts src/lib/relay/changeLog.spec.ts`
- **Depends on:** T6.1, T3.4

### ✅ T6.3 ☐ Feedback dialog
- **Kind:** implementation
- **Spec:** R29, R34
- **Risk:** high
- **Surfaces:** ui, security
- **Files:** `src/components/feedback/FeedbackDialog.tsx` (new), `messages/en/common.json` (edit), `messages/fr/common.json` (edit), `messages/ja/common.json` (edit)
- **Creates:** `FeedbackDialog`, `FEEDBACK_TEXT_MAX`
- **Uses:** `submitSurvey`, `usePromptStore`
- **Do:** Run `impeccable`, then build the dialog: required 1-5 rating, optional text (max `FEEDBACK_TEXT_MAX`), optional validated email, statement that text and email are sent as written, inline error that keeps the draft on offline or route error, submit disabled with an explanation when the survey is not configured. Submit calls `submitSurvey()`; an explicit submission is sent even when analytics is off, carrying no analytics id and only `app_version`, and no `feedback_*` tracking events are emitted in that case.
- **Acceptance:** Rating required; invalid email blocked inline; failure keeps the draft and the dialog open; when analytics is on, `feedback_submitted` is emitted with `rating`, `has_text`, `has_email`.
- **Verify:** `bun run typecheck`
- **Depends on:** T6.1, T1.3, T4.2

### ✅ T6.4 ☐ Survey availability build-time flag
- **Kind:** implementation
- **Spec:** R29, R22a
- **Risk:** medium
- **Surfaces:** logic, security
- **Files:** `next.config.ts` (edit), `src/providers/AppProviders.tsx` (edit), `src/providers/AppProviders.spec.tsx` (edit)
- **Do:** In `next.config.ts`, compute at build time whether `POSTHOG_FEEDBACK_SURVEY_ID` and `POSTHOG_KEY` are both set and expose only the resulting boolean as `NEXT_PUBLIC_FEEDBACK_SURVEY_CONFIGURED` via `env` (never the id or key; static rendering is unaffected). `AppProviders` exposes it to the dialog via a small context. In non-production with `window.__RQ_ANALYTICS_E2E__` set, treat the survey as configured so e2e can exercise submit (SPEC OQ-D).
- **Acceptance:** The dialog's submit button is disabled with the explanatory message when the flag is false; only the boolean is placed in `next.config.ts` `env` (no survey id or key), and the provider spec asserts the context reads only that boolean; `/api/ingest` still returns a constant 204.
- **Verify:** `bunx vitest run src/providers/AppProviders.spec.tsx`
- **Depends on:** T6.3

### ✅ T6.5 ☐ Entry points
- **Kind:** implementation
- **Spec:** R28, R43
- **Risk:** medium
- **Surfaces:** ui
- **Files:** `src/components/layout/LeftPanel.tsx` (edit), `src/components/layout/LeftPanel.spec.tsx` (edit), `src/components/common/CommandPalette.tsx` (edit), `src/components/common/CommandPalette.spec.tsx` (edit)
- **Uses:** `FeedbackDialog`, `openUserInitiated`
- **Do:** Add a "Feedback" item in the sidebar footer (new; there is no help menu today) and in the command palette. Opening takes the slot immediately (user-initiated, no eligibility checks) and re-queues any auto prompt without consuming its state.
- **Acceptance:** Both entry points open the dialog at any time, including during the first session.
- **Verify:** `bunx vitest run src/components/layout/LeftPanel.spec.tsx src/components/common/CommandPalette.spec.tsx`
- **Depends on:** T6.4, T5.5

### ✅ T6.6 ☐ Auto-prompt
- **Kind:** implementation
- **Spec:** R31, R32, R33, R34
- **Risk:** medium
- **Surfaces:** ui, logic
- **Files:** `src/components/feedback/FeedbackAutoPrompt.tsx` (new), `src/components/layout/MainLayout.tsx` (edit), `src/components/layout/MainLayout.spec.tsx` (edit)
- **Creates:** `FeedbackAutoPrompt`
- **Uses:** `isFeedbackEligible`, `useAutoPromptGate`, `usePromptStore`, `recordFeedbackDismiss`, `recordFeedbackSubmit`
- **Do:** Mount in `MainLayout.tsx`. Compute idle as: no request in flight, no chain run in progress, no focused input/textarea/contenteditable/editor, and no pointer or key activity within the 3s idle-window constant; pass it to `isFeedbackEligible`. At show-time re-read localStorage state (multi-tab safe), request the `feedback` slot at lowest priority, release on cleanup, dismiss snoozes 30 days, submit sets never-ask-again, at most one auto-prompt per session. Emit `feedback_prompt_shown`/`feedback_prompt_dismissed` only when analytics is on. Opted-out users still get the prompt.
- **Acceptance:** Never during the tour, What's New, backup reminder or notice; never in the first session; never while a request is in flight or an input is focused; dismissal and submit state persist; an opted-out user still gets the prompt.
- **Verify:** `bunx vitest run src/components/layout/MainLayout.spec.tsx`
- **Depends on:** T6.5, T4.2

### ✅ T6.7 ☐ Unit: eligibility and state
- **Kind:** unit
- **Spec:** R30, R31, R33, R34
- **Risk:** low
- **Surfaces:** logic
- **Files:** `src/lib/feedback/eligibility.ts` (edit), `src/lib/feedback/feedbackState.ts` (edit)
- **Do:** Write fixtures per SC5: day counting, thresholds, first session, idle window, 30-day snooze, submit-forever, once per session, future-dated entries, storage failure, and eligibility unchanged when analytics is opted out (R34).
- **Acceptance:** Per-file coverage >= 80%; each SC5 rule has a failing-case test.
- **Verify:** `bunx vitest run src/lib/feedback/eligibility.spec.ts src/lib/feedback/feedbackState.spec.ts --coverage --coverage.include=src/lib/feedback/eligibility.ts --coverage.include=src/lib/feedback/feedbackState.ts --coverage.reporter=text`
- **Depends on:** T6.6

### ✅ T6.8 ☐ Unit: feedback dialog
- **Kind:** unit
- **Spec:** R29, R34
- **Risk:** low
- **Surfaces:** logic
- **Files:** `src/components/feedback/FeedbackDialog.tsx` (edit), `src/components/feedback/FeedbackAutoPrompt.tsx` (edit)
- **Do:** Write `FeedbackDialog.spec.tsx` and `FeedbackAutoPrompt.spec.tsx` (start with `// @vitest-environment happy-dom`): rating required, email validation, draft kept on failure, disabled when unconfigured, explicit submit with analytics off sends only `app_version`, auto-prompt arbitration behaviour, idle detection (in-flight request, focused input, recent activity), and an opted-out user still gets the auto-prompt with no `feedback_prompt_*` events.
- **Acceptance:** Per-file coverage >= 80%.
- **Verify:** `bunx vitest run src/components/feedback/FeedbackDialog.spec.tsx src/components/feedback/FeedbackAutoPrompt.spec.tsx --coverage --coverage.include=src/components/feedback/FeedbackDialog.tsx --coverage.include=src/components/feedback/FeedbackAutoPrompt.tsx --coverage.reporter=text`
- **Depends on:** T6.7

### ✅ T6.9 ☐ E2E: feedback
- **Kind:** e2e
- **Scenarios:**
  - `@critical` the sidebar Feedback item opens the dialog and a 4-star submit posts a survey payload to `/api/ingest` (override enabled)
  - `@critical` with the override and DNT=1, a user-initiated submit still posts, with no analytics id and only `app_version` among common props (SC3 exception)
  - `@high` with the override, a failed submit (`/api/ingest` routed to fail) shows an inline error and keeps the text
  - `@high` an invalid email is blocked inline
  - `@high` the command palette item opens the dialog
- **Spec:** `e2e/qa/launch-readiness/feedback.spec.ts`, R28, R29, R34
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/launch-readiness/feedback.spec.ts` (new)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/feedback.spec.ts --repeat-each=3`
- **Depends on:** T6.8

🔶 **Checkpoint 6**: Feedback works manually and by auto-prompt and respects arbitration; `bun run lint:check`, `bun run typecheck`, `bun run test` and the feedback spec green (SC5, SC3).

---

## Phase 7: Backup nudge

**Adds:** A gentle, dismissible reminder to export a backup once the user has real saved data and has not exported in 30 days; its action opens the existing export dialog.
**Try in UI:** With seeded data and no recent export, open the app (not first session) and confirm the reminder appears ; Click its action and confirm the export dialog opens ; Dismiss it and confirm it does not return for 14 days.

### ✅ T7.1 ☐ Nudge state and export timestamp
- **Kind:** implementation
- **Spec:** R39, R40, R40a
- **Risk:** medium
- **Surfaces:** logic
- **Files:** `src/lib/backup/backupNudgeState.ts` (new), `src/components/settings/backup/useBackupExport.ts` (edit)
- **Creates:** `shouldShowBackupNudge`, `snoozeBackupNudge`, `BACKUP_NUDGE_MIN_REQUESTS`, `LAST_BACKUP_EXPORT_KEY`
- **Do:** `backupNudgeState.ts` holds thresholds as named constants (>= 5 saved requests or >= 1 chain/collection with content, 30-day interval, 14-day snooze), at most one nudge per session, never first session, re-reads `rq_last_backup_export` at show time, returns no nudge on data-read failure or during a restore. `useBackupExport` writes `rq_last_backup_export` on success (try/catch). The key is not added to the backup preferences allowlist.
- **Acceptance:** Eligibility follows the thresholds and snooze; the timestamp is written only on success.
- **Verify:** `bun run typecheck`
- **Depends on:** T4.1

### ✅ T7.2 ☐ Nudge component
- **Kind:** implementation
- **Spec:** R40
- **Risk:** medium
- **Surfaces:** ui
- **Files:** `src/components/backup/BackupNudge.tsx` (new), `src/components/layout/MainLayout.tsx` (edit), `src/components/layout/MainLayout.spec.tsx` (edit), `messages/en/common.json` (edit), `messages/fr/common.json` (edit)
- **Creates:** `BackupNudge`
- **Uses:** `shouldShowBackupNudge`, `usePromptStore`, `useAutoPromptGate`, `ExportBackupDialog`
- **Do:** Run `impeccable` for a quiet dismissible reminder. Request the `backup-nudge` slot, release on cleanup, action opens `ExportBackupDialog` as a user-initiated open, dismiss snoozes 14 days. Emit `backup_nudge_shown|accepted|dismissed` when analytics is on. The `ja` copy is added in T7.3.
- **Acceptance:** Shows only on `/app` and `/chain`, never with another prompt showing, action opens the export dialog.
- **Verify:** `bunx vitest run src/components/layout/MainLayout.spec.tsx`
- **Depends on:** T7.1, T4.2

### ✅ T7.3 ☐ Nudge copy (ja)
- **Kind:** implementation
- **Spec:** R40
- **Risk:** low
- **Surfaces:** ui
- **Files:** `messages/ja/common.json` (edit)
- **Do:** Add the Japanese nudge strings matching the keys added in T7.2.
- **Acceptance:** Message parity spec green.
- **Verify:** `bunx vitest run src/i18n`
- **Depends on:** T7.2

### ✅ T7.4 ☐ Unit: nudge state
- **Kind:** unit
- **Spec:** R39, R40
- **Risk:** low
- **Surfaces:** logic
- **Files:** `src/lib/backup/backupNudgeState.ts` (edit), `src/components/backup/BackupNudge.tsx` (edit)
- **Do:** Write `backupNudgeState.spec.ts` (thresholds, 30-day interval, 14-day snooze, first session, read failure, restore suppression, other-tab export re-read) and `BackupNudge.spec.tsx` (happy-dom; action opens the dialog, dismiss snoozes).
- **Acceptance:** Per-file coverage >= 80%.
- **Verify:** `bunx vitest run src/lib/backup/backupNudgeState.spec.ts src/components/backup/BackupNudge.spec.tsx --coverage --coverage.include=src/lib/backup/backupNudgeState.ts --coverage.include=src/components/backup/BackupNudge.tsx --coverage.reporter=text`
- **Depends on:** T7.3

### ✅ T7.5 ☐ E2E: backup nudge
- **Kind:** e2e
- **Scenarios:**
  - `@critical` with seeded data, a prior session and no export, the reminder appears and its action opens the export dialog
  - `@high` after a successful export the reminder does not appear
  - `@high` dismiss hides it and it does not return on reload
  - `@medium` a fresh profile with no data never sees it
- **Spec:** `e2e/qa/launch-readiness/backup-nudge.spec.ts`, R39, R40
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/launch-readiness/backup-nudge.spec.ts` (new), `agent_docs/qa/backup-nudge/` (new, proof screenshots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/backup-nudge.spec.ts --repeat-each=3`
- **Depends on:** T7.4

🔶 **Checkpoint 7**: Nudge appears only under its rules and arbitrates correctly; `bun run lint:check`, `bun run typecheck`, `bun run test` and the nudge spec green.

---

## Phase 8: Releases and What's New

**Adds:** Automated releases (a release PR, tag and GitHub Release on merge to `main`) and a plain-language "What's New" dialog shown once per version to returning users.
**Try in UI:** In a profile that has used the app on an earlier day (not first session), set the stored last-seen version below 0.1.0 and reload `/app` to see the dialog ; Dismiss it and reload to confirm it stays gone ; Open `.github/workflows/release-please.yml` and confirm the trigger and permissions.

### ✅ T8.1 ☐ release-please workflow and config
- **Kind:** implementation
- **Spec:** R35, R38a
- **Risk:** medium
- **Surfaces:** none
- **Files:** `.github/workflows/release-please.yml` (new), `release-please-config.json` (new), `.release-please-manifest.json` (new), `CHANGELOG.md` (new)
- **Do:** Workflow on push to `main` using `googleapis/release-please-action` with `release-type: node`, permissions `contents: write` and `pull-requests: write`. Manifest bootstraps at `0.1.0`; config points at `package.json` and `CHANGELOG.md`. Add a header comment noting the two manual settings (enable "Allow GitHub Actions to create and approve pull requests"; release PRs opened with `GITHUB_TOKEN` do not trigger `ci.yml`, so a maintainer re-runs or uses a PAT). `ci.yml` is unchanged.
- **Acceptance:** Files parse as valid YAML/JSON; manifest version equals the `package.json` version; `git diff --stat .github/workflows/ci.yml` is empty.
- **Verify:** `bun -e 'const fs=require("fs"); require("js-yaml").load(fs.readFileSync(".github/workflows/release-please.yml","utf8")); JSON.parse(fs.readFileSync("release-please-config.json","utf8")); const m=JSON.parse(fs.readFileSync(".release-please-manifest.json","utf8")); const v=JSON.parse(fs.readFileSync("package.json","utf8")).version; if(m["."]!==v){console.error("manifest "+m["."]+" != package.json "+v); process.exit(1)} console.log("release config ok")'` ; `git diff --stat .github/workflows/ci.yml` (expect no output)
- **Depends on:** none

### ✅ T8.2 ☐ App version and highlights module
- **Kind:** implementation
- **Spec:** R36, R38
- **Risk:** low
- **Surfaces:** logic
- **Files:** `next.config.ts` (edit), `src/lib/whatsNew/highlights.ts` (new), `src/lib/whatsNew/whatsNewState.ts` (new)
- **Creates:** `HIGHLIGHTS`, `getHighlights`, `pickLatestWithHighlights`, `isReturningUser`, `readLastSeenVersion`, `recordSeenVersion`, `NEXT_PUBLIC_APP_VERSION`
- **Do:** Set `NEXT_PUBLIC_APP_VERSION` in `next.config.ts` from `package.json`. `highlights.ts` is a TS record keyed by version with `{en, fr, ja}` plain-language bullet lists (seed one plain-language launch entry for the current `package.json` version, 0.1.0, so the shipped modal has content; SPEC OQ-B), `getHighlights(version, locale)` with `en` fallback, `pickLatestWithHighlights(lastSeen, current)` for skipped versions. `whatsNewState.ts` stores last-seen version (try/catch) and decides returning user: stored version, or `rq_onboarding_complete` set, or existing saved data; a new user records the current version silently.
- **Acceptance:** Missing or empty entry yields no modal; multiple skipped versions pick the latest with highlights; en fallback works.
- **Verify:** `bun run typecheck`
- **Depends on:** none

### ✅ T8.3 ☐ What's New modal
- **Kind:** implementation
- **Spec:** R37
- **Risk:** medium
- **Surfaces:** ui
- **Files:** `src/components/whats-new/WhatsNewModal.tsx` (new), `src/components/layout/MainLayout.tsx` (edit), `src/components/layout/MainLayout.spec.tsx` (edit), `messages/en/common.json` (edit), `messages/fr/common.json` (edit)
- **Creates:** `WhatsNewModal`
- **Uses:** `pickLatestWithHighlights`, `isReturningUser`, `usePromptStore`, `useAutoPromptGate`
- **Do:** Run `impeccable`. Request the `whats-new` slot, release on cleanup; show once per version to returning users only; dismissal records the version; emit `whats_new_shown`/`whats_new_dismissed` with `version` when analytics is on. The `ja` strings are added in T8.4.
- **Acceptance:** Not shown to genuinely new users, never together with the tour, deferred (not dropped) while another prompt shows.
- **Verify:** `bunx vitest run src/components/layout/MainLayout.spec.tsx`
- **Depends on:** T8.2, T4.2

### ✅ T8.4 ☐ What's New copy (ja)
- **Kind:** implementation
- **Spec:** R37
- **Risk:** low
- **Surfaces:** ui
- **Files:** `messages/ja/common.json` (edit)
- **Do:** Add Japanese strings matching the keys from T8.3.
- **Acceptance:** Message parity spec green.
- **Verify:** `bunx vitest run src/i18n`
- **Depends on:** T8.3

### ✅ T8.5 ☐ Unit: highlights validation and state
- **Kind:** unit
- **Spec:** R36, R37, R38
- **Risk:** low
- **Surfaces:** logic
- **Files:** `src/lib/whatsNew/highlights.ts` (edit), `src/lib/whatsNew/whatsNewState.ts` (edit)
- **Do:** Write `highlights.spec.ts` validating every existing entry (en required; no commit hashes, `feat:`/`fix:` prefixes, PR/issue numbers, file paths or code identifiers; a missing entry is not a failure), lookup with fallback and latest-with-highlights, and `whatsNewState.spec.ts` for returning-user determination. Add `src/components/whats-new/WhatsNewModal.spec.tsx` (happy-dom) for show-once and dismiss behaviour.
- **Acceptance:** Per-file coverage >= 80%; a seeded entry containing "feat:" or a hash makes the validator test fail.
- **Verify:** `bunx vitest run src/lib/whatsNew/highlights.spec.ts src/lib/whatsNew/whatsNewState.spec.ts src/components/whats-new/WhatsNewModal.spec.tsx --coverage --coverage.include=src/lib/whatsNew/highlights.ts --coverage.include=src/lib/whatsNew/whatsNewState.ts --coverage.include=src/components/whats-new/WhatsNewModal.tsx --coverage.reporter=text`
- **Depends on:** T8.4

### ✅ T8.6 ☐ E2E: What's New
- **Kind:** e2e
- **Scenarios:**
  - `@critical` a returning user (seeded older stored version and a prior session day, so the first-session gate passes) sees the modal once and not after dismissal (SC6)
  - `@critical` a brand-new profile sees no modal and the current version is recorded
  - `@high` with `__RQ_TOUR_E2E__` and an older stored version but no `rq_onboarding_complete`, the modal does not appear while the tour is active
  - `@medium` the modal does not appear on a non-app route such as `/privacy` (R45); the missing-entry case is covered by T8.5
- **Spec:** `e2e/qa/launch-readiness/whats-new.spec.ts`, R37, R38, R45
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/launch-readiness/whats-new.spec.ts` (new), `agent_docs/qa/whats-new/` (new, proof screenshots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/whats-new.spec.ts --repeat-each=3`
- **Depends on:** T8.5

🔶 **Checkpoint 8**: Release workflow files valid, What's New logic and modal proven; `bun run lint:check`, `bun run typecheck`, `bun run test` and the spec green (SC6 in-app part). The tag and GitHub Release on merge are confirmed manually after the first release PR is merged.

---

## Phase 9: Docs, repo health and README

**Adds:** A scannable README (hero, TOC, features with screenshots, quick start, honest privacy section), docs moved into `docs/`, a roadmap, and standard repo health files and templates.
**Try in UI:** Open README.md on GitHub and find hero, demo, features, quick start and privacy within 30 seconds ; Run `node scripts/capture/verify-assets.mjs --readme` and confirm every link and image resolves ; Open the Issues "New issue" page and confirm bug, feature and feedback templates.

### ✅ T9.1 ☐ Docs split
- **Kind:** implementation
- **Spec:** R51
- **Risk:** low
- **Surfaces:** none
- **Files:** `docs/CHAIN_BLOCKS.md` (new), `docs/SHORTCUTS.md` (edit), `ROADMAP.md` (new), `README.md` (edit)
- **Do:** Move the README "Chain blocks" content to `docs/CHAIN_BLOCKS.md`, merge the README keyboard-shortcut content into the existing `docs/SHORTCUTS.md` (no duplicate file), move Roadmap to `ROADMAP.md`. Leave links in place of the moved sections; the full README rewrite is T9.6.
- **Acceptance:** The moved content exists once, in `docs/` and `ROADMAP.md`; no duplicate shortcuts file.
- **Verify:** `ls docs/CHAIN_BLOCKS.md ROADMAP.md` ; `ls docs | grep -ci shortcuts` (expect 1)
- **Depends on:** none

### ✅ T9.2 ☐ Contributing, security, conduct
- **Kind:** implementation
- **Spec:** R53, R38a
- **Risk:** low
- **Surfaces:** none
- **Files:** `CONTRIBUTING.md` (new), `SECURITY.md` (new), `CODE_OF_CONDUCT.md` (new)
- **Do:** `CONTRIBUTING.md` covers setup with `bun`, conventional-commit PR titles with squash merges, and the release-please notes (release PRs opened by `GITHUB_TOKEN` do not run CI; the repo setting to allow Actions to create PRs). `SECURITY.md` names GitHub private vulnerability reporting (advisories) as the primary channel and `LEGAL_CONTACT_EMAIL` from `src/components/legal/constants.ts` as fallback (read the value, do not guess). `CODE_OF_CONDUCT.md` uses the Contributor Covenant.
- **Acceptance:** All three exist; SECURITY.md contains the real contact email from the constants file.
- **Verify:** `bun -e 'const fs=require("fs"); const m=fs.readFileSync("src/components/legal/constants.ts","utf8").match(/LEGAL_CONTACT_EMAIL\s*=\s*"([^"]+)"/); if(!m||!fs.readFileSync("SECURITY.md","utf8").includes(m[1])) process.exit(1); for (const f of ["CONTRIBUTING.md","CODE_OF_CONDUCT.md"]) fs.statSync(f); console.log("repo health ok")'`
- **Depends on:** none

### ✅ T9.3 ☐ Issue and PR templates
- **Kind:** implementation
- **Spec:** R53
- **Risk:** low
- **Surfaces:** none
- **Files:** `.github/ISSUE_TEMPLATE/bug_report.yml` (new), `.github/ISSUE_TEMPLATE/feature_request.yml` (new), `.github/ISSUE_TEMPLATE/feedback.yml` (new), `.github/pull_request_template.md` (new)
- **Do:** Add bug, feature and feedback issue forms and a PR template that asks for a conventional-commit title.
- **Acceptance:** Files exist and parse as YAML.
- **Verify:** `bun -e 'const fs=require("fs"); const yaml=require("js-yaml"); for (const f of ["bug_report","feature_request","feedback"]) { const t=yaml.load(fs.readFileSync(".github/ISSUE_TEMPLATE/"+f+".yml","utf8")); if(!t||!t.name||!Array.isArray(t.body)) process.exit(1) } fs.statSync(".github/pull_request_template.md"); console.log("templates ok")'`
- **Depends on:** none

### ✅ T9.4 ☐ Topics, keywords, labels
- **Kind:** implementation
- **Spec:** R54
- **Risk:** low
- **Surfaces:** none
- **Files:** `package.json` (edit)
- **Do:** Refresh `package.json` keywords. Review GitHub topics and create `good first issue` and `help wanted` labels with `gh label create` (skip if present). Update topics with `gh repo edit --add-topic` for the chosen set. Draft a handful of starter issue proposals for the PR description (do not create them).
- **Acceptance:** `gh label list` shows both labels; keywords updated; topics refreshed.
- **Verify:** `gh label list --search "good first issue"` ; `gh label list --search "help wanted"` ; `gh repo view --json repositoryTopics` ; `grep -n "keywords" package.json`
- **Depends on:** none

### ✅ T9.5 ☐ README link and image check
- **Kind:** implementation
- **Spec:** R50
- **Risk:** low
- **Surfaces:** none
- **Files:** `scripts/capture/verify-assets.mjs` (edit), `package.json` (edit)
- **Creates:** `check:readme`
- **Do:** Extend `verify-assets.mjs` with a README mode (`--readme`) that parses README.md for relative image and link paths and fails on any that do not resolve to a file; expose it as the `check:readme` script. External URLs are not fetched.
- **Acceptance:** The script exits non-zero when a seeded broken path is present and zero otherwise.
- **Verify:** `bun run check:readme`
- **Depends on:** none

### ✅ T9.6 ☐ README rewrite
- **Kind:** implementation
- **Spec:** R49, R52, R51
- **Risk:** low
- **Surfaces:** none
- **Files:** `README.md` (edit)
- **Uses:** `check:readme`
- **Do:** Rewrite in the order hero (logo, one-liner, badges, live-app CTA https://requestr-api.vercel.app/, demo video placeholder; the poster/GIF is produced in T11.4 and wired in T11.5) -> TOC -> Why -> Features with screenshots from `public/screens/` (HTTP/GraphQL/WebSocket, Chains, Relay AI agent as its own section, encrypted sharing, health monitoring, toolbox, import) -> Quick start -> Privacy & analytics -> Tech stack -> Contributing -> License. Pull claims from the landing page under `src/app/(home)`. Remove the "Self-hosting: client IP header" section, condense Architecture to a link to `docs/ARCHITECTURE.md`, link `docs/CHAIN_BLOCKS.md`, `docs/SHORTCUTS.md` and `ROADMAP.md`. The "Privacy & analytics" section replaces the old "Privacy" section and states no more than the privacy page (anonymous usage events, no request content, no cookies, IP stripped, opt-out via toggle/DNT/GPC, feedback text/email only if entered). Until T11.5 the hero uses an existing screenshot instead of a missing poster so all paths resolve.
- **Acceptance:** Sections appear in the specified order; links and images resolve; no claim contradicts the privacy page.
- **Verify:** `bun run check:readme` ; `grep -n "^## " README.md`
- **Depends on:** T9.1, T9.2, T9.5, T2.6

### ✅ T9.7 ☐ Unit: README asset checker
- **Kind:** unit
- **Spec:** R50
- **Risk:** low
- **Surfaces:** logic
- **Files:** `scripts/capture/verify-assets.mjs` (edit), `scripts/capture/verify-assets.spec.ts` (new), `vitest.config.ts` (edit: include scripts specs)
- **Do:** Write `scripts/capture/verify-assets.spec.ts` covering the `--readme` mode: resolving relative images and links, failing on a seeded broken path, ignoring external URLs.
- **Acceptance:** Coverage >= 80% on every metric; no `it.fails`.
- **Verify:** `bunx vitest run scripts/capture/verify-assets.spec.ts --coverage --coverage.include=scripts/capture/verify-assets.mjs --coverage.reporter=text`
- **Depends on:** T9.6

### ✅ T9.8 ☐ E2E: README structure and links
- **Kind:** e2e
- **Scenarios:**
  - `@critical` README contains hero, TOC, Why, Features, Quick start, Privacy & analytics, Tech stack, Contributing, License headings in order (SC7)
  - `@critical` every relative link and image in README resolves to a file (SC7)
  - `@medium` the old "Self-hosting" and "no analytics" claims are absent
- **Spec:** `e2e/qa/launch-readiness/readme.spec.ts`, R49, R50, R52
- **Acceptance:** Every scenario passes 3 of 3 repeats (file-system based, no browser page needed).
- **Files:** `e2e/qa/launch-readiness/readme.spec.ts` (new)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/readme.spec.ts --repeat-each=3`
- **Depends on:** T9.7

🔶 **Checkpoint 9**: README, docs and repo health files in place and link-checked; `bun run check:readme`, `bun run lint:check` green (SC7).

---

## Phase 10: PostHog provisioning

**Adds:** The PostHog project is ready: the feedback survey exists, a "Launch" dashboard shows the activation funnel, feature usage, retention and landing-to-app conversion, and production env vars are set. Analytics stays off until the deliberate final switch.
**Try in UI:** Open the PostHog project and confirm the "Launch" dashboard and the feedback survey exist ; Open `agent_docs/launch-readiness/POSTHOG_SETUP.md` and confirm the manual checklist ; Open `POSTHOG_SETUP.md` and confirm the `SURVEY_ID:` and `DASHBOARD_ID:` lines; after merge and the production switch, trigger a test event and see it in PostHog Live events.

### ✅ T10.1 ☐ Manual fallback checklist
- **Kind:** gate
- **Spec:** R62
- **Risk:** low
- **Surfaces:** none
- **Files:** `agent_docs/launch-readiness/POSTHOG_SETUP.md` (new)
- **Do:** Write the manual checklist covering every provisioning step: create or confirm the US project; copy the public project key; create the feedback survey (API mode: rating 1-5, open text, email) and record its id; create the "Launch" dashboard with insights (activation funnel `app_opened` first-session -> `tour_*` -> `first_request_sent` -> `request_saved` -> `chain_run` or `relay_opened`; feature usage counts of `request_sent`, `chain_run`, `relay_*`, `share_created`; retention on `app_opened` by `days_since_last_bucket`; landing -> app funnel `landing_viewed` -> `landing_cta_clicked` -> `app_opened` by `referrer_domain`); the four Vercel env vars (`NEXT_PUBLIC_ANALYTICS_ENABLED=true` in Production only, build-time inlined so a redeploy is needed); and the post-deploy verification steps.
- **Acceptance:** Each of R60 and R61 steps has a checkbox; marked clearly as the fallback that never blocks other work.
- **Verify:** `grep -c "^- \[ \]" agent_docs/launch-readiness/POSTHOG_SETUP.md`
- **Depends on:** none

### ✅ T10.2 ☐ Connect PostHog MCP (user auth)
- **Kind:** gate
- **Spec:** R60, R62
- **Risk:** low
- **Surfaces:** none
- **Files:** `agent_docs/launch-readiness/POSTHOG_SETUP.md` (edit)
- **Do:** Check whether the PostHog MCP is connected. If not, tell the user to run `claude mcp add --transport http posthog https://mcp.posthog.com/mcp` and authenticate once (the only manual step). If it remains unavailable, mark T10.3 to T10.5 as handled by the manual checklist in T10.1 and continue; this never blocks other work.
- **Acceptance:** Either the MCP tools are callable, or the Log records that the fallback checklist is being used.
- **Verify:** `claude mcp list`
- **Depends on:** T10.1

### ✅ T10.3 ☐ Create project confirmation and feedback survey
- **Kind:** gate
- **Spec:** R60
- **Risk:** medium
- **Surfaces:** none
- **Files:** `agent_docs/launch-readiness/POSTHOG_SETUP.md` (edit)
- **Do:** Via the PostHog MCP, confirm or create the US-region project, create the feedback survey (API mode: rating 1-5, open text, email) and record its id in `POSTHOG_SETUP.md` on a line starting `SURVEY_ID:` (or `SURVEY_ID: pending-manual` when the fallback is used) and in the PR checklist. `.env.example` already lists the variable from T1.7; never commit real secrets. If the MCP is unavailable, the user follows the matching steps in `POSTHOG_SETUP.md` and this task is closed with the fallback noted.
- **Acceptance:** A `SURVEY_ID:` line exists with a real id or the explicit `pending-manual` marker.
- **Verify:** `grep -n "^SURVEY_ID: " agent_docs/launch-readiness/POSTHOG_SETUP.md`
- **Depends on:** T10.2

### ✅ T10.4 ☐ Create the Launch dashboard
- **Kind:** gate
- **Spec:** R60
- **Risk:** low
- **Surfaces:** none
- **Files:** `agent_docs/launch-readiness/POSTHOG_SETUP.md` (edit)
- **Do:** Via the PostHog MCP, create the "Launch" dashboard with the insights listed in T10.1: activation funnel, feature usage, retention, landing -> app conversion by `referrer_domain`. If the MCP is unavailable the user follows the checklist and this task closes with the fallback noted.
- **Acceptance:** A line starting `DASHBOARD_ID:` (real id or `pending-manual`) and the four insight names are recorded in `POSTHOG_SETUP.md` (SC11, SC12).
- **Verify:** `grep -n "^DASHBOARD_ID: " agent_docs/launch-readiness/POSTHOG_SETUP.md`
- **Depends on:** T10.2

### ✅ T10.5 ☐ Vercel env vars
- **Kind:** gate
- **Spec:** R61
- **Risk:** high
- **Surfaces:** security
- **Files:** `agent_docs/launch-readiness/POSTHOG_SETUP.md` (edit)
- **Do:** If the Vercel CLI is logged in and linked (`vercel whoami`, `.vercel/project.json`), run `vercel env add` for `POSTHOG_KEY`, `POSTHOG_HOST=https://us.i.posthog.com` and `POSTHOG_FEEDBACK_SURVEY_ID` (all environments) but add `NEXT_PUBLIC_ANALYTICS_ENABLED=true` only in Production, and only in T10.6. If the CLI is not usable, list the variables as a manual checklist in the PR (see `POSTHOG_SETUP.md`). Never print secret values into logs.
- **Acceptance:** Either `vercel env ls` shows the three server vars, or the manual checklist is in the PR description.
- **Verify:** `vercel env ls` (or record the manual-checklist fallback)
- **Depends on:** T10.3

### ✅ T10.6 ☐ Production switch and live verification
- **Kind:** gate
- **Spec:** R60, R61
- **Risk:** high
- **Surfaces:** security
- **Files:** `src/lib/analytics/server/posthogSink.ts` (edit)
- **Do:** Pre-merge: send one allowlisted test event, one survey response and one `$exception` through the sink to the PostHog project (a one-off local run with the server env set, or via the MCP) and confirm they arrive and render; if the wire shapes for `$exception_list` or `survey sent` need adjusting, change only `src/lib/analytics/server/posthogSink.ts` and its spec. Post-merge (manual, listed in the PR): only once the notice, Settings toggle and rewritten privacy page are deployed, set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` in Production only, redeploy (build-time inlined) and confirm a live event. Analytics never goes live before the notice and toggle ship.
- **Acceptance:** Test event, survey response and exception visible in PostHog (SC12), or recorded as pending manual work; the production switch is listed as a post-merge PR step.
- **Verify:** `bunx vitest run src/lib/analytics/server/posthogSink.spec.ts`
- **Depends on:** T10.4, T10.5, T4.3, T2.6

🔶 **Checkpoint 10**: Survey id and Launch dashboard exist (MCP or documented fallback) and env vars are set or listed (SC11, SC12).

---

## Phase 11: Demo video

**Adds:** A scripted, deterministic demo video of the real app (send request, chain run, Relay builds something, encrypted share), with a poster and GIF fallback committed for the README. Uploading it to GitHub is a manual step.
**Try in UI:** Play the generated MP4 and confirm title card, captions, zoom-ins and the end card with the URL ; Open `docs/media/` and confirm the poster and GIF exist ; Open README and confirm the poster or GIF shows in the hero.

### T11.1 ☐ Install Remotion dev dependencies
- **Kind:** gate
- **Spec:** R57
- **Risk:** low
- **Surfaces:** none
- **Files:** `package.json` (edit), `bun.lock` (edit), `.gitignore` (edit)
- **Do:** `bun add -d remotion @remotion/cli`. Add the MP4 output path (for example `scripts/capture/demo/out/`) to `.gitignore`. These are dev-only dependencies named in the spec.
- **Acceptance:** Both packages are under `devDependencies`; the output folder is gitignored.
- **Verify:** `grep -n "remotion" package.json` ; `git check-ignore scripts/capture/demo/out/demo.mp4`
- **Depends on:** none

### T11.2 ☐ Deterministic recording script
- **Kind:** gate
- **Spec:** R56
- **Risk:** medium
- **Surfaces:** none
- **Files:** `scripts/capture/demo-record.ts` (new), `scripts/capture/seed.ts` (edit), `scripts/capture/relay-record.ts` (edit), `package.json` (edit)
- **Creates:** `demo-record`
- **Uses:** `seedCaptureData`
- **Do:** Playwright script that records the real app at a fixed high-resolution viewport on the seeded data from `seedCaptureData`, with all network routes mocked (including a scripted Relay stream following `relay-record.ts`), covering scenes: send request, chain run, Relay builds something, encrypted share. It does not start the dev server (it targets the running one). It suppresses first-run prompts through the seed (`rq_onboarding_complete`, notice-dismissed, current What's New version, recent export, feedback snooze) so overlays do not appear. Records per-scene clips to `scripts/capture/demo/out/clips/` and a scene timing manifest to `scripts/capture/demo/out/manifest.json`; exposed as the `demo-record` package script.
- **Acceptance:** Running the script produces one clip per scene and a manifest, with no real network calls and no tour, notice, What's New, nudge or feedback overlay in any clip.
- **Verify:** `bun run typecheck` ; `bun run demo-record` ; `ls scripts/capture/demo/out/clips/` ; `ls scripts/capture/demo/out/manifest.json`
- **Depends on:** T5.8, T6.9, T7.5, T8.6

### T11.3 ☐ Remotion composition
- **Kind:** gate
- **Spec:** R57
- **Risk:** medium
- **Surfaces:** none
- **Files:** `scripts/capture/demo/index.ts` (new), `scripts/capture/demo/Root.tsx` (new), `scripts/capture/demo/DemoVideo.tsx` (new), `scripts/capture/demo/scenes.ts` (new)
- **Do:** `index.ts` is the Remotion entry calling `registerRoot(Root)`; `Root.tsx` registers one composition with id `DemoVideo`. A roughly 60-90 second composition with a title card, zoom-ins on the active area, per-scene captions, speed ramps (fast through typing and waiting, normal at the payoff) and an end card with the URL https://requestr-api.vercel.app/, driven by the timing manifest. Use named constants for durations and zooms. Follow the remotion best-practices skills.
- **Acceptance:** The composition renders a still without error for the title card, each scene and the end card.
- **Verify:** `bunx remotion still scripts/capture/demo/index.ts DemoVideo scripts/capture/demo/out/check-title.png --frame=0` ; `bun run typecheck` (then one `remotion still` per scene start frame from `scenes.ts`, recorded in the Log)
- **Depends on:** T11.1, T11.2

### T11.4 ☐ Render outputs
- **Kind:** gate
- **Spec:** R58
- **Risk:** low
- **Surfaces:** none
- **Files:** `scripts/capture/demo/render.sh` (new), `docs/media/demo-poster.jpg` (new), `docs/media/demo.gif` (new)
- **Do:** A script that renders the MP4 (<= 10MB, gitignored under `scripts/capture/demo/out/`), a poster image (<= 300KB) and a GIF fallback (<= 5MB) into `docs/media/`. Run it and commit only the poster and GIF.
- **Acceptance:** MP4 <= 10485760 bytes, poster <= 307200 bytes, GIF <= 5242880 bytes.
- **Verify:** `bash scripts/capture/demo/render.sh` ; `bun -e 'const fs=require("fs"); const lim={"scripts/capture/demo/out/demo.mp4":10485760,"docs/media/demo-poster.jpg":307200,"docs/media/demo.gif":5242880}; for (const [f,max] of Object.entries(lim)) { const s=fs.statSync(f).size; if(s>max){console.error(f+" "+s+" > "+max); process.exit(1)} } console.log("sizes ok")'`
- **Depends on:** T11.3

### T11.5 ☐ Manual upload documentation and README wiring
- **Kind:** gate
- **Spec:** R58, R59
- **Risk:** low
- **Surfaces:** none
- **Files:** `README.md` (edit), `scripts/capture/README.md` (edit)
- **Uses:** `check:readme`
- **Do:** Wire the README hero to the poster/GIF under `docs/media/` as the fallback, with a clearly marked place for the user-attachments video URL. Document in `scripts/capture/README.md` and in the PR text the manual step: drag the MP4 into a GitHub issue or PR comment box, copy the user-attachments URL and paste it into the README hero. The build never attempts the upload.
- **Acceptance:** The README shows the poster/GIF and `bun run check:readme` passes; the manual step is documented.
- **Verify:** `bun run check:readme`
- **Depends on:** T11.4, T9.6

🔶 **Checkpoint 11**: Demo script, composition and committed poster/GIF in place; README resolves; manual upload documented.

---

## Phase 12: Final gate

**Adds:** Nothing new; proves the whole feature meets the success criteria with the targeted suites only.
**Try in UI:** Open `/app` in a fresh profile and walk the tour ; Toggle analytics off in Settings and confirm the notice and Replay tour entries ; Open `/privacy` and the README and confirm the same claims.

### T12.1 ☐ Final gate: lint, typecheck, unit and targeted e2e
- **Kind:** gate
- **Spec:** R10
- **Risk:** low
- **Surfaces:** none
- **Files:** none
- **Do:** Run `bun run lint:check`, `bun run typecheck`, `bun run test`, then only the targeted specs: ingest, opt-out, events, arbitration, tour, feedback, backup nudge, what's new, readme. Confirm SC9 greps and the import-boundary spec.
- **Acceptance:** All commands green; `grep -rn "boarding.js\|cronitor" package.json bun.lock src` is empty (SC9); never the full e2e suite.
- **Verify:** `bun run lint:check` ; `bun run typecheck` ; `bun run test` ; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness --repeat-each=2`
- **Depends on:** T11.5, T10.6, T8.6, T7.5

### T12.2 ☐ Definition of done
- **Kind:** dod
- **Spec:** R22
- **Risk:** low
- **Surfaces:** none
- **Files:** none
- **Do:** Confirm every success criterion against the cited tasks.
- **Acceptance:**
  - SC1 by T5.8; SC2 by T1.10, T1.11, T2.7, T3.9; SC3 by T2.8, T6.9; SC4 by T2.7, T2.8.
  - SC5 by T6.7; SC6 by T8.1, T8.6 (tag and release confirmed after the first release PR merge); SC7 by T9.7, T9.8.
  - SC8 by T12.1; SC9 by T5.6, T12.1; SC10 by T1.11; SC11 by T3.10, T10.4; SC12 by T10.3, T10.4, T10.6.
  - Post-merge manual step listed in the PR: the production analytics switch (T10.6), only after the notice and toggle are deployed.
  - Manual user steps are listed in the PR: PostHog MCP auth, the GitHub repo setting for Actions-created PRs, the demo video upload, Vercel env vars if the CLI is not linked.
- **Verify:** `git status --porcelain | head -20`
- **Depends on:** T12.1

🔶 **Checkpoint 12**: Every success criterion maps to a green task and the manual steps are listed.
