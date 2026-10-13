# TASKS: Close the Test-Coverage Gap Report (Requestr)

Source: `agent_docs/test-coverage-gaps/SPEC.md` (confirmed), `agent_docs/test-coverage-gaps/PLAN.md` (confirmed), audit reports in `agent_docs/test-coverage-gaps/audit/`. Branch `feature/ai-agent`, one PR at the end.

Legend: ☐ todo (the implementation loop flips to ✅). Kind = implementation | e2e | gate | walkthrough | dod. Task IDs are `T<phase>.<n>`; the `PLAN` field gives the PLAN.md slice it came from (tasks were split or renumbered where a slice exceeded 5 files).

## Global rules

- `bun` only; never `npm`/`npx` (use `bunx playwright`). Never run the app server (it is always running). Never commit unless the maintainer says so; no Claude/Anthropic text in commit messages.
- Typecheck (`bun run typecheck`) runs ONLY at phase gates, never mid-phase. Lint: `bun run lint:check` (autofix `bun run lint:write`).
- Never delete or weaken a failing test to go green; rewrite it to assert the correct behavior and note why. No `it.skip`/`it.only`. No tests under `src/components/reactbits/`.
- Phase 1 protocol per bug: failing test first, confirm red for the stated reason, minimal fix, green, mutation sanity check. Unreproducible bug: no code change, record `not reproducible, dropped` in the Bug Log (kept outside the repo).
- Phase 2: every task is executed through the `agent-skills:test-engineer` agent with the `write-component-tests` skill (plus `writing-unit-tests` for pure lib/store).
- Phase 3: `/e2e setup` is never run in default mode (it would move specs to `e2e/tests/`). Repo layout is kept: `testDir` `./e2e`, specs `e2e/<area>.spec.ts`, scenarios `e2e/scenarios/<area>.feature.md`. All scenario files are written and reviewed before any `/e2e write`; writes run one file at a time, sequentially, via the `e2e-engineer` agent. `agent-browser` is never used as evidence.
- Mock-server shared by 2 workers: isolate with `x-test-id`; never call a global `__reset` from a test.

## Confirmed decisions (no open questions remain)

- D1-D8 from SPEC section 4 (B9 failed-request history; B7 disconnect-only; B2 remove Restart Tour; socket.io/ws/@types/ws devDeps; self-signed HTTPS e2e; concurrency input rules; env name uniqueness; characterization-only Set-Cookie and GET-with-body).
- Post-PLAN user decisions: (1) `playwright.config.ts` webServer is changed to start the local mock server (:3333, HTTPS :3334), replacing the missing `scripts/run-socketio-echo.sh`; (2) the self-signed cert is generated at server startup with the `openssl` CLI (no new dependency); (3) new chain e2e scenarios go in `e2e/scenarios/chain.feature.md` and `e2e/chain.spec.ts` (not `e2e/scenarios/chain/`), leaving the 285-ID parity untouched.

Command reference: unit `bun run test [path]`; lint `bun run lint:check`; typecheck `bun run typecheck`; e2e `bun run test:e2e` / `bunx playwright test e2e/<file>.spec.ts`; seeded QA `bun run test:qa`; titles `bunx playwright test --list`; chain parity `bash e2e/scenarios/chain/check-ids.sh`, `bash e2e/scenarios/chain/check-parity.sh`.


## Phase 1: Fix bugs B1-B10 (failing test first)

### ✅ T1.1: B1 Language switching drives loaded messages and html lang (+U-SET-02)
- **Kind**: implementation  |  **PLAN**: P1.1
- **Files**: `src/i18n/request.ts`; `src/i18n/request.spec.ts (new)`; `src/components/settings/LanguageSection.tsx`; `src/components/layout/HtmlLangSetter.tsx`; `src/components/settings/LanguageSection.spec.tsx (new)`
- **Depends on**: none
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: locale fr/ja resolves the fr/ja bundle from `src/i18n/messages.ts`; selecting a language in `LanguageSection` changes `document.documentElement.lang` and a rendered string; choice persists across reload (storage/cookie round-trip).
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: `src/i18n/request.ts` hard-codes `"en"`. Make the selected locale drive loaded messages and `<html lang>` (`HtmlLangSetter`). If server-side `request.ts` cannot read a client choice, persist via a cookie read in `request.ts`. If the fix needs >5 files or a data-model change, stop and ask via AskUserQuestion.
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - B1: selected fr/ja locale loads the fr/ja message bundle and sets `<html lang>`; persists after reload
  - U-SET-02: LanguageSection selection sets locale and `document.documentElement.lang`
  - `messages.parity.spec.ts` stays green; test failed before the fix (evidence in Bug Log)
- **Verify**:
  - `bun run test src/i18n/request.spec.ts src/components/settings/LanguageSection.spec.tsx src/i18n/messages.parity.spec.ts`
  - `bun run lint:check`

### ✅ T1.2: B2 Remove the Restart Tour button from Settings > General
- **Kind**: implementation  |  **PLAN**: P1.2
- **Files**: `src/components/settings/GeneralSection.tsx`; `src/components/settings/GeneralSection.spec.tsx`; ``src/app/settings/SettingsPageClient.tsx``
- **Depends on**: none
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: `GeneralSection` does NOT render the Restart Tour button (red now). Remove any old assertion of the button from `GeneralSection.spec.tsx`.
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: Per D3 remove the button and its wiring in `GeneralSection`/`SettingsPageClient`. Do NOT touch the `MainLayout.tsx` tour-disabled comment; no other refactors.
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - B2/D3: Restart Tour button not rendered in Settings > General; tour stays disabled
  - Old Restart Tour assertions removed (rewritten, not weakened)
- **Verify**:
  - `bun run test src/components/settings/GeneralSection.spec.tsx`
  - `bun run lint:check`

### ✅ T1.3: B2 follow-up: remove only code made dead by the button removal
- **Kind**: implementation  |  **PLAN**: P1.2
- **Files**: `src/hooks/useFirstTimeUser.ts`; `src/hooks/useFirstTimeUser.spec.ts (if present)`; `src/i18n/messages.ts`; `src/app/settings/SettingsPageClient.tsx (only to drop now-unused props)`
- **Depends on**: T1.2
- **Do**:
  1. Cleanup task, no behavior change: no new test is written (T1.2's `not rendered` test is the regression guard). Evidence of 'dead' is grep: `grep -rn restartTour src` and the i18n keys it used, excluding specs.
  2. Delete `restartTour`, now-unused props and i18n keys ONLY if grep shows no other use; fr/ja keys removed in lockstep so `messages.parity.spec.ts` stays green.
  3. Re-run T1.2's spec plus `messages.parity.spec.ts` to confirm nothing still-used was removed.
  4. If nothing is dead, record `no dead code` in the scratchpad Bug Log and finish; otherwise add one Bug Log note for the removal.
- **Acceptance**:
  - No dead `restartTour` code or i18n keys remain; nothing still-used removed
  - fr/ja parity spec green
- **Verify**:
  - `bun run test src/i18n/messages.parity.spec.ts src/hooks src/components/settings`
  - `bun run lint:check`
  - `grep -rn restartTour src (expect no matches, or documented remaining use)`

### ✅ T1.4: B3 Proxy honors sslVerify
- **Kind**: implementation  |  **PLAN**: P1.3
- **Files**: `src/app/api/proxy/route.ts`; `src/app/api/proxy/route.spec.ts`
- **Depends on**: none
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: `sslVerify:false` -> upstream call made with TLS verification disabled (assert the option passed to the upstream agent/fetch); `true`/omitted -> verified.
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: Read `sslVerify` in the proxy and pass it to the upstream call. Default stays verify-on. Change nothing else in proxy behavior (SPEC section 12).
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - B3: `sslVerify:false` disables upstream TLS verification; `true`/omitted verifies (default unchanged)
  - No other proxy behavior changed
- **Verify**:
  - `bun run test src/app/api/proxy/route.spec.ts`
  - `bun run lint:check`

### ✅ T1.5: B4 Pre-request script env.set reaches {{var}}; auth vars resolved at send
- **Kind**: implementation  |  **PLAN**: P1.4
- **Files**: `src/hooks/useSendRequest.ts`; `src/hooks/useSendRequest.spec.ts`; `src/lib/resolveRequest.ts (only if needed)`
- **Depends on**: none
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: (a) pre-script `environment.set("token","x")` then `{{token}}` in URL/header/body resolves to `x`; (b) exact `runRequest` payload asserted: `tab.auth` bearer/basic/apikey with `{{token}}` reaches `runRequest` resolved.
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: Ordering: run pre-script, then resolve. Resolve auth fields at send. If (b) is already green, document it in the Bug Log and drop that half.
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - B4(a): pre-script `environment.set` values resolve in URL, header and body
  - B4(b): auth {{var}} resolved in the exact `runRequest` payload, or documented as not reproducible
- **Verify**:
  - `bun run test src/hooks/useSendRequest.spec.ts src/lib`
  - `bun run lint:check`

### ✅ T1.6: B5 TabListDropdown search resets on every close path
- **Kind**: implementation  |  **PLAN**: P1.5
- **Files**: `src/components/layout/TabListDropdown.tsx`; `src/components/layout/TabListDropdown.spec.tsx (new)`
- **Depends on**: none
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: type search, select a row, reopen -> search empty; same after Close all.
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: Single close handler used by every close path (replace the `setOpen(false)` bypass of `handleOpenChange`). This new spec is extended later by the U-TAB-01 task (extend, do not duplicate).
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - B5: search text cleared after selecting a tab and after Close all
- **Verify**:
  - `bun run test src/components/layout/TabListDropdown.spec.tsx`
  - `bun run lint:check`

### ✅ T1.7: B6 Socket.IO connect_error stays visible; Connect re-enabled
- **Kind**: implementation  |  **PLAN**: P1.6
- **Files**: `src/stores/useConnectionStore.ts`; `src/stores/useConnectionStore.spec.ts`; ``src/components/request/tabs/SocketIOTabs.tsx` (shows the error)`
- **Depends on**: none
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: rewrite the test "socket.io connect_error disconnects and clears error after disconnect handler" so it asserts the error is RETAINED (red now). Rewrite, do not delete it.
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: Error from `connect_error` stays until the next connect attempt; Connect re-enabled; UI shows the error (minimal UI, the only feature-shaped change here).
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - B6: connect_error retained after the following disconnect; Connect button enabled; error visible in the Socket.IO tab
- **Verify**:
  - `bun run test src/stores/useConnectionStore.spec.ts src/components`
  - `bun run lint:check`

### ✅ T1.8: B7 Closing a tab disconnects its socket (WebSocket and Socket.IO)
- **Kind**: implementation  |  **PLAN**: P1.7
- **Files**: `src/stores/useTabsStore.ts`; `src/stores/useTabsStore.spec.ts`; `src/stores/useConnectionStore.ts (only if an API is needed)`; `src/stores/useConnectionStore.spec.ts (only if API needed)`
- **Depends on**: T1.7
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: closing a connected ws/socketio tab calls disconnect for that tab; also closeAll, closeOthers, closeTabsForRequest.
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: Every tab-removal path disconnects that tab's socket. Handshake headers are NOT changed (D2, known browser limitation).
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - B7: every tab-removal path (close, closeAll, closeOthers, closeTabsForRequest) disconnects that tab's socket
  - Headers tab untouched
- **Verify**:
  - `bun run test src/stores/useTabsStore.spec.ts src/stores/useConnectionStore.spec.ts`
  - `bun run lint:check`

### ✅ T1.9: B8 Settings opens on SETTINGS_SECTIONS[0]
- **Kind**: implementation  |  **PLAN**: P1.8
- **Files**: ``src/app/settings/SettingsPageClient.tsx``; `src/app/settings/SettingsPageClient.spec.tsx (new)`
- **Depends on**: T1.2
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: default active section equals `SETTINGS_SECTIONS[0]` (red now: opens Appearance).
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: Derive the default section from `SETTINGS_SECTIONS[0]` (single source of truth). No URL deep-linking.
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - B8: default active section is General (first of SETTINGS_SECTIONS)
- **Verify**:
  - `bun run test src/app/settings/SettingsPageClient.spec.tsx`
  - `bun run lint:check`

### ✅ T1.10: B9 Record failed HTTP requests in history; reopen with the recorded tab type
- **Kind**: implementation  |  **PLAN**: P1.9
- **Files**: `src/hooks/useSendRequest.ts`; `src/hooks/useSendRequest.spec.ts`; `src/components/history/HistoryItem.tsx`; `src/components/history/HistoryItem.spec.tsx`; `src/stores/useHistoryStore.ts (only if the entry shape needs an error field)`
- **Depends on**: T1.5
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: network error, timeout and non-2xx each call `addEntry` with status/error info; `HistoryItem` reopened tab type equals the recorded type. Keep the "runs GraphQL request ... without history entry" test and RENAME it to state the no-history is intentional.
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: Record failed HTTP requests (D1); entries reopen with the correct tab type. GraphQL/WS/Socket.IO recording stays out of scope. If the entry shape needs a data-model change beyond an error field, stop and ask.
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - B9: network error, timeout, non-2xx recorded; reopened tab type matches recorded type
  - GraphQL stays unrecorded and the test name says so (D1)
- **Verify**:
  - `bun run test src/hooks/useSendRequest.spec.ts src/components/history src/stores/useHistoryStore.spec.ts`
  - `bun run lint:check`

### ✅ T1.11: B10 (D7) Env name uniqueness: shared validator + EnvListPanel
- **Kind**: implementation  |  **PLAN**: P1.10
- **Files**: `src/lib/envNameValidation.ts (new)`; `src/lib/envNameValidation.spec.ts (new)`; `src/components/environment/EnvListPanel.tsx`; `src/components/environment/EnvListPanel.spec.tsx`; `src/stores/useEnvironmentsStore.spec.ts (legacy-duplicate hydrate)`
- **Depends on**: none
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: validator unit: trim + case-insensitive match against OTHER environments, ignoring the env's own id; `EnvListPanel` create/rename to an equal name shows an inline error and does not save; rename to its own name OK; legacy duplicates (two "GitHub") hydrate unchanged and stay selectable by id.
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: Add `src/lib/envNameValidation.ts` (one shared helper, DRY); wire into `EnvListPanel`. Validation only on create/rename, never on hydration. The inline error is the only new UI.
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - B10 (part 1): shared helper + EnvListPanel enforce uniqueness (trimmed, case-insensitive) with inline error, no save
  - Legacy duplicates still load and are selectable by id
- **Verify**:
  - `bun run test src/lib/envNameValidation.spec.ts src/components/environment/EnvListPanel.spec.tsx src/stores/useEnvironmentsStore.spec.ts`
  - `bun run lint:check`

### ✅ T1.12: B10 Env name uniqueness: EnvManagerDialog + SidebarMainTab (+U-ENV-15)
- **Kind**: implementation  |  **PLAN**: P1.10
- **Files**: `src/components/environment/EnvManagerDialog.tsx`; `src/components/environment/EnvManagerDialog.spec.tsx`; `src/components/layout/SidebarMainTab.tsx`; `src/components/layout/SidebarMainTab.spec.tsx`
- **Depends on**: T1.11
- **Do**:
  1. Write the regression test via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) using the `write-component-tests` skill (component tests) or `writing-unit-tests` (pure lib/store); the fix itself is made by the main thread.
  2. Write the failing test FIRST: run it and confirm it fails for the stated reason (paste the failing assertion into the Bug Log), before touching production code. Failing test: `EnvManagerDialog` header commit and `SidebarMainTab` inline create/rename to a duplicate name show the inline error and do not save (red now).
  3. Unreproducible rule: if the test passes on unmodified code (bug cannot be reproduced), make NO code change; record `not reproducible, dropped` with the passing evidence in the Bug Log and mark the task done.
  4. Minimal fix: Import the shared helper from T1.11 in both entry points; no new validation logic copies.
  5. Mutation sanity check: temporarily revert the fix, confirm the new test goes red again, restore the fix, confirm green.
  6. Append the Bug Log row (bug id, red evidence, fix summary, green evidence) to the running Bug Log kept OUTSIDE the repo (a `bug-log.md` in the session scratchpad); no repo doc is created.
- **Acceptance**:
  - U-ENV-15: all three entry points (EnvListPanel, EnvManagerDialog, SidebarMainTab) show inline error and do not save for duplicate names; rename to own name OK; legacy duplicates hydrate
- **Verify**:
  - `bun run test src/components/environment src/components/layout/SidebarMainTab.spec.tsx`
  - `bun run lint:check`

### ✅ T1.13: 🔶 Checkpoint 1: Phase 1 gate
- **Kind**: gate  |  **PLAN**: Checkpoint 1
- **Files**: none (verification only)
- **Depends on**: T1.12
- **Do**:
  1. Run the full unit suite, lint, typecheck (typecheck runs ONLY here, never mid-phase). Phase 1 evidence is unit/component regression tests only; the seeded QA e2e spec for the UI-visible fixes is deferred to Phase 3 (T3.8), a user-approved deviation from the planner.md seeded-QA rule.
  2. Confirm the Bug Log has a row for each of B1-B10 (fixed with red->green evidence, or `not reproducible, dropped`).
  3. Confirm no test was deleted or weakened and no commit was made (`git status`, `git log -1`).
  4. Stop and wait for human review before Phase 2 (AskUserQuestion: proceed / fix first).
- **Acceptance**:
  - `bun run test`, lint and typecheck all green
  - Bug Log complete for B1-B10
  - Human approval recorded
- **Verify**:
  - `bun run test`
  - `bun run lint:check`
  - `bun run typecheck`


## Phase 2: Unit tests (all High + Medium gaps)

### ✅ T2.1: Env variable table (import, bulk paste, secrets)
- **Kind**: implementation  |  **PLAN**: P2.1
- **Files**: `src/components/environment/EnvVariableTable.spec.tsx`
- **Depends on**: T1.12
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-ENV-01: EnvVariableTable handleEnvFile/drop/Import: singular/plural success toast; "No variables found in file"; read failure; dropHighlight on dragover/leave; dotfile accepted
  4. U-ENV-02: EnvVariableTable handleBulkPaste: multi-line paste in key/initial/current calls bulkImportEnvVars, preventDefault, toast; single-line paste unaffected; "No KEY=VALUE lines" error
  5. U-ENV-09: EnvVariableTable: unchecking secret hides eye and resets visibility; empty-key row; secret not leaked in placeholder; assert masked state BEFORE toggling (fixes weak test)
  6. Weak-test rewrites in this task: ENV weak test: assert masked state before toggle
  7. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-ENV-01 has a spec asserting behavior (not render-only)
  - U-ENV-02 has a spec asserting behavior (not render-only)
  - U-ENV-09 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/environment/EnvVariableTable.spec.tsx`
  - `bun run lint:check`

### ✅ T2.2: Env list/manager/sidebar behaviors
- **Kind**: implementation  |  **PLAN**: P2.2
- **Files**: `src/components/environment/EnvListPanel.spec.tsx`; `src/components/environment/EnvManagerDialog.spec.tsx`; `src/components/layout/SidebarMainTab.spec.tsx`
- **Depends on**: T1.12
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-ENV-03: empty/whitespace name falls back to default name in EnvListPanel.commitName, EnvManagerDialog header commit, SidebarMainTab inline create
  4. U-ENV-07: SidebarMainTab environments: empty state, Active badge, click to activate, delete confirm/cancel, delete-active clears selection
  5. U-ENV-08: EnvListPanel: Enter commits, Escape cancels rename; delete-confirm cancel; pre-existing duplicate names keep distinct rows, selection by id
  6. U-ENV-10: EnvManagerDialog: close behavior (X, Esc); selection when active env deleted
  7. Weak-test rewrites in this task: `SidebarMainTab.spec` presence-only test "embeds collection tree and chain list"
  8. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-ENV-03 has a spec asserting behavior (not render-only)
  - U-ENV-07 has a spec asserting behavior (not render-only)
  - U-ENV-08 has a spec asserting behavior (not render-only)
  - U-ENV-10 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/environment/EnvListPanel.spec.tsx src/components/environment/EnvManagerDialog.spec.tsx src/components/layout/SidebarMainTab.spec.tsx`
  - `bun run lint:check`

### ✅ T2.3: Variable resolution, store rule, dotenv, UrlBar highlight
- **Kind**: implementation  |  **PLAN**: P2.3
- **Files**: `src/lib/resolveRequest.spec.ts`; `src/stores/useEnvironmentsStore.spec.ts`; `src/lib/dotenvImport.spec.ts (rename from .test.ts since touched)`; `src/components/request/UrlBar.spec.tsx`; `src/lib/variableResolver.spec.ts`
- **Depends on**: T1.5
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-ENV-04: {{var}} substituted in bearer, basic user/pass, apikey, JSON body, form fields, query params, path params (resolveRequest / useSendRequest; extends B4 regression)
  4. U-ENV-05: useEnvironmentsStore getVariable (||) vs buildActiveEnvVars/resolveVariables: empty currentValue and empty initialValue behave consistently; pick one rule, document it, fix the odd one out
  5. U-ENV-06: parseDotEnvContent: export KEY=v, inline comments, value containing =, CRLF, empty value, BOM
  6. U-ENV-13: UrlBar variable highlight: resolved vs unresolved token classes via tokenizeVariables
  7. U-ENV-14: variableResolver.resolveVariables: whitespace {{ a }}, nested, undefined vs empty-string (??)
  8. U-ENV-05 is bug-shaped but unconfirmed: the agent reports the finding; a tiny fix is allowed only to make empty initial/current behave consistently (pick one rule, document it in a comment).
  9. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-ENV-04 has a spec asserting behavior (not render-only)
  - U-ENV-05 has a spec asserting behavior (not render-only)
  - U-ENV-06 has a spec asserting behavior (not render-only)
  - U-ENV-13 has a spec asserting behavior (not render-only)
  - U-ENV-14 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/lib/resolveRequest.spec.ts src/stores/useEnvironmentsStore.spec.ts src/lib/dotenvImport.spec.ts src/components/request/UrlBar.spec.tsx src/lib/variableResolver.spec.ts`
  - `bun run lint:check`

### ✅ T2.4: GlobalSection settings writes (+ptr U-SET-07)
- **Kind**: implementation  |  **PLAN**: P2.4
- **Files**: `src/components/settings/GlobalSection.spec.tsx (new)`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-ENV-12: GlobalSection (new spec): base URL change and header table writes to useSettingsStore
  4. U-SET-07: (pointer) GlobalSection, built by U-ENV-12
  5. U-SET-07 is a pointer: the GlobalSection spec built for U-ENV-12 also satisfies it.
  6. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-ENV-12 has a spec asserting behavior (not render-only)
  - U-SET-07 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/settings/GlobalSection.spec.tsx`
  - `bun run lint:check`

### ✅ T2.5: Collections store folders and folder-expand store
- **Kind**: implementation  |  **PLAN**: P2.5
- **Files**: `src/stores/useCollectionsStore.spec.ts`; `src/stores/useFolderExpandStore.spec.ts (new)`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-COL-01: useCollectionsStore createFolder/renameFolder/duplicateFolder/deleteFolder: nested create; rename blank falls back; deep duplicate gets new ids, remaps parentFolderId, clones requests; delete cascades subfolders + requests + closes tabs
  4. U-COL-08: useFolderExpandStore (new spec): toggle/setExpanded/expandAll/collapseAll/toggleAll/isAllExpanded; persistence (rq_collapsed_folders); corrupt JSON and blocked storage fallback
  5. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-COL-01 has a spec asserting behavior (not render-only)
  - U-COL-08 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/stores/useCollectionsStore.spec.ts src/stores/useFolderExpandStore.spec.ts`
  - `bun run lint:check`

### ✅ T2.6: Import scanner, Postman parser/exporter
- **Kind**: implementation  |  **PLAN**: P2.6
- **Files**: `src/lib/importScanner.spec.ts`; `src/lib/postmanParser.spec.ts (new)`; `src/lib/postmanExporter.spec.ts (new)`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-COL-02: importScanner: scanFileContent detection order (Insomnia vs OpenAPI vs Postman), scanOpenApiText, scanCurlText, error messages (unmocked)
  4. U-COL-03: postmanParser (new spec): isPostmanCollection, parsePostmanCollection nested folders, auth types, bodies, variables, PostmanParseError when no requests
  5. U-COL-04: postmanExporter (new spec): exportToPostmanCollection round-trip with parser (folders, bodies, auth); downloadPostmanCollection/Request
  6. Weak-test rewrites in this task: importScanner tests are mocked: make them unmocked
  7. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-COL-02 has a spec asserting behavior (not render-only)
  - U-COL-03 has a spec asserting behavior (not render-only)
  - U-COL-04 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/lib/importScanner.spec.ts src/lib/postmanParser.spec.ts src/lib/postmanExporter.spec.ts`
  - `bun run lint:check`

### ✅ T2.7: SidebarSearch and LeftPanel (+ptr U-SET-13)
- **Kind**: implementation  |  **PLAN**: P2.7
- **Files**: `src/components/layout/SidebarSearch.spec.tsx (new)`; `src/components/layout/LeftPanel.spec.tsx`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-COL-05: SidebarSearch (new spec): name/URL/case-insensitive filtering, envs, chains, grouping, empty state; click reuses existing tab, opens env manager with id, navigates to chain; clear (X)
  4. U-COL-13: LeftPanel: "+" Import opens dialog; JSON Visualize/Compare links; Hub tab renders HubTab; fix misleading test name "shows cross-resource search results" and assert real results
  5. U-SET-13: (pointer) LeftPanel tool links /transform, /json-visualize, /json-compare, settings button, built by U-COL-13
  6. Weak-test rewrites in this task: `LeftPanel.spec` cross-resource test: fix name and assert real results
  7. U-SET-13 is a pointer: the LeftPanel tool-link assertions (hrefs /transform, /json-visualize, /json-compare, settings button) are part of U-COL-13.
  8. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-COL-05 has a spec asserting behavior (not render-only)
  - U-COL-13 has a spec asserting behavior (not render-only)
  - U-SET-13 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/layout/SidebarSearch.spec.tsx src/components/layout/LeftPanel.spec.tsx`
  - `bun run lint:check`

### ✅ T2.8: CreateNewDropdown, CollectionRequestTree, RequestItem (+ptr U-SET-12)
- **Kind**: implementation  |  **PLAN**: P2.8
- **Files**: `src/components/layout/CreateNewDropdown.spec.tsx`; `src/components/collections/CollectionRequestTree.spec.tsx`; `src/components/collections/RequestItem.spec.tsx`
- **Depends on**: T2.2
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-COL-06: CreateNewDropdown: each item calls openTab with the right TAB_TYPE, setIsCreatingCollection, setIsCreatingEnv, onNewChain, onImport
  4. U-COL-07: CollectionRequestTree: nested folder render, countDescendantRequests, folder menu (New Folder/Rename/Duplicate/Delete confirm), blank-rename fallback, auto-expand parent
  5. U-COL-11: RequestItem: Copy as cURL success and clipboard-failure toast; Export as Postman; health dot gated by showHealthMonitor and non-empty url; duplicate preserves folderId
  6. U-ENV-11: CreateNewDropdown "New Environment" triggers isCreatingEnv
  7. U-SET-12: (pointer) RequestItem health indicator, built by U-COL-11
  8. U-ENV-11 is the 'New Environment' item of CreateNewDropdown; U-SET-12 is a pointer to the RequestItem health-indicator assertions of U-COL-11.
  9. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-COL-06 has a spec asserting behavior (not render-only)
  - U-COL-07 has a spec asserting behavior (not render-only)
  - U-COL-11 has a spec asserting behavior (not render-only)
  - U-ENV-11 has a spec asserting behavior (not render-only)
  - U-SET-12 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/layout/CreateNewDropdown.spec.tsx src/components/collections/CollectionRequestTree.spec.tsx src/components/collections/RequestItem.spec.tsx`
  - `bun run lint:check`

### ✅ T2.9: SidebarMainTab sections and health indicators
- **Kind**: implementation  |  **PLAN**: P2.9
- **Files**: `src/components/layout/SidebarMainTab.spec.tsx (extend)`; `src/components/collections/HealthDot.spec.tsx`; `src/components/collections/HealthPopover.spec.tsx`
- **Depends on**: T2.2
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-COL-09: SidebarMainTab: section persistence (readStoredSections/persistSections, corrupt value, storage throw -> console.warn); expand/collapse-all button state; env delete confirm; Escape/blank in new-env input
  4. U-COL-10: HealthDot/HealthPopover: color thresholds at 94/95/79/80; hidden below min sample; popover content (rewrites weak HealthDot.spec)
  5. Weak-test rewrites in this task: `HealthDot.spec` weak test rewritten
  6. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-COL-09 has a spec asserting behavior (not render-only)
  - U-COL-10 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/layout/SidebarMainTab.spec.tsx src/components/collections/HealthDot.spec.tsx src/components/collections/HealthPopover.spec.tsx`
  - `bun run lint:check`

### ✅ T2.10: Import dialog and import page
- **Kind**: implementation  |  **PLAN**: P2.9
- **Files**: `src/components/import/ImportDialog.spec.tsx`; `src/app/import/page.spec.tsx`
- **Depends on**: T2.9
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-COL-12: ImportDialog, app/import/page: Insomnia and OpenAPI branches (toast, collection created); drag-drop; tab switch resets state; scan failure leaves store untouched; page: Insomnia/OpenAPI file
  4. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-COL-12 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/import/ImportDialog.spec.tsx src/app/import/page.spec.tsx`
  - `bun run lint:check`

### ✅ T2.11: Chain scheduler, preferences hydration, runner abort
- **Kind**: implementation  |  **PLAN**: P2.10
- **Files**: `src/lib/chainRunner/scheduler.spec.ts`; `src/lib/chainRunner/schedulerQueue.spec.ts`; `src/lib/chainRunner/schedulerLanes.spec.ts (new)`; `src/hooks/useHydrateChainPreferences.spec.ts (new)`; `src/lib/chainRunnerAbort.spec.ts`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-CHN-01: chainRunner scheduler/schedulerQueue/schedulerLanes (new specs): dispatchReady honors limit and skips recorded nodes; drain stops after abort; lane assign/reuse/release; concurrency 0/negative/NaN/non-integer passed to runChain (guard in runner; test the guard)
  4. U-CHN-03: useHydrateChainPreferences (new spec): hydrates persisted concurrency after mount
  5. U-CHN-09: chainRunnerAbort.spec (extend, currently 1 test): abort mid-flight at concurrency>1 for every executor type; abort during Loop/Subchain
  6. U-CHN-01 concurrency guard: the agent reports; a tiny runner guard (reject 0/negative/NaN/non-integer) is allowed and then tested; otherwise characterization only.
  7. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-CHN-01 has a spec asserting behavior (not render-only)
  - U-CHN-03 has a spec asserting behavior (not render-only)
  - U-CHN-09 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/lib/chainRunner/scheduler.spec.ts src/lib/chainRunner/schedulerQueue.spec.ts src/lib/chainRunner/schedulerLanes.spec.ts src/hooks/useHydrateChainPreferences.spec.ts src/lib/chainRunnerAbort.spec.ts`
  - `bun run lint:check`

### ✅ T2.12: GeneralSection concurrency input, useUIStore (+U-SET-03/14)
- **Kind**: implementation  |  **PLAN**: P2.11
- **Files**: `src/components/settings/GeneralSection.spec.tsx (expand beyond single test)`; `src/stores/useUIStore.spec.ts`; `src/components/settings/GeneralSection.tsx (only if D6 draft/blur revert is absent)`
- **Depends on**: T1.3, T1.9
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-CHN-02: GeneralSection concurrency input (D6): empty allowed while typing (not stored); blur with empty/invalid reverts to last valid; "0"/"99"/"-3"/"3.7" clamp to 1-8 (rounded); "abc" ignored; min/max attrs
  4. U-SET-03: GeneralSection: toggles call setSetting("showHealthMonitor"/"showCodeGen"); Clear History button invokes callback; Restart Tour button NOT rendered (B2 regression); concurrency owned by U-CHN-02
  5. U-SET-14: useUIStore readChainConcurrency: corrupt / "" storage; Math.round of decimals
  6. Weak-test rewrites in this task: `GeneralSection.spec` single test expanded; no Restart Tour assertion except `not rendered`
  7. D6 rules for the concurrency input are in U-CHN-02; U-SET-03 'Restart Tour not rendered' is the B2 regression.
  7a. D6 implementation: today the input is controlled and calls `onChainConcurrencyChange` on every finite parse, with no draft state or blur revert. Write the failing U-CHN-02 test first; if it is red, implement a local draft string and revert-to-last-valid on blur in `GeneralSection.tsx` (store clamping in `useUIStore` stays), then confirm green. If already green, record that and change no code.
  8. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-CHN-02 has a spec asserting behavior (not render-only)
  - U-SET-03 has a spec asserting behavior (not render-only)
  - U-SET-14 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/settings/GeneralSection.spec.tsx src/stores/useUIStore.spec.ts`
  - `bun run lint:check`

### ✅ T2.13: Chain cycle hook and arrow config panel
- **Kind**: implementation  |  **PLAN**: P2.12
- **Files**: `src/app/chain/[collectionId]/useChainCycle.spec.ts (new)`; `src/components/chain/panels/arrow-config/ArrowConfigPanelBody.spec.tsx (new)`; `src/components/chain/panels/arrow-config/ArrowConfigInjectionPreviewList.spec.tsx (new)`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-CHN-04: useChainCycle (new spec): returns NO_CYCLE; picks edge on cycle
  4. U-CHN-05: ArrowConfigPanelBody, ArrowConfigInjectionPreviewList: render, edits, preview list
  5. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-CHN-04 has a spec asserting behavior (not render-only)
  - U-CHN-05 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/app/chain/[collectionId]/useChainCycle.spec.ts ArrowConfigPanelBody.spec.tsx ArrowConfigInjectionPreviewList.spec.tsx`
  - `bun run lint:check`

### ✅ T2.14: Chain canvas node builders and panels
- **Kind**: implementation  |  **PLAN**: P2.12
- **Files**: `chainNodeBuilders.spec.ts`; `blockNodeFactory.spec.ts`; `ChainCanvasPanels.spec.tsx`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-CHN-06: chainNodeBuilders, blockNodeFactory, ChainCanvasFlow, ChainCanvasPanels: node building per block type; panels
  4. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-CHN-06 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test chainNodeBuilders.spec.ts blockNodeFactory.spec.ts ChainCanvasPanels.spec.tsx`
  - `bun run lint:check`

### ✅ T2.15: Run log components
- **Kind**: implementation  |  **PLAN**: P2.13
- **Files**: `NestedSteps.spec.tsx`; `StepWarnings.spec.tsx`; `RunCardMenu.spec.tsx`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-CHN-07: NestedSteps, StepWarnings, RunCardMenu: render and actions
  4. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-CHN-07 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test NestedSteps.spec.tsx StepWarnings.spec.tsx RunCardMenu.spec.tsx`
  - `bun run lint:check`

### ✅ T2.16: Node toolbar actions, start input row, alias collision
- **Kind**: implementation  |  **PLAN**: P2.13
- **Files**: `useNodeToolbarActions.spec.ts`; `StartInputRow.spec.tsx`; `AliasCollisionWarning.spec.tsx`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-CHN-08: useNodeToolbarActions, StartInputRow, AliasCollisionWarning: actions; start input row edits; collision warning
  4. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-CHN-08 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test useNodeToolbarActions.spec.ts StartInputRow.spec.tsx AliasCollisionWarning.spec.tsx`
  - `bun run lint:check`

### ✅ T2.17: requestRunner body/headers, executeProxy, scriptRunner
- **Kind**: implementation  |  **PLAN**: P2.14
- **Files**: `src/lib/requestRunner.spec.ts`; `src/lib/scriptRunner.spec.ts`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-REQ-01: requestRunner buildBody/buildHeaders via runRequest: urlencoded encoding and empty->null; xml/urlencoded default Content-Type; user Content-Type in any case not duplicated (fix case-sensitive check if reproduced); basic auth unicode password (btoa throws); empty bearer; text/html; form-data fallthrough
  4. U-REQ-02: requestRunner.executeProxy: code TIMEOUT -> RequestError type "timeout"; sslVerify/followRedirects/timeoutMs defaults in payload
  5. U-REQ-05: scriptRunner: async/rejected promise; infinite loop (document: no guard, add only if B4 work requires); request.headers.delete/get, url.set, body.set flow; environment.get fallback ""; invalid-JSON response.json(); console level prefixes
  6. Weak-test rewrites in this task: `scriptRunner.spec` "isolates env helpers" renamed (scripts are not sandboxed)
  7. U-REQ-01 case-sensitive Content-Type and U-REQ-05 infinite loop are unconfirmed: fix only if reproduced (REQ-01) / characterize only (REQ-05).
  8. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-REQ-01 has a spec asserting behavior (not render-only)
  - U-REQ-02 has a spec asserting behavior (not render-only)
  - U-REQ-05 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/lib/requestRunner.spec.ts src/lib/scriptRunner.spec.ts`
  - `bun run lint:check`

### ✅ T2.18: Proxy route and useSendRequest payload
- **Kind**: implementation  |  **PLAN**: P2.15
- **Files**: `src/app/api/proxy/route.spec.ts`; `src/hooks/useSendRequest.spec.ts`
- **Depends on**: T1.4, T1.5, T1.10
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-REQ-03: api/proxy route: 504 on AbortError; timeoutMs clamp (1_000..600_000, non-number -> default); body+headers forwarded; method uppercased; X-Timing headers; sslVerify (B3); multi-value Set-Cookie CHARACTERIZATION test of current (collapsed) behavior, no fix (D8)
  4. U-REQ-04: useSendRequest: auth var resolution (B4); post-script error toast; post-script logs merge; re-send aborts previous request; per-tab overrides vs global for sslVerify/followRedirects/timeoutMs asserting exact payload passed to runRequest; body-less HEAD/GET; GET-with-body CHARACTERIZATION test, no fix (D8)
  5. Weak-test rewrites in this task: `route.spec` (body/timeout) and `useSendRequest.spec` (assert exact payload passed to runRequest)
  6. Multi-value Set-Cookie and GET-with-body are D8 CHARACTERIZATION tests: document current behavior, NO fix.
  7. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-REQ-03 has a spec asserting behavior (not render-only)
  - U-REQ-04 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/app/api/proxy/route.spec.ts src/hooks/useSendRequest.spec.ts`
  - `bun run lint:check`

### ✅ T2.19: URL building and query parsing utils
- **Kind**: implementation  |  **PLAN**: P2.16
- **Files**: `src/lib/utils.spec.ts`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-REQ-06: utils.buildFinalUrl: duplicate query (URL + table), repeated :param, path value with / or space, {{var}} in value, disabled rows, port :8080 not a param
  4. U-REQ-07: utils syncParamsFromUrl/buildUrlWithParams/parseQueryString: duplicate keys, empty values, + vs %20, fragment, relative URLs, malformed percent-encoding
  5. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-REQ-06 has a spec asserting behavior (not render-only)
  - U-REQ-07 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/lib/utils.spec.ts`
  - `bun run lint:check`

### ✅ T2.20: Code generators and cURL parser
- **Kind**: implementation  |  **PLAN**: P2.17
- **Files**: `src/lib/codeGenerators.spec.ts`; `src/lib/curlParser.spec.ts`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-REQ-12: codeGenerators: auth variants, urlencoded/form-data, quote/newline escaping in all 9 languages, api-key query, JSON bodies for Go/PHP/Ruby/Java/C#; replace pattern-grep tests with exact snippet assertions
  4. U-REQ-13: curlParser: -F, --json, -G, -I, --url, -b, -d @file, quotes/escapes, multiple -d, empty -H, --data-binary
  5. Weak-test rewrites in this task: pattern-grep tests replaced by exact snippet assertions
  6. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-REQ-12 has a spec asserting behavior (not render-only)
  - U-REQ-13 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/lib/codeGenerators.spec.ts src/lib/curlParser.spec.ts`
  - `bun run lint:check`

### ✅ T2.21: Request builder editors and breadcrumb
- **Kind**: implementation  |  **PLAN**: P2.18
- **Files**: `src/components/request/ParamsEditor.spec.tsx (new)`; `src/components/request/AdvancedTab.spec.tsx (new)`; `src/components/request/RequestBreadcrumb.spec.tsx (new)`; `src/components/request/HeadersEditor.spec.tsx`; `src/components/request/AuthEditor.spec.tsx`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-REQ-08: ParamsEditor (new spec): query edit updates URL; path params read-only; disabled rows leave URL
  4. U-REQ-09: AdvancedTab (new spec): timeout draft parse/clamp, blank -> undefined, SSL switch + "reset to global", follow-redirects switch
  5. U-REQ-10: RequestBreadcrumb (new spec): unsaved, saved, collection missing
  6. U-REQ-16: HeadersEditor: add/edit/disable/delete (currently only AI tests)
  7. U-REQ-17: AuthEditor: bearer and "none" clear; tokens containing {{var}}
  8. Weak-test rewrites in this task: `HeadersEditor.spec` (AI-only) gains add/edit/disable/delete
  9. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-REQ-08 has a spec asserting behavior (not render-only)
  - U-REQ-09 has a spec asserting behavior (not render-only)
  - U-REQ-10 has a spec asserting behavior (not render-only)
  - U-REQ-16 has a spec asserting behavior (not render-only)
  - U-REQ-17 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/request/ParamsEditor.spec.tsx src/components/request/AdvancedTab.spec.tsx src/components/request/RequestBreadcrumb.spec.tsx src/components/request/HeadersEditor.spec.tsx src/components/request/AuthEditor.spec.tsx`
  - `bun run lint:check`

### ✅ T2.22: Code-gen UI, UrlBar, SaveRequestModal (+ptr U-SET-01)
- **Kind**: implementation  |  **PLAN**: P2.19
- **Files**: `src/components/request/CodeGenPanel.spec.tsx (new)`; `src/components/request/CodeGenDialog.spec.tsx (new)`; `src/components/request/UrlBar.spec.tsx (extend)`; `src/components/collections/SaveRequestModal.spec.tsx`
- **Depends on**: T2.3
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-REQ-11: CodeGenPanel + CodeGenDialog (new specs): language switching, copy, variable resolution, secret redaction toggle; showCodeGen collapsed/expanded, codeGenLang persisted, "tab" variant always expanded
  4. U-REQ-14: UrlBar: handlePaste cURL, handleCopyCurl failure, HEAD/OPTIONS items + checkmark, Cmd+Enter in input
  5. U-REQ-18: SaveRequestModal: folder choice, empty-name validation, duplicate names
  6. U-SET-01: (pointer) CodeGenPanel, built by U-REQ-11
  7. U-SET-01 is a pointer: the CodeGenPanel showCodeGen/codeGenLang assertions are part of U-REQ-11.
  8. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-REQ-11 has a spec asserting behavior (not render-only)
  - U-REQ-14 has a spec asserting behavior (not render-only)
  - U-REQ-18 has a spec asserting behavior (not render-only)
  - U-SET-01 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/request/CodeGenPanel.spec.tsx src/components/request/CodeGenDialog.spec.tsx src/components/request/UrlBar.spec.tsx src/components/collections/SaveRequestModal.spec.tsx`
  - `bun run lint:check`

### ✅ T2.23: Tab dropdown and bulk/single-close dialogs
- **Kind**: implementation  |  **PLAN**: P2.20
- **Files**: `src/components/layout/TabListDropdown.spec.tsx (extend P1.6)`; `src/components/layout/TabBar.spec.tsx`
- **Depends on**: T1.6
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-TAB-01: TabListDropdown: count header, case-insensitive/trimmed/fallback "New Request" filter, "No tabs found", select activates and closes, Enter/Space, active highlight, dirty dot, row X calls handleCloseTab without selecting, Close all -> handleCloseAll (dirty -> pendingBulkClose), search cleared on reopen (B5 regression; extend T1 spec)
  4. U-TAB-02: TabBar bulk-close dialog: confirmBulkClose for "others"/"all", dirty count one vs many text, cancel
  5. U-TAB-03: TabBar single-close dialog: Cancel keeps tab, pendingCloseTabId cleared
  6. U-TAB-07: TabBar drag/drop: dragstart/drop -> reorderTabs(from,to); same index no call; dragend resets
  7. U-TAB-08: TabBar overflow: "+" moves to right actions when scrollWidth>clientWidth (mock sizes); auto-scroll on add
  8. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-TAB-01 has a spec asserting behavior (not render-only)
  - U-TAB-02 has a spec asserting behavior (not render-only)
  - U-TAB-03 has a spec asserting behavior (not render-only)
  - U-TAB-07 has a spec asserting behavior (not render-only)
  - U-TAB-08 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/layout/TabListDropdown.spec.tsx src/components/layout/TabBar.spec.tsx`
  - `bun run lint:check`

### ✅ T2.24: MainLayout, Tab, TabContextMenu, RequestItem dedupe (+ptr U-RT-13)
- **Kind**: implementation  |  **PLAN**: P2.21
- **Files**: `src/components/layout/MainLayout.spec.tsx`; `src/components/layout/Tab.spec.tsx (new)`; `src/components/layout/TabContextMenu.spec.tsx`; `src/components/collections/RequestItem.spec.tsx (extend)`
- **Depends on**: T2.8
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-TAB-04: MainLayout: handleCloseActiveTab, handleCloseAllTabs dirty branch, beforeunload handler
  4. U-TAB-05: Tab (new spec): icon per type, dirty dot, connection dot only when ws/socketio connected, color dot, Enter/Space select, X keyboard close, X stopPropagation
  5. U-TAB-06: TabContextMenu: Set Label apply/clear, Delete request confirm, rename Escape/empty, Duplicate for graphql/ws
  6. U-TAB-09: RequestItem dedupe: click on existing requestId activates instead of opening a duplicate
  7. U-RT-13: (pointer) Tab connection dot, built by U-TAB-05
  8. U-RT-13 is a pointer: the Tab connection-dot assertion is part of U-TAB-05.
  9. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-TAB-04 has a spec asserting behavior (not render-only)
  - U-TAB-05 has a spec asserting behavior (not render-only)
  - U-TAB-06 has a spec asserting behavior (not render-only)
  - U-TAB-09 has a spec asserting behavior (not render-only)
  - U-RT-13 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/layout/MainLayout.spec.tsx src/components/layout/Tab.spec.tsx src/components/layout/TabContextMenu.spec.tsx src/components/collections/RequestItem.spec.tsx`
  - `bun run lint:check`

### ✅ T2.25: Keyboard shortcuts
- **Kind**: implementation  |  **PLAN**: P2.22
- **Files**: `src/hooks/useKeyboardShortcuts.spec.ts`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-TAB-10: useKeyboardShortcuts: Ctrl+[ at first / Ctrl+] at last = no-op; no tabs; Ctrl+T
  4. U-REQ-15: useKeyboardShortcuts: Cmd+S (macOS) -> onSave
  5. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-TAB-10 has a spec asserting behavior (not render-only)
  - U-REQ-15 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/hooks/useKeyboardShortcuts.spec.ts`
  - `bun run lint:check`

### ✅ T2.26: Settings page, proxy, clear history, nav (+ptr U-RT-10)
- **Kind**: implementation  |  **PLAN**: P2.23
- **Files**: `src/app/settings/SettingsPageClient.spec.tsx (extend P1.9)`; `src/components/settings/ProxySection.spec.tsx`; `src/components/settings/ClearHistoryDialog.spec.tsx`; `src/components/settings/SettingsNav.spec.tsx`
- **Depends on**: T1.9
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-SET-04: SettingsPageClient: Clear History cancel keeps history; default section (B8)
  4. U-SET-08: ProxySection: switches reflect props, setSetting keys, placeholder i18n
  5. U-SET-10: ClearHistoryDialog: cancel/Esc closes, confirm label
  6. U-SET-11: SettingsNav: active state, all six sections, i18n labels
  7. U-RT-10: (pointer) ClearHistoryDialog, built by U-SET-10
  8. U-RT-10 is a pointer: ClearHistoryDialog assertions of U-SET-10 satisfy it.
  9. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-SET-04 has a spec asserting behavior (not render-only)
  - U-SET-08 has a spec asserting behavior (not render-only)
  - U-SET-10 has a spec asserting behavior (not render-only)
  - U-SET-11 has a spec asserting behavior (not render-only)
  - U-RT-10 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/app/settings/SettingsPageClient.spec.tsx src/components/settings/ProxySection.spec.tsx src/components/settings/ClearHistoryDialog.spec.tsx src/components/settings/SettingsNav.spec.tsx`
  - `bun run lint:check`

### ✅ T2.27: JSON visualize, appearance/accent, DiffTree
- **Kind**: implementation  |  **PLAN**: P2.24
- **Files**: `src/components/json-visualize/JsonVisualizePage.spec.tsx`; `src/components/settings/AppearanceSection.spec.tsx`; `src/components/json-compare/DiffTree.spec.tsx`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-SET-06: JsonVisualizePage: render, invalid JSON, tree expand/collapse, search
  4. U-SET-09: AppearanceSection + useThemeAccent: accent click handler with rgb, active ring, mounted gating, CSS vars set, no-op when undefined
  5. U-SET-15: DiffTree: added/removed/changed rendering
  6. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-SET-06 has a spec asserting behavior (not render-only)
  - U-SET-09 has a spec asserting behavior (not render-only)
  - U-SET-15 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/components/json-visualize/JsonVisualizePage.spec.tsx src/components/settings/AppearanceSection.spec.tsx src/components/json-compare/DiffTree.spec.tsx`
  - `bun run lint:check`

### ✅ T2.28: GraphQL introspection, tabs, schema explorer
- **Kind**: implementation  |  **PLAN**: P2.25
- **Files**: `src/lib/graphqlIntrospection.spec.ts`; `src/components/request/tabs/GraphQLTabs.spec.tsx`; `src/components/request/GraphQLSchemaExplorer.spec.tsx`
- **Depends on**: none
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-RT-01: graphqlIntrospection fetchGraphQLSchema, formatTypeRef: network failure, proxy error, non-JSON, errors[], missing __schema, __ filtering, header enabled/key filtering
  4. U-RT-02: GraphQLTabs handleFieldSnippet: empty query, ends with }, duplicate root field, indentation
  5. U-RT-06: GraphQLSchemaExplorer: idle/loading/error/success; search; type expand; buildArgsString, buildFieldSnippet, buildSubfieldLines, argPlaceholder
  6. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-RT-01 has a spec asserting behavior (not render-only)
  - U-RT-02 has a spec asserting behavior (not render-only)
  - U-RT-06 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/lib/graphqlIntrospection.spec.ts src/components/request/tabs/GraphQLTabs.spec.tsx src/components/request/GraphQLSchemaExplorer.spec.tsx`
  - `bun run lint:check`

### ✅ T2.29: Connection store, ConnectButton, MessageLog, WS/SIO tabs
- **Kind**: implementation  |  **PLAN**: P2.26
- **Files**: `src/stores/useConnectionStore.spec.ts (extend)`; `src/components/request/ConnectButton.spec.tsx (new)`; `src/components/request/MessageLog.spec.tsx`; `src/components/request/tabs/WebSocketTabs.spec.tsx`; `src/components/request/tabs/SocketIOTabs.spec.tsx (new)`
- **Depends on**: T1.7, T1.8
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-RT-03: useConnectionStore: Socket.IO connect_error surfaces (B6); ws onclose preserves error; tab close disconnects ws and socketio (B7); handshake headers not tested (D2)
  4. U-RT-05: ConnectButton (new spec): disabled for empty URL; Connecting spinner; Disconnect; env-variable URL resolution
  5. U-RT-08: MessageLog: empty state, sent/received data-direction, clear click
  6. U-RT-09: WebSocketTabs / SocketIOTabs (new spec for SIO): empty draft no-op; draft cleared after send; send disabled while connecting; blank event -> "message"; emitted event name and payload
  7. Weak-test rewrites in this task: `useConnectionStore.spec` connect_error; `WebSocketTabs.spec` headers test renamed (render-only, D2)
  8. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-RT-03 has a spec asserting behavior (not render-only)
  - U-RT-05 has a spec asserting behavior (not render-only)
  - U-RT-08 has a spec asserting behavior (not render-only)
  - U-RT-09 has a spec asserting behavior (not render-only)
  - Listed weak tests rewritten with stronger assertions (no deletion/weakening)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/stores/useConnectionStore.spec.ts src/components/request/ConnectButton.spec.tsx src/components/request/MessageLog.spec.tsx src/components/request/tabs/WebSocketTabs.spec.tsx src/components/request/tabs/SocketIOTabs.spec.tsx`
  - `bun run lint:check`

### ✅ T2.30: GraphQL send, history export/list/item
- **Kind**: implementation  |  **PLAN**: P2.27
- **Files**: `src/hooks/useSendRequest.spec.ts (GraphQL block)`; `src/lib/historyExport.spec.ts`; `src/components/history/HistoryList.spec.tsx`; `src/components/history/HistoryItem.spec.tsx`
- **Depends on**: T1.10, T2.18
- **Do**:
  1. Execute via the `agent-skills:test-engineer` agent (Agent tool, subagent_type `agent-skills:test-engineer`) and use the `write-component-tests` skill (component tests, `*.spec.tsx`); for pure lib/store functions (`src/lib/*`, `src/stores/*`) also allow the `writing-unit-tests` skill. One agent for this task, run sequentially.
  2. Agent prompt must include: task id, the item IDs below with their 'what to assert' text, the target files, 'extend the existing spec, do not duplicate; reread the file first', real Zustand stores reset with `setState`, mock only network/IndexedDB boundaries, Arrange-Act-Assert, behavior-describing test names, `data-testid` not CSS classes, no `it.skip`/`it.only`, never test under `src/components/reactbits/`.
  3. U-RT-04: useSendRequest GraphQL: sendForce bypass; env-resolved variables/operationName; error path (setError/toast); abort; GraphQL stays unrecorded in history
  4. U-RT-07: historyExport + HistoryList export menu: csvCell escaping (comma/quote/newline), JSON rounding, buildExportFilename, downloadFile
  5. U-RT-11: HistoryList: method filter, healthKey match, export hidden in compact, sample cards in empty state
  6. U-RT-12: HistoryItem: open restores headers/body/auth/scripts and correct tab type (B9); truncated URL
  7. Run `bun run test <files>` and `bun run lint:check`; report one mutation sanity check (break the target behavior, see a new test fail, restore).
- **Acceptance**:
  - U-RT-04 has a spec asserting behavior (not render-only)
  - U-RT-07 has a spec asserting behavior (not render-only)
  - U-RT-11 has a spec asserting behavior (not render-only)
  - U-RT-12 has a spec asserting behavior (not render-only)
  - No `it.skip`/`it.only`; lint green
- **Verify**:
  - `bun run test src/hooks/useSendRequest.spec.ts src/lib/historyExport.spec.ts src/components/history/HistoryList.spec.tsx src/components/history/HistoryItem.spec.tsx`
  - `bun run lint:check`

### ✅ T2.31: 🔶 Checkpoint 2: Phase 2 gate
- **Kind**: gate  |  **PLAN**: Checkpoint 2
- **Files**: none (verification only)
- **Depends on**: T2.30
- **Do**:
  1. Run the full unit suite, lint, typecheck and seeded QA specs.
  2. Script-check that every U-* ID in the traceability table has a spec (grep the spec files for the behavior or the ID in a describe/it name); confirm pointer items present in their owner's spec.
  3. Confirm all SPEC 6.8 weak tests are rewritten; no `it.skip`/`it.only` (`grep -rn "it.skip\|it.only\|describe.skip" src`); no tests under `src/components/reactbits/`.
  4. Stop for human review before Phase 3 (AskUserQuestion).
- **Acceptance**:
  - `bun run test`, lint, typecheck green
  - Every U-* ID owned by a spec; weak tests rewritten
  - Human approval recorded
- **Verify**:
  - `bun run test`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bun run test:qa`
  - `git status --short src/components/reactbits (expect empty)`


## Phase 3: E2E (mock server, scenarios, tests)

### ✅ T3.1: Fix check-parity.sh silent exit 1 (moved from Phase 4)
- **Kind**: implementation  |  **PLAN**: P3.1
- **Files**: `e2e/scenarios/chain/check-parity.sh`; `e2e/scenarios/chain/check-ids.sh (only if it needs the same fix)`
- **Depends on**: T2.31
- **Do**:
  1. Reproduce first: suspected `set -euo pipefail` with `grep` no-match inside `list_titles`, and/or `playwright --list` failure killing the script before any `echo`. Capture stdout, stderr and exit code.
  2. Fix: print `FAILED: <step>` with the captured output; use `|| true` only where an empty result is valid, then validate non-empty explicitly. Also run `check-ids.sh`.
  3. Success path unchanged (285/285).
- **Acceptance**:
  - Forced failures (bad `PLAYWRIGHT_TEST_BASE_URL`, `PATH` without bunx) print a reason instead of exiting 1 silently
  - Success path still reports 285/285
- **Verify**:
  - `bash e2e/scenarios/chain/check-parity.sh (expect 285/285)`
  - `bash e2e/scenarios/chain/check-ids.sh`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:1 bash e2e/scenarios/chain/check-parity.sh (expect FAILED: <step> output)`
  - `PATH=/usr/bin:/bin bash e2e/scenarios/chain/check-parity.sh (expect a reason)`

### ✅ T3.2: Mock server: deps (D4) and HTTP core
- **Kind**: implementation  |  **PLAN**: P3.2
- **Files**: `package.json`; `bun.lock`; `e2e/support/mock-server/index.ts`; `e2e/support/mock-server/httpRoutes.ts`; `e2e/support/mock-server/requestLog.ts`
- **Depends on**: T3.1
- **Do**:
  1. `bun add -d socket.io ws @types/ws` (the only package changes allowed; never npm).
  2. Bootstrap `index.ts` on `127.0.0.1:3333` (override `MOCK_PORT`), fail fast with a clear message if the port is held by something else.
  3. `httpRoutes.ts`: `/__health`, `ANY /echo` (JSON of method, headers, query, parsed body incl. urlencoded and multipart fields + file names, raw body), `?status=<code>`, `?delay=<ms>` on any path, `/redirect?to=&status=301|302|307` incl. chained, `/slow`, multi-value Set-Cookie endpoint, `/large?bytes=<n>`, binary endpoint.
  4. `requestLog.ts`: `/__requests?testId=` and `/__reset?testId=` namespaced by the `x-test-id` header (or path prefix); never a global reset used by tests.
- **Acceptance**:
  - Server starts with `bun e2e/support/mock-server/index.ts` and answers `/__health`
  - Every HTTP capability in SPEC section 8 table (echo, controls, redirect, large, binary, cookies, request log, reset) responds correctly
  - Only socket.io, ws, @types/ws added
- **Verify**:
  - `Start the server in the background: `bun e2e/support/mock-server/index.ts`; probe with a throwaway bun script run via ctx_execute (no curl)`
  - `bun run lint:check`
  - `git diff --stat package.json (only the 3 devDependencies)`

### ✅ T3.3: Mock server: WebSocket, Socket.IO, GraphQL
- **Kind**: implementation  |  **PLAN**: P3.3
- **Files**: `e2e/support/mock-server/wsServer.ts`; `e2e/support/mock-server/socketIoServer.ts`; `e2e/support/mock-server/graphqlRoutes.ts`; `e2e/support/mock-server/index.ts`
- **Depends on**: T3.2
- **Do**:
  1. `wsServer.ts`: `ws://127.0.0.1:3333/ws` echoes frames; connect and close events recorded in the request log.
  2. `socketIoServer.ts`: `/socket.io` connect, `message` echo, custom named event echo, forced connect error via `?fail=1` (or auth middleware); polling URL on :3333 stays compatible with `e2e/socketio.spec.ts` (`SOCKETIO_TEST_URL` default).
  3. `graphqlRoutes.ts`: `POST /graphql` with small schema + introspection (Query fields with args; uses the already-installed `graphql` package), echo of received headers, `errors[]` response and a 400 variant triggered by operation name or header.
  4. Wire all three into `index.ts`. If socket.io/ws misbehave under Bun, fall back to running the server under Node (`bunx tsx`) and note it.
- **Acceptance**:
  - WS echo and close events visible via `/__requests`
  - Socket.IO message/custom-event echo and forced `connect_error` work
  - GraphQL introspection, header echo, errors[] and 400 variants work
- **Verify**:
  - `Start the server; probe each protocol with a throwaway bun script via ctx_execute`
  - `bun run lint:check`

### ✅ T3.4: Mock server: HTTPS listener with startup self-signed cert
- **Kind**: implementation  |  **PLAN**: P3.4
- **Files**: `e2e/support/mock-server/tlsCert.ts`; `e2e/support/mock-server/mockBaseUrl.ts`; `e2e/support/mock-server/index.ts`; `e2e/support/mock-server/httpRoutes.ts`
- **Depends on**: T3.3
- **Do**:
  1. `tlsCert.ts`: generate a self-signed cert at startup into `os.tmpdir()` using the `openssl` CLI through `execFileSync` (`openssl req -x509 ... -subj /CN=127.0.0.1`); no key material committed, no new dependency; fail fast with an explicit message if `openssl` is missing.
  2. HTTPS listener on `127.0.0.1:3334` (override `MOCK_HTTPS_PORT`) serving `/echo` (same handlers as HTTP).
  3. `mockBaseUrl.ts` exports `MOCK_BASE_URL` (default `http://127.0.0.1:3333`), `MOCK_HTTPS_URL`, `MOCK_WS_URL`.
- **Acceptance**:
  - HTTPS `/echo` answers on :3334 with a cert generated at startup
  - No cert or key file added to git (`git status` clean of key material)
  - Constants exported from one helper
- **Verify**:
  - `Start the server; probe https://127.0.0.1:3334/echo with a throwaway bun script (TLS verify disabled) via ctx_execute`
  - `bun run lint:check`

### ✅ T3.5: playwright.config.ts webServer swap and mock-server smoke spec
- **Kind**: e2e  |  **PLAN**: P3.4
- **Files**: `playwright.config.ts`; `e2e/mock-server.spec.ts (new)`; `e2e/fixtures/README.md`
- **Depends on**: T3.4
- **Do**:
  1. User-approved config change: replace the missing `bash scripts/run-socketio-echo.sh` webServer entry with `{ command: "bun e2e/support/mock-server/index.ts", url: "http://127.0.0.1:3333/__health", reuseExistingServer: !process.env.CI, timeout: 30_000 }`. Restructure so the mock entry is ALWAYS present and only the Next.js entry is conditional on `PLAYWRIGHT_TEST_BASE_URL`. Do not change testDir, workers or the Next.js entry's ports.
  2. Smoke spec `e2e/mock-server.spec.ts` exercises every capability (HTTP echo/controls/redirect/large/binary/cookies/log/reset, WS, Socket.IO incl. forced error, GraphQL, HTTPS) with `x-test-id` isolation; no `waitForTimeout`; uses the `playwright` request fixture/`ws`-free browser APIs where possible.
  3. `e2e/fixtures/README.md`: short usage note for the mock server.
- **Acceptance**:
  - `bun run test:e2e`-style runs bring the mock server up cold with no manual step
  - Smoke spec green; `e2e/socketio.spec.ts` unchanged and still green
  - Config change limited to the webServer entries
- **Verify**:
  - `bunx playwright test e2e/mock-server.spec.ts --repeat-each=2`
  - `bunx playwright test e2e/socketio.spec.ts`
  - `bun run lint:check`

### ✅ T3.6: e2e/README.md (the only useful effect of `/e2e setup`)
- **Kind**: implementation  |  **PLAN**: P3.5
- **Files**: `e2e/README.md (new)`
- **Depends on**: T3.5
- **Do**:
  1. Do NOT run `/e2e setup` in default mode (it would create `e2e/tests/`, page objects and a new config). Write `e2e/README.md` by hand documenting: run commands (`bun run test:e2e`, `bunx playwright test e2e/<area>.spec.ts`), base URL `http://127.0.0.1:3000`, the mock server (ports 3333/3334, `MOCK_PORT`, `MOCK_HTTPS_PORT`, `MOCK_BASE_URL`), isolation (`x-test-id`, 2 workers, never a global `__reset`), selector policy (testid/role only, no `waitForTimeout`), and the layout note: specs live in `e2e/<area>.spec.ts` and `e2e/qa/`, `testDir` stays `./e2e`, scenarios in `e2e/scenarios/`; NOT `e2e/tests/`.
- **Acceptance**:
  - `e2e/README.md` exists with all listed sections (satisfies the `/e2e scenarios` precondition)
  - No `e2e/tests/` or `e2e/pages/` directory created
- **Verify**:
  - `ls e2e/README.md`
  - `ls e2e/tests e2e/pages (expect not found)`

### ✅ T3.7: 🔶 Checkpoint 3a: infra gate
- **Kind**: gate  |  **PLAN**: Checkpoint 3a
- **Files**: none (verification only)
- **Depends on**: T3.6
- **Do**:
  1. Confirm `bun run test:e2e` brings the mock server up cold and the existing suite shows no regression from the config change (chain `page.route` tests unaffected).
  2. Stop for human review before scenario work (AskUserQuestion).
- **Acceptance**:
  - Full e2e green; lint green; human approval
- **Verify**:
  - `bun run test:e2e`
  - `bun run lint:check`
  - `bun run test:qa`
  - `bash e2e/scenarios/chain/check-ids.sh`

### ✅ T3.8: Seeded QA spec for UI-visible Phase 1 fixes (moved from Phase 1)
- **Kind**: e2e  |  **PLAN**: P3.6
- **Files**: `e2e/qa/bugfix-regressions.spec.ts (new, copy of `_template.spec.ts`)`; `e2e/fixtures/seed/bugfix-regressions.json (only if seed data needed; then `bun run qa:seed:build`)`
- **Depends on**: T3.7, T1.1, T1.2, T1.3, T1.6, T1.7, T1.9, T1.11, T1.12
- **Do**:
  1. Copy `e2e/qa/_template.spec.ts` to `e2e/qa/bugfix-regressions.spec.ts`; describe `Bugfix regressions @qa`; one `test()` per UI-visible fix, each ending with `snap()`; role/testid locators; no `waitForTimeout`; the `consoleGuard` fixture is not bypassed.
  2. Tests: B1 (pick Francais, reload, `html lang=fr` and a French string), B2 (Settings > General has no Restart Tour), B5 (dropdown search empty after select and after Close all), B6 (Socket.IO to an unreachable URL shows the error and Connect is enabled; the unreachable target may be a closed local port or the mock server's `?fail=1` Socket.IO endpoint, no external host), B8 (Settings opens on General), B10 (duplicate env name shows inline error in sidebar create and in the env manager).
  3. Not seeded-QA: B3/B4/B7/B9 are covered by their unit tests (and E-* e2e in Phase 3); say so in a header comment.
- **Acceptance**:
  - One test per listed fix; all green and non-flaky
  - No `waitForTimeout`; no console errors (consoleGuard)
  - E2E evidence for B1, B2, B5, B6, B8, B10 deferred from Phase 1 (user-approved deviation from the planner.md seeded-QA rule); the owning Phase 1 tasks keep bug ownership
- **Verify**:
  - `bunx playwright test e2e/qa/bugfix-regressions.spec.ts --repeat-each=2`
  - `bun run lint:check`


### ✅ T3.9: SC1 environments scenarios
- **Kind**: e2e  |  **PLAN**: P3.7
- **Files**: `e2e/scenarios/environments.feature.md`
- **Depends on**: T3.8, T1.12
- **Do**:
  1. Run the `/e2e scenarios environments` command (defined in `~/.claude/commands/e2e.md`; its step 1 precondition is satisfied by T3.6). Prompt override for every step: scenario files stay in `e2e/scenarios/`, specs will live in `e2e/<area>.spec.ts` (NOT `e2e/tests/`), use `bunx playwright` never `npx`, new scenarios target the local mock server (`MOCK_BASE_URL`) with `x-test-id` isolation. Pass the E-* rows below as the candidate list so Explore discovery does not drift. Keep the command's user checkpoint (AskUserQuestion confirm/trim) and its batch review by `general-purpose` reviewers. Output: tags `@critical/@high/@medium`, `# evidence:` comments, and every scenario title starts with its E-* ID.
  2. E-ENV-01: Active env Dev token=abc123, header Authorization: Bearer {{token}}, send -> echo shows Bearer abc123
  3. E-ENV-02: Env list, variables and active env persist after reload
  4. E-ENV-03: {{baseUrl}} highlighted resolved vs unresolved; unresolved send shows warning with "send anyway"
  5. E-ENV-04: Paste multi-line KEY=value into a cell -> rows created, success toast
  6. E-ENV-05: Import .env via setInputFiles on import-env-btn input -> variables listed
  7. E-ENV-06: Delete the active env -> selector shows "No Environment"
  8. E-ENV-07: Creating or renaming an env to an existing name (any case, surrounding spaces) shows inline error and does not save (B10); replaces old duplicate-names scenario; legacy-duplicates seed (two "GitHub" in IndexedDB) still loads and both are selectable
  9. E-ENV-08: Empty name committed on rename/create -> default name
  10. E-ENV-09: Variable in JSON body and bearer auth -> resolved values reach the server
  11. E-ENV-10: Sidebar "+" -> Environment, type name, env appears, click -> Active badge
  12. E-ENV-11: initial=A, current=B -> request uses B; clearing current -> A
  13. E-ENV-12: (maintenance) adjust existing env e2e that relied on duplicate names or name-based testids (env-list-item-<name>) to use unique names / id-based testids
  14. Doc-drift fixes owned by this task (SPEC section 9): 'New Environment + confirm' -> '+ Add Environment' with inline rename; split/merge 'Add a variable'/'Edit a variable'; header scenario implemented by E-ENV-01; add E-ENV-02..11; E-ENV-07 replaces the old duplicate-names scenario; E-ENV-12 is a maintenance note.
- **Acceptance**:
  - Scenario file(s) contain a scenario titled with each of: E-ENV-01, E-ENV-02, E-ENV-03, E-ENV-04, E-ENV-05, E-ENV-06, E-ENV-07, E-ENV-08, E-ENV-09, E-ENV-10, E-ENV-11, E-ENV-12
  - Doc drift fixes landed; every pre-existing scenario still maps 1:1 to a test title (or is flagged)
  - Reviewer batches applied; scenario summary table printed; user checkpoint answered
- **Verify**:
  - `grep -c '^## Scenario' e2e/scenarios/environments.feature.md`
  - `grep -n 'E-' e2e/scenarios/environments.feature.md (every listed ID present)`

### ✅ T3.10: SC2 collections and import scenarios
- **Kind**: e2e  |  **PLAN**: P3.8
- **Files**: `e2e/scenarios/collections.feature.md`; `e2e/scenarios/import.feature.md`
- **Depends on**: T3.7
- **Do**:
  1. Run the `/e2e scenarios collections and import` command (defined in `~/.claude/commands/e2e.md`; its step 1 precondition is satisfied by T3.6). Prompt override for every step: scenario files stay in `e2e/scenarios/`, specs will live in `e2e/<area>.spec.ts` (NOT `e2e/tests/`), use `bunx playwright` never `npx`, new scenarios target the local mock server (`MOCK_BASE_URL`) with `x-test-id` isolation. Pass the E-* rows below as the candidate list so Explore discovery does not drift. Keep the command's user checkpoint (AskUserQuestion confirm/trim) and its batch review by `general-purpose` reviewers. Output: tags `@critical/@high/@medium`, `# evidence:` comments, and every scenario title starts with its E-* ID.
  2. E-COL-01: Import Postman v2.1 with nested folders via Import dialog -> collection, folders, requests in tree with nesting (new e2e/import.spec.ts)
  3. E-COL-02: Import non-parsable file -> error shown, sidebar unchanged
  4. E-COL-03: Folder CRUD: New Folder, rename, add request, duplicate, delete (children removed)
  5. E-COL-04: Sidebar search: matching groups; click opens/activates tab; no-results; clear (X)
  6. E-COL-05: "+" menu parametrized: HTTP, GraphQL, WebSocket, Socket.IO, Collection, Environment, Chain, Import
  7. E-COL-06: Import Insomnia and OpenAPI (JSON and YAML), cURL via dialog populates a new tab
  8. E-COL-07: Reload persistence: collapsed folder, collapsed section, collections
  9. E-COL-08: Request actions from sidebar menu: rename, duplicate "(copy)", Export as Postman (download event), Copy as cURL (clipboard)
  10. E-COL-09: Collection "Export as Postman" -> valid .json download with folders/requests
  11. Doc-drift fixes owned by this task (SPEC section 9): import.feature.md: 4 documented scenarios become implemented (E-COL-01/02/06); collections.feature.md: add new scenarios and verify existing ones map 1:1 to test titles.
- **Acceptance**:
  - Scenario file(s) contain a scenario titled with each of: E-COL-01, E-COL-02, E-COL-03, E-COL-04, E-COL-05, E-COL-06, E-COL-07, E-COL-08, E-COL-09
  - Doc drift fixes landed; every pre-existing scenario still maps 1:1 to a test title (or is flagged)
  - Reviewer batches applied; scenario summary table printed; user checkpoint answered
- **Verify**:
  - `grep -c '^## Scenario' e2e/scenarios/collections.feature.md e2e/scenarios/import.feature.md`
  - `grep -n 'E-' e2e/scenarios/collections.feature.md (every listed ID present)`

### ✅ T3.11: SC3 chain scenarios (single-file chain.feature.md)
- **Kind**: e2e  |  **PLAN**: P3.9
- **Files**: `e2e/scenarios/chain.feature.md`
- **Depends on**: T3.7
- **Do**:
  1. Run the `/e2e scenarios chain` command (defined in `~/.claude/commands/e2e.md`; its step 1 precondition is satisfied by T3.6). Prompt override for every step: scenario files stay in `e2e/scenarios/`, specs will live in `e2e/<area>.spec.ts` (NOT `e2e/tests/`), use `bunx playwright` never `npx`, new scenarios target the local mock server (`MOCK_BASE_URL`) with `x-test-id` isolation. Pass the E-* rows below as the candidate list so Explore discovery does not drift. Keep the command's user checkpoint (AskUserQuestion confirm/trim) and its batch review by `general-purpose` reviewers. Output: tags `@critical/@high/@medium`, `# evidence:` comments, and every scenario title starts with its E-* ID.
  2. E-CHN-01: Settings concurrency input (D6): 0 / 99 / -3 clamp to 1..8; "abc" ignored; cleared while typing allowed and blur reverts to last valid value; default 4 on fresh profile; persists after reload
  3. E-CHN-02: Concurrency 2 with 4 independent slow requests -> exactly 2 lanes overlap, never 3+ (mock server delay, overlap from server-side timestamps)
  4. E-CHN-03: Cyclic chain: Run blocked, banner names cycle nodes
  5. E-CHN-04: Concurrency 1 with Loop body and Sub-chain: still run; outer lanes obey setting
  6. E-CHN-05: Forced migration failure (init script) -> Retry / Open read-only recovers
  7. E-CHN-06: Sidebar search by chain name shows only matching chains (shares helper with E-COL-04)
  8. E-CHN-07: Rename chain to empty or duplicate name -> old name kept or error shown
  9. E-SET-06: (pointer) concurrency, built by E-CHN-01
  10. Doc-drift fixes owned by this task (SPEC section 9): Add E-CHN-01..07 to the EXISTING `e2e/scenarios/chain.feature.md` (not `e2e/scenarios/chain/`), leaving the 285-ID parity of `e2e/scenarios/chain/*.feature.md` vs `e2e/qa/chain-e2e-*.spec.ts` untouched. E-SET-06 is a pointer to E-CHN-01.
- **Acceptance**:
  - Scenario file(s) contain a scenario titled with each of: E-CHN-01, E-CHN-02, E-CHN-03, E-CHN-04, E-CHN-05, E-CHN-06, E-CHN-07, E-SET-06
  - Doc drift fixes landed; every pre-existing scenario still maps 1:1 to a test title (or is flagged)
  - Reviewer batches applied; scenario summary table printed; user checkpoint answered
- **Verify**:
  - `grep -c '^## Scenario' e2e/scenarios/chain.feature.md`
  - `grep -n 'E-' e2e/scenarios/chain.feature.md (every listed ID present)`

### ✅ T3.12: SC4 requests / body / response / auth scenarios
- **Kind**: e2e  |  **PLAN**: P3.10
- **Files**: `e2e/scenarios/requests.feature.md`; `e2e/scenarios/body.feature.md`; `e2e/scenarios/response.feature.md`; `e2e/scenarios/auth.feature.md`
- **Depends on**: T3.7
- **Do**:
  1. Run the `/e2e scenarios requests` command (defined in `~/.claude/commands/e2e.md`; its step 1 precondition is satisfied by T3.6). Prompt override for every step: scenario files stay in `e2e/scenarios/`, specs will live in `e2e/<area>.spec.ts` (NOT `e2e/tests/`), use `bunx playwright` never `npx`, new scenarios target the local mock server (`MOCK_BASE_URL`) with `x-test-id` isolation. Pass the E-* rows below as the candidate list so Explore discovery does not drift. Keep the command's user checkpoint (AskUserQuestion confirm/trim) and its batch review by `general-purpose` reviewers. Output: tags `@critical/@high/@medium`, `# evidence:` comments, and every scenario title starts with its E-* ID.
  2. E-REQ-01: Edit URL of saved request, Cmd/Ctrl+S -> dirty dot gone, success toast, edit persists on reopen
  3. E-REQ-02: Breadcrumb "New Request > unsaved"; after save "<Collection> > <name>"
  4. E-REQ-03: Short timeout in Advanced vs slow endpoint -> timeout error state (not generic network error)
  5. E-REQ-04: Disabled header/param is NOT received by echo (rewrites weak "Disable ..." tests)
  6. E-REQ-05: Undefined {{baseUrl}} -> warning; "Send anyway" dispatches; with active env resolves in URL, header, body, auth
  7. E-REQ-06: Cancelled request returns UI to idle (no failure state), resend works (rewrites "Cancel an in-flight request", which currently expects an error)
  8. E-REQ-07: Method menu lists 7 methods with checkmark; HEAD returns headers, empty body, 200
  9. E-REQ-08: ?a=1&a=2&b= -> three rows; edit updates URL; %20/unicode round-trip
  10. E-REQ-09: Follow redirects off -> 3xx + Location; on -> final 200 (mock server redirect); replaces live-service redirects test
  11. E-REQ-10: Form-data with one disabled field (existing doc scenario) -> echo shows only enabled field
  12. E-REQ-11: Throwing pre-script -> error toast, request still runs, Console shows logs; post-script environment.set makes next {{token}} resolve
  13. E-REQ-12: Code-gen across all 9 languages contain method, URL, header, body; Copy to clipboard (helper reused by E-SET-02)
  14. E-REQ-13: Share button generates link; opening in new context restores request
  15. E-REQ-14: cURL pasted into URL bar populates tab + "cURL imported" toast; malformed cURL -> error toast, tab unchanged
  16. E-REQ-15: Response over display limit -> truncation message; Download gives full body (/large?bytes=)
  17. Doc-drift fixes owned by this task (SPEC section 9): requests.feature.md: add the 6 undocumented script scenarios already in `requests.spec.ts` (Scripts tab default, console.log, post-script status, header injection, json(), persistence); body.feature.md: 'Disable a form-data field' implemented by E-REQ-10; response.feature.md and auth.feature.md: verify each scenario maps 1:1 to a test title and add scenarios for the new e2e.
- **Acceptance**:
  - Scenario file(s) contain a scenario titled with each of: E-REQ-01, E-REQ-02, E-REQ-03, E-REQ-04, E-REQ-05, E-REQ-06, E-REQ-07, E-REQ-08, E-REQ-09, E-REQ-10, E-REQ-11, E-REQ-12, E-REQ-13, E-REQ-14, E-REQ-15
  - Doc drift fixes landed; every pre-existing scenario still maps 1:1 to a test title (or is flagged)
  - Reviewer batches applied; scenario summary table printed; user checkpoint answered
- **Verify**:
  - `grep -c '^## Scenario' e2e/scenarios/requests.feature.md e2e/scenarios/body.feature.md e2e/scenarios/response.feature.md e2e/scenarios/auth.feature.md`
  - `grep -n 'E-' e2e/scenarios/requests.feature.md (every listed ID present)`

### ✅ T3.13: SC5 tabs scenarios
- **Kind**: e2e  |  **PLAN**: P3.11
- **Files**: `e2e/scenarios/tabs.feature.md`
- **Depends on**: T3.7
- **Do**:
  1. Run the `/e2e scenarios tabs` command (defined in `~/.claude/commands/e2e.md`; its step 1 precondition is satisfied by T3.6). Prompt override for every step: scenario files stay in `e2e/scenarios/`, specs will live in `e2e/<area>.spec.ts` (NOT `e2e/tests/`), use `bunx playwright` never `npx`, new scenarios target the local mock server (`MOCK_BASE_URL`) with `x-test-id` isolation. Pass the E-* rows below as the candidate list so Explore discovery does not drift. Keep the command's user checkpoint (AskUserQuestion confirm/trim) and its batch review by `general-purpose` reviewers. Output: tags `@critical/@high/@medium`, `# evidence:` comments, and every scenario title starts with its E-* ID.
  2. E-TAB-01: 3 tabs, dropdown row click -> that tab active, popover closes
  3. E-TAB-02: Dirty + clean tabs, dropdown "Close all" -> bulk dialog with count; Cancel keeps all; Confirm clears
  4. E-TAB-03: Distinct names (rename via ctx menu), lowercase partial search -> only matches (case-insensitive)
  5. E-TAB-04: Dirty + other tab, ctx "Close Other Tabs" -> bulk dialog (Cancel and Close All)
  6. E-TAB-05: Reload restores same tabs (dirty edits lost, active = first)
  7. E-TAB-06: Dirty tab + Ctrl+W -> unsaved dialog
  8. E-TAB-07: Click a saved request in sidebar twice -> one tab, activated
  9. E-TAB-08: Ctrl+[ / Ctrl+] change active tab
  10. E-TAB-09: Drag tab 1 onto tab 3 -> order changes
  11. E-TAB-10: Dirty tab in dropdown shows blue dot; hover X closes with guard
  12. E-TAB-11: Last tab closed -> empty state, chevron gone
  13. E-TAB-12: Duplicate / Rename / Set Label from ctx menu reflected
  14. Doc-drift fixes owned by this task (SPEC section 9): Add dropdown select/Close all/search, bulk dialog, rename/duplicate/label, drag, shortcuts, reload; fix 'Close a dirty tab' (dialog offers Cancel/Close only, no Save option).
- **Acceptance**:
  - Scenario file(s) contain a scenario titled with each of: E-TAB-01, E-TAB-02, E-TAB-03, E-TAB-04, E-TAB-05, E-TAB-06, E-TAB-07, E-TAB-08, E-TAB-09, E-TAB-10, E-TAB-11, E-TAB-12
  - Doc drift fixes landed; every pre-existing scenario still maps 1:1 to a test title (or is flagged)
  - Reviewer batches applied; scenario summary table printed; user checkpoint answered
- **Verify**:
  - `grep -c '^## Scenario' e2e/scenarios/tabs.feature.md`
  - `grep -n 'E-' e2e/scenarios/tabs.feature.md (every listed ID present)`

### ✅ T3.14: SC6 settings scenarios
- **Kind**: e2e  |  **PLAN**: P3.12
- **Files**: `e2e/scenarios/settings.feature.md`
- **Depends on**: T3.7, T1.2
- **Do**:
  1. Run the `/e2e scenarios settings` command (defined in `~/.claude/commands/e2e.md`; its step 1 precondition is satisfied by T3.6). Prompt override for every step: scenario files stay in `e2e/scenarios/`, specs will live in `e2e/<area>.spec.ts` (NOT `e2e/tests/`), use `bunx playwright` never `npx`, new scenarios target the local mock server (`MOCK_BASE_URL`) with `x-test-id` isolation. Pass the E-* rows below as the candidate list so Explore discovery does not drift. Keep the command's user checkpoint (AskUserQuestion confirm/trim) and its batch review by `general-purpose` reviewers. Output: tags `@critical/@high/@medium`, `# evidence:` comments, and every scenario title starts with its E-* ID.
  2. E-SET-01: Health toggle off -> no health dot in collection row; on -> returns
  3. E-SET-02: Code-gen toggle on -> panel shows cURL; Python changes snippet; off hides (reuses E-REQ-12 helper)
  4. E-SET-03: Theme/accent/toggle persist after reload
  5. E-SET-04: Clear History confirm -> History tab empty; Cancel keeps entries
  6. E-SET-05: Language Francais -> reload -> html lang="fr" and French strings (B1)
  7. E-SET-07: Settings > General does not show a Restart Tour button (B2, D3)
  8. E-SET-08: Global base URL + header, relative-URL request hits base URL with header
  9. E-SET-09: Custom proxy URL -> /api/proxy payload contains proxyUrl
  10. E-SET-10: Sidebar icons navigate to /transform, /json-visualize, /json-compare; paste JSON -> result visible
  11. E-SET-11: SSL verify (B3, D5): request to mock server self-signed HTTPS listener fails with SSL verify ON and succeeds with it OFF
  12. Doc-drift fixes owned by this task (SPEC section 9): Shortcuts: doc says 3 groups, UI/e2e has 5 (fix doc); add General (default section), Global, Language, Clear History, concurrency pointer, code-gen, no Restart Tour button, SSL on/off.
- **Acceptance**:
  - Scenario file(s) contain a scenario titled with each of: E-SET-01, E-SET-02, E-SET-03, E-SET-04, E-SET-05, E-SET-07, E-SET-08, E-SET-09, E-SET-10, E-SET-11
  - Doc drift fixes landed; every pre-existing scenario still maps 1:1 to a test title (or is flagged)
  - Reviewer batches applied; scenario summary table printed; user checkpoint answered
- **Verify**:
  - `grep -c '^## Scenario' e2e/scenarios/settings.feature.md`
  - `grep -n 'E-' e2e/scenarios/settings.feature.md (every listed ID present)`

### ✅ T3.15: SC7 history / GraphQL / WebSocket / Socket.IO scenarios
- **Kind**: e2e  |  **PLAN**: P3.13
- **Files**: `e2e/scenarios/history.feature.md`; `e2e/scenarios/graphql.feature.md`; `e2e/scenarios/websocket.feature.md`; `e2e/scenarios/socketio.feature.md`
- **Depends on**: T3.7, T1.10
- **Do**:
  1. Run the `/e2e scenarios realtime (history, graphql, websocket, socketio)` command (defined in `~/.claude/commands/e2e.md`; its step 1 precondition is satisfied by T3.6). Prompt override for every step: scenario files stay in `e2e/scenarios/`, specs will live in `e2e/<area>.spec.ts` (NOT `e2e/tests/`), use `bunx playwright` never `npx`, new scenarios target the local mock server (`MOCK_BASE_URL`) with `x-test-id` isolation. Pass the E-* rows below as the candidate list so Explore discovery does not drift. Keep the command's user checkpoint (AskUserQuestion confirm/trim) and its batch review by `general-purpose` reviewers. Output: tags `@critical/@high/@medium`, `# evidence:` comments, and every scenario title starts with its E-* ID.
  2. E-RT-01: Per B9 (D1): a failed HTTP request appears in History and reopens as http tab; GraphQL send asserted NOT recorded
  3. E-RT-02: Socket.IO to unreachable URL -> error visible, Connect re-enabled (B6)
  4. E-RT-03: WS invalid URL -> error shown, no stuck "Connecting"
  5. E-RT-04: Connected WS tab closed -> server sees close (B7); same for Socket.IO in the Socket.IO task (E-RT-04b). Handshake headers out of scope (D2)
  6. E-RT-05: GraphQL header added -> Send -> server received it (documented, unimplemented "Set custom headers")
  7. E-RT-06: Schema explorer fetch against local GraphQL -> Query fields; clicking field inserts snippet
  8. E-RT-07: GraphQL server returns errors[] or 400 -> error status/body displayed
  9. E-RT-08: History sidebar search filters; clear restores; no-match state
  10. E-RT-09: Open history item with headers/body -> tab has them (and method)
  11. E-RT-10: WS connected, Clear in message log -> empty
  12. E-RT-11: Socket.IO custom event name -> sent entry; server echo received
  13. Doc-drift fixes owned by this task (SPEC section 9): history.feature.md: 'right-click > Delete' -> hover trash button, 'method, URL, status, duration' -> relative time (no duration), add failed-request recording (B9) and E-RT-08/09; graphql.feature.md: 'Set custom headers' implemented by E-RT-05, add errors and schema explorer; websocket/socketio: add new scenarios and verify 1:1 mapping. E-RT-04 is split: 04a (WebSocket) in websocket.feature.md, 04b (Socket.IO) in socketio.feature.md.
- **Acceptance**:
  - Scenario file(s) contain a scenario titled with each of: E-RT-01, E-RT-02, E-RT-03, E-RT-04, E-RT-05, E-RT-06, E-RT-07, E-RT-08, E-RT-09, E-RT-10, E-RT-11
  - Doc drift fixes landed; every pre-existing scenario still maps 1:1 to a test title (or is flagged)
  - Reviewer batches applied; scenario summary table printed; user checkpoint answered
- **Verify**:
  - `grep -c '^## Scenario' e2e/scenarios/history.feature.md e2e/scenarios/graphql.feature.md e2e/scenarios/websocket.feature.md e2e/scenarios/socketio.feature.md`
  - `grep -n 'E-' e2e/scenarios/history.feature.md (every listed ID present)`

### ☐ T3.16: 🔶 Scenario gate: all seven scenario areas written and reviewed
- **Kind**: gate  |  **PLAN**: Checkpoint SC
- **Files**: none (verification only)
- **Depends on**: T3.9, T3.10, T3.11, T3.12, T3.13, T3.14, T3.15
- **Do**:
  1. Print the scenario summary tables for all seven areas and confirm all reviewer fixes were applied.
  2. Confirm the 'ID in title' convention: every scenario title starts with its E-* ID, so `bunx playwright test --list` can prove parity later.
  3. Confirm no `/e2e write` has run yet and that both chain parity scripts still pass (`check-ids.sh`, `check-parity.sh`).
  4. Stop (AskUserQuestion): user reviews all seven areas before ANY test writing starts.
- **Acceptance**:
  - All seven scenario slices done and reviewed
  - Every E-* ID from SPEC section 7 appears in exactly one scenario title (E-RT-04 as 04a/04b)
  - Human approval recorded
- **Verify**:
  - `bash e2e/scenarios/chain/check-ids.sh`
  - `bash e2e/scenarios/chain/check-parity.sh`
  - `for id in $(grep -o 'E-[A-Z]*-[0-9]*[ab]*' agent_docs/test-coverage-gaps/SPEC.md | sort -u); do grep -rqF "$id" e2e/scenarios/*.feature.md || echo "MISSING $id"; done (expect no output)`
  - `bun run lint:check`

### ✅ T3.17: W1 import e2e (new spec)
- **Kind**: e2e  |  **PLAN**: P3.14
- **Files**: `e2e/scenarios/import.feature.md`; `e2e/import.spec.ts`; `e2e/fixtures/import/ (fixture files)`
- **Depends on**: T3.16, T3.7
- **Do**:
  1. Run `/e2e write e2e/scenarios/import.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/import.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-COL-01: Import Postman v2.1 with nested folders via Import dialog -> collection, folders, requests in tree with nesting (new e2e/import.spec.ts)
  3. E-COL-02: Import non-parsable file -> error shown, sidebar unchanged
  4. E-COL-06: Import Insomnia and OpenAPI (JSON and YAML), cURL via dialog populates a new tab
  5. Create fixture files for Postman v2.1 (nested folders), non-parsable, Insomnia, OpenAPI JSON and YAML, cURL under `e2e/fixtures/`.
  6. Close this task only when `bunx playwright test e2e/import.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-COL-01, E-COL-02, E-COL-06 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/import.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/import.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.18: W2 collections e2e
- **Kind**: e2e  |  **PLAN**: P3.15
- **Files**: `e2e/scenarios/collections.feature.md`; `e2e/collections.spec.ts`; `e2e/fixtures/sidebarSearch.ts (helper)`
- **Depends on**: T3.17
- **Do**:
  1. Run `/e2e write e2e/scenarios/collections.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/collections.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-COL-03: Folder CRUD: New Folder, rename, add request, duplicate, delete (children removed)
  3. E-COL-04: Sidebar search: matching groups; click opens/activates tab; no-results; clear (X)
  4. E-COL-05: "+" menu parametrized: HTTP, GraphQL, WebSocket, Socket.IO, Collection, Environment, Chain, Import
  5. E-COL-07: Reload persistence: collapsed folder, collapsed section, collections
  6. E-COL-08: Request actions from sidebar menu: rename, duplicate "(copy)", Export as Postman (download event), Copy as cURL (clipboard)
  7. E-COL-09: Collection "Export as Postman" -> valid .json download with folders/requests
  8. Introduce a reusable sidebar-search helper (reused by W8/E-CHN-06). Replace unscoped locators only in tests being rewritten.
  9. Close this task only when `bunx playwright test e2e/collections.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-COL-03, E-COL-04, E-COL-05, E-COL-07, E-COL-08, E-COL-09 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/collections.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/collections.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.19: W3 environments e2e
- **Kind**: e2e  |  **PLAN**: P3.16
- **Files**: `e2e/scenarios/environments.feature.md`; `e2e/environments.spec.ts`
- **Depends on**: T3.18, T1.12
- **Do**:
  1. Run `/e2e write e2e/scenarios/environments.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/environments.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-ENV-01: Active env Dev token=abc123, header Authorization: Bearer {{token}}, send -> echo shows Bearer abc123
  3. E-ENV-02: Env list, variables and active env persist after reload
  4. E-ENV-03: {{baseUrl}} highlighted resolved vs unresolved; unresolved send shows warning with "send anyway"
  5. E-ENV-04: Paste multi-line KEY=value into a cell -> rows created, success toast
  6. E-ENV-05: Import .env via setInputFiles on import-env-btn input -> variables listed
  7. E-ENV-06: Delete the active env -> selector shows "No Environment"
  8. E-ENV-07: Creating or renaming an env to an existing name (any case, surrounding spaces) shows inline error and does not save (B10); replaces old duplicate-names scenario; legacy-duplicates seed (two "GitHub" in IndexedDB) still loads and both are selectable
  9. E-ENV-08: Empty name committed on rename/create -> default name
  10. E-ENV-09: Variable in JSON body and bearer auth -> resolved values reach the server
  11. E-ENV-10: Sidebar "+" -> Environment, type name, env appears, click -> Active badge
  12. E-ENV-11: initial=A, current=B -> request uses B; clearing current -> A
  13. E-ENV-12: (maintenance) adjust existing env e2e that relied on duplicate names or name-based testids (env-list-item-<name>) to use unique names / id-based testids
  14. E-ENV-12 maintenance: replace duplicate-name / `env-list-item-<name>` reliance with unique names or id-based testids. If one session cannot hold 12 tests, split by the scenario file's groups but keep single-file ordering.
  15. Close this task only when `bunx playwright test e2e/environments.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-ENV-01, E-ENV-02, E-ENV-03, E-ENV-04, E-ENV-05, E-ENV-06, E-ENV-07, E-ENV-08, E-ENV-09, E-ENV-10, E-ENV-11, E-ENV-12 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/environments.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/environments.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.20: W4 requests e2e (largest)
- **Kind**: e2e  |  **PLAN**: P3.17
- **Files**: `e2e/scenarios/requests.feature.md`; `e2e/requests.spec.ts`; `e2e/fixtures/codeGenHelper.ts`
- **Depends on**: T3.19
- **Do**:
  1. Run `/e2e write e2e/scenarios/requests.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/requests.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-REQ-01: Edit URL of saved request, Cmd/Ctrl+S -> dirty dot gone, success toast, edit persists on reopen
  3. E-REQ-02: Breadcrumb "New Request > unsaved"; after save "<Collection> > <name>"
  4. E-REQ-03: Short timeout in Advanced vs slow endpoint -> timeout error state (not generic network error)
  5. E-REQ-04: Disabled header/param is NOT received by echo (rewrites weak "Disable ..." tests)
  6. E-REQ-05: Undefined {{baseUrl}} -> warning; "Send anyway" dispatches; with active env resolves in URL, header, body, auth
  7. E-REQ-06: Cancelled request returns UI to idle (no failure state), resend works (rewrites "Cancel an in-flight request", which currently expects an error)
  8. E-REQ-07: Method menu lists 7 methods with checkmark; HEAD returns headers, empty body, 200
  9. E-REQ-08: ?a=1&a=2&b= -> three rows; edit updates URL; %20/unicode round-trip
  10. E-REQ-09: Follow redirects off -> 3xx + Location; on -> final 200 (mock server redirect); replaces live-service redirects test
  11. E-REQ-11: Throwing pre-script -> error toast, request still runs, Console shows logs; post-script environment.set makes next {{token}} resolve
  12. E-REQ-12: Code-gen across all 9 languages contain method, URL, header, body; Copy to clipboard (helper reused by E-SET-02)
  13. E-REQ-13: Share button generates link; opening in new context restores request
  14. E-REQ-14: cURL pasted into URL bar populates tab + "cURL imported" toast; malformed cURL -> error toast, tab unchanged
  15. Includes rewrites of the weak 'Disable ...' tests and 'Cancel an in-flight request'; E-REQ-09 replaces the live-service redirects test; E-REQ-13 opens the share link in a new browser context. Keep the E-REQ-12 code-gen helper in a shared fixture for W9.
  16. Close this task only when `bunx playwright test e2e/requests.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-REQ-01, E-REQ-02, E-REQ-03, E-REQ-04, E-REQ-05, E-REQ-06, E-REQ-07, E-REQ-08, E-REQ-09, E-REQ-11, E-REQ-12, E-REQ-13, E-REQ-14 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/requests.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/requests.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.21: W5 body e2e
- **Kind**: e2e  |  **PLAN**: P3.18
- **Files**: `e2e/scenarios/body.feature.md`; `e2e/body.spec.ts`
- **Depends on**: T3.20
- **Do**:
  1. Run `/e2e write e2e/scenarios/body.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/body.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-REQ-10: Form-data with one disabled field (existing doc scenario) -> echo shows only enabled field
  3. Close this task only when `bunx playwright test e2e/body.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-REQ-10 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/body.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/body.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.22: W6 response e2e
- **Kind**: e2e  |  **PLAN**: P3.19
- **Files**: `e2e/scenarios/response.feature.md`; `e2e/response.spec.ts`
- **Depends on**: T3.20
- **Do**:
  1. Run `/e2e write e2e/scenarios/response.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/response.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-REQ-15: Response over display limit -> truncation message; Download gives full body (/large?bytes=)
  3. Use mock `/large?bytes=` for the display-limit and Download assertions.
  4. Close this task only when `bunx playwright test e2e/response.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-REQ-15 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/response.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/response.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.23: W7 tabs e2e
- **Kind**: e2e  |  **PLAN**: P3.20
- **Files**: `e2e/scenarios/tabs.feature.md`; `e2e/tabs.spec.ts`
- **Depends on**: T3.22, T1.6
- **Do**:
  1. Run `/e2e write e2e/scenarios/tabs.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/tabs.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-TAB-01: 3 tabs, dropdown row click -> that tab active, popover closes
  3. E-TAB-02: Dirty + clean tabs, dropdown "Close all" -> bulk dialog with count; Cancel keeps all; Confirm clears
  4. E-TAB-03: Distinct names (rename via ctx menu), lowercase partial search -> only matches (case-insensitive)
  5. E-TAB-04: Dirty + other tab, ctx "Close Other Tabs" -> bulk dialog (Cancel and Close All)
  6. E-TAB-05: Reload restores same tabs (dirty edits lost, active = first)
  7. E-TAB-06: Dirty tab + Ctrl+W -> unsaved dialog
  8. E-TAB-07: Click a saved request in sidebar twice -> one tab, activated
  9. E-TAB-08: Ctrl+[ / Ctrl+] change active tab
  10. E-TAB-09: Drag tab 1 onto tab 3 -> order changes
  11. E-TAB-10: Dirty tab in dropdown shows blue dot; hover X closes with guard
  12. E-TAB-11: Last tab closed -> empty state, chevron gone
  13. E-TAB-12: Duplicate / Rename / Set Label from ctx menu reflected
  14. Switch the class selectors `span.bg-method-accent` / `span.bg-orange-400` to the `tab-dirty-indicator` testid when touched.
  15. Close this task only when `bunx playwright test e2e/tabs.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-TAB-01, E-TAB-02, E-TAB-03, E-TAB-04, E-TAB-05, E-TAB-06, E-TAB-07, E-TAB-08, E-TAB-09, E-TAB-10, E-TAB-11, E-TAB-12 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/tabs.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/tabs.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.24: W8 chain e2e (E-CHN-*, existing chain.spec.ts)
- **Kind**: e2e  |  **PLAN**: P3.21
- **Files**: `e2e/scenarios/chain.feature.md`; `e2e/chain.spec.ts`
- **Depends on**: T3.23, T3.18
- **Do**:
  1. Run `/e2e write e2e/scenarios/chain.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/chain.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-CHN-01: Settings concurrency input (D6): 0 / 99 / -3 clamp to 1..8; "abc" ignored; cleared while typing allowed and blur reverts to last valid value; default 4 on fresh profile; persists after reload
  3. E-CHN-02: Concurrency 2 with 4 independent slow requests -> exactly 2 lanes overlap, never 3+ (mock server delay, overlap from server-side timestamps)
  4. E-CHN-03: Cyclic chain: Run blocked, banner names cycle nodes
  5. E-CHN-04: Concurrency 1 with Loop body and Sub-chain: still run; outer lanes obey setting
  6. E-CHN-05: Forced migration failure (init script) -> Retry / Open read-only recovers
  7. E-CHN-06: Sidebar search by chain name shows only matching chains (shares helper with E-COL-04)
  8. E-CHN-07: Rename chain to empty or duplicate name -> old name kept or error shown
  9. E-SET-06: (pointer) concurrency, built by E-CHN-01
  10. E-CHN-02/04 use the real proxy + mock `delay` + server-side timestamps (per `x-test-id` namespace); E-CHN-05 via init-script migration failure; E-CHN-06 reuses the W2 sidebar-search helper; E-SET-06 is a pointer to E-CHN-01. Do NOT edit parity-checked `e2e/qa/chain-e2e-*.spec.ts`; run `bash e2e/scenarios/chain/check-ids.sh` afterwards.
  11. Close this task only when `bunx playwright test e2e/chain.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-CHN-01, E-CHN-02, E-CHN-03, E-CHN-04, E-CHN-05, E-CHN-06, E-CHN-07, E-SET-06 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/chain.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/chain.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.25: W9 settings e2e
- **Kind**: e2e  |  **PLAN**: P3.22
- **Files**: `e2e/scenarios/settings.feature.md`; `e2e/settings.spec.ts`
- **Depends on**: T3.24, T1.1, T1.2, T1.4, T3.20
- **Do**:
  1. Run `/e2e write e2e/scenarios/settings.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/settings.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-SET-01: Health toggle off -> no health dot in collection row; on -> returns
  3. E-SET-02: Code-gen toggle on -> panel shows cURL; Python changes snippet; off hides (reuses E-REQ-12 helper)
  4. E-SET-03: Theme/accent/toggle persist after reload
  5. E-SET-04: Clear History confirm -> History tab empty; Cancel keeps entries
  6. E-SET-05: Language Francais -> reload -> html lang="fr" and French strings (B1)
  7. E-SET-07: Settings > General does not show a Restart Tour button (B2, D3)
  8. E-SET-08: Global base URL + header, relative-URL request hits base URL with header
  9. E-SET-09: Custom proxy URL -> /api/proxy payload contains proxyUrl
  10. E-SET-10: Sidebar icons navigate to /transform, /json-visualize, /json-compare; paste JSON -> result visible
  11. E-SET-11: SSL verify (B3, D5): request to mock server self-signed HTTPS listener fails with SSL verify ON and succeeds with it OFF
  12. Replace the SSL toggle test with E-SET-11 against `https://127.0.0.1:3334` (fails with SSL verify ON, succeeds OFF); loosen the brittle shortcut-group assertion to required groups; the redirects test moved to E-REQ-09; E-SET-02 reuses the W4 code-gen helper.
  13. Close this task only when `bunx playwright test e2e/settings.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-SET-01, E-SET-02, E-SET-03, E-SET-04, E-SET-05, E-SET-07, E-SET-08, E-SET-09, E-SET-10, E-SET-11 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/settings.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/settings.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.26: W10 history e2e
- **Kind**: e2e  |  **PLAN**: P3.23
- **Files**: `e2e/scenarios/history.feature.md`; `e2e/history.spec.ts`
- **Depends on**: T3.25, T1.10
- **Do**:
  1. Run `/e2e write e2e/scenarios/history.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/history.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-RT-01: Per B9 (D1): a failed HTTP request appears in History and reopens as http tab; GraphQL send asserted NOT recorded
  3. E-RT-08: History sidebar search filters; clear restores; no-match state
  4. E-RT-09: Open history item with headers/body -> tab has them (and method)
  5. E-RT-01 also asserts a GraphQL send is NOT recorded.
  6. Close this task only when `bunx playwright test e2e/history.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-RT-01, E-RT-08, E-RT-09 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/history.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/history.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.27: W11 graphql e2e
- **Kind**: e2e  |  **PLAN**: P3.24
- **Files**: `e2e/scenarios/graphql.feature.md`; `e2e/graphql.spec.ts`
- **Depends on**: T3.26, T3.3
- **Do**:
  1. Run `/e2e write e2e/scenarios/graphql.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/graphql.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-RT-05: GraphQL header added -> Send -> server received it (documented, unimplemented "Set custom headers")
  3. E-RT-06: Schema explorer fetch against local GraphQL -> Query fields; clicking field inserts snippet
  4. E-RT-07: GraphQL server returns errors[] or 400 -> error status/body displayed
  5. Use the local `/graphql` mock; no trevorblades.
  6. Close this task only when `bunx playwright test e2e/graphql.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-RT-05, E-RT-06, E-RT-07 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/graphql.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/graphql.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.28: W12 websocket e2e (E-RT-04a)
- **Kind**: e2e  |  **PLAN**: P3.25
- **Files**: `e2e/scenarios/websocket.feature.md`; `e2e/websocket.spec.ts`
- **Depends on**: T3.27, T1.8, T3.3
- **Do**:
  1. Run `/e2e write e2e/scenarios/websocket.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/websocket.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-RT-03: WS invalid URL -> error shown, no stuck "Connecting"
  3. E-RT-04: Connected WS tab closed -> server sees close (B7); same for Socket.IO in the Socket.IO task (E-RT-04b). Handshake headers out of scope (D2)
  4. E-RT-10: WS connected, Clear in message log -> empty
  5. E-RT-04a (WebSocket half): server-side close observed via `/__requests?testId=` with `expect.poll`; no sleeps.
  6. Close this task only when `bunx playwright test e2e/websocket.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-RT-03, E-RT-04, E-RT-10 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/websocket.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/websocket.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.29: W13 socketio e2e (E-RT-04b)
- **Kind**: e2e  |  **PLAN**: P3.26
- **Files**: `e2e/scenarios/socketio.feature.md`; `e2e/socketio.spec.ts`
- **Depends on**: T3.28, T1.7, T1.8
- **Do**:
  1. Run `/e2e write e2e/scenarios/socketio.feature.md` (defined in `~/.claude/commands/e2e.md`) for THIS ONE scenario file only. Execute sequentially: never in parallel, never `/e2e all`. It spawns the `e2e-engineer` agent. Prompt override: the spec path is `e2e/socketio.spec.ts` (NOT `e2e/tests/`); use `bunx playwright`, never `npx`; use the local mock server (`MOCK_BASE_URL`) and `x-test-id` isolation, no live external hosts; no `waitForTimeout`; testid/role locators; each `test()` title starts with its E-* ID; report app bugs instead of weakening tests. Relay the agent's report verbatim (App bugs and Scenario issues).
  2. E-RT-02: Socket.IO to unreachable URL -> error visible, Connect re-enabled (B6)
  3. E-RT-11: Socket.IO custom event name -> sent entry; server echo received
  4. E-RT-04b (Socket.IO half of E-RT-04, owned by the W12 task for traceability): server sees disconnect after tab close. Existing tests use `SOCKETIO_TEST_URL` and stay.
  5. Close this task only when `bunx playwright test e2e/socketio.spec.ts --repeat-each=3` is green; do not start the next write task before.
- **Acceptance**:
  - Each of E-RT-02, E-RT-11 has a test whose title starts with its ID
  - Green with --repeat-each=3 (workers stay at 2); flaky tests fixed, not retried-away
  - No `waitForTimeout`; no dummyjson/httpbin/echo.websocket.org/trevorblades in new or rewritten tests
- **Verify**:
  - `bunx playwright test e2e/socketio.spec.ts --repeat-each=3`
  - `grep -n waitForTimeout e2e/socketio.spec.ts (expect none in new/changed tests)`
  - `bun run lint:check`

### ✅ T3.30: 🔶 Checkpoint 3: Phase 3 gate
- **Kind**: gate  |  **PLAN**: P3.27
- **Files**: none (verification only)
- **Depends on**: T3.29
- **Do**:
  1. Run the full e2e suite (workers 2) once, then once more with `--repeat-each=2` to flush flakiness; fix (do not retry away) any flaky test.
  2. Hygiene greps: no `waitForTimeout` in new/changed tests; no new reference to dummyjson/httpbin/echo.websocket.org/trevorblades.
  3. Both chain parity scripts pass (`check-parity.sh` was fixed in T3.1); the seeded QA specs (including T3.8) are green.
  4. Stop for human review before Phase 4 (AskUserQuestion).
- **Acceptance**:
  - Full e2e green twice; lint and typecheck green
  - Hygiene greps clean; chain parity ok
  - Human approval recorded
- **Verify**:
  - `bun run test:e2e`
  - `bunx playwright test --repeat-each=2`
  - `bun run test:qa`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bash e2e/scenarios/chain/check-ids.sh`
  - `bash e2e/scenarios/chain/check-parity.sh`
  - `grep -rn waitForTimeout e2e/*.spec.ts (only pre-existing, untouched files allowed)`
- **Gate note (2026-10-10)**: Human approval recorded with exceptions. SKIPPED by user instruction: full `test:e2e`, `--repeat-each=2` full run, `test:qa`. `check-ids.sh` not exercised (`agent_docs/chain-e2e/SPEC.md` missing). Passed: lint, typecheck, check-parity (285/285), hygiene greps, and the nine T3.21–T3.29 specs at `--repeat-each=3`. Open app bugs held as `test.fail()`: E-REQ-10, E-TAB-05, E-CHN-07, E-SET-02, E-SET-09, E-SET-11, E-RT-03.


## Phase 4: Cleanup and final re-audit

### ✅ T4.1: Verify the check-parity.sh fix still holds (fixed in T3.1)
- **Kind**: implementation  |  **PLAN**: P4.1
- **Files**: none (verification only)
- **Depends on**: T3.30
- **Do**:
  1. Re-run both chain parity scripts against the final state and re-run the two forced-failure probes from T3.1 to confirm the reason-printing behavior survived Phase 3. No edit is expected; if a regression is found, fix it in `e2e/scenarios/chain/check-parity.sh` and note it in the Bug Log.
- **Acceptance**:
  - Success path reports 285/285 or higher
  - Forced failures still print `FAILED: <step>` with a reason
- **Verify**:
  - `bash e2e/scenarios/chain/check-parity.sh (expect 285/285 or higher)`
  - `bash e2e/scenarios/chain/check-ids.sh`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:1 bash e2e/scenarios/chain/check-parity.sh (expect FAILED: <step> output)`
  - `PATH=/usr/bin:/bin bash e2e/scenarios/chain/check-parity.sh (expect a reason)`

### ✅ T4.2: E2E docs lint: scenario IDs vs test titles, both directions
- **Kind**: implementation  |  **PLAN**: P4.2
- **Files**: `e2e/scenarios/*.feature.md (edit only if drift is found)`
- **Depends on**: T4.1
- **Do**:
  1. Run a check script (via ctx_execute) over `bunx playwright test --list` and `grep '^## Scenario'` to prove every E-* scenario in a `.feature.md` maps to exactly one test title and vice versa. Extend `check-parity.sh` only if trivial.
  2. Verify the SPEC section 9 items owned by the SC tasks (T3.9-T3.15) all landed; fix drift in the `.feature.md` if found.
- **Acceptance**:
  - Zero unmatched E-* IDs in both directions (E-RT-04 as 04a/04b)
  - All SPEC section 9 drift items confirmed landed
- **Verify**:
  - `bunx playwright test --list | grep -o 'E-[A-Z]*-[0-9]*[ab]*' | sort | uniq -c (each ID once)`
  - `grep -rho 'E-[A-Z]*-[0-9]*[ab]*' e2e/scenarios/*.feature.md | sort -u`

### ✅ T4.3: Bug Log and PR description draft
- **Kind**: implementation  |  **PLAN**: P4.3
- **Files**: none (verification only)
- **Depends on**: T4.2
- **Do**:
  1. Finalize the Bug Log (B1-B10 status: fixed with red->green, or not reproducible and dropped) and draft the PR description (summary, bug log, test counts, known limitations D2/D8). Emit it in the final message / scratchpad; NO new repo doc. Do not commit or open the PR unless told.
- **Acceptance**:
  - All ten bugs have a status in the Bug Log
  - PR description draft exists outside the repo
- **Verify**:
  - `git status --short (no new repo doc)`

### ✅ T4.4: Final re-audit: list of still-uncovered items
- **Kind**: implementation  |  **PLAN**: P4.4
- **Files**: none (verification only)
- **Depends on**: T4.3
- **Do**:
  1. Re-run the seven area checks (per the audit method in `agent_docs/test-coverage-gaps/audit/`) against the final state; produce the 'still uncovered' list split into 'Low follow-up' and 'new' for the PR description (not a repo doc unless asked).
- **Acceptance**:
  - Every High+Medium item shown covered; remaining list split Low follow-up vs new
- **Verify**:
  - `graphify-assisted or grep-based re-audit report (in the final message)`

### ✅ T4.5: 🔶 Checkpoint 4: final gate (Definition of Done)
- **Kind**: dod  |  **PLAN**: Checkpoint 4
- **Files**: none (verification only)
- **Depends on**: T4.4
- **Do**:
  1. Run every suite and the parity scripts; confirm SPEC section 1 success criteria 1-6 each hold (list the evidence per criterion).
  2. Run the traceability script check from this file's last section; confirm zero gaps.
  3. Human approval, then ONLY if told: commit and open the single PR from `feature/ai-agent`.
- **Acceptance**:
  - `bun run test`, `bun run test:e2e`, lint, typecheck green
  - check-ids.sh and check-parity.sh pass (285/285 or higher)
  - Success criteria 1-6 hold; human approval recorded
- **Verify**:
  - `bun run test`
  - `bun run test:e2e`
  - `bun run test:qa`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bash e2e/scenarios/chain/check-ids.sh`
  - `bash e2e/scenarios/chain/check-parity.sh`

## Traceability table

Every SPEC/PLAN item maps to exactly one task. Pointer items (U-SET-01/07/12/13, U-RT-10/13, E-SET-06) are built by their owner's task; E-RT-04 is owned by the WebSocket write task, whose Socket.IO half (E-RT-04b) is carried out inside the Socket.IO write task.

| Spec ID | Task |
|---|---|
| B1 | T1.1 |
| B2 | T1.2 |
| B3 | T1.4 |
| B4 | T1.5 |
| B5 | T1.6 |
| B6 | T1.7 |
| B7 | T1.8 |
| B8 | T1.9 |
| B9 | T1.10 |
| B10 | T1.11 |
| E-CHN-01 | T3.24 |
| E-CHN-02 | T3.24 |
| E-CHN-03 | T3.24 |
| E-CHN-04 | T3.24 |
| E-CHN-05 | T3.24 |
| E-CHN-06 | T3.24 |
| E-CHN-07 | T3.24 |
| E-COL-01 | T3.17 |
| E-COL-02 | T3.17 |
| E-COL-03 | T3.18 |
| E-COL-04 | T3.18 |
| E-COL-05 | T3.18 |
| E-COL-06 | T3.17 |
| E-COL-07 | T3.18 |
| E-COL-08 | T3.18 |
| E-COL-09 | T3.18 |
| E-ENV-01 | T3.19 |
| E-ENV-02 | T3.19 |
| E-ENV-03 | T3.19 |
| E-ENV-04 | T3.19 |
| E-ENV-05 | T3.19 |
| E-ENV-06 | T3.19 |
| E-ENV-07 | T3.19 |
| E-ENV-08 | T3.19 |
| E-ENV-09 | T3.19 |
| E-ENV-10 | T3.19 |
| E-ENV-11 | T3.19 |
| E-ENV-12 | T3.19 |
| E-REQ-01 | T3.20 |
| E-REQ-02 | T3.20 |
| E-REQ-03 | T3.20 |
| E-REQ-04 | T3.20 |
| E-REQ-05 | T3.20 |
| E-REQ-06 | T3.20 |
| E-REQ-07 | T3.20 |
| E-REQ-08 | T3.20 |
| E-REQ-09 | T3.20 |
| E-REQ-10 | T3.21 |
| E-REQ-11 | T3.20 |
| E-REQ-12 | T3.20 |
| E-REQ-13 | T3.20 |
| E-REQ-14 | T3.20 |
| E-REQ-15 | T3.22 |
| E-RT-01 | T3.26 |
| E-RT-02 | T3.29 |
| E-RT-03 | T3.28 |
| E-RT-04 | T3.28 |
| E-RT-05 | T3.27 |
| E-RT-06 | T3.27 |
| E-RT-07 | T3.27 |
| E-RT-08 | T3.26 |
| E-RT-09 | T3.26 |
| E-RT-10 | T3.28 |
| E-RT-11 | T3.29 |
| E-SET-01 | T3.25 |
| E-SET-02 | T3.25 |
| E-SET-03 | T3.25 |
| E-SET-04 | T3.25 |
| E-SET-05 | T3.25 |
| E-SET-06 | T3.24 |
| E-SET-07 | T3.25 |
| E-SET-08 | T3.25 |
| E-SET-09 | T3.25 |
| E-SET-10 | T3.25 |
| E-SET-11 | T3.25 |
| E-TAB-01 | T3.23 |
| E-TAB-02 | T3.23 |
| E-TAB-03 | T3.23 |
| E-TAB-04 | T3.23 |
| E-TAB-05 | T3.23 |
| E-TAB-06 | T3.23 |
| E-TAB-07 | T3.23 |
| E-TAB-08 | T3.23 |
| E-TAB-09 | T3.23 |
| E-TAB-10 | T3.23 |
| E-TAB-11 | T3.23 |
| E-TAB-12 | T3.23 |
| U-CHN-01 | T2.11 |
| U-CHN-02 | T2.12 |
| U-CHN-03 | T2.11 |
| U-CHN-04 | T2.13 |
| U-CHN-05 | T2.13 |
| U-CHN-06 | T2.14 |
| U-CHN-07 | T2.15 |
| U-CHN-08 | T2.16 |
| U-CHN-09 | T2.11 |
| U-COL-01 | T2.5 |
| U-COL-02 | T2.6 |
| U-COL-03 | T2.6 |
| U-COL-04 | T2.6 |
| U-COL-05 | T2.7 |
| U-COL-06 | T2.8 |
| U-COL-07 | T2.8 |
| U-COL-08 | T2.5 |
| U-COL-09 | T2.9 |
| U-COL-10 | T2.9 |
| U-COL-11 | T2.8 |
| U-COL-12 | T2.10 |
| U-COL-13 | T2.7 |
| U-ENV-01 | T2.1 |
| U-ENV-02 | T2.1 |
| U-ENV-03 | T2.2 |
| U-ENV-04 | T2.3 |
| U-ENV-05 | T2.3 |
| U-ENV-06 | T2.3 |
| U-ENV-07 | T2.2 |
| U-ENV-08 | T2.2 |
| U-ENV-09 | T2.1 |
| U-ENV-10 | T2.2 |
| U-ENV-11 | T2.8 |
| U-ENV-12 | T2.4 |
| U-ENV-13 | T2.3 |
| U-ENV-14 | T2.3 |
| U-ENV-15 | T1.12 |
| U-REQ-01 | T2.17 |
| U-REQ-02 | T2.17 |
| U-REQ-03 | T2.18 |
| U-REQ-04 | T2.18 |
| U-REQ-05 | T2.17 |
| U-REQ-06 | T2.19 |
| U-REQ-07 | T2.19 |
| U-REQ-08 | T2.21 |
| U-REQ-09 | T2.21 |
| U-REQ-10 | T2.21 |
| U-REQ-11 | T2.22 |
| U-REQ-12 | T2.20 |
| U-REQ-13 | T2.20 |
| U-REQ-14 | T2.22 |
| U-REQ-15 | T2.25 |
| U-REQ-16 | T2.21 |
| U-REQ-17 | T2.21 |
| U-REQ-18 | T2.22 |
| U-RT-01 | T2.28 |
| U-RT-02 | T2.28 |
| U-RT-03 | T2.29 |
| U-RT-04 | T2.30 |
| U-RT-05 | T2.29 |
| U-RT-06 | T2.28 |
| U-RT-07 | T2.30 |
| U-RT-08 | T2.29 |
| U-RT-09 | T2.29 |
| U-RT-10 | T2.26 |
| U-RT-11 | T2.30 |
| U-RT-12 | T2.30 |
| U-RT-13 | T2.24 |
| U-SET-01 | T2.22 |
| U-SET-02 | T1.1 |
| U-SET-03 | T2.12 |
| U-SET-04 | T2.26 |
| U-SET-06 | T2.27 |
| U-SET-07 | T2.4 |
| U-SET-08 | T2.26 |
| U-SET-09 | T2.27 |
| U-SET-10 | T2.26 |
| U-SET-11 | T2.26 |
| U-SET-12 | T2.8 |
| U-SET-13 | T2.7 |
| U-SET-14 | T2.12 |
| U-SET-15 | T2.27 |
| U-TAB-01 | T2.23 |
| U-TAB-02 | T2.23 |
| U-TAB-03 | T2.23 |
| U-TAB-04 | T2.24 |
| U-TAB-05 | T2.24 |
| U-TAB-06 | T2.24 |
| U-TAB-07 | T2.23 |
| U-TAB-08 | T2.23 |
| U-TAB-09 | T2.24 |
| U-TAB-10 | T2.25 |
| BUGLOG | T4.3 |
| CP | T3.1 |
| D-AUTH | T3.12 |
| D-BODY | T3.12 |
| D-COL | T3.10 |
| D-ENV | T3.9 |
| D-GQL | T3.15 |
| D-HIST | T3.15 |
| D-IMPORT | T3.10 |
| D-REQ | T3.12 |
| D-RESP | T3.12 |
| D-SET | T3.14 |
| D-SIO | T3.15 |
| D-TAB | T3.13 |
| D-WS | T3.15 |
| DOCLINT | T4.2 |
| REAUDIT | T4.4 |

Phase-4 cleanup keys: D-<AREA> = SPEC section 9 doc-drift item of that `.feature.md` (landed in the Phase 3 scenario tasks, verified by T4.2); CP = check-parity.sh fix; DOCLINT = E2E docs lint; BUGLOG = Bug Log; REAUDIT = final re-audit.



### Support tasks without a SPEC ID
| Task | Purpose |
|---|---|
| T1.3 | B2 follow-up: dead-code removal only (SPEC D3) |
| T1.13, T2.31, T3.7, T3.16, T3.30, T4.5 | Checkpoints / gates |
| T3.1 | check-parity.sh silent-exit fix (SPEC section 9, moved to the start of Phase 3; T4.1 only re-verifies) |
| T3.2-T3.6 | Mock server and e2e infra (SPEC section 8, D4, D5) |
| T3.8 | Seeded QA verification of UI-visible Phase 1 fixes (planner.md rule; user-approved move out of Phase 1) |
| T3.11 | SC3 chain scenarios (E-CHN-*, E-SET-06 pointer) |
