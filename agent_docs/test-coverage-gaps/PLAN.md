# Implementation Plan: Close the Test-Coverage Gap Report (Requestr)

Source of truth: `agent_docs/test-coverage-gaps/SPEC.md` (confirmed decisions D1-D8). Audit detail: `agent_docs/test-coverage-gaps/audit/coverage-*.md`.
Branch `feature/ai-agent`, one PR at the end. No commits unless the maintainer says so. Package manager is `bun` (never `npm`). The app server is always running; never start it manually.

## 1. Overview

Four strictly sequential phases:

| Phase | Goal | Slices |
|---|---|---|
| 1 | Fix B1-B10, each with a unit/component test that fails first (no e2e in this phase) | 10 |
| 2 | Unit tests for every High + Medium gap (92 enumerated, 84 distinct) | 27 |
| 3 | E2E: parity-script fix, local mock server, seeded QA regression spec, scenario files, then tests one scenario file at a time | 1 parity + 4 infra + 1 seeded QA + 7 scenario + 13 write + 1 checkpoint = 27 |
| 4 | Cleanup: re-verify parity fix, docs lint, Bug Log, final re-audit | 4 |

Total 68 slices. Each slice is sized to touch at most 5 files (a spec and its target count as two). A slice that would exceed that is split (noted where it applies).

Command reference (from `package.json`):

| Purpose | Command |
|---|---|
| Unit, all / one file | `bun run test` / `bun run test <path>` |
| Lint | `bun run lint:check` (autofix: `bun run lint:write`) |
| Type check | `bun run typecheck` (= `tsc --noEmit`); run only at a phase checkpoint, never mid-phase |
| E2E, all / one file | `bun run test:e2e` / `bunx playwright test e2e/<file>.spec.ts` |
| E2E list titles | `bunx playwright test --list` |
| Chain parity | `bash e2e/scenarios/chain/check-ids.sh`, `bash e2e/scenarios/chain/check-parity.sh` |

## 2. Architecture decisions

### 2.1 Bug-fix structure (Phase 1)
- One slice per bug, protocol per slice: (a) write failing test, (b) run it and confirm it fails for the stated reason, (c) minimal fix, (d) test green + neighbouring specs green, (e) mutation sanity check (revert fix, test goes red).
- Unreproducible bug: no code change; record "not reproducible, dropped" in a running Bug Log table kept in the PR-description draft (see P4.3). The slice is still "done".
- Regression tests live in the spec file that Phase 2 later extends (e.g. B5 creates `TabListDropdown.spec.tsx`, which U-TAB-01 extends). Phase 2 slices therefore say "extend, do not duplicate".
- B10 uses one shared helper `src/lib/envNameValidation.ts` (trim + case-insensitive match against other environments, ignoring the env's own id) imported by `EnvListPanel`, `EnvManagerDialog`, `SidebarMainTab`. Validation runs only on create/rename; hydration never validates (legacy duplicates keep loading, selection by id).
- B8: default section derived from `SETTINGS_SECTIONS[0]` (single source of truth).
- B2: remove button, then remove only dead code (`restartTour` in `useFirstTimeUser`, props, i18n keys) if grep shows no other use; fr/ja parity spec must stay green.

### 2.2 Mock server (Phase 3a)
- Location: `e2e/support/mock-server/` (TypeScript, run by `bun e2e/support/mock-server/index.ts`). Files: `index.ts` (bootstrap, listeners), `httpRoutes.ts` (echo, controls, redirect, large, cookies, binary), `requestLog.ts` (`/__requests`, `/__reset`, per-test namespace via `x-test-id`), `wsServer.ts` (`ws`), `socketIoServer.ts` (`socket.io`), `graphqlRoutes.ts` (`graphql` package is already a dependency), `tlsCert.ts`, `mockBaseUrl.ts` (exports `MOCK_BASE_URL`, `MOCK_HTTPS_URL`, `MOCK_WS_URL`).
- Ports: HTTP/WS/Socket.IO/GraphQL on `127.0.0.1:3333` (takes over the dead `run-socketio-echo.sh` entry, so `SOCKETIO_TEST_URL` default keeps working and `socketio.spec.ts` is unchanged); HTTPS on `127.0.0.1:3334`. Both overridable via `MOCK_PORT` / `MOCK_HTTPS_PORT` for collision handling.
- Certificate (D5): generated at startup into `os.tmpdir()` by invoking `openssl req -x509 ... -subj /CN=127.0.0.1` through `execFileSync` (no key material committed, no new dependency beyond D4). If `openssl` is missing the server fails fast with an explicit message. Adding the `selfsigned` package instead would need the "ask first" gate in SPEC section 12, so it is only a fallback.
- Dependencies (D4): `bun add -d socket.io ws @types/ws` (the only package changes allowed).
- Isolation: workers=2 share the server. Every test sends `x-test-id` (or uses its own path prefix); `/__requests?testId=` filters the log; `/__reset?testId=` clears only that namespace. Tests never call a global reset while another worker may be active.
- `playwright.config.ts` webServer: replace the `bash scripts/run-socketio-echo.sh` entry with `{ command: "bun e2e/support/mock-server/index.ts", url: "http://127.0.0.1:3333/__health", reuseExistingServer: !process.env.CI, timeout: 30_000 }`. The config change is an "ask first" item in SPEC section 12; this plan treats the PR-level approval of the plan as that approval (flagged in Open Questions). Testdir, workers, ports of the Next.js entry stay as is. Note the whole `webServer` is `undefined` when `PLAYWRIGHT_TEST_BASE_URL` is set; the mock server must then be started separately, so the config is restructured so the mock entry is always present (only the Next.js entry is conditional).
- `chainRoutes.ts` (`page.route` mock of `/api/proxy`) stays untouched; chain `qa/` tests are not migrated. E-CHN-02 and E-CHN-04 are the exception: they use the real proxy plus mock-server `delay` and server-side timestamps.
- Existing live-service e2e (dummyjson, httpbin, echo.websocket.org, trevorblades) is left as is, except tests rewritten by this plan.

### 2.3 E2E tooling flow (user-mandated)
1. `/e2e setup` is NOT run in its default form (it would create `e2e/tests/`, page objects, a new config). Repo layout is kept: specs at `e2e/<area>.spec.ts` and `e2e/qa/*.spec.ts`, `testDir: "./e2e"`, scenarios at `e2e/scenarios/<area>.feature.md` and `e2e/scenarios/chain/*.feature.md`; no `e2e/pages/`; do not move specs into `e2e/tests/`. The only `setup` effect we want is `e2e/README.md` documenting the local mock server, base URL (`http://127.0.0.1:3000`, `MOCK_BASE_URL`), isolation (`x-test-id`, 2 workers) and selector policy (testid/role only, no `waitForTimeout`). It is written in slice P3.5 (also satisfies the command's step 1 precondition "verify `e2e/README.md` exists").
2. `/e2e scenarios <area>` (Explore discovery -> user checkpoint -> `identify-e2e-scenarios` writers -> batch review) writes/updates the `.feature.md` files for the spec's E-* items. The command's checkpoint (AskUserQuestion confirm/trim) is kept; the spec's E-* list is passed as the candidate list so discovery does not drift.
3. Only after ALL seven scenario slices are done and reviewed does any `/e2e write <scenario-file>` run. Writes are sequential, one file at a time (not the command's parallel `all` mode); each spawns the `e2e-engineer` agent. Use `bunx playwright`, never `npx`.
4. The mock server (P3.2-P3.4) and `e2e/README.md` (P3.5) must exist and `bunx playwright test e2e/mock-server.spec.ts` must be green BEFORE the first `/e2e write`.
5. The command text says specs go to `e2e/tests/`; every invocation prompt must state the repo-layout override (spec path `e2e/<area>.spec.ts`).

### 2.4 Unit-test tooling (user-mandated, Phase 2)
EVERY Phase 2 slice is executed by spawning the `agent-skills:test-engineer` agent (subagent_type `agent-skills:test-engineer`). Inside the slice the agent applies the `write-component-tests` skill for component/hook-with-UI specs (`*.spec.tsx`) and may additionally use `writing-unit-tests` for pure lib/store functions (`src/lib/*`, `src/stores/*`). Slice prompt template: slice id, item IDs with their "what to assert" rows copied from SPEC section 6, target files, "extend existing spec, do not duplicate", real Zustand stores with `setState` reset, mock only network/IndexedDB, AAA structure, behavior-describing names, `data-testid` not CSS classes, run `bun run test <files>` + `bun run lint:check`, report mutation sanity check. One agent per slice, run sequentially (several slices extend the same spec file).

### 2.5 Ambiguities resolved (see also section 8)
- Doc timing: SPEC puts `.feature.md` edits in Phase 4 and also says update the doc in the same task as the test. User order says scenarios before tests, so all `.feature.md` creation/drift fixes happen in the Phase 3 scenario slices; Phase 4 only verifies 1:1 mapping (P4.2).
- Chain e2e IDs: `check-parity.sh` enforces `CHN-*` IDs only for `e2e/scenarios/chain/*.feature.md` vs `e2e/qa/chain-e2e-*.spec.ts`. The new E-CHN-* scenarios go into `e2e/scenarios/chain.feature.md` + existing `e2e/chain.spec.ts` so the parity count (285/285) is not disturbed.
- E-RT-04 covers WebSocket and Socket.IO close in one row; it is split into 04a (WebSocket) and 04b (Socket.IO) so each lands in its own scenario file.
- Pointers (U-SET-01/07/12/13, U-RT-10/13, E-SET-06) are mapped to the slice of their owner and marked "ptr".
- U-ENV-15 and U-SET-02 are written inside their Phase 1 bug slices (B10, B1) as the failing tests; Phase 2 does not re-do them.

## 3. Dependency graph

```
P3.1 check-parity fix ──> P3.2 deps+HTTP mock ──> P3.3 WS/SIO/GraphQL ──> P3.4 HTTPS+config+smoke ──> P3.5 e2e/README.md ──> Checkpoint 3a ──> P3.6 seeded QA spec
                                                                                   │
Phase 1 ──> Phase 2 ──> Phase 3 (P3.1 ... P3.6 above, then): SC1..SC7 (all scenario files, user checkpoint) ──> W1..W13 (sequential) ──> P3.27
                                                                                                                │
                                                                              Phase 4: P4.1 ── P4.2 ── P4.3 ── P4.4
```

Hard slice-level dependencies:

| Dependency | Why |
|---|---|
| B3 -> U-REQ-03 (P2.15), -> W9 (E-SET-11) | proxy must honor `sslVerify` before testing it; HTTPS listener (P3.4) also required |
| B4 -> B9 | both edit `useSendRequest.spec/ts`; B9 failing tests are written on top of B4's reordered flow |
| B4 -> P2.3 (U-ENV-04), P2.15 (U-REQ-04) | extend B4 regression tests |
| B5 -> P2.20 (U-TAB-01) | B5 creates `TabListDropdown.spec.tsx` that U-TAB-01 extends |
| B6 -> B7 | same files (`useConnectionStore.ts/.spec.ts`); B7 adds tab-store hook-up |
| B6, B7 -> P2.26 (U-RT-03), W12/W13 (E-RT-02/04) | extend regressions; server-side behaviors |
| B1 -> W9 (E-SET-05), U-SET-02 is its own failing test | |
| B2 -> B8 | both touch `SettingsPageClient`/`GeneralSection`; B2 removes the button first, then B8 sets the default section |
| B2 -> P2.11 (U-SET-03, "Restart Tour not rendered"), -> SC6/W9 (E-SET-07, settings scenario rewrite) | button must be gone before the scenario/test asserting its absence; old `GeneralSection.spec` assertions removed in B2 |
| B8 -> P2.23 (U-SET-04) | extends B8's spec |
| B9 -> U-RT-12/U-RT-04 (P2.27), -> W10 (E-RT-01, E-RT-09) | recording + tab type must exist |
| B10 -> SC1 (environments scenario, E-ENV-07/12), -> W3 | e2e that relied on duplicate names is rewritten after uniqueness exists |
| P2.8/P2.9 (RequestItem, SidebarMainTab specs) after P2.2, P2.21 | multiple slices extend `SidebarMainTab.spec.tsx` / `RequestItem.spec.tsx`; sequential order prevents conflicts |
| P3.1-P3.6 -> every SC and W slice | mock server + README precede any `/e2e write` (scenarios may be written before mock completes, but the plan keeps infra first so scenario steps can use real mock endpoints) |
| All SC1-SC7 reviewed -> W1 | user mandate: scenarios fully done before the first `write` |
| W4 (E-REQ-12 code-gen) -> W9 (E-SET-02) | E-SET-02 reuses the helper |
| W2 (E-COL-04 sidebar search helper) -> W8 (E-CHN-06) | shared helper |
| P3.27 -> P4.4 | re-audit runs against the final merged state |

Parallelism: none by design (user-mandated sequential phases; many slices share spec files and the 2-worker e2e box).

## 4. Phase 1: Fix bugs B1-B10

Ordered to satisfy dependencies. Each slice: failing test -> confirm red -> minimal fix -> green -> `bun run lint:check`. Agent: main thread or `general-purpose`; skill `test-driven-development`.

| Slice | Bug | Files (max 5) | Failing test | Notes |
|---|---|---|---|---|
| P1.1 | B1 | `src/i18n/request.ts`, `src/i18n/request.spec.ts` (new), `src/components/settings/LanguageSection.tsx`, `src/components/layout/HtmlLangSetter.tsx`, `src/components/settings/LanguageSection.spec.tsx` (new) | locale fr/ja resolves fr/ja bundle from `messages.ts`; selecting a language changes `document.documentElement.lang` and a rendered string; persists after reload (storage/cookie round-trip) | Includes U-SET-02. If server-side `request.ts` cannot read a client choice, persist via cookie read in `request.ts`; keep `messages.parity.spec.ts` green. Mutation check mandatory |
| P1.2 | B2 (D3) | `src/components/settings/GeneralSection.tsx`, `GeneralSection.spec.tsx`, `src/app/settings/SettingsPageClient.tsx`, `src/hooks/useFirstTimeUser.ts` (+ spec), `src/i18n/messages.ts` | `GeneralSection` does not render Restart Tour (red now) | Remove only dead code; `MainLayout.tsx` comment untouched. Drop old assertions. TASKS splits this into T1.2 (button + assertions) and T1.3 (dead-code cleanup, only if grep shows dead code) |
| P1.3 | B3 | `src/app/api/proxy/route.ts`, `src/app/api/proxy/route.spec.ts` | `sslVerify:false` -> upstream call made with TLS verification disabled (assert the agent/option); `true`/omitted -> verified | Default stays verify-on. Do not change other proxy behavior (SPEC section 12) |
| P1.4 | B4 | `src/hooks/useSendRequest.ts`, `useSendRequest.spec.ts`, possibly `src/lib/resolveRequest.ts` | (a) pre-script `environment.set("token","x")` then `{{token}}` in URL/header/body resolves to `x`; (b) exact `runRequest` payload: auth bearer/basic/apikey `{{token}}` resolved | If (b) is already green: document in Bug Log, drop that half |
| P1.5 | B5 | `src/components/layout/TabListDropdown.tsx`, `TabListDropdown.spec.tsx` (new) | type search, select row, reopen -> empty; same after Close all | Single close handler used by every close path |
| P1.6 | B6 | `src/stores/useConnectionStore.ts`, `useConnectionStore.spec.ts`, `src/components/request/tabs/SocketIOTabs.tsx` | rewrite "connect_error disconnects and clears error" test to assert error retained (red), then fix | Minimal UI: show retained error; Connect re-enabled. Old test rewritten, not deleted |
| P1.7 | B7 | `src/stores/useTabsStore.ts`, `useTabsStore.spec.ts`, `useConnectionStore.ts` (+spec only if API needed) | closing a connected ws/socketio tab calls disconnect for that tab; also closeAll, closeOthers, closeTabsForRequest | Handshake headers dropped (D2). Rename the WebSocketTabs headers test in P2.26 |
| P1.8 | B8 | `src/app/settings/SettingsPageClient.tsx` + `SettingsPageClient.spec.tsx` (new) | default active section equals `SETTINGS_SECTIONS[0]` (red) | Depends on P1.2 |
| P1.9 | B9 | `src/hooks/useSendRequest.ts`, `useSendRequest.spec.ts`, `src/components/history/HistoryItem.tsx` (+spec), `src/stores/useHistoryStore.ts` if the entry shape needs an error field | network error, timeout, non-2xx each call `addEntry`; reopened tab type equals recorded type; GraphQL "no history" test kept and renamed as intentional | Depends on P1.4. Locate real history component paths by grep before starting |
| P1.10 | B10 (D7) + U-ENV-15 | `src/lib/envNameValidation.ts` (+spec), `EnvListPanel.tsx`, `EnvManagerDialog.tsx`, `SidebarMainTab.tsx` | create/rename to an equal name (trim, case-insens.) shows inline error, no save; rename to own name OK; legacy duplicates hydrate and are selectable by id | Over 5 files: execute as two tasks (a: helper + store-level + `EnvListPanel`; b: `EnvManagerDialog` + `SidebarMainTab`). Only the inline error and nothing else is new UI |

### Checkpoint 1
- [ ] `bun run test` green; `bun run lint:check` green; `bun run typecheck` green
- [ ] Bug Log has an entry for each of B1-B10 (fixed with red->green evidence, or not reproducible and dropped)
- [ ] No test deleted or weakened; no commits made
- [ ] Human review before Phase 2
- Note: Phase 1 verifies bugs with unit/component regression tests only. The seeded QA e2e spec for UI-visible fixes (planner.md rule) is deferred to P3.6, a user-approved deviation.

## 5. Phase 2: Unit tests (High + Medium)

Executed via `agent-skills:test-engineer` + `write-component-tests` (+ `writing-unit-tests` for pure lib/store), per section 2.4. Every slice: acceptance = each listed ID has a spec asserting behavior (not render-only), rewrites of the listed weak tests done, `bun run test <files>` and `bun run lint:check` green, one mutation sanity check per slice. Where the SPEC calls a behavior bug-shaped but unconfirmed (U-ENV-05 value rule, U-CHN-01 concurrency guard, U-REQ-01 case-sensitive Content-Type, U-REQ-05 infinite loop), the test-engineer reports the finding; a tiny fix is allowed only where SPEC says "fix" (U-ENV-05, U-CHN-01 guard, U-REQ-01 if reproduced), otherwise characterization only.

| Slice | Items | Files (spec files created/extended; targets in parentheses) | Depends on | Weak-test rewrites |
|---|---|---|---|---|
| P2.1 | U-ENV-01, 02, 09 | `EnvVariableTable.spec.tsx` | P1.10 | ENV weak test: assert masked before toggle |
| P2.2 | U-ENV-03, 07, 08, 10 | `EnvListPanel.spec.tsx`, `EnvManagerDialog.spec.tsx`, `SidebarMainTab.spec.tsx` | P1.10 | `SidebarMainTab.spec` presence-only test |
| P2.3 | U-ENV-04, 05, 06, 13, 14 | `resolveRequest.spec.ts`, `useEnvironmentsStore.spec.ts`, `dotenvImport.spec.ts` (rename from `.test.ts` since touched), `UrlBar.spec.tsx`, `variableResolver.spec.ts` | P1.4 | |
| P2.4 | U-ENV-12 (+ptr U-SET-07) | `GlobalSection.spec.tsx` | none | |
| P2.5 | U-COL-01, 08 | `useCollectionsStore.spec.ts`, `useFolderExpandStore.spec.ts` (new) | none | |
| P2.6 | U-COL-02, 03, 04 | `importScanner.spec.ts`, `postmanParser.spec.ts` (new), `postmanExporter.spec.ts` (new) | none | importScanner tests unmocked |
| P2.7 | U-COL-05, 13 (+ptr U-SET-13) | `SidebarSearch.spec.tsx` (new), `LeftPanel.spec.tsx` | none | `LeftPanel.spec` cross-resource test name + real result assertions |
| P2.8 | U-COL-06, 07, 11, U-ENV-11 (+ptr U-SET-12) | `CreateNewDropdown.spec.tsx`, `CollectionRequestTree.spec.tsx`, `RequestItem.spec.tsx` | P2.2 | |
| P2.9 | U-COL-09, 10, 12 | `SidebarMainTab.spec.tsx` (extend), `HealthDot.spec.tsx`/`HealthPopover.spec.tsx`, `ImportDialog.spec.tsx`, `app/import/page.spec.tsx` | P2.2 | `HealthDot.spec` rewrite |
| P2.10 | U-CHN-01, 03, 09 | `scheduler.spec.ts`, `schedulerQueue.spec.ts`, `schedulerLanes.spec.ts` (new), `useHydrateChainPreferences.spec.ts` (new), `chainRunnerAbort.spec.ts` | none | |
| P2.11 | U-CHN-02, U-SET-03, U-SET-14 | `GeneralSection.tsx` (D6 draft state + blur revert, only if absent: failing test first), `GeneralSection.spec.tsx` (expand beyond single test), `useUIStore.spec.ts` | P1.2 (B2), P1.8 | `GeneralSection.spec` (no Restart Tour assertion) |
| P2.12 | U-CHN-04, 05, 06 | `useChainCycle.spec.ts`, `ArrowConfigPanelBody.spec.tsx` (+ preview list), `chainNodeBuilders.spec.ts`/`blockNodeFactory.spec.ts`/`ChainCanvasPanels.spec.tsx` | none | split in two tasks if over 5 files |
| P2.13 | U-CHN-07, 08 | `NestedSteps.spec.tsx`, `StepWarnings.spec.tsx`, `RunCardMenu.spec.tsx`, `useNodeToolbarActions.spec.ts`, `StartInputRow.spec.tsx`/`AliasCollisionWarning.spec.tsx` | none | split in two tasks |
| P2.14 | U-REQ-01, 02, 05 | `requestRunner.spec.ts`, `scriptRunner.spec.ts` | none | `scriptRunner.spec` "isolates env helpers" renamed |
| P2.15 | U-REQ-03, 04 | `src/app/api/proxy/route.spec.ts`, `useSendRequest.spec.ts` | P1.3, P1.4, P1.9 | `route.spec` (body/timeout), `useSendRequest.spec` exact payload; D8 characterization tests |
| P2.16 | U-REQ-06, 07 | `src/lib/utils.spec.ts` | none | |
| P2.17 | U-REQ-12, 13 | `codeGenerators.spec.ts`, `curlParser.spec.ts` | none | pattern-grep tests -> exact snippets |
| P2.18 | U-REQ-08, 09, 10, 16, 17 | `ParamsEditor.spec.tsx`, `AdvancedTab.spec.tsx`, `RequestBreadcrumb.spec.tsx`, `HeadersEditor.spec.tsx`, `AuthEditor.spec.tsx` | none | `HeadersEditor.spec` (AI-only) |
| P2.19 | U-REQ-11, 14, 18 (+ptr U-SET-01) | `CodeGenPanel.spec.tsx`, `CodeGenDialog.spec.tsx`, `UrlBar.spec.tsx` (extend), `SaveRequestModal.spec.tsx` | P2.3 | |
| P2.20 | U-TAB-01, 02, 03, 07, 08 | `TabListDropdown.spec.tsx` (extend B5), `TabBar.spec.tsx` | P1.5 | |
| P2.21 | U-TAB-04, 05, 06, 09 (+ptr U-RT-13) | `MainLayout.spec.tsx`, `Tab.spec.tsx` (new), `TabContextMenu.spec.tsx`, `RequestItem.spec.tsx` (extend) | P2.8 | |
| P2.22 | U-TAB-10, U-REQ-15 | `useKeyboardShortcuts.spec.ts` | none | |
| P2.23 | U-SET-04, 08, 10, 11 (+ptr U-RT-10) | `SettingsPageClient.spec.tsx` (extend), `ProxySection.spec.tsx`, `ClearHistoryDialog.spec.tsx`, `SettingsNav.spec.tsx` | P1.8 | |
| P2.24 | U-SET-06, 09, 15 | `JsonVisualizePage.spec.tsx`, `AppearanceSection.spec.tsx` (+ `useThemeAccent`), `DiffTree.spec.tsx` | none | |
| P2.25 | U-RT-01, 02, 06 | `graphqlIntrospection.spec.ts`, `GraphQLTabs.spec.tsx`, `GraphQLSchemaExplorer.spec.tsx` | none | |
| P2.26 | U-RT-03, 05, 08, 09 | `useConnectionStore.spec.ts` (extend), `ConnectButton.spec.tsx` (new), `MessageLog.spec.tsx`, `WebSocketTabs.spec.tsx`, `SocketIOTabs.spec.tsx` (new) | P1.6, P1.7 | `useConnectionStore.spec` connect_error; `WebSocketTabs.spec` headers test renamed (render-only, D2) |
| P2.27 | U-RT-04, 07, 11, 12 | `useSendRequest.spec.ts` (GraphQL block), `historyExport.spec.ts`, `HistoryList.spec.tsx`, `HistoryItem.spec.tsx` | P1.9, P2.15 | |

### Checkpoint 2
- [ ] `bun run test` green; `bun run lint:check` green; `bun run typecheck` green
- [ ] Every U-* ID in the traceability table has a spec; pointers confirmed present in their owner's spec
- [ ] All SPEC 6.8 weak tests rewritten; no `it.skip`/`it.only`; no tests under `src/components/reactbits/`
- [ ] Human review before Phase 3

## 6. Phase 3: E2E

### 6a. Parity fix, then infra (mock server first)

| Slice | Content | Files | Verify |
|---|---|---|---|
| P3.1 | Fix `e2e/scenarios/chain/check-parity.sh` silent `exit 1` (moved here from Phase 4 by user decision so every Phase 3 gate can run it): reproduce first (suspected `set -euo pipefail` with `grep` no-match inside `list_titles` and `playwright --list` failure); capture stdout/stderr/exit code, print `FAILED: <step>` plus output, `\|\| true` only where empty is valid then validate non-empty explicitly. Also run `check-ids.sh` | `e2e/scenarios/chain/check-parity.sh` (and `check-ids.sh` only if it needs the same fix) | success path 285/285; forced failures (bad `PLAYWRIGHT_TEST_BASE_URL`, `PATH` without bunx) print a reason |
| P3.2 | `bun add -d socket.io ws @types/ws`; mock server HTTP core: `/__health`, `/echo` (json/urlencoded/multipart), `?status`, `?delay`, `/redirect`, `/slow`, set-cookie, `/large`, binary, request log + `/__reset` with `x-test-id` namespacing | `package.json`, `bun.lock`, `e2e/support/mock-server/index.ts`, `httpRoutes.ts`, `requestLog.ts` | `bun e2e/support/mock-server/index.ts` starts; ad-hoc check with a `bun` script (no curl) via `ctx_execute` |
| P3.3 | WebSocket echo `/ws` with connect/close events in log; Socket.IO (`message` echo, custom event echo, forced `connect_error` via `?fail=1`); GraphQL `/graphql` (introspection, header echo, `errors[]`, 400 variant) | `wsServer.ts`, `socketIoServer.ts`, `graphqlRoutes.ts`, `index.ts` | each protocol answered; Socket.IO polling URL on :3333 works (compat with `socketio.spec.ts`) |
| P3.4 | HTTPS listener :3334 with startup self-signed cert (`tlsCert.ts`), `mockBaseUrl.ts`, `playwright.config.ts` webServer swap (+ mock entry present even when `PLAYWRIGHT_TEST_BASE_URL` is set), smoke spec `e2e/mock-server.spec.ts` covering every capability, short note in `e2e/fixtures/README.md` | `tlsCert.ts`, `mockBaseUrl.ts`, `playwright.config.ts`, `e2e/mock-server.spec.ts`, `e2e/fixtures/README.md` | `bunx playwright test e2e/mock-server.spec.ts` green from cold (no server running); `bunx playwright test e2e/socketio.spec.ts` still green |
| P3.5 | `/e2e setup`-equivalent: only `e2e/README.md` (run command, base URL, mock server and ports, isolation via `x-test-id`, 2 workers, selector policy, no `waitForTimeout`, layout note: specs in `e2e/`, not `e2e/tests/`) | `e2e/README.md` | file exists; `/e2e scenarios` precondition satisfied |

### Checkpoint 3a
- [ ] `bun run test:e2e` brings the mock server up cold with no manual step
- [ ] Existing e2e suite still green (no regression from the config change; chain `page.route` tests unaffected)
- [ ] `bun run lint:check` green
- [ ] Human review before scenario work

### 6a-2. Seeded QA regression spec (after the infra gate)

| Slice | Content | Files | Verify |
|---|---|---|---|
| P3.6 | Seeded QA spec `e2e/qa/bugfix-regressions.spec.ts` (copy of `_template.spec.ts`, `@qa`, each test ends with `snap()`) covering the UI-visible fixes B1, B2, B5, B6, B8, B10; B3/B4/B7/B9 stay unit-only. User-approved deviation from the planner.md rule that UI-visible fixes get seeded QA evidence in their own phase: Phase 1 is unit/component only, e2e evidence is deferred here, where the mock server is available | `e2e/qa/bugfix-regressions.spec.ts` (new), optional `e2e/fixtures/seed/bugfix-regressions.json` | `bunx playwright test e2e/qa/bugfix-regressions.spec.ts --repeat-each=2` |

### 6b. Scenario slices (`/e2e scenarios <area>`; all done and reviewed BEFORE any `write`)

Each slice runs `/e2e scenarios <area>` with the repo-layout override and the SPEC's E-* rows as the candidate list; the command's user checkpoint (confirm/trim feature list) is preserved; review batches by `general-purpose` reviewers. Each slice also owns the doc drift fixes from SPEC section 9 for its files. Output: updated `.feature.md` with `@critical/@high/@medium` tags and `# evidence:` comments; each scenario title carries its E-* ID.

| Slice | Area | Scenario files touched | E-IDs covered | Section 9 doc items owned |
|---|---|---|---|---|
| P3.7 SC1 | environments | `environments.feature.md` | E-ENV-01..12 | environments drift (Add Environment inline rename; header scenario; E-ENV-02..11) |
| P3.8 SC2 | collections + import | `collections.feature.md`, `import.feature.md` | E-COL-01..09 | import.feature.md (4 documented -> implemented), collections 1:1 check |
| P3.9 SC3 | chain | `chain.feature.md` (not `chain/` dir; see 2.5) | E-CHN-01..07, E-SET-06 (ptr) | |
| P3.10 SC4 | requests / body / response / auth | `requests.feature.md`, `body.feature.md`, `response.feature.md`, `auth.feature.md` | E-REQ-01..15 | requests.feature.md (add 6 undocumented script scenarios), body.feature.md (form-data disable), response/auth 1:1 check |
| P3.11 SC5 | tabs | `tabs.feature.md` | E-TAB-01..12 | tabs drift (dropdown, bulk dialog, rename/duplicate/label, drag, shortcuts, reload; "Close a dirty tab" has Cancel/Close only) |
| P3.12 SC6 | settings | `settings.feature.md` | E-SET-01..05, 07..11 | settings drift (shortcut groups 5 not 3; General default section; Global; Language; Clear History; concurrency; code-gen; no Restart Tour; SSL on/off). Depends on P1.2 |
| P3.13 SC7 | realtime | `history.feature.md`, `graphql.feature.md`, `websocket.feature.md`, `socketio.feature.md` | E-RT-01..11 | history drift (hover trash button; relative time; failed-request recording), graphql (custom headers, errors, schema explorer), ws/sio 1:1 check |

Checkpoint SC (mandatory pause): print the scenario summary tables; user reviews all seven areas before `write` begins. Also confirm the "ID in title" convention: each `test()` title will start with the E-* ID so `bunx playwright test --list` can prove parity (extend `check-parity.sh` only if trivial, P4.2).

### 6c. Write slices (`/e2e write <scenario-file>`, one file, sequential, `e2e-engineer` agent)

Prompt override each time: spec path is `e2e/<area>.spec.ts`; use `bunx playwright`; use mock server (`MOCK_BASE_URL`), `x-test-id` isolation; no `waitForTimeout`; testid/role locators; report app bugs instead of weakening tests. After each slice: `bunx playwright test e2e/<file>.spec.ts --repeat-each=3` green, then the slice is closed (do not start the next until it is). `--repeat-each=3` is per slice only; keep workers at 2.

| Slice | Scenario file -> spec | E-IDs | Depends on | Notes |
|---|---|---|---|---|
| P3.14 W1 | `import.feature.md` -> `e2e/import.spec.ts` (new) | E-COL-01, 02, 06 | SC done, P3.4 | fixtures for Postman/Insomnia/OpenAPI/curl files under `e2e/fixtures/` |
| P3.15 W2 | `collections.feature.md` -> `collections.spec.ts` | E-COL-03, 04, 05, 07, 08, 09 | W1 | introduces sidebar-search helper reused by W8; replaces unscoped locators opportunistically only where rewritten |
| P3.16 W3 | `environments.feature.md` -> `environments.spec.ts` | E-ENV-01..06, 08..12 | P1.10 | E-ENV-12 maintenance: replace duplicate-name / `env-list-item-<name>` reliance with unique names or id testids; 12 tests: if the engineer's run exceeds one session, split by the file's scenario groups but keep single-file ordering |
| P3.17 W4 | `requests.feature.md` -> `requests.spec.ts` | E-REQ-01..09, 11..14 | P3.4 | largest file; includes rewrites of weak "Disable ..." and "Cancel an in-flight request" tests; E-REQ-09 redirects replace the live-service redirects test; E-REQ-13 share-link in new context |
| P3.18 W5 | `body.feature.md` -> `body.spec.ts` | E-REQ-10 | W4 | |
| P3.19 W6 | `response.feature.md` -> `response.spec.ts` | E-REQ-15 | W4 | uses `/large?bytes=` |
| P3.20 W7 | `tabs.feature.md` -> `tabs.spec.ts` | E-TAB-01..12 | P1.5 | switch class selectors to `tab-dirty-indicator` testid when touched |
| P3.21 W8 | `chain.feature.md` -> `chain.spec.ts` | E-CHN-01..07 (+ptr E-SET-06) | W2, P3.4 | E-CHN-02/04 use real proxy + mock `delay` + server timestamps; E-CHN-05 via init script migration failure; do not edit `e2e/qa/` parity-checked specs |
| P3.22 W9 | `settings.feature.md` -> `settings.spec.ts` | E-SET-01..05, 07..11 | P1.1, P1.2, P1.3, W4, P3.4 | replaces SSL toggle test with E-SET-11 against `https://127.0.0.1:3334`; loosens brittle shortcut group assert; redirects test moved (E-REQ-09 owns) |
| P3.23 W10 | `history.feature.md` -> `history.spec.ts` | E-RT-01, 08, 09 | P1.9 | asserts GraphQL NOT recorded |
| P3.24 W11 | `graphql.feature.md` -> `graphql.spec.ts` | E-RT-05, 06, 07 | P3.3 | local `/graphql` |
| P3.25 W12 | `websocket.feature.md` -> `websocket.spec.ts` | E-RT-03, 04a, 10 | P1.7, P3.3 | server-side close observed via `/__requests` |
| P3.26 W13 | `socketio.feature.md` -> `socketio.spec.ts` | E-RT-02, 04b, 11 | P1.6, P1.7, P3.3 | existing tests use `SOCKETIO_TEST_URL` and stay |

### P3.27 Checkpoint 3 (slice)
- [ ] `bun run test:e2e` green (full run, workers 2); then once with `--repeat-each=2` to flush flakiness; any flaky test fixed, not retried-away
- [ ] `grep -rn "waitForTimeout" ` finds none in new/changed tests; no new test references dummyjson/httpbin/echo.websocket.org/trevorblades
- [ ] `bun run lint:check` and `bun run typecheck` green
- [ ] Both parity scripts pass: `bash e2e/scenarios/chain/check-ids.sh` and `check-parity.sh`; seeded QA specs (`bun run test:qa`, incl. P3.6) green
- [ ] Human review before Phase 4

## 7. Phase 4: Cleanup

| Slice | Content | Files | Verify |
|---|---|---|---|
| P4.1 | Re-verify only: the `check-parity.sh` fix was made in P3.1; re-run both parity scripts and the two forced-failure probes (bad `PLAYWRIGHT_TEST_BASE_URL`, `PATH` without bunx) against the final state | none (fix only if a regression is found) | success path 285/285 or higher; forced failures still print a reason |
| P4.2 | Docs lint: every E-* scenario in a `.feature.md` maps to exactly one test title and vice versa (manual check script run via `ctx_execute` over `bunx playwright test --list` and `grep '^## Scenario'`); extend `check-parity.sh` only if trivial; verify the section 9 items owned by SC slices all landed | read-only checks; edits only to `.feature.md` if drift is found | zero unmatched IDs both directions |
| P4.3 | Bug Log (B1-B10 status) and PR description draft written to the scratchpad / emitted in final message; no new repo doc | none (PR text only) | all 10 bugs have status |
| P4.4 | Final re-audit: re-run the seven area checks against the final state, produce the "still uncovered" list split into "Low follow-up" and "new" (in PR description, not repo, unless asked); final gates | none | see checkpoint |

### Checkpoint 4 (final)
- [ ] `bun run test` green; `bun run test:e2e` green; `bun run lint:check` green; `bun run typecheck` green
- [ ] `bash e2e/scenarios/chain/check-ids.sh` and `check-parity.sh` pass (285/285 or higher, with reason printing verified)
- [ ] Success criteria 1-6 of SPEC section 1 all hold
- [ ] Human approval, then (only if told) commit and open the single PR from `feature/ai-agent`

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Flaky realtime (WS/Socket.IO timing, forced errors) | High | Web-first assertions, wait on server log via `/__requests` polling with `expect.poll`, no sleeps; `--repeat-each=3` per write slice; server emits deterministic events |
| Port collision on 3333/3334/3000 | Med | `reuseExistingServer: !CI`, env overrides `MOCK_PORT`/`MOCK_HTTPS_PORT`, mock server fails fast with a clear message if the port is held by something else, `/__health` identity check |
| Self-signed cert generation (openssl missing, Bun TLS quirks) | Med | Fail-fast message; fallback to Node runtime for the mock server (`node --experimental-strip-types` or `bunx tsx`) if `socket.io`/TLS misbehave under Bun; adding `selfsigned` requires explicit approval |
| Bun runtime incompatibility with `socket.io`/`ws` | Med | Smoke spec in P3.4 is the gate; fallback to Node runtime as above |
| Next.js proxy (:3000) cannot reach `127.0.0.1:3334` or strips TLS errors differently | Med | P1.3 unit test asserts the agent option; E-SET-11 proves it end to end; adjust only `sslVerify` handling (SPEC section 12) |
| Parallel workers share the mock server | Med | `x-test-id` namespacing; never global `__reset` in tests; E-CHN-02 overlap measured per namespace |
| Bug not reproducible (e.g. B4(b) auth already resolved, B5/B8) | Low | Document "not reproducible, dropped" in the Bug Log; no speculative code change; dependent unit/e2e items assert current correct behavior |
| Bug fix larger than expected (B1 server-side locale, B9 entry shape) | Med | Stop and ask via AskUserQuestion if more than ~5 files or a data-model change is needed |
| Shared spec files edited by several slices cause conflicts | Med | Strictly sequential slices; each slice rereads the file first; extend, never recreate |
| `/e2e` command defaults (`e2e/tests/`, `npx`, parallel `all`) override repo layout | Med | Explicit layout override in every invocation prompt; never run `/e2e all` or `/e2e setup` in default mode |
| Scenario IDs diverge from test titles | Med | ID-first titles; P4.2 two-way check |
| Environment e2e relied on duplicate names (pre-B10) | Med | P1.10 before W3; E-ENV-12 in W3 |
| Live-service e2e tests flaky/not migrated | Low | Left as is by SPEC; excluded from new-test acceptance; only rewritten ones move to the mock server |
| Chain `qa/` parity broken by new chain scenarios | Low | New E-CHN go to `chain.feature.md`/`chain.spec.ts`; P3.1 fixes the parity script first; Checkpoint 3 and P4.1 run it |
| tsc findings only at phase end | Low | Per user preference typecheck only at checkpoints; fix before leaving the phase |

## 9. Verification strategy

- Per slice: affected specs only (`bun run test <paths>` or `bunx playwright test <file>`), plus `bun run lint:check`.
- Bug slices: red-before-green evidence and a revert-the-fix mutation check; for rewritten weak tests, a mutation proving the new assertion can fail.
- Phase checkpoints: full `bun run test` (Phases 1-2), full `bun run test:e2e` (Phases 3-4), `bun run typecheck`, and the parity scripts at Phase 3/4.
- E2E hygiene gates: no `waitForTimeout`, no external hosts, testid/role locators, `--repeat-each=3` on each written file.
- No commit, no server start, no `npm`.

## 10. Open questions (for the human at plan approval)
Items 1-3 were resolved by the confirmed decisions (webServer swap, openssl CLI, chain.feature.md/chain.spec.ts) and are kept only as a record; no pending questions.
1. (resolved) Approve the `playwright.config.ts` webServer change and making the mock entry independent of `PLAYWRIGHT_TEST_BASE_URL` (SPEC section 12 "ask first").
2. (resolved) Approve `openssl` (system CLI) for cert generation; otherwise approve adding the `selfsigned` devDependency.
3. (resolved) Confirm E-CHN-* live in `chain.feature.md` / `chain.spec.ts` rather than `chain/` + `qa/` (keeps parity script counts stable).

## 11. Traceability table

Every ID appears in exactly one row. "ptr" = pointer item, built by the owner slice.

### Bugs
| Slice | IDs |
|---|---|
| P1.1 | B1, U-SET-02 |
| P1.2 | B2 |
| P1.3 | B3 |
| P1.4 | B4 |
| P1.5 | B5 |
| P1.6 | B6 |
| P1.7 | B7 |
| P1.8 | B8 |
| P1.9 | B9 |
| P1.10 | B10, U-ENV-15 |

### Unit
| Slice | IDs |
|---|---|
| P2.1 | U-ENV-01, U-ENV-02, U-ENV-09 |
| P2.2 | U-ENV-03, U-ENV-07, U-ENV-08, U-ENV-10 |
| P2.3 | U-ENV-04, U-ENV-05, U-ENV-06, U-ENV-13, U-ENV-14 |
| P2.4 | U-ENV-12, U-SET-07 (ptr) |
| P2.5 | U-COL-01, U-COL-08 |
| P2.6 | U-COL-02, U-COL-03, U-COL-04 |
| P2.7 | U-COL-05, U-COL-13, U-SET-13 (ptr) |
| P2.8 | U-COL-06, U-COL-07, U-COL-11, U-ENV-11, U-SET-12 (ptr) |
| P2.9 | U-COL-09, U-COL-10, U-COL-12 |
| P2.10 | U-CHN-01, U-CHN-03, U-CHN-09 |
| P2.11 | U-CHN-02, U-SET-03, U-SET-14 |
| P2.12 | U-CHN-04, U-CHN-05, U-CHN-06 |
| P2.13 | U-CHN-07, U-CHN-08 |
| P2.14 | U-REQ-01, U-REQ-02, U-REQ-05 |
| P2.15 | U-REQ-03, U-REQ-04 |
| P2.16 | U-REQ-06, U-REQ-07 |
| P2.17 | U-REQ-12, U-REQ-13 |
| P2.18 | U-REQ-08, U-REQ-09, U-REQ-10, U-REQ-16, U-REQ-17 |
| P2.19 | U-REQ-11, U-REQ-14, U-REQ-18, U-SET-01 (ptr) |
| P2.20 | U-TAB-01, U-TAB-02, U-TAB-03, U-TAB-07, U-TAB-08 |
| P2.21 | U-TAB-04, U-TAB-05, U-TAB-06, U-TAB-09, U-RT-13 (ptr) |
| P2.22 | U-TAB-10, U-REQ-15 |
| P2.23 | U-SET-04, U-SET-08, U-SET-10, U-SET-11, U-RT-10 (ptr) |
| P2.24 | U-SET-06, U-SET-09, U-SET-15 |
| P2.25 | U-RT-01, U-RT-02, U-RT-06 |
| P2.26 | U-RT-03, U-RT-05, U-RT-08, U-RT-09 |
| P2.27 | U-RT-04, U-RT-07, U-RT-11, U-RT-12 |

### E2E infra, scenarios, writes
| Slice | IDs |
|---|---|
| P3.1 | check-parity.sh fix (SPEC section 9; moved from Phase 4) |
| P3.2-P3.5 | infra (SPEC section 8; no E-* IDs) |
| P3.6 | seeded QA regression spec for B1, B2, B5, B6, B8, B10 (verification slice, no new ID) |
| P3.7-P3.13 | scenario-file authoring for the E-* rows of their areas (see 6b); the E-* IDs themselves are owned by the write slices below, each ID exactly once |
| P3.14 (W1) | E-COL-01, E-COL-02, E-COL-06 |
| P3.15 (W2) | E-COL-03, E-COL-04, E-COL-05, E-COL-07, E-COL-08, E-COL-09 |
| P3.16 (W3) | E-ENV-01, E-ENV-02, E-ENV-03, E-ENV-04, E-ENV-05, E-ENV-06, E-ENV-07, E-ENV-08, E-ENV-09, E-ENV-10, E-ENV-11, E-ENV-12 |
| P3.17 (W4) | E-REQ-01, E-REQ-02, E-REQ-03, E-REQ-04, E-REQ-05, E-REQ-06, E-REQ-07, E-REQ-08, E-REQ-09, E-REQ-11, E-REQ-12, E-REQ-13, E-REQ-14 |
| P3.18 (W5) | E-REQ-10 |
| P3.19 (W6) | E-REQ-15 |
| P3.20 (W7) | E-TAB-01, E-TAB-02, E-TAB-03, E-TAB-04, E-TAB-05, E-TAB-06, E-TAB-07, E-TAB-08, E-TAB-09, E-TAB-10, E-TAB-11, E-TAB-12 |
| P3.21 (W8) | E-CHN-01, E-CHN-02, E-CHN-03, E-CHN-04, E-CHN-05, E-CHN-06, E-CHN-07, E-SET-06 (ptr) |
| P3.22 (W9) | E-SET-01, E-SET-02, E-SET-03, E-SET-04, E-SET-05, E-SET-07, E-SET-08, E-SET-09, E-SET-10, E-SET-11 |
| P3.23 (W10) | E-RT-01, E-RT-08, E-RT-09 |
| P3.24 (W11) | E-RT-05, E-RT-06, E-RT-07 |
| P3.25 (W12) | E-RT-03, E-RT-04a (ws half of E-RT-04), E-RT-10 |
| P3.26 (W13) | E-RT-02, E-RT-04b (Socket.IO half of E-RT-04), E-RT-11 |
| P3.27 | checkpoint (no IDs) |

### Phase 4 cleanup items (SPEC section 9)
| Slice | Items |
|---|---|
| P3.7 (SC1) | `environments.feature.md` drift |
| P3.8 (SC2) | `import.feature.md`, `collections.feature.md` |
| P3.10 (SC4) | `requests.feature.md` (6 script scenarios), `body.feature.md`, `response.feature.md`, `auth.feature.md` |
| P3.11 (SC5) | `tabs.feature.md` |
| P3.12 (SC6) | `settings.feature.md` |
| P3.13 (SC7) | `history.feature.md`, `graphql.feature.md`, `websocket.feature.md`, `socketio.feature.md` |
| P3.1 (fix), P4.1 (re-verify only) | `check-parity.sh` silent exit 1 (+ `check-ids.sh` run) |
| P4.2 | E2E docs lint (E-* in `.feature.md` and vice versa) |
| P4.3 | Bug Log in PR description |
| P4.4 | Final re-audit and PR-ready summary |
