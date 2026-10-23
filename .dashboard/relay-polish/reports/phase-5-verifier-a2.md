# Phase 5 verifier report (attempt a2)

Verdict: FAIL. Every Verify and checkpoint command exits 0, and all six a1 issues (F1-F4) are resolved. The new history redaction added in a2 (`buildChatPayload` + `route.ts`) introduces two concrete correctness regressions (R1, R2), and one helper-file quality violation remains (Q1).

## Commands run (all foreground, by the verifier)

| Task | Command | Result |
|---|---|---|
| P5.1-P5.8 + route | `bunx biome check` on every Files entry + route.ts/route.spec.ts | exit 0, "Checked 20 files ... No fixes applied" |
| P5.1-P5.8 + route/redact | `bunx vitest run` on the 18 task specs + route.spec + redact.spec | 20 files, 1298 passed |
| P5.1 | grep computeContextChips/selectActiveChips/isAutoChip in chips.ts, contextBuilder.ts | exit 0 (empty) |
| P5.2 | grep dismissAutoChip/dismissedAutoChipTabId/removedChipKeys/resetRemovedChips/draftChips src | exit 0 |
| P5.3 | grep useAvailableChips/AutoChipLabel src; ls p5-chips-*.png | exit 0; 4 files |
| P5.5 | grep 'import.*stores' schemas.ts | exit 0 |
| P5.7 | grep deriveSuggestions/useSuggestionContext src; ls p5-empty-*.png | exit 0; 4 files |
| P5.8 | ls p5-picker-*.png | 5 files |
| P5.9 | scoped coverage command verbatim (+ skipFull=false) | 5 files, 167 passed; only non-100% file useRelayChat.ts 97.5 S / 94.69 B / 98.07 F / 98.83 L, uncovered 268,283 |
| P5.10 | scoped coverage command verbatim | 110 passed; only non-100% file workspaceRead.ts 100 S / 96.62 B / 100 F / 100 L |
| P5.11 | playwright context-chip + context-payload --repeat-each=3 | 24 passed |
| P5.12 | playwright pills --repeat-each=3 | 15 passed |
| P5.13 | playwright picker + privacy + chat --repeat-each=3 | 81 passed |
| P5.14 | playwright relay-polish-ctx --repeat-each=3 | 30 passed (10 tests, ids CTX-01..10 in feature) |
| all e2e | `bash e2e/scenarios/relay/check-ids.sh` | "OK: scenario IDs consistent", exit 0 |
| tests | grep test.fail/it.fails/.skip(/.only(/.fixme/waitForTimeout over all phase specs + helpers | no hits |
| P5.15 | `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n` | 130 files, 3462 passed |
| P5.15 | playwright relay-polish-ctx --repeat-each=2 | 20 passed |
| P5.15 | six legacy specs (chip, payload, pills, picker, privacy, chat) | 40 passed |
| P5.15 | `bun run lint:check` | exit 0, 726 files |
| P5.15 | `bun run typecheck` | exit 0 |
| P5.15 | brandGuard.spec | 12 passed |
| P5.15 | removed-symbol grep over src | exit 0 |

## a1 issues: status

- F1 Log lines: RESOLVED. TASKS.md now has `- **Log**:` lines at L745 (P5.3 design note naming ui-ux-pro-max/impeccable/layout), L774 (P5.5 audit), L804 (P5.7 design + followUps audit), L819 (P5.8 design note), L872 (P5.12 deleted ids REL-ICTX-03/09/10), L888 (P5.13 changes).
- F2 blank screenshots: RESOLVED. Viewed each: p5-empty-1440-light (1440x900, dock with 3 starters), p5-empty-320-light/dark (320x700 dock, 3 starters wrap, light/dark correct), p5-picker-320-dark (600x700 clip; the dock in frame is 320 wide and the picker shows the "Current tab / No tab open" row above results). Judged OK.
- F3 vacuous replay tests: RESOLVED as tests. useRelayChat.spec.ts:1094 seeds `note: JWT_SECRET` (raw eyJ... JWT) in the old get_active_context output and asserts it is absent from the body; CTX-09 (relay-polish-ctx.spec.ts:190) seeds `{key:"JWT_SECRET", value: LEGACY_RAW_SECRET}` and asserts the raw value is absent. Hydration (threadDb / threads store) does not redact, so only buildChatPayload can remove it; both tests are non-vacuous. contextBuilder.spec adds a history case; route.spec adds "rejects history that still holds a secret". BUT the source fix itself has regressions, see R1/R2.
- F4.1 docblock: RESOLVED (banner JSDoc back above expectBanner; attachCurrentTab has its own doc).
- F4.2 local attachCurrentTab in context-chip spec: RESOLVED (imports shared helper).
- F4.3 attach flow x3: RESOLVED (shared attachFromPicker used by polish-ctx, payload (via thin attachAndExpectChip that adds a count assertion), relay-chat:275). The remaining inline `relay-picker-trigger` clicks at polish-ctx:115 and context-chip:112 only open the picker to check the disabled row; not the attach flow. Judged OK.
- F4.4 ContextChips: RESOLVED (`attachedItems.filter((chip) => isStillAttached(store, chip))`).
- F4.5 StarterKey: RESOLVED (`grep -rn StarterKey src e2e` exit 1).

## Failures

### R1. History redaction mangles message structure (src/lib/relay/contextBuilder.ts:114)
`const messages = redactDeep(input.messages, input.redact);` runs the full redactor, including `scrubKnownSecrets` (any secret env value of >= 3 chars, MIN_SCRUB_VALUE_LENGTH), over EVERY string in every UIMessage, including structural fields: `id`, `role`, part `type`, `state`, `toolCallId`. Before a2 only `context` (and tool results at creation) went through it.

Evidence (scratch scripts in the session scratchpad, calling the real `redactDeep` and `ai`'s `convertToModelMessages`):
- secret value "text": user part `type:"text"` becomes `type:"{{S}}"`; convertToModelMessages then yields a user message with 0 content parts (the user's text silently disappears).
- secret value "available": tool part `state:"output-available"` becomes `"output-{{S}}"`; the converted assistant message keeps the tool-call but the tool-result message is dropped (orphan tool call, which providers reject).
- secret value "get_request": part `type` becomes `"tool-{{S}}"` (tool name corrupted).
- Any short secret that happens to be a substring of a random message id or toolCallId also rewrites the id.

Fix: redact only content fields of history, not structure. For text parts redact `text` (or leave user text alone, see R3); for tool parts redact `input`, `output` and `errorText`; leave `id`, `role`, `type`, `state`, `toolCallId` untouched. Add a contextBuilder.spec case with a short secret value that equals/contains a structural string (e.g. "text" and "available") and assert role/type/state/toolCallId are unchanged while the secret in output is still scrubbed.

### R2. Server check shifts redaction depth by one (src/app/api/relay/chat/route.ts:137)
`hasUnredactedSecret({ context, messages })` wraps both in a new object, so `redactDeep`'s MAX_DEPTH (24) cuts in one level earlier on the server than on the client (which redacts `context` and `messages` separately from depth 0). redactDeep is therefore not idempotent across client and server at the depth boundary.

Evidence (scratch script): a tool part whose output nests 20+ levels => client output passes `hasUnredactedSecret(messages)` but the server's wrapped check returns true (400 relay_unavailable); for context, nesting 23-24 levels passed the old check and now fails. Because the history is persisted, every later turn of that thread would 400. Rare (get_collection depth is capped at 3), but a permanent failure mode and untested.

Fix: `if ((context && hasUnredactedSecret(context)) || hasUnredactedSecret(messages))` (or, after R1, check only the content fields that the client redacts). Add a route.spec case with a client-redacted deeply nested tool output that must be accepted.

### R3 (scope note, decide together with R1). User-typed text is now redacted
FR-60 (relay-agent SPEC L79) scopes redaction to "every tool result and context chip"; RP-203 asks for replayed tool parts to be redacted. a2 also redacts what the user types and what the assistant wrote: "decode this jwt eyJ..." now reaches the model as "decode this jwt [redacted] please", and `password=hunter22` in assistant text becomes `password=[redacted]`. route.spec's new test enforces that a user text part with a JWT is rejected server-side. This is a behaviour change beyond the AC. When fixing R1, either restrict redaction to tool-part content (matching FR-60) or record the product decision explicitly; do not leave it implicit.

### Q1. Magic test-id strings in e2e/fixtures/relayE2eHelpers.ts:69-90
The file declares its test ids as named constants (L17-22: TOGGLE, DOCK, CLOSE, COMPOSER, SEND, BANNER), but the new `attachCurrentTab` and `attachFromPicker` inline nine literals: "relay-picker-trigger" (L69, L81), "relay-picker" (L70, L72, L82, L90), "relay-picker-current-tab" (L71), "relay-picker-search" (L84), "relay-picker-row" (L86). Fix: add PICKER_TRIGGER, PICKER, PICKER_CURRENT_TAB, PICKER_SEARCH, PICKER_ROW constants beside the others and use them.

## Passing checks (do not re-raise)
- P5.1-P5.8: behaviour as in a1 report; all task Verify commands green (see table). Log lines now present.
- P5.9: lowest figure useRelayChat.ts 94.69% branches; uncovered 268 (defensive "chat is not ready" throw) and 283 (catch logging), both pre-existing in HEAD; justified. Other four files 100%.
- P5.10: lowest workspaceRead.ts 96.62% branches; others 100%.
- P5.11-P5.14: all specs green x3; one test per scenario id; no weakened tests.
- route.ts / route.spec.ts edits are outside Files but accepted as the source fix for a1 F3 (subject to R1/R2).
- P5.15: all commands exit 0; gate cannot pass while R1, R2, Q1 are open.
