window.DASHBOARD = {
 "generatedAt": "2026-11-23T01:49:25.025Z",
 "maxAttempts": 5,
 "feature": {
  "slug": "launch-readiness",
  "title": "launch-readiness"
 },
 "tasksFile": "agent_docs/launch-readiness/TASKS.md",
 "projectRoot": "/Users/deepakdewani1/Documents/Programs/react/requestly",
 "docs": [
  {
   "name": "INTERVIEW",
   "href": "docs/INTERVIEW.html",
   "source": "agent_docs/launch-readiness/INTERVIEW.md"
  },
  {
   "name": "PLAN",
   "href": "docs/PLAN.html",
   "source": "agent_docs/launch-readiness/PLAN.md"
  },
  {
   "name": "REPO_MAP",
   "href": "docs/REPO_MAP.html",
   "source": "agent_docs/launch-readiness/REPO_MAP.md"
  },
  {
   "name": "SPEC",
   "href": "docs/SPEC.html",
   "source": "agent_docs/launch-readiness/SPEC.md"
  },
  {
   "name": "TASKS",
   "href": "docs/TASKS.html",
   "source": "agent_docs/launch-readiness/TASKS.md"
  }
 ],
 "costUsd": 35.8684,
 "elapsedMs": 15306332,
 "costByRole": {
  "reviewer-ux": 0.8113,
  "builder": 12.9655,
  "reviewer-code": 1.9734,
  "verifier": 10.8421,
  "reviewer-security": 3.2614,
  "e2e": 2.1175,
  "unit": 2.9755,
  "reviewer-ui": 0.9218
 },
 "totals": {
  "phases": 12,
  "tasks": 84,
  "byStatus": {
   "verified": 57,
   "ready": 9,
   "waiting": 18
  }
 },
 "phases": [
  {
   "id": "1",
   "name": "Analytics foundation",
   "startLine": 20,
   "endLine": 181,
   "adds": "A privacy-first analytics pipeline with no UI: a typed event allowlist, a swappable client adapter and a same-origin `/api/ingest` route that forwards to PostHog from the server only. Cronitor is removed; everything stays off until the kill switch is turned on.",
   "tryInUi": [
    "No UI in this phase. Run `bunx vitest run src/app/api/ingest/route.spec.ts` and confirm the route tests pass",
    "Open `.env.example` and confirm the four analytics variables are documented",
    "Run `grep -rn cronitor package.json src` and confirm nothing is found."
   ],
   "checkpoint": {
    "title": "Checkpoint 1",
    "line": 178,
    "items": [
     "`bun run lint:check`, `bun run typecheck`, `bun run test` green; ingest e2e spec green; no Cronitor reference remains (SC9 part, SC10)."
    ]
   },
   "tasks": [
    {
     "id": "T1.1",
     "title": "Event map and allowlist",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/lib/analytics/events.ts"
     ],
     "gherkin": null,
     "do": "Define the typed `EventMap` for every catalogue event in SPEC with its allowed props, the allowlisted common props (`app_version`, `locale`, `viewport_class`, `session_day_index`, `theme`), enum value lists, string max-length constants, and pure bucket helpers. Export an `EVENT_ALLOWLIST` runtime structure derived from the same definitions, usable on client and server.",
     "spec": "R15, R16",
     "filesDeclared": true,
     "acceptance": [
      "Calling a not-yet-defined event or prop fails typecheck.",
      "`EVENT_ALLOWLIST` lists exactly the catalogue events, `$exception` and the survey event, with per-event allowed prop names.",
      "Bucket helpers return only the catalogue bucket strings."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 25,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4067,
     "costApprox": true,
     "elapsedMs": 4973352,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    },
    {
     "id": "T1.2",
     "title": "Consent, analytics id, dedupe, session tracker",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/lib/analytics/consent.ts",
      "src/lib/analytics/analyticsId.ts",
      "src/lib/analytics/dedupe.ts",
      "src/lib/prompts/sessionTracker.ts"
     ],
     "gherkin": null,
     "do": "`resolveConsent(env)` is pure and returns `{enabled, reason}` from `NEXT_PUBLIC_ANALYTICS_ENABLED`, `NODE_ENV`, `navigator.webdriver`, DNT (`navigator.doNotTrack === \"1\"`), GPC, the store toggle (passed in) and the e2e override flag `window.__RQ_ANALYTICS_E2E__`. Precedence (R22a): the override is honoured only when `NODE_ENV !== \"production\"`; when honoured it bypasses the env-flag, `NODE_ENV` and webdriver gates, but never DNT, GPC or the toggle. `analyticsId.ts` stores a random UUID in `rq_analytics_id` (try/catch, memory fallback), never reading `rq_anon_id`; `clearAnalyticsId` deletes it. `dedupe.ts` offers one-shot-ever and per-session once/cap helpers. `sessionTracker.ts` records local-date strings of session days in localStorage (try/catch, memory fallback), ignores future-dated entries and is independent of analytics consent; it is created here because `app_opened` and the `session_day_index` common prop need it (prompts and feedback reuse it later).",
     "spec": "R14, R22, R22a, R18",
     "filesDeclared": true,
     "acceptance": [
      "Disabled with a named reason for each of: env off, development, test, webdriver, DNT, GPC, toggle off.",
      "The override enables only outside production and never in a production build; with the override set, DNT, GPC or toggle off still disable.",
      "The id is a UUID, regenerates after `clearAnalyticsId`, and is independent of `rq_anon_id`.",
      "localStorage failure falls back to memory without throwing.",
      "`isFirstSession` is true only on the first recorded day; future-dated entries are ignored."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 40,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4067,
     "costApprox": true,
     "elapsedMs": 4973352,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    },
    {
     "id": "T1.3",
     "title": "Adapter, noop and HTTP client",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.2"
     ],
     "files": [
      "src/lib/analytics/adapter.ts",
      "src/lib/analytics/noopAdapter.ts",
      "src/lib/analytics/httpAdapter.ts"
     ],
     "gherkin": null,
     "do": "`adapter.ts` exposes the `AnalyticsAdapter` interface and module-level `track`/`captureError`/`submitSurvey`/`setEnabled`, SSR-safe (no-op without `window`), with an `initAnalytics` that picks noop or HTTP once. `httpAdapter.ts` queues in memory (capped), attaches common props, batches JSON to `/api/ingest` on interval, batch size and `pagehide` via `navigator.sendBeacon`, applies a per-session cap, offline queue with flush on reconnect, max 1 retry with backoff then drop, logs a failure once at debug level. Errors inside the module are logged and never re-captured. `submitSurvey` sends via a distinct path that skips the user-consent gate (toggle/DNT/GPC) but not the env gate and carries no analytics id and only `app_version`.",
     "spec": "R11, R12, R24, R22",
     "filesDeclared": true,
     "acceptance": [
      "With analytics disabled all calls are no-ops with no console errors and no network.",
      "Batches flush on interval, size and `pagehide`; the queue never exceeds its cap; a blocked route causes at most one retry.",
      "No call sets a cookie or loads a script."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 57,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "logic",
      "security"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4067,
     "costApprox": true,
     "elapsedMs": 4973352,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    },
    {
     "id": "T1.4",
     "title": "Server validation and PostHog sink",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/lib/analytics/server/validate.ts",
      "src/lib/analytics/server/posthogSink.ts"
     ],
     "gherkin": null,
     "do": "`validate.ts` drops unknown events and props using `EVENT_ALLOWLIST`, enforces the per-prop string max length and drops oversize events. `posthogSink.ts` is the only file that knows PostHog: builds the `/batch` payload from `POSTHOG_KEY`/`POSTHOG_HOST`, sets `$ip: null` and `$geoip_disable: true` on every event, maps error records to `$exception` with `$exception_list`, maps survey submissions to `survey sent` with `$survey_id` (from `POSTHOG_FEEDBACK_SURVEY_ID`) and `$survey_response_<question_id>` props, uses `fetch` with a timeout constant, logs status only.",
     "spec": "R11, R12, R13",
     "filesDeclared": true,
     "acceptance": [
      "Unknown event names and props never reach the sink.",
      "Every forwarded event has `$geoip_disable: true`, `$ip: null` and no client IP.",
      "Upstream failure or timeout resolves without throwing and without logging payload.",
      "No other file imports PostHog wire details."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 73,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "CHANGES"
       },
       "verifier": null
      },
      {
       "n": 3,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.5245,
     "costApprox": true,
     "elapsedMs": 4973352,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    },
    {
     "id": "T1.5",
     "title": "`/api/ingest` route",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.4"
     ],
     "files": [
      "src/app/api/ingest/route.ts",
      "src/lib/relay/server/guard.ts",
      "src/lib/relay/server/rateLimit.ts",
      "src/lib/relay/server/bodyLimit.ts"
     ],
     "gherkin": null,
     "do": "Implement `POST` per PLAN 1.1: same-origin check, body-size cap via `readBodyWithLimit`, per-IP rate limit reusing the relay rate-limit pattern with a hashed expiring key (IP never logged or forwarded), max events per batch, bot-UA drop without storing the UA, JSON parse (400 on malformed), `validateBatch`, then the sink. Return 204 for accepted, dropped, upstream-failed and disabled (`NEXT_PUBLIC_ANALYTICS_ENABLED !== \"true\"` or missing `POSTHOG_KEY`/`POSTHOG_HOST`: 204 without forwarding). Never echo the payload. Touch the three relay server files only if a small generic export is needed; otherwise leave them unchanged.",
     "spec": "R13, R22, R23",
     "filesDeclared": true,
     "acceptance": [
      "Malformed JSON returns 400; everything else returns 204.",
      "Disabled env, rate-limited, bot and foreign-origin requests never reach `fetch`.",
      "Forwarded requests carry no `X-Forwarded-For` or client IP."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 90,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.499,
     "costApprox": true,
     "elapsedMs": 4778380,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    },
    {
     "id": "T1.6",
     "title": "Provider init, Cronitor removal, `app_opened`",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.3"
     ],
     "files": [
      "src/providers/AppProviders.tsx",
      "src/providers/AppProviders.spec.tsx",
      "package.json",
      "bun.lock",
      "src/app/app/page.tsx"
     ],
     "gherkin": null,
     "do": "Remove `useCronitor`/`CronitorTracker` from `AppProviders.tsx` and `@cronitorio/cronitor-rum-nextjs` from `package.json` via `bun remove`. Call `recordSession` and `initAnalytics` in a client effect only. Fire `app_opened` (with `is_first_session` and `days_since_last_bucket`) once per page session on `/app`. Update `AppProviders.spec.tsx`.",
     "spec": "R21, R12, R22",
     "filesDeclared": true,
     "acceptance": [
      "`grep -rn cronitor package.json bun.lock src` finds nothing.",
      "`app_opened` is queued once per page session and is a no-op when analytics is disabled."
     ],
     "verify": [
      "bunx vitest run src/providers/AppProviders.spec.tsx",
      "`grep -rn \"cronitor\" package.json bun.lock src` (expect no output)"
     ],
     "line": 106,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.3114,
     "costApprox": true,
     "elapsedMs": 4778381,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    },
    {
     "id": "T1.7",
     "title": "Env docs and import boundary rule",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.5"
     ],
     "files": [
      ".env.example",
      "biome.json"
     ],
     "gherkin": null,
     "do": "Document `NEXT_PUBLIC_ANALYTICS_ENABLED` (kill switch, default off, Production only, build-time inlined), `POSTHOG_KEY` (public, server-only), `POSTHOG_HOST` (US `https://us.i.posthog.com` launch value, EU `https://eu.i.posthog.com` possible), `POSTHOG_FEEDBACK_SURVEY_ID` with comments. Add a Biome `noRestrictedImports` rule forbidding any `posthog` import and imports of `src/lib/analytics/server/*` outside `src/lib/analytics/` and `src/app/api/ingest/` (via an override for those paths).",
     "spec": "R10, R55",
     "filesDeclared": true,
     "acceptance": [
      "`.env.example` has all four variables with comments.",
      "`bun run lint:check` passes on the repo."
     ],
     "verify": [
      "bun run lint:check"
     ],
     "line": 120,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "security"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "CHANGES",
        "security": "PASS"
       },
       "verifier": null
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "skipped"
      }
     ],
     "costUsd": 0.4076,
     "costApprox": true,
     "elapsedMs": 4422701,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    },
    {
     "id": "T1.8",
     "title": "Unit: event map, consent, id, dedupe, session tracker",
     "done": true,
     "kind": "unit",
     "depends": [
      "T1.7"
     ],
     "files": [
      "src/lib/analytics/events.ts",
      "src/lib/analytics/consent.ts",
      "src/lib/analytics/analyticsId.ts",
      "src/lib/analytics/dedupe.ts",
      "src/lib/prompts/sessionTracker.ts",
      "src/lib/analytics/importBoundary.spec.ts"
     ],
     "gherkin": null,
     "do": "Write `events.spec.ts`, `consent.spec.ts`, `analyticsId.spec.ts`, `dedupe.spec.ts`, `sessionTracker.spec.ts` beside the sources. Also write `src/lib/analytics/importBoundary.spec.ts` scanning `src/` and asserting no PostHog import and no `analytics/server/*` import outside the allowed folders (R10 backstop).",
     "spec": "R10, R14, R15, R22, R22a",
     "filesDeclared": true,
     "acceptance": [
      "Per-file coverage >= 80%; consent matrix covers every reason incl. the override in production and the override never bypassing DNT/GPC/toggle; id lifecycle covers opt-out clear and regenerate; session tracker covers first session, future dates and storage failure; boundary scan fails on a seeded violation fixture."
     ],
     "verify": [
      "bunx vitest run src/lib/analytics/events.spec.ts src/lib/analytics/consent.spec.ts src/lib/analytics/analyticsId.spec.ts src/lib/analytics/dedupe.spec.ts src/lib/prompts/sessionTracker.spec.ts src/lib/analytics/importBoundary.spec.ts --coverage --coverage.include=src/lib/analytics/events.ts --coverage.include=src/lib/analytics/consent.ts --coverage.include=src/lib/analytics/analyticsId.ts --coverage.include=src/lib/analytics/dedupe.ts --coverage.include=src/lib/prompts/sessionTracker.ts --coverage.reporter=text"
     ],
     "line": 133,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4274,
     "costApprox": true,
     "elapsedMs": 4681456,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    },
    {
     "id": "T1.9",
     "title": "Unit: adapter and HTTP client",
     "done": true,
     "kind": "unit",
     "depends": [
      "T1.8"
     ],
     "files": [
      "src/lib/analytics/adapter.ts",
      "src/lib/analytics/httpAdapter.ts",
      "src/lib/analytics/noopAdapter.ts"
     ],
     "gherkin": null,
     "do": "Write `adapter.spec.ts`, `httpAdapter.spec.ts`, `noopAdapter.spec.ts`: batching triggers, caps, offline queue, single retry, `sendBeacon` on pagehide, SSR no-op, survey path without id and with only `app_version`, no `document.cookie` write and no script injection (R12).",
     "spec": "R11, R24",
     "filesDeclared": true,
     "acceptance": [
      "Per-file coverage >= 80%; no network when disabled; recursion guard proven; no cookie set and no script element added."
     ],
     "verify": [
      "bunx vitest run src/lib/analytics/adapter.spec.ts src/lib/analytics/httpAdapter.spec.ts src/lib/analytics/noopAdapter.spec.ts --coverage --coverage.include=src/lib/analytics/adapter.ts --coverage.include=src/lib/analytics/httpAdapter.ts --coverage.include=src/lib/analytics/noopAdapter.ts --coverage.reporter=text"
     ],
     "line": 144,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4376,
     "costApprox": true,
     "elapsedMs": 4681456,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    },
    {
     "id": "T1.10",
     "title": "Unit: ingest route, validate and sink",
     "done": true,
     "kind": "unit",
     "depends": [
      "T1.8"
     ],
     "files": [
      "src/app/api/ingest/route.ts",
      "src/lib/analytics/server/validate.ts",
      "src/lib/analytics/server/posthogSink.ts"
     ],
     "gherkin": null,
     "do": "Write `route.spec.ts` (pattern of `src/app/api/proxy/route.spec.ts`), `validate.spec.ts`, `posthogSink.spec.ts` with a mocked `fetch`. Cover SC2(a): allowlisted events forwarded to `/batch` with `$geoip_disable: true`, no IP, unknown events/props dropped; 400 on malformed JSON; 204 without any `fetch` when disabled (env flag off or missing `POSTHOG_KEY`/`POSTHOG_HOST`), including requests that carry any client-side e2e override marker (R22a: the override never enables server forwarding); rate limit, body cap, batch cap, bot UA, cross-origin; upstream failure still 204; IP and UA never logged; `$exception_list` and `survey sent` shapes.",
     "spec": "R13, R22a, R23",
     "filesDeclared": true,
     "acceptance": [
      "Per-file coverage >= 80%; no test asserts payload echo; the disabled-env case proves `fetch` is never called."
     ],
     "verify": [
      "bunx vitest run src/app/api/ingest/route.spec.ts src/lib/analytics/server/validate.spec.ts src/lib/analytics/server/posthogSink.spec.ts --coverage --coverage.include=src/app/api/ingest/route.ts --coverage.include=src/lib/analytics/server/validate.ts --coverage.include=src/lib/analytics/server/posthogSink.ts --coverage.reporter=text"
     ],
     "line": 155,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "FAIL"
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.7518,
     "costApprox": true,
     "elapsedMs": 4832667,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    },
    {
     "id": "T1.11",
     "title": "E2E: ingest payload shape and no-send defaults",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T1.6"
     ],
     "files": [
      "e2e/qa/launch-readiness/analytics-ingest.spec.ts",
      "agent_docs/qa/analytics-ingest/"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/launch-readiness/analytics-ingest.spec.ts`, R22a, R12",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/analytics-ingest.spec.ts --repeat-each=3"
     ],
     "line": 166,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-19T16:47:09.213Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.8361,
     "costApprox": true,
     "elapsedMs": 4838275,
     "summary": [
      "Root cause: import order in scripts/build-qa-seed-js.ts was unsorted (assist/source/organizeImports, safe fix). Ran `bunx biome check --write` on it; only the import block was reordered, no behaviour ",
      "e2e/fixtures/qa-seed.init.js: no longer reported after the script fix (it is generated and is formatted by `qa:seed:build` via `biome check --write`); not hand-edited, no diff.",
      "globals.css: 5 `noImportantStyles` warnings (lines 402, 525-528) are warnings only. The reduced-motion block (`html[data-reduced-motion=\"on\"] *`) needs `!important` to override component-level animati"
     ]
    }
   ],
   "verified": 11,
   "total": 11,
   "complete": true,
   "costUsd": 5.4155,
   "elapsedMs": 5234242
  },
  {
   "id": "2",
   "name": "Consent controls, privacy page, error tracking, Relay telemetry",
   "startLine": 182,
   "endLine": 297,
   "adds": "A \"Share anonymous usage data\" switch in Settings that honours Do-Not-Track and Global Privacy Control, a rewritten privacy page listing exactly what is collected, scrubbed error reports, and Relay telemetry folded into the same pipeline.",
   "tryInUi": [
    "Open Settings -> General and toggle \"Share anonymous usage data\" off then on",
    "Open `/privacy` and read the collected-data list",
    "Trigger a render error and confirm the fallback UI is unchanged."
   ],
   "checkpoint": {
    "title": "Checkpoint 2",
    "line": 294,
    "items": [
     "Toggle, DNT/GPC, scrubbed errors, Relay events and the privacy page are in place; `bun run lint:check`, `bun run typecheck`, `bun run test` and the opt-out spec green (SC3, SC4)."
    ]
   },
   "tasks": [
    {
     "id": "T2.1",
     "title": "Analytics store, toggle and backup preference",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.6"
     ],
     "files": [
      "src/stores/useAnalyticsStore.ts",
      "src/components/settings/GeneralSection.tsx",
      "src/components/settings/GeneralSection.spec.tsx",
      "src/lib/backup/preferences.ts",
      "src/lib/backup/preferences.spec.ts"
     ],
     "gherkin": null,
     "do": "Run the `impeccable` skill for the toggle row, then implement. The store persists the toggle (serializable, persist in actions). Turning it off calls `setEnabled(false)`, clears the in-memory queue and deletes `rq_analytics_id`; turning it on generates a new id. Under DNT/GPC the toggle is forced off, disabled and labelled with an explanation. Add the opt-out storage key to `BACKUP_PREFERENCE_KEYS`; `rq_analytics_id`, feedback counters, snoozes and `rq_last_backup_export` stay out of the allowlist. Add i18n keys to `settings.json` in all three locales in T2.2.",
     "spec": "R19, R48, R40a, R18",
     "filesDeclared": true,
     "acceptance": [
      "Toggling off stops capture in the same session and removes `rq_analytics_id`.",
      "DNT/GPC forces the toggle off with a visible reason.",
      "The opt-out choice is carried by backup preferences; the other new keys are not."
     ],
     "verify": [
      "bunx vitest run src/components/settings/GeneralSection.spec.tsx src/lib/backup/preferences.spec.ts"
     ],
     "line": 187,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T14:41:33.115Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "ui",
      "logic",
      "security"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "ui": "PASS",
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.693,
     "costApprox": true,
     "elapsedMs": 2261260,
     "summary": [
      "T2.3 (escalated, attempt 3) is fixed by a redesign, not one more pattern. `scrubError` is now fail-closed. A message is kept only when the whole of it matches an allowlisted engine template (V8, JavaS",
      "`error.name` is allowlisted (built-in, DOMException and app error class names); anything else is reported as `Error`.",
      "New leak found and closed: V8 stacks repeat the multi-line message as a header. Previously `ssn:123456789` on a body line came out as frame `<anon>:123456789`. Frames now strip the message header and ",
      "ROOT CAUSE: scrubbing free-form text with a denylist can never be complete. Engines echo bodies verbatim, across newlines, cut off mid-quote and into the stack header, so each review found another sha",
      "Verified: 4 spec files, 77/77 tests; `tsc` exits 0; biome is clean."
     ]
    },
    {
     "id": "T2.2",
     "title": "Settings toggle copy (i18n)",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T2.1"
     ],
     "files": [
      "messages/en/settings.json",
      "messages/fr/settings.json",
      "messages/ja/settings.json"
     ],
     "gherkin": null,
     "do": "Add label, description, DNT/GPC forced-off explanation and disabled-by-environment strings for the analytics toggle in en/fr/ja.",
     "spec": "R19, R18",
     "filesDeclared": true,
     "acceptance": [
      "Keys exist in all three locales and the existing message parity spec stays green."
     ],
     "verify": [
      "bunx vitest run src/i18n"
     ],
     "line": 203,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-20T14:41:33.115Z",
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "code": "PASS",
        "ui": "PASS"
       },
       "verifier": "skipped"
      }
     ],
     "costUsd": 0.4226,
     "costApprox": true,
     "elapsedMs": 1008626,
     "summary": [
      "T2.3 (escalated, attempt 3) is fixed by a redesign, not one more pattern. `scrubError` is now fail-closed. A message is kept only when the whole of it matches an allowlisted engine template (V8, JavaS",
      "`error.name` is allowlisted (built-in, DOMException and app error class names); anything else is reported as `Error`.",
      "New leak found and closed: V8 stacks repeat the multi-line message as a header. Previously `ssn:123456789` on a body line came out as frame `<anon>:123456789`. Frames now strip the message header and ",
      "ROOT CAUSE: scrubbing free-form text with a denylist can never be complete. Engines echo bodies verbatim, across newlines, cut off mid-quote and into the stack header, so each review found another sha",
      "Verified: 4 spec files, 77/77 tests; `tsc` exits 0; biome is clean."
     ]
    },
    {
     "id": "T2.3",
     "title": "Scrubber",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/lib/analytics/scrub.ts"
     ],
     "gherkin": null,
     "do": "Pure function turning an error plus a source into a neutral record: message truncated, URLs/hosts/query strings, header-like and `Bearer`/token patterns and env-value substrings redacted; stack frames keep only file:line; no component props, component stack text or breadcrumbs.",
     "spec": "R26",
     "filesDeclared": true,
     "acceptance": [
      "A corpus of seeded request data (URLs, hosts, headers, tokens, bodies) embedded in error messages and stacks never survives scrubbing."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 214,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-20T14:41:33.115Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "CHANGES"
       },
       "verifier": null
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "CHANGES"
       },
       "verifier": null
      },
      {
       "n": 3,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 2.484,
     "costApprox": true,
     "elapsedMs": 2261261,
     "summary": [
      "T2.3 (escalated, attempt 3) is fixed by a redesign, not one more pattern. `scrubError` is now fail-closed. A message is kept only when the whole of it matches an allowlisted engine template (V8, JavaS",
      "`error.name` is allowlisted (built-in, DOMException and app error class names); anything else is reported as `Error`.",
      "New leak found and closed: V8 stacks repeat the multi-line message as a header. Previously `ssn:123456789` on a body line came out as frame `<anon>:123456789`. Frames now strip the message header and ",
      "ROOT CAUSE: scrubbing free-form text with a denylist can never be complete. Engines echo bodies verbatim, across newlines, cut off mid-quote and into the stack header, so each review found another sha",
      "Verified: 4 spec files, 77/77 tests; `tsc` exits 0; biome is clean."
     ]
    },
    {
     "id": "T2.4",
     "title": "Error capture wiring",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T2.3",
      "T1.6"
     ],
     "files": [
      "src/lib/analytics/adapter.ts",
      "src/providers/AppProviders.tsx",
      "src/providers/AppProviders.spec.tsx",
      "src/components/common/ErrorBoundary.tsx",
      "src/components/common/ErrorBoundary.spec.tsx"
     ],
     "gherkin": null,
     "do": "Register `window` `error` and `unhandledrejection` handlers in the provider client effect and call `captureError` from `ErrorBoundary.componentDidCatch` with source `boundary`. Dedupe by fingerprint once per session, cap per session, respect opt-out/DNT/GPC/env, and never re-capture errors thrown inside the analytics module. The ErrorBoundary fallback UI is unchanged.",
     "spec": "R25, R27",
     "filesDeclared": true,
     "acceptance": [
      "Each of window error, unhandled rejection and boundary crash yields exactly one capture.",
      "No capture when disabled; the same fingerprint is sent at most once per session."
     ],
     "verify": [
      "bunx vitest run src/components/common/ErrorBoundary.spec.tsx src/providers/AppProviders.spec.tsx"
     ],
     "line": 226,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T14:41:33.115Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.7905,
     "costApprox": true,
     "elapsedMs": 2089634,
     "summary": [
      "T2.3 (escalated, attempt 3) is fixed by a redesign, not one more pattern. `scrubError` is now fail-closed. A message is kept only when the whole of it matches an allowlisted engine template (V8, JavaS",
      "`error.name` is allowlisted (built-in, DOMException and app error class names); anything else is reported as `Error`.",
      "New leak found and closed: V8 stacks repeat the multi-line message as a header. Previously `ssn:123456789` on a body line came out as frame `<anon>:123456789`. Frames now strip the message header and ",
      "ROOT CAUSE: scrubbing free-form text with a denylist can never be complete. Engines echo bodies verbatim, across newlines, cut off mid-quote and into the stack header, so each review found another sha",
      "Verified: 4 spec files, 77/77 tests; `tsc` exits 0; biome is clean."
     ]
    },
    {
     "id": "T2.5",
     "title": "Relay telemetry sink and `relay_tool_applied`",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T2.4"
     ],
     "files": [
      "src/lib/relay/telemetry.ts",
      "src/lib/relay/telemetry.spec.ts",
      "src/lib/relay/changeLog.ts",
      "src/lib/relay/changeLog.spec.ts",
      "src/providers/AppProviders.tsx"
     ],
     "gherkin": null,
     "do": "Install a telemetry sink via `setRelayTelemetrySink` in the provider effect that maps `RelayEventMap` events to `relay_*` catalogue events (length bucketed, entity/code/mode as enums, text never sent) while still dispatching the `relay:telemetry` DOM event. Emit `relay_tool_applied` once per applied change (not per entity batch) in the change-log apply path so R30 counts correctly.",
     "spec": "R17",
     "filesDeclared": true,
     "acceptance": [
      "The DOM event still fires; a matching analytics event is queued when enabled.",
      "`relay_tool_applied` fires once per applied change.",
      "No forwarded prop contains message text, prompt, response or entity names (only buckets and enums)."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/telemetry.spec.ts src/lib/relay/changeLog.spec.ts"
     ],
     "line": 240,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T14:41:33.115Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.3788,
     "costApprox": true,
     "elapsedMs": 2089634,
     "summary": [
      "T2.3 (escalated, attempt 3) is fixed by a redesign, not one more pattern. `scrubError` is now fail-closed. A message is kept only when the whole of it matches an allowlisted engine template (V8, JavaS",
      "`error.name` is allowlisted (built-in, DOMException and app error class names); anything else is reported as `Error`.",
      "New leak found and closed: V8 stacks repeat the multi-line message as a header. Previously `ssn:123456789` on a body line came out as frame `<anon>:123456789`. Frames now strip the message header and ",
      "ROOT CAUSE: scrubbing free-form text with a denylist can never be complete. Engines echo bodies verbatim, across newlines, cut off mid-quote and into the stack header, so each review found another sha",
      "Verified: 4 spec files, 77/77 tests; `tsc` exits 0; biome is clean."
     ]
    },
    {
     "id": "T2.6",
     "title": "Privacy page rewrite",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T2.1"
     ],
     "files": [
      "src/app/privacy/page.tsx",
      "src/app/privacy/page.spec.tsx"
     ],
     "gherkin": null,
     "do": "Run `impeccable` for readability, then remove both no-analytics claims (about lines 36 and 109) and list exactly: collected events (rendered from `EVENT_ALLOWLIST`), never collected, the anonymous analytics id (separate from the rate-limit id), no cookies, IP stripped and geo-IP disabled, PostHog as processor with the US region, opt-out via toggle/DNT/GPC, feedback text/email sent as written (email is the only PII, only if entered), error reports. Update `page.spec.tsx`.",
     "spec": "R46",
     "filesDeclared": true,
     "acceptance": [
      "The old claims are gone; each required topic appears; the spec passes."
     ],
     "verify": [
      "bunx vitest run src/app/privacy/page.spec.tsx"
     ],
     "line": 256,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T14:41:33.115Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "ui": "PASS",
        "code": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4324,
     "costApprox": true,
     "elapsedMs": 2089634,
     "summary": [
      "T2.3 (escalated, attempt 3) is fixed by a redesign, not one more pattern. `scrubError` is now fail-closed. A message is kept only when the whole of it matches an allowlisted engine template (V8, JavaS",
      "`error.name` is allowlisted (built-in, DOMException and app error class names); anything else is reported as `Error`.",
      "New leak found and closed: V8 stacks repeat the multi-line message as a header. Previously `ssn:123456789` on a body line came out as frame `<anon>:123456789`. Frames now strip the message header and ",
      "ROOT CAUSE: scrubbing free-form text with a denylist can never be complete. Engines echo bodies verbatim, across newlines, cut off mid-quote and into the stack header, so each review found another sha",
      "Verified: 4 spec files, 77/77 tests; `tsc` exits 0; biome is clean."
     ]
    },
    {
     "id": "T2.7",
     "title": "Unit: stores, scrubber, error capture and catalogue-vs-page",
     "done": true,
     "kind": "unit",
     "depends": [
      "T2.6",
      "T2.5"
     ],
     "files": [
      "src/stores/useAnalyticsStore.ts",
      "src/lib/analytics/scrub.ts",
      "src/lib/relay/telemetry.ts",
      "src/lib/analytics/adapter.ts",
      "src/components/common/ErrorBoundary.tsx"
     ],
     "gherkin": null,
     "do": "Write `useAnalyticsStore.spec.ts` and `scrub.spec.ts` (including the SC2 seeded-corpus no-leak test) beside the sources, and extend `telemetry.spec.ts`, `adapter.spec.ts` (error capture added in T2.4: fingerprint dedupe once per session, per-session cap, no capture when opted out, errors inside the analytics module never re-captured) and `ErrorBoundary.spec.tsx` (a boundary crash yields exactly one `captureError` with source `boundary`; fallback UI unchanged). Write `src/app/privacy/catalogue.spec.ts` asserting every event name in `EVENT_ALLOWLIST` appears on the privacy page output (R47).",
     "spec": "R19, R25, R26, R27, R47",
     "filesDeclared": true,
     "acceptance": [
      "Per-file coverage >= 80%; the corpus test fails if a URL, host, header, token or env value survives; each SC4 source yields exactly one capture and none when opted out; the catalogue test fails when an event is missing from the page."
     ],
     "verify": [
      "bunx vitest run src/stores/useAnalyticsStore.spec.ts src/lib/analytics/scrub.spec.ts src/lib/relay/telemetry.spec.ts src/lib/analytics/adapter.spec.ts src/components/common/ErrorBoundary.spec.tsx src/app/privacy/catalogue.spec.ts --coverage --coverage.include=src/stores/useAnalyticsStore.ts --coverage.include=src/lib/analytics/scrub.ts --coverage.include=src/lib/relay/telemetry.ts --coverage.include=src/lib/analytics/adapter.ts --coverage.include=src/components/common/ErrorBoundary.tsx --coverage.reporter=text"
     ],
     "line": 267,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T14:41:33.115Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.5225,
     "costApprox": true,
     "elapsedMs": 1995888,
     "summary": [
      "T2.3 (escalated, attempt 3) is fixed by a redesign, not one more pattern. `scrubError` is now fail-closed. A message is kept only when the whole of it matches an allowlisted engine template (V8, JavaS",
      "`error.name` is allowlisted (built-in, DOMException and app error class names); anything else is reported as `Error`.",
      "New leak found and closed: V8 stacks repeat the multi-line message as a header. Previously `ssn:123456789` on a body line came out as frame `<anon>:123456789`. Frames now strip the message header and ",
      "ROOT CAUSE: scrubbing free-form text with a denylist can never be complete. Engines echo bodies verbatim, across newlines, cut off mid-quote and into the stack header, so each review found another sha",
      "Verified: 4 spec files, 77/77 tests; `tsc` exits 0; biome is clean."
     ]
    },
    {
     "id": "T2.8",
     "title": "E2E: opt-out sends nothing",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T2.7"
     ],
     "files": [
      "e2e/qa/launch-readiness/analytics-optout.spec.ts"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/launch-readiness/analytics-optout.spec.ts`, R18, R19, R25, R27",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/analytics-optout.spec.ts --repeat-each=3"
     ],
     "line": 278,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T14:41:33.115Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4017,
     "costApprox": true,
     "elapsedMs": 1995888,
     "summary": [
      "T2.3 (escalated, attempt 3) is fixed by a redesign, not one more pattern. `scrubError` is now fail-closed. A message is kept only when the whole of it matches an allowlisted engine template (V8, JavaS",
      "`error.name` is allowlisted (built-in, DOMException and app error class names); anything else is reported as `Error`.",
      "New leak found and closed: V8 stacks repeat the multi-line message as a header. Previously `ssn:123456789` on a body line came out as frame `<anon>:123456789`. Frames now strip the message header and ",
      "ROOT CAUSE: scrubbing free-form text with a denylist can never be complete. Engines echo bodies verbatim, across newlines, cut off mid-quote and into the stack header, so each review found another sha",
      "Verified: 4 spec files, 77/77 tests; `tsc` exits 0; biome is clean."
     ]
    }
   ],
   "verified": 8,
   "total": 8,
   "complete": true,
   "costUsd": 6.1255,
   "elapsedMs": 2261262
  },
  {
   "id": "3",
   "name": "Product and landing event instrumentation",
   "startLine": 298,
   "endLine": 428,
   "adds": "Every remaining catalogue event is wired with safe, bucketed props, including landing-page views and \"Open app\" clicks, with no change in behaviour when analytics is off.",
   "tryInUi": [
    "With analytics off, send a request, save it and create a chain and confirm the app behaves exactly as before",
    "Open the landing page and click an \"Open app\" button and confirm it still navigates",
    "Inspect the network tab and confirm no ingest request is made in dev."
   ],
   "checkpoint": {
    "title": "Checkpoint 3",
    "line": 425,
    "items": [
     "Leak test green, landing events fire under the same gating, no behaviour change with analytics off; `bun run lint:check`, `bun run typecheck`, `bun run test` green (SC2, SC11 events)."
    ]
   },
   "tasks": [
    {
     "id": "T3.1",
     "title": "Prop builders",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/lib/analytics/propBuilders.ts",
      "src/lib/analytics/events.ts"
     ],
     "gherkin": null,
     "do": "One pure builder per instrumented event that takes domain objects and returns only allowlisted props: method enum (non-standard to `other`), `status_class`, `duration_bucket`, node-count buckets, landing `path` enum (unknown to `other`, never query/hash), `referrerDomain` (hostname only, lowercased; same-site, empty or invalid to `direct`; IP-literal or `localhost` to `other`). Derive `shortcut_id` and `setting_id` enums from `src/app/settings/constants.ts`.",
     "spec": "R16",
     "filesDeclared": true,
     "acceptance": [
      "Builders accept seeded request data and their output contains only allowlisted props with enum or bucket values."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 303,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-20T15:15:12.815Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4771,
     "costApprox": true,
     "elapsedMs": 1345530,
     "summary": [
      "GeneralSection.spec.tsx: locale change emits exactly once with {setting_id:\"locale\", value_kind:\"enum\"}; picking current locale emits nothing; analytics toggle test asserts track not called.",
      "AppearanceSection.spec.tsx: theme change emits once with {setting_id:\"theme\", value_kind:\"enum\"}; picking current theme emits nothing and does not call onThemeChange.",
      "ProxySection.spec.tsx (new): ssl_verification and follow_redirects emit once with value_kind \"bool\"; proxy URL edit emits nothing.",
      "RelaySection.analytics.spec.tsx (new): relay_enabled emits once with value_kind \"bool\"."
     ]
    },
    {
     "id": "T3.2",
     "title": "Request lifecycle events",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.1",
      "T1.6"
     ],
     "files": [
      "src/hooks/useSendRequest.ts",
      "src/hooks/useSendRequest.spec.ts",
      "src/components/common/SampleRequestCards.tsx",
      "src/hooks/useSaveRequest.ts",
      "src/hooks/useSaveRequest.spec.ts"
     ],
     "gherkin": null,
     "do": "Emit `request_sent` on completion (source `manual|sample|history|chain|relay`), `first_request_sent` once ever per browser, `sample_request_used`, and `request_saved`. Keep the local feedback counters out of this path (they are separate, T6.2).",
     "spec": "R16",
     "filesDeclared": true,
     "acceptance": [
      "Events carry only builder props; behaviour and existing specs unchanged when analytics is disabled."
     ],
     "verify": [
      "bunx vitest run src/hooks/useSendRequest.spec.ts src/hooks/useSaveRequest.spec.ts"
     ],
     "line": 316,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T15:15:12.815Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "CHANGES",
        "security": "PASS"
       },
       "verifier": null
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.6184,
     "costApprox": true,
     "elapsedMs": 1345530,
     "summary": [
      "GeneralSection.spec.tsx: locale change emits exactly once with {setting_id:\"locale\", value_kind:\"enum\"}; picking current locale emits nothing; analytics toggle test asserts track not called.",
      "AppearanceSection.spec.tsx: theme change emits once with {setting_id:\"theme\", value_kind:\"enum\"}; picking current theme emits nothing and does not call onThemeChange.",
      "ProxySection.spec.tsx (new): ssl_verification and follow_redirects emit once with value_kind \"bool\"; proxy URL edit emits nothing.",
      "RelaySection.analytics.spec.tsx (new): relay_enabled emits once with value_kind \"bool\"."
     ]
    },
    {
     "id": "T3.3",
     "title": "Collection and environment events",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.1"
     ],
     "files": [
      "src/stores/useCollectionsStore.ts",
      "src/stores/useCollectionsStore.spec.ts",
      "src/stores/useEnvironmentsStore.ts",
      "src/stores/useEnvironmentsStore.spec.ts"
     ],
     "gherkin": null,
     "do": "Emit `collection_created`, `environment_created` (variable-count bucket) and `environment_switched` at the store actions that perform them; no names or values in props.",
     "spec": "R16",
     "filesDeclared": true,
     "acceptance": [
      "Each event fires once per action with allowlisted props only; store specs green."
     ],
     "verify": [
      "bunx vitest run src/stores/useCollectionsStore.spec.ts src/stores/useEnvironmentsStore.spec.ts"
     ],
     "line": 328,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-20T15:15:12.815Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4771,
     "costApprox": true,
     "elapsedMs": 1345530,
     "summary": [
      "GeneralSection.spec.tsx: locale change emits exactly once with {setting_id:\"locale\", value_kind:\"enum\"}; picking current locale emits nothing; analytics toggle test asserts track not called.",
      "AppearanceSection.spec.tsx: theme change emits once with {setting_id:\"theme\", value_kind:\"enum\"}; picking current theme emits nothing and does not call onThemeChange.",
      "ProxySection.spec.tsx (new): ssl_verification and follow_redirects emit once with value_kind \"bool\"; proxy URL edit emits nothing.",
      "RelaySection.analytics.spec.tsx (new): relay_enabled emits once with value_kind \"bool\"."
     ]
    },
    {
     "id": "T3.4",
     "title": "Chain events",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.1"
     ],
     "files": [
      "src/stores/useChainStore.ts",
      "src/stores/useChainStore.spec.ts",
      "src/hooks/useChainRun.ts",
      "src/hooks/useChainRun.spec.ts"
     ],
     "gherkin": null,
     "do": "Emit `chain_created` (source `manual|relay|import`) and `chain_run` at run end (status, node-count bucket, duration bucket, `has_loop`, `has_subchain`); no chain or node names.",
     "spec": "R16",
     "filesDeclared": true,
     "acceptance": [
      "One `chain_run` per run end including failed and stopped; specs green."
     ],
     "verify": [
      "bunx vitest run src/stores/useChainStore.spec.ts src/hooks/useChainRun.spec.ts"
     ],
     "line": 340,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-20T15:15:12.815Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4771,
     "costApprox": true,
     "elapsedMs": 1345531,
     "summary": [
      "GeneralSection.spec.tsx: locale change emits exactly once with {setting_id:\"locale\", value_kind:\"enum\"}; picking current locale emits nothing; analytics toggle test asserts track not called.",
      "AppearanceSection.spec.tsx: theme change emits once with {setting_id:\"theme\", value_kind:\"enum\"}; picking current theme emits nothing and does not call onThemeChange.",
      "ProxySection.spec.tsx (new): ssl_verification and follow_redirects emit once with value_kind \"bool\"; proxy URL edit emits nothing.",
      "RelaySection.analytics.spec.tsx (new): relay_enabled emits once with value_kind \"bool\"."
     ]
    },
    {
     "id": "T3.5",
     "title": "Share and import events",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.1"
     ],
     "files": [
      "src/components/request/ShareModal.tsx",
      "src/components/request/ShareModal.spec.tsx",
      "src/lib/shareLink.ts",
      "src/lib/shareLink.spec.ts",
      "src/components/import/ImportDialog.tsx"
     ],
     "gherkin": null,
     "do": "Emit `share_created` (expiry bucket only; no id, URL or key), `share_opened` where an incoming share link is resolved (start from `shareLink.ts` and grep for its caller), and `import_completed` (source type, item-count bucket).",
     "spec": "R16",
     "filesDeclared": true,
     "acceptance": [
      "No share id, URL or key appears in any prop; specs green."
     ],
     "verify": [
      "bunx vitest run src/components/request/ShareModal.spec.tsx src/lib/shareLink.spec.ts"
     ],
     "line": 352,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T15:15:12.815Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.6144,
     "costApprox": true,
     "elapsedMs": 1236206,
     "summary": [
      "GeneralSection.spec.tsx: locale change emits exactly once with {setting_id:\"locale\", value_kind:\"enum\"}; picking current locale emits nothing; analytics toggle test asserts track not called.",
      "AppearanceSection.spec.tsx: theme change emits once with {setting_id:\"theme\", value_kind:\"enum\"}; picking current theme emits nothing and does not call onThemeChange.",
      "ProxySection.spec.tsx (new): ssl_verification and follow_redirects emit once with value_kind \"bool\"; proxy URL edit emits nothing.",
      "RelaySection.analytics.spec.tsx (new): relay_enabled emits once with value_kind \"bool\"."
     ]
    },
    {
     "id": "T3.6",
     "title": "Backup, palette, shortcut and setting events",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.1"
     ],
     "files": [
      "src/components/settings/backup/useBackupExport.ts",
      "src/components/settings/backup/useBackupImport.ts",
      "src/components/common/CommandPalette.tsx",
      "src/components/common/CommandPalette.spec.tsx",
      "src/hooks/useKeyboardShortcuts.ts"
     ],
     "gherkin": null,
     "do": "Emit `backup_exported` (mode, size bucket), `backup_imported` (mode), `command_palette_opened`, and `shortcut_used` for allowlisted shortcut ids only. Settings changes (`setting_changed`, boolean/enum only, never the analytics toggle) are emitted from `GeneralSection.tsx` in T3.7.",
     "spec": "R16",
     "filesDeclared": true,
     "acceptance": [
      "Events carry enums/buckets only; the palette spec stays green."
     ],
     "verify": [
      "bunx vitest run src/components/common/CommandPalette.spec.tsx src/hooks/useKeyboardShortcuts.spec.ts"
     ],
     "line": 364,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T15:15:12.815Z",
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "CHANGES"
       },
       "verifier": null
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS"
       },
       "verifier": "skipped"
      }
     ],
     "costUsd": 0.3321,
     "costApprox": true,
     "elapsedMs": 1021187,
     "summary": [
      "GeneralSection.spec.tsx: locale change emits exactly once with {setting_id:\"locale\", value_kind:\"enum\"}; picking current locale emits nothing; analytics toggle test asserts track not called.",
      "AppearanceSection.spec.tsx: theme change emits once with {setting_id:\"theme\", value_kind:\"enum\"}; picking current theme emits nothing and does not call onThemeChange.",
      "ProxySection.spec.tsx (new): ssl_verification and follow_redirects emit once with value_kind \"bool\"; proxy URL edit emits nothing.",
      "RelaySection.analytics.spec.tsx (new): relay_enabled emits once with value_kind \"bool\"."
     ]
    },
    {
     "id": "T3.7",
     "title": "Setting-changed events",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.6",
      "T2.1"
     ],
     "files": [
      "src/components/settings/GeneralSection.tsx",
      "src/components/settings/GeneralSection.spec.tsx",
      "src/components/settings/AppearanceSection.tsx",
      "src/components/settings/AppearanceSection.spec.tsx"
     ],
     "gherkin": null,
     "do": "Emit `setting_changed` with an enum `setting_id` and `value_kind` for allowlisted settings only; never for the analytics toggle and never with free text.",
     "spec": "R16",
     "filesDeclared": true,
     "acceptance": [
      "The analytics toggle emits nothing; other allowlisted settings emit once per change."
     ],
     "verify": [
      "bunx vitest run src/components/settings/GeneralSection.spec.tsx src/components/settings/AppearanceSection.spec.tsx"
     ],
     "line": 376,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T15:15:12.815Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "FAIL"
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "FAIL"
      },
      {
       "n": 3,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 1.2735,
     "costApprox": true,
     "elapsedMs": 1441898,
     "summary": [
      "GeneralSection.spec.tsx: locale change emits exactly once with {setting_id:\"locale\", value_kind:\"enum\"}; picking current locale emits nothing; analytics toggle test asserts track not called.",
      "AppearanceSection.spec.tsx: theme change emits once with {setting_id:\"theme\", value_kind:\"enum\"}; picking current theme emits nothing and does not call onThemeChange.",
      "ProxySection.spec.tsx (new): ssl_verification and follow_redirects emit once with value_kind \"bool\"; proxy URL edit emits nothing.",
      "RelaySection.analytics.spec.tsx (new): relay_enabled emits once with value_kind \"bool\"."
     ]
    },
    {
     "id": "T3.8",
     "title": "Landing analytics",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.1"
     ],
     "files": [
      "src/components/landing/LandingAnalytics.tsx",
      "src/components/landing/PrimaryCta.tsx",
      "src/components/landing/nav/LandingNav.tsx",
      "src/components/landing/sections/FinalCta.tsx",
      "src/app//layout.tsx"
     ],
     "gherkin": null,
     "do": "A small client component fires `landing_viewed` once per load (path enum, referrer domain); CTA components fire `landing_cta_clicked` with a `cta_id` enum (`hero_open_app`, `nav_open_app`, `final_open_app`) via `onClick` without changing navigation. The adapter is initialised for landing routes through the same client init and gating (shared opt-out store and key). Mount `LandingAnalytics` in the home layout; extend to the features and compare layouts only if the same component can be reused without new files.",
     "spec": "R16",
     "filesDeclared": true,
     "acceptance": [
      "One `landing_viewed` per load; CTA clicks still navigate; nothing is sent when disabled; no prop carries a full URL, query, hash or full referrer (only the `path` enum and `referrer_domain`)."
     ],
     "verify": [
      "bunx vitest run src/components/landing/Nav.spec.tsx src/components/landing/nav/LandingNav.spec.tsx"
     ],
     "line": 388,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T15:15:12.815Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.6144,
     "costApprox": true,
     "elapsedMs": 1236206,
     "summary": [
      "GeneralSection.spec.tsx: locale change emits exactly once with {setting_id:\"locale\", value_kind:\"enum\"}; picking current locale emits nothing; analytics toggle test asserts track not called.",
      "AppearanceSection.spec.tsx: theme change emits once with {setting_id:\"theme\", value_kind:\"enum\"}; picking current theme emits nothing and does not call onThemeChange.",
      "ProxySection.spec.tsx (new): ssl_verification and follow_redirects emit once with value_kind \"bool\"; proxy URL edit emits nothing.",
      "RelaySection.analytics.spec.tsx (new): relay_enabled emits once with value_kind \"bool\"."
     ]
    },
    {
     "id": "T3.9",
     "title": "Unit: prop builders and leak test",
     "done": true,
     "kind": "unit",
     "depends": [
      "T3.8",
      "T3.5",
      "T3.4",
      "T3.2"
     ],
     "files": [
      "src/lib/analytics/propBuilders.ts"
     ],
     "gherkin": null,
     "do": "Write `propBuilders.spec.ts` feeding seeded request data (URLs, hosts, headers, bodies, env values, prompts, share ids) through every builder and asserting no output value contains any seeded string and every key is allowlisted (SC2c); cover referrer edge cases.",
     "spec": "R16",
     "filesDeclared": true,
     "acceptance": [
      "Coverage >= 80%; the leak test fails if a builder passes a raw URL through."
     ],
     "verify": [
      "bunx vitest run src/lib/analytics/propBuilders.spec.ts --coverage --coverage.include=src/lib/analytics/propBuilders.ts --coverage.reporter=text"
     ],
     "line": 401,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-20T15:15:12.815Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.2796,
     "costApprox": true,
     "elapsedMs": 786916,
     "summary": [
      "GeneralSection.spec.tsx: locale change emits exactly once with {setting_id:\"locale\", value_kind:\"enum\"}; picking current locale emits nothing; analytics toggle test asserts track not called.",
      "AppearanceSection.spec.tsx: theme change emits once with {setting_id:\"theme\", value_kind:\"enum\"}; picking current theme emits nothing and does not call onThemeChange.",
      "ProxySection.spec.tsx (new): ssl_verification and follow_redirects emit once with value_kind \"bool\"; proxy URL edit emits nothing.",
      "RelaySection.analytics.spec.tsx (new): relay_enabled emits once with value_kind \"bool\"."
     ]
    },
    {
     "id": "T3.10",
     "title": "E2E: landing events and app events under override",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T3.9"
     ],
     "files": [
      "e2e/qa/launch-readiness/analytics-events.spec.ts"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/launch-readiness/analytics-events.spec.ts`, R16",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/analytics-events.spec.ts --repeat-each=3"
     ],
     "line": 412,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-20T15:15:12.815Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4203,
     "costApprox": true,
     "elapsedMs": 746101,
     "summary": [
      "GeneralSection.spec.tsx: locale change emits exactly once with {setting_id:\"locale\", value_kind:\"enum\"}; picking current locale emits nothing; analytics toggle test asserts track not called.",
      "AppearanceSection.spec.tsx: theme change emits once with {setting_id:\"theme\", value_kind:\"enum\"}; picking current theme emits nothing and does not call onThemeChange.",
      "ProxySection.spec.tsx (new): ssl_verification and follow_redirects emit once with value_kind \"bool\"; proxy URL edit emits nothing.",
      "RelaySection.analytics.spec.tsx (new): relay_enabled emits once with value_kind \"bool\"."
     ]
    }
   ],
   "verified": 10,
   "total": 10,
   "complete": true,
   "costUsd": 5.584,
   "elapsedMs": 1551223
  },
  {
   "id": "4",
   "name": "Prompt arbitration and analytics notice",
   "startLine": 429,
   "endLine": 511,
   "adds": "One prompt at a time across the app: a shared arbiter decides between the tour, notice, What's New, backup reminder, feedback and the Relay coach, and a one-line non-blocking notice explains the anonymous analytics.",
   "tryInUi": [
    "With analytics enabled (env flag on, or `window.__RQ_ANALYTICS_E2E__ = true` set before load in dev), open the app in a fresh profile and confirm a one-line notice appears without blocking input",
    "Dismiss it and reload to confirm it does not return",
    "Open Relay while a prompt is showing and confirm only Relay's coach is visible."
   ],
   "checkpoint": {
    "title": "Checkpoint 4",
    "line": 508,
    "items": [
     "One prompt at a time proven by unit and e2e; `bun run lint:check`, `bun run typecheck`, `bun run test` and the arbitration spec green (SC8 part)."
    ]
   },
   "tasks": [
    {
     "id": "T4.1",
     "title": "Auto-prompt gate",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.2"
     ],
     "files": [
      "src/lib/prompts/useAutoPromptGate.ts"
     ],
     "gherkin": null,
     "do": "The session tracker already exists (T1.2). `useAutoPromptGate` returns true only on `/app` and `/chain` routes, not while a modal dialog is open, and not in the first session (`isFirstSession`).",
     "spec": "R44, R45",
     "filesDeclared": true,
     "acceptance": [
      "Gate false off-route, with an open dialog and in the first session; true otherwise."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 434,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-22T10:49:33.298Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.3441,
     "costApprox": true,
     "elapsedMs": 969788,
     "summary": [
      "T4.3 fix: notice message now says \"Requestr\" in en/fr/ja common.json (messages/ja belongs to T4.4, same string).",
      "Applied mobile width advisory: `w-[calc(100%-2rem)] sm:w-auto` replaces `max-w-[calc(100%-2rem)]`.",
      "Inline focus-visible classes kept; run-slop: SLOP PASS. AppProviders.spec.tsx passes (9). No spec asserted the old brand string.",
      "T4.3: brand copy and mobile width fixed"
     ]
    },
    {
     "id": "T4.2",
     "title": "Prompt arbitration store",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/stores/usePromptStore.ts"
     ],
     "gherkin": null,
     "do": "One active slot among `tour | analytics-notice | whats-new | backup-nudge | feedback | relay-coach`. `request(id, {priority, auto})` queues by priority (tour > analytics-notice > whats-new > backup-nudge > feedback) with stable insertion order for ties and grants only when the slot is free; `release(id)` frees and grants the next; `openUserInitiated(id)` takes the slot immediately, hides any showing auto prompt and re-queues it without consuming its shown or snooze state.",
     "spec": "R41, R42, R43",
     "filesDeclared": true,
     "acceptance": [
      "Two same-tick requests resolve deterministically; preemption re-queues; release on unmount never deadlocks."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 447,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-22T10:49:33.298Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.3441,
     "costApprox": true,
     "elapsedMs": 969788,
     "summary": [
      "T4.3 fix: notice message now says \"Requestr\" in en/fr/ja common.json (messages/ja belongs to T4.4, same string).",
      "Applied mobile width advisory: `w-[calc(100%-2rem)] sm:w-auto` replaces `max-w-[calc(100%-2rem)]`.",
      "Inline focus-visible classes kept; run-slop: SLOP PASS. AppProviders.spec.tsx passes (9). No spec asserted the old brand string.",
      "T4.3: brand copy and mobile width fixed"
     ]
    },
    {
     "id": "T4.3",
     "title": "Analytics notice and mounting",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T4.1",
      "T4.2",
      "T2.1"
     ],
     "files": [
      "src/components/common/AnalyticsNotice.tsx",
      "src/providers/AppProviders.tsx",
      "src/providers/AppProviders.spec.tsx",
      "messages/en/common.json",
      "messages/fr/common.json"
     ],
     "gherkin": null,
     "do": "Run `impeccable` for a quiet one-line notice with links to the privacy page and Settings; request the `analytics-notice` slot, release on cleanup; dismissal sets a shared flag (try/catch) so it never reappears; hidden when analytics is disabled by DNT/GPC/env; never blocks input. Mount for app and landing routes (landing has no other prompts, so it bypasses the app-route gate). The `ja` copy is added in T4.4. Update the provider spec.",
     "spec": "R20, R44",
     "filesDeclared": true,
     "acceptance": [
      "Notice shows once on first visit, never after dismissal, and not when disabled by DNT/GPC/env."
     ],
     "verify": [
      "bunx vitest run src/providers/AppProviders.spec.tsx"
     ],
     "line": 459,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T10:49:33.298Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "FAIL",
       "reviews": {
        "code": "PASS",
        "ux": "PASS",
        "ui": "CHANGES"
       },
       "verifier": null
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {},
       "verifier": null
      },
      {
       "n": 4,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "code": "PASS",
        "ux": "PASS",
        "ui": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.734,
     "costApprox": true,
     "elapsedMs": 969788,
     "summary": [
      "T4.3 fix: notice message now says \"Requestr\" in en/fr/ja common.json (messages/ja belongs to T4.4, same string).",
      "Applied mobile width advisory: `w-[calc(100%-2rem)] sm:w-auto` replaces `max-w-[calc(100%-2rem)]`.",
      "Inline focus-visible classes kept; run-slop: SLOP PASS. AppProviders.spec.tsx passes (9). No spec asserted the old brand string.",
      "T4.3: brand copy and mobile width fixed"
     ]
    },
    {
     "id": "T4.4",
     "title": "Notice copy (ja) and Relay coach registration",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T4.2",
      "T4.3"
     ],
     "files": [
      "messages/ja/common.json",
      "src/components/relay/RelayDock.tsx",
      "src/components/relay/RelayDock.spec.tsx"
     ],
     "gherkin": null,
     "do": "Add the `ja` notice strings. Register `relay-coach` by calling `openUserInitiated(\"relay-coach\")` from the dock open path and releasing on close, without editing `RelayOnboarding.tsx`; if impossible, use the smallest edit in the dock open handler and flag it as an advisory.",
     "spec": "R42, R43",
     "filesDeclared": true,
     "acceptance": [
      "Opening Relay takes the slot and hides any auto prompt; closing releases it; `RelayOnboarding.tsx` is unmodified."
     ],
     "verify": [
      "bunx vitest run src/components/relay/RelayDock.spec.tsx",
      "`git diff --stat src/components/relay/RelayOnboarding.tsx` (expect no output)"
     ],
     "line": 472,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T10:49:33.298Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "code": "PASS",
        "ux": "PASS",
        "ui": "PASS"
       },
       "verifier": null
      },
      {
       "n": 4,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "code": "PASS",
        "ux": "PASS",
        "ui": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.734,
     "costApprox": true,
     "elapsedMs": 969789,
     "summary": [
      "T4.3 fix: notice message now says \"Requestr\" in en/fr/ja common.json (messages/ja belongs to T4.4, same string).",
      "Applied mobile width advisory: `w-[calc(100%-2rem)] sm:w-auto` replaces `max-w-[calc(100%-2rem)]`.",
      "Inline focus-visible classes kept; run-slop: SLOP PASS. AppProviders.spec.tsx passes (9). No spec asserted the old brand string.",
      "T4.3: brand copy and mobile width fixed"
     ]
    },
    {
     "id": "T4.5",
     "title": "Unit: arbitration store and gate",
     "done": true,
     "kind": "unit",
     "depends": [
      "T4.4"
     ],
     "files": [
      "src/stores/usePromptStore.ts",
      "src/lib/prompts/useAutoPromptGate.ts"
     ],
     "gherkin": null,
     "do": "Write `usePromptStore.spec.ts` (priority order, same-tick determinism, preemption and re-queue without consuming state, release-on-cleanup using a fake-prompt harness) and `useAutoPromptGate.spec.ts` (route, open dialog, first session). The session tracker is covered in T1.8.",
     "spec": "R41, R42, R43, R45",
     "filesDeclared": true,
     "acceptance": [
      "Per-file coverage >= 80%."
     ],
     "verify": [
      "bunx vitest run src/stores/usePromptStore.spec.ts src/lib/prompts/useAutoPromptGate.spec.ts --coverage --coverage.include=src/stores/usePromptStore.ts --coverage.include=src/lib/prompts/useAutoPromptGate.ts --coverage.reporter=text"
     ],
     "line": 484,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-22T10:49:33.298Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.3332,
     "costApprox": true,
     "elapsedMs": 773645,
     "summary": [
      "T4.3 fix: notice message now says \"Requestr\" in en/fr/ja common.json (messages/ja belongs to T4.4, same string).",
      "Applied mobile width advisory: `w-[calc(100%-2rem)] sm:w-auto` replaces `max-w-[calc(100%-2rem)]`.",
      "Inline focus-visible classes kept; run-slop: SLOP PASS. AppProviders.spec.tsx passes (9). No spec asserted the old brand string.",
      "T4.3: brand copy and mobile width fixed"
     ]
    },
    {
     "id": "T4.6",
     "title": "E2E: notice and arbitration",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T4.5"
     ],
     "files": [
      "e2e/qa/launch-readiness/prompt-arbitration.spec.ts",
      "agent_docs/qa/prompt-arbitration/"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/launch-readiness/prompt-arbitration.spec.ts`, R20, R41, R43, R44",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/prompt-arbitration.spec.ts --repeat-each=3"
     ],
     "line": 495,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T10:49:33.298Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {},
       "verifier": "FAIL"
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.7839,
     "costApprox": true,
     "elapsedMs": 833868,
     "summary": [
      "T4.3 fix: notice message now says \"Requestr\" in en/fr/ja common.json (messages/ja belongs to T4.4, same string).",
      "Applied mobile width advisory: `w-[calc(100%-2rem)] sm:w-auto` replaces `max-w-[calc(100%-2rem)]`.",
      "Inline focus-visible classes kept; run-slop: SLOP PASS. AppProviders.spec.tsx passes (9). No spec asserted the old brand string.",
      "T4.3: brand copy and mobile width fixed"
     ]
    }
   ],
   "verified": 6,
   "total": 6,
   "complete": true,
   "costUsd": 3.2733,
   "elapsedMs": 1081803
  },
  {
   "id": "5",
   "name": "First-run tour",
   "startLine": 512,
   "endLine": 622,
   "adds": "A guided first-run tour of about 7 steps in Requestr's own design, started once on desktop, replayable from Settings and the command palette; the old dead tour and its dependency are removed.",
   "tryInUi": [
    "Open `/app` in a fresh desktop profile and confirm the tour starts and shows \"Step 1/7\"",
    "Press Skip, reload, and confirm it does not restart",
    "Open the command palette or Settings and choose \"Replay tour\"."
   ],
   "checkpoint": {
    "title": "Checkpoint 5",
    "line": 619,
    "items": [
     "Tour works end to end and the old tour and `boarding.js` are gone; `bun run lint:check`, `bun run typecheck`, `bun run test` and the tour spec green (SC1, SC9)."
    ]
   },
   "tasks": [
    {
     "id": "T5.1",
     "title": "Spike: driver.js with a React popover",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "package.json",
      "bun.lock",
      "src/components/tour/TourPopover.tsx",
      "src/stores/useTourStore.ts"
     ],
     "gherkin": null,
     "do": "Run `impeccable`, then `bun add driver.js`. Prove the popover contract before writing steps: `TourPopover` rendered per popover through driver.js custom rendering shows \"step x/N\", Back, Next, Skip and a close button with shadcn tokens in light and dark, Esc and arrow keys, focus trap, and animation off under reduced motion. `useTourStore` holds active flag, trigger (`auto|replay`) and current step. Record the working integration in the task Log.",
     "spec": "R1, R9",
     "filesDeclared": true,
     "acceptance": [
      "A one-step demo tour renders the custom popover, keyboard navigation works, reduced motion disables animation."
     ],
     "verify": [
      "bun run typecheck",
      "grep -n \"driver.js\" package.json"
     ],
     "line": 517,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T11:31:34.731Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "code": "PASS",
        "ui": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.8656,
     "costApprox": true,
     "elapsedMs": 1904338,
     "summary": [
      "T5.4: `src/lib/tour/useTourAutoStart.ts` new effect; `useTourAutoStart.spec.ts` updated with tests \"ends an already-running tour when mounted off /app\" and \"ends a running replay tour when the route l",
      "Also resolves the T5.5 `useReplayTour.ts` finding (same cause).",
      "Not addressed (advisory only): skip markComplete on replay; single translator cast."
     ]
    },
    {
     "id": "T5.2",
     "title": "Anchors and steps",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T5.1"
     ],
     "files": [
      "src/lib/tour/tourAnchors.ts",
      "src/lib/tour/tourSteps.ts",
      "messages/en/common.json",
      "messages/fr/common.json",
      "messages/ja/common.json"
     ],
     "gherkin": null,
     "do": "Declare `TOUR_ANCHORS` once (url-bar-send, sample-requests, save-to-collection, environments, chains, relay-dock) and define the ordered steps referencing the map only (no raw strings): URL bar + send (Ctrl+Enter), sample requests, save to collection, environments, Chains canvas, Relay AI dock, command palette (Ctrl+K) / shortcuts (Ctrl+/). The command palette has no always-visible trigger (it opens only from Ctrl+K), so the last step is an element-less centred popover that always resolves. Add tour copy in en/fr/ja.",
     "spec": "R2, R3, R9",
     "filesDeclared": true,
     "acceptance": [
      "Seven steps in the specified order; the last step has no anchor; no raw anchor strings outside the map; copy exists in all locales."
     ],
     "verify": [
      "bunx vitest run src/i18n"
     ],
     "line": 529,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-22T11:31:34.731Z",
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "ui": "PASS",
        "code": "PASS"
       },
       "verifier": "skipped"
      }
     ],
     "costUsd": 0.4281,
     "costApprox": true,
     "elapsedMs": 1298410,
     "summary": [
      "T5.4: `src/lib/tour/useTourAutoStart.ts` new effect; `useTourAutoStart.spec.ts` updated with tests \"ends an already-running tour when mounted off /app\" and \"ends a running replay tour when the route l",
      "Also resolves the T5.5 `useReplayTour.ts` finding (same cause).",
      "Not addressed (advisory only): skip markComplete on replay; single translator cast."
     ]
    },
    {
     "id": "T5.3",
     "title": "Apply `data-tour` attributes",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T5.2"
     ],
     "files": [
      "src/components/common/SampleRequestCards.tsx",
      "src/components/environment/EnvSelector.tsx",
      "src/components/request/UrlBar.tsx",
      "src/components/relay/RelayToggleButton.tsx",
      "src/components/layout/SidebarMainTab.tsx"
     ],
     "gherkin": null,
     "do": "Apply `data-tour={TOUR_ANCHORS.<id>}` to existing elements that are visible on a fresh `/app`: sample cards, environment selector, the URL input plus Send button group and the Save button in `UrlBar.tsx` (`url-bar-send`, `save-to-collection`), Relay toggle, and the always-visible Chains accordion trigger in `SidebarMainTab.tsx` (not `ChainList`, which sits inside collapsible content). Existing specs stay green.",
     "spec": "R2",
     "filesDeclared": true,
     "acceptance": [
      "Each listed element exposes the matching attribute and is visible on a fresh `/app` at desktop width; no layout change."
     ],
     "verify": [
      "bunx vitest run src/components/environment src/components/request/UrlBar.spec.tsx src/components/relay/RelayToggleButton.spec.tsx src/components/layout/SidebarMainTab.spec.tsx"
     ],
     "line": 541,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T11:31:34.731Z",
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "ui": "PASS",
        "code": "PASS"
       },
       "verifier": "skipped"
      }
     ],
     "costUsd": 0.5443,
     "costApprox": true,
     "elapsedMs": 1298410,
     "summary": [
      "T5.4: `src/lib/tour/useTourAutoStart.ts` new effect; `useTourAutoStart.spec.ts` updated with tests \"ends an already-running tour when mounted off /app\" and \"ends a running replay tour when the route l",
      "Also resolves the T5.5 `useReplayTour.ts` finding (same cause).",
      "Not addressed (advisory only): skip markComplete on replay; single translator cast."
     ]
    },
    {
     "id": "T5.4",
     "title": "Start logic and auto-start",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T5.3",
      "T4.2"
     ],
     "files": [
      "src/lib/tour/startTour.ts",
      "src/lib/tour/useTourAutoStart.ts",
      "src/components/layout/MainLayout.tsx",
      "src/components/layout/MainLayout.spec.tsx"
     ],
     "gherkin": null,
     "do": "`startTour` filters to steps whose anchor exists and is visible, waits up to `TOUR_ANCHOR_WAIT_MS` (3s) for anchors to mount, aborts with a toast when fewer than `MIN_TOUR_STEPS` (4) resolve without marking complete on auto-start, takes the `tour` slot, destroys on route change (releasing the slot) and refreshes positions on resize. `useTourAutoStart` starts once on `/app` when `rq_onboarding_complete` is unset and the viewport is desktop (>= 768px); it does not auto-start under `navigator.webdriver` unless `window.__RQ_TOUR_E2E__ === true` (keeps existing e2e and capture runs unaffected). Completion or skip sets `rq_onboarding_complete`; a mid-tour reload restarts the tour (SPEC OQ-A). Mount the hook in `MainLayout.tsx` and remove the commented-out `OnboardingTour` use.",
     "spec": "R4, R5, R6, R8",
     "filesDeclared": true,
     "acceptance": [
      "Below 768px no auto-start; with `rq_onboarding_complete` set no auto-start; under webdriver without `__RQ_TOUR_E2E__` no auto-start.",
      "Fewer than four visible anchors yields a toast and no start; step count \"x/N\" reflects only resolved steps."
     ],
     "verify": [
      "bunx vitest run src/components/layout/MainLayout.spec.tsx"
     ],
     "line": 553,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T11:31:34.731Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "logic",
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "code": "CHANGES",
        "ui": "PASS"
       },
       "verifier": null
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "code": "PASS",
        "ux": "PASS",
        "ui": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.8866,
     "costApprox": true,
     "elapsedMs": 1904339,
     "summary": [
      "T5.4: `src/lib/tour/useTourAutoStart.ts` new effect; `useTourAutoStart.spec.ts` updated with tests \"ends an already-running tour when mounted off /app\" and \"ends a running replay tour when the route l",
      "Also resolves the T5.5 `useReplayTour.ts` finding (same cause).",
      "Not addressed (advisory only): skip markComplete on replay; single translator cast."
     ]
    },
    {
     "id": "T5.5",
     "title": "Replay entry points and tour events",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T5.4",
      "T3.6"
     ],
     "files": [
      "src/components/settings/GeneralSection.tsx",
      "src/components/settings/GeneralSection.spec.tsx",
      "src/components/common/CommandPalette.tsx",
      "src/components/common/CommandPalette.spec.tsx",
      "src/lib/tour/startTour.ts"
     ],
     "gherkin": null,
     "do": "Add a \"Replay tour\" action in Settings -> General and the command palette; replay ignores the completed flag, takes the slot as a user-initiated open, restarts cleanly mid-tour with no duplicate overlays and emits no first-run side effects. Emit `tour_started`, `tour_step_viewed`, `tour_completed`, `tour_skipped`. After the tour ends or is skipped the analytics notice shows (first-visit sequence).",
     "spec": "R7, R48, R44",
     "filesDeclared": true,
     "acceptance": [
      "Replay works with the flag set; events fire with allowlisted props; replay mid-tour leaves a single overlay."
     ],
     "verify": [
      "bunx vitest run src/components/settings/GeneralSection.spec.tsx src/components/common/CommandPalette.spec.tsx"
     ],
     "line": 568,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T11:31:34.731Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "code": "CHANGES",
        "ui": "PASS"
       },
       "verifier": null
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "code": "PASS",
        "ux": "PASS",
        "ui": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.9491,
     "costApprox": true,
     "elapsedMs": 1522523,
     "summary": [
      "T5.4: `src/lib/tour/useTourAutoStart.ts` new effect; `useTourAutoStart.spec.ts` updated with tests \"ends an already-running tour when mounted off /app\" and \"ends a running replay tour when the route l",
      "Also resolves the T5.5 `useReplayTour.ts` finding (same cause).",
      "Not addressed (advisory only): skip markComplete on replay; single translator cast."
     ]
    },
    {
     "id": "T5.6",
     "title": "Remove the old tour",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T5.4"
     ],
     "files": [
      "src/components/common/OnboardingTour.tsx",
      "src/hooks/useFirstTimeUser.ts",
      "src/hooks/useFirstTimeUser.spec.ts",
      "package.json",
      "bun.lock"
     ],
     "gherkin": null,
     "do": "Delete `OnboardingTour.tsx`, `useFirstTimeUser.ts` and its spec with `git rm`, and remove `boarding.js` via `bun remove boarding.js`. Confirm no remaining import. `RelayOnboarding.tsx` is untouched.",
     "spec": "R1, R8",
     "filesDeclared": true,
     "acceptance": [
      "`grep -rn \"boarding.js\\|OnboardingTour\\|useFirstTimeUser\" package.json bun.lock src` is empty (SC9)."
     ],
     "verify": [
      "`grep -rn \"boarding.js\\|OnboardingTour\\|useFirstTimeUser\" package.json bun.lock src` (expect no output)",
      "bun run typecheck"
     ],
     "line": 580,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T11:31:34.731Z",
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS"
       },
       "verifier": "skipped"
      }
     ],
     "costUsd": 0.3245,
     "costApprox": true,
     "elapsedMs": 1022291,
     "summary": [
      "T5.4: `src/lib/tour/useTourAutoStart.ts` new effect; `useTourAutoStart.spec.ts` updated with tests \"ends an already-running tour when mounted off /app\" and \"ends a running replay tour when the route l",
      "Also resolves the T5.5 `useReplayTour.ts` finding (same cause).",
      "Not addressed (advisory only): skip markComplete on replay; single translator cast."
     ]
    },
    {
     "id": "T5.7",
     "title": "Unit: tour logic",
     "done": true,
     "kind": "unit",
     "depends": [
      "T5.6",
      "T5.5"
     ],
     "files": [
      "src/lib/tour/startTour.ts",
      "src/lib/tour/useTourAutoStart.ts",
      "src/lib/tour/tourSteps.ts",
      "src/stores/useTourStore.ts"
     ],
     "gherkin": null,
     "do": "Write specs for anchor resolution (visible-only, bounded wait), `MIN_TOUR_STEPS` guard with toast and no-complete, auto-start gating (desktop, flag, route, webdriver suppression and the `__RQ_TOUR_E2E__` opt-in), replay ignoring the flag, step list order, and store transitions. Do not test anything under `src/components/reactbits/`.",
     "spec": "R4, R5, R6",
     "filesDeclared": true,
     "acceptance": [
      "Per-file coverage >= 80%."
     ],
     "verify": [
      "bunx vitest run src/lib/tour/startTour.spec.ts src/lib/tour/useTourAutoStart.spec.ts src/lib/tour/tourSteps.spec.ts src/stores/useTourStore.spec.ts --coverage --coverage.include=src/lib/tour/startTour.ts --coverage.include=src/lib/tour/useTourAutoStart.ts --coverage.include=src/lib/tour/tourSteps.ts --coverage.include=src/stores/useTourStore.ts --coverage.reporter=text"
     ],
     "line": 591,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-22T11:31:34.731Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.5992,
     "costApprox": true,
     "elapsedMs": 1258384,
     "summary": [
      "T5.4: `src/lib/tour/useTourAutoStart.ts` new effect; `useTourAutoStart.spec.ts` updated with tests \"ends an already-running tour when mounted off /app\" and \"ends a running replay tour when the route l",
      "Also resolves the T5.5 `useReplayTour.ts` finding (same cause).",
      "Not addressed (advisory only): skip markComplete on replay; single translator cast."
     ]
    },
    {
     "id": "T5.8",
     "title": "E2E: first-run tour",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T5.7"
     ],
     "files": [
      "e2e/qa/launch-readiness/tour.spec.ts"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/launch-readiness/tour.spec.ts`, R6, R7, R9, R44",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/tour.spec.ts --repeat-each=3"
     ],
     "line": 602,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T11:31:34.731Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.5773,
     "costApprox": true,
     "elapsedMs": 1258384,
     "summary": [
      "T5.4: `src/lib/tour/useTourAutoStart.ts` new effect; `useTourAutoStart.spec.ts` updated with tests \"ends an already-running tour when mounted off /app\" and \"ends a running replay tour when the route l",
      "Also resolves the T5.5 `useReplayTour.ts` finding (same cause).",
      "Not addressed (advisory only): skip markComplete on replay; single translator cast."
     ]
    }
   ],
   "verified": 8,
   "total": 8,
   "complete": true,
   "costUsd": 5.1747,
   "elapsedMs": 1904339
  },
  {
   "id": "6",
   "name": "Feedback",
   "startLine": 623,
   "endLine": 741,
   "adds": "A \"Feedback\" item in the sidebar footer and the command palette that opens a rating dialog, plus one gentle auto-prompt after the user has really used the app; it works even when analytics is off.",
   "tryInUi": [
    "Click \"Feedback\" in the sidebar footer: without PostHog env the submit button is disabled with an explanation",
    "with the survey env set (or `window.__RQ_ANALYTICS_E2E__ = true` in dev) submit a 4-star rating",
    "Open the command palette and choose Feedback",
    "Enter an invalid email and confirm inline validation and that the draft is kept on failure."
   ],
   "checkpoint": {
    "title": "Checkpoint 6",
    "line": 738,
    "items": [
     "Feedback works manually and by auto-prompt and respects arbitration; `bun run lint:check`, `bun run typecheck`, `bun run test` and the feedback spec green (SC5, SC3)."
    ]
   },
   "tasks": [
    {
     "id": "T6.1",
     "title": "Eligibility and state",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T4.1"
     ],
     "files": [
      "src/lib/feedback/eligibility.ts",
      "src/lib/feedback/feedbackState.ts"
     ],
     "gherkin": null,
     "do": "`eligibility.ts` is pure: sessions on >= 3 separate calendar days AND (>= 10 successful requests OR >= 1 chain run OR >= 1 Relay action); never first session; not within 30 days of a dismiss; never after submit; at most one auto-prompt per session; idle (no request in flight, no chain run, no focused input/textarea/editor, no pointer or key activity within the idle-window constant, 3s). `feedbackState.ts` keeps counters and state in versioned localStorage keys (try/catch, memory fallback, ignores future-dated days), independent of analytics consent.",
     "spec": "R30, R31, R33, R34",
     "filesDeclared": true,
     "acceptance": [
      "Unit-fixture inputs produce the SC5 outcomes; counters keep working with analytics off."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 628,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-22T16:28:50.238Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.5916,
     "costApprox": true,
     "elapsedMs": 1918464,
     "summary": [
      "FeedbackAutoPrompt.spec.tsx rewritten (the original ~20 tests were lost to my earlier overwrite; no backup existed). Now 20 tests: mount-time regression, activity reset, listener cleanup, in-flight, c",
      "Coverage FeedbackAutoPrompt.tsx: 100% stmts/branches/funcs/lines. Typecheck clean; feedback + MainLayout specs 63 pass."
     ]
    },
    {
     "id": "T6.2",
     "title": "Counter call sites",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T6.1",
      "T3.4"
     ],
     "files": [
      "src/hooks/useSendRequest.ts",
      "src/hooks/useSendRequest.spec.ts",
      "src/hooks/useChainRun.ts",
      "src/hooks/useChainRun.spec.ts",
      "src/lib/relay/changeLog.ts"
     ],
     "gherkin": null,
     "do": "Increment successful-request, chain-run and Relay-action counters at the same sites that emit analytics events, but not through `track()` so they work with analytics off.",
     "spec": "R30, R34",
     "filesDeclared": true,
     "acceptance": [
      "Counters increment once per success, chain run and applied Relay change; specs green."
     ],
     "verify": [
      "bunx vitest run src/hooks/useSendRequest.spec.ts src/hooks/useChainRun.spec.ts src/lib/relay/changeLog.spec.ts"
     ],
     "line": 641,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-22T16:28:50.238Z",
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "CHANGES"
       },
       "verifier": null
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS"
       },
       "verifier": "skipped"
      }
     ],
     "costUsd": 0.3409,
     "costApprox": true,
     "elapsedMs": 1201704,
     "summary": [
      "FeedbackAutoPrompt.spec.tsx rewritten (the original ~20 tests were lost to my earlier overwrite; no backup existed). Now 20 tests: mount-time regression, activity reset, listener cleanup, in-flight, c",
      "Coverage FeedbackAutoPrompt.tsx: 100% stmts/branches/funcs/lines. Typecheck clean; feedback + MainLayout specs 63 pass."
     ]
    },
    {
     "id": "T6.3",
     "title": "Feedback dialog",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T6.1",
      "T1.3",
      "T4.2"
     ],
     "files": [
      "src/components/feedback/FeedbackDialog.tsx",
      "messages/en/common.json",
      "messages/fr/common.json",
      "messages/ja/common.json"
     ],
     "gherkin": null,
     "do": "Run `impeccable`, then build the dialog: required 1-5 rating, optional text (max `FEEDBACK_TEXT_MAX`), optional validated email, statement that text and email are sent as written, inline error that keeps the draft on offline or route error, submit disabled with an explanation when the survey is not configured. Submit calls `submitSurvey()`; an explicit submission is sent even when analytics is off, carrying no analytics id and only `app_version`, and no `feedback_*` tracking events are emitted in that case.",
     "spec": "R29, R34",
     "filesDeclared": true,
     "acceptance": [
      "Rating required; invalid email blocked inline; failure keeps the draft and the dialog open; when analytics is on, `feedback_submitted` is emitted with `rating`, `has_text`, `has_email`."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 653,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T16:28:50.238Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "ui",
      "security"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "ui": "PASS",
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 1.0411,
     "costApprox": true,
     "elapsedMs": 1918464,
     "summary": [
      "FeedbackAutoPrompt.spec.tsx rewritten (the original ~20 tests were lost to my earlier overwrite; no backup existed). Now 20 tests: mount-time regression, activity reset, listener cleanup, in-flight, c",
      "Coverage FeedbackAutoPrompt.tsx: 100% stmts/branches/funcs/lines. Typecheck clean; feedback + MainLayout specs 63 pass."
     ]
    },
    {
     "id": "T6.4",
     "title": "Survey availability build-time flag",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T6.3"
     ],
     "files": [
      "next.config.ts",
      "src/providers/AppProviders.tsx",
      "src/providers/AppProviders.spec.tsx"
     ],
     "gherkin": null,
     "do": "In `next.config.ts`, compute at build time whether `POSTHOG_FEEDBACK_SURVEY_ID` and `POSTHOG_KEY` are both set and expose only the resulting boolean as `NEXT_PUBLIC_FEEDBACK_SURVEY_CONFIGURED` via `env` (never the id or key; static rendering is unaffected). `AppProviders` exposes it to the dialog via a small context. In non-production with `window.__RQ_ANALYTICS_E2E__` set, treat the survey as configured so e2e can exercise submit (SPEC OQ-D).",
     "spec": "R29, R22a",
     "filesDeclared": true,
     "acceptance": [
      "The dialog's submit button is disabled with the explanatory message when the flag is false; only the boolean is placed in `next.config.ts` `env` (no survey id or key), and the provider spec asserts the context reads only that boolean; `/api/ingest` still returns a constant 204."
     ],
     "verify": [
      "bunx vitest run src/providers/AppProviders.spec.tsx"
     ],
     "line": 666,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T16:28:50.238Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "logic",
      "security"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "security",
       "model": "opus"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "FAIL"
      },
      {
       "n": 3,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS",
        "security": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 1.0801,
     "costApprox": true,
     "elapsedMs": 2569142,
     "summary": [
      "FeedbackAutoPrompt.spec.tsx rewritten (the original ~20 tests were lost to my earlier overwrite; no backup existed). Now 20 tests: mount-time regression, activity reset, listener cleanup, in-flight, c",
      "Coverage FeedbackAutoPrompt.tsx: 100% stmts/branches/funcs/lines. Typecheck clean; feedback + MainLayout specs 63 pass."
     ]
    },
    {
     "id": "T6.5",
     "title": "Entry points",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T6.4",
      "T5.5"
     ],
     "files": [
      "src/components/layout/LeftPanel.tsx",
      "src/components/layout/LeftPanel.spec.tsx",
      "src/components/common/CommandPalette.tsx",
      "src/components/common/CommandPalette.spec.tsx"
     ],
     "gherkin": null,
     "do": "Add a \"Feedback\" item in the sidebar footer (new; there is no help menu today) and in the command palette. Opening takes the slot immediately (user-initiated, no eligibility checks) and re-queues any auto prompt without consuming its state.",
     "spec": "R28, R43",
     "filesDeclared": true,
     "acceptance": [
      "Both entry points open the dialog at any time, including during the first session."
     ],
     "verify": [
      "bunx vitest run src/components/layout/LeftPanel.spec.tsx src/components/common/CommandPalette.spec.tsx"
     ],
     "line": 677,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T16:28:50.238Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "ui": "PASS",
        "code": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 1.2591,
     "costApprox": true,
     "elapsedMs": 2397567,
     "summary": [
      "FeedbackAutoPrompt.spec.tsx rewritten (the original ~20 tests were lost to my earlier overwrite; no backup existed). Now 20 tests: mount-time regression, activity reset, listener cleanup, in-flight, c",
      "Coverage FeedbackAutoPrompt.tsx: 100% stmts/branches/funcs/lines. Typecheck clean; feedback + MainLayout specs 63 pass."
     ]
    },
    {
     "id": "T6.6",
     "title": "Auto-prompt",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T6.5",
      "T4.2"
     ],
     "files": [
      "src/components/feedback/FeedbackAutoPrompt.tsx",
      "src/components/layout/MainLayout.tsx",
      "src/components/layout/MainLayout.spec.tsx"
     ],
     "gherkin": null,
     "do": "Mount in `MainLayout.tsx`. Compute idle as: no request in flight, no chain run in progress, no focused input/textarea/contenteditable/editor, and no pointer or key activity within the 3s idle-window constant; pass it to `isFeedbackEligible`. At show-time re-read localStorage state (multi-tab safe), request the `feedback` slot at lowest priority, release on cleanup, dismiss snoozes 30 days, submit sets never-ask-again, at most one auto-prompt per session. Emit `feedback_prompt_shown`/`feedback_prompt_dismissed` only when analytics is on. Opted-out users still get the prompt.",
     "spec": "R31, R32, R33, R34",
     "filesDeclared": true,
     "acceptance": [
      "Never during the tour, What's New, backup reminder or notice; never in the first session; never while a request is in flight or an input is focused; dismissal and submit state persist; an opted-out user still gets the prompt."
     ],
     "verify": [
      "bunx vitest run src/components/layout/MainLayout.spec.tsx"
     ],
     "line": 689,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T16:28:50.238Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui",
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "FAIL",
       "slop": "PASS",
       "reviews": {},
       "verifier": null
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "ui": "PASS",
        "code": "PASS"
       },
       "verifier": "FAIL"
      },
      {
       "n": 3,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "code": "PASS",
        "ux": "PASS",
        "ui": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 1.4582,
     "costApprox": true,
     "elapsedMs": 2397567,
     "summary": [
      "FeedbackAutoPrompt.spec.tsx rewritten (the original ~20 tests were lost to my earlier overwrite; no backup existed). Now 20 tests: mount-time regression, activity reset, listener cleanup, in-flight, c",
      "Coverage FeedbackAutoPrompt.tsx: 100% stmts/branches/funcs/lines. Typecheck clean; feedback + MainLayout specs 63 pass."
     ]
    },
    {
     "id": "T6.7",
     "title": "Unit: eligibility and state",
     "done": true,
     "kind": "unit",
     "depends": [
      "T6.6"
     ],
     "files": [
      "src/lib/feedback/eligibility.ts",
      "src/lib/feedback/feedbackState.ts"
     ],
     "gherkin": null,
     "do": "Write fixtures per SC5: day counting, thresholds, first session, idle window, 30-day snooze, submit-forever, once per session, future-dated entries, storage failure, and eligibility unchanged when analytics is opted out (R34).",
     "spec": "R30, R31, R33, R34",
     "filesDeclared": true,
     "acceptance": [
      "Per-file coverage >= 80%; each SC5 rule has a failing-case test."
     ],
     "verify": [
      "bunx vitest run src/lib/feedback/eligibility.spec.ts src/lib/feedback/feedbackState.spec.ts --coverage --coverage.include=src/lib/feedback/eligibility.ts --coverage.include=src/lib/feedback/feedbackState.ts --coverage.reporter=text"
     ],
     "line": 702,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-22T16:28:50.238Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.5794,
     "costApprox": true,
     "elapsedMs": 2305090,
     "summary": [
      "FeedbackAutoPrompt.spec.tsx rewritten (the original ~20 tests were lost to my earlier overwrite; no backup existed). Now 20 tests: mount-time regression, activity reset, listener cleanup, in-flight, c",
      "Coverage FeedbackAutoPrompt.tsx: 100% stmts/branches/funcs/lines. Typecheck clean; feedback + MainLayout specs 63 pass."
     ]
    },
    {
     "id": "T6.8",
     "title": "Unit: feedback dialog",
     "done": true,
     "kind": "unit",
     "depends": [
      "T6.7"
     ],
     "files": [
      "src/components/feedback/FeedbackDialog.tsx",
      "src/components/feedback/FeedbackAutoPrompt.tsx"
     ],
     "gherkin": null,
     "do": "Write `FeedbackDialog.spec.tsx` and `FeedbackAutoPrompt.spec.tsx` (start with `// @vitest-environment happy-dom`): rating required, email validation, draft kept on failure, disabled when unconfigured, explicit submit with analytics off sends only `app_version`, auto-prompt arbitration behaviour, idle detection (in-flight request, focused input, recent activity), and an opted-out user still gets the auto-prompt with no `feedback_prompt_*` events.",
     "spec": "R29, R34",
     "filesDeclared": true,
     "acceptance": [
      "Per-file coverage >= 80%."
     ],
     "verify": [
      "bunx vitest run src/components/feedback/FeedbackDialog.spec.tsx src/components/feedback/FeedbackAutoPrompt.spec.tsx --coverage --coverage.include=src/components/feedback/FeedbackDialog.tsx --coverage.include=src/components/feedback/FeedbackAutoPrompt.tsx --coverage.reporter=text"
     ],
     "line": 713,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T16:28:50.238Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "FAIL"
      },
      {
       "n": 2,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.89,
     "costApprox": true,
     "elapsedMs": 2305090,
     "summary": [
      "FeedbackAutoPrompt.spec.tsx rewritten (the original ~20 tests were lost to my earlier overwrite; no backup existed). Now 20 tests: mount-time regression, activity reset, listener cleanup, in-flight, c",
      "Coverage FeedbackAutoPrompt.tsx: 100% stmts/branches/funcs/lines. Typecheck clean; feedback + MainLayout specs 63 pass."
     ]
    },
    {
     "id": "T6.9",
     "title": "E2E: feedback",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T6.8"
     ],
     "files": [
      "e2e/qa/launch-readiness/feedback.spec.ts"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/launch-readiness/feedback.spec.ts`, R28, R29, R34",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/feedback.spec.ts --repeat-each=3"
     ],
     "line": 724,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-22T16:28:50.238Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.6741,
     "costApprox": true,
     "elapsedMs": 2305090,
     "summary": [
      "FeedbackAutoPrompt.spec.tsx rewritten (the original ~20 tests were lost to my earlier overwrite; no backup existed). Now 20 tests: mount-time regression, activity reset, listener cleanup, in-flight, c",
      "Coverage FeedbackAutoPrompt.tsx: 100% stmts/branches/funcs/lines. Typecheck clean; feedback + MainLayout specs 63 pass."
     ]
    }
   ],
   "verified": 9,
   "total": 9,
   "complete": true,
   "costUsd": 7.9145,
   "elapsedMs": 2569143
  },
  {
   "id": "7",
   "name": "Backup nudge",
   "startLine": 742,
   "endLine": 810,
   "adds": "A gentle, dismissible reminder to export a backup once the user has real saved data and has not exported in 30 days; its action opens the existing export dialog.",
   "tryInUi": [
    "With seeded data and no recent export, open the app (not first session) and confirm the reminder appears",
    "Click its action and confirm the export dialog opens",
    "Dismiss it and confirm it does not return for 14 days."
   ],
   "checkpoint": {
    "title": "Checkpoint 7",
    "line": 807,
    "items": [
     "Nudge appears only under its rules and arbitrates correctly; `bun run lint:check`, `bun run typecheck`, `bun run test` and the nudge spec green."
    ]
   },
   "tasks": [
    {
     "id": "T7.1",
     "title": "Nudge state and export timestamp",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T4.1"
     ],
     "files": [
      "src/lib/backup/backupNudgeState.ts",
      "src/components/settings/backup/useBackupExport.ts"
     ],
     "gherkin": null,
     "do": "`backupNudgeState.ts` holds thresholds as named constants (>= 5 saved requests or >= 1 chain/collection with content, 30-day interval, 14-day snooze), at most one nudge per session, never first session, re-reads `rq_last_backup_export` at show time, returns no nudge on data-read failure or during a restore. `useBackupExport` writes `rq_last_backup_export` on success (try/catch). The key is not added to the backup preferences allowlist.",
     "spec": "R39, R40, R40a",
     "filesDeclared": true,
     "acceptance": [
      "Eligibility follows the thresholds and snooze; the timestamp is written only on success."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 747,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-23T01:49:24.987Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {
        "code": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4046,
     "costApprox": true,
     "elapsedMs": 606941,
     "summary": [
      "T7.1: src/lib/backup/backupNudgeState.ts (shouldShowBackupNudge, snoozeBackupNudge, markBackupNudgeShown, recordBackupExport, constants); useBackupExport writes rq_last_backup_export after successful ",
      "T7.2: src/components/backup/BackupNudge.tsx, mounted in MainLayout; en/fr copy under common.backupNudge.",
      "T7.3: ja copy.",
      "T7.1 · restore-in-progress detection · rely on unreadable-data => no nudge plus the gate's open-dialog check (import dialog) · explicit restore flag",
      "T7.2 · accept path · releases slot, opens ExportBackupDialog hosted in BackupNudge, no snooze · snooze on accept"
     ]
    },
    {
     "id": "T7.2",
     "title": "Nudge component",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T7.1",
      "T4.2"
     ],
     "files": [
      "src/components/backup/BackupNudge.tsx",
      "src/components/layout/MainLayout.tsx",
      "src/components/layout/MainLayout.spec.tsx",
      "messages/en/common.json",
      "messages/fr/common.json"
     ],
     "gherkin": null,
     "do": "Run `impeccable` for a quiet dismissible reminder. Request the `backup-nudge` slot, release on cleanup, action opens `ExportBackupDialog` as a user-initiated open, dismiss snoozes 14 days. Emit `backup_nudge_shown|accepted|dismissed` when analytics is on. The `ja` copy is added in T7.3.",
     "spec": "R40",
     "filesDeclared": true,
     "acceptance": [
      "Shows only on `/app` and `/chain`, never with another prompt showing, action opens the export dialog."
     ],
     "verify": [
      "bunx vitest run src/components/layout/MainLayout.spec.tsx"
     ],
     "line": 759,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-23T01:49:24.987Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "ux": "PASS",
        "ui": "PASS",
        "code": "PASS"
       },
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.5661,
     "costApprox": true,
     "elapsedMs": 606941,
     "summary": [
      "T7.1: src/lib/backup/backupNudgeState.ts (shouldShowBackupNudge, snoozeBackupNudge, markBackupNudgeShown, recordBackupExport, constants); useBackupExport writes rq_last_backup_export after successful ",
      "T7.2: src/components/backup/BackupNudge.tsx, mounted in MainLayout; en/fr copy under common.backupNudge.",
      "T7.3: ja copy.",
      "T7.1 · restore-in-progress detection · rely on unreadable-data => no nudge plus the gate's open-dialog check (import dialog) · explicit restore flag",
      "T7.2 · accept path · releases slot, opens ExportBackupDialog hosted in BackupNudge, no snooze · snooze on accept"
     ]
    },
    {
     "id": "T7.3",
     "title": "Nudge copy (ja)",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T7.2"
     ],
     "files": [
      "messages/ja/common.json"
     ],
     "gherkin": null,
     "do": "Add the Japanese nudge strings matching the keys added in T7.2.",
     "spec": "R40",
     "filesDeclared": true,
     "acceptance": [
      "Message parity spec green."
     ],
     "verify": [
      "bunx vitest run src/i18n"
     ],
     "line": 772,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-23T01:49:24.987Z",
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {
        "code": "PASS",
        "ux": "PASS",
        "ui": "PASS"
       },
       "verifier": "skipped"
      }
     ],
     "costUsd": 0.3183,
     "costApprox": true,
     "elapsedMs": 382351,
     "summary": [
      "T7.1: src/lib/backup/backupNudgeState.ts (shouldShowBackupNudge, snoozeBackupNudge, markBackupNudgeShown, recordBackupExport, constants); useBackupExport writes rq_last_backup_export after successful ",
      "T7.2: src/components/backup/BackupNudge.tsx, mounted in MainLayout; en/fr copy under common.backupNudge.",
      "T7.3: ja copy.",
      "T7.1 · restore-in-progress detection · rely on unreadable-data => no nudge plus the gate's open-dialog check (import dialog) · explicit restore flag",
      "T7.2 · accept path · releases slot, opens ExportBackupDialog hosted in BackupNudge, no snooze · snooze on accept"
     ]
    },
    {
     "id": "T7.4",
     "title": "Unit: nudge state",
     "done": true,
     "kind": "unit",
     "depends": [
      "T7.3"
     ],
     "files": [
      "src/lib/backup/backupNudgeState.ts",
      "src/components/backup/BackupNudge.tsx"
     ],
     "gherkin": null,
     "do": "Write `backupNudgeState.spec.ts` (thresholds, 30-day interval, 14-day snooze, first session, read failure, restore suppression, other-tab export re-read) and `BackupNudge.spec.tsx` (happy-dom; action opens the dialog, dismiss snoozes).",
     "spec": "R39, R40",
     "filesDeclared": true,
     "acceptance": [
      "Per-file coverage >= 80%."
     ],
     "verify": [
      "bunx vitest run src/lib/backup/backupNudgeState.spec.ts src/components/backup/BackupNudge.spec.tsx --coverage --coverage.include=src/lib/backup/backupNudgeState.ts --coverage.include=src/components/backup/BackupNudge.tsx --coverage.reporter=text"
     ],
     "line": 783,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-23T01:49:24.987Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": null,
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.4272,
     "costApprox": true,
     "elapsedMs": 463710,
     "summary": [
      "T7.1: src/lib/backup/backupNudgeState.ts (shouldShowBackupNudge, snoozeBackupNudge, markBackupNudgeShown, recordBackupExport, constants); useBackupExport writes rq_last_backup_export after successful ",
      "T7.2: src/components/backup/BackupNudge.tsx, mounted in MainLayout; en/fr copy under common.backupNudge.",
      "T7.3: ja copy.",
      "T7.1 · restore-in-progress detection · rely on unreadable-data => no nudge plus the gate's open-dialog check (import dialog) · explicit restore flag",
      "T7.2 · accept path · releases slot, opens ExportBackupDialog hosted in BackupNudge, no snooze · snooze on accept"
     ]
    },
    {
     "id": "T7.5",
     "title": "E2E: backup nudge",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T7.4"
     ],
     "files": [
      "e2e/qa/launch-readiness/backup-nudge.spec.ts",
      "agent_docs/qa/backup-nudge/"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/launch-readiness/backup-nudge.spec.ts`, R39, R40",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/backup-nudge.spec.ts --repeat-each=3"
     ],
     "line": 794,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-23T01:49:24.987Z",
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [],
     "attempts": [
      {
       "n": 1,
       "gate": "PASS",
       "slop": "PASS",
       "reviews": {},
       "verifier": "PASS"
      }
     ],
     "costUsd": 0.6645,
     "costApprox": true,
     "elapsedMs": 497590,
     "summary": [
      "T7.1: src/lib/backup/backupNudgeState.ts (shouldShowBackupNudge, snoozeBackupNudge, markBackupNudgeShown, recordBackupExport, constants); useBackupExport writes rq_last_backup_export after successful ",
      "T7.2: src/components/backup/BackupNudge.tsx, mounted in MainLayout; en/fr copy under common.backupNudge.",
      "T7.3: ja copy.",
      "T7.1 · restore-in-progress detection · rely on unreadable-data => no nudge plus the gate's open-dialog check (import dialog) · explicit restore flag",
      "T7.2 · accept path · releases slot, opens ExportBackupDialog hosted in BackupNudge, no snooze · snooze on accept"
     ]
    }
   ],
   "verified": 5,
   "total": 5,
   "complete": true,
   "costUsd": 2.3807,
   "elapsedMs": 704320
  },
  {
   "id": "8",
   "name": "Releases and What's New",
   "startLine": 811,
   "endLine": 890,
   "adds": "Automated releases (a release PR, tag and GitHub Release on merge to `main`) and a plain-language \"What's New\" dialog shown once per version to returning users.",
   "tryInUi": [
    "In a profile that has used the app on an earlier day (not first session), set the stored last-seen version below 0.1.0 and reload `/app` to see the dialog",
    "Dismiss it and reload to confirm it stays gone",
    "Open `.github/workflows/release-please.yml` and confirm the trigger and permissions."
   ],
   "checkpoint": {
    "title": "Checkpoint 8",
    "line": 887,
    "items": [
     "Release workflow files valid, What's New logic and modal proven; `bun run lint:check`, `bun run typecheck`, `bun run test` and the spec green (SC6 in-app part). The tag and GitHub Release on merge are confirmed manually after the first release PR is merged."
    ]
   },
   "tasks": [
    {
     "id": "T8.1",
     "title": "release-please workflow and config",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      ".github/workflows/release-please.yml",
      "release-please-config.json",
      ".release-please-manifest.json",
      "CHANGELOG.md"
     ],
     "gherkin": null,
     "do": "Workflow on push to `main` using `googleapis/release-please-action` with `release-type: node`, permissions `contents: write` and `pull-requests: write`. Manifest bootstraps at `0.1.0`; config points at `package.json` and `CHANGELOG.md`. Add a header comment noting the two manual settings (enable \"Allow GitHub Actions to create and approve pull requests\"; release PRs opened with `GITHUB_TOKEN` do not trigger `ci.yml`, so a maintainer re-runs or uses a PAT). `ci.yml` is unchanged.",
     "spec": "R35, R38a",
     "filesDeclared": true,
     "acceptance": [
      "Files parse as valid YAML/JSON; manifest version equals the `package.json` version; `git diff --stat .github/workflows/ci.yml` is empty."
     ],
     "verify": [
      "bun -e 'const fs=require(\"fs\"); require(\"js-yaml\").load(fs.readFileSync(\".github/workflows/release-please.yml\",\"utf8\")); JSON.parse(fs.readFileSync(\"release-please-config.json\",\"utf8\")); const m=JSON.parse(fs.readFileSync(\".release-please-manifest.json\",\"utf8\")); const v=JSON.parse(fs.readFileSync(\"package.json\",\"utf8\")).version; if(m[\".\"]!==v){console.error(\"manifest \"+m[\".\"]+\" != package.json \"+v); process.exit(1)} console.log(\"release config ok\")'",
      "`git diff --stat .github/workflows/ci.yml` (expect no output)"
     ],
     "line": 816,
     "ui": false,
     "status": "ready",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      }
     ],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T8.2",
     "title": "App version and highlights module",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "next.config.ts",
      "src/lib/whatsNew/highlights.ts",
      "src/lib/whatsNew/whatsNewState.ts"
     ],
     "gherkin": null,
     "do": "Set `NEXT_PUBLIC_APP_VERSION` in `next.config.ts` from `package.json`. `highlights.ts` is a TS record keyed by version with `{en, fr, ja}` plain-language bullet lists (seed one plain-language launch entry for the current `package.json` version, 0.1.0, so the shipped modal has content; SPEC OQ-B), `getHighlights(version, locale)` with `en` fallback, `pickLatestWithHighlights(lastSeen, current)` for skipped versions. `whatsNewState.ts` stores last-seen version (try/catch) and decides returning user: stored version, or `rq_onboarding_complete` set, or existing saved data; a new user records the current version silently.",
     "spec": "R36, R38",
     "filesDeclared": true,
     "acceptance": [
      "Missing or empty entry yields no modal; multiple skipped versions pick the latest with highlights; en fallback works."
     ],
     "verify": [
      "bun run typecheck"
     ],
     "line": 827,
     "ui": false,
     "status": "ready",
     "updatedAt": null,
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      }
     ],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T8.3",
     "title": "What's New modal",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T8.2",
      "T4.2"
     ],
     "files": [
      "src/components/whats-new/WhatsNewModal.tsx",
      "src/components/layout/MainLayout.tsx",
      "src/components/layout/MainLayout.spec.tsx",
      "messages/en/common.json",
      "messages/fr/common.json"
     ],
     "gherkin": null,
     "do": "Run `impeccable`. Request the `whats-new` slot, release on cleanup; show once per version to returning users only; dismissal records the version; emit `whats_new_shown`/`whats_new_dismissed` with `version` when analytics is on. The `ja` strings are added in T8.4.",
     "spec": "R37",
     "filesDeclared": true,
     "acceptance": [
      "Not shown to genuinely new users, never together with the tour, deferred (not dropped) while another prompt shows."
     ],
     "verify": [
      "bunx vitest run src/components/layout/MainLayout.spec.tsx"
     ],
     "line": 839,
     "ui": true,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "sonnet"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T8.4",
     "title": "What's New copy (ja)",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T8.3"
     ],
     "files": [
      "messages/ja/common.json"
     ],
     "gherkin": null,
     "do": "Add Japanese strings matching the keys from T8.3.",
     "spec": "R37",
     "filesDeclared": true,
     "acceptance": [
      "Message parity spec green."
     ],
     "verify": [
      "bunx vitest run src/i18n"
     ],
     "line": 852,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "ui"
     ],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      },
      {
       "name": "ux",
       "model": "sonnet"
      },
      {
       "name": "ui",
       "model": "sonnet"
      }
     ],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T8.5",
     "title": "Unit: highlights validation and state",
     "done": false,
     "kind": "unit",
     "depends": [
      "T8.4"
     ],
     "files": [
      "src/lib/whatsNew/highlights.ts",
      "src/lib/whatsNew/whatsNewState.ts"
     ],
     "gherkin": null,
     "do": "Write `highlights.spec.ts` validating every existing entry (en required; no commit hashes, `feat:`/`fix:` prefixes, PR/issue numbers, file paths or code identifiers; a missing entry is not a failure), lookup with fallback and latest-with-highlights, and `whatsNewState.spec.ts` for returning-user determination. Add `src/components/whats-new/WhatsNewModal.spec.tsx` (happy-dom) for show-once and dismiss behaviour.",
     "spec": "R36, R37, R38",
     "filesDeclared": true,
     "acceptance": [
      "Per-file coverage >= 80%; a seeded entry containing \"feat:\" or a hash makes the validator test fail."
     ],
     "verify": [
      "bunx vitest run src/lib/whatsNew/highlights.spec.ts src/lib/whatsNew/whatsNewState.spec.ts src/components/whats-new/WhatsNewModal.spec.tsx --coverage --coverage.include=src/lib/whatsNew/highlights.ts --coverage.include=src/lib/whatsNew/whatsNewState.ts --coverage.include=src/components/whats-new/WhatsNewModal.tsx --coverage.reporter=text"
     ],
     "line": 863,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T8.6",
     "title": "E2E: What's New",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T8.5"
     ],
     "files": [
      "e2e/qa/launch-readiness/whats-new.spec.ts"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/launch-readiness/whats-new.spec.ts`, R37, R38, R45",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/whats-new.spec.ts --repeat-each=3"
     ],
     "line": 874,
     "ui": true,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": null,
     "surfaces": null,
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    }
   ],
   "verified": 0,
   "total": 6,
   "complete": false,
   "costUsd": null,
   "elapsedMs": null
  },
  {
   "id": "9",
   "name": "Docs, repo health and README",
   "startLine": 891,
   "endLine": 990,
   "adds": "A scannable README (hero, TOC, features with screenshots, quick start, honest privacy section), docs moved into `docs/`, a roadmap, and standard repo health files and templates.",
   "tryInUi": [
    "Open README.md on GitHub and find hero, demo, features, quick start and privacy within 30 seconds",
    "Run `node scripts/capture/verify-assets.mjs --readme` and confirm every link and image resolves",
    "Open the Issues \"New issue\" page and confirm bug, feature and feedback templates."
   ],
   "checkpoint": {
    "title": "Checkpoint 9",
    "line": 987,
    "items": [
     "README, docs and repo health files in place and link-checked; `bun run check:readme`, `bun run lint:check` green (SC7)."
    ]
   },
   "tasks": [
    {
     "id": "T9.1",
     "title": "Docs split",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "docs/CHAIN_BLOCKS.md",
      "docs/SHORTCUTS.md",
      "ROADMAP.md",
      "README.md"
     ],
     "gherkin": null,
     "do": "Move the README \"Chain blocks\" content to `docs/CHAIN_BLOCKS.md`, merge the README keyboard-shortcut content into the existing `docs/SHORTCUTS.md` (no duplicate file), move Roadmap to `ROADMAP.md`. Leave links in place of the moved sections; the full README rewrite is T9.6.",
     "spec": "R51",
     "filesDeclared": true,
     "acceptance": [
      "The moved content exists once, in `docs/` and `ROADMAP.md`; no duplicate shortcuts file."
     ],
     "verify": [
      "ls docs/CHAIN_BLOCKS.md ROADMAP.md",
      "`ls docs | grep -ci shortcuts` (expect 1)"
     ],
     "line": 896,
     "ui": false,
     "status": "ready",
     "updatedAt": null,
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      }
     ],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T9.2",
     "title": "Contributing, security, conduct",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "CONTRIBUTING.md",
      "SECURITY.md",
      "CODE_OF_CONDUCT.md"
     ],
     "gherkin": null,
     "do": "`CONTRIBUTING.md` covers setup with `bun`, conventional-commit PR titles with squash merges, and the release-please notes (release PRs opened by `GITHUB_TOKEN` do not run CI; the repo setting to allow Actions to create PRs). `SECURITY.md` names GitHub private vulnerability reporting (advisories) as the primary channel and `LEGAL_CONTACT_EMAIL` from `src/components/legal/constants.ts` as fallback (read the value, do not guess). `CODE_OF_CONDUCT.md` uses the Contributor Covenant.",
     "spec": "R53, R38a",
     "filesDeclared": true,
     "acceptance": [
      "All three exist; SECURITY.md contains the real contact email from the constants file."
     ],
     "verify": [
      "bun -e 'const fs=require(\"fs\"); const m=fs.readFileSync(\"src/components/legal/constants.ts\",\"utf8\").match(/LEGAL_CONTACT_EMAIL\\s*=\\s*\"([^\"]+)\"/); if(!m||!fs.readFileSync(\"SECURITY.md\",\"utf8\").includes(m[1])) process.exit(1); for (const f of [\"CONTRIBUTING.md\",\"CODE_OF_CONDUCT.md\"]) fs.statSync(f); console.log(\"repo health ok\")'"
     ],
     "line": 907,
     "ui": false,
     "status": "ready",
     "updatedAt": null,
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      }
     ],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T9.3",
     "title": "Issue and PR templates",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      ".github/ISSUE_TEMPLATE/feature_request.yml",
      ".github/ISSUE_TEMPLATE/feedback.yml",
      ".github/pull_request_template.md"
     ],
     "gherkin": null,
     "do": "Add bug, feature and feedback issue forms and a PR template that asks for a conventional-commit title.",
     "spec": "R53",
     "filesDeclared": true,
     "acceptance": [
      "Files exist and parse as YAML."
     ],
     "verify": [
      "bun -e 'const fs=require(\"fs\"); const yaml=require(\"js-yaml\"); for (const f of [\"bug_report\",\"feature_request\",\"feedback\"]) { const t=yaml.load(fs.readFileSync(\".github/ISSUE_TEMPLATE/\"+f+\".yml\",\"utf8\")); if(!t||!t.name||!Array.isArray(t.body)) process.exit(1) } fs.statSync(\".github/pull_request_template.md\"); console.log(\"templates ok\")'"
     ],
     "line": 918,
     "ui": false,
     "status": "ready",
     "updatedAt": null,
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      }
     ],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T9.4",
     "title": "Topics, keywords, labels",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "package.json"
     ],
     "gherkin": null,
     "do": "Refresh `package.json` keywords. Review GitHub topics and create `good first issue` and `help wanted` labels with `gh label create` (skip if present). Update topics with `gh repo edit --add-topic` for the chosen set. Draft a handful of starter issue proposals for the PR description (do not create them).",
     "spec": "R54",
     "filesDeclared": true,
     "acceptance": [
      "`gh label list` shows both labels; keywords updated; topics refreshed."
     ],
     "verify": [
      "gh label list --search \"good first issue\"",
      "gh label list --search \"help wanted\"",
      "gh repo view --json repositoryTopics",
      "grep -n \"keywords\" package.json"
     ],
     "line": 929,
     "ui": false,
     "status": "ready",
     "updatedAt": null,
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      }
     ],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T9.5",
     "title": "README link and image check",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "scripts/capture/verify-assets.mjs",
      "package.json"
     ],
     "gherkin": null,
     "do": "Extend `verify-assets.mjs` with a README mode (`--readme`) that parses README.md for relative image and link paths and fails on any that do not resolve to a file; expose it as the `check:readme` script. External URLs are not fetched.",
     "spec": "R50",
     "filesDeclared": true,
     "acceptance": [
      "The script exits non-zero when a seeded broken path is present and zero otherwise."
     ],
     "verify": [
      "bun run check:readme"
     ],
     "line": 940,
     "ui": false,
     "status": "ready",
     "updatedAt": null,
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      }
     ],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T9.6",
     "title": "README rewrite",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T9.1",
      "T9.2",
      "T9.5",
      "T2.6"
     ],
     "files": [
      "README.md"
     ],
     "gherkin": null,
     "do": "Rewrite in the order hero (logo, one-liner, badges, live-app CTA https://requestr-api.vercel.app/, demo video placeholder; the poster/GIF is produced in T11.4 and wired in T11.5) -> TOC -> Why -> Features with screenshots from `public/screens/` (HTTP/GraphQL/WebSocket, Chains, Relay AI agent as its own section, encrypted sharing, health monitoring, toolbox, import) -> Quick start -> Privacy & analytics -> Tech stack -> Contributing -> License. Pull claims from the landing page under `src/app/(home)`. Remove the \"Self-hosting: client IP header\" section, condense Architecture to a link to `docs/ARCHITECTURE.md`, link `docs/CHAIN_BLOCKS.md`, `docs/SHORTCUTS.md` and `ROADMAP.md`. The \"Privacy & analytics\" section replaces the old \"Privacy\" section and states no more than the privacy page (anonymous usage events, no request content, no cookies, IP stripped, opt-out via toggle/DNT/GPC, feedback text/email only if entered). Until T11.5 the hero uses an existing screenshot instead of a missing poster so all paths resolve.",
     "spec": "R49, R52, R51",
     "filesDeclared": true,
     "acceptance": [
      "Sections appear in the specified order; links and images resolve; no claim contradicts the privacy page."
     ],
     "verify": [
      "bun run check:readme",
      "grep -n \"^## \" README.md"
     ],
     "line": 952,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": false,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [
      {
       "name": "code",
       "model": "haiku"
      }
     ],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T9.7",
     "title": "Unit: README asset checker",
     "done": false,
     "kind": "unit",
     "depends": [
      "T9.6"
     ],
     "files": [
      "scripts/capture/verify-assets.mjs"
     ],
     "gherkin": null,
     "do": "Write `scripts/capture/verify-assets.spec.ts` covering the `--readme` mode: resolving relative images and links, failing on a seeded broken path, ignoring external URLs.",
     "spec": "R50",
     "filesDeclared": true,
     "acceptance": [
      "Coverage >= 80% on every metric; no `it.fails`."
     ],
     "verify": [
      "bunx vitest run scripts/capture/verify-assets.spec.ts --coverage --coverage.include=scripts/capture/verify-assets.mjs --coverage.reporter=text"
     ],
     "line": 964,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [
      "logic"
     ],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T9.8",
     "title": "E2E: README structure and links",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T9.7"
     ],
     "files": [
      "e2e/qa/launch-readiness/readme.spec.ts"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/launch-readiness/readme.spec.ts`, R49, R50, R52",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats (file-system based, no browser page needed)."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/readme.spec.ts --repeat-each=3"
     ],
     "line": 975,
     "ui": true,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": null,
     "surfaces": null,
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    }
   ],
   "verified": 0,
   "total": 8,
   "complete": false,
   "costUsd": null,
   "elapsedMs": null
  },
  {
   "id": "10",
   "name": "PostHog provisioning",
   "startLine": 991,
   "endLine": 1065,
   "adds": "The PostHog project is ready: the feedback survey exists, a \"Launch\" dashboard shows the activation funnel, feature usage, retention and landing-to-app conversion, and production env vars are set. Analytics stays off until the deliberate final switch.",
   "tryInUi": [
    "Open the PostHog project and confirm the \"Launch\" dashboard and the feedback survey exist",
    "Open `agent_docs/launch-readiness/POSTHOG_SETUP.md` and confirm the manual checklist",
    "Open `POSTHOG_SETUP.md` and confirm the `SURVEY_ID:` and `DASHBOARD_ID:` lines",
    "after merge and the production switch, trigger a test event and see it in PostHog Live events."
   ],
   "checkpoint": {
    "title": "Checkpoint 10",
    "line": 1062,
    "items": [
     "Survey id and Launch dashboard exist (MCP or documented fallback) and env vars are set or listed (SC11, SC12)."
    ]
   },
   "tasks": [
    {
     "id": "T10.1",
     "title": "Manual fallback checklist",
     "done": false,
     "kind": "gate",
     "depends": [],
     "files": [
      "agent_docs/launch-readiness/POSTHOG_SETUP.md"
     ],
     "gherkin": null,
     "do": "Write the manual checklist covering every provisioning step: create or confirm the US project; copy the public project key; create the feedback survey (API mode: rating 1-5, open text, email) and record its id; create the \"Launch\" dashboard with insights (activation funnel `app_opened` first-session -> `tour_*` -> `first_request_sent` -> `request_saved` -> `chain_run` or `relay_opened`; feature usage counts of `request_sent`, `chain_run`, `relay_*`, `share_created`; retention on `app_opened` by `days_since_last_bucket`; landing -> app funnel `landing_viewed` -> `landing_cta_clicked` -> `app_opened` by `referrer_domain`); the four Vercel env vars (`NEXT_PUBLIC_ANALYTICS_ENABLED=true` in Production only, build-time inlined so a redeploy is needed); and the post-deploy verification steps.",
     "spec": "R62",
     "filesDeclared": true,
     "acceptance": [
      "Each of R60 and R61 steps has a checkbox; marked clearly as the fallback that never blocks other work."
     ],
     "verify": [
      "grep -c \"^- \\[ \\]\" agent_docs/launch-readiness/POSTHOG_SETUP.md"
     ],
     "line": 996,
     "ui": false,
     "status": "ready",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T10.2",
     "title": "Connect PostHog MCP (user auth)",
     "done": false,
     "kind": "gate",
     "depends": [
      "T10.1"
     ],
     "files": [
      "agent_docs/launch-readiness/POSTHOG_SETUP.md"
     ],
     "gherkin": null,
     "do": "Check whether the PostHog MCP is connected. If not, tell the user to run `claude mcp add --transport http posthog https://mcp.posthog.com/mcp` and authenticate once (the only manual step). If it remains unavailable, mark T10.3 to T10.5 as handled by the manual checklist in T10.1 and continue; this never blocks other work.",
     "spec": "R60, R62",
     "filesDeclared": true,
     "acceptance": [
      "Either the MCP tools are callable, or the Log records that the fallback checklist is being used."
     ],
     "verify": [
      "claude mcp list"
     ],
     "line": 1007,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T10.3",
     "title": "Create project confirmation and feedback survey",
     "done": false,
     "kind": "gate",
     "depends": [
      "T10.2"
     ],
     "files": [
      "agent_docs/launch-readiness/POSTHOG_SETUP.md"
     ],
     "gherkin": null,
     "do": "Via the PostHog MCP, confirm or create the US-region project, create the feedback survey (API mode: rating 1-5, open text, email) and record its id in `POSTHOG_SETUP.md` on a line starting `SURVEY_ID:` (or `SURVEY_ID: pending-manual` when the fallback is used) and in the PR checklist. `.env.example` already lists the variable from T1.7; never commit real secrets. If the MCP is unavailable, the user follows the matching steps in `POSTHOG_SETUP.md` and this task is closed with the fallback noted.",
     "spec": "R60",
     "filesDeclared": true,
     "acceptance": [
      "A `SURVEY_ID:` line exists with a real id or the explicit `pending-manual` marker."
     ],
     "verify": [
      "grep -n \"^SURVEY_ID: \" agent_docs/launch-readiness/POSTHOG_SETUP.md"
     ],
     "line": 1018,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T10.4",
     "title": "Create the Launch dashboard",
     "done": false,
     "kind": "gate",
     "depends": [
      "T10.2"
     ],
     "files": [
      "agent_docs/launch-readiness/POSTHOG_SETUP.md"
     ],
     "gherkin": null,
     "do": "Via the PostHog MCP, create the \"Launch\" dashboard with the insights listed in T10.1: activation funnel, feature usage, retention, landing -> app conversion by `referrer_domain`. If the MCP is unavailable the user follows the checklist and this task closes with the fallback noted.",
     "spec": "R60",
     "filesDeclared": true,
     "acceptance": [
      "A line starting `DASHBOARD_ID:` (real id or `pending-manual`) and the four insight names are recorded in `POSTHOG_SETUP.md` (SC11, SC12)."
     ],
     "verify": [
      "grep -n \"^DASHBOARD_ID: \" agent_docs/launch-readiness/POSTHOG_SETUP.md"
     ],
     "line": 1029,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T10.5",
     "title": "Vercel env vars",
     "done": false,
     "kind": "gate",
     "depends": [
      "T10.3"
     ],
     "files": [
      "agent_docs/launch-readiness/POSTHOG_SETUP.md"
     ],
     "gherkin": null,
     "do": "If the Vercel CLI is logged in and linked (`vercel whoami`, `.vercel/project.json`), run `vercel env add` for `POSTHOG_KEY`, `POSTHOG_HOST=https://us.i.posthog.com` and `POSTHOG_FEEDBACK_SURVEY_ID` (all environments) but add `NEXT_PUBLIC_ANALYTICS_ENABLED=true` only in Production, and only in T10.6. If the CLI is not usable, list the variables as a manual checklist in the PR (see `POSTHOG_SETUP.md`). Never print secret values into logs.",
     "spec": "R61",
     "filesDeclared": true,
     "acceptance": [
      "Either `vercel env ls` shows the three server vars, or the manual checklist is in the PR description."
     ],
     "verify": [
      "`vercel env ls` (or record the manual-checklist fallback)"
     ],
     "line": 1040,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security"
     ],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T10.6",
     "title": "Production switch and live verification",
     "done": false,
     "kind": "gate",
     "depends": [
      "T10.4",
      "T10.5",
      "T4.3",
      "T2.6"
     ],
     "files": [
      "src/lib/analytics/server/posthogSink.ts"
     ],
     "gherkin": null,
     "do": "Pre-merge: send one allowlisted test event, one survey response and one `$exception` through the sink to the PostHog project (a one-off local run with the server env set, or via the MCP) and confirm they arrive and render; if the wire shapes for `$exception_list` or `survey sent` need adjusting, change only `src/lib/analytics/server/posthogSink.ts` and its spec. Post-merge (manual, listed in the PR): only once the notice, Settings toggle and rewritten privacy page are deployed, set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` in Production only, redeploy (build-time inlined) and confirm a live event. Analytics never goes live before the notice and toggle ship.",
     "spec": "R60, R61",
     "filesDeclared": true,
     "acceptance": [
      "Test event, survey response and exception visible in PostHog (SC12), or recorded as pending manual work; the production switch is listed as a post-merge PR step."
     ],
     "verify": [
      "bunx vitest run src/lib/analytics/server/posthogSink.spec.ts"
     ],
     "line": 1051,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "high",
     "surfaces": [
      "security"
     ],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    }
   ],
   "verified": 0,
   "total": 6,
   "complete": false,
   "costUsd": null,
   "elapsedMs": null
  },
  {
   "id": "11",
   "name": "Demo video",
   "startLine": 1066,
   "endLine": 1132,
   "adds": "A scripted, deterministic demo video of the real app (send request, chain run, Relay builds something, encrypted share), with a poster and GIF fallback committed for the README. Uploading it to GitHub is a manual step.",
   "tryInUi": [
    "Play the generated MP4 and confirm title card, captions, zoom-ins and the end card with the URL",
    "Open `docs/media/` and confirm the poster and GIF exist",
    "Open README and confirm the poster or GIF shows in the hero."
   ],
   "checkpoint": {
    "title": "Checkpoint 11",
    "line": 1129,
    "items": [
     "Demo script, composition and committed poster/GIF in place; README resolves; manual upload documented."
    ]
   },
   "tasks": [
    {
     "id": "T11.1",
     "title": "Install Remotion dev dependencies",
     "done": false,
     "kind": "gate",
     "depends": [],
     "files": [
      "package.json",
      "bun.lock",
      ".gitignore"
     ],
     "gherkin": null,
     "do": "`bun add -d remotion @remotion/cli`. Add the MP4 output path (for example `scripts/capture/demo/out/`) to `.gitignore`. These are dev-only dependencies named in the spec.",
     "spec": "R57",
     "filesDeclared": true,
     "acceptance": [
      "Both packages are under `devDependencies`; the output folder is gitignored."
     ],
     "verify": [
      "grep -n \"remotion\" package.json",
      "git check-ignore scripts/capture/demo/out/demo.mp4"
     ],
     "line": 1071,
     "ui": false,
     "status": "ready",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T11.2",
     "title": "Deterministic recording script",
     "done": false,
     "kind": "gate",
     "depends": [
      "T5.8",
      "T6.9",
      "T7.5",
      "T8.6"
     ],
     "files": [
      "scripts/capture/demo-record.ts",
      "scripts/capture/seed.ts",
      "scripts/capture/relay-record.ts",
      "package.json"
     ],
     "gherkin": null,
     "do": "Playwright script that records the real app at a fixed high-resolution viewport on the seeded data from `seedCaptureData`, with all network routes mocked (including a scripted Relay stream following `relay-record.ts`), covering scenes: send request, chain run, Relay builds something, encrypted share. It does not start the dev server (it targets the running one). It suppresses first-run prompts through the seed (`rq_onboarding_complete`, notice-dismissed, current What's New version, recent export, feedback snooze) so overlays do not appear. Records per-scene clips to `scripts/capture/demo/out/clips/` and a scene timing manifest to `scripts/capture/demo/out/manifest.json`; exposed as the `demo-record` package script.",
     "spec": "R56",
     "filesDeclared": true,
     "acceptance": [
      "Running the script produces one clip per scene and a manifest, with no real network calls and no tour, notice, What's New, nudge or feedback overlay in any clip."
     ],
     "verify": [
      "bun run typecheck",
      "bun run demo-record",
      "ls scripts/capture/demo/out/clips/",
      "ls scripts/capture/demo/out/manifest.json"
     ],
     "line": 1082,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T11.3",
     "title": "Remotion composition",
     "done": false,
     "kind": "gate",
     "depends": [
      "T11.1",
      "T11.2"
     ],
     "files": [
      "scripts/capture/demo/index.ts",
      "scripts/capture/demo/Root.tsx",
      "scripts/capture/demo/DemoVideo.tsx",
      "scripts/capture/demo/scenes.ts"
     ],
     "gherkin": null,
     "do": "`index.ts` is the Remotion entry calling `registerRoot(Root)`; `Root.tsx` registers one composition with id `DemoVideo`. A roughly 60-90 second composition with a title card, zoom-ins on the active area, per-scene captions, speed ramps (fast through typing and waiting, normal at the payoff) and an end card with the URL https://requestr-api.vercel.app/, driven by the timing manifest. Use named constants for durations and zooms. Follow the remotion best-practices skills.",
     "spec": "R57",
     "filesDeclared": true,
     "acceptance": [
      "The composition renders a still without error for the title card, each scene and the end card."
     ],
     "verify": [
      "bunx remotion still scripts/capture/demo/index.ts DemoVideo scripts/capture/demo/out/check-title.png --frame=0",
      "`bun run typecheck` (then one `remotion still` per scene start frame from `scenes.ts`, recorded in the Log)"
     ],
     "line": 1095,
     "ui": true,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "medium",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T11.4",
     "title": "Render outputs",
     "done": false,
     "kind": "gate",
     "depends": [
      "T11.3"
     ],
     "files": [
      "scripts/capture/demo/render.sh",
      "docs/media/demo-poster.jpg",
      "docs/media/demo.gif"
     ],
     "gherkin": null,
     "do": "A script that renders the MP4 (<= 10MB, gitignored under `scripts/capture/demo/out/`), a poster image (<= 300KB) and a GIF fallback (<= 5MB) into `docs/media/`. Run it and commit only the poster and GIF.",
     "spec": "R58",
     "filesDeclared": true,
     "acceptance": [
      "MP4 <= 10485760 bytes, poster <= 307200 bytes, GIF <= 5242880 bytes."
     ],
     "verify": [
      "bash scripts/capture/demo/render.sh",
      "bun -e 'const fs=require(\"fs\"); const lim={\"scripts/capture/demo/out/demo.mp4\":10485760,\"docs/media/demo-poster.jpg\":307200,\"docs/media/demo.gif\":5242880}; for (const [f,max] of Object.entries(lim)) { const s=fs.statSync(f).size; if(s>max){console.error(f+\" \"+s+\" > \"+max); process.exit(1)} } console.log(\"sizes ok\")'"
     ],
     "line": 1106,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T11.5",
     "title": "Manual upload documentation and README wiring",
     "done": false,
     "kind": "gate",
     "depends": [
      "T11.4",
      "T9.6"
     ],
     "files": [
      "README.md",
      "scripts/capture/README.md"
     ],
     "gherkin": null,
     "do": "Wire the README hero to the poster/GIF under `docs/media/` as the fallback, with a clearly marked place for the user-attachments video URL. Document in `scripts/capture/README.md` and in the PR text the manual step: drag the MP4 into a GitHub issue or PR comment box, copy the user-attachments URL and paste it into the README hero. The build never attempts the upload.",
     "spec": "R58, R59",
     "filesDeclared": true,
     "acceptance": [
      "The README shows the poster/GIF and `bun run check:readme` passes; the manual step is documented."
     ],
     "verify": [
      "bun run check:readme"
     ],
     "line": 1117,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    }
   ],
   "verified": 0,
   "total": 5,
   "complete": false,
   "costUsd": null,
   "elapsedMs": null
  },
  {
   "id": "12",
   "name": "Final gate",
   "startLine": 1133,
   "endLine": 1166,
   "adds": "Nothing new; proves the whole feature meets the success criteria with the targeted suites only.",
   "tryInUi": [
    "Open `/app` in a fresh profile and walk the tour",
    "Toggle analytics off in Settings and confirm the notice and Replay tour entries",
    "Open `/privacy` and the README and confirm the same claims."
   ],
   "checkpoint": {
    "title": "Checkpoint 12",
    "line": 1165,
    "items": [
     "Every success criterion maps to a green task and the manual steps are listed."
    ]
   },
   "tasks": [
    {
     "id": "T12.1",
     "title": "Final gate: lint, typecheck, unit and targeted e2e",
     "done": false,
     "kind": "gate",
     "depends": [
      "T11.5",
      "T10.6",
      "T8.6",
      "T7.5"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run `bun run lint:check`, `bun run typecheck`, `bun run test`, then only the targeted specs: ingest, opt-out, events, arbitration, tour, feedback, backup nudge, what's new, readme. Confirm SC9 greps and the import-boundary spec.",
     "spec": "R10",
     "filesDeclared": true,
     "acceptance": [
      "All commands green; `grep -rn \"boarding.js\\|cronitor\" package.json bun.lock src` is empty (SC9); never the full e2e suite."
     ],
     "verify": [
      "bun run lint:check",
      "bun run typecheck",
      "bun run test",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness --repeat-each=2"
     ],
     "line": 1138,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    },
    {
     "id": "T12.2",
     "title": "Definition of done",
     "done": false,
     "kind": "dod",
     "depends": [
      "T12.1"
     ],
     "files": [],
     "gherkin": null,
     "do": "Confirm every success criterion against the cited tasks.",
     "spec": "R22",
     "filesDeclared": true,
     "acceptance": [
      "SC1 by T5.8; SC2 by T1.10, T1.11, T2.7, T3.9; SC3 by T2.8, T6.9; SC4 by T2.7, T2.8.",
      "SC5 by T6.7; SC6 by T8.1, T8.6 (tag and release confirmed after the first release PR merge); SC7 by T9.7, T9.8.",
      "SC8 by T12.1; SC9 by T5.6, T12.1; SC10 by T1.11; SC11 by T3.10, T10.4; SC12 by T10.3, T10.4, T10.6.",
      "Post-merge manual step listed in the PR: the production analytics switch (T10.6), only after the notice and toggle are deployed.",
      "Manual user steps are listed in the PR: PostHog MCP auth, the GitHub repo setting for Actions-created PRs, the demo video upload, Vercel env vars if the CLI is not linked."
     ],
     "verify": [
      "git status --porcelain | head -20"
     ],
     "line": 1149,
     "ui": false,
     "status": "waiting",
     "updatedAt": null,
     "verifierRouted": true,
     "pending": [],
     "risk": "low",
     "surfaces": [],
     "reviewers": [],
     "attempts": [],
     "costUsd": null,
     "costApprox": false,
     "elapsedMs": null,
     "summary": []
    }
   ],
   "verified": 0,
   "total": 2,
   "complete": false,
   "costUsd": null,
   "elapsedMs": null
  }
 ],
 "current": null,
 "nextCommand": "/build-phases agent_docs/launch-readiness/TASKS.md phase 8",
 "questions": [
  {
   "at": "2026-11-19T14:20:03.000Z",
   "type": "question",
   "tasks": [],
   "id": "Q1",
   "text": "Reload mid-tour: restart or resume?",
   "default": "Tour restarts from step 1",
   "alternatives": "Persist a started marker and resume",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-19T14:20:03.062Z",
   "type": "question",
   "tasks": [],
   "id": "Q2",
   "text": "Seed a What's New entry for 0.1.0?",
   "default": "Seed one entry",
   "alternatives": "No entry for 0.1.0",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-19T14:20:03.127Z",
   "type": "question",
   "tasks": [],
   "id": "Q3",
   "text": "How to suppress tour auto-start under automation?",
   "default": "Suppressed unless __RQ_TOUR_E2E__ is set",
   "alternatives": "Set done flag in QA seed",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-19T14:20:03.202Z",
   "type": "question",
   "tasks": [],
   "id": "Q4",
   "text": "Feedback submit under e2e override: survey treated as configured?",
   "default": "Yes, non-production only",
   "alternatives": "Dummy env values in .env.local",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-19T14:20:03.264Z",
   "type": "question",
   "tasks": [],
   "id": "Q5",
   "text": "Where does the survey-configured flag come from?",
   "default": "Build-time boolean from next.config.ts",
   "alternatives": "Prop from root layout",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-19T14:20:03.325Z",
   "type": "question",
   "tasks": [],
   "id": "Q6",
   "text": "When does production analytics go live?",
   "default": "Manual step after merge (T10.6)",
   "alternatives": "Flip during the build",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-19T14:20:03.386Z",
   "type": "question",
   "tasks": [],
   "id": "Q7",
   "text": "Phase 11 (demo video tooling) task kind?",
   "default": "gate, with executable Verify",
   "alternatives": "implementation with unit/e2e tasks",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-20T14:33:31.013Z",
   "type": "question",
   "tasks": [
    "T2.3"
   ],
   "id": "Q8",
   "text": "Keep error.name when it merely looks like an error class?",
   "default": "explicit set of built-in, DOMException and app error names; else Error",
   "alternatives": "regex ^[A-Z]\\w*Error$ (script-controllable)",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-20T14:33:31.104Z",
   "type": "question",
   "tasks": [
    "T2.3"
   ],
   "id": "Q9",
   "text": "Echo slot contents (identifiers, quoted values) in kept messages?",
   "default": "never; every slot becomes [redacted]",
   "alternatives": "keep identifier-shaped slots",
   "answer": null,
   "answeredAt": null
  }
 ],
 "stuck": [],
 "commits": [
  {
   "at": "2026-11-22T16:28:50.238Z",
   "ok": true,
   "phase": "6",
   "tasks": [
    "T6.1",
    "T6.2",
    "T6.3",
    "T6.4",
    "T6.5",
    "T6.6",
    "T6.7",
    "T6.8",
    "T6.9"
   ],
   "attempt": "3",
   "branch": "feature/launch-readiness",
   "pushed": true,
   "evidence": "e2e 15/15 (5x3), lowest unit coverage 100%, full suite 11086 tests pass",
   "error": null,
   "sha": "0a2324d8c0007af5572ab28a1c607486627945e6",
   "shortSha": "0a2324d",
   "url": "https://github.com/deepakkumardewani/requestr/commit/0a2324d8c0007af5572ab28a1c607486627945e6",
   "subject": "feat(feedback): feedback dialog, counters and idle-gated auto-prompt",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-22T21:58:42+05:30",
   "filesChanged": 34,
   "added": 3364,
   "removed": 584
  },
  {
   "at": "2026-11-22T11:31:34.731Z",
   "ok": true,
   "phase": "5",
   "tasks": [
    "T5.1",
    "T5.2",
    "T5.3",
    "T5.4",
    "T5.5",
    "T5.6",
    "T5.7",
    "T5.8"
   ],
   "attempt": "3",
   "branch": "feature/launch-readiness",
   "pushed": true,
   "evidence": "e2e 8/8 x3, lowest unit coverage 100% lines (startTour 92.85% branches), full suite 11001/11001",
   "error": null,
   "sha": "819d9342f33e22519c56e92a345b4f744ae0cf61",
   "shortSha": "819d934",
   "url": "https://github.com/deepakkumardewani/requestr/commit/819d9342f33e22519c56e92a345b4f744ae0cf61",
   "subject": "feat(tour): first-run tour",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-22T17:01:26+05:30",
   "filesChanged": 38,
   "added": 2856,
   "removed": 880
  },
  {
   "at": "2026-11-22T10:49:33.298Z",
   "ok": true,
   "phase": "4",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6"
   ],
   "attempt": "10",
   "branch": "feature/launch-readiness",
   "pushed": true,
   "evidence": "e2e 15/15 (5 scenarios x3), unit 47/47 at 100% coverage, typecheck+lint clean, 588 files/10947 unit tests",
   "error": null,
   "sha": "853ca05d37816ce2ef8251de744dd9eb780ab956",
   "shortSha": "853ca05",
   "url": "https://github.com/deepakkumardewani/requestr/commit/853ca05d37816ce2ef8251de744dd9eb780ab956",
   "subject": "feat(prompts): prompt arbitration and analytics notice",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-22T16:19:23+05:30",
   "filesChanged": 21,
   "added": 1967,
   "removed": 552
  },
  {
   "at": "2026-11-20T15:15:12.815Z",
   "ok": true,
   "phase": "3",
   "tasks": [
    "T3.1",
    "T3.2",
    "T3.3",
    "T3.4",
    "T3.5",
    "T3.6",
    "T3.7",
    "T3.8",
    "T3.9",
    "T3.10"
   ],
   "attempt": "3",
   "branch": "feature/launch-readiness",
   "pushed": true,
   "evidence": "e2e 4/4 x3 flake-clean, propBuilders.ts 100% lines, full suite 586 files / 10894 tests",
   "error": null,
   "sha": "dab7f4dd1f56d5133fa64796fc8deaad0f53250a",
   "shortSha": "dab7f4d",
   "url": "https://github.com/deepakkumardewani/requestr/commit/dab7f4dd1f56d5133fa64796fc8deaad0f53250a",
   "subject": "feat(analytics): product and landing event instrumentation",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-20T20:45:05+05:30",
   "filesChanged": 34,
   "added": 2067,
   "removed": 639
  },
  {
   "at": "2026-11-20T14:41:33.115Z",
   "ok": true,
   "phase": "2",
   "tasks": [
    "T2.1",
    "T2.2",
    "T2.3",
    "T2.4",
    "T2.5",
    "T2.6",
    "T2.7",
    "T2.8"
   ],
   "attempt": "1",
   "branch": "feature/launch-readiness",
   "pushed": true,
   "evidence": "e2e 21/21, lowest unit coverage 96.66% branches (scrub.ts), 100% lines",
   "error": null,
   "sha": "fe4e0ae96c9ad9bd7a60e34c2a6fa105b5174ff1",
   "shortSha": "fe4e0ae",
   "url": "https://github.com/deepakkumardewani/requestr/commit/fe4e0ae96c9ad9bd7a60e34c2a6fa105b5174ff1",
   "subject": "feat(analytics): consent controls, privacy page, error tracking, relay telemetry",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-20T20:11:24+05:30",
   "filesChanged": 34,
   "added": 2756,
   "removed": 679
  },
  {
   "at": "2026-11-19T16:47:09.213Z",
   "ok": true,
   "phase": "1",
   "tasks": [
    "T1.1",
    "T1.2",
    "T1.3",
    "T1.4",
    "T1.5",
    "T1.6",
    "T1.7",
    "T1.8",
    "T1.9",
    "T1.10",
    "T1.11"
   ],
   "attempt": "5",
   "branch": "feature/launch-readiness",
   "pushed": true,
   "evidence": "e2e 3/3, unit 10684/10684",
   "error": null,
   "sha": "72536ff31fb2cbb5ec0c67714dfdd02e10372f91",
   "shortSha": "72536ff",
   "url": "https://github.com/deepakkumardewani/requestr/commit/72536ff31fb2cbb5ec0c67714dfdd02e10372f91",
   "subject": "feat(analytics): analytics foundation",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-19T22:16:57+05:30",
   "filesChanged": 38,
   "added": 5044,
   "removed": 191
  }
 ],
 "shots": [
  {
   "taskId": "T1.11",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Ingest payload app after app_opened batch",
   "annotations": [],
   "at": "2026-11-19T16:31:47.619Z",
   "file": "1/T1.11-1.png",
   "phase": "1",
   "href": "shots/1/T1.11-1.png"
  },
  {
   "taskId": "T1.11",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "App loaded with no ingest request without override",
   "annotations": [],
   "at": "2026-11-19T16:31:47.690Z",
   "file": "1/T1.11-2.png",
   "phase": "1",
   "href": "shots/1/T1.11-2.png"
  },
  {
   "taskId": "T1.11",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "App with override, no PostHog request or cookie",
   "annotations": [],
   "at": "2026-11-19T16:31:47.757Z",
   "file": "1/T1.11-3.png",
   "phase": "1",
   "href": "shots/1/T1.11-3.png"
  },
  {
   "taskId": "T2.1",
   "kind": "proof",
   "step": "Toggle row present",
   "attempt": 1,
   "caption": "Settings > General > Privacy shows the analytics toggle on, with the build-gate note.",
   "annotations": [
    {
     "x": 18.8,
     "y": 62,
     "w": 40,
     "h": 18.5,
     "label": "Analytics toggle on with note"
    }
   ],
   "at": "2026-11-20T14:19:33.350Z",
   "file": "2/T2.1-1.png",
   "phase": "2",
   "href": "shots/2/T2.1-1.png"
  },
  {
   "taskId": "T2.1",
   "kind": "proof",
   "step": "Toggling off removes rq_analytics_id",
   "attempt": 1,
   "caption": "Toggled off: switch is off and rq_analytics_id is removed.",
   "annotations": [
    {
     "x": 18.8,
     "y": 65,
     "w": 40,
     "h": 15,
     "label": "Toggle off"
    }
   ],
   "at": "2026-11-20T14:19:33.452Z",
   "file": "2/T2.1-2.png",
   "phase": "2",
   "href": "shots/2/T2.1-2.png"
  },
  {
   "taskId": "T2.1",
   "kind": "proof",
   "step": "DNT/GPC forces the toggle off with a visible reason",
   "attempt": 1,
   "caption": "With Do Not Track set the toggle is off and shows the reason.",
   "annotations": [
    {
     "x": 18.8,
     "y": 62,
     "w": 40,
     "h": 18.5,
     "label": "Off with Do Not Track explanation"
    }
   ],
   "at": "2026-11-20T14:19:33.536Z",
   "file": "2/T2.1-3.png",
   "phase": "2",
   "href": "shots/2/T2.1-3.png"
  },
  {
   "taskId": "T2.2",
   "kind": "proof",
   "step": "Strings render",
   "attempt": 1,
   "caption": "New en copy for label, description and DNT explanation render in the toggle row.",
   "annotations": [
    {
     "x": 18.8,
     "y": 62,
     "w": 40,
     "h": 18.5,
     "label": "Label, description, explanation"
    }
   ],
   "at": "2026-11-20T14:19:33.622Z",
   "file": "2/T2.2-1.png",
   "phase": "2",
   "href": "shots/2/T2.2-1.png"
  },
  {
   "taskId": "T2.6",
   "kind": "proof",
   "step": "Old claims gone",
   "attempt": 1,
   "caption": "The short version no longer claims no analytics.",
   "annotations": [
    {
     "x": 21.9,
     "y": 6.5,
     "w": 56.3,
     "h": 37.5,
     "label": "Short version section"
    }
   ],
   "at": "2026-11-20T14:19:33.708Z",
   "file": "2/T2.6-1.png",
   "phase": "2",
   "href": "shots/2/T2.6-1.png"
  },
  {
   "taskId": "T2.6",
   "kind": "proof",
   "step": "Required topics appear",
   "attempt": 1,
   "caption": "Collected events from the allowlist, PostHog US processor, IP stripped, no cookies, analytics ID.",
   "annotations": [
    {
     "x": 21.9,
     "y": 6.5,
     "w": 56.3,
     "h": 60,
     "label": "Analytics section and event list"
    }
   ],
   "at": "2026-11-20T14:19:33.792Z",
   "file": "2/T2.6-2.png",
   "phase": "2",
   "href": "shots/2/T2.6-2.png"
  },
  {
   "taskId": "T2.6",
   "kind": "proof",
   "step": "Opt-out topic",
   "attempt": 1,
   "caption": "Opt-out section covers toggle, DNT and GPC.",
   "annotations": [
    {
     "x": 21.9,
     "y": 13,
     "w": 56.3,
     "h": 37.5,
     "label": "Opting out"
    }
   ],
   "at": "2026-11-20T14:19:33.878Z",
   "file": "2/T2.6-3.png",
   "phase": "2",
   "href": "shots/2/T2.6-3.png"
  },
  {
   "taskId": "T2.6",
   "kind": "proof",
   "step": "Never collected topic",
   "attempt": 1,
   "caption": "What we do not collect section.",
   "annotations": [
    {
     "x": 21.9,
     "y": 32.8,
     "w": 56.3,
     "h": 37.5,
     "label": "Never collected"
    }
   ],
   "at": "2026-11-20T14:19:33.962Z",
   "file": "2/T2.6-4.png",
   "phase": "2",
   "href": "shots/2/T2.6-4.png"
  },
  {
   "taskId": "T2.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Toggle switched off in Settings; no further ingest requests",
   "annotations": [],
   "at": "2026-11-20T14:17:12.337Z",
   "file": "2/T2.8-1.png",
   "phase": "2",
   "href": "shots/2/T2.8-1.png"
  },
  {
   "taskId": "T2.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Toggle disabled with the Do Not Track explanation",
   "annotations": [],
   "at": "2026-11-20T14:17:12.438Z",
   "file": "2/T2.8-2.png",
   "phase": "2",
   "href": "shots/2/T2.8-2.png"
  },
  {
   "taskId": "T3.8",
   "kind": "proof",
   "step": "CTA clicks still navigate",
   "attempt": 1,
   "caption": "After clicking the hero Open the app CTA (with tracking on), the browser lands on /app; e2e asserts URL /app and one landing_cta_clicked hero_open_app",
   "annotations": [],
   "at": "2026-11-20T15:05:23.018Z",
   "file": "3/T3.8-1.png",
   "phase": "3",
   "href": "shots/3/T3.8-1.png"
  },
  {
   "taskId": "T3.10",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Landing page loaded under the override (landing_viewed posted)",
   "annotations": [],
   "at": "2026-11-20T14:56:52.637Z",
   "file": "3/T3.10-1.png",
   "phase": "3",
   "href": "shots/3/T3.10-1.png"
  },
  {
   "taskId": "T3.10",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Hero Open app CTA navigated to /app",
   "annotations": [],
   "at": "2026-11-20T14:56:52.765Z",
   "file": "3/T3.10-2.png",
   "phase": "3",
   "href": "shots/3/T3.10-2.png"
  },
  {
   "taskId": "T3.10",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Request sent; request_sent payload has no URL, host or header",
   "annotations": [],
   "at": "2026-11-20T14:56:52.867Z",
   "file": "3/T3.10-3.png",
   "phase": "3",
   "href": "shots/3/T3.10-3.png"
  },
  {
   "taskId": "T3.10",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Landing under DNT=1 sends nothing",
   "annotations": [],
   "at": "2026-11-20T14:56:52.972Z",
   "file": "3/T3.10-4.png",
   "phase": "3",
   "href": "shots/3/T3.10-4.png"
  },
  {
   "taskId": "T4.3",
   "kind": "after",
   "step": "Notice shows once on first visit",
   "attempt": 4,
   "caption": "First visit on desktop shows the one-line \"Requestr\" analytics notice with Privacy and Settings links.",
   "annotations": [
    {
     "x": 26.2,
     "y": 91,
     "w": 47.7,
     "h": 6.2,
     "label": "Analytics notice with links and dismiss"
    }
   ],
   "at": "2026-11-22T10:40:18.375Z",
   "file": "4/T4.3-2.png",
   "phase": "4",
   "href": "shots/4/T4.3-2.png"
  },
  {
   "taskId": "T4.3",
   "kind": "after",
   "step": "Notice shows once on first visit (mobile)",
   "attempt": 4,
   "caption": "At 390px width the notice fits the viewport and wraps without overflow.",
   "annotations": [
    {
     "x": 4.1,
     "y": 92.9,
     "w": 91.8,
     "h": 5.2,
     "label": "Notice spans mobile width"
    }
   ],
   "at": "2026-11-22T10:40:18.489Z",
   "file": "4/T4.3-3.png",
   "phase": "4",
   "href": "shots/4/T4.3-3.png"
  },
  {
   "taskId": "T4.3",
   "kind": "after",
   "step": "Never after dismissal",
   "attempt": 4,
   "caption": "After dismissing and reloading, the notice does not reappear (flag stored).",
   "annotations": [
    {
     "x": 4.1,
     "y": 92.9,
     "w": 91.8,
     "h": 5.2,
     "label": "Notice area empty after reload"
    }
   ],
   "at": "2026-11-22T10:40:18.600Z",
   "file": "4/T4.3-4.png",
   "phase": "4",
   "href": "shots/4/T4.3-4.png"
  },
  {
   "taskId": "T4.3",
   "kind": "proof",
   "step": "Not when disabled by DNT/GPC/env",
   "attempt": 6,
   "caption": "With the analytics override on but Do Not Track set, /app loads and no analytics notice appears.",
   "annotations": [
    {
     "x": 26.2,
     "y": 91,
     "w": 47.7,
     "h": 6.2,
     "label": "No notice under DNT"
    }
   ],
   "at": "2026-11-22T10:46:38.126Z",
   "file": "4/T4.3-5.png",
   "phase": "4",
   "href": "shots/4/T4.3-5.png"
  },
  {
   "taskId": "T4.4",
   "kind": "after",
   "step": "Closing releases it",
   "attempt": 4,
   "caption": "Closing Relay releases the slot and the notice returns.",
   "annotations": [
    {
     "x": 26.2,
     "y": 91,
     "w": 47.7,
     "h": 6.2,
     "label": "Notice back after close"
    }
   ],
   "at": "2026-11-22T10:40:18.822Z",
   "file": "4/T4.4-2.png",
   "phase": "4",
   "href": "shots/4/T4.4-2.png"
  },
  {
   "taskId": "T4.4",
   "kind": "after",
   "step": "Opening Relay takes the slot and hides any auto prompt",
   "attempt": 4,
   "caption": "Opening Relay takes the slot: the notice is hidden while the dock is open.",
   "annotations": [
    {
     "x": 70,
     "y": 0,
     "w": 30,
     "h": 100,
     "label": "Relay dock open, no notice"
    }
   ],
   "at": "2026-11-22T10:40:18.709Z",
   "file": "4/T4.4-3.png",
   "phase": "4",
   "href": "shots/4/T4.4-3.png"
  },
  {
   "taskId": "T4.6",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Notice shown on mobile width",
   "annotations": [],
   "at": "2026-11-22T10:36:17.580Z",
   "file": "4/T4.6-1.png",
   "phase": "4",
   "href": "shots/4/T4.6-1.png"
  },
  {
   "taskId": "T4.6",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Notice stays dismissed after reload",
   "annotations": [],
   "at": "2026-11-22T10:36:17.691Z",
   "file": "4/T4.6-2.png",
   "phase": "4",
   "href": "shots/4/T4.6-2.png"
  },
  {
   "taskId": "T4.6",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Relay open, notice hidden",
   "annotations": [],
   "at": "2026-11-22T10:36:17.795Z",
   "file": "4/T4.6-3.png",
   "phase": "4",
   "href": "shots/4/T4.6-3.png"
  },
  {
   "taskId": "T4.6",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "URL typing with notice visible",
   "annotations": [],
   "at": "2026-11-22T10:36:17.898Z",
   "file": "4/T4.6-4.png",
   "phase": "4",
   "href": "shots/4/T4.6-4.png"
  },
  {
   "taskId": "T4.6",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Mobile: notice shown directly",
   "annotations": [],
   "at": "2026-11-22T10:47:43.334Z",
   "file": "4/T4.6-5.png",
   "phase": "4",
   "href": "shots/4/T4.6-5.png"
  },
  {
   "taskId": "T4.6",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Mobile: notice stays dismissed after reload",
   "annotations": [],
   "at": "2026-11-22T10:47:43.452Z",
   "file": "4/T4.6-6.png",
   "phase": "4",
   "href": "shots/4/T4.6-6.png"
  },
  {
   "taskId": "T4.6",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Relay open: coach shown, notice hidden",
   "annotations": [],
   "at": "2026-11-22T10:47:43.557Z",
   "file": "4/T4.6-7.png",
   "phase": "4",
   "href": "shots/4/T4.6-7.png"
  },
  {
   "taskId": "T4.6",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Typing in URL bar with notice visible",
   "annotations": [],
   "at": "2026-11-22T10:47:43.660Z",
   "file": "4/T4.6-8.png",
   "phase": "4",
   "href": "shots/4/T4.6-8.png"
  },
  {
   "taskId": "T5.1",
   "kind": "after",
   "step": "A one-step demo tour renders the custom popover",
   "attempt": 1,
   "caption": "Custom TourPopover on a driver.js step: \"Step 1/4\" progress, title, body, Skip tour and Next, plus a close button, themed with shadcn tokens in dark mode.",
   "annotations": [
    {
     "x": 21.1,
     "y": 6.8,
     "w": 20,
     "h": 15.4,
     "label": "Custom popover with progress, Skip, Next and close"
    },
    {
     "x": 0.8,
     "y": 6,
     "w": 18.3,
     "h": 3.6,
     "label": "Highlighted anchor (environment selector)"
    }
   ],
   "at": "2026-11-22T11:19:02.428Z",
   "file": "5/T5.1-1.png",
   "phase": "5",
   "href": "shots/5/T5.1-1.png"
  },
  {
   "taskId": "T5.3",
   "kind": "after",
   "step": "Each listed element exposes the matching attribute and is visible on a fresh /app",
   "attempt": 1,
   "caption": "The Chains accordion trigger carries data-tour=\"chains\" and is highlighted by the tour on a fresh /app; Back appears from step 2.",
   "annotations": [
    {
     "x": 0.4,
     "y": 77.5,
     "w": 17.7,
     "h": 3.8,
     "label": "Chains trigger (data-tour=chains)"
    },
    {
     "x": 19.7,
     "y": 79,
     "w": 21.5,
     "h": 15.4,
     "label": "Popover step 2/4 with Back and Next"
    }
   ],
   "at": "2026-11-22T11:19:02.575Z",
   "file": "5/T5.3-1.png",
   "phase": "5",
   "href": "shots/5/T5.3-1.png"
  },
  {
   "taskId": "T5.3",
   "kind": "after",
   "step": "Relay toggle exposes its data-tour attribute",
   "attempt": 1,
   "caption": "The Relay toggle carries data-tour=\"relay-dock\" and is highlighted at step 3/4; the step count reflects only resolved anchors.",
   "annotations": [
    {
     "x": 97.8,
     "y": 3.7,
     "w": 2,
     "h": 3.1,
     "label": "Relay toggle (data-tour=relay-dock)"
    },
    {
     "x": 79,
     "y": 10,
     "w": 20,
     "h": 15.4,
     "label": "Popover step 3/4"
    }
   ],
   "at": "2026-11-22T11:19:02.708Z",
   "file": "5/T5.3-2.png",
   "phase": "5",
   "href": "shots/5/T5.3-2.png"
  },
  {
   "taskId": "T5.4",
   "kind": "proof",
   "step": "Tour auto-starts with resolved-step count",
   "attempt": null,
   "caption": "Fresh desktop /app shows the custom tour popover \"Step 1/4\" anchored to the environment selector.",
   "annotations": [
    {
     "x": 20,
     "y": 5,
     "w": 22,
     "h": 24,
     "label": "Custom popover with step counter, Skip and Next"
    }
   ],
   "at": "2026-11-22T11:04:43.405Z",
   "file": "5/T5.4-1.png",
   "phase": "5",
   "href": "shots/5/T5.4-1.png"
  },
  {
   "taskId": "T5.5",
   "kind": "after",
   "step": "Replay works with the flag set (Settings entry point)",
   "attempt": 1,
   "caption": "Settings > General has a Help row with a replay button (labelled \"Restart tour\") while rq_onboarding_complete is already \"true\".",
   "annotations": [
    {
     "x": 42.9,
     "y": 90.9,
     "w": 8.1,
     "h": 3.1,
     "label": "Tour replay button in Settings > General"
    }
   ],
   "at": "2026-11-22T11:19:40.491Z",
   "file": "5/T5.5-1.png",
   "phase": "5",
   "href": "shots/5/T5.5-1.png"
  },
  {
   "taskId": "T5.5",
   "kind": "after",
   "step": "Replay works with the flag set (command palette entry point)",
   "attempt": 1,
   "caption": "Command palette lists \"Replay tour\" while a tour is already running (mid-tour replay entry point).",
   "annotations": [
    {
     "x": 37.2,
     "y": 62.7,
     "w": 25.6,
     "h": 3.6,
     "label": "Replay tour palette item"
    },
    {
     "x": 21.1,
     "y": 3.3,
     "w": 20,
     "h": 15.4,
     "label": "Tour already active behind the palette"
    }
   ],
   "at": "2026-11-22T11:20:01.257Z",
   "file": "5/T5.5-2.png",
   "phase": "5",
   "href": "shots/5/T5.5-2.png"
  },
  {
   "taskId": "T5.5",
   "kind": "after",
   "step": "Replay mid-tour leaves a single overlay",
   "attempt": 1,
   "caption": "After replaying mid-tour from the palette there is exactly one popover and one overlay, restarted at Step 1/4 with the completed flag still set.",
   "annotations": [
    {
     "x": 21.1,
     "y": 6.8,
     "w": 20,
     "h": 15.4,
     "label": "Single popover restarted at step 1"
    }
   ],
   "at": "2026-11-22T11:20:08.652Z",
   "file": "5/T5.5-3.png",
   "phase": "5",
   "href": "shots/5/T5.5-3.png"
  },
  {
   "taskId": "T5.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Tour auto-started on a fresh desktop profile",
   "annotations": [],
   "at": "2026-11-22T11:17:10.722Z",
   "file": "5/T5.8-1.png",
   "phase": "5",
   "href": "shots/5/T5.8-1.png"
  },
  {
   "taskId": "T5.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Analytics notice appears after the tour is skipped",
   "annotations": [],
   "at": "2026-11-22T11:17:10.872Z",
   "file": "5/T5.8-2.png",
   "phase": "5",
   "href": "shots/5/T5.8-2.png"
  },
  {
   "taskId": "T5.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Command palette Replay tour restarts the completed tour",
   "annotations": [],
   "at": "2026-11-22T11:17:11.000Z",
   "file": "5/T5.8-3.png",
   "phase": "5",
   "href": "shots/5/T5.8-3.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": "Rating required",
   "attempt": 1,
   "caption": "Submitting with no rating keeps the dialog open and asks for a rating.",
   "annotations": [
    {
     "x": 35,
     "y": 22,
     "w": 30,
     "h": 56,
     "label": "feedback dialog stays open without a rating"
    }
   ],
   "at": "2026-11-22T15:59:39.798Z",
   "file": "6/T6.3-1.png",
   "phase": "6",
   "href": "shots/6/T6.3-1.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": "Invalid email blocked inline",
   "attempt": 1,
   "caption": "An invalid email shows an inline error and blocks the send.",
   "annotations": [
    {
     "x": 36.2,
     "y": 59.8,
     "w": 27.5,
     "h": 2,
     "label": "inline email error"
    }
   ],
   "at": "2026-11-22T15:59:39.973Z",
   "file": "6/T6.3-2.png",
   "phase": "6",
   "href": "shots/6/T6.3-2.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": "Failure keeps the draft and the dialog open",
   "attempt": 1,
   "caption": "When the send fails the dialog stays open with an inline error and the typed note is kept.",
   "annotations": [
    {
     "x": 36.2,
     "y": 65.4,
     "w": 27.5,
     "h": 4,
     "label": "inline failure message; draft preserved above"
    }
   ],
   "at": "2026-11-22T15:59:40.116Z",
   "file": "6/T6.3-3.png",
   "phase": "6",
   "href": "shots/6/T6.3-3.png"
  },
  {
   "taskId": "T6.4",
   "kind": "proof",
   "step": "Submit disabled with explanatory message when the flag is false",
   "attempt": 2,
   "caption": "Without the survey build flag, the dialog explains feedback is unavailable and the send button is disabled.",
   "annotations": [
    {
     "x": 37.8,
     "y": 64.6,
     "w": 14.5,
     "h": 2.2,
     "label": "explanatory unconfigured message"
    },
    {
     "x": 53.9,
     "y": 70.2,
     "w": 8.3,
     "h": 3.4,
     "label": "disabled Send feedback button"
    }
   ],
   "at": "2026-11-22T16:13:12.249Z",
   "file": "6/T6.4-1.png",
   "phase": "6",
   "href": "shots/6/T6.4-1.png"
  },
  {
   "taskId": "T6.5",
   "kind": "proof",
   "step": "Sidebar entry point",
   "attempt": 1,
   "caption": "The sidebar footer has a Send feedback item.",
   "annotations": [
    {
     "x": 0.9,
     "y": 95.4,
     "w": 18,
     "h": 3.5,
     "label": "Send feedback item"
    }
   ],
   "at": "2026-11-22T15:59:40.260Z",
   "file": "6/T6.5-1.png",
   "phase": "6",
   "href": "shots/6/T6.5-1.png"
  },
  {
   "taskId": "T6.5",
   "kind": "proof",
   "step": "Sidebar opens dialog",
   "attempt": 1,
   "caption": "Clicking the sidebar item opens the feedback dialog.",
   "annotations": [
    {
     "x": 35,
     "y": 21.4,
     "w": 30,
     "h": 57,
     "label": "feedback dialog"
    }
   ],
   "at": "2026-11-22T15:59:40.418Z",
   "file": "6/T6.5-2.png",
   "phase": "6",
   "href": "shots/6/T6.5-2.png"
  },
  {
   "taskId": "T6.5",
   "kind": "proof",
   "step": "Command palette entry point",
   "attempt": 1,
   "caption": "The command palette lists Send feedback.",
   "annotations": [
    {
     "x": 35.6,
     "y": 42.3,
     "w": 28.8,
     "h": 4,
     "label": "Send feedback command"
    }
   ],
   "at": "2026-11-22T15:59:40.567Z",
   "file": "6/T6.5-3.png",
   "phase": "6",
   "href": "shots/6/T6.5-3.png"
  },
  {
   "taskId": "T6.5",
   "kind": "proof",
   "step": "Palette opens dialog",
   "attempt": 1,
   "caption": "Choosing the palette command opens the feedback dialog.",
   "annotations": [
    {
     "x": 35,
     "y": 22,
     "w": 30,
     "h": 55.5,
     "label": "feedback dialog"
    }
   ],
   "at": "2026-11-22T15:59:40.704Z",
   "file": "6/T6.5-4.png",
   "phase": "6",
   "href": "shots/6/T6.5-4.png"
  },
  {
   "taskId": "T6.6",
   "kind": "proof",
   "step": "Never during the notice",
   "attempt": 1,
   "caption": "With the analytics notice showing, no feedback prompt appears even though the user is eligible.",
   "annotations": [
    {
     "x": 26,
     "y": 93.4,
     "w": 47.7,
     "h": 4.8,
     "label": "analytics notice holds the slot"
    }
   ],
   "at": "2026-11-22T15:59:40.839Z",
   "file": "6/T6.6-1.png",
   "phase": "6",
   "href": "shots/6/T6.6-1.png"
  },
  {
   "taskId": "T6.6",
   "kind": "proof",
   "step": "Auto-prompt appears when eligible and stays",
   "attempt": 6,
   "caption": "Eligible user (3 session days, chain run done, idle) gets the feedback dialog, still open 15s later.",
   "annotations": [
    {
     "x": 35,
     "y": 10.4,
     "w": 30,
     "h": 79.2,
     "label": "Feedback dialog open and persisting"
    }
   ],
   "at": "2026-11-22T16:02:32.058Z",
   "file": "6/T6.6-2.png",
   "phase": "6",
   "href": "shots/6/T6.6-2.png"
  },
  {
   "taskId": "T6.6",
   "kind": "proof",
   "step": "Dismissal persists",
   "attempt": 6,
   "caption": "After Escape dismissal (dismissedAt saved), reload 9s later shows no prompt: 30-day snooze persists.",
   "annotations": [
    {
     "x": 26,
     "y": 30,
     "w": 48,
     "h": 40,
     "label": "No dialog after reload; empty workspace shown"
    }
   ],
   "at": "2026-11-22T16:02:32.218Z",
   "file": "6/T6.6-3.png",
   "phase": "6",
   "href": "shots/6/T6.6-3.png"
  },
  {
   "taskId": "T6.6",
   "kind": "proof",
   "step": "Notice showing blocks the auto-prompt",
   "attempt": 6,
   "caption": "While the analytics notice is showing, the otherwise eligible feedback prompt does not appear (11s).",
   "annotations": [
    {
     "x": 26.1,
     "y": 90.8,
     "w": 47.7,
     "h": 6.6,
     "label": "Analytics notice holds the slot"
    }
   ],
   "at": "2026-11-22T16:02:32.364Z",
   "file": "6/T6.6-4.png",
   "phase": "6",
   "href": "shots/6/T6.6-4.png"
  },
  {
   "taskId": "T6.6",
   "kind": "proof",
   "step": "An opted-out user still gets the prompt",
   "attempt": 3,
   "caption": "With Do Not Track on (analytics opted out) an eligible idle user still gets the feedback auto-prompt; zero ingest requests were sent.",
   "annotations": [
    {
     "x": 36.6,
     "y": 26.3,
     "w": 26.7,
     "h": 47.3,
     "label": "Auto-prompted feedback dialog under DNT"
    }
   ],
   "at": "2026-11-22T16:27:42.518Z",
   "file": "6/T6.6-5.png",
   "phase": "6",
   "href": "shots/6/T6.6-5.png"
  },
  {
   "taskId": "T6.6",
   "kind": "proof",
   "step": "Auto-prompt appears when eligible and stays",
   "attempt": 3,
   "caption": "Eligible idle user (3 session days, chain run done) gets the feedback dialog about 3s after load; it is still open 12s later.",
   "annotations": [
    {
     "x": 36.6,
     "y": 24.6,
     "w": 26.7,
     "h": 50.9,
     "label": "Auto-prompted feedback dialog"
    }
   ],
   "at": "2026-11-22T16:27:42.082Z",
   "file": "6/T6.6-6.png",
   "phase": "6",
   "href": "shots/6/T6.6-6.png"
  },
  {
   "taskId": "T6.6",
   "kind": "proof",
   "step": "Dismissal persists",
   "attempt": 3,
   "caption": "After an Escape dismissal (dismissedAt saved), a reload shows no prompt for 10s: the 30-day snooze persists.",
   "annotations": [
    {
     "x": 26,
     "y": 30,
     "w": 48,
     "h": 40,
     "label": "No dialog after reload; empty workspace shown"
    }
   ],
   "at": "2026-11-22T16:27:42.224Z",
   "file": "6/T6.6-7.png",
   "phase": "6",
   "href": "shots/6/T6.6-7.png"
  },
  {
   "taskId": "T6.6",
   "kind": "proof",
   "step": "Never during the notice",
   "attempt": 3,
   "caption": "While the analytics notice is showing, the otherwise eligible feedback prompt does not appear (12s).",
   "annotations": [
    {
     "x": 28.8,
     "y": 94.1,
     "w": 42.5,
     "h": 4.2,
     "label": "Analytics notice holds the slot"
    }
   ],
   "at": "2026-11-22T16:27:42.390Z",
   "file": "6/T6.6-8.png",
   "phase": "6",
   "href": "shots/6/T6.6-8.png"
  },
  {
   "taskId": "T6.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Feedback dialog with 4 stars and text filled",
   "annotations": [],
   "at": "2026-11-22T15:54:05.881Z",
   "file": "6/T6.9-1.png",
   "phase": "6",
   "href": "shots/6/T6.9-1.png"
  },
  {
   "taskId": "T6.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Dialog closed after successful submit",
   "annotations": [],
   "at": "2026-11-22T15:54:06.056Z",
   "file": "6/T6.9-2.png",
   "phase": "6",
   "href": "shots/6/T6.9-2.png"
  },
  {
   "taskId": "T6.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Inline error after failed submit, text kept",
   "annotations": [],
   "at": "2026-11-22T15:54:06.276Z",
   "file": "6/T6.9-3.png",
   "phase": "6",
   "href": "shots/6/T6.9-3.png"
  },
  {
   "taskId": "T6.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Invalid email blocked inline",
   "annotations": [],
   "at": "2026-11-22T15:54:06.421Z",
   "file": "6/T6.9-4.png",
   "phase": "6",
   "href": "shots/6/T6.9-4.png"
  },
  {
   "taskId": "T6.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Dialog opened from command palette",
   "annotations": [],
   "at": "2026-11-22T15:54:06.556Z",
   "file": "6/T6.9-5.png",
   "phase": "6",
   "href": "shots/6/T6.9-5.png"
  },
  {
   "taskId": "T7.2",
   "kind": "after",
   "step": "Shows on /app",
   "attempt": 1,
   "caption": "Quiet backup reminder card at bottom-right of /app for a returning user with saved data.",
   "annotations": [
    {
     "x": 73.75,
     "y": 74.35,
     "w": 25,
     "h": 22.9,
     "label": "Backup nudge with Export and Dismiss actions"
    }
   ],
   "at": "2026-11-23T01:43:08.129Z",
   "file": "7/T7.2-1.png",
   "phase": "7",
   "href": "shots/7/T7.2-1.png"
  },
  {
   "taskId": "T7.2",
   "kind": "after",
   "step": "Action opens the export dialog",
   "attempt": 1,
   "caption": "Clicking Export backup hides the nudge and opens the export dialog.",
   "annotations": [
    {
     "x": 32.5,
     "y": 8.7,
     "w": 35,
     "h": 82.7,
     "label": "Export backup dialog opened from the nudge"
    }
   ],
   "at": "2026-11-23T01:43:08.325Z",
   "file": "7/T7.2-2.png",
   "phase": "7",
   "href": "shots/7/T7.2-2.png"
  },
  {
   "taskId": "T7.3",
   "kind": "after",
   "step": "Message parity green",
   "attempt": 1,
   "caption": "ja nudge strings present with key parity (app renders en only; locale fixed in request.ts).",
   "annotations": [
    {
     "x": 73.75,
     "y": 74.35,
     "w": 25,
     "h": 22.9,
     "label": "Nudge rendered from the shared backupNudge keys"
    }
   ],
   "at": "2026-11-23T01:43:08.477Z",
   "file": "7/T7.3-1.png",
   "phase": "7",
   "href": "shots/7/T7.3-1.png"
  },
  {
   "taskId": "T7.5",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Backup reminder visible for a returning user with saved data",
   "annotations": [],
   "at": "2026-11-23T01:42:04.631Z",
   "file": "7/T7.5-1.png",
   "phase": "7",
   "href": "shots/7/T7.5-1.png"
  },
  {
   "taskId": "T7.5",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reminder action opens the export dialog",
   "annotations": [],
   "at": "2026-11-23T01:42:04.834Z",
   "file": "7/T7.5-2.png",
   "phase": "7",
   "href": "shots/7/T7.5-2.png"
  }
 ],
 "deliverables": [
  {
   "at": "2026-11-23T01:49:24.987Z",
   "type": "deliverable",
   "tasks": [
    "T7.1",
    "T7.2",
    "T7.3",
    "T7.4",
    "T7.5"
   ],
   "text": "Backup nudge: eligibility state, BackupNudge card with export action, en/fr/ja copy, unit and e2e coverage",
   "files": [
    "src/components/backup/BackupNudge.tsx",
    "src/lib/backup/backupNudgeState.ts"
   ]
  },
  {
   "at": "2026-11-22T16:28:31.537Z",
   "type": "deliverable",
   "tasks": [
    "T6.1",
    "T6.2",
    "T6.3",
    "T6.4",
    "T6.5",
    "T6.6",
    "T6.7",
    "T6.8",
    "T6.9"
   ],
   "text": "Feedback: eligibility/state, counters, FeedbackDialog, survey flag, entry points, idle-gated auto-prompt, unit+e2e coverage",
   "files": [
    "src/lib/feedback/eligibility.ts"
   ]
  },
  {
   "at": "2026-11-22T11:31:15.997Z",
   "type": "deliverable",
   "tasks": [
    "T5.1",
    "T5.2",
    "T5.3",
    "T5.4",
    "T5.5",
    "T5.6",
    "T5.7",
    "T5.8"
   ],
   "text": "First-run tour: driver.js popover, anchors/steps/i18n, auto-start, replay, boarding.js removed, unit+e2e",
   "files": [
    "src/lib/tour",
    "src/components/tour"
   ]
  },
  {
   "at": "2026-11-22T10:49:12.478Z",
   "type": "deliverable",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6"
   ],
   "text": "Prompt arbitration store + gate, analytics notice, Relay coach arbitration, unit and e2e coverage",
   "files": [
    "src/stores/usePromptStore.ts",
    "src/lib/prompts/useAutoPromptGate.ts",
    "src/components/common/AnalyticsNotice.tsx",
    "src/providers/AppProviders.tsx",
    "src/components/relay/RelayDock.tsx",
    "e2e/qa/launch-readiness/prompt-arbitration.spec.ts"
   ]
  },
  {
   "at": "2026-11-20T15:14:51.546Z",
   "type": "deliverable",
   "tasks": [
    "T3.1",
    "T3.2",
    "T3.3",
    "T3.4",
    "T3.5",
    "T3.6",
    "T3.7",
    "T3.8",
    "T3.9",
    "T3.10"
   ],
   "text": "Phase 3: typed, consent-gated product and landing analytics events with leak-proof prop builders",
   "files": [
    "src/lib/analytics/propBuilders.ts"
   ]
  },
  {
   "at": "2026-11-20T14:41:11.725Z",
   "type": "deliverable",
   "tasks": [
    "T2.1",
    "T2.2",
    "T2.3",
    "T2.4",
    "T2.5",
    "T2.6",
    "T2.7",
    "T2.8"
   ],
   "text": "Consent toggle, DNT/GPC, privacy page, scrubbed error tracking, Relay telemetry, opt-out e2e",
   "files": [
    "src/stores/useAnalyticsStore.ts",
    "src/lib/analytics",
    "src/lib/relay",
    "src/app/privacy",
    "src/components",
    "src/providers",
    "messages",
    "e2e/qa/launch-readiness"
   ]
  },
  {
   "at": "2026-11-19T16:46:52.261Z",
   "type": "deliverable",
   "tasks": [
    "T1.1",
    "T1.2",
    "T1.3",
    "T1.4",
    "T1.5",
    "T1.6",
    "T1.7",
    "T1.8",
    "T1.9",
    "T1.10",
    "T1.11"
   ],
   "text": "Analytics foundation: events, consent, adapters, ingest route, import boundaries, app_opened, e2e proof",
   "files": [
    "src/lib/analytics",
    "src/app/api/ingest",
    "src/lib/prompts"
   ]
  }
 ],
 "advisories": [
  {
   "at": "2026-11-23T01:49:08.424Z",
   "type": "advisory",
   "tasks": [
    "T7.5"
   ],
   "text": "snap fixture rewrites agent_docs/qa/backup-nudge PNGs on every verify run, changing the task fingerprint"
  },
  {
   "at": "2026-11-23T01:47:34.365Z",
   "type": "advisory",
   "tasks": [
    "T7.1"
   ],
   "text": "Any chain counts toward eligibility even with no steps; R39 says chain/collection with content (backupNudgeState.ts:39)"
  },
  {
   "at": "2026-11-23T01:47:34.189Z",
   "type": "advisory",
   "tasks": [
    "T7.1"
   ],
   "text": "Restore suppression relies on read-failure path and dialog gate; no explicit restore-in-progress check (backupNudgeState.ts:45)"
  },
  {
   "at": "2026-11-22T16:27:42.644Z",
   "type": "advisory",
   "tasks": [
    "T6.6"
   ],
   "text": ".gitignore gained agent_docs/qa/feedback/ (QA output dir), outside Files: and not named by preflight; harmless, declare as EXTRA"
  },
  {
   "at": "2026-11-22T16:15:04.553Z",
   "type": "advisory",
   "tasks": [
    "T6.9"
   ],
   "text": "failed-submit scenario rejects fetch via init script instead of page.route (console guard); same app path"
  },
  {
   "at": "2026-11-22T16:15:04.384Z",
   "type": "advisory",
   "tasks": [
    "T6.6"
   ],
   "text": "FeedbackAutoPrompt lastActivityAt starts null: eligible users get the prompt at app open before any idle period"
  },
  {
   "at": "2026-11-22T11:30:32.270Z",
   "type": "advisory",
   "tasks": [
    "T5.8"
   ],
   "text": "Proof shots T5.8-1..3 have no step, attempt or annotation boxes (captions accurate); spec asserts total>=4 rather than the step count"
  },
  {
   "at": "2026-11-22T11:30:32.127Z",
   "type": "advisory",
   "tasks": [
    "T5.1"
   ],
   "text": "Do asks to record the working driver.js integration in the task Log; no Log line exists for T5.1"
  },
  {
   "at": "2026-11-22T11:30:31.991Z",
   "type": "advisory",
   "tasks": [
    "T5.4"
   ],
   "text": "Fresh desktop /app resolves only 4 of 7 tour steps (url-bar-send, save-to-collection need an open tab; sample-requests lives in History), exactly MIN_TOUR_STEPS, so one more hidden anchor means toast and no first-run tour; SC1 met, R3 ~7 steps and phase Try-in-UI \"Step 1/7\" not"
  },
  {
   "at": "2026-11-22T10:48:44.304Z",
   "type": "advisory",
   "tasks": [
    "T4.6"
   ],
   "text": "Proof shots T4.6-1..8 carry no step, attempt or annotation boxes; T4.6-1..4 are superseded duplicates of 5..8"
  },
  {
   "at": "2026-11-22T10:45:06.999Z",
   "type": "advisory",
   "tasks": [
    "T4.2"
   ],
   "text": "openUserInitiated drops a showing non-auto prompt instead of re-queuing it (usePromptStore.ts:111); no caller passes auto:false today"
  },
  {
   "at": "2026-11-20T15:05:33.307Z",
   "type": "advisory",
   "tasks": [
    "T3.1"
   ],
   "text": "shortcut_id/setting_id enums are literals in events.ts, not derived from settings/constants.ts (builder documented server-import reason)"
  },
  {
   "at": "2026-11-20T15:05:33.196Z",
   "type": "advisory",
   "tasks": [
    "T3.10"
   ],
   "text": "DNT scenario uses a 7s setTimeout quiet window (analytics-events.spec.ts:181) to prove absence; acceptable for a negative check"
  },
  {
   "at": "2026-11-20T15:05:33.088Z",
   "type": "advisory",
   "tasks": [
    "T3.8"
   ],
   "text": "HubHero.tsx:75 PrimaryCta uses default ctaId so /features reports hero_open_app; Verify names nonexistent src/components/landing/nav/LandingNav.spec.tsx"
  },
  {
   "at": "2026-11-20T15:05:32.989Z",
   "type": "advisory",
   "tasks": [
    "T3.4"
   ],
   "text": "createChain source param exists but no caller passes relay or import; chain_created is always manual"
  },
  {
   "at": "2026-11-20T15:05:32.875Z",
   "type": "advisory",
   "tasks": [
    "T3.2"
   ],
   "text": "request_sent source is hardcoded manual (useSendRequest.ts trackRequestSent); sample/history/chain/relay sources never emitted"
  },
  {
   "at": "2026-11-20T14:40:46.737Z",
   "type": "advisory",
   "tasks": [
    "T2.8"
   ],
   "text": "opt-out e2e uses synthetic ErrorEvent/PromiseRejectionEvent rather than real throws"
  },
  {
   "at": "2026-11-20T14:40:46.644Z",
   "type": "advisory",
   "tasks": [
    "T2.7"
   ],
   "text": "scrub.spec.ts corpus lacks an explicitly labelled env-value seed"
  },
  {
   "at": "2026-11-20T14:40:46.542Z",
   "type": "advisory",
   "tasks": [
    "T2.5"
   ],
   "text": "src/lib/relay/changeLog.spec.ts: no spec asserts relay_tool_applied fires exactly once per apply"
  },
  {
   "at": "2026-11-19T16:45:31.827Z",
   "type": "advisory",
   "tasks": [
    "T1.11"
   ],
   "text": "Proof shots show only the /app shell; network ACs are proven by spec assertions, not the images"
  },
  {
   "at": "2026-11-19T16:43:51.083Z",
   "type": "advisory",
   "tasks": [
    "T1.10"
   ],
   "text": "validate.ts:43 one branch uncovered (minor)"
  },
  {
   "at": "2026-11-19T16:39:30.366Z",
   "type": "advisory",
   "tasks": [
    "T1.10"
   ],
   "text": "validate.spec.ts has no explicit test for sanitizeTimestamp out-of-window (stale >24h, future >5min) clamping; validate.ts branches 94.73%"
  },
  {
   "at": "2026-11-19T16:39:30.282Z",
   "type": "advisory",
   "tasks": [
    "T1.11"
   ],
   "text": "Proof shots show the /app shell only; network ACs (payload shape, zero requests, no cookie) are proven by the spec assertions, not the images"
  }
 ],
 "activity": [
  {
   "at": "2026-11-23T01:49:24.987Z",
   "type": "deliverable",
   "tasks": [
    "T7.1",
    "T7.2",
    "T7.3",
    "T7.4",
    "T7.5"
   ],
   "text": "Backup nudge: eligibility state, BackupNudge card with export action, en/fr/ja copy, unit and e2e coverage",
   "files": [
    "src/components/backup/BackupNudge.tsx",
    "src/lib/backup/backupNudgeState.ts"
   ]
  },
  {
   "at": "2026-11-23T01:49:21.897Z",
   "tasks": [
    "T7.5"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "E2E_SERVER=dev PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/launch-readiness/backup-nudge.spec.ts --repeat-each=3 --workers=1 --output=test-results/T7.5 -> 12 passed (17.7s), exit 0; e2e 4/4 scenarios x3 clean; the 4 tests match the task's 4 Scenarios (@critical, @high x2, @medium); no skip/only/fixme/fail markers; proof shots 01 (nudge card \"Back up your wo",
   "fingerprint": "0d969d44084968077f66cfb43330b94528148220f399710bb19d7b2e5d278608",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-verifier-a7.md"
  },
  {
   "at": "2026-11-23T01:49:21.847Z",
   "type": "dirty_snapshot",
   "tasks": [],
   "hashes": {
    "agent_docs/launch-readiness/TASKS.md": "6647eed8cdfc7e5552a57078498bc527b2df4e92",
    "messages/en/common.json": "58946702b4eff7092860ba8f9f71f94441619293",
    "messages/fr/common.json": "1320ecc08bc0ed7c4fe671d823be19493589ede3",
    "messages/ja/common.json": "e9edd9d315ae15e796728eb50058ac0fff2a86c0",
    "src/components/layout/MainLayout.spec.tsx": "3dab0ca97b1854822d105d07dd31231e992fcb08",
    "src/components/layout/MainLayout.tsx": "906f84514732dab7dccb7fb1924c59dac3168a18",
    "src/components/settings/backup/useBackupExport.ts": "01efffe6a35df540fea8b1c9afb14f38283352ff",
    "agent_docs/qa/backup-nudge/01-nudge-shown.png": "a5fff038d6b9378623b22bd7c8ae4f9149e68778",
    "agent_docs/qa/backup-nudge/02-export-dialog-open.png": "648f89739a152e06104b9bd50b4e76afdb6eb2e8",
    "agent_docs/qa/backup-nudge/03-no-nudge-after-export.png": "bccf68fabd47ce8f801c9737ef3ab4bc20dcbc15",
    "agent_docs/qa/backup-nudge/04-no-nudge-after-dismiss.png": "bccf68fabd47ce8f801c9737ef3ab4bc20dcbc15",
    "agent_docs/qa/backup-nudge/05-no-nudge-fresh-profile.png": "2d53d38b4331e2cd60c29398c0bf8d954beea0df",
    "e2e/qa/launch-readiness/backup-nudge.spec.ts": "9fe60b0b258bda09c7bac39204c9a9aa1fb2eab4",
    "src/components/backup/BackupNudge.spec.tsx": "2b31688b28dbe14e1086e80ba7dc1f4fe9dc6d15",
    "src/components/backup/BackupNudge.tsx": "f7b828db87b6448180f6fc24a7f55ea45dd44b6e",
    "src/lib/backup/backupNudgeState.spec.ts": "2da7544b1c73809a9eb292e0fd6a23f062b17f1a",
    "src/lib/backup/backupNudgeState.ts": "83f4eb569f34df35278c16922aba2051d8628577"
   }
  },
  {
   "at": "2026-11-23T01:49:21.711Z",
   "type": "preflight_passed",
   "tasks": [
    "T7.5"
   ],
   "fingerprint": "0d969d44084968077f66cfb43330b94528148220f399710bb19d7b2e5d278608",
   "slop": "PASS"
  },
  {
   "at": "2026-11-23T01:49:08.424Z",
   "type": "advisory",
   "tasks": [
    "T7.5"
   ],
   "text": "snap fixture rewrites agent_docs/qa/backup-nudge PNGs on every verify run, changing the task fingerprint"
  },
  {
   "at": "2026-11-23T01:47:54.677Z",
   "type": "verify_started",
   "tasks": [
    "T7.5"
   ],
   "attempt": "2"
  },
  {
   "at": "2026-11-23T01:47:49.737Z",
   "type": "dirty_snapshot",
   "tasks": [],
   "hashes": {
    "agent_docs/launch-readiness/TASKS.md": "6647eed8cdfc7e5552a57078498bc527b2df4e92",
    "messages/en/common.json": "58946702b4eff7092860ba8f9f71f94441619293",
    "messages/fr/common.json": "1320ecc08bc0ed7c4fe671d823be19493589ede3",
    "messages/ja/common.json": "e9edd9d315ae15e796728eb50058ac0fff2a86c0",
    "src/components/layout/MainLayout.spec.tsx": "3dab0ca97b1854822d105d07dd31231e992fcb08",
    "src/components/layout/MainLayout.tsx": "906f84514732dab7dccb7fb1924c59dac3168a18",
    "src/components/settings/backup/useBackupExport.ts": "01efffe6a35df540fea8b1c9afb14f38283352ff",
    "agent_docs/qa/backup-nudge/01-nudge-shown.png": "a2d7d2caf1ac2d46e13ce848929a5e564b184b2b",
    "agent_docs/qa/backup-nudge/02-export-dialog-open.png": "1b1e8d4f6ce43421e82cf398dff804eb067fee91",
    "agent_docs/qa/backup-nudge/03-no-nudge-after-export.png": "d4b3e3e1ed1e2ea1e935373cc58fbd3249131bfc",
    "agent_docs/qa/backup-nudge/04-no-nudge-after-dismiss.png": "bccf68fabd47ce8f801c9737ef3ab4bc20dcbc15",
    "agent_docs/qa/backup-nudge/05-no-nudge-fresh-profile.png": "d1520893d0dde814fe298a2e69a0f74a86137aef",
    "e2e/qa/launch-readiness/backup-nudge.spec.ts": "9fe60b0b258bda09c7bac39204c9a9aa1fb2eab4",
    "src/components/backup/BackupNudge.spec.tsx": "2b31688b28dbe14e1086e80ba7dc1f4fe9dc6d15",
    "src/components/backup/BackupNudge.tsx": "f7b828db87b6448180f6fc24a7f55ea45dd44b6e",
    "src/lib/backup/backupNudgeState.spec.ts": "2da7544b1c73809a9eb292e0fd6a23f062b17f1a",
    "src/lib/backup/backupNudgeState.ts": "83f4eb569f34df35278c16922aba2051d8628577"
   }
  },
  {
   "at": "2026-11-23T01:47:49.553Z",
   "type": "preflight_passed",
   "tasks": [
    "T7.5"
   ],
   "fingerprint": "b3cfa0dede443fece93dbfa947f1445482ed7dbf55e0074f06c2358526cf2dfe",
   "slop": "PASS"
  },
  {
   "at": "2026-11-23T01:47:44.518Z",
   "tasks": [
    "T7.4"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "Verify command re-run: 2 files, 35/35 tests pass; coverage 100% stmts/branches/funcs/lines on backupNudgeState.ts and BackupNudge.tsx; no v8/istanbul ignore, no skip/only/fails markers; specs cover thresholds, 30-day, 14-day, first session, read failure, other-tab re-read",
   "fingerprint": "db4bbc043a3216313448c69d774d3139eeb18a985a70a464d2005c948341148f",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-verifier-a6.md"
  },
  {
   "at": "2026-11-23T01:47:44.518Z",
   "tasks": [
    "T7.2"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "bunx vitest run src/components/layout/MainLayout.spec.tsx 31/31 pass; gate via useAutoPromptGate (routes /app, /chain only; closed while a dialog is open or in session one); requests/releases backup-nudge slot; BackupNudge.spec \"stays hidden while another prompt holds the slot\" and \"action opens the export dialog\" pass; e2e @critical 3/3 shows nudge then export dialog; shots T7.2-1 (nudge, box on ",
   "fingerprint": "8db8febf578f9f4806400a206fb8a65ff833c4945f66ce9cfaff2e3ad2d8a86a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-verifier-a6.md"
  },
  {
   "at": "2026-11-23T01:47:44.518Z",
   "tasks": [
    "T7.1"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "bun run typecheck exit 0; backupNudgeState.ts constants MIN_REQUESTS=5, MIN_CHAINS=1, MIN_COLLECTIONS_WITH_REQUESTS=1, 30-day interval, 14-day snooze, shownThisSession cap, isFirstSession guard, both timestamps re-read per call, read failure -> false; useBackupExport.ts:209 recordBackupExport() only after downloadBlob in download() (safeStorage.set try/catch); key absent from preferences.ts allowl",
   "fingerprint": "f798d438a5c13122d3926d65cf157f5a7f6c0908d94ad81e4f32f456f109617f",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-verifier-a6.md"
  },
  {
   "at": "2026-11-23T01:47:34.365Z",
   "type": "advisory",
   "tasks": [
    "T7.1"
   ],
   "text": "Any chain counts toward eligibility even with no steps; R39 says chain/collection with content (backupNudgeState.ts:39)"
  },
  {
   "at": "2026-11-23T01:47:34.189Z",
   "type": "advisory",
   "tasks": [
    "T7.1"
   ],
   "text": "Restore suppression relies on read-failure path and dialog gate; no explicit restore-in-progress check (backupNudgeState.ts:45)"
  },
  {
   "at": "2026-11-23T01:44:03.072Z",
   "type": "verify_started",
   "tasks": [
    "T7.1",
    "T7.2",
    "T7.4",
    "T7.5"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-23T01:43:59.928Z",
   "type": "verify_passed",
   "tasks": [
    "T7.3"
   ],
   "evidence": "all reviewers passed; no verifier routed (risk=low)",
   "fingerprint": "6dbee4eeceb56642b02e9e7b785ecfcf63ae6d6b0f05c37fd0943f0dc9b01a6a",
   "skipped": "verifier"
  },
  {
   "at": "2026-11-23T01:43:59.924Z",
   "tasks": [
    "T7.3"
   ],
   "type": "reviewer_verdict",
   "evidence": "ja shot is the English stand-in; copy is identical to T7.2 and nothing is visibly broken. No UI change beyond message keys.",
   "fingerprint": "6dbee4eeceb56642b02e9e7b785ecfcf63ae6d6b0f05c37fd0943f0dc9b01a6a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-ui-sonnet-a6.md",
   "verdict": "PASS",
   "reviewer": "ui"
  },
  {
   "at": "2026-11-23T01:43:59.923Z",
   "tasks": [
    "T7.2"
   ],
   "type": "reviewer_verdict",
   "evidence": "bottom-right card is calm and on-brand (card surface, muted icon, small title, one primary action, ghost dismiss). Title, support copy and action are clearly ranked. Export action hides the card and opens the export dialog with no overlap.",
   "fingerprint": "8db8febf578f9f4806400a206fb8a65ff833c4945f66ce9cfaff2e3ad2d8a86a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-ui-sonnet-a6.md",
   "verdict": "PASS",
   "reviewer": "ui"
  },
  {
   "at": "2026-11-23T01:43:57.451Z",
   "tasks": [
    "T7.2"
   ],
   "type": "reviewer_verdict",
   "evidence": "BackupNudge requests the `backup-nudge` slot as an auto prompt through useAutoPromptGate, which restricts it to /app and /chain, blocks first session and blocks while a modal dialog is open. The slot arbiter keeps it from showing beside another prompt. Accept releases the slot and opens ExportBackupDialog. Dismiss snoozes and releases. The three events are emitted behind isTrackingActive(). Cleanu",
   "fingerprint": "8db8febf578f9f4806400a206fb8a65ff833c4945f66ce9cfaff2e3ad2d8a86a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-code-sonnet-a6.md",
   "verdict": "PASS",
   "reviewer": "code"
  },
  {
   "at": "2026-11-23T01:43:57.451Z",
   "tasks": [
    "T7.1"
   ],
   "type": "reviewer_verdict",
   "evidence": "thresholds (>=5 requests, >=1 chain, or a collection with a request), 30-day interval and 14-day snooze are named constants. shouldShowBackupNudge re-reads both timestamps at call time, rejects future-dated or unparsable values, and blocks on first session and once-per-session. A data-read failure returns false with a logged warning. recordBackupExport runs after downloadBlob, so it is written onl",
   "fingerprint": "f798d438a5c13122d3926d65cf157f5a7f6c0908d94ad81e4f32f456f109617f",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-code-sonnet-a6.md",
   "verdict": "PASS",
   "reviewer": "code"
  },
  {
   "at": "2026-11-23T01:43:55.234Z",
   "type": "verify_passed",
   "tasks": [
    "T7.3"
   ],
   "evidence": "all reviewers passed; no verifier routed (risk=low)",
   "fingerprint": "6dbee4eeceb56642b02e9e7b785ecfcf63ae6d6b0f05c37fd0943f0dc9b01a6a",
   "skipped": "verifier"
  },
  {
   "at": "2026-11-23T01:43:55.230Z",
   "tasks": [
    "T7.3"
   ],
   "type": "reviewer_verdict",
   "evidence": "ja shot is the English stand-in; copy is identical to T7.2 and nothing is visibly broken. No UI change beyond message keys.",
   "fingerprint": "6dbee4eeceb56642b02e9e7b785ecfcf63ae6d6b0f05c37fd0943f0dc9b01a6a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-ui-sonnet-a6.md",
   "verdict": "PASS",
   "reviewer": "ui"
  },
  {
   "at": "2026-11-23T01:43:55.229Z",
   "tasks": [
    "T7.2"
   ],
   "type": "reviewer_verdict",
   "evidence": "bottom-right card is calm and on-brand (card surface, muted icon, small title, one primary action, ghost dismiss). Title, support copy and action are clearly ranked. Export action hides the card and opens the export dialog with no overlap.",
   "fingerprint": "8db8febf578f9f4806400a206fb8a65ff833c4945f66ce9cfaff2e3ad2d8a86a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-ui-sonnet-a6.md",
   "verdict": "PASS",
   "reviewer": "ui"
  },
  {
   "at": "2026-11-23T01:43:52.102Z",
   "type": "verify_passed",
   "tasks": [
    "T7.3"
   ],
   "evidence": "all reviewers passed; no verifier routed (risk=low)",
   "fingerprint": "6dbee4eeceb56642b02e9e7b785ecfcf63ae6d6b0f05c37fd0943f0dc9b01a6a",
   "skipped": "verifier"
  },
  {
   "at": "2026-11-23T01:43:52.098Z",
   "tasks": [
    "T7.3"
   ],
   "type": "reviewer_verdict",
   "evidence": "ja shot is the English stand-in; copy is identical to T7.2 and nothing is visibly broken. No UI change beyond message keys.",
   "fingerprint": "6dbee4eeceb56642b02e9e7b785ecfcf63ae6d6b0f05c37fd0943f0dc9b01a6a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-ui-sonnet-a6.md",
   "verdict": "PASS",
   "reviewer": "ui"
  },
  {
   "at": "2026-11-23T01:43:52.098Z",
   "tasks": [
    "T7.2"
   ],
   "type": "reviewer_verdict",
   "evidence": "bottom-right card is calm and on-brand (card surface, muted icon, small title, one primary action, ghost dismiss). Title, support copy and action are clearly ranked. Export action hides the card and opens the export dialog with no overlap.",
   "fingerprint": "8db8febf578f9f4806400a206fb8a65ff833c4945f66ce9cfaff2e3ad2d8a86a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-ui-sonnet-a6.md",
   "verdict": "PASS",
   "reviewer": "ui"
  },
  {
   "at": "2026-11-23T01:43:49.089Z",
   "tasks": [
    "T7.3"
   ],
   "type": "reviewer_verdict",
   "evidence": "shot 7/T7.3-1.png (English stand-in, as briefed) shows the shared backupNudge keys rendering. The diff only adds ja strings, so parity is covered by the i18n spec.",
   "fingerprint": "6dbee4eeceb56642b02e9e7b785ecfcf63ae6d6b0f05c37fd0943f0dc9b01a6a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-ux-sonnet-a6.md",
   "verdict": "PASS",
   "reviewer": "ux"
  },
  {
   "at": "2026-11-23T01:43:49.088Z",
   "tasks": [
    "T7.2"
   ],
   "type": "reviewer_verdict",
   "evidence": "shot 7/T7.2-1.png shows a quiet card with title, plain-language reason, one primary \"Export backup\" action and a labelled dismiss; shot 7/T7.2-2.png shows the action hides the nudge and opens the export dialog. Source: section has an aria-label, the dismiss button has an accessible name, buttons have visible focus rings, and the card is capped at `max-w-[calc(100vw-2rem)]` so it fits 320px. Dismis",
   "fingerprint": "8db8febf578f9f4806400a206fb8a65ff833c4945f66ce9cfaff2e3ad2d8a86a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-ux-sonnet-a6.md",
   "verdict": "PASS",
   "reviewer": "ux"
  },
  {
   "at": "2026-11-23T01:43:47.346Z",
   "tasks": [
    "T7.3"
   ],
   "type": "reviewer_verdict",
   "evidence": "AC \"Message parity spec green\": the ja `backupNudge` block has the same four keys (title, description, action, dismiss) as the en and fr blocks added in T7.2, inserted at the same position with valid JSON comma and brace structure. Diff touches only `messages/ja/common.json`. ; Copy quality: Japanese strings are natural and consistent with existing ja terminology (リクエスト, Requestr kept as the produ",
   "fingerprint": "6dbee4eeceb56642b02e9e7b785ecfcf63ae6d6b0f05c37fd0943f0dc9b01a6a",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-review-code-haiku-a6.md",
   "verdict": "PASS",
   "reviewer": "code"
  },
  {
   "at": "2026-11-23T01:43:24.931Z",
   "type": "preflight_passed",
   "tasks": [
    "T7.3"
   ],
   "fingerprint": "6dbee4eeceb56642b02e9e7b785ecfcf63ae6d6b0f05c37fd0943f0dc9b01a6a",
   "slop": "PASS"
  },
  {
   "at": "2026-11-23T01:43:24.931Z",
   "type": "preflight_passed",
   "tasks": [
    "T7.2"
   ],
   "fingerprint": "8db8febf578f9f4806400a206fb8a65ff833c4945f66ce9cfaff2e3ad2d8a86a",
   "slop": "PASS"
  },
  {
   "at": "2026-11-23T01:43:20.631Z",
   "type": "task_built",
   "tasks": [
    "T7.2",
    "T7.3"
   ],
   "text": "built in batch 1 (builder PASS, gate PASS); proof shots registered",
   "files": [
    "src/components/backup/BackupNudge.tsx",
    "messages/ja/common.json"
   ]
  },
  {
   "at": "2026-11-23T01:42:30.512Z",
   "type": "task_started",
   "tasks": [
    "T7.2",
    "T7.3"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-23T01:42:26.029Z",
   "type": "dirty_snapshot",
   "tasks": [],
   "hashes": {
    "agent_docs/launch-readiness/TASKS.md": "6647eed8cdfc7e5552a57078498bc527b2df4e92",
    "messages/en/common.json": "58946702b4eff7092860ba8f9f71f94441619293",
    "messages/fr/common.json": "1320ecc08bc0ed7c4fe671d823be19493589ede3",
    "messages/ja/common.json": "e9edd9d315ae15e796728eb50058ac0fff2a86c0",
    "src/components/layout/MainLayout.spec.tsx": "3dab0ca97b1854822d105d07dd31231e992fcb08",
    "src/components/layout/MainLayout.tsx": "906f84514732dab7dccb7fb1924c59dac3168a18",
    "src/components/settings/backup/useBackupExport.ts": "01efffe6a35df540fea8b1c9afb14f38283352ff",
    "agent_docs/qa/backup-nudge/01-nudge-shown.png": "a2d7d2caf1ac2d46e13ce848929a5e564b184b2b",
    "agent_docs/qa/backup-nudge/02-export-dialog-open.png": "de2184d455eb957b0cdfa365e4027a3eb350a9db",
    "agent_docs/qa/backup-nudge/03-no-nudge-after-export.png": "d4b3e3e1ed1e2ea1e935373cc58fbd3249131bfc",
    "agent_docs/qa/backup-nudge/04-no-nudge-after-dismiss.png": "d4b3e3e1ed1e2ea1e935373cc58fbd3249131bfc",
    "agent_docs/qa/backup-nudge/05-no-nudge-fresh-profile.png": "d1520893d0dde814fe298a2e69a0f74a86137aef",
    "e2e/qa/launch-readiness/backup-nudge.spec.ts": "9fe60b0b258bda09c7bac39204c9a9aa1fb2eab4",
    "src/components/backup/BackupNudge.spec.tsx": "2b31688b28dbe14e1086e80ba7dc1f4fe9dc6d15",
    "src/components/backup/BackupNudge.tsx": "f7b828db87b6448180f6fc24a7f55ea45dd44b6e",
    "src/lib/backup/backupNudgeState.spec.ts": "2da7544b1c73809a9eb292e0fd6a23f062b17f1a",
    "src/lib/backup/backupNudgeState.ts": "83f4eb569f34df35278c16922aba2051d8628577"
   }
  },
  {
   "at": "2026-11-23T01:42:25.854Z",
   "type": "preflight_passed",
   "tasks": [
    "T7.5"
   ],
   "fingerprint": "996fa47fd5575a0433fbfeb65b4a6206c21b1377808315d9e9f2e50d8ba8ce78",
   "slop": "PASS"
  },
  {
   "at": "2026-11-23T01:42:25.854Z",
   "type": "preflight_passed",
   "tasks": [
    "T7.4"
   ],
   "fingerprint": "db4bbc043a3216313448c69d774d3139eeb18a985a70a464d2005c948341148f"
  },
  {
   "at": "2026-11-23T01:42:08.397Z",
   "type": "task_built",
   "tasks": [
    "T7.5"
   ],
   "text": "e2e PASS 4/4, flake x3 clean",
   "files": [
    "e2e/qa/launch-readiness/backup-nudge.spec.ts"
   ]
  },
  {
   "at": "2026-11-23T01:41:04.307Z",
   "type": "task_started",
   "tasks": [
    "T7.5"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-23T01:41:04.138Z",
   "type": "task_built",
   "tasks": [
    "T7.4"
   ],
   "text": "unit PASS: lowest file 100% lines, shuffle clean",
   "files": [
    "src/lib/backup/backupNudgeState.spec.ts"
   ]
  },
  {
   "at": "2026-11-23T01:40:00.808Z",
   "type": "task_started",
   "tasks": [
    "T7.4"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-23T01:40:00.605Z",
   "type": "build_started",
   "tasks": [
    "T7.4",
    "T7.5"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-23T01:39:57.190Z",
   "type": "dirty_snapshot",
   "tasks": [],
   "hashes": {
    "messages/en/common.json": "58946702b4eff7092860ba8f9f71f94441619293",
    "messages/fr/common.json": "1320ecc08bc0ed7c4fe671d823be19493589ede3",
    "messages/ja/common.json": "e9edd9d315ae15e796728eb50058ac0fff2a86c0",
    "src/components/layout/MainLayout.spec.tsx": "3dab0ca97b1854822d105d07dd31231e992fcb08",
    "src/components/layout/MainLayout.tsx": "906f84514732dab7dccb7fb1924c59dac3168a18",
    "src/components/settings/backup/useBackupExport.ts": "01efffe6a35df540fea8b1c9afb14f38283352ff",
    "src/components/backup/BackupNudge.tsx": "f7b828db87b6448180f6fc24a7f55ea45dd44b6e",
    "src/lib/backup/backupNudgeState.ts": "83f4eb569f34df35278c16922aba2051d8628577"
   }
  },
  {
   "at": "2026-11-23T01:39:56.996Z",
   "type": "preflight_passed",
   "tasks": [
    "T7.3"
   ],
   "fingerprint": "6dbee4eeceb56642b02e9e7b785ecfcf63ae6d6b0f05c37fd0943f0dc9b01a6a",
   "slop": "PASS"
  },
  {
   "at": "2026-11-23T01:39:56.996Z",
   "type": "preflight_passed",
   "tasks": [
    "T7.2"
   ],
   "fingerprint": "8db8febf578f9f4806400a206fb8a65ff833c4945f66ce9cfaff2e3ad2d8a86a",
   "slop": "PASS"
  },
  {
   "at": "2026-11-23T01:39:56.996Z",
   "type": "preflight_passed",
   "tasks": [
    "T7.1"
   ],
   "fingerprint": "f798d438a5c13122d3926d65cf157f5a7f6c0908d94ad81e4f32f456f109617f"
  },
  {
   "at": "2026-11-23T01:39:11.200Z",
   "type": "task_built",
   "tasks": [
    "T7.3"
   ],
   "text": "ja copy; src/i18n green",
   "files": [
    "messages/ja/common.json"
   ]
  },
  {
   "at": "2026-11-23T01:39:10.987Z",
   "type": "task_built",
   "tasks": [
    "T7.2"
   ],
   "text": "BackupNudge mounted in MainLayout, en/fr copy; MainLayout spec green",
   "files": [
    "src/components/backup/BackupNudge.tsx",
    "src/components/layout/MainLayout.tsx",
    "src/components/layout/MainLayout.spec.tsx",
    "messages/en/common.json",
    "messages/fr/common.json"
   ]
  },
  {
   "at": "2026-11-23T01:39:10.722Z",
   "type": "task_built",
   "tasks": [
    "T7.1"
   ],
   "text": "backupNudgeState + export timestamp; typecheck green",
   "files": [
    "src/lib/backup/backupNudgeState.ts",
    "src/components/settings/backup/useBackupExport.ts"
   ]
  },
  {
   "at": "2026-11-23T01:37:37.577Z",
   "type": "task_started",
   "tasks": [
    "T7.1",
    "T7.2",
    "T7.3"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-23T01:37:37.416Z",
   "type": "build_started",
   "tasks": [
    "T7.1",
    "T7.2",
    "T7.3"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-23T01:37:35.028Z",
   "type": "run_started",
   "tasks": [
    "T7.1",
    "T7.2",
    "T7.3",
    "T7.4",
    "T7.5"
   ],
   "pipeline": 2,
   "baseline": {
    "head": "0a2324d8c0007af5572ab28a1c607486627945e6",
    "status": " M .dashboard/launch-readiness/data.js\u0000 M .dashboard/launch-readiness/events.jsonl\u0000?? .dashboard/launch-readiness/docs/INTERVIEW.html\u0000?? .dashboard/launch-readiness/docs/PLAN.html\u0000?? .dashboard/launch-readiness/docs/REPO_MAP.html\u0000?? .dashboard/launch-readiness/docs/SPEC.html\u0000?? .dashboard/launch-readiness/docs/TASKS.html\u0000?? .dashboard/launch-readiness/shots/1/T1.11-1.png\u0000?? .dashboard/launch-readiness/shots/1/T1.11-2.png\u0000?? .dashboard/launch-readiness/shots/1/T1.11-3.png\u0000?? .dashboard/launch-readiness/shots/2/T2.1-1.png\u0000?? .dashboard/launch-readiness/shots/2/T2.1-2.png\u0000?? .dashboard/launch-readiness/shots/2/T2.1-3.png\u0000?? .dashboard/launch-readiness/shots/2/T2.2-1.png\u0000?? .dashboard/launch-readiness/shots/2/T2.6-1.png\u0000?? .dashboard/launch-readiness/shots/2/T2.6-2.png\u0000?? .dashboard/launch-readiness/shots/2/T2.6-3.png\u0000?? .dashboard/launch-readiness/shots/2/T2.6-4.png\u0000?? .dashboard/launch-readiness/shots/2/T2.8-1.png\u0000?? .dashboard/launch-readiness/shots/2/T2.8-2.png\u0000?? .dashboard/launch-readiness/shots/3/T3.10-1.png\u0000?? .dashboard/launch-readiness/shots/3/T3.10-2.png\u0000?? .dashboard/launch-readiness/shots/3/T3.10-3.png\u0000?? .dashboard/launch-readiness/shots/3/T3.10-4.png\u0000?? .dashboard/launch-readiness/shots/3/T3.8-1.png\u0000?? .dashboard/launch-readiness/shots/4/T4.3-2.png\u0000?? .dashboard/launch-readiness/shots/4/T4.3-3.png\u0000?? .dashboard/launch-readiness/shots/4/T4.3-4.png\u0000?? .dashboard/launch-readiness/shots/4/T4.3-5.png\u0000?? .dashboard/launch-readiness/shots/4/T4.4-2.png\u0000?? .dashboard/launch-readiness/shots/4/T4.4-3.png\u0000?? .dashboard/launch-readiness/shots/4/T4.6-1.png\u0000?? .dashboard/launch-readiness/shots/4/T4.6-2.png\u0000?? .dashboard/launch-readiness/shots/4/T4.6-3.png\u0000?? .dashboard/launch-readiness/shots/4/T4.6-4.png\u0000?? .dashboard/launch-readiness/shots/4/T4.6-5.png\u0000?? .dashboard/launch-readiness/shots/4/T4.6-6.png\u0000?? .dashboard/launch-readiness/shots/4/T4.6-7.png\u0000?? .dashboard/launch-readiness/shots/4/T4.6-8.png\u0000?? .dashboard/launch-readiness/shots/5/T5.1-1.png\u0000?? .dashboard/launch-readiness/shots/5/T5.3-1.png\u0000?? .dashboard/launch-readiness/shots/5/T5.3-2.png\u0000?? .dashboard/launch-readiness/shots/5/T5.4-1.png\u0000?? .dashboard/launch-readiness/shots/5/T5.5-1.png\u0000?? .dashboard/launch-readiness/shots/5/T5.5-2.png\u0000?? .dashboard/launch-readiness/shots/5/T5.5-3.png\u0000?? .dashboard/launch-readiness/shots/5/T5.8-1.png\u0000?? .dashboard/launch-readiness/shots/5/T5.8-2.png\u0000?? .dashboard/launch-readiness/shots/5/T5.8-3.png\u0000?? .dashboard/launch-readiness/shots/6/T6.3-1.png\u0000?? .dashboard/launch-readiness/shots/6/T6.3-2.png\u0000?? .dashboard/launch-readiness/shots/6/T6.3-3.png\u0000?? .dashboard/launch-readiness/shots/6/T6.4-1.png\u0000?? .dashboard/launch-readiness/shots/6/T6.5-1.png\u0000?? .dashboard/launch-readiness/shots/6/T6.5-2.png\u0000?? .dashboard/launch-readiness/shots/6/T6.5-3.png\u0000?? .dashboard/launch-readiness/shots/6/T6.5-4.png\u0000?? .dashboard/launch-readiness/shots/6/T6.6-1.png\u0000?? .dashboard/launch-readiness/shots/6/T6.6-2.png\u0000?? .dashboard/launch-readiness/shots/6/T6.6-3.png\u0000?? .dashboard/launch-readiness/shots/6/T6.6-4.png\u0000?? .dashboard/launch-readiness/shots/6/T6.6-5.png\u0000?? .dashboard/launch-readiness/shots/6/T6.6-6.png\u0000?? .dashboard/launch-readiness/shots/6/T6.6-7.png\u0000?? .dashboard/launch-readiness/shots/6/T6.6-8.png\u0000?? .dashboard/launch-readiness/shots/6/T6.9-1.png\u0000?? .dashboard/launch-readiness/shots/6/T6.9-2.png\u0000?? .dashboard/launch-readiness/shots/6/T6.9-3.png\u0000?? .dashboard/launch-readiness/shots/6/T6.9-4.png\u0000?? .dashboard/launch-readiness/shots/6/T6.9-5.png\u0000?? .dashboard/launch-readiness/shots/manifest.json\u0000"
   }
  },
  {
   "at": "2026-11-22T16:28:50.238Z",
   "type": "commit",
   "tasks": [
    "T6.1",
    "T6.2",
    "T6.3",
    "T6.4",
    "T6.5",
    "T6.6",
    "T6.7",
    "T6.8",
    "T6.9"
   ],
   "attempt": "3",
   "text": "feat(feedback): feedback dialog, counters and idle-gated auto-prompt",
   "sha": "0a2324d8c0007af5572ab28a1c607486627945e6",
   "branch": "feature/launch-readiness",
   "pushed": "yes",
   "evidence": "e2e 15/15 (5x3), lowest unit coverage 100%, full suite 11086 tests pass"
  },
  {
   "at": "2026-11-22T16:28:31.537Z",
   "type": "deliverable",
   "tasks": [
    "T6.1",
    "T6.2",
    "T6.3",
    "T6.4",
    "T6.5",
    "T6.6",
    "T6.7",
    "T6.8",
    "T6.9"
   ],
   "text": "Feedback: eligibility/state, counters, FeedbackDialog, survey flag, entry points, idle-gated auto-prompt, unit+e2e coverage",
   "files": [
    "src/lib/feedback/eligibility.ts"
   ]
  },
  {
   "at": "2026-11-22T16:28:27.720Z",
   "tasks": [
    "T6.9"
   ],
   "attempt": "3",
   "type": "verify_passed",
   "evidence": "Verify (dev server, --repeat-each=3 --workers=1) -> 15 passed (14.7s), 5 scenarios x3 clean; no skip/only/fixme/fail markers",
   "fingerprint": "324437e1d06da76466a13b35690f33103182946843a43229f66b06538f5f6fb4",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-verifier-a15.md"
  },
  {
   "at": "2026-11-22T16:28:27.720Z",
   "tasks": [
    "T6.8"
   ],
   "attempt": "3",
   "type": "verify_passed",
   "evidence": "Verify -> 2 files 33/33 (Dialog 11, AutoPrompt 22); FeedbackDialog.tsx and FeedbackAutoPrompt.tsx 100/100/100/100; spec has the happy-dom header and covers idle detection (mount window, pointer/key restart, in-flight request, chain run, focused input, code editor), arbitration (yield to higher priority, withdraw, keep slot on own gate close, release on unmount, once per session) and opted-out prom",
   "fingerprint": "27eb5b554a923fdf293eac660465d8e47ea0486d15be2c5ffff31a910ccd03ae",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-verifier-a15.md"
  },
  {
   "at": "2026-11-22T16:28:27.720Z",
   "tasks": [
    "T6.7"
   ],
   "attempt": "3",
   "type": "verify_passed",
   "evidence": "Verify -> 2 files 35/35; eligibility.ts and feedbackState.ts 100/100/100/100",
   "fingerprint": "dd434188786fca01172bfd247079a1d681ba66fe8c901f285802d4226687c517",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-verifier-a15.md"
  },
  {
   "at": "2026-11-22T16:28:27.720Z",
   "tasks": [
    "T6.6"
   ],
   "attempt": "3",
   "type": "verify_passed",
   "evidence": "MainLayout.spec 30/30; FeedbackAutoPrompt.tsx:53 seeds lastActivityAt at mount. Every live AC re-proven on the post-fix component: J pointermove every 300ms from document start -> 0 shown in 9s, shown 2845ms after stop; K keydown every 400ms -> 0 shown in 8s; Q quiet eligible -> shown 3413ms after load, stable; A eligible -> shown at ~3s, stays to 16s, no flicker; G Escape -> dismissedAt saved, re",
   "fingerprint": "a6eeb5b87d022de91c317c64983279d1288496a95a26c8d1b86845d8b30ca7f4",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-verifier-a15.md"
  },
  {
   "at": "2026-11-22T16:28:27.720Z",
   "tasks": [
    "T6.5"
   ],
   "attempt": "3",
   "type": "verify_passed",
   "evidence": "LeftPanel 14/14 + CommandPalette 12/12 green; e2e sidebar and palette scenarios 3/3; live D: sidebar item opens the dialog in the first session; shots T6.5-1..4 (files unchanged since a9, opened there and accurate)",
   "fingerprint": "fa0d508974051365f3732f2903afb0676f8474cbc58d72ed8abb45a4a6f8a55c",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-verifier-a15.md"
  },
  {
   "at": "2026-11-22T16:28:27.719Z",
   "tasks": [
    "T6.4"
   ],
   "attempt": "3",
   "type": "verify_passed",
   "evidence": "Verify (AppProviders.spec) green in 4-file run 70/70; new case \"ignores the survey id and key when the build flag is false\" (AppProviders.spec.tsx:145) stubs POSTHOG_FEEDBACK_SURVEY_ID + POSTHOG_KEY with flag \"false\" and expects false, closing the a9 blocker; next.config.ts env holds only NEXT_PUBLIC_FEEDBACK_SURVEY_CONFIGURED (boolean string); /api/ingest POST x3 -> 204, GET -> 405; live F: uncon",
   "fingerprint": "1d213a44940a71a342d5657fbd0705e193ccc4e61406f8e89d4c21e9cb32b14d",
   "report": ".dashboard/launch-readiness/reports/launch-readiness-verifier-a15.md"
  },
  {
   "at": "2026-11-22T16:27:42.644Z",
   "type": "advisory",
   "tasks": [
    "T6.6"
   ],
   "text": ".gitignore gained agent_docs/qa/feedback/ (QA output dir), outside Files: and not named by preflight; harmless, declare as EXTRA"
  },
  {
   "at": "2026-11-22T16:20:25.647Z",
   "type": "verify_started",
   "tasks": [
    "T6.4",
    "T6.5",
    "T6.6",
    "T6.7",
    "T6.8",
    "T6.9"
   ],
   "attempt": "3"
  }
 ]
};
