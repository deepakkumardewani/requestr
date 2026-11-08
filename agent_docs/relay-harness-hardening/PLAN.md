# Implementation Plan: Relay Harness Hardening

Source: `SPEC.md` (final; A1-A23 and decisions 1-9 apply) and `agent_docs/relay-harness-audit/REPORT.md`. Branch `feature/ai-agent`. Package manager `bun`. No dev server runs. No tests for `src/components/reactbits/`. Re-check every line number in the report before editing; they drift.

## Overview

Fix 39 open High/Medium findings (7 + 9 + 7 + 11 + 5 by phase) plus ride-along Lows, delivered in the confirmed order: (1) security/exfiltration, (2) turn lifecycle, (3) undo fidelity, (4) tool surface and token cost, (5) server metering. Each phase is a set of vertical slices: foundation layer, then one requirement at a time, each with a failing regression test first. Each phase ends at a checkpoint (targeted vitest, `biome check` on touched files, targeted headless e2e). `bunx tsc --noEmit` runs once, after the whole epic (user rule).

## Grounded code map (verified at HEAD)

| Concern | Real location |
|---|---|
| Tool kinds, `approvalNeeded`, `awaitsUser`, `registerConfirmGate`, `requiresDisableApproval`, `requiresBulkApproval`, `ALWAYS_ASK_TOOLS` | `src/lib/relay/tools/schemas.ts` (~L900-1000; 1000 lines; per-tool `kind: "read"/"auto"/"confirm"/"ui"`) |
| Registry, `runValidated` (calls `approvalNeeded` with `context.permissionMode`), `previewConfirmation`, `describe` | `src/lib/relay/tools/registry.ts` |
| Tool impls | `src/lib/relay/tools/{requestWrite,collectionWrite,chainWrite,environmentWrite,settingsWrite,appSettings,network,destructive,backupTools,catalogTools,duplicateTools,folderTools,tabRequests,tabs,workspaceRead,smart,history}.ts` |
| Change log + undo adapters | `src/lib/relay/changeLog.ts` (883 lines), `changeGroups.ts`, `changesSummary.ts`, testkit `testing/changeLogTestKit.ts` |
| Redaction and fences | `src/lib/relay/redact.ts`, `redact.corpus.ts`, `curl.ts`; private `stripDelimiters` + response fence in `tools/workspaceRead.ts` (moves to new `src/lib/relay/fence.ts`); `diff_responses`/`import_curl`/`export_curl` in `tools/smart.ts` |
| Chat loop (tool queue, Stop, regenerate, approvedRunning, sendAutomaticallyWhen) | `src/hooks/useRelayChat.ts` (884 lines) |
| Persistence | `src/lib/relay/threadDb.ts`, `src/stores/useRelayStore.ts`, `useRelayPermissionStore.ts` |
| Markdown | `src/components/relay/RelayMarkdown.tsx` |
| UI cards/composer | `src/components/relay/{ConfirmCard,ToolRow,TurnChangeBar,MessageActions,UserMessageActions,RelayComposer,MessageParts}.tsx` |
| Server | `src/app/api/{ai,relay/chat,relay/stt}/route.ts`, `src/lib/relay/server/{guard,rateLimit,localRedisCounter,systemPrompt}.ts`, `src/lib/redis.ts` (Upstash) |
| Prompts, slash, capabilities, budget | `src/lib/relay/prompts/index.ts`, `slashCommands.ts`, `capabilities.ts`, `tokenBudget.ts`, `contextBuilder.ts`, `constants.ts` |
| Dirty-tab gate | `src/lib/relay/tools/tabs.ts` (`registerConfirmGate`, `CLOSE_DECISIONS`), `src/stores/useTabsStore.ts`; save path `src/hooks/useSaveRequest.ts` |
| Hub import | `src/lib/hub.ts` (`importHubEntry`, `getImportedSlugs`, `isValidHubSlug`; used by `src/components/hub/HubProviderCard.tsx`) |
| Settings tools | `settingsWrite.ts`: `set_global_variables` (base URL + global headers), `update_proxy_settings`, `set_relay_preferences`; downloads: `export_history` (`history.ts`), `export_postman` (`catalogTools.ts`), `export_backup` (`backupTools.ts`, already `confirm`) |
| Locales | `messages/{en,fr,ja}/relayDock.json` |
| Existing e2e | `e2e/qa/relay/*.spec.ts` (72 files); new specs go in `e2e/qa/relay-harness-hardening/` |

Note: `risk()` belongs next to `approvalNeeded` in `schemas.ts` (`approvalNeeded` already takes name, input, mode and is the single choke point used by `runValidated`, `awaitsUser` and the UI). Do not add a second decision site.

## Dependency graph

```
HH-RISK (schemas.ts approvalNeeded + risk table)
  ├─ H03, H04, M05, M06, L-05 (escalations)         [Phase 1]
  └─ (Skip unchanged; Always-ask unchanged)
HH-M07 (gate on delete tools) ──► H07 (dirty-tab edit gate, Phase 3)
HH-TURN store + per-call binding
  ├─ H01 (stopped state) ─┐
  ├─ H06 (captured thread/turn) ─► H05 (Retry) ─► M23 (Regenerate keep/undo) ─► L-23
  ├─ M01 (AbortController per call) ─► M20 (Send disabled while pending)
  └─ M21/M22 (persist partial + running marker; need threadDb)   M24 independent
H06 (turn id captured in change log) ─► M23, HH-UNDO grouping
HH-UNDO adapter contract (dependents, status, all-or-nothing, tab ids)
  ├─ H09, M11, M12, M13, M14, L-09/L-14/L-15
  └─ H07 (restores tab too)   M10 independent
Phase 4: schemas rename/merge (M02, M17, M18, M19, A12-A14)
  ─► M03 topic loading (needs final tool set + capability categories) ─► M26, M27
  M00 ─► M09 (shared Hub import fn)   M15 before M16 prompt text
Phase 5: rateLimit counter interface (A22) ─► M28/M29 ─► guard rewrite (H08, M30) ─► /api/ai, STT (M25)
```

Cross-phase ordering constraints:
- HH-RISK before any individual escalation. HH-TURN binding before H05/M23. HH-UNDO contract (and its property test) before per-entity undo fixes.
- H07 uses the dirty-tab confirm gate shipped in M07 (Phase 1); do not re-create it.
- M03 must come after M18/M19/M02 (final tool names) and before locale/consistency-matrix finalisation.
- L-24 and L-04 touch attachment/fence code that H06/M03/M15 also edit; do them in the same slice as their parent.
- Guard rewrite (Phase 5) changes the shared counter interface; Phase 5 tasks must be sequential, not parallel.

## Requirement-to-phase map (all 39)

| Phase | Requirement IDs |
|---|---|
| 1 | HH-RISK, HH-H02, HH-H03, HH-H04, HH-M04, HH-M05, HH-M06, HH-M07 (+L-04, L-05, L-07, L-24, part L-01) |
| 2 | HH-TURN, HH-H01, HH-H05, HH-H06, HH-M01, HH-M20, HH-M21, HH-M22, HH-M23, HH-M24 (+L-03, L-10, L-16, L-18, L-21, L-23, L-26) |
| 3 | HH-UNDO, HH-H07, HH-H09, HH-M10, HH-M11, HH-M12, HH-M13, HH-M14 (+L-09, L-14, L-15) |
| 4 | HH-M00, M02, M03, M09, M15, M16, M17, M18, M19, M26, M27 (+L-01, L-02 part, L-06, L-20, L-22 part) |
| 5 | HH-H08, HH-M25, HH-M28, HH-M29, HH-M30 (+L-02 narrowed, L-25) |

Count: 7 + 9 + 7 + 11 + 5 = 39. HH-RISK and HH-TURN/HH-UNDO are shared foundations, not extra IDs.

## Architecture decisions

1. **One decision site.** `risk(name, input, ctx): "low" | "escalate"` (`ctx` = read-only current settings, used only by the HH-M05 header diff) is a table beside `RELAY_TOOL_SCHEMAS`; `approvalNeeded` returns true for `auto` + `escalate` only when mode is `review`. Skip and Always-ask are untouched. `awaitsUser`, `runValidated`, `describe`/`previewConfirmation` all go through it, so a card appears and the run is gated consistently. Escalating `auto` tools need a `describe` (script text, host, etc.); `describeGeneric` covers the rest.
2. **Turn state in a store.** `src/stores/useRelayTurnStore.ts` (Zustand, per project rule) holds the state machine; `useRelayChat.ts` becomes a thin consumer. Per-call binding object `{threadId, turnId, attachments, addToolOutput, controller}` is created in `onToolCall`, replacing the refs read at run time (`addToolOutputRef`). Split the 884-line hook as part of this (extract `useToolQueue`, turn helpers) to keep functions under ~30 lines.
3. **Undo adapter contract.** Extend the adapter shape in `changeLog.ts`: `dependents()`, atomic restore with status (`ok | conflict | unavailable | already-undone`), snapshot includes `wasActive`, closed tab ids, `isDirty`. One property-test harness (`changeLog.property.spec.ts`) enumerates every write tool via the registry and fails when a new write tool lacks a case.
4. **Tool surface is data-driven.** Capability categories (`capabilities.ts`) are the single source for topics (M03), the prompt scope list (M27) and the consistency matrix. `load_tools` is a core tool; the server computes the enabled set and sends only those tools.
5. **Guard stays one module.** `guard.ts` gains a parameterised entry used by chat, STT and `/api/ai` (different bucket prefixes and budgets, no flag check for `/api/ai`). Counter interface gains `incrWithExpiry` (A22). Trusted IP header is a single constant.
6. **Constants.** Add to `constants.ts`: `RELAY_PARTIAL_SAVE_MS`, `RELAY_MAX_RATE_KEYS`, `RELAY_MAX_SCOPE_CHARS`, `RELAY_KEEP_TOOL_RESULTS`, `RELAY_REQUEST_RATE_MAX`, `RELAY_DAILY_REQUEST_CAP`, `TRUSTED_IP_HEADER`.

## Phases and task slices

Task IDs are indicative; TASKS.md will refine. Each slice = failing test, fix, locale keys (en/fr/ja) where UI strings change. Size S/M only; anything L gets split.

### Phase 1: Security and exfiltration

- P1.1 **HH-RISK foundation** (M): `risk()` table + `approvalNeeded` change in `schemas.ts`; thread through `awaitsUser`/`runValidated`; unit tests all three modes, mode flip with pending card. Files: `schemas.ts`, `registry.ts`, specs.
- P1.2 **HH-H02 images** (S): `RelayMarkdown.tsx` `img` override -> link via `allowRelayUrl`, else text. Spec + Playwright no-network assertion.
- P1.3 **HH-H03 scripts** (M): `set_request_scripts` escalate + describe shows full script; secret-literal refusal using redact patterns; description reworded. Files: `requestWrite.ts` (or scripts tool site), `schemas.ts`, `redact.ts`, locale for error.
- P1.4 **HH-H04 + L-07** (M): `shareValues -> true` escalation (input-dependent risk); `redactEnvironment`/`describeEnvironment` single shape. Files: `appSettings.ts`/`settingsWrite.ts`, `redact.ts`, `workspaceRead.ts`.
- P1.5 **HH-M04 redaction** (S): formats added to `redact.ts` + `redact.corpus.ts`; `curl.ts` basic-auth username handling; round-trip test.
- P1.6 **HH-M05 send target + base URL/global headers** (M): `resolveSendTarget()` in `network.ts` shared by `describe` and `run`; `urlProblem` on baseUrl; escalate base URL and global header add/value change; relative URL resolution.
- P1.7 **HH-M06 + L-05** (S): `sslVerify -> false` escalation; remove `proxyUrl` from schema (keep `changeLog.ts` `PROXY_KEYS` for old entries); downloads escalate (`history.ts` `export_history`, `catalogTools.ts` `export_postman`; `export_backup` is already `confirm`, no double prompt).
- P1.8 **HH-M07** (S): register dirty-tab gate on delete tools in every mode (`tabs.ts`, `schemas.ts`); Skip-mode test.
- P1.9 **L-04 / L-24 fences** (S): move `stripDelimiters` + fence from `workspaceRead.ts` into new `fence.ts`; apply to `diff_responses` (`smart.ts`), WS output (`tabRequests.ts`), attachment details (`attachments.ts`). Note M15 later edits `tabRequests.ts` near the WS output; keep helper in a shared file.
- **Checkpoint 1:** vitest on touched relay specs; `biome check`; Playwright `relay-harness-hardening/security.spec.ts` (Review card for script/base URL/shareValues, no card in Skip; no image request).

### Phase 2: Turn lifecycle

- P2.1 **HH-TURN store + per-call binding** (M): `useRelayTurnStore.ts` with legal transitions; extract tool queue from `useRelayChat.ts`; bind thread/turn/attachments/addToolOutput/controller at `onToolCall`. Highest-risk task: land alone, existing relay specs must stay green.
- P2.2 **HH-H01 Stop** (S/M): `stopped` state, `sendAutomaticallyWhen` guard; replace spec that mocked follow-up.
- P2.3 **HH-H06 thread switch** (M): change log records captured turn id; output delivered to captured thread (`threadDb.ts`/`useRelayStore.ts`); deleted-thread case.
- P2.4 **HH-M01 + HH-M20** (M): AbortController per call into `ToolContext.signal`; `approvedRunning` counts auto tools; composer Stop/disabled Send (`RelayComposer.tsx`).
- P2.5 **HH-H05 + L-23** (M): Retry vs Regenerate split; `step_cap` code + Continue action; `MessageActions.tsx`, `ErrorBubble.tsx`, `errors.ts`, locale keys.
- P2.6 **HH-M23 + L-21** (M): Keep/Undo dialog before Regenerate/Edit & resend; re-key to new turn id; `TurnChangeBar.tsx`, `changeGroups.ts`.
- P2.7 **HH-M21 + L-26 + L-16** (M): throttled partial save, `pagehide` flush, pending-entry retention, `updatedAt` compare (`threadDb.ts`, `useRelayStore.ts`). Persisted-field changes beyond those named are ask-first.
- P2.8 **HH-M22 + L-03 + L-18** (M): running marker persisted; restore settles as interrupted; cancel errors = Declined. Marker is a new persisted field named in the spec (permitted).
- P2.9 **HH-M24 + L-10** (S): `storage` listener in `useRelayPermissionStore.ts` / `useRelayStore.ts`; pending "turn off after reply" persisted.
- **Checkpoint 2:** full relay unit suite; Playwright `lifecycle.spec.ts` (Stop, Retry no duplicates, thread switch, Regenerate prompt); manual headless check of Stop in Skip mode.

### Phase 3: Undo fidelity

- P3.1 **HH-UNDO contract + property test** (M): adapter shape, status, all-or-nothing, idempotent second undo, IndexedDB-unavailable state (L-15), tab ids in snapshot, `isDirty` (L-14). Property test written first; initially marks known failures as `it.fails`/todo that later tasks flip. Files: `changeLog.ts`, `testing/changeLogTestKit.ts`.
- P3.2 **HH-H09 + HH-M12** (M): `captureTree` includes chain; chain duplicate `standalone`; `duplicate_collection` copies chain (`collectionWrite.ts`, `duplicateTools.ts`, `useChainStore.ts`, `useCollectionsStore.ts`).
- P3.3 **HH-M13 + L-09** (S): `wasActive` + `setActive` on undo; separate `action` for active-env change (`environmentWrite.ts`, `changeLog.ts`).
- P3.4 **HH-M10** (S): validate all ids first (`destructive.ts`).
- P3.5 **HH-M11** (M): `import_backup` recorded as one change with adapter (`backupTools.ts`, `ImportBackupConfirm.tsx`).
- P3.6 **HH-M14** (S): shared save function for Save-all-and-close and gate (`tabs.ts`, `useTabsStore.ts`, `useSaveRequest`).
- P3.7 **HH-H07** (M): request writes patch clean open tab; dirty tab goes through confirm gate in every mode (`save-all` / `discard` / decline); undo restores tab too. Depends on P1.8 and P3.1, P3.6.
- **Checkpoint 3:** property test green for every write tool; Playwright `undo.spec.ts` (edit open request, delete collection with chain then Undo, import backup Undo).

### Phase 4: Tool surface and token cost

Order matters: shapes first, then topics, then trimming/prompt.
- P4.1 **HH-M02 + part L-22** (M): unify read/write vocabulary (`form-data`, `xml`, `html`, `api-key`, `key`, `value`); writable xml/html; round-trip test (`schemas.ts`, `requestWrite.ts`, `workspaceRead.ts`).
- P4.2 **HH-M17 + HH-M19** (S): `.nullish()` chain fields; drop `graphql` from relay `BODY_TYPES` (not `shareLink.ts`); thread-render check for old inputs.
- P4.3 **HH-M18** (M): drop `delete_request` (`capabilities.ts` L107,166, keep locale labels), folder/collection id separation with coded errors, `parentId` rename. Add old-thread render test.
- P4.4 **HH-M00 + HH-M09 + L-06** (M): `list_api_catalog`, slug validation before card, shared Hub import function, one-commit import, refuse duplicates; generic `validate(input)` step (`catalogTools.ts`, `src/lib/hub.ts`, `registry.ts`).
- P4.5 **HH-M15** (M): `get_request` extras, `get_tab_request` HTTP, `list_history`, folders in search (`workspaceRead.ts`, `tabRequests.ts`, `history.ts`).
- P4.6 **HH-M03 + L-02 + L-20** (L -> split): (a) `capabilities.ts` topics + `load_tools` schema/impl; (b) server computes enabled set from slash topic, attachment kinds, `load_tools` in current turn (`chat/route.ts`, `slashCommands.ts`, `attachments.ts`); (c) coded "load_tools first" error; (d) measure payload <= 20,000 chars. Depends on P4.1-P4.5 final tool names.
- P4.7 **HH-M16 + HH-M27 + L-01** (S): prompt wording (parallel calls, no "one change at a time"), scope list generated from categories, permission mode in per-request context (`systemPrompt.ts`, `prompts/index.ts`, `contextBuilder.ts`).
- P4.8 **HH-M26** (M): stub older tool results in `contextBuilder.ts`/`tokenBudget.ts`; keep call/result pairing; never stub pending.
- P4.9 **Locale + consistency matrix** (S): en/fr/ja labels for added/renamed tools and new error codes; matrix test has no hard-coded count.
- **Checkpoint 4:** consistency matrix test; payload size test; Playwright `tool-surface.spec.ts` (slash topic loading, old thread renders).

### Phase 5: Server metering and robustness

- P5.1 **Counter interface + HH-M28** (M): `incrWithExpiry` on Redis (local, Upstash) and memory counters (`rateLimit.ts`, `localRedisCounter.ts`, `src/lib/redis.ts`); reset `clientPromise` on rejection; guard errors -> coded responses.
- P5.2 **HH-M29** (S): bounded memory counter, sweep, evict, key truncation, log-once.
- P5.3 **HH-H08 chat guard** (M): `TRUSTED_IP_HEADER` only; `requests` + `turns` meters; daily IP caps; Origin / `Sec-Fetch-Site` rule; remove client-derived step-count logic; README + `agent_docs/polish-and-landing/legal-checklist.md` row 7 note (`guard.ts`, `constants.ts`, `chat/route.ts`).
- P5.4 **HH-M30** (M): Content-Length + streamed body cap + charge before parse (`chat/route.ts`).
- P5.5 **HH-H08 `/api/ai`** (M): guard without Relay flag, `ai:` buckets, zod, `maxOutputTokens`, LLM-key check (`ai/route.ts`, `useAI.ts` unaffected).
- P5.6 **HH-M25 + L-25** (S): STT guard without LLM-key check, Content-Length first, upstream timeout (`stt/route.ts`).
- P5.7 **Wrap-up** (S; TASKS.md splits this into its own Phase 6: gate T6.1, walkthrough T6.2, DoD T6.3): REPORT.md "Resolved in relay-harness-hardening" markers (ID, requirement, commit, test file; L-02/L-22 partial); full `bunx tsc --noEmit`, `bunx biome check`, final targeted e2e run.
- **Checkpoint 5 / Done:** all ACs, SPEC section 8.

Parallelisation: within a phase, independent slices (e.g. P1.2/P1.5/P1.8, P3.3/P3.4/P3.6, P4.2/P4.5/P4.7) can run in parallel only if they touch disjoint files; anything touching `schemas.ts`, `changeLog.ts`, `useRelayChat.ts` or `guard.ts` is sequential. Phase 5 is fully sequential.

## Test strategy per phase

| Phase | Unit (Vitest, spec beside source, >= 80% on touched files) | Playwright e2e (targeted, headless, seeded) |
|---|---|---|
| 1 | `schemas.spec.ts` risk x mode matrix; redact corpus; `RelayMarkdown.spec.tsx`; network `resolveSendTarget`; curl round-trip | Approval cards in Review, none in Skip; no image network request; dirty-tab delete gate in Skip |
| 2 | Turn store transitions; hook specs (Stop zero fetches, Retry no duplicates, captured thread); threadDb partial save/pagehide; storage-event sync | Stop mid-`run_chain`; Retry after step error; thread switch with queued tool; Regenerate Keep/Undo dialog; reload during approved call |
| 3 | Property test write -> undo -> deep-equal for all write tools; per-entity specs (chain, env active, backup import, multi-delete) | Edit open request then Save; delete collection + Undo; import backup + Undo |
| 4 | Round-trip read/write per body/auth type; registry/matrix consistency; payload size budget; contextBuilder stubbing; catalog slug validation; route spec for enabled set | Slash command topic loading; old thread with removed tool name renders |
| 5 | Guard with fake counter (Redis reject/expire fail, forged headers, oversized/chunked bodies, 20,000 keys); `/api/ai` and STT route specs | Minimal: Relay and inline AI still work end to end |

Every requirement ships at least one regression test that fails on pre-fix code (write test first, confirm red). Server and logic requirements stay unit-level; only visible behaviour (Stop, Retry, thread switch, Undo, cards, images) gets e2e. e2e specs live in `e2e/qa/relay-harness-hardening/` and are run one file at a time. Visual checks: headless agent-browser with seed `--init-script`, repo-named session, closed afterwards. `bunx tsc --noEmit` only after the full epic.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Refactoring `useRelayChat.ts` (884 lines) for HH-TURN regresses existing relay behaviour | High | Land P2.1 alone behind existing specs/e2e; keep behaviour identical before adding Stop/Retry changes |
| `risk()` leaves a gap (a tool changed to escalate in only one call path, UI shows no card but run is refused) | High | Single decision site; test `awaitsUser` and `runValidated` agree for each escalating tool |
| Undo adapter changes corrupt existing persisted change-log entries | High | Keep old snapshot fields readable (`PROXY_KEYS`, missing `wasActive`); migration tests with legacy snapshots |
| Persisted-thread changes (running marker, partial save, removed tool names) break old threads | Med | Read-tolerant restore; render tests with legacy fixtures; do not add persisted fields beyond SPEC names |
| M03 topic loading makes the model call a missing tool, harming usability | Med | Coded "load_tools first" error, core set includes common tools; payload and behaviour tests; no tool disappears with pending result |
| Vercel `x-real-ip` assumption (A6) is wrong for a deployment | Med | Re-confirm Vercel docs before P5.3; document self-host requirement; single constant |
| IP-scoped daily caps hit shared NAT users | Low/accepted | Documented per SPEC |
| Prompt changes (M16, M27) alter model behaviour; no live-model eval (theme 7 out of scope) | Med | Keep wording diffs minimal; assert strings in tests; manual smoke |
| `schemas.ts` (1000 lines) and `changeLog.ts` are merge hotspots across phases | Med | Sequential edits in those files; commit per slice when the user asks |
| Locale drift (en/fr/ja) | Low | Locale parity test in each slice that adds strings |
| Skip-mode behaviour changed accidentally | Med | Explicit Skip-mode assertion in each escalation and lifecycle test |

## Open items to confirm before coding

- None block planning. Reviewer should still challenge A6 (meter limits, `x-real-ip`) and A11 (topic loading) as flagged in SPEC section 10.
- No commits are made unless the user asks; `/build-phases` may commit after verifier PASS per workflow.
