# Tasks: Relay v2 (Bug Fixes, Sidebar, Conversation, Composer, Backup, Tools, Grok STT)

Inputs: `SPEC.md` (61 requirement ids, authoritative), `PLAN.md` (40 slices, Phases 0 to 8) and `CONTEXT.md` (code findings), all in this folder. Planning artifact only; no feature code is written by this document. Commands: `bun`/`bunx` only, never `npm`. Never start the dev server (it is always running at `https://requestly.localhost/app`). Commits: only the `/build-phases` orchestrator, after the independent verifier PASS, one commit per phase. Task-authoring rules come from `~/.claude/docs/task-conventions.md`.

## Conventions

- **Kinds.** `implementation` (feature code; updates the existing unit specs of the files it touches so they stay green, writes no new specs), `unit` (unit-test-engineer, new coverage), `e2e` (e2e-engineer, new or migrated Playwright specs), `gate` (baseline or checkpoint), `walkthrough`, `dod`. Order inside a phase is implementation, then `Unit:`, then `E2E:`, then the checkpoint gate. Test authors are never the feature authors.
- **Files rule.** At most 5 real files per task. `(new)` marks a file the task creates; `(delete)` marks a file it removes. `messages/{en,fr,ja}/<ns>.json` counts as three files. Every other cited path was checked with `ls`/`grep` when this file was written or is created by an earlier task.
- **Design process (UI tasks).** A task that creates or changes visible UI carries a **Design** field naming the skills the PLAN assigns and its first Do step is "run the design skill(s), record the decision in the task Log, then implement". Phase-by-phase skills: method dropdown, live header, Worked group, neutral pills, empty state and capabilities popover use `impeccable` then `layout`; the changes summary and tool cards use `layout`; backup export and import UI use `ui-ux-pro-max` first, then `impeccable` and `layout` for the final output. Implement with shadcn primitives and design tokens only (no hard-coded colours; named constants for sizes, timings, percents), and save agent-browser screenshots (start with `--init-script e2e/fixtures/qa-seed.init.js`) at 1440px and 320px panel width, light and dark, to `agent_docs/qa/relay-v2/<task>-<width>-<theme>.png`. Screenshots are visual evidence only; behavioural proof comes from the seeded Playwright specs. Logic-only tasks state "Design: n/a" and name the task that carries the gate.
- **Browser proof.** Implementation tasks claim only what their own Verify proves (biome, targeted vitest, existing specs). Behaviour that needs a browser is cross-referenced to the E2E task that proves it. Spec files live in `e2e/qa/relay/relay-v2-<area>.spec.ts` with Gherkin in `e2e/scenarios/relay/relay-v2-<area>.feature.md`, ids `REL-V2-<AREA>-nn`, `@qa`, `seededPage`, the model mocked at `/api/relay/chat` through `e2e/fixtures/relayRoutes.ts`, `getByTestId` first, web-first assertions, no `waitForTimeout`.
- **E2E run command.** Always the already-running server, never the full suite: `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test <specs>`. `E2E:` tasks verify with `--repeat-each=3`; gates and the walkthrough use `--repeat-each=2`. Scenario ids are checked with `bash e2e/scenarios/relay/check-ids.sh`.
- **Typecheck.** `bun run typecheck` runs once per phase, in the phase checkpoint, never per edit. Lint: `bunx biome check <files>`; checkpoints run `bun run lint:check`.
- **Unit task acceptance (applies to every `Unit:` task).** Every listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%); component and hook specs start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail` (real source bugs are reported, not hidden). Verify is `bunx vitest run <specs> --coverage --coverage.include=<src files> --coverage.reporter=text`.
- **XC-01.** Existing specs are rewritten to the new behaviour, never weakened. Each implementation task updates the XC-01 unit specs it breaks; each phase's migration E2E task rewrites the XC-01 e2e specs the phase breaks.
- **i18n.** Locales are `en`, `fr`, `ja`. Every new string is added to all three in the same task (namespaces `relayDock.json`, `relay.json`, `settings.json`, `errors.json`, `common.json`); removed features have their keys removed from all three. Parity gate: `bunx vitest run src/i18n/messages.parity.spec.ts src/i18n/relayMessages.parity.spec.ts src/i18n/chainMessages.parity.spec.ts`.
- **Project rules.** No tests under `src/components/reactbits/`. Zustand stores in `src/stores/use<Name>Store.ts`; dialog state is local React state, not a store. Functions under ~30 lines, named constants, no commented-out code, no silent catches. No dependency other than Tiptap; no IDB version bump (`IDB_VERSION` stays 6); chat contract changes limited to `message.metadata`. Ask first on anything else.
- **Never `bun run build` in the repo** (it clobbers the dev server's `.next`). The e2e prod-server mode below uses `.next-e2e`.

**Decisions and gaps found while authoring (all resolved here)**
- The project has Playwright, Vitest, the seeded `e2e/qa/` harness and `e2e/fixtures/qa.ts`, so no `Setup: test harness` task is needed. It has no `E2E_SERVER` mode in `playwright.config.ts`, no `E2E_DIST_DIR` in `next.config.ts` and no `e2e/README.md`, so Phase 0 adds `Setup: e2e prod-server mode` (T0.2). `.gitignore` already has `coverage`, `playwright-report` and `test-results`; it lacks `.dashboard/*/reports/` and `.next-e2e`, added in the same task.
- The progress dashboard lint requires every phase that contains implementation tasks to end with `Unit:` tasks and then `E2E:` tasks. Phase 0 therefore carries a small `Unit:` task (tool-name util) and an `E2E:` harness self-test that exercises every new helper.
- `T0.1` is a baseline gate that records the green XC-01 spec list before any product change (PLAN S0.2).
- Hot files are edited in the order given by PLAN section 1: `useRelayChat.ts`, `RelayComposer.tsx`, `RelayConversation.tsx`, `MessageParts.tsx`, `systemPrompt.ts`, `schemas.ts`/`registry.ts`, `useRelayStore.ts`, `messages/{en,fr,ja}/relayDock.json`. Task dependencies serialise them.
- STT-02 (status route, `useSttConfigured`) and the `speechEngine` store field are deliberately pulled forward into Phase 7 (T7.4, PLAN slice S7.1; SPEC STT-02 notes this), because `set_relay_preferences` must reject `grok` when STT is unconfigured. Phase 8 owns the picker UI and fallback.
- The question card state machine (CONV-09) ships behaviour in Phase 1 (T1.11, T1.12); only the stale-line placement moves in Phase 3 (T3.8).
- SPEC names one spec per phase (`relay-v2-bugs`, `relay-v2-conversation`, ...). Where one flow per `E2E:` task requires several authors, extra specs share the `relay-v2-<phase area>-*` prefix.

---

## Phase 0: Harness and baseline

**Adds:** No user-visible change. Adds the e2e prod-server mode, the shared relay-v2 e2e helpers (scripted streams, downloads, two contexts, IDB dumps, contrast, fake audio) and a registered-tool-name test utility, and records the green baseline before any product change.

**Try in UI:** No UI in this phase. Run `E2E_SERVER=prod bunx playwright test e2e/qa/relay/relay-v2-harness.spec.ts --list` and confirm the helper self-test spec is listed ; Open `.gitignore` and confirm `.next-e2e` and `.dashboard/*/reports/` are present ; Open `e2e/README.md` and read the server-mode convention

### ✅ T0.1 Baseline: record the green XC-01 specs
- **Kind**: gate
- **Traces**: XC-01
- **Files** (0): none (verification only)
- **Depends on**: none
- **Do**: Before any product change, run only the XC-01 unit specs and the four XC-01 e2e specs below. Record the pass/fail list in the task Log. Any spec already failing is listed as pre-existing so later phases do not blame their own change. Do not fix anything here.
- **Acceptance**:
  - The Log lists every XC-01 spec with its result and the date.
  - No product file is changed by this task.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx src/components/relay/ConfirmCard.spec.tsx src/components/settings/RelaySection.spec.tsx src/stores/useRelayStore.spec.ts src/components/relay/ChangeCard.spec.tsx src/components/relay/AskUserCard.spec.tsx src/components/relay/MentionMenu.spec.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/CapabilitiesPanel.spec.tsx src/components/environment/EnvSelector.spec.tsx`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-polish-shield.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/settings.spec.ts`
  - `git status --porcelain src e2e messages | wc -l`  (expect 0)
- **Log**: 2026-10-27 — vitest 10/10 files (291 tests) pass; playwright relay-chat 17/17, relay-polish-shield 9/9, relay-privacy 4/4, settings 5/5 pass. Pre-existing failures: none. No product files changed.

### ✅ T0.2 Setup: e2e prod-server mode and gitignore
- **Kind**: implementation
- **Traces**: XC-01
- **Files** (5): `playwright.config.ts`; `next.config.ts`; `e2e/README.md` (new); `.gitignore`; `tsconfig.json`
- **Depends on**: T0.1
- **Do**: In `playwright.config.ts` select the `webServer` array by `E2E_SERVER=dev|prod` (default `dev`, today's behaviour untouched when `PLAYWRIGHT_TEST_BASE_URL` is set). `prod` runs the build then `next start` on `E2E_PROD_PORT` (named constant default) with `reuseExistingServer: false`, and uses `E2E_DIST_DIR`. In `next.config.ts` set `distDir: process.env.E2E_DIST_DIR ?? ".next"`, with `E2E_DIST_DIR=.next-e2e` documented as the prod-mode value so it never touches the dev server's `.next`. Write `e2e/README.md` documenting `E2E_SERVER`, `E2E_PROD_PORT`, `E2E_DIST_DIR`, the base URL `https://requestly.localhost/app` and the targeted-specs-only rule. Add `.next-e2e` and `.dashboard/*/reports/` to `.gitignore` (the other artifact dirs are already ignored). Design: n/a, tooling only.
- **Acceptance**:
  - `playwright.config.ts` selects the server by `E2E_SERVER`; `prod` builds then starts on `E2E_PROD_PORT` with `reuseExistingServer: false`; the default behaviour and the `PLAYWRIGHT_TEST_BASE_URL` shortcut are unchanged.
  - `next.config.ts` uses `distDir: process.env.E2E_DIST_DIR ?? ".next"`.
  - `e2e/README.md` documents the convention; `.gitignore` contains `.next-e2e` and `.dashboard/*/reports/`.
- **Verify**:
  - `E2E_SERVER=prod bunx playwright test e2e/qa/relay/relay-chat.spec.ts --list`  (exit 0, config parses)
  - `bunx playwright test e2e/qa/relay/relay-chat.spec.ts --list`  (exit 0, default mode unchanged)
  - `grep -nE "E2E_SERVER|E2E_PROD_PORT|E2E_DIST_DIR" playwright.config.ts next.config.ts e2e/README.md`
  - `grep -nE "^\.next-e2e|\.dashboard/\*/reports/" .gitignore`
  - `bunx biome check playwright.config.ts next.config.ts`

### ✅ T0.3 Relay-v2 e2e helpers
- **Kind**: implementation
- **Traces**: XC-01
- **Files** (4): `e2e/fixtures/relayRoutes.ts`; `e2e/fixtures/relayE2eHelpers.ts`; `e2e/fixtures/relayV2Helpers.ts` (new); `e2e/fixtures/speechStub.ts`
- **Depends on**: T0.2
- **Do**: Extend `relayRoutes.ts` with scripted-stream builders for message `metadata`, an `ask_user` call, multi-step tool turns with delays, and a step-cap hit, plus a request-body capture helper (assert the last user message detail). Add to `relayV2Helpers.ts`: `downloadCapture` (backup export), `twoContexts` (BAK-06), an IDB dump helper (`indexedDB` evaluate, per store), a computed-colour and contrast helper (compare computed rgb against a `var(--primary)` probe), and a fake-audio launch-flag plus `page.route` STT mock built on `speechStub.ts`. No product code changes. Design: n/a, test tooling only.
- **Acceptance**:
  - Each helper is exported with a typed signature and is exercised by T0.6.
  - No file under `src/` changes; existing relay specs still run.
- **Verify**:
  - `bunx biome check e2e/fixtures/relayRoutes.ts e2e/fixtures/relayE2eHelpers.ts e2e/fixtures/relayV2Helpers.ts e2e/fixtures/speechStub.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-chat.spec.ts`  (no regression)
  - `git status --porcelain src | wc -l`  (expect 0)

### ✅ T0.4 Registered-tool-names util and parity coverage
- **Kind**: implementation
- **Traces**: XC-01, BUG-03, TOOL-06
- **Files** (4): `src/lib/relay/tools/testUtils.ts` (new); `src/i18n/messages.parity.spec.ts`; `src/i18n/relayMessages.parity.spec.ts`; `src/i18n/chainMessages.parity.spec.ts`
- **Depends on**: T0.1
- **Do**: Add `getRegisteredToolNames()` (reads the registry) as a shared test util for the BUG-03, TOOL-05, TOOL-06 and TOOL-07 tests. Confirm the three parity specs cover `relayDock.json`, `relay.json`, `settings.json`, `common.json` and `errors.json` across en/fr/ja; extend them where a namespace is missing so a missing key in fr or ja fails. Design: n/a, test util only.
- **Acceptance**:
  - `getRegisteredToolNames()` returns every name in the registry.
  - The parity specs fail when a key is absent from fr or ja for each of the five namespaces.
- **Verify**:
  - `bunx vitest run src/i18n`
  - `bunx biome check src/lib/relay/tools/testUtils.ts src/i18n`

### ✅ T0.5 Unit: tool-name util
- **Kind**: unit
- **Traces**: XC-01, TOOL-06
- **Files** (1): `src/lib/relay/tools/testUtils.ts`
- **Depends on**: T0.4
- **Do**: Cover `getRegisteredToolNames()` including an unknown-tool negative and that names are unique and snake_case.
- **Acceptance**:
  - The file reaches >= 80% lines, branches, functions and statements (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/testUtils.spec.ts --coverage --coverage.include=src/lib/relay/tools/testUtils.ts --coverage.reporter=text`

### ✅ T0.6 E2E: helper self-test
- **Kind**: e2e
- **Traces**: XC-01
- **Files** (0): none (no app change)
- **Depends on**: T0.3, T0.5
- **Gherkin**: `e2e/scenarios/relay/relay-v2-harness.feature.md`: REL-V2-HARNESS-01..06
- **Spec**: `e2e/qa/relay/relay-v2-harness.spec.ts`
- **Scenarios**:
  - `[REL-V2-HARNESS-01] a scripted ask_user stream renders a question card and the body capture helper returns the last user message` @critical
  - `[REL-V2-HARNESS-02] a scripted multi-step tool turn with delays and a step-cap hit completes deterministically` @high
  - `[REL-V2-HARNESS-03] the IDB dump helper returns per-store records for seeded data` @high
  - `[REL-V2-HARNESS-04] the computed-colour helper returns an rgb that differs from the var(--primary) probe` @medium
  - `[REL-V2-HARNESS-05] the twoContexts helper opens two isolated profiles with separate IndexedDB` @high
  - `[REL-V2-HARNESS-06] the fake-audio flags plus STT page.route mock return a transcript` @medium
- **Do**: Each helper from T0.3 is exercised through a minimal consumer so later phases can rely on it. Empty, error and persistence cases do not apply: this spec tests tooling.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-harness.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ T0.7 Checkpoint 0
- **Kind**: gate
- **Traces**: XC-01
- **Files** (0): none (verification only)
- **Depends on**: T0.1, T0.2, T0.3, T0.4, T0.5, T0.6
- **Do**: Run the checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - Baseline recorded, helpers lint clean, parity specs cover all five namespaces, prod-server mode and gitignore in place.
- **Verify**:
  - `bunx vitest run src/i18n src/lib/relay/tools/testUtils.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-harness.spec.ts --repeat-each=2`
  - `bun run lint:check`
  - `bun run typecheck`

🔶 **Checkpoint 0**: baseline recorded, prod-server mode and gitignore in place, e2e helpers and tool-name util ready.

---

## Phase 1: Quick bug fixes

**Adds:** Turning Relay off really turns it off, the Position setting is gone, attachments belong to a single message instead of riding on every turn, and choice questions use a card you pick or type into and then Send. The picker filters as you type, Relay stops naming internal tools, and the env, history, method and chevron/folder-icon glitches are fixed.

**Try in UI:** Settings, Relay, switch Enable off and confirm the dock, toggle, launcher and palette entries disappear ; Attach a request, send, and confirm the composer is empty and the next turn carries no attachment ; Trigger a question card, pick an option and press Send, then type your own answer and press Send ; Open Export a request as cURL and type in the picker search to narrow the list ; Open the method dropdown, the env row menu and the History menu and check the layout

### ✅ T1.1 Relay availability selector and surface gating
- **Kind**: implementation
- **Traces**: BUG-05
- **Files** (5): `src/stores/useRelayStore.ts`; `src/hooks/useRelayAvailable.ts` (new); `src/components/relay/RelayRoot.tsx`; `src/components/relay/RelayToggleButton.tsx`; `src/components/relay/OpenInRelayButton.tsx`
- **Depends on**: T0.7
- **Do**: Add `useRelayAvailable()` (env flag AND `enabled`) as the single gate. `RelayRoot` does not mount the dock when false; `RelayToggleButton`, the launcher entry and `OpenInRelayButton` render nothing when false. Update `RelayRoot.spec.tsx`, `OpenInRelayButton.spec.tsx`, `RelayToggleButton.spec.tsx` where they assumed the old gate. Design: n/a, logic only (surfaces are removed, not restyled).
- **Acceptance**:
  - BUG-05: with `enabled` false none of the dock, `RelayToggleButton`, launcher, Open-in-Relay buttons render; toggling `enabled` back on restores them without a reload.
  - The Settings Relay section stays visible so Relay can be re-enabled.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayRoot.spec.tsx src/components/relay/RelayToggleButton.spec.tsx src/components/relay/OpenInRelayButton.spec.tsx src/stores/useRelayStore.spec.ts`
  - `bunx biome check src/stores/useRelayStore.ts src/hooks/useRelayAvailable.ts src/components/relay/RelayRoot.tsx src/components/relay/RelayToggleButton.tsx src/components/relay/OpenInRelayButton.tsx`
  - Proven end to end by E2E T1.35.

### ✅ T1.2 Gate shortcut, palette, openInRelay; disable aborts turn and recording
- **Kind**: implementation
- **Traces**: BUG-05
- **Files** (5): `src/hooks/useRelayShortcut.ts`; `src/components/common/CommandPalette.tsx`; `src/lib/relay/openInRelay.ts`; `src/hooks/useRelayChat.ts`; `src/components/relay/MicButton.tsx`
- **Depends on**: T1.1
- **Do**: Use `useRelayAvailable()` so the keyboard shortcut is not registered, the command palette hides Relay entries, and `openInRelay()` is a no-op while disabled. Disabling Relay aborts the in-flight turn (the message is left for the "Stopped" stamp added in Phase 3), stops and discards any recording, and persists the thread; re-enabling restores the last active thread. Update the existing specs of the touched files.
- **Acceptance**:
  - BUG-05: the shortcut handler is a no-op and the palette item list excludes Relay entries when disabled; `openInRelay()` does nothing.
  - Disabling while a turn runs aborts it, stops and discards recording, keeps the thread, and re-enabling restores the active thread.
- **Verify**:
  - `bunx vitest run src/hooks/useRelayShortcut.spec.ts src/components/common/CommandPalette.spec.tsx src/lib/relay/openInRelay.spec.ts src/hooks/useRelayChat.spec.ts src/components/relay/MicButton.spec.tsx`
  - `bunx biome check src/hooks/useRelayShortcut.ts src/components/common/CommandPalette.tsx src/lib/relay/openInRelay.ts src/hooks/useRelayChat.ts src/components/relay/MicButton.tsx`
  - Proven end to end by E2E T1.35.

### ✅ T1.3 Remove the Position setting
- **Kind**: implementation
- **Traces**: BUG-06
- **Files** (5): `src/components/settings/RelaySection.tsx`; `src/stores/useRelayStore.ts`; `messages/en/settings.json`; `messages/fr/settings.json`; `messages/ja/settings.json`
- **Depends on**: T1.2
- **Do**: Remove the Position control from `RelaySection.tsx`, `position` from the store, and the copy keys from all three locales. On store hydrate call `localStorage.removeItem("rq_relay_position")` once. Update the touched specs so they compile.
- **Acceptance**:
  - BUG-06: the section renders no position control; `position` no longer exists in the store; the `rq_relay_position` key is removed after hydrate; no position key remains in any locale.
- **Verify**:
  - `bunx vitest run src/components/settings/RelaySection.spec.tsx src/stores/useRelayStore.spec.ts src/i18n/messages.parity.spec.ts`
  - `test -z "$(grep -rn "rq_relay_position\|relay.position" src messages | grep -v "removeItem")"`  (expect exit 0)

### ✅ T1.4 Settings specs assert effects
- **Kind**: implementation
- **Traces**: BUG-07, XC-01
- **Files** (4): `src/components/settings/RelaySection.spec.tsx`; `src/stores/useRelayStore.spec.ts`; `src/hooks/useRelayShortcut.spec.ts`; `src/components/common/CommandPalette.spec.tsx`
- **Depends on**: T1.3
- **Do**: Replace the write-only assertions in `RelaySection.spec.tsx` with effect checks: Enable hides the dock, toggle, shortcut and palette entries; Share values reaches the outgoing request body; permission mode changes approval behaviour. Add the disabled-state cases to the shortcut and palette specs. These are rewrites of existing specs, not weakenings.
- **Acceptance**:
  - BUG-07: each setting is asserted by its observable effect, not by the store write alone.
  - No existing assertion about a still-valid behaviour is removed.
- **Verify**:
  - `bunx vitest run src/components/settings/RelaySection.spec.tsx src/stores/useRelayStore.spec.ts src/hooks/useRelayShortcut.spec.ts src/components/common/CommandPalette.spec.tsx`
  - `test -z "$(grep -nE '\.(skip|only|fixme)\(' src/components/settings/RelaySection.spec.tsx)"`

### ✅ T1.5 System prompt: ban tool names, card for choices
- **Kind**: implementation
- **Traces**: BUG-03, BUG-04
- **Files** (4): `src/lib/relay/server/systemPrompt.ts`; `src/lib/relay/server/systemPrompt.spec.ts`; `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/schemas.spec.ts`
- **Depends on**: T0.7
- **Do**: Add the ban-rule block to `buildSystemPrompt` (never mention tool names, function names, snake_case identifiers or tool-call mechanics in user-facing text). Remove tool names from the quoted user-facing examples (for example "Tell me the name (or use ask_user to pick)"); instructions to the model may still name tools. Add the rule "when the user must choose among options, use the question card, never a plain-text list" to the prompt and update the `ask_user` schema description to match.
- **Acceptance**:
  - BUG-03: the prompt contains the ban rule and its quoted user-facing examples contain no registered tool name.
  - BUG-04: the prompt contains the card rule and the `ask_user` description states it.
- **Verify**:
  - `bunx vitest run src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/tools/schemas.spec.ts`
  - `bunx biome check src/lib/relay/server/systemPrompt.ts src/lib/relay/tools/schemas.ts`

### ✅ T1.6 Tool-name leak sweep in code paths
- **Kind**: implementation
- **Traces**: BUG-03
- **Files** (4): `src/components/relay/ConfirmCard.tsx`; `src/components/relay/ToolRow.tsx`; `src/lib/relay/errors.ts`; `src/components/relay/MessageParts.tsx`
- **Depends on**: T1.5
- **Do**: Sweep ConfirmCard titles and bodies, ToolRow labels, the DeclinedNote and the tool error formatter so that no registered tool name reaches the UI; fall back to the plain-language label. Update their specs to iterate the registry with `getRegisteredToolNames()`.
- **Acceptance**:
  - BUG-03: ToolRow, ConfirmCard, DeclinedNote and the error formatter render no registered tool name for every tool in the registry.
- **Verify**:
  - `bunx vitest run src/components/relay/ConfirmCard.spec.tsx src/components/relay/ToolRow.spec.tsx src/lib/relay/errors.spec.ts src/components/relay/MessageParts.spec.tsx`
  - `bunx biome check src/components/relay/ConfirmCard.tsx src/components/relay/ToolRow.tsx src/lib/relay/errors.ts src/components/relay/MessageParts.tsx`

### ✅ T1.7 Tool-name leak sweep in copy
- **Kind**: implementation
- **Traces**: BUG-03
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: T1.6
- **Do**: Reviewer spot check (2026-10-26): tool names appear in `relayDock.json` only as keys (`tools.<name>`), not in any value of `relayDock.json` or `relay.json`; the real leaks are in the prompt (T1.5) and the UI fallbacks (T1.6). Re-run the values-only check below; rewrite any value that matches to plain language and keep keys unchanged. If none match, record "no value leak" in the Log; the check stays as the guard for the copy added in T3.3, T7.1 and T8.4.
- **Acceptance**:
  - BUG-03: no string in `messages/*/relayDock.json` or `messages/*/relay.json` contains a registered tool name.
- **Verify**:
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/lib/relay/brandGuard.spec.ts`
  - `names=$(sed -n '/^export const RELAY_TOOL_SCHEMAS/,/^};/p' src/lib/relay/tools/schemas.ts | grep -oE '^  [a-z]+(_[a-z]+)+:' | tr -d ' :' | sort -u | paste -sd'|' -); test -n "$names" && test -z "$(jq -r '.. | strings' messages/*/relayDock.json messages/*/relay.json | grep -E "\\b($names)\\b")"`  (every key of `RELAY_TOOL_SCHEMAS`, values only, both namespaces)
- **Log**: 2026-10-27 — no value leak: values-only check over messages/*/relayDock.json and relay.json finds no registered tool name; no file changed.

### ✅ T1.8 Attachment metadata, resolved detail and outgoing-message helper
- **Kind**: implementation
- **Traces**: BUG-01, COMP-06
- **Files** (5): `src/lib/relay/attachments.ts` (new); `src/lib/relay/outgoingMessages.ts` (new); `src/lib/relay/contextBuilder.ts`; `src/lib/relay/tokenBudget.ts`; `src/app/api/relay/chat/route.ts`
- **Depends on**: T1.7
- **Do**: Add `buildAttachmentMetadata` (`{id, kind, label, method?}`) and `buildAttachmentDetail`, which reuse the get_request, get_collection, get_environment and get_chain serializers so `shareValues` redaction is identical. Add `prepareOutgoingMessages()` that keeps resolved detail on the latest user message only, strips detail and (later) `metadata.turn`/segments from older messages, and enforces `RELAY_ATTACHMENT_DETAIL_MAX_CHARS` by degrading to ids and names plus a "detail truncated, ask for more" note. A deleted item yields "<label> no longer exists". Fix `capToolResult` so a truncated summary passes the route `contextSchema`. Stop `contextBuilder` from sending chips on every request. Design: n/a, logic only.
- **Acceptance**:
  - BUG-01: a request attachment resolves to `{id, name, method, url}` plus headers, params, body and auth type with auth secrets following `shareValues`; collections resolve to name, id and request list; environments to variable keys (values only with `shareValues`, never `isSecret`); chains to a node summary.
  - Older user messages keep only `metadata.attachments`; 10 large attachments plus 50 prior turns stay under 256 KB; overflow degrades without dropping the turn.
  - A truncated summary from `capToolResult` passes the route `contextSchema`.
- **Verify**:
  - `bunx vitest run src/lib/relay/contextBuilder.spec.ts src/lib/relay/tokenBudget.spec.ts src/app/api/relay/chat/route.spec.ts`
  - `bunx biome check src/lib/relay/attachments.ts src/lib/relay/outgoingMessages.ts src/lib/relay/contextBuilder.ts src/lib/relay/tokenBudget.ts src/app/api/relay/chat/route.ts`

### ✅ T1.9 Per-turn send path and prompt rules
- **Kind**: implementation
- **Traces**: BUG-01, COMP-06
- **Files** (5): `src/hooks/useRelayChat.ts`; `src/stores/useRelayStore.ts`; `src/hooks/useSlashCommandRunner.ts`; `src/components/relay/RelayComposer.tsx`; `src/lib/relay/server/systemPrompt.ts`
- **Depends on**: T1.8
- **Do**: Send `message.metadata.attachments` with the user message and the resolved detail part on the latest user message only, through `prepareOutgoingMessages()`. Clear the composer chips and `attachedItems` after send. Remove the `buildPrompt` "Attached:" suffix. Update `ATTACHED_CONTEXT_RULES`: the current message's attachments are authoritative and the model must not ask which item the user means. Update the touched XC-01 specs.
- **Acceptance**:
  - BUG-01: after send the composer has no chips; a second turn without re-attaching carries no attachments and turn 1's are not resent as context.
  - The draft text never contains the attachment labels list; the resolved detail is in that turn's content so "export this as cURL" needs no discovery call.
  - The prompt states the current attachments are authoritative.
- **Verify**:
  - `bunx vitest run src/hooks/useRelayChat.spec.ts src/stores/useRelayStore.spec.ts src/hooks/useSlashCommandRunner.spec.ts src/components/relay/RelayComposer.spec.tsx src/lib/relay/server/systemPrompt.spec.ts`
  - Proven end to end by E2E T1.32.

### ✅ T1.10 User-bubble attachment pill row and deleted state
- **Kind**: implementation
- **Traces**: BUG-01, CONV-10
- **Files** (3): `src/components/relay/AttachmentPillRow.tsx` (new); `src/components/relay/RelayConversation.tsx`; `src/components/relay/RelayConversation.spec.tsx`
- **Depends on**: T1.9
- **Do**: Render a neutral pill row under the user text from `message.metadata.attachments` using the existing `EntityPill`. A pill whose entity was later deleted renders muted, tooltip "No longer exists", no navigation. Plain text layout is unchanged. Design: n/a here; the neutral colour treatment is carried by T3.1, the layout by the existing bubble.
- **Acceptance**:
  - BUG-01: the bubble shows the attachment pills under the text; a deleted entity's pill is muted with the "No longer exists" tooltip and no navigation.
  - A message without `metadata.attachments` renders exactly as before.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx`
  - `bunx biome check src/components/relay/AttachmentPillRow.tsx src/components/relay/RelayConversation.tsx`

### ✅ T1.11 Question card state machine and composer answer
- **Kind**: implementation
- **Traces**: CONV-09, BUG-04
- **Files** (5): `src/lib/relay/askUserState.ts` (new); `src/lib/relay/tools/ui.ts`; `src/hooks/useRelayChat.ts`; `src/components/relay/RelayComposer.tsx`; `src/components/relay/ConfirmCard.tsx`
- **Depends on**: T1.10
- **Do**: Write the pure reducer once (states idle, selected, typed, sent, answered-via-composer, skipped). A composer message sent while a question card is pending answers it: the tool result is the message's plain text and the bubble still renders, with no dangling tool call. A composer message sent while a confirm card is pending auto-declines it and renders the muted "Skipped because the chat moved on" line, executing nothing. A stale card (stop, error, reload) becomes that muted non-interactive line. Update `ConfirmCard.spec.tsx`.
- **Acceptance**:
  - CONV-09: option click highlights and enables Send but sends nothing; typing deselects options and vice versa; empty input with no selection keeps Send disabled.
  - A composer message answers a pending question card ("Answered: <text>", bubble still shown); a pending confirm is auto-declined as "Skipped because the chat moved on".
  - A stopped, errored or reloaded turn leaves stale cards as the muted line.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/ui.spec.ts src/hooks/useRelayChat.spec.ts src/components/relay/RelayComposer.spec.tsx src/components/relay/ConfirmCard.spec.tsx`
  - `bunx biome check src/lib/relay/askUserState.ts src/lib/relay/tools/ui.ts src/hooks/useRelayChat.ts src/components/relay/RelayComposer.tsx src/components/relay/ConfirmCard.tsx`

### ✅ T1.12 Question card UI: pick or type, then Send
- **Kind**: implementation
- **Traces**: BUG-04, CONV-09
- **Files** (5): `src/components/relay/AskUserCard.tsx`; `src/components/relay/MessageParts.tsx`; `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: T1.11
- **Do**: Redesign `AskUserCard` with the reducer: option select highlights, a text field for your own answer, and a Send button; answered cards show the chosen answer; stale cards render the muted skipped line. Wire `MessageParts` and add the copy in all locales. Design: n/a, reuses existing card styling with shadcn primitives; no new visual language.
- **Acceptance**:
  - BUG-04: select-then-Send and type-then-Send both submit the value as the tool result and the visible reply; Send is disabled with no selection and no text.
  - CONV-09: answered cards show the answer; stale cards show "Skipped because the chat moved on".
- **Verify**:
  - `bunx vitest run src/components/relay/AskUserCard.spec.tsx src/components/relay/MessageParts.spec.tsx src/i18n/relayMessages.parity.spec.ts`
  - Proven end to end by E2E T1.32.

### ✅ T1.13 Picker copy: per-action headers and search
- **Kind**: implementation
- **Traces**: BUG-02
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: T1.12
- **Do**: Add `slash.hint.<actionId>` header keys for every target-needing `CAPABILITY_ACTIONS` entry (for example "Pick a request to export as cURL"), a generic per-target fallback, the search placeholder and the `No requests match "{query}"` empty state. Remove the footer hint "Keep typing to narrow results" from all locales.
- **Acceptance**:
  - BUG-02: a header key exists in all locales for every target-needing action; the footer hint key is gone.
- **Verify**:
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rn "Keep typing to narrow" messages)"`

### ✅ T1.14 Picker search input and per-action header
- **Kind**: implementation
- **Traces**: BUG-02
- **Files** (5): `src/components/relay/MentionMenu.tsx`; `src/components/relay/MentionMenu.spec.tsx`; `src/hooks/useCapabilityStarter.ts`; `src/hooks/useSlashCommandRunner.ts`; `src/components/relay/RelayComposer.tsx`
- **Depends on**: T1.13
- **Do**: In starter and slash mode `MentionMenu` gets its own autofocused search input (independent of the composer, so it survives the Phase 4 editor swap), filtering live by name and URL (case-insensitive substring). Arrow keys and Enter select; Escape closes and returns focus to the composer; no match shows `No requests match "<query>"`. The header comes from `slash.hint.<actionId>` with the generic fallback; the footer hint is removed. Design: n/a, reuses the menu styling.
- **Acceptance**:
  - BUG-02: typing narrows the list by name and URL; keyboard model works; empty state text shown; header names the real action; footer hint removed.
- **Verify**:
  - `bunx vitest run src/components/relay/MentionMenu.spec.tsx src/hooks/useCapabilityStarter.spec.ts src/hooks/useSlashCommandRunner.spec.ts src/components/relay/RelayComposer.spec.tsx`
  - `bunx biome check src/components/relay/MentionMenu.tsx src/hooks/useCapabilityStarter.ts src/hooks/useSlashCommandRunner.ts src/components/relay/RelayComposer.tsx`

### ✅ T1.15 Env row "..." menu without a chevron
- **Kind**: implementation
- **Traces**: BUG-08
- **Files** (2): `src/components/environment/EnvSelector.tsx`; `src/components/environment/EnvSelector.spec.tsx`
- **Depends on**: T0.7
- **Do**: Replace the SubTrigger used as the "..." button with a standalone nested `DropdownMenu` triggered by the "..." icon button. Do not modify the shared `dropdown-menu.tsx` SubTrigger. Design: n/a, structural fix reusing existing menu styling.
- **Acceptance**:
  - BUG-08: no chevron icon inside the env row; the hover and click target is exactly the "..." button; clicking "..." does not select the environment.
- **Verify**:
  - `bunx vitest run src/components/environment/EnvSelector.spec.tsx`
  - `bunx biome check src/components/environment/EnvSelector.tsx`

### ✅ T1.16 History "..." button size and export separator
- **Kind**: implementation
- **Traces**: BUG-10
- **Files** (2): `src/components/history/HistoryActionsMenu.tsx`; `src/components/history/HistoryActionsMenu.spec.tsx`
- **Depends on**: T0.7
- **Do**: Give the button `size="icon"` (>= 28x28) and add a separator between the JSON / HAR / CSV group and the "Exports are not redacted..." note. Design: n/a, size and separator only.
- **Acceptance**:
  - BUG-10: the button hit target is at least 28x28; a separator element sits before the redaction note in the export submenu.
- **Verify**:
  - `bunx vitest run src/components/history/HistoryActionsMenu.spec.tsx`
  - `bunx biome check src/components/history/HistoryActionsMenu.tsx`

### ✅ T1.17 Method dropdown fits badges
- **Kind**: implementation
- **Traces**: BUG-09
- **Files** (3): `src/components/request/UrlBar.tsx`; `src/components/request/UrlBar.spec.tsx`; `src/components/ui/select.tsx`
- **Depends on**: T0.7
- **Design**: First run the `impeccable` and `layout` skills on the method menu, record the decision in the task Log, then implement.
- **Do**: Widen the menu content to the longest method badge (OPTIONS) plus the check mark through a variant or className used only by `UrlBar`; do not change other Selects (touch `select.tsx` only if a variant is needed). Save screenshots per the design process.
- **Acceptance**:
  - BUG-09: the menu content is wide enough for OPTIONS plus the check mark with no clipping or overlap; other Selects are visually unchanged.
- **Verify**:
  - `bunx vitest run src/components/request/UrlBar.spec.tsx`
  - `bunx biome check src/components/request/UrlBar.tsx src/components/ui/select.tsx`
  - Layout proven by E2E T1.33.

### ✅ T1.18 Chevron convention in the sidebar and folder icons
- **Kind**: implementation
- **Traces**: BUG-11, BUG-12
- **Files** (5): `src/components/ui/accordion.tsx`; `src/components/layout/SidebarMainTab.tsx`; `src/components/layout/SidebarMainTab.spec.tsx`; `src/components/collections/CollectionTree.tsx`; `src/components/collections/CollectionRequestTree.tsx`
- **Depends on**: T1.17
- **Do**: Closed shows a right chevron and open shows a down chevron in the `accordion.tsx` `chevronLeft` variant, `SidebarMainTab` and both collection trees. `CollectionTree` and its subfolders use `Folder` when closed and `FolderOpen` when open, matching `CollectionRequestTree`. Design: n/a, icon convention only.
- **Acceptance**:
  - BUG-11: the accordion trigger renders ChevronRight when `data-state=closed` and ChevronDown when open, in the sidebar headers and both trees.
  - BUG-12: the folder icon swaps `Folder` to `FolderOpen` on toggle in the tree and subfolders.
- **Verify**:
  - `bunx vitest run src/components/layout/SidebarMainTab.spec.tsx src/components/collections`
  - `bunx biome check src/components/ui/accordion.tsx src/components/layout/SidebarMainTab.tsx src/components/collections/CollectionTree.tsx src/components/collections/CollectionRequestTree.tsx`

### ✅ T1.19 Chevron audit: response and request panels
- **Kind**: implementation
- **Traces**: BUG-11
- **Files** (5): `src/components/response/ResponsePanel.tsx`; `src/components/response/HeadersViewer.tsx`; `src/components/response/DataSchemaDialog.tsx`; `src/components/request/CodeGenPanel.tsx`; `src/components/request/ShareModal.tsx`
- **Depends on**: T1.18
- **Do**: Of the grep hits for `ChevronUp|ChevronDown|AccordionTrigger|CollapsibleTrigger`, change only the disclosure (closed/open) chevrons in these files to right when closed and down when open; leave sort arrows, selects and carets alone. Record each file as changed or "not a disclosure" in the Log.
- **Acceptance**:
  - BUG-11: every disclosure in these files follows closed = right, open = down; each file is accounted for in the Log.
- **Verify**:
  - `bunx vitest run src/components/response src/components/request`
  - `bunx biome check src/components/response src/components/request`
- **Log**: 2026-10-27 — ShareModal: changed (ChevronRight, rotate-90 when open); HeadersViewer: already compliant; CodeGenPanel: already compliant; ResponsePanel: not a disclosure (More menu caret); DataSchemaDialog: not a disclosure (select caret). vitest + biome clean.

### ✅ T1.20 Chevron audit: chain panels and run log
- **Kind**: implementation
- **Traces**: BUG-11
- **Files** (5): `src/components/chain/panels/EditRequestPanel.tsx`; `src/components/chain/run-log/RunLogCollapsedBar.tsx`; `src/components/chain/run-log/RunLogHeader.tsx`; `src/components/chain/run-log/NestedSteps.tsx`; `src/components/chain/dialogs/picker/TargetCollectionPicker.tsx`
- **Depends on**: T1.19
- **Do**: Same audit as T1.19 for these files.
- **Acceptance**:
  - BUG-11: every disclosure in these files follows closed = right, open = down; each file is accounted for in the Log.
- **Verify**:
  - `bunx vitest run src/components/chain`
  - `bunx biome check src/components/chain`
- **Log**: 2026-10-27 — RunLogCollapsedBar: changed (ChevronRight collapsed / ChevronDown open); RunLogHeader: changed (same); TargetCollectionPicker: changed (Right/Down by treeOpen); EditRequestPanel: already compliant; NestedSteps: already compliant. vitest + biome clean.

### ✅ T1.21 Chevron audit: layout, JSON tools and explorers
- **Kind**: implementation
- **Traces**: BUG-11
- **Files** (5): `src/components/layout/RightPanel.tsx`; `src/components/json-compare/JsonComparePage.tsx`; `src/components/json-compare/DiffTree.tsx`; `src/components/json-visualize/JsonVisualizePage.tsx`; `src/components/chain/dialogs/JsonPathExplorer.tsx`
- **Depends on**: T1.20
- **Do**: Same audit as T1.19 for these files.
- **Acceptance**:
  - BUG-11: every disclosure in these files follows closed = right, open = down; each file is accounted for in the Log.
- **Verify**:
  - `bunx vitest run src/components/json-compare src/components/json-visualize src/components/layout`
  - `bunx biome check src/components/layout/RightPanel.tsx src/components/json-compare src/components/json-visualize src/components/chain/dialogs/JsonPathExplorer.tsx`
- **Log**: 2026-10-27 — RightPanel: already compliant; JsonComparePage: already compliant; DiffTree: already compliant; JsonPathExplorer: already compliant; JsonVisualizePage: not a disclosure (match prev/next arrows). No file changed. vitest + biome clean.

### ✅ T1.22 Chevron audit: schema explorer, tool block, tabs, Relay header
- **Kind**: implementation
- **Traces**: BUG-11
- **Files** (4): `src/components/request/GraphQLSchemaExplorer.tsx`; `src/components/ai-elements/tool.tsx`; `src/components/layout/TabListDropdown.tsx`; `src/components/relay/RelayHeader.tsx`
- **Depends on**: T1.21
- **Do**: Same audit as T1.19 for these files. `ChangeCard.tsx` is handled by T3.10 and `select.tsx` (select carets) is intentionally excluded.
- **Acceptance**:
  - BUG-11: every disclosure in these files follows closed = right, open = down; each file is accounted for in the Log.
- **Verify**:
  - `bunx vitest run src/components/layout src/components/relay/RelayHeader.spec.tsx`
  - `bunx biome check src/components/request/GraphQLSchemaExplorer.tsx src/components/ai-elements/tool.tsx src/components/layout/TabListDropdown.tsx src/components/relay/RelayHeader.tsx`
- **Log**: 2026-10-27 — tool.tsx: changed (ChevronRight, rotate-90 in details[open]); GraphQLSchemaExplorer: already compliant (both disclosures); TabListDropdown: not a disclosure (menu caret); RelayHeader: not a disclosure (thread menu caret). vitest + biome clean.

### ✅ T1.23 Unit: availability and shortcut gating
- **Kind**: unit
- **Traces**: BUG-05
- **Files** (4): `src/hooks/useRelayAvailable.ts`; `src/hooks/useRelayShortcut.ts`; `src/lib/relay/openInRelay.ts`; `src/hooks/useRelayAvailable.spec.ts`
- **Depends on**: T1.22
- **Do**: Selector truth table (env flag x enabled), shortcut handler no-op when disabled, `openInRelay()` no-op.
- **Acceptance**:
  - Every listed file reaches >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/hooks/useRelayAvailable.spec.ts src/hooks/useRelayShortcut.spec.ts src/lib/relay/openInRelay.spec.ts --coverage --coverage.include=src/hooks/useRelayAvailable.ts,src/hooks/useRelayShortcut.ts,src/lib/relay/openInRelay.ts --coverage.reporter=text`

### ✅ T1.24 Unit: Relay settings section and store
- **Kind**: unit
- **Traces**: BUG-05, BUG-06, BUG-07
- **Files** (2): `src/components/settings/RelaySection.tsx`; `src/stores/useRelayStore.ts`
- **Depends on**: T1.23
- **Do**: Cover the disable-aborts-turn action, the `rq_relay_position` cleanup on hydrate, no position control, and re-enable restoring the active thread.
- **Acceptance**:
  - Both files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/settings/RelaySection.spec.tsx src/stores/useRelayStore.spec.ts --coverage --coverage.include=src/components/settings/RelaySection.tsx,src/stores/useRelayStore.ts --coverage.reporter=text`

### ✅ T1.25 Unit: prompt rules and leak sweep
- **Kind**: unit
- **Traces**: BUG-03, BUG-04
- **Files** (4): `src/lib/relay/server/systemPrompt.ts`; `src/lib/relay/errors.ts`; `src/components/relay/ToolRow.tsx`; `src/components/relay/ConfirmCard.tsx`
- **Depends on**: T1.24
- **Do**: The prompt contains the ban rule and the card rule; the quoted examples are clean; no registered tool name appears in relayDock or relay values; ToolRow, ConfirmCard and the error formatter render no tool name for every registry tool.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/errors.spec.ts src/components/relay/ToolRow.spec.tsx src/components/relay/ConfirmCard.spec.tsx --coverage --coverage.include=src/lib/relay/server/systemPrompt.ts,src/lib/relay/errors.ts,src/components/relay/ToolRow.tsx,src/components/relay/ConfirmCard.tsx --coverage.reporter=text`

### ✅ T1.26 Unit: attachments and outgoing messages
- **Kind**: unit
- **Traces**: BUG-01, COMP-06
- **Files** (7): `src/lib/relay/attachments.ts`; `src/lib/relay/outgoingMessages.ts`; `src/lib/relay/contextBuilder.ts`; `src/lib/relay/tokenBudget.ts`; `src/app/api/relay/chat/route.ts`; `src/lib/relay/attachments.spec.ts`; `src/lib/relay/outgoingMessages.spec.ts`
- **Depends on**: T1.25
- **Do**: Metadata builder, detail redaction parity with the read tools (`shareValues` on and off, `isSecret` never), history stripping, schema acceptance of a truncated summary, deleted-item note, graceful overflow, and the 10 large attachments plus 50 prior turns under 256 KB test.
- **Acceptance**:
  - All five files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/attachments.spec.ts src/lib/relay/outgoingMessages.spec.ts src/lib/relay/contextBuilder.spec.ts src/lib/relay/tokenBudget.spec.ts src/app/api/relay/chat/route.spec.ts --coverage --coverage.include=src/lib/relay/attachments.ts,src/lib/relay/outgoingMessages.ts,src/lib/relay/contextBuilder.ts,src/lib/relay/tokenBudget.ts,src/app/api/relay/chat/route.ts --coverage.reporter=text`

### ✅ T1.27 Unit: question card and bubble pills
- **Kind**: unit
- **Traces**: CONV-09, BUG-04, BUG-01
- **Files** (6): `src/lib/relay/askUserState.ts`; `src/components/relay/AskUserCard.tsx`; `src/lib/relay/tools/ui.ts`; `src/components/relay/AttachmentPillRow.tsx`; `src/lib/relay/askUserState.spec.ts`; `src/components/relay/AttachmentPillRow.spec.tsx`
- **Depends on**: T1.26
- **Do**: Every reducer transition (idle, selected, typed, sent, answered-via-composer, skipped), Send disabled rules, tool result equals the chosen or typed value, deleted pill rendering.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/askUserState.spec.ts src/components/relay/AskUserCard.spec.tsx src/lib/relay/tools/ui.spec.ts src/components/relay/AttachmentPillRow.spec.tsx --coverage --coverage.include=src/lib/relay/askUserState.ts,src/components/relay/AskUserCard.tsx,src/lib/relay/tools/ui.ts,src/components/relay/AttachmentPillRow.tsx --coverage.reporter=text`

### ✅ T1.28 Unit: picker, env and history menus
- **Kind**: unit
- **Traces**: BUG-02, BUG-08, BUG-10
- **Files** (5): `src/components/relay/MentionMenu.tsx`; `src/hooks/useCapabilityStarter.ts`; `src/hooks/useSlashCommandRunner.ts`; `src/components/environment/EnvSelector.tsx`; `src/components/history/HistoryActionsMenu.tsx`
- **Depends on**: T1.27
- **Do**: Query filtering by name and URL, header key resolution for every target-needing `CAPABILITY_ACTIONS` entry in all locales, empty state; env row has no chevron and "..." does not select; History separator present and button size.
- **Acceptance**:
  - All five files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/relay/MentionMenu.spec.tsx src/hooks/useCapabilityStarter.spec.ts src/hooks/useSlashCommandRunner.spec.ts src/components/environment/EnvSelector.spec.tsx src/components/history/HistoryActionsMenu.spec.tsx --coverage --coverage.include=src/components/relay/MentionMenu.tsx,src/hooks/useCapabilityStarter.ts,src/hooks/useSlashCommandRunner.ts,src/components/environment/EnvSelector.tsx,src/components/history/HistoryActionsMenu.tsx --coverage.reporter=text`

### ✅ T1.29 Unit: chevron convention and folder icons
- **Kind**: unit
- **Traces**: BUG-11, BUG-12
- **Files** (6): `src/components/ui/accordion.tsx`; `src/components/layout/SidebarMainTab.tsx`; `src/components/collections/CollectionTree.tsx`; `src/components/collections/CollectionRequestTree.tsx`; `src/components/ui/accordion.spec.tsx`; `src/components/collections/CollectionRequestTree.spec.tsx`
- **Depends on**: T1.28
- **Do**: Accordion trigger renders ChevronRight when closed and ChevronDown when open; the folder icon swaps on toggle in the tree and its subfolders.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/ui/accordion.spec.tsx src/components/layout/SidebarMainTab.spec.tsx src/components/collections --coverage --coverage.include=src/components/ui/accordion.tsx,src/components/layout/SidebarMainTab.tsx,src/components/collections/CollectionTree.tsx,src/components/collections/CollectionRequestTree.tsx --coverage.reporter=text`

### ✅ T1.30 Unit: Phase 1 XC-01 sweep
- **Kind**: unit
- **Traces**: XC-01
- **Files** (4): `src/components/relay/RelayConversation.tsx`; `src/components/relay/MessageParts.tsx`; `src/hooks/useRelayChat.ts`; `src/components/relay/RelayComposer.tsx`
- **Depends on**: T1.29
- **Do**: Raise coverage on the hot files changed in this phase: attachments cleared after send, composer answers a pending card, pending confirm auto-declined, bubble pill row, no label suffix in the draft.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%); the XC-01 specs `RelayConversation`, `ConfirmCard`, `RelayComposer` stay green and are not weakened.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx src/components/relay/MessageParts.spec.tsx src/hooks/useRelayChat.spec.ts src/components/relay/RelayComposer.spec.tsx src/components/relay/ConfirmCard.spec.tsx --coverage --coverage.include=src/components/relay/RelayConversation.tsx,src/components/relay/MessageParts.tsx,src/hooks/useRelayChat.ts,src/components/relay/RelayComposer.tsx --coverage.reporter=text`

### ✅ T1.31 E2E: migrate XC-01 chat, shield and privacy specs for Phase 1
- **Kind**: e2e
- **Traces**: XC-01, BUG-01, BUG-05
- **Files** (0): none (no app change)
- **Depends on**: T1.30
- **Gherkin**: `e2e/scenarios/relay/relay-chat.feature.md`; `e2e/scenarios/relay/relay-polish-shield.feature.md`; `e2e/scenarios/relay/relay-privacy.feature.md` (existing, edited only where a changed behaviour is asserted)
- **Spec**: `e2e/qa/relay/relay-chat.spec.ts`; `e2e/qa/relay/relay-polish-shield.spec.ts`; `e2e/qa/relay/relay-privacy.spec.ts`
- **Scenarios**:
  - `[REL-CHAT-MIGRATE] every existing scenario still passes; assertions on the old attachment-on-every-turn body and the old Skipped wording are rewritten to the per-turn behaviour` @critical
  - `[REL-SHIELD-MIGRATE] approval behaviour is unchanged by the availability gate` @high
  - `[REL-PRIVACY-MIGRATE] shareValues redaction is identical in the new attachment detail` @critical
- **Do**: Run the three specs, rewrite any assertion that depends on a behaviour Phase 1 changed (never weaken), keep existing ids unchanged. The empty, error, persistence and deep-link cases do not apply because these are migrations of existing coverage.
- **Acceptance**:
  - All three specs pass; no assertion is deleted without an equivalent assertion of the new behaviour.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-polish-shield.spec.ts e2e/qa/relay/relay-privacy.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ T1.32 E2E: attachments per turn, question card, picker
- **Kind**: e2e
- **Traces**: BUG-01, BUG-02, BUG-03, BUG-04, CONV-09
- **Files** (0): none (no app change)
- **Depends on**: T1.30
- **Gherkin**: `e2e/scenarios/relay/relay-v2-bugs.feature.md`: REL-V2-BUGS-01..11
- **Spec**: `e2e/qa/relay/relay-v2-bugs.spec.ts`
- **Scenarios**:
  - `[REL-V2-BUGS-01] attach a request and send: the composer is empty, the bubble shows the pill, the mocked /api/relay/chat body has resolved detail on the last user message only, and the reply references the request with no question card` @critical
  - `[REL-V2-BUGS-02] a second turn sent without re-attaching carries no attachments and no turn-1 detail` @critical
  - `[REL-V2-BUGS-03] an attached request that is deleted before send is sent as a "no longer exists" note and the bubble pill renders muted with the tooltip` @high
  - `[REL-V2-BUGS-04] after reload the persisted bubble still shows the attachment pill` @high
  - `[REL-V2-BUGS-05] the "Export a request as cURL" starter shows the header "Pick a request to export as cURL"` @critical
  - `[REL-V2-BUGS-06] typing "user" in the picker search narrows the list to matching items only and arrow keys plus Enter select` @critical
  - `[REL-V2-BUGS-07] a query with no match shows the no-match text and Escape returns focus to the composer` @medium
  - `[REL-V2-BUGS-08] a mocked ask_user call: select an option, then Send; the tool result sent back equals the option` @critical
  - `[REL-V2-BUGS-09] a mocked ask_user call: type your own answer, then Send; the tool result equals the typed value` @critical
  - `[REL-V2-BUGS-10] a composer message sent while a question card is pending is recorded as its answer and the bubble still renders` @high
  - `[REL-V2-BUGS-11] stopping the turn while a card is pending leaves the muted skipped line; no registered tool name appears in any rendered card` @high
- **Do**: Use the T0.3 scripted-stream and body-capture helpers. The oversized-attachment overflow case is covered by unit T1.26; the empty case is the second-turn scenario.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
  - Covers BUG-01, BUG-02, BUG-04 and the CONV-09 e2e list.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-bugs.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ T1.33 E2E: env menu, History button, method dropdown, chevrons and folder icons
- **Kind**: e2e
- **Traces**: BUG-08, BUG-09, BUG-10, BUG-11, BUG-12
- **Files** (0): none (no app change)
- **Depends on**: T1.30
- **Gherkin**: `e2e/scenarios/relay/relay-v2-bugs-ui.feature.md`: REL-V2-BUGSUI-01..07
- **Spec**: `e2e/qa/relay/relay-v2-bugs-ui.spec.ts`
- **Scenarios**:
  - `[REL-V2-BUGSUI-01] the env menu "..." has no arrow, opens the actions, and clicking it does not select the environment` @critical
  - `[REL-V2-BUGSUI-02] the History "..." button bounding box is at least 28 px in both dimensions and the export submenu has a separator before the redaction note` @high
  - `[REL-V2-BUGSUI-03] at 100% zoom every method badge has scrollWidth <= clientWidth and does not intersect the check mark` @critical
  - `[REL-V2-BUGSUI-04] at 125% zoom the same method-menu checks hold` @high
  - `[REL-V2-BUGSUI-05] sidebar section headers show a right chevron closed and a down chevron open` @high
  - `[REL-V2-BUGSUI-06] a collection folder shows the open-folder icon when expanded, in the tree and in a subfolder` @high
  - `[REL-V2-BUGSUI-07] the expanded or collapsed state persists after reload` @medium
- **Do**: Layout assertions use bounding boxes and `scrollWidth`/`clientWidth` in a real browser. Error and deep-link cases do not apply to these static controls.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-bugs-ui.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ T1.34 E2E: migrate mention and slash specs for Phase 1
- **Kind**: e2e
- **Traces**: XC-01, BUG-02
- **Files** (0): none (no app change)
- **Depends on**: T1.30
- **Gherkin**: `e2e/scenarios/relay/relay-polish-mention.feature.md`; `e2e/scenarios/relay/relay-polish-slash.feature.md` (existing, edited only where the footer hint or header text is asserted)
- **Spec**: `e2e/qa/relay/relay-polish-mention.spec.ts`; `e2e/qa/relay/relay-polish-slash.spec.ts`
- **Scenarios**:
  - `[REL-MENTION-MIGRATE] mention scenarios pass with the picker search input` @high
  - `[REL-SLASH-MIGRATE] slash scenarios assert the per-action header and no footer hint` @high
- **Do**: Rewrite assertions of the removed footer hint and generic header to the new behaviour; never weaken. Other cases do not apply (migration of existing coverage).
- **Acceptance**:
  - Both specs pass with no deleted assertion lacking an equivalent.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-polish-mention.spec.ts e2e/qa/relay/relay-polish-slash.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ T1.35 E2E: Enable off, Position removed
- **Kind**: e2e
- **Traces**: BUG-05, BUG-06, BUG-07
- **Files** (0): none (no app change)
- **Depends on**: T1.30
- **Gherkin**: `e2e/scenarios/relay/relay-settings.feature.md`: REL-V2-SETTINGS-01..06
- **Spec**: `e2e/qa/relay/relay-settings.spec.ts`
- **Scenarios**:
  - `[REL-V2-SETTINGS-01] with Enable off the dock, toggle, launcher, palette entry and Open-in-Relay are hidden and the shortcut does nothing` @critical
  - `[REL-V2-SETTINGS-02] after reload with Enable off none of those surfaces appear` @critical
  - `[REL-V2-SETTINGS-03] turning Enable on restores them without a reload` @critical
  - `[REL-V2-SETTINGS-04] no Position control is present in Settings, Relay` @high
  - `[REL-V2-SETTINGS-05] disabling while a mocked turn is streaming aborts it, and re-enabling restores the last active thread` @high
  - `[REL-V2-SETTINGS-06] the Settings, Relay section stays visible while disabled` @medium
- **Do**: Use the scripted slow stream from T0.3 for the in-flight abort case. The "Stopped" label itself is asserted in Phase 3.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-settings.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ T1.36 Checkpoint 1
- **Kind**: gate
- **Traces**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-06, BUG-07, BUG-08, BUG-09, BUG-10, BUG-11, BUG-12, CONV-09, XC-01
- **Files** (0): none (verification only)
- **Depends on**: T1.31, T1.32, T1.33, T1.34, T1.35
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check. A human reviews before Phase 2.
- **Acceptance**:
  - All commands below exit 0 and the Phase 1 "Try in UI" steps hold.
- **Verify**:
  - `bunx vitest run src/components/relay src/hooks src/stores src/lib/relay src/i18n src/components/settings src/components/environment src/components/history`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-bugs.spec.ts e2e/qa/relay/relay-v2-bugs-ui.spec.ts e2e/qa/relay/relay-settings.spec.ts e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-polish-shield.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts e2e/qa/relay/relay-polish-slash.spec.ts --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`

🔶 **Checkpoint 1**: bugs fixed and proven by effects (attachments per turn, question card, picker, Enable off, layout fixes); XC-01 specs rewritten and green; human review before Phase 2.

---

## Phase 2: Sidebar

**Adds:** The sidebar can no longer be dragged narrower than 240px and can be widened to half the window. Collections, History and Hub rows truncate cleanly at the minimum width instead of clipping badges and buttons.

**Try in UI:** Drag the sidebar handle fully left and confirm it stops at 240px ; Drag it fully right and confirm it stops near half the window with the URL bar still usable ; At the minimum width, open Collections, History and Hub and check long names truncate with an ellipsis and no tab scrolls sideways

### ✅ T2.1 Sidebar panel bounds
- **Kind**: implementation
- **Traces**: SB-01, SB-02
- **Files** (2): `src/components/layout/MainLayout.tsx`; `src/components/layout/MainLayout.spec.tsx`
- **Depends on**: T1.36
- **Do**: In `MainLayout.tsx` set the sidebar panel `minSize="240px"`, `maxSize="50%"`, default `20%` and the main panel `minSize="50%"`, with the values as named constants. When 20% is below 240px the min wins. Update `MainLayout.spec.tsx` for the new props. Design: n/a, panel constants only; the visual proof is E2E T2.6.
- **Acceptance**:
  - SB-01: the sidebar panel is configured with a 240px minimum, so it cannot be dragged narrower.
  - SB-02: the sidebar max is 50%, the main panel min is 50% and the default is 20%.
- **Verify**:
  - `bunx vitest run src/components/layout/MainLayout.spec.tsx`
  - `bunx biome check src/components/layout/MainLayout.tsx`
  - `grep -nE "240px|50%" src/components/layout/MainLayout.tsx`

### ✅ T2.2 Row truncation: collections and history
- **Kind**: implementation
- **Traces**: SB-03
- **Files** (4): `src/components/collections/CollectionTree.tsx`; `src/components/collections/CollectionRequestTree.tsx`; `src/components/history/HistoryItem.tsx`; `src/components/history/HistoryItem.spec.tsx`
- **Depends on**: T2.1
- **Do**: Name cells in both collection trees use `min-w-0 flex-1 truncate`. In `HistoryItem.tsx` replace the JS `truncateUrl(..., 40)` with CSS truncation, keep the time from clipping the method badge and remove the `pr-8` collision. Update `HistoryItem.spec.tsx`. Design: n/a, truncation and spacing only.
- **Acceptance**:
  - SB-03: collection and history name and URL cells truncate by CSS; method badges and action buttons keep their space; no JS URL truncation remains in `HistoryItem`.
- **Verify**:
  - `bunx vitest run src/components/history/HistoryItem.spec.tsx src/components/collections`
  - `bunx biome check src/components/collections/CollectionTree.tsx src/components/collections/CollectionRequestTree.tsx src/components/history/HistoryItem.tsx`
  - Layout proven by E2E T2.6.

### ✅ T2.3 Hub card footer wraps
- **Kind**: implementation
- **Traces**: SB-03
- **Files** (2): `src/components/hub/HubProviderCard.tsx`; `src/components/hub/HubProviderCard.spec.tsx`
- **Depends on**: T2.1
- **Do**: Make the footer at `HubProviderCard.tsx` (~line 128) `flex-wrap` so the buttons wrap at 240px. Update the spec. Design: n/a, wrap behaviour only.
- **Acceptance**:
  - SB-03: the Hub card footer wraps instead of clipping its buttons.
- **Verify**:
  - `bunx vitest run src/components/hub/HubProviderCard.spec.tsx`
  - `bunx biome check src/components/hub/HubProviderCard.tsx`

### ✅ T2.4 Unit: sidebar layout bounds
- **Kind**: unit
- **Traces**: SB-01, SB-02
- **Files** (1): `src/components/layout/MainLayout.tsx`
- **Depends on**: T2.3
- **Do**: Assert the panel props (min 240px, max 50%, default 20%, main min 50%) and that the constants are the single source.
- **Acceptance**:
  - The file reaches >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/layout/MainLayout.spec.tsx --coverage --coverage.include=src/components/layout/MainLayout.tsx --coverage.reporter=text`

### ✅ T2.5 Unit: sidebar rows
- **Kind**: unit
- **Traces**: SB-03
- **Files** (3): `src/components/history/HistoryItem.tsx`; `src/components/hub/HubProviderCard.tsx`; `src/components/collections/CollectionRequestTree.tsx`
- **Depends on**: T2.4
- **Do**: Assert the truncation and wrap classes, the badge and time structure and that long names render untruncated in the DOM (CSS does the clipping).
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/history/HistoryItem.spec.tsx src/components/hub/HubProviderCard.spec.tsx src/components/collections --coverage --coverage.include=src/components/history/HistoryItem.tsx,src/components/hub/HubProviderCard.tsx,src/components/collections/CollectionRequestTree.tsx --coverage.reporter=text`

### ✅ T2.6 E2E: sidebar bounds and truncation
- **Kind**: e2e
- **Traces**: SB-01, SB-02, SB-03
- **Files** (1): `e2e/fixtures/seed/relay-v2-sidebar.json`
- **Depends on**: T2.5
- **Gherkin**: `e2e/scenarios/relay/relay-v2-sidebar.feature.md`: REL-V2-SIDEBAR-01..06
- **Spec**: `e2e/qa/relay/relay-v2-sidebar.spec.ts`
- **Scenarios**:
  - `[REL-V2-SIDEBAR-01] dragging the handle fully left gives a sidebar width of 240 plus or minus 1 px` @critical
  - `[REL-V2-SIDEBAR-02] at 240 px no tab (Collections, History, Hub) has scrollWidth greater than clientWidth` @critical
  - `[REL-V2-SIDEBAR-03] at a 1440 px viewport dragging fully right puts the sidebar within 2 px of 50% of the layout width and the URL bar is still visible` @critical
  - `[REL-V2-SIDEBAR-04] at 240 px seeded long names and URLs truncate with an ellipsis in Collections and History` @high
  - `[REL-V2-SIDEBAR-05] at 240 px method badges and action buttons are fully visible and their bounding boxes do not intersect` @high
  - `[REL-V2-SIDEBAR-06] at 240 px the Hub card footer buttons wrap and stay visible` @medium
- **Do**: Seed long collection names, long history URLs and Hub providers through the QA seed. Drag with the mouse on the resize handle. Error and deep-link cases do not apply.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-sidebar.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ T2.7 Checkpoint 2
- **Kind**: gate
- **Traces**: SB-01, SB-02, SB-03, XC-01
- **Files** (0): none (verification only)
- **Depends on**: T2.6
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check. A human reviews before Phase 3.
- **Acceptance**:
  - All commands below exit 0 and the Phase 2 "Try in UI" steps hold.
- **Verify**:
  - `bunx vitest run src/components/layout src/components/history src/components/hub src/components/collections`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-sidebar.spec.ts e2e/qa/relay/relay-v2-bugs-ui.spec.ts --repeat-each=2`
  - `bun run lint:check`
  - `bun run typecheck`

🔶 **Checkpoint 2**: sidebar bounds and truncation proven in a real browser at 240px and at 50%.

---

## Phase 3: Conversation redesign

**Adds:** Each turn shows a live "Working for Ns" header and folds into a collapsed "Worked for Ns" group when done, with grouped step summaries. One compact changes summary with Open buttons replaces the per-change detail tables, pills stop using the accent colour, and creating a chain never navigates away while its page updates live.

**Try in UI:** Ask Relay to create a request and watch the "Working for Ns" header tick, then expand "Worked for Ns" to see the steps ; Check the changes summary rows, press Open on one and use Undo all ; Open a chain page and ask Relay to add nodes and watch them appear without a reload ; Compare an entity pill against a method badge and confirm only the badge is coloured

### ☐ T3.1 Neutral entity pills and inline code
- **Kind**: implementation
- **Traces**: CONV-07, CONV-10
- **Files** (4): `src/components/relay/EntityPill.tsx`; `src/components/relay/RelayMarkdown.tsx`; `src/components/relay/AttachmentPillRow.tsx`; `src/components/relay/ChangeCard.tsx`
- **Depends on**: T2.7
- **Design**: First run the `impeccable` and `layout` skills on the pill, inline code and row treatment, record the decision in the task Log, then implement.
- **Do**: Replace `ENTITY_ACCENT_CLASS = "text-primary"` with `text-foreground` (secondary text `text-muted-foreground`) on `bg-muted` with a subtle border, and remove the file-like inline code accent in `RelayMarkdown.tsx`. Colour stays only on `METHOD_BADGE_CLASSES`. Give every pill the `data-relay-pill` attribute. Apply to request, folder and collection pills, inline code, ChangeCard rows and the user-bubble pill row. Update the touched specs.
- **Acceptance**:
  - CONV-07: no `text-primary` class on a pill or inline code; method badges keep their colours; every pill carries `data-relay-pill`.
  - CONV-10: the bubble attachment pills use the neutral styling and the bubble text layout is unchanged.
- **Verify**:
  - `bunx vitest run src/components/relay/EntityPill.spec.tsx src/components/relay/RelayMarkdown.spec.tsx src/components/relay/ChangeCard.spec.tsx src/components/relay/RelayConversation.spec.tsx`
  - `bunx biome check src/components/relay/EntityPill.tsx src/components/relay/RelayMarkdown.tsx src/components/relay/AttachmentPillRow.tsx src/components/relay/ChangeCard.tsx`
  - `test -z "$(grep -n "text-primary" src/components/relay/EntityPill.tsx src/components/relay/AttachmentPillRow.tsx)"`
  - Computed colour and contrast proven by E2E T3.22.

### ☐ T3.2 Turn timing model and duration formatter
- **Kind**: implementation
- **Traces**: CONV-01, CONV-02, CONV-03, CONV-11
- **Files** (3): `src/lib/relay/timing.ts` (new); `src/lib/relay/duration.ts` (new); `src/lib/relay/outgoingMessages.ts`
- **Depends on**: T3.1
- **Do**: `timing.ts` defines the `metadata.turn` type `{startedAt, endedAt?, status, steps[]}` and pure stamping helpers (start turn, start and end step, finish with status, mark interrupted on rehydrate, label resolver for Stopped, Failed, Interrupted and legacy). `duration.ts` exports one `formatDuration(seconds)` (`Ns` under 60, `Nm Ns` under 3600, `Nh Nm` above) used by both the live header and the group. `prepareOutgoingMessages()` strips `metadata.turn` from the outgoing body. Design: n/a, pure logic.
- **Acceptance**:
  - CONV-01: the stamping helpers produce the persisted shape and round-trip through JSON; `metadata.turn` never reaches the outgoing body.
  - CONV-02: `formatDuration` formats 0, 59, 60, 3599 and 3600 s as specified.
  - CONV-11: the label resolver returns "Stopped after Ns", "Failed after Ns", "Interrupted after Ns" (using the last step's `endedAt`, else `startedAt`) and the legacy "Worked" with no duration.
- **Verify**:
  - `bunx vitest run src/lib/relay/outgoingMessages.spec.ts`
  - `bunx biome check src/lib/relay/timing.ts src/lib/relay/duration.ts src/lib/relay/outgoingMessages.ts`
  - Full coverage in Unit T3.15.

### ☐ T3.3 Conversation copy (en, fr, ja)
- **Kind**: implementation
- **Traces**: CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-09, CONV-11
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: T3.2
- **Do**: Add the keys: "Working for {duration}", "Waiting for you", "Worked for {duration}", "Worked", "Stopped after {duration}", "Failed after {duration}", "Interrupted after {duration}", plural-aware step summary labels (read, searched, explored, created, updated), changes summary labels, "Undo all", disabled-Open reasons ("Deleted", "Undone"), the step-limit notice ("Relay reached its step limit for one message. Say 'continue' to keep going.") and "Skipped because the chat moved on". No registered tool names in values.
- **Acceptance**:
  - CONV-02..06, CONV-09 and CONV-11 copy exists in all three locales with plural forms where counts appear; the BUG-03 leak check still passes.
- **Verify**:
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/lib/relay/brandGuard.spec.ts`
  - `names=$(sed -n '/^export const RELAY_TOOL_SCHEMAS/,/^};/p' src/lib/relay/tools/schemas.ts | grep -oE '^  [a-z]+(_[a-z]+)+:' | tr -d ' :' | sort -u | paste -sd'|' -); test -n "$names" && test -z "$(jq -r '.. | strings' messages/*/relayDock.json messages/*/relay.json | grep -E "\\b($names)\\b")"`  (every key of `RELAY_TOOL_SCHEMAS`, values only, both namespaces)

### ☐ T3.4 Stamp turn timing in the chat hook
- **Kind**: implementation
- **Traces**: CONV-01, CONV-11
- **Files** (3): `src/hooks/useRelayChat.ts`; `src/stores/useRelayStore.ts`; `src/lib/relay/threadDb.ts`
- **Depends on**: T3.3
- **Do**: In `useRelayChat` stamp `metadata.turn` on the assistant message client-side: start on send, a step per thinking, tool, text and waiting (approval or question card) part, and finish with `done`, `stopped` (Stop or Relay disabled) or `error`. Persist through `threadDb`. On thread load, any turn still `running` is rewritten as interrupted by the label resolver without mutating `endedAt` invented data. Update the touched specs.
- **Acceptance**:
  - CONV-01: after a completed turn the persisted assistant message holds `metadata.turn` with ordered steps, and reloading yields the same data.
  - CONV-11: Stop and disable stamp `stopped`, an error stamps `error`, and a persisted `running` turn is treated as interrupted on load.
- **Verify**:
  - `bunx vitest run src/hooks/useRelayChat.spec.ts src/stores/useRelayStore.spec.ts src/lib/relay/threadDb.spec.ts`
  - `bunx biome check src/hooks/useRelayChat.ts src/stores/useRelayStore.ts src/lib/relay/threadDb.ts`
  - Reload equality proven by E2E T3.19.

### ☐ T3.5 Live "Working for Ns" header
- **Kind**: implementation
- **Traces**: CONV-02
- **Files** (4): `src/components/relay/WorkingHeader.tsx` (new); `src/components/relay/RelayActivityIndicator.tsx`; `src/components/relay/RelayConversation.tsx`; `src/components/relay/RelayActivityIndicator.spec.tsx`
- **Depends on**: T3.4
- **Design**: First run the `impeccable` and `layout` skills on the live header and step rows, record the decision in the task Log, then implement.
- **Do**: `WorkingHeader` ticks once per second from `startedAt` using `formatDuration`, replaces the "Thinking..." shimmer as the primary status and shows "Waiting for you" with the timer paused while a confirm or question card is pending (resumes after). Step rows stream beneath it.
- **Acceptance**:
  - CONV-02: while running the header reads "Working for Ns", ticks every second, reads "Waiting for you" with a paused timer while a card is pending, and the "Thinking..." shimmer is no longer the primary status.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayActivityIndicator.spec.tsx src/components/relay/RelayConversation.spec.tsx`
  - `bunx biome check src/components/relay/WorkingHeader.tsx src/components/relay/RelayActivityIndicator.tsx src/components/relay/RelayConversation.tsx`
  - Timer behaviour proven by Unit T3.15 and E2E T3.19.

### ☐ T3.6 Step summary function
- **Kind**: implementation
- **Traces**: CONV-04
- **Files** (2): `src/lib/relay/stepSummary.ts` (new); `src/lib/relay/stepLabels.ts`
- **Depends on**: T3.5
- **Do**: Add the pure `summariseSteps(steps)`: consecutive read steps of the same class collapse into one line with counts (for example "Read 3 requests, searched 2 times", "Explored 2 collections") while write steps stay individual and order is preserved. Labels come from plural-aware i18n keys, never raw tool names. Design: n/a, pure logic.
- **Acceptance**:
  - CONV-04: mixed sequences group only consecutive same-class reads, keep order, pluralise correctly and emit i18n keys, not tool names.
- **Verify**:
  - `bunx vitest run src/lib/relay/stepLabels.spec.ts`
  - `bunx biome check src/lib/relay/stepSummary.ts src/lib/relay/stepLabels.ts`
  - Full coverage in Unit T3.16.

### ☐ T3.7 "Worked for" collapsed group
- **Kind**: implementation
- **Traces**: CONV-03, CONV-04, CONV-11
- **Files** (5): `src/components/relay/WorkedGroup.tsx` (new); `src/components/relay/MessageParts.tsx`; `src/components/relay/RelayConversation.tsx`; `src/components/relay/ToolRow.tsx`; `src/components/relay/MessageParts.spec.tsx`
- **Depends on**: T3.6
- **Design**: First run the `impeccable` and `layout` skills on the group row and its expanded steps, record the decision in the task Log, then implement.
- **Do**: On completion fold every step, narration, tool row and ChangeCard into one collapsed row "Worked for Ns" with a right chevron closed and a down chevron open, `aria-expanded` and keyboard toggling. Expanded it shows each step in order with narration, grouped through `summariseSteps`, and a per-step duration on thinking steps and steps of 1 s or more. After the fold show only the final answer then the changes summary. A turn with no tool steps renders no group. Use the CONV-11 labels and the legacy "Worked" group (steps derived from parts).
- **Acceptance**:
  - CONV-03: the group is collapsed by default, keyboard toggleable with `aria-expanded`, shows ordered steps with narration and durations, and no group appears for a turn without tool steps.
  - CONV-04: expanded consecutive reads render as grouped lines.
  - CONV-11: Stopped, Failed, Interrupted and legacy labels render from fixtures.
- **Verify**:
  - `bunx vitest run src/components/relay/MessageParts.spec.tsx src/components/relay/RelayConversation.spec.tsx src/components/relay/ToolRow.spec.tsx`
  - `bunx biome check src/components/relay/WorkedGroup.tsx src/components/relay/MessageParts.tsx src/components/relay/RelayConversation.tsx src/components/relay/ToolRow.tsx`
  - Browser behaviour proven by E2E T3.19.

### ☐ T3.8 Stale cards inside the group
- **Kind**: implementation
- **Traces**: CONV-09
- **Files** (4): `src/components/relay/WorkedGroup.tsx`; `src/components/relay/AskUserCard.tsx`; `src/components/relay/ConfirmCard.tsx`; `src/components/relay/MessageParts.tsx`
- **Depends on**: T3.7
- **Do**: Render the muted "Skipped because the chat moved on" line inside the Worked group (not as dangling text under the assistant message) for stale or auto-declined cards. Answered cards stay readable inside the group with the chosen answer. Update `ConfirmCard.spec.tsx` and `AskUserCard.spec.tsx` (XC-01).
- **Acceptance**:
  - CONV-09: a stopped, errored, reloaded or superseded card shows as the muted line inside the Worked group; answered cards show their answer.
- **Verify**:
  - `bunx vitest run src/components/relay/AskUserCard.spec.tsx src/components/relay/ConfirmCard.spec.tsx src/components/relay/MessageParts.spec.tsx`
  - `bunx biome check src/components/relay/WorkedGroup.tsx src/components/relay/AskUserCard.tsx src/components/relay/ConfirmCard.tsx src/components/relay/MessageParts.tsx`

### ☐ T3.9 Changes summary model and Open resolution
- **Kind**: implementation
- **Traces**: CONV-05
- **Files** (4): `src/lib/relay/changesSummary.ts` (new); `src/lib/relay/changeLog.ts`; `src/lib/relay/openEntity.ts`; `src/components/relay/ChangeCard.tsx`
- **Depends on**: T3.8
- **Do**: Build the pure summary model from the change log for one turn: a headline ("Created 2 requests, 1 chain, updated 1 environment") plus one row per changed entity with an openable state. Extend `OPENABLE` (request, chain, collection, environment; folder opens its collection; a settings change opens Settings at its section) and the `openEntity` routes (`/chain/${id}`, environment, collection). Deleted entities resolve to a disabled Open with reason "Deleted", undone ones with "Undone". Design: n/a, model only.
- **Acceptance**:
  - CONV-05: the model yields the headline and one row per entity; Open resolves for every supported kind, and deleted or undone entities resolve to disabled with the matching reason.
- **Verify**:
  - `bunx vitest run src/lib/relay/changeLog.spec.ts src/lib/relay/openEntity.spec.ts src/components/relay/ChangeCard.spec.tsx`
  - `bunx biome check src/lib/relay/changesSummary.ts src/lib/relay/changeLog.ts src/lib/relay/openEntity.ts src/components/relay/ChangeCard.tsx`
  - Full coverage in Unit T3.17.

### ☐ T3.10 Changes summary UI; remove Show details
- **Kind**: implementation
- **Traces**: CONV-05, CONV-06, BUG-11
- **Files** (5): `src/components/relay/ChangesSummary.tsx` (new); `src/components/relay/TurnChangeBar.tsx`; `src/components/relay/ChangeCard.tsx`; `src/lib/relay/changeDiff.ts` (delete); `src/components/relay/ChangeCard.spec.tsx`
- **Depends on**: T3.9
- **Design**: First run the `layout` skill on the compact summary (headline, rows, Open, Undo all), record the decision in the task Log, then implement.
- **Do**: Render one compact summary after the final answer: a row per changed entity with an Open button and "Undo all" via `log.undoTurn(turnId)` shown while at least one change is not undone (reusing the `TurnChangeBar` logic). Per-change cards (`ChangeCard`) render only inside the Worked group. Delete the `ChangeDetails` UI and `buildChangeDiff` usage; delete `changeDiff.ts` if nothing else imports it (confirm with grep first and record the result). ChangeCard disclosure chevrons follow right closed, down open.
- **Acceptance**:
  - CONV-05: the summary shows after the answer with Open per row (disabled with a reason when deleted or undone) and "Undo all" only while something is undoable.
  - CONV-06: no "Show details" text or `ChangeDetails` component remains.
  - BUG-11: the ChangeCard disclosure chevron is right closed and down open.
- **Verify**:
  - `bunx vitest run src/components/relay/ChangeCard.spec.tsx src/components/relay/TurnChangeBar.spec.tsx src/components/relay/MessageParts.spec.tsx`
  - `bunx biome check src/components/relay/ChangesSummary.tsx src/components/relay/TurnChangeBar.tsx src/components/relay/ChangeCard.tsx`
  - `grep -rn "buildChangeDiff\|ChangeDetails" src | grep -v "\.spec\." ; test $? -eq 1`
  - Browser behaviour proven by E2E T3.20.

### ☐ T3.11 Remove the step counter; add the step-limit notice
- **Kind**: implementation
- **Traces**: CONV-06
- **Files** (5): `src/components/relay/RelayConversation.tsx`; `src/lib/relay/constants.ts`; `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: T3.10
- **Do**: Delete the "Step N of 12" block in `RelayConversation.tsx`, `RELAY_STEP_INDICATOR_AFTER` and the `step` key in all locales. When `RELAY_MAX_STEPS` stops a turn show the neutral inline notice under the answer, and nowhere else. Server `remainingSteps` and client `shouldContinueToolLoop` stay unchanged.
- **Acceptance**:
  - CONV-06: no "Step N of" text or `step` key remains; the limit notice renders if and only if the cap is hit.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rn "RELAY_STEP_INDICATOR_AFTER" src)"`

### ☐ T3.12 Chain tools have no navigation side effect
- **Kind**: implementation
- **Traces**: CONV-08
- **Files** (3): `src/lib/relay/tools/chainWrite.ts`; `src/lib/relay/server/systemPrompt.ts`; `src/lib/relay/server/systemPrompt.spec.ts`
- **Depends on**: T3.11
- **Do**: Confirm `create_chain` and the chain write tools make no router call and the prompt does not tell the model to open chains; remove anything found. Design: n/a, logic only.
- **Acceptance**:
  - CONV-08: no router or navigation call exists in the chain write tools; the prompt has no instruction to open a chain.
- **Verify**:
  - `bunx vitest run src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/tools`
  - `bunx biome check src/lib/relay/tools/chainWrite.ts src/lib/relay/server/systemPrompt.ts`

### ☐ T3.13 Open chain editor re-renders on Relay writes
- **Kind**: implementation
- **Traces**: CONV-08
- **Files** (4): `src/stores/useChainStore.ts`; `src/lib/relay/tools/chainWrite.ts`; `src/components/chain/canvas/hooks/useChainNodes.ts`; `src/components/chain/canvas/hooks/useChainEdges.ts`
- **Depends on**: T3.12
- **Do**: Reviewer spot check: the editor derives nodes in `useChainNodes.ts` from `useChainStore`/`useCollectionsStore` selectors plus the page's `useChainRequests`, and `useNodeCache` memoises each node on `block` identity. So the open editor updates only if `chainWrite.ts` (through `storeAccess`) commits new chain, node and edge objects through store actions, never by mutating in place or writing straight to IDB. Verify that for `add_chain_node`, `update_chain_node` and `connect_chain_nodes`; fix the write path (preferred) or the selector if not. Record the finding in the Log. Update the touched specs. Design: n/a, state propagation only.
- **Acceptance**:
  - CONV-08: a store update from the chain tools propagates to the open editor selector without a manual refresh.
- **Verify**:
  - `bunx vitest run src/stores/useChainStore.spec.ts src/lib/relay/tools/chainWrite.spec.ts src/components/chain/canvas/hooks/useChainNodes.spec.ts src/components/chain/canvas/hooks/useChainEdges.spec.ts`
  - `bunx biome check src/stores/useChainStore.ts src/lib/relay/tools/chainWrite.ts src/components/chain/canvas/hooks/useChainNodes.ts src/components/chain/canvas/hooks/useChainEdges.ts`
  - Browser behaviour proven by E2E T3.21.

### ☐ T3.14 Open button in the live step row
- **Kind**: implementation
- **Traces**: CONV-08, CONV-05
- **Files** (3): `src/components/relay/ToolRow.tsx`; `src/components/relay/ToolRow.spec.tsx`; `src/lib/relay/openEntity.ts`
- **Depends on**: T3.13
- **Do**: Show an Open button in the step row as soon as a created entity (including a chain) exists mid-turn; it navigates only on click through `openEntity`. Design: n/a, reuses the summary row Open styling from T3.10.
- **Acceptance**:
  - CONV-08: an Open button appears in the live step row once the chain exists, and no navigation happens until it is clicked.
- **Verify**:
  - `bunx vitest run src/components/relay/ToolRow.spec.tsx src/lib/relay/openEntity.spec.ts`
  - `bunx biome check src/components/relay/ToolRow.tsx src/lib/relay/openEntity.ts`

### ☐ T3.15 Unit: timing and duration
- **Kind**: unit
- **Traces**: CONV-01, CONV-02, CONV-11
- **Files** (3): `src/lib/relay/timing.ts`; `src/lib/relay/duration.ts`; `src/lib/relay/outgoingMessages.ts`
- **Depends on**: T3.14
- **Do**: Stamping helpers and JSON round-trip, legacy tolerance, every CONV-11 label from fixtures, `formatDuration` at 0, 59, 60, 3599, 3600, and `metadata.turn` stripped from the outgoing body.
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/timing.spec.ts src/lib/relay/duration.spec.ts src/lib/relay/outgoingMessages.spec.ts --coverage --coverage.include=src/lib/relay/timing.ts,src/lib/relay/duration.ts,src/lib/relay/outgoingMessages.ts --coverage.reporter=text`

### ☐ T3.16 Unit: header, step summary and group
- **Kind**: unit
- **Traces**: CONV-02, CONV-03, CONV-04, CONV-09
- **Files** (3): `src/components/relay/WorkingHeader.tsx`; `src/lib/relay/stepSummary.ts`; `src/components/relay/WorkedGroup.tsx`
- **Depends on**: T3.15
- **Do**: Fake-timer tests for ticking, pause on a pending card and resume; `summariseSteps` across mixed sequences, ordering and pluralisation; group collapsed by default, `aria-expanded`, no group without tool steps, stale-card line inside the group.
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/relay/WorkingHeader.spec.tsx src/lib/relay/stepSummary.spec.ts src/components/relay/WorkedGroup.spec.tsx --coverage --coverage.include=src/components/relay/WorkingHeader.tsx,src/lib/relay/stepSummary.ts,src/components/relay/WorkedGroup.tsx --coverage.reporter=text`

### ☐ T3.17 Unit: changes summary
- **Kind**: unit
- **Traces**: CONV-05, CONV-06
- **Files** (4): `src/lib/relay/changesSummary.ts`; `src/lib/relay/openEntity.ts`; `src/components/relay/ChangesSummary.tsx`; `src/components/relay/ChangeCard.tsx`
- **Depends on**: T3.16
- **Do**: Summary model from the change log, Open resolution per kind (folder opens its collection, settings opens Settings at its section), disabled Open with the Deleted and Undone reasons, "Undo all" visibility, no Show details.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/changesSummary.spec.ts src/lib/relay/openEntity.spec.ts src/components/relay/ChangesSummary.spec.tsx src/components/relay/ChangeCard.spec.tsx --coverage --coverage.include=src/lib/relay/changesSummary.ts,src/lib/relay/openEntity.ts,src/components/relay/ChangesSummary.tsx,src/components/relay/ChangeCard.tsx --coverage.reporter=text`

### ☐ T3.18 Unit: pills, cap notice and chain tools
- **Kind**: unit
- **Traces**: CONV-06, CONV-07, CONV-08
- **Files** (5): `src/components/relay/EntityPill.tsx`; `src/components/relay/RelayMarkdown.tsx`; `src/components/relay/RelayConversation.tsx`; `src/lib/relay/tools/chainWrite.ts`; `src/stores/useChainStore.ts`
- **Depends on**: T3.17
- **Do**: No `text-primary` on a pill or inline code; the cap notice is shown if and only if the cap is hit and no step counter renders; no router call from the chain tools; a store update propagates to the editor selector.
- **Acceptance**:
  - All five files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/relay/EntityPill.spec.tsx src/components/relay/RelayMarkdown.spec.tsx src/components/relay/RelayConversation.spec.tsx src/lib/relay/tools src/stores --coverage --coverage.include=src/components/relay/EntityPill.tsx,src/components/relay/RelayMarkdown.tsx,src/components/relay/RelayConversation.tsx,src/lib/relay/tools/chainWrite.ts,src/stores/useChainStore.ts --coverage.reporter=text`

### ☐ T3.19 E2E: live header, group, timing and the step-limit notice
- **Kind**: e2e
- **Traces**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-06, CONV-09, CONV-11
- **Files** (0): none (no app change)
- **Depends on**: T3.18
- **Gherkin**: `e2e/scenarios/relay/relay-v2-conversation.feature.md`: REL-V2-CONV-01..10
- **Spec**: `e2e/qa/relay/relay-v2-conversation.spec.ts`
- **Scenarios**:
  - `[REL-V2-CONV-01] a slow scripted turn shows "Working for Ns" ticking beneath step rows, then folds into a collapsed "Worked for Ns" row` @critical
  - `[REL-V2-CONV-02] after the fold only the final answer and the changes summary are visible` @critical
  - `[REL-V2-CONV-03] after reload the "Worked for" duration equals the value before the reload` @critical
  - `[REL-V2-CONV-04] a pending question card shows "Waiting for you" and the timer pauses` @high
  - `[REL-V2-CONV-05] expanding the group shows ordered steps, grouped read summaries and per-step durations` @high
  - `[REL-V2-CONV-06] a turn with no tool steps shows the answer and no "Worked for" row` @high
  - `[REL-V2-CONV-07] Stop shows "Stopped after Ns" and a stale card inside the group shows the skipped line` @high
  - `[REL-V2-CONV-08] a scripted error shows "Failed after Ns" and keeps the error message visible` @high
  - `[REL-V2-CONV-09] no "Show details" or "Step N of" text appears and the step-limit notice appears only when the scripted turn hits the cap` @critical
  - `[REL-V2-CONV-10] the group toggle is keyboard accessible with aria-expanded` @medium
- **Do**: Use the T0.3 scripted-stream helpers with delays. Interrupted-after-reload and legacy labels are covered by Unit T3.15 and T3.16 because they need hand-built persisted state.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-conversation.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T3.20 E2E: changes summary
- **Kind**: e2e
- **Traces**: CONV-05
- **Files** (0): none (no app change)
- **Depends on**: T3.18
- **Gherkin**: `e2e/scenarios/relay/relay-v2-changes.feature.md`: REL-V2-CHANGES-01..05
- **Spec**: `e2e/qa/relay/relay-v2-changes.spec.ts`
- **Scenarios**:
  - `[REL-V2-CHANGES-01] a mocked agent creates a request, chain, collection and environment; the summary shows one row per entity with an Open button` @critical
  - `[REL-V2-CHANGES-02] each Open navigates to the right route` @critical
  - `[REL-V2-CHANGES-03] Undo all reverts them and the summary shows them as undone with Open disabled and a tooltip` @critical
  - `[REL-V2-CHANGES-04] a deleted entity shows a disabled Open with the Deleted reason` @high
  - `[REL-V2-CHANGES-05] per-change cards appear only inside the expanded Worked group` @medium
- **Do**: The settings-change Open is covered in Phase 7 once settings tools exist.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-changes.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T3.21 E2E: chain live updates without navigation
- **Kind**: e2e
- **Traces**: CONV-08
- **Files** (0): none (no app change)
- **Depends on**: T3.18
- **Gherkin**: `e2e/scenarios/relay/relay-v2-chain-live.feature.md`: REL-V2-CHAINLIVE-01..03
- **Spec**: `e2e/qa/relay/relay-v2-chain-live.spec.ts`
- **Scenarios**:
  - `[REL-V2-CHAINLIVE-01] creating a chain via the mocked agent does not change the URL, and an Open button appears in the live step row` @critical
  - `[REL-V2-CHAINLIVE-02] with the chain page open, a mocked agent adding 3 nodes shows them without a reload` @critical
  - `[REL-V2-CHAINLIVE-03] clicking Open navigates to /chain/<id>` @high
- **Do**: Use scripted tool calls for `create_chain`, `add_chain_node` and `connect_chain_nodes`.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-chain-live.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T3.22 E2E: neutral pill colours
- **Kind**: e2e
- **Traces**: CONV-07, CONV-10
- **Files** (0): none (no app change)
- **Depends on**: T3.18
- **Gherkin**: `e2e/scenarios/relay/relay-v2-pills.feature.md`: REL-V2-PILLS-01..04
- **Spec**: `e2e/qa/relay/relay-v2-pills.spec.ts`
- **Scenarios**:
  - `[REL-V2-PILLS-01] light theme: the computed color of every [data-relay-pill] and inline code differs from a var(--primary) probe` @critical
  - `[REL-V2-PILLS-02] dark theme: the same comparison holds` @critical
  - `[REL-V2-PILLS-03] contrast of pill text against its background is at least 4.5:1 in both themes` @high
  - `[REL-V2-PILLS-04] the user bubble attachment pills are neutral and method badges keep their colour` @medium
- **Do**: Compare computed rgb values, not the raw variable, using the T0.3 colour helper.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-pills.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T3.23 E2E: migrate XC-01 conversation specs for Phase 3
- **Kind**: e2e
- **Traces**: XC-01, CONV-03, CONV-05, CONV-06, CONV-07, CONV-09
- **Files** (0): none (no app change)
- **Depends on**: T3.19, T3.20, T3.21, T3.22
- **Gherkin**: existing `e2e/scenarios/relay/` files for the specs below (edited only where a changed behaviour is asserted)
- **Spec**: `e2e/qa/relay/relay-chat.spec.ts`; `e2e/qa/relay/relay-confirm.spec.ts`; `e2e/qa/relay/relay-write.spec.ts`; `e2e/qa/relay/relay-polish-msg.spec.ts`; `e2e/qa/relay/relay-improvements-pills.spec.ts`; `e2e/qa/relay/relay-improvements-smart-diff.spec.ts`; `e2e/qa/relay/relay-improvements-qol-stop.spec.ts`; `e2e/qa/relay/relay-improvements-loading.spec.ts`
- **Scenarios**:
  - `[REL-CONV-MIGRATE-01] chat, confirm and write specs pass with the Worked group, the changes summary and the Skipped line placement` @critical
  - `[REL-CONV-MIGRATE-02] pills, smart-diff, stop and loading specs pass with neutral pills, no Show details and the Working header` @high
- **Do**: Rewrite assertions of removed behaviour (Show details tables, step counter, accent pills, thinking shimmer, dangling Skipped text) to the new behaviour; never weaken. Other cases do not apply (migration of existing coverage).
- **Acceptance**:
  - All listed specs pass with no deleted assertion lacking an equivalent.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-write.spec.ts e2e/qa/relay/relay-polish-msg.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-smart-diff.spec.ts e2e/qa/relay/relay-improvements-qol-stop.spec.ts e2e/qa/relay/relay-improvements-loading.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T3.24 Checkpoint 3
- **Kind**: gate
- **Traces**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07, CONV-08, CONV-09, CONV-10, CONV-11, XC-01
- **Files** (0): none (verification only)
- **Depends on**: T3.23
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check. A human reviews before Phase 4.
- **Acceptance**:
  - All commands below exit 0 and the Phase 3 "Try in UI" steps hold.
- **Verify**:
  - `bunx vitest run src/components/relay src/hooks src/stores src/lib/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-conversation.spec.ts e2e/qa/relay/relay-v2-changes.spec.ts e2e/qa/relay/relay-v2-chain-live.spec.ts e2e/qa/relay/relay-v2-pills.spec.ts e2e/qa/relay/relay-v2-bugs.spec.ts e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-write.spec.ts e2e/qa/relay/relay-polish-msg.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-smart-diff.spec.ts e2e/qa/relay/relay-improvements-qol-stop.spec.ts e2e/qa/relay/relay-improvements-loading.spec.ts --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`

🔶 **Checkpoint 3**: live header, Worked group, changes summary, neutral pills and chain live updates proven; XC-01 conversation specs rewritten and green; human review before Phase 4.

---

## Phase 4: Composer

**Adds:** The message box becomes a rich editor where attached items and slash commands sit inline as pills at the caret, can be removed with Backspace and clear on send. The sent bubble shows the same pills in the same order, and dictation lands at the caret.

**Try in UI:** Type text, press @ and pick a request, and confirm an inline pill appears at the caret ; Type / and pick a command, then press Backspace to delete the pill as one unit ; Send and confirm the editor is empty and the bubble shows the same pills in order ; Dictate and confirm the text lands at the caret without disturbing the pills

### ☐ T4.1 Add Tiptap dependencies
- **Kind**: implementation
- **Traces**: COMP-01
- **Files** (2): `package.json`; `bun.lock`
- **Depends on**: T3.24
- **Do**: Tiptap is pre-approved by the SPEC and is the only new dependency in this epic. Per SPEC Assumption 7, add only `@tiptap/react`, `@tiptap/pm`, `@tiptap/core`, `@tiptap/suggestion` and the individual extensions for document, paragraph, text, hard break, placeholder and undo/redo, with `bun add`. Do not add `@tiptap/starter-kit`. Extension packaging differs between Tiptap majors, so confirm the exact package names against the major being installed and confirm it supports React 19.2.3; record the chosen packages in the Log. Do not run `npm`. Design: n/a, dependency only.
- **Acceptance**:
  - COMP-01: the Tiptap packages (react, pm, core, suggestion and the individual extensions used) are in `package.json` and `bun.lock`; `@tiptap/starter-kit` is absent; no other dependency changed.
- **Verify**:
  - `grep -n "@tiptap" package.json`
  - `bun pm ls 2>/dev/null | grep -c tiptap`  (expect 1 or more)
  - `git diff --stat package.json bun.lock`
  - `! grep -q "starter-kit" package.json`  (StarterKit is not used)

### ☐ T4.2 Editor serializer and PromptEditor shell
- **Kind**: implementation
- **Traces**: COMP-01, COMP-07
- **Files** (3): `src/lib/relay/editorSerializer.ts` (new); `src/components/relay/PromptEditor.tsx` (new); `src/components/relay/editorTypes.ts` (new)
- **Depends on**: T4.1
- **Do**: `editorSerializer.ts` is pure: editor JSON to `{text, segments[], attachments[], commands[]}` where `text` keeps readable tokens (`/command`, `@name`); define the types in `editorTypes.ts`. `PromptEditor` is a client-only Tiptap editor (`immediatelyRender: false`) with Enter to send, Shift+Enter for a newline, an IME composition guard, plain-text paste, autosize up to the existing max height, `role="textbox"` with a label, and placeholder. Design: n/a, reuses the composer's existing styling with shadcn tokens; the pill look comes from T3.1.
- **Acceptance**:
  - COMP-01: Enter sends, Shift+Enter inserts a newline, Enter during composition does not send, paste is plain text, the editor mounts client-side only, and serialisation returns text, segments, attachments and commands.
  - COMP-07: content of only whitespace is not sendable.
- **Verify**:
  - Logic of the new modules is proven by the Unit tasks later in this phase (their specs do not exist yet).
  - `bunx biome check src/lib/relay/editorSerializer.ts src/components/relay/PromptEditor.tsx src/components/relay/editorTypes.ts`
  - Full coverage in Unit T4.10 and T4.11.

### ☐ T4.3 Swap the composer textarea for the editor
- **Kind**: implementation
- **Traces**: COMP-01, COMP-02
- **Files** (4): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/components/relay/ComposerPills.tsx` (delete); `src/components/relay/ComposerPills.spec.tsx` (delete)
- **Depends on**: T4.2
- **Do**: Replace the textarea in `RelayComposer.tsx` with `PromptEditor` and remove the separate `ComposerPills` row (delete it and its spec once nothing imports it; confirm with grep). Keep the existing send, stop, mic and permission behaviour. Update `RelayComposer.spec.tsx` (XC-01) and keep every still-valid assertion.
- **Acceptance**:
  - COMP-01: the composer uses the editor and keeps Enter to send, Shift+Enter newline and autosize.
  - COMP-02: no separate `ComposerPills` row remains.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx`
  - `bunx biome check src/components/relay/RelayComposer.tsx`
  - `test -z "$(grep -rn "ComposerPills" src | grep -v "\.spec\.")"`

### ☐ T4.4 Attachment pill node and @ suggestion
- **Kind**: implementation
- **Traces**: COMP-02, COMP-07
- **Files** (4): `src/components/relay/AttachmentPillNode.tsx` (new); `src/lib/relay/mentionSuggestion.ts` (new); `src/components/relay/PromptEditor.tsx`; `src/components/relay/MentionMenu.tsx`
- **Depends on**: T4.3
- **Do**: An atomic inline Tiptap node renders `EntityPill` (icon or method badge plus name, neutral) with an accessible name. The `@` trigger (via `@tiptap/suggestion`) and the BUG-02 picker insert the node at the caret in place of the old `@label` text. Backspace deletes the whole pill. A pill whose entity is deleted while still in the composer renders as "deleted" (muted, tooltip). Update the MentionMenu spec.
- **Acceptance**:
  - COMP-02: choosing an item inserts an atomic pill at the caret, Backspace removes the whole pill, and the pill has an accessible name.
  - COMP-07: a pill whose entity was deleted renders in the deleted state.
- **Verify**:
  - `bunx vitest run src/components/relay/MentionMenu.spec.tsx`
  - `bunx biome check src/components/relay/AttachmentPillNode.tsx src/lib/relay/mentionSuggestion.ts src/components/relay/PromptEditor.tsx src/components/relay/MentionMenu.tsx`

### ☐ T4.5 Derived attachments, whitespace rule, clear on send
- **Kind**: implementation
- **Traces**: COMP-02, COMP-04, COMP-06, COMP-07
- **Files** (4): `src/components/relay/RelayComposer.tsx`; `src/hooks/useRelayChat.ts`; `src/stores/useRelayStore.ts`; `src/lib/relay/editorSerializer.ts`
- **Depends on**: T4.4
- **Do**: `attachedItems` is derived from the editor content (single source of truth), so removing a pill removes the attachment and stale chips cannot occur. Send is allowed when there is non-whitespace text or at least one pill. After send the editor empties (text, pills, derived attachments). The attachments sent are exactly the pills in that message and a deleted-entity pill is sent as a "no longer exists" note, not as detail. Update the touched specs.
- **Acceptance**:
  - COMP-02: removing a pill removes the attachment; no stale chip state exists in the store.
  - COMP-04: after send the editor, pills and derived attachments are empty.
  - COMP-06: the sent attachments equal the pills in that message.
  - COMP-07: whitespace-only content is not sendable unless a pill is present; a deleted-entity pill is sent as a note.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayChat.spec.ts src/stores/useRelayStore.spec.ts`
  - `bunx biome check src/components/relay/RelayComposer.tsx src/hooks/useRelayChat.ts src/stores/useRelayStore.ts src/lib/relay/editorSerializer.ts`

### ☐ T4.6 Slash-command pill node
- **Kind**: implementation
- **Traces**: COMP-03
- **Files** (5): `src/components/relay/CommandPillNode.tsx` (new); `src/lib/relay/slashSuggestion.ts` (new); `src/hooks/useSlashCommandRunner.ts`; `src/components/relay/SlashMenu.tsx`; `src/hooks/useCapabilityStarter.ts`
- **Depends on**: T4.5
- **Do**: Selecting a slash command inserts a highlighted inline command pill (it may appear mid-sentence). If the command needs a target the BUG-02 picker opens and the chosen target is inserted as an attachment pill right after the command pill. The command resolves at send. Update the touched specs.
- **Acceptance**:
  - COMP-03: a command pill is inserted inline and may sit mid-sentence; a target-needing command opens the picker and inserts the attachment pill immediately after it; the command resolves at send.
- **Verify**:
  - `bunx vitest run src/hooks/useSlashCommandRunner.spec.ts src/hooks/useCapabilityStarter.spec.ts`
  - `bunx biome check src/components/relay/CommandPillNode.tsx src/lib/relay/slashSuggestion.ts src/hooks/useSlashCommandRunner.ts src/components/relay/SlashMenu.tsx src/hooks/useCapabilityStarter.ts`

### ☐ T4.7 Draft stores segments
- **Kind**: implementation
- **Traces**: COMP-04
- **Files** (4): `src/stores/useRelayStore.ts`; `src/lib/relay/openInRelay.ts`; `src/components/relay/RelayComposer.tsx`; `src/components/relay/PromptEditor.tsx`
- **Depends on**: T4.6
- **Do**: Replace the flat-text draft (`openWithDraft`) with segments so pills survive; the draft loads into the editor on open. Update the touched specs.
- **Acceptance**:
  - COMP-04: a draft opened via `openWithDraft` keeps its pills in the editor and clears on send like any other content.
- **Verify**:
  - `bunx vitest run src/stores/useRelayStore.spec.ts src/lib/relay/openInRelay.spec.ts src/components/relay/RelayComposer.spec.tsx`
  - `bunx biome check src/stores/useRelayStore.ts src/lib/relay/openInRelay.ts src/components/relay/RelayComposer.tsx src/components/relay/PromptEditor.tsx`

### ☐ T4.8 Persisted segments and identical bubble pills
- **Kind**: implementation
- **Traces**: COMP-05, CONV-10
- **Files** (5): `src/lib/relay/segments.ts` (new); `src/hooks/useRelayChat.ts`; `src/components/relay/RelayConversation.tsx`; `src/lib/relay/outgoingMessages.ts`; `src/components/relay/AttachmentPillRow.tsx`
- **Depends on**: T4.7
- **Do**: `segments.ts` builds the structured segments (text runs, attachment pills, command pills) from the serialised editor and stores them in `message.metadata`. The user bubble renders the segments in order with the same pill component; legacy text-only messages render as before (the BUG-01 row remains the fallback for messages with attachments but no segments). `prepareOutgoingMessages()` strips segments from older messages. Update the touched specs (XC-01).
- **Acceptance**:
  - COMP-05: a sent message's bubble renders text, attachment pills and command pills inline in the order typed, using the same pill component; legacy messages are unchanged.
  - Segments never reach the outgoing body for older messages.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx src/hooks/useRelayChat.spec.ts src/lib/relay/outgoingMessages.spec.ts`
  - `bunx biome check src/lib/relay/segments.ts src/hooks/useRelayChat.ts src/components/relay/RelayConversation.tsx src/lib/relay/outgoingMessages.ts src/components/relay/AttachmentPillRow.tsx`

### ☐ T4.9 Dictation inserts at the caret
- **Kind**: implementation
- **Traces**: COMP-07
- **Files** (4): `src/hooks/useSpeechDictation.ts`; `src/components/relay/MicButton.tsx`; `src/components/relay/PromptEditor.tsx`; `src/hooks/useSpeechDictation.spec.ts`
- **Depends on**: T4.8
- **Do**: Dictated text is inserted at the editor caret as plain text without disturbing existing pills. Update the touched specs.
- **Acceptance**:
  - COMP-07: dictation text lands at the caret as plain text and existing pills are unchanged.
- **Verify**:
  - `bunx vitest run src/hooks/useSpeechDictation.spec.ts src/components/relay/MicButton.spec.tsx`
  - `bunx biome check src/hooks/useSpeechDictation.ts src/components/relay/MicButton.tsx src/components/relay/PromptEditor.tsx`

### ☐ T4.10 Unit: serializer and segments
- **Kind**: unit
- **Traces**: COMP-01, COMP-04, COMP-05, COMP-07
- **Files** (2): `src/lib/relay/editorSerializer.ts`; `src/lib/relay/segments.ts`
- **Depends on**: T4.9
- **Do**: Serialise to text, segments, attachments and commands; serialise to render round-trip; the segment builder; whitespace and pill-only sendability; stripping from older messages.
- **Acceptance**:
  - Both files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/editorSerializer.spec.ts src/lib/relay/segments.spec.ts --coverage --coverage.include=src/lib/relay/editorSerializer.ts,src/lib/relay/segments.ts --coverage.reporter=text`

### ☐ T4.11 Unit: editor and pill nodes
- **Kind**: unit
- **Traces**: COMP-01, COMP-02, COMP-03, COMP-07
- **Files** (3): `src/components/relay/PromptEditor.tsx`; `src/components/relay/AttachmentPillNode.tsx`; `src/components/relay/CommandPillNode.tsx`
- **Depends on**: T4.10
- **Do**: Enter versus Shift+Enter, the IME composition guard, paste sanitisation, pill insert and Backspace delete, derive on remove, deleted-entity pill state, command pill mid-sentence.
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/relay/PromptEditor.spec.tsx src/components/relay/AttachmentPillNode.spec.tsx src/components/relay/CommandPillNode.spec.tsx --coverage --coverage.include=src/components/relay/PromptEditor.tsx,src/components/relay/AttachmentPillNode.tsx,src/components/relay/CommandPillNode.tsx --coverage.reporter=text`

### ☐ T4.12 Unit: composer, chat hook and dictation
- **Kind**: unit
- **Traces**: COMP-04, COMP-06, COMP-07
- **Files** (4): `src/components/relay/RelayComposer.tsx`; `src/hooks/useRelayChat.ts`; `src/hooks/useSpeechDictation.ts`; `src/hooks/useSlashCommandRunner.ts`
- **Depends on**: T4.11
- **Do**: Clear on send, derived attachments equal the pills sent, deleted-entity note, draft with segments, caret insertion of dictation, slash command followed by its target pill.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayChat.spec.ts src/hooks/useSpeechDictation.spec.ts src/hooks/useSlashCommandRunner.spec.ts --coverage --coverage.include=src/components/relay/RelayComposer.tsx,src/hooks/useRelayChat.ts,src/hooks/useSpeechDictation.ts,src/hooks/useSlashCommandRunner.ts --coverage.reporter=text`

### ☐ T4.13 Unit: bubble render and draft store
- **Kind**: unit
- **Traces**: COMP-05, COMP-04
- **Files** (4): `src/components/relay/RelayConversation.tsx`; `src/components/relay/AttachmentPillRow.tsx`; `src/stores/useRelayStore.ts`; `src/lib/relay/openInRelay.ts`
- **Depends on**: T4.12
- **Do**: Segment render order, legacy text-only message, attachment-row fallback, segment draft round-trip through the store.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx src/components/relay/AttachmentPillRow.spec.tsx src/stores/useRelayStore.spec.ts src/lib/relay/openInRelay.spec.ts --coverage --coverage.include=src/components/relay/RelayConversation.tsx,src/components/relay/AttachmentPillRow.tsx,src/stores/useRelayStore.ts,src/lib/relay/openInRelay.ts --coverage.reporter=text`

### ☐ T4.14 E2E: editing with pills in the composer
- **Kind**: e2e
- **Traces**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-07
- **Files** (0): none (no app change)
- **Depends on**: T4.13
- **Gherkin**: `e2e/scenarios/relay/relay-v2-composer.feature.md`: REL-V2-COMPOSER-01..09
- **Spec**: `e2e/qa/relay/relay-v2-composer.spec.ts`
- **Scenarios**:
  - `[REL-V2-COMPOSER-01] @ opens the picker and choosing a request inserts an inline pill at the caret` @critical
  - `[REL-V2-COMPOSER-02] Backspace right after a pill deletes the whole pill and the attachment` @critical
  - `[REL-V2-COMPOSER-03] a slash command inserts a command pill mid-sentence` @critical
  - `[REL-V2-COMPOSER-04] a target-needing command opens the picker and the chosen target pill follows the command pill` @high
  - `[REL-V2-COMPOSER-05] Enter sends and Shift+Enter inserts a newline` @critical
  - `[REL-V2-COMPOSER-06] whitespace-only content cannot be sent but a lone pill can` @high
  - `[REL-V2-COMPOSER-07] a pasted rich-text snippet arrives as plain text` @medium
  - `[REL-V2-COMPOSER-08] dictated text (mocked) lands at the caret without disturbing the pills` @high
  - `[REL-V2-COMPOSER-09] a pill whose request was deleted renders as deleted` @medium
- **Do**: IME composition is covered by Unit T4.11 because Playwright cannot drive a real IME reliably.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-composer.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T4.15 E2E: send, bubble parity and persistence
- **Kind**: e2e
- **Traces**: COMP-04, COMP-05, COMP-06
- **Files** (0): none (no app change)
- **Depends on**: T4.13
- **Gherkin**: `e2e/scenarios/relay/relay-v2-send.feature.md`: REL-V2-SEND-01..05
- **Spec**: `e2e/qa/relay/relay-v2-send.spec.ts`
- **Scenarios**:
  - `[REL-V2-SEND-01] type text, insert an attachment and a slash command, send: the bubble shows the pills inline in the same order and the composer is empty` @critical
  - `[REL-V2-SEND-02] after reload the persisted bubble still shows the same pills in order` @critical
  - `[REL-V2-SEND-03] the mocked request body has resolved detail on the last user message only and no segments on older messages` @high
  - `[REL-V2-SEND-04] a draft opened through an Open-in-Relay entry keeps its pills and clears on send` @high
  - `[REL-V2-SEND-05] a legacy text-only message seeded in IDB renders as plain text` @medium
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-send.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T4.16 E2E: editor accessibility and 256 KB budget
- **Kind**: e2e
- **Traces**: COMP-01, COMP-06
- **Files** (0): none (no app change)
- **Depends on**: T4.13
- **Gherkin**: `e2e/scenarios/relay/relay-v2-composer-a11y.feature.md`: REL-V2-COMPA11Y-01..04
- **Spec**: `e2e/qa/relay/relay-v2-composer-a11y.spec.ts`
- **Scenarios**:
  - `[REL-V2-COMPA11Y-01] the editor exposes role textbox with an accessible label and pills have accessible names` @critical
  - `[REL-V2-COMPA11Y-02] keyboard only: type, open the picker, pick with arrows and Enter, and send` @high
  - `[REL-V2-COMPA11Y-03] axe reports no serious or critical violations on the composer` @high
  - `[REL-V2-COMPA11Y-04] with 10 large attachments and a long history the captured request body stays under 256 KB and the turn is sent` @high
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-composer-a11y.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T4.17 E2E: migrate XC-01 composer, mention, slash and context specs
- **Kind**: e2e
- **Traces**: XC-01, COMP-01, COMP-02, COMP-03
- **Files** (0): none (no app change)
- **Depends on**: T4.14, T4.15, T4.16
- **Gherkin**: existing `e2e/scenarios/relay/` files for the specs below (edited only where a changed behaviour is asserted)
- **Spec**: `e2e/qa/relay/relay-polish-composer.spec.ts`; `e2e/qa/relay/relay-polish-mention.spec.ts`; `e2e/qa/relay/relay-polish-slash.spec.ts`; `e2e/qa/relay/relay-polish-ctx.spec.ts`; `e2e/qa/relay/relay-improvements-context-chip.spec.ts`; `e2e/qa/relay/relay-improvements-context-payload.spec.ts`; `e2e/qa/relay/relay-improvements-picker.spec.ts`; `e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts`; `e2e/qa/relay/relay-improvements-voice.spec.ts`
- **Scenarios**:
  - `[REL-COMPOSER-MIGRATE-01] composer, mention, slash and picker specs drive the editor instead of the textarea` @critical
  - `[REL-COMPOSER-MIGRATE-02] context chip, payload, keyboard and voice specs assert pills, derived attachments and caret insertion` @high
- **Do**: Selectors that targeted the textarea or the `ComposerPills` row move to the editor and pill test ids; never weaken. Other cases do not apply (migration of existing coverage).
- **Acceptance**:
  - All listed specs pass with no deleted assertion lacking an equivalent.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-polish-composer.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts e2e/qa/relay/relay-polish-slash.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-voice.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T4.18 Checkpoint 4
- **Kind**: gate
- **Traces**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, XC-01
- **Files** (0): none (verification only)
- **Depends on**: T4.17
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check. A human reviews before Phase 5.
- **Acceptance**:
  - All commands below exit 0 and the Phase 4 "Try in UI" steps hold.
- **Verify**:
  - `bunx vitest run src/components/relay src/hooks src/stores src/lib/relay`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-composer.spec.ts e2e/qa/relay/relay-v2-send.spec.ts e2e/qa/relay/relay-v2-composer-a11y.spec.ts e2e/qa/relay/relay-v2-bugs.spec.ts e2e/qa/relay/relay-polish-composer.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts e2e/qa/relay/relay-polish-slash.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-voice.spec.ts --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`

🔶 **Checkpoint 4**: the editor, inline pills, clear on send, bubble parity and caret dictation are proven; XC-01 composer specs rewritten and green; human review before Phase 5.

---

## Phase 5: Empty state and capabilities popover

**Adds:** A new Relay chat opens with three or four suggestions chosen from what you have open, and a quiet "See everything Relay can do" link. The capabilities popover becomes one calm list with "asks first" markers and a privacy footer instead of tabs.

**Try in UI:** Open Relay with a request open and confirm the suggestions mention that request ; Click a suggestion with a known target and confirm it sends ; Click "See everything Relay can do" and confirm the popover is one scrollable list with no tabs, a privacy footer and "Change approval mode"

### ☐ T5.1 Suggestion picker and copy
- **Kind**: implementation
- **Traces**: EMPTY-01
- **Files** (4): `src/lib/relay/suggestions.ts` (new); `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: T4.18
- **Do**: Add the pure `pickSuggestions(context)` returning an ordered list of at most 4 `{id, ...}` items: request open ("Explain <request name>"), chain open (chain-oriented), environment open (env-oriented), nothing open (generic starters: create a request, import cURL, explore workspace). Add the copy in all three locales with no tool names. Design: n/a, pure logic and copy.
- **Acceptance**:
  - EMPTY-01: `pickSuggestions` returns context-matched ids for request, chain, environment and nothing-open contexts, never more than 4; copy exists in all locales.
- **Verify**:
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `bunx biome check src/lib/relay/suggestions.ts`
  - Full coverage in Unit T5.5.

### ☐ T5.2 Empty state with suggestions and a quiet link
- **Kind**: implementation
- **Traces**: EMPTY-01, EMPTY-02
- **Files** (4): `src/components/relay/EmptyState.tsx`; `src/components/relay/EmptyState.spec.tsx`; `src/hooks/useCapabilityStarter.ts`; `src/components/relay/RelayDock.tsx`
- **Depends on**: T5.1
- **Design**: First run the `impeccable` and `layout` skills on the empty state, record the decision in the task Log, then implement.
- **Do**: Render the 3-4 suggestion buttons from `pickSuggestions`. A suggestion with a known target inserts the command plus a target pill and sends; a generic starter opens the BUG-02 picker. Under the suggestions add a text-style link "See everything Relay can do" that opens the capabilities popover; remove any large grids. Update the specs.
- **Acceptance**:
  - EMPTY-01: the empty state shows the picked suggestions and a known-target suggestion inserts the command plus pill and sends; a generic starter opens the picker.
  - EMPTY-02: a quiet text link under the suggestions opens the popover and no large grid remains.
- **Verify**:
  - `bunx vitest run src/components/relay/EmptyState.spec.tsx src/hooks/useCapabilityStarter.spec.ts src/components/relay/RelayDock.spec.tsx`
  - `bunx biome check src/components/relay/EmptyState.tsx src/hooks/useCapabilityStarter.ts src/components/relay/RelayDock.tsx`
  - Browser behaviour proven by E2E T5.6.

### ☐ T5.3 Capabilities popover copy
- **Kind**: implementation
- **Traces**: EMPTY-03
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: T5.2
- **Do**: Add one short sentence per `CAPABILITY_CATEGORIES` area, the "asks first" marker label and the "What Relay can see" footer wording reflecting `shareValues`. Remove the keys the tabs used once nothing references them.
- **Acceptance**:
  - EMPTY-03: area sentences, the marker and the privacy footer exist in all locales and no tab-only key remains.
- **Verify**:
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`

### ☐ T5.4 Single-list capabilities popover
- **Kind**: implementation
- **Traces**: EMPTY-03
- **Files** (5): `src/components/relay/CapabilitiesPanel.tsx`; `src/components/relay/CapabilitiesPopover.tsx`; `src/components/relay/CapabilitySeeList.tsx`; `src/lib/relay/capabilities.ts`; `src/components/relay/CapabilitiesPanel.spec.tsx`
- **Depends on**: T5.3
- **Design**: First run the `impeccable` and `layout` skills on the single list, markers and footer, record the decision in the task Log, then implement.
- **Do**: Remove the tabs and render one calm scrollable list (max height) with an icon and one sentence per area, an "asks first" marker only where approval applies (from `capabilityBadge`), a "What Relay can see" footer and the retained "Change approval mode" action. Everything is keyboard reachable. Update the spec (XC-01).
- **Acceptance**:
  - EMPTY-03: no `role="tablist"` in the popover, it scrolls inside a max height, every row and action is keyboard reachable, the marker appears only where approval applies, the footer is shown and "Change approval mode" is retained.
- **Verify**:
  - `bunx vitest run src/components/relay/CapabilitiesPanel.spec.tsx src/components/relay/CapabilitiesPopover.spec.tsx src/lib/relay/capabilities.spec.ts`
  - `bunx biome check src/components/relay/CapabilitiesPanel.tsx src/components/relay/CapabilitiesPopover.tsx src/components/relay/CapabilitySeeList.tsx src/lib/relay/capabilities.ts`
  - Browser behaviour proven by E2E T5.7.

### ☐ T5.5 Unit: suggestions and capabilities model
- **Kind**: unit
- **Traces**: EMPTY-01, EMPTY-03
- **Files** (4): `src/lib/relay/suggestions.ts`; `src/lib/relay/capabilities.ts`; `src/components/relay/EmptyState.tsx`; `src/components/relay/CapabilitiesPanel.tsx`
- **Depends on**: T5.4
- **Do**: `pickSuggestions` for each context and the max-4 rule, the category-to-row model, the asks-first marker rules, no tablist, the empty-state click behaviour.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/suggestions.spec.ts src/lib/relay/capabilities.spec.ts src/components/relay/EmptyState.spec.tsx src/components/relay/CapabilitiesPanel.spec.tsx --coverage --coverage.include=src/lib/relay/suggestions.ts,src/lib/relay/capabilities.ts,src/components/relay/EmptyState.tsx,src/components/relay/CapabilitiesPanel.tsx --coverage.reporter=text`

### ☐ T5.6 E2E: context-aware empty state
- **Kind**: e2e
- **Traces**: EMPTY-01, EMPTY-02
- **Files** (0): none (no app change)
- **Depends on**: T5.5
- **Gherkin**: `e2e/scenarios/relay/relay-v2-empty.feature.md`: REL-V2-EMPTY-01..06
- **Spec**: `e2e/qa/relay/relay-v2-empty.spec.ts`
- **Scenarios**:
  - `[REL-V2-EMPTY-01] with a request open the empty state shows 3 to 4 suggestions including "Explain <request name>"` @critical
  - `[REL-V2-EMPTY-02] with a chain open the suggestions are chain-oriented` @high
  - `[REL-V2-EMPTY-03] with an environment open the suggestions are env-oriented` @high
  - `[REL-V2-EMPTY-04] with nothing open the generic starters are shown` @high
  - `[REL-V2-EMPTY-05] clicking a known-target suggestion inserts the command plus pill and sends` @critical
  - `[REL-V2-EMPTY-06] clicking a generic starter opens the picker, and "See everything Relay can do" opens the popover` @high
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-empty.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T5.7 E2E: single-list capabilities popover
- **Kind**: e2e
- **Traces**: EMPTY-03
- **Files** (0): none (no app change)
- **Depends on**: T5.5
- **Gherkin**: `e2e/scenarios/relay/relay-v2-popover.feature.md`: REL-V2-POPOVER-01..04
- **Spec**: `e2e/qa/relay/relay-v2-popover.spec.ts`
- **Scenarios**:
  - `[REL-V2-POPOVER-01] the popover has no tablist and the "What Relay can see" footer is visible` @critical
  - `[REL-V2-POPOVER-02] the list scrolls inside a max height and every row and action is keyboard reachable` @high
  - `[REL-V2-POPOVER-03] the asks-first marker appears only on areas where approval applies` @high
  - `[REL-V2-POPOVER-04] "Change approval mode" still opens the mode selector` @critical
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-popover.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T5.8 E2E: migrate XC-01 capability and launcher specs
- **Kind**: e2e
- **Traces**: XC-01, EMPTY-01, EMPTY-03
- **Files** (0): none (no app change)
- **Depends on**: T5.6, T5.7
- **Gherkin**: existing `e2e/scenarios/relay/` files for the specs below (edited only where a changed behaviour is asserted)
- **Spec**: `e2e/qa/relay/relay-polish-caps.spec.ts`; `e2e/qa/relay/relay-polish-launcher.spec.ts`; `e2e/qa/relay/relay-polish-panel.spec.ts`; `e2e/qa/relay/relay-polish-perm.spec.ts`
- **Scenarios**:
  - `[REL-CAPS-MIGRATE-01] capability, launcher, panel and permission specs assert the single list, the quiet link and the context-aware starters` @high
- **Do**: Rewrite assertions of the removed tabs and big grids to the new behaviour; never weaken. Other cases do not apply (migration of existing coverage).
- **Acceptance**:
  - All listed specs pass with no deleted assertion lacking an equivalent.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-panel.spec.ts e2e/qa/relay/relay-polish-perm.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T5.9 Checkpoint 5
- **Kind**: gate
- **Traces**: EMPTY-01, EMPTY-02, EMPTY-03, XC-01
- **Files** (0): none (verification only)
- **Depends on**: T5.8
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check. A human reviews before Phase 6.
- **Acceptance**:
  - All commands below exit 0 and the Phase 5 "Try in UI" steps hold.
- **Verify**:
  - `bunx vitest run src/components/relay src/lib/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-empty.spec.ts e2e/qa/relay/relay-v2-popover.spec.ts e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-panel.spec.ts e2e/qa/relay/relay-polish-perm.spec.ts --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`

🔶 **Checkpoint 5**: the context-aware empty state and the single-list popover are proven in the browser; XC-01 capability specs rewritten and green; human review before Phase 6.

---

## Phase 6: Workspace backup

**Adds:** Settings gets a Data section to export a versioned backup file (everything or a chosen subset, secrets off by default) and restore it with Merge or an atomic Replace, after a validation and preview step. The Import page links to the same restore flow.

**Try in UI:** Open Settings, Data, press Export backup, keep secrets off and download the file ; Open the file and confirm secret values are empty ; Press Import backup, pick the file and read the preview counts ; Choose Merge and confirm nothing existing is overwritten ; Choose Replace and confirm the destructive confirmation lists the counts

### ☐ T6.1 Backup constants, schema and secret policy
- **Kind**: implementation
- **Traces**: BAK-01, BAK-02, BAK-08
- **Files** (3): `src/lib/backup/constants.ts` (new); `src/lib/backup/schema.ts` (new); `src/lib/backup/secrets.ts` (new)
- **Depends on**: T5.9
- **Do**: `constants.ts` holds `BACKUP_APP_ID = "requestr-backup"`, `BACKUP_SCHEMA_VERSION = 1`, `BACKUP_SIZE_WARN_BYTES` (100 MB) and the section names. `schema.ts` is the zod envelope (`app`, `schemaVersion`, `idbVersion`, `exportedAt`, `appVersion`, `includesSecrets`, `sections`, `data` with keys only for included sections). `secrets.ts` is the single source of truth for the BAK-08 list and exports `applySecretPolicy(data, {includeSecrets})`: blank `EnvVariable` values where `isSecret`, `bearer.token`, `basic.password`, `api-key.value` everywhere a request snapshot lives (requests, `history[].request`, chain node requests, chainRuns), the header values named authorization, proxy-authorization, cookie, set-cookie, x-api-key and x-auth-token (case-insensitive) in request headers, `settings.globalHeaders`, history request and response headers, chain node requests and chainRuns, and the password in `settings.proxyUrl` (`user:pass@host` to `user:@host`). Values that are a pure `{{name}}` reference are kept. Design: n/a, pure logic.
- **Acceptance**:
  - BAK-01: the envelope schema accepts the documented shape and rejects a wrong `app` or missing keys.
  - BAK-02 and BAK-08: with secrets OFF every listed field path is `""` and no sentinel secret appears in the serialised JSON; with ON all sentinels survive; `{{var}}` references are kept.
- **Verify**:
  - Logic of the new modules is proven by the Unit tasks later in this phase (their specs do not exist yet).
  - `bunx biome check src/lib/backup/constants.ts src/lib/backup/schema.ts src/lib/backup/secrets.ts`
  - Full coverage in Unit T6.15.

### ☐ T6.2 Preferences allow-list
- **Kind**: implementation
- **Traces**: BAK-01
- **Files** (2): `src/lib/backup/preferences.ts` (new); `src/stores/useRelayStore.ts`
- **Depends on**: T6.1
- **Do**: `preferences.ts` reads and writes the allow-listed localStorage keys: `requestly_active_env_id`, `rq_collapsed_folders`, `rq_sidebar_open_sections`, `requestly_imported_hub_slugs`, `rq_relay_enabled`, `rq_relay_permission_mode`, `rq_relay_share_values`, `rq_relay_speech_engine`. Excluded: `rq_anon_id`, `rq_onboarding_complete` (set to true on import), volatile Relay state (`rq_relay_open`, width, active thread, onboarded, recent, mention request), `rq_chain_*` and the tabs store. The `rq_relay_speech_engine` storage key constant is exported from `useRelayStore.ts` for reuse (the store field itself lands in Phase 7). Design: n/a.
- **Acceptance**:
  - BAK-01: only allow-listed keys are read or written; excluded keys never appear in the output; onboarding is set complete on import.
- **Verify**:
  - `bunx vitest run src/stores/useRelayStore.spec.ts`
  - `bunx biome check src/lib/backup/preferences.ts src/stores/useRelayStore.ts`

### ☐ T6.3 Exporter, selection and size estimate
- **Kind**: implementation
- **Traces**: BAK-01, BAK-03
- **Files** (4): `src/lib/backup/exporter.ts` (new); `src/lib/backup/selection.ts` (new); `src/lib/backup/sizeEstimate.ts` (new); `src/lib/idb.ts`
- **Depends on**: T6.2
- **Do**: `exporter.ts` reads raw IDB records per section unchanged (ids, timestamps, ordering; chain data in the persisted shape) and assembles the file as Blob parts per section (no single giant string). Section map: collections (collections, folders, requests, chainConfigs keyed by `collectionId`), environments, chains, history (history, chainRuns), settings (the app record, plus `preferences` automatically), relayThreads (relay_threads, relay_changes). `selection.ts` turns selected ids into a subset: a selected collection auto-includes its folders, requests and chainConfigs; dangling references to unselected items are kept and counted. `sizeEstimate.ts` returns the estimated bytes and per-section counts. `idb.ts` gets only a read helper if one is missing; `IDB_VERSION` stays 6. Design: n/a.
- **Acceptance**:
  - BAK-01: `sections` lists only included sections and `data` only their keys; records are exported unchanged.
  - BAK-03: a selected collection brings its folders, requests and chainConfigs; the dangling-reference count is returned; per-section counts and an estimated size are available before download.
- **Verify**:
  - Logic of the new modules is proven by the Unit tasks later in this phase (their specs do not exist yet).
  - `bunx biome check src/lib/backup/exporter.ts src/lib/backup/selection.ts src/lib/backup/sizeEstimate.ts src/lib/idb.ts`
  - `grep -n "IDB_VERSION" src/lib/idbSchema.ts`  (value stays 6)

### ☐ T6.4 Validation and migrations
- **Kind**: implementation
- **Traces**: BAK-05
- **Files** (3): `src/lib/backup/validate.ts` (new); `src/lib/backup/migrations.ts` (new); `src/lib/backup/errors.ts` (new)
- **Depends on**: T6.3
- **Do**: `validate.ts` parses the text and returns a typed result: not-valid-JSON, foreign file (`app !== "requestr-backup"`, with a link to `/import`), newer `schemaVersion`, older with no migration, damaged section ("The backup is damaged: {section} is invalid."), plus a non-blocking large-file warning over `BACKUP_SIZE_WARN_BYTES`. `migrations.ts` runs a migration when `schemaVersion` is below supported and one exists. `errors.ts` holds the typed error codes mapped to i18n keys. Nothing is written on any failure. Design: n/a.
- **Acceptance**:
  - BAK-05: each condition in the SPEC table yields its distinct typed error code; a damaged section writes nothing; a file over 100 MB returns the warning but still validates.
- **Verify**:
  - Logic of the new modules is proven by the Unit tasks later in this phase (their specs do not exist yet).
  - `bunx biome check src/lib/backup/validate.ts src/lib/backup/migrations.ts src/lib/backup/errors.ts`

### ☐ T6.5 Backup copy (en, fr, ja)
- **Kind**: implementation
- **Traces**: BAK-02, BAK-03, BAK-04, BAK-05, BAK-07, BAK-09
- **Files** (3): `messages/en/settings.json`; `messages/fr/settings.json`; `messages/ja/settings.json`
- **Depends on**: T6.4
- **Do**: Add all backup strings under a `backup` group: section labels, "Include secret values" and its warning ("Anyone with this file can read your secrets. Store it securely." plus the saved-responses note), the Relay threads note ("Conversations may contain values you shared with Relay."), the size and count labels, preview labels, the Merge and Replace descriptions, the Replace confirmation ("Replace workspace", counts per section), every BAK-05 message (with `{n}` and `{section}` placeholders), the large-backup warning, the restore summary and dangling-reference count, and the Import page card. Plain language, no tool names.
- **Acceptance**:
  - Every message the SPEC names exists in all three locales and the parity specs pass.
- **Verify**:
  - `bunx vitest run src/i18n/messages.parity.spec.ts`
  - `grep -c "Replace workspace" messages/en/settings.json`  (expect 1 or more)

### ☐ T6.6 Id remap and Merge import
- **Kind**: implementation
- **Traces**: BAK-04
- **Files** (3): `src/lib/backup/remap.ts` (new); `src/lib/backup/importer.ts` (new); `src/lib/backup/mergeRules.ts` (new)
- **Depends on**: T6.5
- **Do**: Merge adds records whose id is absent, skips deep-equal records (ignoring `updatedAt`) so re-importing the same file is a no-op, and for a same-id record with different content keeps both: the incoming record gets a new id and, for collection, environment, chain and request, the suffix " (imported)"; history entries are never renamed. `remap.ts` rewrites references through the id-remap table: folder to collection, request to collection or folder, chain node to request, chainConfigs `collectionId`, chainRuns to chain, `settings.pinnedRequestIds`, `rq_collapsed_folders` and the active env id. Existing data is never overwritten; settings and preferences keep existing values and add only absent keys; merged `relay_changes` are marked not undoable. Design: n/a.
- **Acceptance**:
  - BAK-04 Merge: colliding ids keep both records with remapped references and no new orphan references; identical records are skipped; re-importing the same file changes nothing; existing settings values win.
- **Verify**:
  - Logic of the new modules is proven by the Unit tasks later in this phase (their specs do not exist yet).
  - `bunx biome check src/lib/backup/remap.ts src/lib/backup/importer.ts src/lib/backup/mergeRules.ts`

### ☐ T6.7 Atomic Replace
- **Kind**: implementation
- **Traces**: BAK-04, BAK-06
- **Files** (3): `src/lib/backup/replace.ts` (new); `src/lib/backup/importer.ts`; `src/lib/idb.ts`
- **Depends on**: T6.6
- **Do**: Replace clears only the stores of the sections present in the file and then writes the incoming data inside one readwrite IDB transaction spanning every affected store; any failure aborts and nothing changes. localStorage preferences are written only after the commit. Expose the per-section delete counts for the confirmation dialog. Design: n/a.
- **Acceptance**:
  - BAK-04 Replace: sections not in the file are untouched; an injected failure rolls everything back; preferences are written only after a successful commit; delete counts match the stores.
  - BAK-06: `export(import(export(x)))` equals `export(x)` for fixtures, excluding `exportedAt`.
- **Verify**:
  - Logic of the new modules is proven by the Unit tasks later in this phase (their specs do not exist yet).
  - `bunx biome check src/lib/backup/replace.ts src/lib/backup/importer.ts src/lib/idb.ts`

### ☐ T6.8 Post-restore reconciliation and broadcast
- **Kind**: implementation
- **Traces**: BAK-09
- **Files** (4): `src/lib/backup/reconcile.ts` (new); `src/lib/backup/broadcast.ts` (new); `src/stores/useTabsStore.ts`; `src/lib/backup/importer.ts`
- **Depends on**: T6.7
- **Do**: After Replace or Merge close tabs whose request id no longer exists, count dangling references for the restore summary, and post a `BroadcastChannel` message so other open Requestr tabs reload. The restoring tab then performs the full page reload so every store rehydrates. Design: n/a.
- **Acceptance**:
  - BAK-09: tabs for missing requests are closed, the dangling count is reported, other tabs receive the reload message, and a reload follows a restore.
- **Verify**:
  - Logic of the new modules is proven by the Unit tasks later in this phase (their specs do not exist yet).
  - `bunx biome check src/lib/backup/reconcile.ts src/lib/backup/broadcast.ts src/stores/useTabsStore.ts src/lib/backup/importer.ts`

### ☐ T6.9 Missing-request placeholder copy (en, fr, ja)
- **Kind**: implementation
- **Traces**: BAK-09
- **Files** (3): `messages/en/chain.json`; `messages/fr/chain.json`; `messages/ja/chain.json`
- **Depends on**: T6.8
- **Do**: Reviewer spot check: no missing-request placeholder exists today. `useChainRequests` computes `missingIds` but nothing consumes it, and `page.tsx` builds nodes only from resolved requests, so a node whose request was deleted is silently dropped. Add the placeholder strings: the node title ("Missing request"), its hint ("This request was deleted or not restored. Remove the block from the chain.") and the disabled-run reason. Plain language, no tool names.
- **Acceptance**:
  - BAK-09: the placeholder title, hint and disabled-run reason exist in all three locales and the parity specs pass.
- **Verify**:
  - `bunx vitest run src/i18n/chainMessages.parity.spec.ts`
  - `grep -c "Missing request" messages/en/chain.json`  (expect 1 or more)

### ☐ T6.10 Chain node placeholder for a missing request
- **Kind**: implementation
- **Traces**: BAK-09
- **Files** (5): `src/app/chain/[collectionId]/page.tsx`; `src/app/chain/[collectionId]/page.spec.tsx`; `src/components/chain/canvas/hooks/chainNodeBuilders.ts`; `src/components/chain/nodes/ChainNode.tsx`; `src/components/chain/nodes/ChainNode.spec.tsx`
- **Depends on**: T6.9
- **Design**: Reuse the `NodeShell` broken-reference treatment that `SubChainNode` already uses for a deleted sub-chain; no new visual language. Run `layout` on the placeholder node and record the decision in the task Log.
- **Do**: In `page.tsx` read `missingIds` from `useChainRequests` and add a placeholder request model per missing id (keeping its saved position and edges) flagged `missing: true`. `chainNodeBuilders.ts` passes the flag into `ChainNodeData`. `ChainNode.tsx` renders the broken state with the T6.9 title and hint and disables run, edit and duplicate; delete stays available. Confirm the page's existing broken-graph run guard blocks a run that includes the placeholder. Update the touched specs (`page.spec.tsx` and `ChainNode.spec.tsx`).
- **Acceptance**:
  - BAK-09: a chain node whose request is missing renders the placeholder in place (position and edges kept), does not crash, cannot be run or edited, and can be deleted.
- **Verify**:
  - `bunx vitest run src/components/chain/nodes/ChainNode.spec.tsx "src/app/chain/[collectionId]/page.spec.tsx" src/hooks/useChainRequests.spec.ts`
  - `bunx biome check "src/app/chain/[collectionId]/page.tsx" src/components/chain/canvas/hooks/chainNodeBuilders.ts src/components/chain/nodes/ChainNode.tsx`
  - Browser behaviour proven by E2E T6.22.

### ☐ T6.11 Settings Data section shell
- **Kind**: implementation
- **Traces**: BAK-07
- **Files** (4): `src/components/settings/DataSection.tsx` (new); `src/app/settings/constants.ts`; `src/app/settings/SettingsPageClient.tsx`; `src/components/settings/DataSection.spec.tsx` (new)
- **Depends on**: T6.10
- **Design**: First run the `ui-ux-pro-max` skill for the Data section and the backup flow, record the decision in the task Log, then run `impeccable` and `layout` on the final output before implementing.
- **Do**: Add a "Data" entry to `constants.ts` and render `DataSection` in `SettingsPageClient.tsx` with "Export backup" and "Import backup" actions (each opens its dialog; dialog state is local React state). The per-collection Postman export is unchanged. Update the settings specs that enumerate sections.
- **Acceptance**:
  - BAK-07: Settings has a Data section with Export backup and Import backup; the Postman export is unchanged.
- **Verify**:
  - `bunx vitest run src/components/settings`
  - `bunx biome check src/components/settings/DataSection.tsx src/app/settings/constants.ts src/app/settings/SettingsPageClient.tsx`

### ☐ T6.12 Export dialog
- **Kind**: implementation
- **Traces**: BAK-02, BAK-03, BAK-07
- **Files** (4): `src/components/settings/backup/ExportBackupDialog.tsx` (new); `src/components/settings/backup/BackupSectionPicker.tsx` (new); `src/components/settings/backup/useBackupExport.ts` (new); `src/components/settings/DataSection.tsx`
- **Depends on**: T6.11
- **Design**: Follow the T6.11 `ui-ux-pro-max` decision, then run `impeccable` and `layout` on the dialog, record it in the Log, then implement.
- **Do**: "Everything" or "Choose" with section checkboxes (collections, environments, chains, history, settings, Relay threads) and a searchable list of individual collections, environments and chains in Choose mode. Relay threads are off by default with the conversations note. "Include secret values" is OFF by default with the warning, which stays visible while on. Show per-section counts, the dangling-reference count and the estimated size before the Export button downloads the Blob.
- **Acceptance**:
  - BAK-02: the secrets toggle defaults off, shows the warning and keeps it while on.
  - BAK-03: Choose mode lists sections and searchable items, shows counts and the estimated size, and Relay threads default off with the note.
- **Verify**:
  - `bunx vitest run src/components/settings/backup`
  - `bunx biome check src/components/settings/backup src/components/settings/DataSection.tsx`
  - Browser behaviour proven by E2E T6.21.

### ☐ T6.13 Import dialog with preview, modes and Replace confirmation
- **Kind**: implementation
- **Traces**: BAK-04, BAK-05, BAK-07, BAK-09
- **Files** (5): `src/components/settings/backup/ImportBackupDialog.tsx` (new); `src/components/settings/backup/BackupPreview.tsx` (new); `src/components/settings/backup/ReplaceConfirmDialog.tsx` (new); `src/components/settings/backup/useBackupImport.ts` (new); `src/components/settings/DataSection.tsx`
- **Depends on**: T6.12
- **Design**: Follow the T6.11 `ui-ux-pro-max` decision, then run `impeccable` and `layout` on the dialogs, record it in the Log, then implement.
- **Do**: File pick or drop, then validate (show the mapped BAK-05 message with the `/import` link for a foreign file, and the large-file warning), then a preview (counts per section, `exportedAt`, `includesSecrets`) and a mode choice with Merge as the default. Replace opens `ReplaceConfirmDialog` stating the counts to be deleted per section with a destructive "Replace workspace" button; it never applies silently. After success show the restore summary (including dangling references) and reload.
- **Acceptance**:
  - BAK-04: the flow is choose file, validate, preview, choose mode; Merge is the default; Replace always requires the confirmation with per-section delete counts.
  - BAK-05: each invalid-file case shows its message and writes nothing.
- **Verify**:
  - `bunx vitest run src/components/settings/backup`
  - `bunx biome check src/components/settings/backup src/components/settings/DataSection.tsx`
  - Browser behaviour proven by E2E T6.22.

### ☐ T6.14 Import page restore card
- **Kind**: implementation
- **Traces**: BAK-07
- **Files** (3): `src/app/import/page.tsx`; `src/components/import/RestoreBackupCard.tsx` (new); `src/components/import/RestoreBackupCard.spec.tsx` (new)
- **Depends on**: T6.13
- **Design**: Follow the T6.11 decision, then run `impeccable` and `layout` on the card, record it in the Log, then implement.
- **Do**: Add a "Restore a Requestr backup" card to the Import page that opens the same import dialog (reuse `ImportBackupDialog`; do not duplicate the flow).
- **Acceptance**:
  - BAK-07: the Import page shows the card and it opens the same restore flow.
- **Verify**:
  - `bunx vitest run src/components/import`
  - `bunx biome check src/app/import/page.tsx src/components/import/RestoreBackupCard.tsx`

### ☐ T6.15 Unit: secrets, schema and preferences
- **Kind**: unit
- **Traces**: BAK-01, BAK-02, BAK-08
- **Files** (3): `src/lib/backup/secrets.ts`; `src/lib/backup/schema.ts`; `src/lib/backup/preferences.ts`
- **Depends on**: T6.14
- **Do**: A property test over fixtures seeded with sentinel secret strings: OFF leaves no sentinel in the serialised JSON, ON keeps all; every BAK-08 field path (including `history[].request` and response `Authorization`/`Cookie`/`Set-Cookie`, the proxy password); `{{var}}` kept; schema accepts and rejects; allow-list and exclusions.
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/backup/secrets.spec.ts src/lib/backup/schema.spec.ts src/lib/backup/preferences.spec.ts --coverage --coverage.include=src/lib/backup/secrets.ts,src/lib/backup/schema.ts,src/lib/backup/preferences.ts --coverage.reporter=text`

### ☐ T6.16 Unit: exporter, selection and size
- **Kind**: unit
- **Traces**: BAK-01, BAK-03
- **Files** (3): `src/lib/backup/exporter.ts`; `src/lib/backup/selection.ts`; `src/lib/backup/sizeEstimate.ts`
- **Depends on**: T6.15
- **Do**: Section to store mapping, `sections` and `data` key parity, selection to subset including the folders, requests and chainConfigs of selected collections, the dangling-reference count, per-section counts and the size estimate.
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/backup/exporter.spec.ts src/lib/backup/selection.spec.ts src/lib/backup/sizeEstimate.spec.ts --coverage --coverage.include=src/lib/backup/exporter.ts,src/lib/backup/selection.ts,src/lib/backup/sizeEstimate.ts --coverage.reporter=text`

### ☐ T6.17 Unit: validation and migrations
- **Kind**: unit
- **Traces**: BAK-05
- **Files** (3): `src/lib/backup/validate.ts`; `src/lib/backup/migrations.ts`; `src/lib/backup/errors.ts`
- **Depends on**: T6.16
- **Do**: Every error path with a fixture (invalid JSON, foreign file, newer version, unsupported older version, damaged section), the migration path, the large-file warning, and that every message key exists in all locales.
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/backup/validate.spec.ts src/lib/backup/migrations.spec.ts src/i18n/messages.parity.spec.ts --coverage --coverage.include=src/lib/backup/validate.ts,src/lib/backup/migrations.ts,src/lib/backup/errors.ts --coverage.reporter=text`

### ☐ T6.18 Unit: remap and Merge
- **Kind**: unit
- **Traces**: BAK-04, BAK-06
- **Files** (3): `src/lib/backup/remap.ts`; `src/lib/backup/importer.ts`; `src/lib/backup/mergeRules.ts`
- **Depends on**: T6.17
- **Do**: Colliding ids with remap integrity and no new orphan references, identical-record skip, the " (imported)" suffix and history never renamed, settings keep-existing, merged changes not undoable, and the round trip `export(import(export(x)))`.
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/backup/remap.spec.ts src/lib/backup/importer.spec.ts src/lib/backup/mergeRules.spec.ts --coverage --coverage.include=src/lib/backup/remap.ts,src/lib/backup/importer.ts,src/lib/backup/mergeRules.ts --coverage.reporter=text`

### ☐ T6.19 Unit: Replace and reconciliation
- **Kind**: unit
- **Traces**: BAK-04, BAK-09
- **Files** (4): `src/lib/backup/replace.ts`; `src/lib/backup/reconcile.ts`; `src/lib/backup/broadcast.ts`; `src/components/chain/nodes/ChainNode.tsx`
- **Depends on**: T6.18
- **Do**: An injected failure rolls everything back, sections not in the file are untouched, preferences are written only after commit, tab reconciliation, the dangling count and the broadcast message. For `ChainNode.tsx`, cover the T6.10 missing-request placeholder (broken state, run/edit/duplicate disabled, delete enabled).
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/backup/replace.spec.ts src/lib/backup/reconcile.spec.ts src/lib/backup/broadcast.spec.ts src/components/chain/nodes/ChainNode.spec.tsx --coverage --coverage.include=src/lib/backup/replace.ts,src/lib/backup/reconcile.ts,src/lib/backup/broadcast.ts,src/components/chain/nodes/ChainNode.tsx --coverage.reporter=text`

### ☐ T6.20 Unit: backup dialogs
- **Kind**: unit
- **Traces**: BAK-02, BAK-03, BAK-04, BAK-07
- **Files** (4): `src/components/settings/backup/ExportBackupDialog.tsx`; `src/components/settings/backup/ImportBackupDialog.tsx`; `src/components/settings/backup/ReplaceConfirmDialog.tsx`; `src/components/settings/DataSection.tsx`
- **Depends on**: T6.19
- **Do**: Secrets default off with the persistent warning, Relay threads default off with the note, Merge default, Replace confirmation lists counts and cannot be bypassed, error messages render for each BAK-05 code.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/settings --coverage --coverage.include=src/components/settings/backup/ExportBackupDialog.tsx,src/components/settings/backup/ImportBackupDialog.tsx,src/components/settings/backup/ReplaceConfirmDialog.tsx,src/components/settings/DataSection.tsx --coverage.reporter=text`

### ☐ T6.21 E2E: export
- **Kind**: e2e
- **Traces**: BAK-01, BAK-02, BAK-03, BAK-07
- **Files** (0): none (no app change)
- **Depends on**: T6.20
- **Gherkin**: `e2e/scenarios/relay/relay-v2-backup-export.feature.md`: REL-V2-BAKEXP-01..06
- **Spec**: `e2e/qa/relay/relay-v2-backup-export.spec.ts`
- **Scenarios**:
  - `[REL-V2-BAKEXP-01] Settings, Data shows Export backup and Import backup` @critical
  - `[REL-V2-BAKEXP-02] exporting everything with secrets off downloads a file with app requestr-backup, includesSecrets false and every seeded secret sentinel blank` @critical
  - `[REL-V2-BAKEXP-03] turning Include secret values on shows the warning and the downloaded file contains the sentinels with includesSecrets true` @critical
  - `[REL-V2-BAKEXP-04] Choose mode with one collection selected exports only that collection with its folders and requests, and shows per-section counts before download` @high
  - `[REL-V2-BAKEXP-05] Relay threads are unticked by default and show the conversations note` @medium
  - `[REL-V2-BAKEXP-06] the exported file does not include excluded preferences such as rq_anon_id` @high
- **Do**: Use the T0.3 `downloadCapture` helper and seed sentinel secrets. Error and deep-link cases do not apply to export.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-backup-export.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T6.22 E2E: import, validation and reconciliation
- **Kind**: e2e
- **Traces**: BAK-04, BAK-05, BAK-07, BAK-09
- **Files** (0): none (no app change)
- **Depends on**: T6.20
- **Gherkin**: `e2e/scenarios/relay/relay-v2-backup-import.feature.md`: REL-V2-BAKIMP-01..09
- **Spec**: `e2e/qa/relay/relay-v2-backup-import.spec.ts`
- **Scenarios**:
  - `[REL-V2-BAKIMP-01] a non-JSON file shows "This file is not valid JSON." and writes nothing` @critical
  - `[REL-V2-BAKIMP-02] a Postman collection file shows the not-a-Requestr-backup message with a link to /import` @critical
  - `[REL-V2-BAKIMP-03] a newer schemaVersion shows the update-the-app message` @high
  - `[REL-V2-BAKIMP-04] a damaged section shows "The backup is damaged" and writes nothing` @high
  - `[REL-V2-BAKIMP-05] a valid file shows the preview with counts, exportedAt and includesSecrets, and Merge is the default` @critical
  - `[REL-V2-BAKIMP-06] Merge of the same file twice changes nothing the second time and colliding records are kept as " (imported)"` @critical
  - `[REL-V2-BAKIMP-07] Replace requires the confirmation that lists counts and Cancel changes nothing` @critical
  - `[REL-V2-BAKIMP-08] Replace with a backup missing a request that a chain node references: the chain page renders the placeholder and the restore summary reports the dangling count` @critical
  - `[REL-V2-BAKIMP-09] the Import page shows the "Restore a Requestr backup" card which opens the restore flow` @medium
- **Do**: Feed files with `setInputFiles`. The 100 MB warning is covered by Unit T6.17.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-backup-import.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T6.23 E2E: two-context round trip
- **Kind**: e2e
- **Traces**: BAK-06, BAK-04, BAK-09
- **Files** (0): none (no app change)
- **Depends on**: T6.20
- **Gherkin**: `e2e/scenarios/relay/relay-v2-backup.feature.md`: REL-V2-BACKUP-01..04
- **Spec**: `e2e/qa/relay/relay-v2-backup.spec.ts`
- **Scenarios**:
  - `[REL-V2-BACKUP-01] export all sections with secrets on in context A, import with Replace in a fresh context B, and every IDB store dump (ids, fields, ordering) plus the data.preferences keys equals the source` @critical
  - `[REL-V2-BACKUP-02] the same round trip with secrets off differs only in the blanked BAK-08 fields` @critical
  - `[REL-V2-BACKUP-03] after Replace the page reloads and a second open tab of the same profile receives the reload message` @high
  - `[REL-V2-BACKUP-04] tabs for requests missing after the restore are closed` @high
- **Do**: Use the T0.3 `twoContexts`, download capture and IDB dump helpers.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-backup.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T6.24 Checkpoint 6
- **Kind**: gate
- **Traces**: BAK-01, BAK-02, BAK-03, BAK-04, BAK-05, BAK-06, BAK-07, BAK-08, BAK-09, XC-01
- **Files** (0): none (verification only)
- **Depends on**: T6.21, T6.22, T6.23
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check. A human reviews before Phase 7. No existing XC-01 spec asserts backup behaviour, so Phase 6 needs no migration task; `e2e/settings.spec.ts` runs as the regression check for the new Settings Data section (it navigates by section test ids, so the added entry should not break it).
- **Acceptance**:
  - All commands below exit 0 and the Phase 6 "Try in UI" steps hold.
- **Verify**:
  - `bunx vitest run src/lib/backup src/components/settings src/components/import src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-backup-export.spec.ts e2e/qa/relay/relay-v2-backup-import.spec.ts e2e/qa/relay/relay-v2-backup.spec.ts e2e/settings.spec.ts --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`

🔶 **Checkpoint 6**: export, import (Merge and atomic Replace), validation, reconciliation and the two-context round trip are proven; human review before Phase 7.

---

## Phase 7: Relay tools

**Adds:** Relay can read and change app settings, navigate the app, export and import backups, duplicate collections, chains and environments, manage folders, export to Postman and import an API catalog, always with Undo, approval where destructive, and plain-language cards. It still cannot change the approval mode or wipe data.

**Try in UI:** Ask Relay to switch to dark theme and confirm the theme changes and the summary offers Open Settings and Undo ; Ask Relay to open the Environments page and the History tab ; Ask Relay to export a backup and confirm the approval card lists sections and counts before anything downloads ; Ask Relay to change the approval mode and confirm it explains you must do that in Settings

### ☐ T7.1 Tool step labels (en, fr, ja)
- **Kind**: implementation
- **Traces**: TOOL-06, TOOL-01, TOOL-02, TOOL-03, TOOL-04
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: T6.24
- **Do**: Add `tools.<name>.running` and `tools.<name>.done`, plus the live `activity.tools.<name>` line, for every new tool: `get_app_settings`, `set_theme`, `set_language`, `update_proxy_settings`, `set_global_variables`, `set_relay_preferences`, `open_page`, `show_sidebar_tab`, `export_backup`, `import_backup`, `duplicate_collection`, `duplicate_chain`, `duplicate_environment`, `create_folder`, `rename_folder`, `delete_folder`, `export_postman`, `import_api_catalog`. Values are plain language and never contain a tool name.
- **Acceptance**:
  - TOOL-06: each new tool has running and done labels in all three locales; the BUG-03 leak check still passes. The shell check below sees only tools already registered; the new tool names (registered in T7.2 to T7.10) are covered by the registry-iterating Unit T7.19.
- **Verify**:
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/lib/relay/brandGuard.spec.ts`
  - `names=$(sed -n '/^export const RELAY_TOOL_SCHEMAS/,/^};/p' src/lib/relay/tools/schemas.ts | grep -oE '^  [a-z]+(_[a-z]+)+:' | tr -d ' :' | sort -u | paste -sd'|' -); test -n "$names" && test -z "$(jq -r '.. | strings' messages/*/relayDock.json messages/*/relay.json | grep -E "\\b($names)\\b")"`  (every key of `RELAY_TOOL_SCHEMAS`, values only, both namespaces)

### ☐ T7.2 get_app_settings with masking
- **Kind**: implementation
- **Traces**: TOOL-01
- **Files** (4): `src/lib/relay/tools/appSettings.ts` (new); `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/backup/secrets.ts`
- **Depends on**: T7.1
- **Do**: Register `get_app_settings` (read): theme, language (`locale`), accent colour, proxy config (credentials in `proxyUrl` masked, `sslVerify`, `followRedirects`), global base URL, global headers (BAK-08 header values masked unless `shareValues`) and the Relay prefs (enabled, shareValues, speechEngine); the permission mode is reported read-only. Reuse the BAK-08 masking from `secrets.ts` rather than a second list. Design: n/a, no UI.
- **Acceptance**:
  - TOOL-01: the tool returns all listed settings, masks proxy credentials always, masks BAK-08 header values unless `shareValues`, and reports the permission mode read-only.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/schemas.spec.ts`
  - `bunx biome check src/lib/relay/tools/appSettings.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts src/lib/backup/secrets.ts`

### ☐ T7.3 Settings write tools with Undo
- **Kind**: implementation
- **Traces**: TOOL-01
- **Files** (5): `src/lib/relay/tools/settingsWrite.ts` (new); `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/changeLog.ts`; `src/stores/useSettingsStore.ts`
- **Depends on**: T7.2
- **Do**: Register `set_theme`, `set_language`, `update_proxy_settings` and `set_global_variables` (`globalBaseUrl` and `globalHeaders`, matching `GlobalSection.tsx`), all auto. Each calls the same store action the Settings UI calls (locate it; add a store method only if the UI mutates state inline). Each change is recorded in the change log with an Undo that restores the previous value. Update the touched specs.
- **Acceptance**:
  - TOOL-01: each tool mirrors the Settings UI action, is recorded in the change log and Undo restores the previous value.
- **Verify**:
  - `bunx vitest run src/lib/relay/changeLog.spec.ts src/stores/useSettingsStore.spec.ts`
  - `bunx biome check src/lib/relay/tools/settingsWrite.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts src/lib/relay/changeLog.ts src/stores/useSettingsStore.ts`

### ☐ T7.4 Speech engine preference and STT status
- **Kind**: implementation
- **Traces**: STT-02, STT-06
- **Files** (5): `src/stores/useRelayStore.ts`; `src/app/api/relay/stt/status/route.ts` (new); `src/hooks/useSttConfigured.ts` (new); `src/lib/relay/server/guard.ts`; `src/app/api/relay/chat/route.ts`
- **Depends on**: T7.3
- **Do**: Pulled forward from Phase 8 so `set_relay_preferences` can validate. Add `speechEngine: "browser" | "grok"` to `useRelayStore` (localStorage `rq_relay_speech_engine`, default `browser`). `GET /api/relay/stt/status` returns `{ configured: Boolean(process.env.XAI_API_KEY) }` with `Cache-Control: no-store`, no key material, and the chat route's same-origin and env-flag guards. Reviewer spot check: `isSameOrigin` is a private function inside `src/app/api/relay/chat/route.ts`, and the env flag is checked inside `guardRelayRequest` (`src/lib/relay/server/guard.ts`) together with the DeepSeek key and rate limits, which the STT routes must not apply. Extract `isSameOrigin` and a flag-only check into `guard.ts` as named exports, make the chat route import them with unchanged behaviour, and use them in the status route (T8.1 reuses them). `useSttConfigured()` fetches once per session and treats a failed fetch as `configured: false`. The Settings picker UI and runtime fallback stay in Phase 8. Design: n/a, no UI here.
- **Acceptance**:
  - STT-02: the status route returns only `{configured}` with `no-store`, enforces origin and env-flag guards and never returns key material; the hook fetches once and treats failure as false.
  - STT-06: the store has `speechEngine` defaulting to `browser`, persisted under `rq_relay_speech_engine`.
- **Verify**:
  - `bunx vitest run src/stores/useRelayStore.spec.ts src/lib/relay/server/guard.spec.ts src/app/api/relay/chat/route.spec.ts`
  - `bunx biome check src/stores/useRelayStore.ts src/app/api/relay/stt/status/route.ts src/hooks/useSttConfigured.ts src/lib/relay/server/guard.ts src/app/api/relay/chat/route.ts`
  - `test -z "$(grep -rn "XAI_API_KEY" src/app/api/relay/stt/status/route.ts | grep -v "process.env.XAI_API_KEY")"`

### ☐ T7.5 set_relay_preferences
- **Kind**: implementation
- **Traces**: TOOL-01, TOOL-05
- **Files** (5): `src/lib/relay/tools/settingsWrite.ts`; `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`; `src/hooks/useRelayChat.ts`; `src/hooks/useSttConfigured.ts`
- **Depends on**: T7.4
- **Do**: Register `set_relay_preferences` with the fields `shareValues`, `speechEngine` and `enabled`: auto for the first two; confirm when it sets `enabled: false`, applied after the current turn ends (so the turn is not aborted mid-confirm). Reject `permissionMode`, and reject `speechEngine: "grok"` when STT is not configured. Changes are recorded with Undo.
- **Acceptance**:
  - TOOL-01: shareValues and speechEngine apply immediately with Undo; `enabled: false` asks first and applies after the turn ends.
  - TOOL-05: `permissionMode` is rejected by the schema; `grok` is rejected when STT is not configured.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/schemas.spec.ts src/hooks/useRelayChat.spec.ts`
  - `bunx biome check src/lib/relay/tools/settingsWrite.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts src/hooks/useRelayChat.ts`

### ☐ T7.6 Navigation tools
- **Kind**: implementation
- **Traces**: TOOL-02
- **Files** (5): `src/lib/relay/tools/navigationTools.ts` (new); `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/ui.ts`; `src/lib/relay/openEntity.ts`
- **Depends on**: T7.5
- **Do**: Extend `open_item` (`OPEN_ITEM_KINDS`) to request, chain, environment, collection and folder (a folder opens its collection and expands it). Add `open_page` (auto) for the real routes: `/app` (workspace home, the same target `openEntity` uses for collections; `/` is the landing page and is not a target), `/settings` with an optional section, `/import`, `/environments`, `/json-compare`, `/json-visualize`, `/transform`, with prefixes aligned to `openEntity.ts`. Add `show_sidebar_tab` (auto) for collections, history and hub (History is a tab, not a route). Add the new navigation tools to `NAVIGATION_TOOLS` in `schemas.ts` so the permission mode never gates them.
- **Acceptance**:
  - TOOL-02: every `open_page` enum value and every `open_item` kind maps to the right route or action, unknown values are rejected, `show_sidebar_tab` switches the left panel, and `NAVIGATION_TOOLS` contains the new tools.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/ui.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/openEntity.spec.ts`
  - `bunx biome check src/lib/relay/tools/navigationTools.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/ui.ts src/lib/relay/openEntity.ts`

### ☐ T7.7 Backup tools
- **Kind**: implementation
- **Traces**: TOOL-03, TOOL-05
- **Files** (4): `src/lib/relay/tools/backupTools.ts` (new); `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/backup/importer.ts`
- **Depends on**: T7.6
- **Do**: Register `export_backup` (confirm; sections, selected ids, `includeSecrets` default false; approval triggers the download via the Phase 6 exporter) and `import_backup` (confirm). `import_backup` runs Merge only (Replace is not selectable), never applies `rq_relay_permission_mode` from the file, never reads the file text into the model context, and returns only summary counts or "cancelled". The file chooser needs a user gesture, so the tool waits for the card's Choose file button (the card is T7.13). Design: n/a here.
- **Acceptance**:
  - TOOL-03: both tools are confirm kind; `import_backup` cannot select Replace, does not apply the permission mode and its result contains counts only (no file content); the export schema defaults `includeSecrets` to false.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/schemas.spec.ts src/lib/backup/importer.spec.ts`
  - `bunx biome check src/lib/relay/tools/backupTools.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts src/lib/backup/importer.ts`

### ☐ T7.8 Duplicate tools
- **Kind**: implementation
- **Traces**: TOOL-04
- **Files** (4): `src/lib/relay/tools/duplicateTools.ts` (new); `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/changeLog.ts`
- **Depends on**: T7.7
- **Do**: Register `duplicate_collection`, `duplicate_chain` and `duplicate_environment` (auto) by composing the existing store actions the manual UI uses (do not invent actions the UI lacks). Each is recorded in the change log with Undo.
- **Acceptance**:
  - TOOL-04: each tool duplicates through the store, is logged with Undo, and appears as a created entity in the change log.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/schemas.spec.ts src/lib/relay/changeLog.spec.ts`
  - `bunx biome check src/lib/relay/tools/duplicateTools.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts src/lib/relay/changeLog.ts`

### ☐ T7.9 Folder tools
- **Kind**: implementation
- **Traces**: TOOL-04
- **Files** (4): `src/lib/relay/tools/folderTools.ts` (new); `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/destructive.ts`
- **Depends on**: T7.8
- **Do**: First check existing folder coverage (`rename_item`, `move_item`) and record in the Log which of `create_folder`, `rename_folder` and `delete_folder` are actually missing; add only those. `create_folder` and `rename_folder` are auto, `delete_folder` is confirm (registered with the destructive helpers). Each write is logged with Undo.
- **Acceptance**:
  - TOOL-04: only the missing folder tools are added, delete asks first, and each write is logged with Undo.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/destructive.spec.ts src/lib/relay/tools/schemas.spec.ts`
  - `bunx biome check src/lib/relay/tools/folderTools.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/destructive.ts`

### ☐ T7.10 Postman export and API catalog import
- **Kind**: implementation
- **Traces**: TOOL-04
- **Files** (4): `src/lib/relay/tools/catalogTools.ts` (new); `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/hub.ts`
- **Depends on**: T7.9
- **Do**: Register `export_postman` (auto; per collection, using the existing `postmanExporter`, triggers the download) and `import_api_catalog` (confirm; imports a hub provider by slug through `src/lib/hub.ts` and updates `requestly_imported_hub_slugs`). Log writes with Undo where the manual UI supports it.
- **Acceptance**:
  - TOOL-04: `export_postman` produces the existing exporter output for one collection; `import_api_catalog` asks first, imports the provider by slug and records the slug.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/schemas.spec.ts src/lib/hub.spec.ts`
  - `bunx biome check src/lib/relay/tools/catalogTools.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts src/lib/hub.ts`

### ☐ T7.11 Settings changes open Settings from the summary
- **Kind**: implementation
- **Traces**: TOOL-01, CONV-05
- **Files** (3): `src/lib/relay/changesSummary.ts`; `src/lib/relay/openEntity.ts`; `src/lib/relay/changeLog.ts`
- **Depends on**: T7.10
- **Do**: A settings change entry resolves to Open Settings at the right section (theme and language to General, proxy and global variables to their sections, Relay prefs to Relay). The summary row uses the plain-language label. Design: n/a, reuses the T3.10 row.
- **Acceptance**:
  - TOOL-01: a settings change appears in the changes summary with "Open Settings" targeting the right section, and Undo restores the previous value.
- **Verify**:
  - `bunx vitest run src/lib/relay/changeLog.spec.ts src/lib/relay/openEntity.spec.ts src/lib/relay/changesSummary.spec.ts`
  - `bunx biome check src/lib/relay/changesSummary.ts src/lib/relay/openEntity.ts src/lib/relay/changeLog.ts`

### ☐ T7.12 Consistent tool rows and change cards
- **Kind**: implementation
- **Traces**: TOOL-06
- **Files** (4): `src/components/relay/ToolRow.tsx`; `src/components/relay/ChangeCard.tsx`; `src/lib/relay/stepLabels.ts`; `src/lib/relay/stepSummary.ts`
- **Depends on**: T7.11
- **Design**: First run the `layout` skill on the compact tool rows and change cards for the new tools, record the decision in the task Log, then implement.
- **Do**: Give the new tools compact, consistent step rows and change cards with plain-language labels from the T7.1 keys, and classify each new tool as read or write for `summariseSteps`. Update the touched specs.
- **Acceptance**:
  - TOOL-06: every new tool renders a compact row with a plain-language running and done label and no tool name; read and write classes are correct for grouping.
- **Verify**:
  - `bunx vitest run src/components/relay/ToolRow.spec.tsx src/components/relay/ChangeCard.spec.tsx src/lib/relay/stepLabels.spec.ts src/lib/relay/stepSummary.spec.ts`
  - `bunx biome check src/components/relay/ToolRow.tsx src/components/relay/ChangeCard.tsx src/lib/relay/stepLabels.ts src/lib/relay/stepSummary.ts`

### ☐ T7.13 Backup approval cards
- **Kind**: implementation
- **Traces**: TOOL-03, BAK-02
- **Files** (5): `src/components/relay/ExportBackupConfirm.tsx` (new); `src/components/relay/ImportBackupConfirm.tsx` (new); `src/components/relay/ConfirmCard.tsx`; `src/components/relay/MessageParts.tsx`; `src/lib/relay/tools/backupTools.ts`
- **Depends on**: T7.12
- **Design**: First run the `layout` skill on both cards, record the decision in the task Log, then implement.
- **Do**: The export card always lists the sections and counts, and shows the BAK-02 warning when `includeSecrets` is true; approval triggers the download. The import card has a "Choose file" button (user gesture), then shows the BAK-04 preview; only Merge is offered. Relay never receives the file text; the tool result is the summary counts or "cancelled". Update `ConfirmCard.spec.tsx`.
- **Acceptance**:
  - TOOL-03: the export card lists sections and counts, shows the secrets warning when on, and downloads only after approval; the import card offers Choose file, then the preview, Merge only, and returns counts only.
- **Verify**:
  - `bunx vitest run src/components/relay/ConfirmCard.spec.tsx src/components/relay/MessageParts.spec.tsx`
  - `bunx biome check src/components/relay/ExportBackupConfirm.tsx src/components/relay/ImportBackupConfirm.tsx src/components/relay/ConfirmCard.tsx src/components/relay/MessageParts.tsx src/lib/relay/tools/backupTools.ts`
  - Browser behaviour proven by E2E T7.23.

### ☐ T7.14 Deny-list and prompt rules
- **Kind**: implementation
- **Traces**: TOOL-05
- **Files** (3): `src/lib/relay/server/systemPrompt.ts`; `src/lib/relay/server/systemPrompt.spec.ts`; `src/lib/relay/tools/schemas.ts`
- **Depends on**: T7.13
- **Do**: State in the prompt that Relay cannot change the approval or permission mode or wipe or clear all data, and must tell the user in plain language to do it in Settings. Confirm no tool name or schema targets the permission mode or a wipe-all operation. Describe the new capabilities without tool names in user-facing examples.
- **Acceptance**:
  - TOOL-05: the prompt states both limits; no tool or schema targets the permission mode or wipe-all; the prompt's quoted user-facing examples contain no registered tool name.
- **Verify**:
  - `bunx vitest run src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/tools/schemas.spec.ts`
  - `bunx biome check src/lib/relay/server/systemPrompt.ts src/lib/relay/tools/schemas.ts`

### ☐ T7.15 Capability areas for the new tools
- **Kind**: implementation
- **Traces**: TOOL-07, EMPTY-03
- **Files** (5): `src/lib/relay/capabilities.ts`; `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`; `src/lib/relay/server/systemPrompt.ts`
- **Depends on**: T7.14
- **Do**: Add settings, navigation and backup areas to `CAPABILITY_CATEGORIES` and `CAPABILITY_ACTIONS` with "asks first" markers per tool kind (derived from `capabilityBadge`), the area sentences in all locales, and update the prompt's capability description without tool names in user-facing examples.
- **Acceptance**:
  - TOOL-07: every new tool maps to a capability area, asks-first markers appear only for confirm kinds, and the popover (T5.4) renders the new areas without code change.
- **Verify**:
  - `bunx vitest run src/lib/relay/capabilities.spec.ts src/components/relay/CapabilitiesPanel.spec.tsx src/i18n/relayMessages.parity.spec.ts src/lib/relay/server/systemPrompt.spec.ts`
  - `bunx biome check src/lib/relay/capabilities.ts src/lib/relay/server/systemPrompt.ts`

### ☐ T7.16 Unit: settings tools and speech preference
- **Kind**: unit
- **Traces**: TOOL-01, TOOL-05, STT-02, STT-06
- **Files** (4): `src/lib/relay/tools/appSettings.ts`; `src/lib/relay/tools/settingsWrite.ts`; `src/app/api/relay/stt/status/route.ts`; `src/hooks/useSttConfigured.ts`
- **Depends on**: T7.15
- **Do**: Masking with and without `shareValues`, each write tool against its store action with Undo restoring the previous value, `set_relay_preferences` confirm for `enabled: false`, `permissionMode` rejected, `grok` rejected when unconfigured, the status route guards and no key in the body, the hook's once-per-session fetch and failure-as-false.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/appSettings.spec.ts src/lib/relay/tools/settingsWrite.spec.ts src/app/api/relay/stt/status/route.spec.ts src/hooks/useSttConfigured.spec.ts --coverage --coverage.include=src/lib/relay/tools/appSettings.ts,src/lib/relay/tools/settingsWrite.ts,src/app/api/relay/stt/status/route.ts,src/hooks/useSttConfigured.ts --coverage.reporter=text`

### ☐ T7.17 Unit: navigation
- **Kind**: unit
- **Traces**: TOOL-02
- **Files** (3): `src/lib/relay/tools/navigationTools.ts`; `src/lib/relay/tools/ui.ts`; `src/lib/relay/openEntity.ts`
- **Depends on**: T7.16
- **Do**: The route mapping for every `open_page` enum value, every `open_item` kind (folder opens and expands its collection), `show_sidebar_tab` values, rejection of unknown values, and that the new tools are in `NAVIGATION_TOOLS`.
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/navigationTools.spec.ts src/lib/relay/tools/ui.spec.ts src/lib/relay/openEntity.spec.ts --coverage --coverage.include=src/lib/relay/tools/navigationTools.ts,src/lib/relay/tools/ui.ts,src/lib/relay/openEntity.ts --coverage.reporter=text`

### ☐ T7.18 Unit: backup, duplicate, folder and catalog tools
- **Kind**: unit
- **Traces**: TOOL-03, TOOL-04
- **Files** (4): `src/lib/relay/tools/backupTools.ts`; `src/lib/relay/tools/duplicateTools.ts`; `src/lib/relay/tools/folderTools.ts`; `src/lib/relay/tools/catalogTools.ts`
- **Depends on**: T7.17
- **Do**: The schemas, merge-only enforcement, the permission mode not applied, a result with no file content, the `includeSecrets` default, duplicates through store actions with Undo, folder create, rename and delete (confirm), `export_postman` output and the catalog slug bookkeeping.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/backupTools.spec.ts src/lib/relay/tools/duplicateTools.spec.ts src/lib/relay/tools/folderTools.spec.ts src/lib/relay/tools/catalogTools.spec.ts --coverage --coverage.include=src/lib/relay/tools/backupTools.ts,src/lib/relay/tools/duplicateTools.ts,src/lib/relay/tools/folderTools.ts,src/lib/relay/tools/catalogTools.ts --coverage.reporter=text`

### ☐ T7.19 Unit: registry-wide guarantees
- **Kind**: unit
- **Traces**: TOOL-05, TOOL-06, TOOL-07, BUG-03
- **Files** (4): `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/schemas.ts`; `src/lib/relay/capabilities.ts`; `src/lib/relay/server/systemPrompt.ts`
- **Depends on**: T7.18
- **Do**: Iterating `getRegisteredToolNames()`: every tool has running and done labels in all locales; no tool name or schema targets the permission mode or a wipe-all operation; `set_relay_preferences` rejects `permissionMode`; `import_backup` cannot select Replace; every new tool maps to a capability area; no registered tool name appears in any relay i18n value.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/tools/coverage.spec.ts src/lib/relay/capabilities.spec.ts src/lib/relay/server/systemPrompt.spec.ts --coverage --coverage.include=src/lib/relay/tools/registry.ts,src/lib/relay/tools/schemas.ts,src/lib/relay/capabilities.ts,src/lib/relay/server/systemPrompt.ts --coverage.reporter=text`

### ☐ T7.20 Unit: tool cards
- **Kind**: unit
- **Traces**: TOOL-03, TOOL-06
- **Files** (4): `src/components/relay/ExportBackupConfirm.tsx`; `src/components/relay/ImportBackupConfirm.tsx`; `src/components/relay/ToolRow.tsx`; `src/components/relay/ChangeCard.tsx`
- **Depends on**: T7.19
- **Do**: The export card lists sections and counts and shows the warning only when secrets are on; the import card gates on Choose file, shows the preview, offers Merge only and returns counts; tool rows never render a tool name for any registry tool.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/relay/ExportBackupConfirm.spec.tsx src/components/relay/ImportBackupConfirm.spec.tsx src/components/relay/ToolRow.spec.tsx src/components/relay/ChangeCard.spec.tsx --coverage --coverage.include=src/components/relay/ExportBackupConfirm.tsx,src/components/relay/ImportBackupConfirm.tsx,src/components/relay/ToolRow.tsx,src/components/relay/ChangeCard.tsx --coverage.reporter=text`

### ☐ T7.21 E2E: settings tools
- **Kind**: e2e
- **Traces**: TOOL-01, CONV-05
- **Files** (0): none (no app change)
- **Depends on**: T7.20
- **Gherkin**: `e2e/scenarios/relay/relay-v2-tools-settings.feature.md`: REL-V2-TOOLSET-01..06
- **Spec**: `e2e/qa/relay/relay-v2-tools-settings.spec.ts`
- **Scenarios**:
  - `[REL-V2-TOOLSET-01] a mocked agent calls get_app_settings and the reply masks proxy credentials and, with shareValues off, header values` @critical
  - `[REL-V2-TOOLSET-02] a mocked set_theme changes the theme, the summary offers Open Settings, and Undo restores the previous theme` @critical
  - `[REL-V2-TOOLSET-03] set_language and update_proxy_settings apply the same way as the Settings UI` @high
  - `[REL-V2-TOOLSET-04] set_global_variables updates the Global section and Undo restores it` @high
  - `[REL-V2-TOOLSET-05] set_relay_preferences with enabled false shows an approval card and applies only after the turn ends` @critical
  - `[REL-V2-TOOLSET-06] set_relay_preferences rejects permissionMode and speechEngine grok when status reports unconfigured` @high
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-tools-settings.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T7.22 E2E: navigation tools
- **Kind**: e2e
- **Traces**: TOOL-02
- **Files** (0): none (no app change)
- **Depends on**: T7.20
- **Gherkin**: `e2e/scenarios/relay/relay-v2-tools-nav.feature.md`: REL-V2-TOOLNAV-01..05
- **Spec**: `e2e/qa/relay/relay-v2-tools-nav.spec.ts`
- **Scenarios**:
  - `[REL-V2-TOOLNAV-01] open_page navigates to each of /settings, /import, /environments, /json-compare, /json-visualize and /transform` @critical
  - `[REL-V2-TOOLNAV-02] open_page with the workspace home target lands on /app` @high
  - `[REL-V2-TOOLNAV-03] show_sidebar_tab switches to collections, history and hub` @critical
  - `[REL-V2-TOOLNAV-04] open_item opens a folder's collection and expands it` @high
  - `[REL-V2-TOOLNAV-05] navigation tools run without an approval card in every permission mode` @high
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-tools-nav.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T7.23 E2E: backup tools
- **Kind**: e2e
- **Traces**: TOOL-03
- **Files** (0): none (no app change)
- **Depends on**: T7.20
- **Gherkin**: `e2e/scenarios/relay/relay-v2-tools-backup.feature.md`: REL-V2-TOOLBAK-01..05
- **Spec**: `e2e/qa/relay/relay-v2-tools-backup.spec.ts`
- **Scenarios**:
  - `[REL-V2-TOOLBAK-01] export_backup shows an approval card with sections and counts and nothing downloads until approved` @critical
  - `[REL-V2-TOOLBAK-02] with includeSecrets true the card shows the secrets warning` @critical
  - `[REL-V2-TOOLBAK-03] after approval the downloaded file matches the card's sections` @high
  - `[REL-V2-TOOLBAK-04] import_backup shows Choose file, then the preview after the file is picked, offers Merge only, and the tool result sent back has counts and no file content` @critical
  - `[REL-V2-TOOLBAK-05] declining or cancelling returns "cancelled" and writes nothing` @high
- **Do**: Capture the next request body to assert the tool result contains no file text.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-tools-backup.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T7.24 E2E: entity tools
- **Kind**: e2e
- **Traces**: TOOL-04, CONV-05
- **Files** (0): none (no app change)
- **Depends on**: T7.20
- **Gherkin**: `e2e/scenarios/relay/relay-v2-tools-entities.feature.md`: REL-V2-TOOLENT-01..06
- **Spec**: `e2e/qa/relay/relay-v2-tools-entities.spec.ts`
- **Scenarios**:
  - `[REL-V2-TOOLENT-01] duplicate_collection, duplicate_chain and duplicate_environment create copies, appear in the summary with Open, and Undo removes them` @critical
  - `[REL-V2-TOOLENT-02] create_folder and rename_folder apply and Undo reverts` @high
  - `[REL-V2-TOOLENT-03] delete_folder asks first and declining deletes nothing` @critical
  - `[REL-V2-TOOLENT-04] export_postman downloads a Postman file for one collection` @high
  - `[REL-V2-TOOLENT-05] import_api_catalog asks first, then imports the provider and the Hub tab shows it as imported` @high
  - `[REL-V2-TOOLENT-06] every step row and card shows plain-language labels and no tool name` @high
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-tools-entities.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T7.25 E2E: deny-list and capability list
- **Kind**: e2e
- **Traces**: TOOL-05, TOOL-07, EMPTY-03
- **Files** (0): none (no app change)
- **Depends on**: T7.20
- **Gherkin**: `e2e/scenarios/relay/relay-v2-tools.feature.md`: REL-V2-TOOLS-01..04
- **Spec**: `e2e/qa/relay/relay-v2-tools.spec.ts`
- **Scenarios**:
  - `[REL-V2-TOOLS-01] asked to change the approval mode, the mocked reply tells the user to do it in Settings and the request body offered no such tool` @critical
  - `[REL-V2-TOOLS-02] asked to wipe all data, the mocked reply says it cannot and no tool call is made` @critical
  - `[REL-V2-TOOLS-03] the capabilities popover lists settings, navigation and backup areas with asks-first markers only on confirm kinds` @high
  - `[REL-V2-TOOLS-04] the request body's tool definitions contain no permission-mode or wipe-all tool` @high
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-tools.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T7.26 E2E: migrate XC-01 write, confirm, permission and capability specs
- **Kind**: e2e
- **Traces**: XC-01, TOOL-06, TOOL-07
- **Files** (0): none (no app change)
- **Depends on**: T7.21, T7.22, T7.23, T7.24, T7.25
- **Gherkin**: existing `e2e/scenarios/relay/` files for the specs below (edited only where a changed behaviour is asserted)
- **Spec**: `e2e/qa/relay/relay-write.spec.ts`; `e2e/qa/relay/relay-confirm.spec.ts`; `e2e/qa/relay/relay-polish-perm.spec.ts`; `e2e/qa/relay/relay-polish-caps.spec.ts`; `e2e/qa/relay/relay-improvements-kinds.spec.ts`
- **Scenarios**:
  - `[REL-TOOLS-MIGRATE-01] write, confirm, permission, capability and kinds specs pass with the new tools, labels and capability areas` @high
- **Do**: Rewrite assertions that enumerate tool kinds, labels or capability areas to include the new tools; never weaken. Other cases do not apply (migration of existing coverage).
- **Acceptance**:
  - All listed specs pass with no deleted assertion lacking an equivalent.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-write.spec.ts e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-polish-perm.spec.ts e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-improvements-kinds.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T7.27 Checkpoint 7
- **Kind**: gate
- **Traces**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-07, XC-01
- **Files** (0): none (verification only)
- **Depends on**: T7.26
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check. A human reviews before Phase 8.
- **Acceptance**:
  - All commands below exit 0 and the Phase 7 "Try in UI" steps hold.
- **Verify**:
  - `bunx vitest run src/lib/relay src/components/relay src/hooks src/stores src/app/api/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-tools-settings.spec.ts e2e/qa/relay/relay-v2-tools-nav.spec.ts e2e/qa/relay/relay-v2-tools-backup.spec.ts e2e/qa/relay/relay-v2-tools-entities.spec.ts e2e/qa/relay/relay-v2-tools.spec.ts e2e/qa/relay/relay-write.spec.ts e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-polish-perm.spec.ts e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-improvements-kinds.spec.ts --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`

🔶 **Checkpoint 7**: settings, navigation, backup, entity and catalog tools work with approval, Undo and plain-language cards; the deny-list holds; human review before Phase 8.

---

## Phase 8: Grok speech to text

**Adds:** An optional Grok dictation engine next to browser dictation, chosen in Settings, with a live level meter, clear errors that never lose a recording, and text inserted at the composer caret.

**Try in UI:** With XAI_API_KEY unset open Settings, Relay and confirm the Grok option is disabled with the hint ; With it set choose Grok, press the mic, speak, press again and watch Transcribing then the text land at the caret ; Deny microphone access and confirm the inline error appears and nothing is sent

### ☐ T8.1 Grok transcription route
- **Kind**: implementation
- **Traces**: STT-01, STT-05
- **Files** (4): `src/app/api/relay/stt/route.ts` (new); `src/lib/relay/stt.ts` (new); `src/lib/relay/constants.ts`; `.env.example`
- **Depends on**: T7.27
- **Do**: Add `POST /api/relay/stt`. Guards in order: same-origin (reuse the `isSameOrigin` export that T7.4 moved into `src/lib/relay/server/guard.ts`), Relay env flag (the T7.4 flag-only check), key configured (503 `not_configured`), content type `audio/wav`, size at most `STT_MAX_UPLOAD_BYTES` (8 MB). Forward multipart to `https://api.x.ai/v1/stt` with Bearer `XAI_API_KEY`: option fields (`model` = `GROK_STT_MODEL`, `language` when mapped, `format=true` only for ar, zh, en, fr, de, ja, pt, ru, es, sv, vi) come first and `file` last. Return only `{text, language, duration}`. Map upstream errors per the STT-05 table (400 `bad_audio`, 401 to 502 `upstream_auth`, 413 `too_large`, 429 with `Retry-After` passed through, 502 and 503 to 503 `unavailable`). Never log or return the key; log request ids only. Document `XAI_API_KEY` in `.env.example`. Design: n/a, no UI.
- **Acceptance**:
  - STT-01: guards run in the stated order, the field order puts `file` last, `format` is sent only for supported languages, the response is exactly `{text, language, duration}` and the key never appears in a response or log.
  - STT-05: each upstream status maps to the table's route response and `Retry-After` passes through.
- **Verify**:
  - `bunx vitest run src/lib/relay/constants.spec.ts`
  - `bunx biome check src/app/api/relay/stt/route.ts src/lib/relay/stt.ts src/lib/relay/constants.ts`
  - `grep -n "XAI_API_KEY" .env.example`

### ☐ T8.2 WAV encoder and language mapping
- **Kind**: implementation
- **Traces**: STT-03, STT-04
- **Files** (3): `src/lib/relay/stt/wavEncoder.ts` (new); `src/lib/relay/stt/language.ts` (new); `src/lib/relay/constants.ts`
- **Depends on**: T8.1
- **Do**: Pure `encodeWav(samples, rate)` producing a 16 kHz mono PCM16 WAV (header bytes, length, clipping to the int16 range) plus the resampler. `toSttLanguage(locale)` reduces `SPEECH_LANG_BY_LOCALE` to ISO-639-1 (en, fr, ja) and returns undefined for an unmapped locale. Add `STT_MAX_RECORDING_MS` (120000), `STT_MIN_RECORDING_MS` (500), `STT_LEVEL_UPDATE_MS` (100) and `STT_LEVEL_BARS` (5). Design: n/a.
- **Acceptance**:
  - STT-03: the encoder emits a valid RIFF/WAVE header, correct length and clipped samples.
  - STT-04: the locale maps to en, fr or ja and an unmapped locale yields no language.
- **Verify**:
  - Logic of the new modules is proven by the Unit tasks later in this phase (their specs do not exist yet).
  - `bunx biome check src/lib/relay/stt/wavEncoder.ts src/lib/relay/stt/language.ts src/lib/relay/constants.ts`

### ☐ T8.3 Audio capture
- **Kind**: implementation
- **Traces**: STT-03, STT-07
- **Files** (4): `src/lib/relay/stt/audioCapture.ts` (new); `src/lib/relay/stt/audioLevel.ts` (new); `public/relay-stt-worklet.js` (new); `src/lib/relay/constants.ts`
- **Depends on**: T8.2
- **Do**: Capture with an AudioWorklet and fall back to `ScriptProcessorNode`; expose capability detection (when neither exists the Grok option is disabled with a message), start and stop returning a WAV blob and the duration, auto-stop at `STT_MAX_RECORDING_MS` with a "Recording limit reached" callback that still transcribes. `audioLevel` computes RMS from an `AnalyserNode` into `STT_LEVEL_BARS` bars every `STT_LEVEL_UPDATE_MS`. Stop all tracks on stop or abort. Design: n/a.
- **Acceptance**:
  - STT-03: capture yields WAV only (never webm), uses the fallback when AudioWorklet is missing, auto-stops at 120 s and keeps the audio.
  - STT-07: level values are computed as 5 bars from RMS.
- **Verify**:
  - Logic of the new modules is proven by the Unit tasks later in this phase (their specs do not exist yet).
  - `bunx biome check src/lib/relay/stt/audioCapture.ts src/lib/relay/stt/audioLevel.ts`

### ☐ T8.4 Dictation error copy (en, fr, ja)
- **Kind**: implementation
- **Traces**: STT-05, STT-08, STT-07
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: T8.3
- **Do**: Add the STT-05 client messages, the STT-08 messages ("Microphone access is blocked. Allow it in your browser's site settings.", "No microphone found.", "Didn't catch that."), "Recording limit reached", "Transcribing...", the engine labels Browser and Grok, the Retry button, and the Grok privacy note ("audio is sent to xAI for transcription"), in all three locales.
- **Acceptance**:
  - STT-05: every message in the table exists in all locales.
  - STT-08: the permission, no-microphone and too-short messages exist in all locales.
- **Verify**:
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`

### ☐ T8.5 useGrokDictation hook
- **Kind**: implementation
- **Traces**: STT-05, STT-08
- **Files** (3): `src/hooks/useGrokDictation.ts` (new); `src/lib/relay/stt/client.ts` (new); `src/lib/relay/stt/errors.ts` (new)
- **Depends on**: T8.4
- **Do**: State machine idle, recording, transcribing, error. Request the microphone first: `NotAllowedError` and `NotFoundError` show the inline error and send nothing. A recording under `STT_MIN_RECORDING_MS` is not uploaded and shows "Didn't catch that". Upload the WAV with the mapped language; map route errors and network failure to the client messages. On error keep the WAV blob for Retry until dismissed or the next recording. While transcribing the mic is disabled. On dock close, thread switch or Relay disabled, stop the stream, abort the request and insert nothing. Design: n/a.
- **Acceptance**:
  - STT-05: each route error code shows its client message, and Retry resends the kept blob.
  - STT-08: permission denied, no microphone, too short, disabled while transcribing and abort-and-discard on dock close, thread switch or Relay disabled all behave as specified.
- **Verify**:
  - Logic of the new modules is proven by the Unit tasks later in this phase (their specs do not exist yet).
  - `bunx biome check src/hooks/useGrokDictation.ts src/lib/relay/stt/client.ts src/lib/relay/stt/errors.ts`

### ☐ T8.6 Engine picker and effective engine
- **Kind**: implementation
- **Traces**: STT-06, STT-03
- **Files** (5): `src/components/settings/RelaySection.tsx`; `src/lib/relay/speechEngine.ts` (new); `messages/en/settings.json`; `messages/fr/settings.json`; `messages/ja/settings.json`
- **Depends on**: T8.5
- **Design**: First run the `ui-ux-pro-max` skill on the engine picker row (disabled state and hint), record the decision in the task Log, then implement.
- **Do**: Add the engine picker to Settings, Relay, bound to `speechEngine`. When `useSttConfigured()` is false, or when neither AudioWorklet nor ScriptProcessor is available (`audioCapture` capability check), the Grok option is disabled with "Set XAI_API_KEY on the server to enable". `getEffectiveSpeechEngine(stored, configured)` falls back to browser at runtime without overwriting the stored value. Update `RelaySection.spec.tsx`.
- **Acceptance**:
  - STT-03: Grok is disabled with a message when no capture API exists.
  - STT-06: default is browser, Grok is disabled with the hint when unconfigured, and a stored grok falls back to browser at runtime while the stored value is untouched.
- **Verify**:
  - `bunx vitest run src/components/settings/RelaySection.spec.tsx src/i18n/messages.parity.spec.ts`
  - `bunx biome check src/components/settings/RelaySection.tsx src/lib/relay/speechEngine.ts`

### ☐ T8.7 Mic button, level meter and privacy note
- **Kind**: implementation
- **Traces**: STT-07, COMP-07
- **Files** (5): `src/components/relay/MicButton.tsx`; `src/components/relay/SpeechPrivacyNote.tsx`; `src/components/relay/LevelMeter.tsx` (new); `src/hooks/useSpeechDictation.ts`; `src/components/relay/PromptEditor.tsx`
- **Depends on**: T8.6
- **Design**: First run the `layout` skill on the mic button, engine label and 5-bar meter, record the decision in the task Log, then implement.
- **Do**: MicButton shows the active engine ("Browser" or "Grok") as a label or tooltip. With Grok, recording shows the 5-bar meter; the Browser engine keeps its listening indicator. A second click stops; Grok then shows "Transcribing..." with the button disabled, and the text is inserted at the composer caret (not auto-sent) using the T4.9 insertion path. The privacy note has a Grok variant. Update the touched specs.
- **Acceptance**:
  - STT-07: the engine label shows, the meter appears only for Grok, "Transcribing..." shows, text is inserted at the caret and is not auto-sent, and the Grok privacy note is shown for Grok.
- **Verify**:
  - `bunx vitest run src/components/relay/MicButton.spec.tsx src/components/relay/SpeechPrivacyNote.spec.tsx src/hooks/useSpeechDictation.spec.ts`
  - `bunx biome check src/components/relay/MicButton.tsx src/components/relay/SpeechPrivacyNote.tsx src/components/relay/LevelMeter.tsx src/hooks/useSpeechDictation.ts src/components/relay/PromptEditor.tsx`

### ☐ T8.8 Unit: route and client
- **Kind**: unit
- **Traces**: STT-01, STT-05
- **Files** (3): `src/app/api/relay/stt/route.ts`; `src/lib/relay/stt.ts`; `src/lib/relay/stt/client.ts`
- **Depends on**: T8.7
- **Do**: Mocked fetch per upstream status (400, 401, 413, 429 with Retry-After, 502, 503), each guard in order, `file` last, `format` only for supported languages, the key never in a body or log, and the client mapping of route and network errors.
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/app/api/relay/stt/route.spec.ts src/lib/relay/stt.spec.ts src/lib/relay/stt/client.spec.ts --coverage --coverage.include=src/app/api/relay/stt/route.ts,src/lib/relay/stt.ts,src/lib/relay/stt/client.ts --coverage.reporter=text`

### ☐ T8.9 Unit: encoder, language and capture
- **Kind**: unit
- **Traces**: STT-03, STT-04, STT-07
- **Files** (4): `src/lib/relay/stt/wavEncoder.ts`; `src/lib/relay/stt/language.ts`; `src/lib/relay/stt/audioCapture.ts`; `src/lib/relay/stt/audioLevel.ts`
- **Depends on**: T8.8
- **Do**: Header bytes, length, clipping, resampling, locale mapping including unmapped, worklet and fallback selection, the 120 s cap, and the 5-bar RMS level computation.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/lib/relay/stt/wavEncoder.spec.ts src/lib/relay/stt/language.spec.ts src/lib/relay/stt/audioCapture.spec.ts src/lib/relay/stt/audioLevel.spec.ts --coverage --coverage.include=src/lib/relay/stt/wavEncoder.ts,src/lib/relay/stt/language.ts,src/lib/relay/stt/audioCapture.ts,src/lib/relay/stt/audioLevel.ts --coverage.reporter=text`

### ☐ T8.10 Unit: hook and engine
- **Kind**: unit
- **Traces**: STT-05, STT-06, STT-08
- **Files** (3): `src/hooks/useGrokDictation.ts`; `src/lib/relay/speechEngine.ts`; `src/lib/relay/stt/errors.ts`
- **Depends on**: T8.9
- **Do**: Every state transition, each STT-08 case, retry keeping the blob, abort on dock close, thread switch and Relay disabled, the default engine, the runtime fallback and the disabled state.
- **Acceptance**:
  - All three files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/hooks/useGrokDictation.spec.ts src/lib/relay/speechEngine.spec.ts src/lib/relay/stt/errors.spec.ts --coverage --coverage.include=src/hooks/useGrokDictation.ts,src/lib/relay/speechEngine.ts,src/lib/relay/stt/errors.ts --coverage.reporter=text`

### ☐ T8.11 Unit: mic and settings components
- **Kind**: unit
- **Traces**: STT-06, STT-07
- **Files** (4): `src/components/relay/MicButton.tsx`; `src/components/relay/LevelMeter.tsx`; `src/components/relay/SpeechPrivacyNote.tsx`; `src/components/settings/RelaySection.tsx`
- **Depends on**: T8.10
- **Do**: Engine label, meter only for Grok, the transcribing state, privacy variants, and the picker's disabled state and hint.
- **Acceptance**:
  - All four files reach >= 80% on all four metrics (target > 95%).
- **Verify**:
  - `bunx vitest run src/components/relay/MicButton.spec.tsx src/components/relay/LevelMeter.spec.tsx src/components/relay/SpeechPrivacyNote.spec.tsx src/components/settings/RelaySection.spec.tsx --coverage --coverage.include=src/components/relay/MicButton.tsx,src/components/relay/LevelMeter.tsx,src/components/relay/SpeechPrivacyNote.tsx,src/components/settings/RelaySection.tsx --coverage.reporter=text`

### ☐ T8.12 E2E: Grok dictation
- **Kind**: e2e
- **Traces**: STT-02, STT-05, STT-06, STT-07, STT-08
- **Files** (0): none (no app change)
- **Depends on**: T8.11
- **Gherkin**: `e2e/scenarios/relay/relay-v2-stt.feature.md`: REL-V2-STT-01..08
- **Spec**: `e2e/qa/relay/relay-v2-stt.spec.ts`
- **Scenarios**:
  - `[REL-V2-STT-01] with the status route mocked as configured and the Grok engine chosen, recording then stopping lands the mocked text at the composer caret and does not send` @critical
  - `[REL-V2-STT-02] the engine label is visible on the mic button` @high
  - `[REL-V2-STT-03] with status mocked as unconfigured the Grok option is disabled with the hint and a stored grok falls back to browser` @critical
  - `[REL-V2-STT-04] a mocked 401 shows the not-set-up message and a mocked 429 shows the busy message, and Retry resends the kept recording` @high
  - `[REL-V2-STT-05] denied microphone permission shows the inline error and sends no request` @high
  - `[REL-V2-STT-06] a recording under half a second shows "Didn't catch that" and sends no request` @medium
  - `[REL-V2-STT-07] the mic is disabled while transcribing and closing the dock mid-transcription inserts nothing` @high
  - `[REL-V2-STT-08] the uploaded request is audio/wav and carries the mapped language` @high
- **Do**: Mock `/api/relay/stt` and `/api/relay/stt/status` with `page.route`; use the Chromium fake audio device flags (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`) set for this spec only.
- **Acceptance**:
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-stt.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T8.13 E2E: migrate XC-01 voice, mic and privacy specs
- **Kind**: e2e
- **Traces**: XC-01, STT-06, STT-07
- **Files** (0): none (no app change)
- **Depends on**: T8.12
- **Gherkin**: existing `e2e/scenarios/relay/` files for the specs below (edited only where a changed behaviour is asserted)
- **Spec**: `e2e/qa/relay/relay-improvements-voice.spec.ts`; `e2e/qa/relay/relay-improvements-a11y-mic.spec.ts`; `e2e/qa/relay/relay-polish-a11y.spec.ts`; `e2e/qa/relay/relay-privacy.spec.ts`
- **Scenarios**:
  - `[REL-STT-MIGRATE-01] voice, mic accessibility, polish accessibility and privacy specs pass with the engine label, meter and Grok privacy variant` @high
- **Do**: Rewrite assertions affected by the engine label and privacy variants; never weaken. Other cases do not apply (migration of existing coverage).
- **Acceptance**:
  - All listed specs pass with no deleted assertion lacking an equivalent.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-a11y-mic.spec.ts e2e/qa/relay/relay-polish-a11y.spec.ts e2e/qa/relay/relay-privacy.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ T8.14 Checkpoint 8
- **Kind**: gate
- **Traces**: STT-01, STT-02, STT-03, STT-04, STT-05, STT-06, STT-07, STT-08, XC-01
- **Files** (0): none (verification only)
- **Depends on**: T8.13
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - All commands below exit 0 and the Phase 8 "Try in UI" steps hold.
- **Verify**:
  - `bunx vitest run src/lib/relay src/components/relay src/components/settings src/hooks src/app/api/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-stt.spec.ts e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-a11y-mic.spec.ts e2e/qa/relay/relay-polish-a11y.spec.ts e2e/qa/relay/relay-privacy.spec.ts --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`

### ☐ T8.15 Epic walkthrough
- **Kind**: walkthrough
- **Traces**: BUG-01, SB-01, CONV-01, COMP-01, EMPTY-01, BAK-06, TOOL-01, STT-07
- **Files** (0): none (verification only)
- **Depends on**: T8.14
- **Do**: Final targeted sweep of every `relay-v2-*` spec plus every XC-01 spec migrated or baselined in this epic, listed explicitly below (never the full suite). Verify success criteria 1 to 5 of the SPEC and that the BAK-06 two-context round trip passes. Fix forward in the owning task on any failure.
- **Acceptance**:
  - Every relay-v2 spec and the XC-01 specs pass at `--repeat-each=2`; the BAK-06 round trip passes; SPEC success criteria 1 to 5 hold.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-harness.spec.ts e2e/qa/relay/relay-v2-bugs.spec.ts e2e/qa/relay/relay-v2-bugs-ui.spec.ts e2e/qa/relay/relay-settings.spec.ts e2e/qa/relay/relay-v2-sidebar.spec.ts e2e/qa/relay/relay-v2-conversation.spec.ts e2e/qa/relay/relay-v2-changes.spec.ts e2e/qa/relay/relay-v2-chain-live.spec.ts e2e/qa/relay/relay-v2-pills.spec.ts e2e/qa/relay/relay-v2-composer.spec.ts e2e/qa/relay/relay-v2-send.spec.ts e2e/qa/relay/relay-v2-composer-a11y.spec.ts e2e/qa/relay/relay-v2-empty.spec.ts e2e/qa/relay/relay-v2-popover.spec.ts e2e/qa/relay/relay-v2-backup-export.spec.ts e2e/qa/relay/relay-v2-backup-import.spec.ts e2e/qa/relay/relay-v2-backup.spec.ts e2e/qa/relay/relay-v2-tools-settings.spec.ts e2e/qa/relay/relay-v2-tools-nav.spec.ts e2e/qa/relay/relay-v2-tools-backup.spec.ts e2e/qa/relay/relay-v2-tools-entities.spec.ts e2e/qa/relay/relay-v2-tools.spec.ts e2e/qa/relay/relay-v2-stt.spec.ts e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-a11y-mic.spec.ts e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts e2e/qa/relay/relay-improvements-kinds.spec.ts e2e/qa/relay/relay-improvements-loading.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-qol-stop.spec.ts e2e/qa/relay/relay-improvements-smart-diff.spec.ts e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-polish-a11y.spec.ts e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-polish-composer.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts e2e/qa/relay/relay-polish-msg.spec.ts e2e/qa/relay/relay-polish-panel.spec.ts e2e/qa/relay/relay-polish-perm.spec.ts e2e/qa/relay/relay-polish-shield.spec.ts e2e/qa/relay/relay-polish-slash.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-write.spec.ts e2e/settings.spec.ts --repeat-each=2`
  - `bunx vitest run src/lib/relay src/lib/backup src/components/relay src/components/settings src/hooks src/stores src/app/api/relay src/i18n`
  - `bun run lint:check`
  - `bun run typecheck`

### ☐ T8.16 Definition of done
- **Kind**: dod
- **Traces**: XC-01
- **Files** (0): none (verification only)
- **Depends on**: T8.15
- **Do**: Confirm every task is checked, every SPEC id in the traceability table has passing evidence, `git status` shows only intended changes and no stray scratch files, and the Log records any flag-to-human item (the STT-02 pull-forward into T7.4, the Tiptap dependency in T4.1, the new missing-request chain placeholder in T6.9 and T6.10).
- **Acceptance**:
  - All 61 SPEC ids map to passing tasks and no open question remains.
- **Verify**:
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `git status --short`

🔶 **Checkpoint 8**: Grok dictation works end to end behind the engine picker with safe fallbacks; unit and targeted e2e pass; the epic walkthrough and definition of done are complete.

---

## Traceability

| SPEC id | Tasks |
| --- | --- |
| BUG-01 | T1.8, T1.9, T1.10, T1.26, T1.27, T1.31, T1.32, T1.36, T8.15 |
| BUG-02 | T1.13, T1.14, T1.28, T1.32, T1.34, T1.36 |
| BUG-03 | T0.4, T1.5, T1.6, T1.7, T1.25, T1.32, T1.36, T7.19 |
| BUG-04 | T1.5, T1.11, T1.12, T1.25, T1.27, T1.32, T1.36 |
| BUG-05 | T1.1, T1.2, T1.23, T1.24, T1.31, T1.35, T1.36 |
| BUG-06 | T1.3, T1.24, T1.35, T1.36 |
| BUG-07 | T1.4, T1.24, T1.35, T1.36 |
| BUG-08 | T1.15, T1.28, T1.33, T1.36 |
| BUG-09 | T1.17, T1.33, T1.36 |
| BUG-10 | T1.16, T1.28, T1.33, T1.36 |
| BUG-11 | T1.18, T1.19, T1.20, T1.21, T1.22, T1.29, T1.33, T1.36, T3.10 |
| BUG-12 | T1.18, T1.29, T1.33, T1.36 |
| SB-01 | T2.1, T2.4, T2.6, T2.7, T8.15 |
| SB-02 | T2.1, T2.4, T2.6, T2.7 |
| SB-03 | T2.2, T2.3, T2.5, T2.6, T2.7 |
| CONV-01 | T3.2, T3.4, T3.15, T3.19, T3.24, T8.15 |
| CONV-02 | T3.2, T3.3, T3.5, T3.15, T3.16, T3.19, T3.24 |
| CONV-03 | T3.2, T3.3, T3.7, T3.16, T3.19, T3.23, T3.24 |
| CONV-04 | T3.3, T3.6, T3.7, T3.16, T3.19, T3.24 |
| CONV-05 | T3.3, T3.9, T3.10, T3.14, T3.17, T3.20, T3.23, T3.24, T7.11, T7.21, T7.24 |
| CONV-06 | T3.3, T3.10, T3.11, T3.17, T3.18, T3.19, T3.23, T3.24 |
| CONV-07 | T3.1, T3.18, T3.22, T3.23, T3.24 |
| CONV-08 | T3.12, T3.13, T3.14, T3.18, T3.21, T3.24 |
| CONV-09 | T1.11, T1.12, T1.27, T1.32, T1.36, T3.3, T3.8, T3.16, T3.19, T3.23, T3.24 |
| CONV-10 | T1.10, T3.1, T3.22, T3.24, T4.8 |
| CONV-11 | T3.2, T3.3, T3.4, T3.7, T3.15, T3.19, T3.24 |
| COMP-01 | T4.1, T4.2, T4.3, T4.10, T4.11, T4.14, T4.16, T4.17, T4.18, T8.15 |
| COMP-02 | T4.3, T4.4, T4.5, T4.11, T4.14, T4.17, T4.18 |
| COMP-03 | T4.6, T4.11, T4.14, T4.17, T4.18 |
| COMP-04 | T4.5, T4.7, T4.10, T4.12, T4.13, T4.14, T4.15, T4.18 |
| COMP-05 | T4.8, T4.10, T4.13, T4.15, T4.18 |
| COMP-06 | T1.8, T1.9, T1.26, T4.5, T4.12, T4.15, T4.16, T4.18 |
| COMP-07 | T4.2, T4.4, T4.5, T4.9, T4.10, T4.11, T4.12, T4.14, T4.18, T8.7 |
| EMPTY-01 | T5.1, T5.2, T5.5, T5.6, T5.8, T5.9, T8.15 |
| EMPTY-02 | T5.2, T5.6, T5.9 |
| EMPTY-03 | T5.3, T5.4, T5.5, T5.7, T5.8, T5.9, T7.15, T7.25 |
| BAK-01 | T6.1, T6.2, T6.3, T6.15, T6.16, T6.21, T6.24 |
| BAK-02 | T6.1, T6.5, T6.12, T6.15, T6.20, T6.21, T6.24, T7.13 |
| BAK-03 | T6.3, T6.5, T6.12, T6.16, T6.20, T6.21, T6.24 |
| BAK-04 | T6.5, T6.6, T6.7, T6.13, T6.18, T6.19, T6.20, T6.22, T6.23, T6.24 |
| BAK-05 | T6.4, T6.5, T6.13, T6.17, T6.22, T6.24 |
| BAK-06 | T6.7, T6.18, T6.23, T6.24, T8.15 |
| BAK-07 | T6.5, T6.11, T6.12, T6.13, T6.14, T6.20, T6.21, T6.22, T6.24 |
| BAK-08 | T6.1, T6.15, T6.24 |
| BAK-09 | T6.5, T6.8, T6.9, T6.10, T6.13, T6.19, T6.22, T6.23, T6.24 |
| TOOL-01 | T7.1, T7.2, T7.3, T7.5, T7.11, T7.16, T7.21, T7.27, T8.15 |
| TOOL-02 | T7.1, T7.6, T7.17, T7.22, T7.27 |
| TOOL-03 | T7.1, T7.7, T7.13, T7.18, T7.20, T7.23, T7.27 |
| TOOL-04 | T7.1, T7.8, T7.9, T7.10, T7.18, T7.24, T7.27 |
| TOOL-05 | T7.5, T7.7, T7.14, T7.16, T7.19, T7.25, T7.27 |
| TOOL-06 | T0.4, T0.5, T7.1, T7.12, T7.19, T7.20, T7.26, T7.27 |
| TOOL-07 | T7.15, T7.19, T7.25, T7.26, T7.27 |
| STT-01 | T8.1, T8.8, T8.14 |
| STT-02 | T7.4, T7.16, T8.12, T8.14 |
| STT-03 | T8.2, T8.3, T8.6, T8.9, T8.14 |
| STT-04 | T8.2, T8.9, T8.14 |
| STT-05 | T8.1, T8.4, T8.5, T8.8, T8.10, T8.12, T8.14 |
| STT-06 | T7.4, T7.16, T8.6, T8.10, T8.11, T8.12, T8.13, T8.14 |
| STT-07 | T8.3, T8.4, T8.7, T8.9, T8.11, T8.12, T8.13, T8.14, T8.15 |
| STT-08 | T8.4, T8.5, T8.10, T8.12, T8.14 |
| XC-01 | T0.1, T0.2, T0.3, T0.4, T0.5, T0.6, T0.7, T1.4, T1.30, T1.31, T1.34, T1.36, T2.7, T3.23, T3.24, T4.17, T4.18, T5.8, T5.9, T6.24, T7.26, T7.27, T8.13, T8.14, T8.16 |
