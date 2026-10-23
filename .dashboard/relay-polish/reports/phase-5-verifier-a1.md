# Phase 5 verifier report (attempt a1)

Verdict: FAIL. Every Verify command exits 0 and every test is green. The phase still fails on four counts: missing task Log lines, four blank screenshots, vacuous replay-redaction assertions, and concrete quality violations.

## Commands run (all foreground, by the verifier)

| Task | Command | Result |
|---|---|---|
| P5.1-P5.8 | `bunx biome check` on every Files entry (+ RelayPickerRow.tsx, OpenInRelayButton.tsx) | exit 0, no fixes |
| P5.1 | `bunx vitest run chips.spec contextBuilder.spec` | 2 files, 35 passed |
| P5.1 | grep `computeContextChips|selectActiveChips|isAutoChip` in chips.ts/contextBuilder.ts | empty |
| P5.2 | `bunx vitest run useRelayStore.spec useRelayChat.spec` | 2 files, 113 passed |
| P5.2 | grep `dismissAutoChip|dismissedAutoChipTabId|removedChipKeys|resetRemovedChips|draftChips` src | 0 hits |
| P5.3 | `bunx vitest run ContextChips.spec RelayComposer.spec` | 2 files, 47 passed |
| P5.3 | grep `useAvailableChips|AutoChipLabel` src | 0 hits; p5-chips-*.png exist (4 real images) |
| P5.4 | `bunx vitest run workspaceRead.spec registry.spec` | 2 files, 73 passed |
| P5.5 | `bunx vitest run schemas.spec systemPrompt.spec brandGuard.spec` | 3 files, 46 passed; no `import.*stores` in schemas.ts |
| P5.6 | `bunx vitest run relayMessages.parity.spec messages.parity.spec` | 2 files, 846 passed |
| P5.7 | `bunx vitest run suggestions.spec EmptyState.spec followUps.spec` | 3 files, 28 passed; grep deriveSuggestions/useSuggestionContext 0 hits |
| P5.8 | `bunx vitest run RelayPicker.spec useRelayPickerItems.spec` | 2 files, 40 passed |
| P5.9 | scoped coverage command (verbatim) | 166 passed; only non-100% file: useRelayChat.ts 98.83 L / 94.69 B / 98.07 F / 97.5 S, uncovered 268,283 |
| P5.10 | scoped coverage command (verbatim) | 110 passed; only non-100% file: workspaceRead.ts 100 L / 96.62 B / 100 F / 100 S |
| P5.9+10 | json-summary with skipFull=false (all 10 files) | chips, contextBuilder, useRelayStore, followUps, suggestions, registry, EmptyState, RelayPicker all 100/100/100/100 |
| P5.11 | `playwright test context-chip context-payload --repeat-each=3` | 24 passed (8 x3) |
| P5.12 | `playwright test relay-improvements-pills --repeat-each=3` | 15 passed (5 x3) |
| P5.13 | `playwright test picker privacy relay-chat --repeat-each=3` | 81 passed (27 x3) |
| P5.14 | `playwright test relay-polish-ctx --repeat-each=3` | 30 passed (10 x3) |
| all e2e | `bash e2e/scenarios/relay/check-ids.sh` | OK, relay-polish-ctx 10/10 ids |
| P5.15 | `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n` | 130 files, 3461 passed |
| P5.15 | `playwright test relay-polish-ctx --repeat-each=2` | 20 passed |
| P5.15 | six legacy specs (chip, payload, pills, picker, privacy, chat) | 40 passed |
| P5.15 | `bun run lint:check` | exit 0 (726 files) |
| P5.15 | `bun run typecheck` | exit 0 |
| P5.15 | `bunx vitest run brandGuard.spec` | 12 passed |
| P5.15 | removed-symbol grep over src | exit 0 |
| tests | grep `test.fail|it.fails|.skip(|.only(|.fixme|waitForTimeout` on all phase specs | no hits |

## Failures

### F1. Task Log lines are missing for P5.3, P5.5, P5.7, P5.8, P5.12 and P5.13
`git diff --stat -- agent_docs/relay-polish/TASKS.md` is empty, so no Log line was written to TASKS.md for this phase.
- Conventions L9 says "record one line in the task Log naming what each skill changed ... The verifier rejects a UI task without the Log line." Three UI tasks are missing it: P5.3, P5.7 and P5.8. The only design record is `events.jsonl:247`. That note is generic ("reused chip/pill/row tokens ...") and never names ui-ux-pro-max, impeccable or layout. Phase 4 failed verification for the same gap (`phase-4-verifier-a1.md:49`).
- These Do lines also require a Log entry, and none is in TASKS.md:
  - P5.5 "list the audit result in the Log".
  - P5.7 "record the audit in the Log".
  - P5.12 "Record deleted ids in the Log" (REL-ICTX-03/09/10).
  - P5.13 "list the changes in the Log".
- **Fix**:
  - Run the ui-ux-pro-max, impeccable and layout skills for P5.3, P5.7 and P5.8. Add a `- **Log**:` line to each one naming what each skill changed.
  - Add `- **Log**:` lines with the audit result to P5.5 and P5.7.
  - Add the deleted ids to P5.12 and the list of spec changes to P5.13. The engineer reports already contain both.

### F2. Four screenshots are blank, so P5.7 and P5.8 lack valid visual evidence
Each file was opened and inspected:

| File | Contents | Size |
|---|---|---|
| `agent_docs/qa/relay-polish/p5-empty-1440-light.png` | solid dark frame | 5852 B |
| `agent_docs/qa/relay-polish/p5-empty-320-light.png` | solid dark frame, 500x557 (not 320px wide) | 1982 B |
| `agent_docs/qa/relay-polish/p5-empty-320-dark.png` | solid dark frame, 500x557 | 1982 B |
| `agent_docs/qa/relay-polish/p5-picker-320-dark.png` | solid dark frame, 500x557 | 1982 B |

- Valid: all four `p5-chips-*` images, `p5-empty-1440-dark`, `p5-picker-1440-*` and `p5-picker-320-light`.
- So P5.7 has 1 real screenshot out of the 4 required, and P5.8 has no 320px dark image. The `test -n "$(ls ...)"` Verify passes only because the files exist.
- **Fix**: recapture them with agent-browser `--init-script e2e/fixtures/qa-seed.init.js`, with the dock open at a real 320px panel width and at 1440px, in light and dark.

### F3. The replay redaction check cannot fail (P5.9 replay case and P5.14 REL-POL-CTX-09)
- **P5.14, CTX-09** (`e2e/qa/relay/relay-polish-ctx.spec.ts:205-266`): the seeded legacy part already holds `"[redacted]"`, and `SECRET_VALUE` is never seeded anywhere a leak could come from. So `toContain("[redacted]")` and `not.toContain(SECRET_VALUE)` pass whatever the app does. The engineer report says so itself: "outbound messages are not re-redacted client-side".
- **P5.9, replay case** (`src/hooks/useRelayChat.spec.ts:1094-1126`): the seeded part holds only `{kind:"tab", tabId:"t9", name:"Old tab"}`, so `not.toContain(JWT_SECRET)` is vacuous too.
- **Requirement**: SPEC RP-203 AC, PLAN L128 and PLAN L211 require that a replayed old `get_active_context` thread "renders, continues and is redacted". Neither test proves the "redacted" part.
- **Likely source gap**: only `context` goes through `redactDeep`. `buildChatPayload` (`src/lib/relay/contextBuilder.ts:107-118`) sends `trimHistory(input.messages)` without redacting it, and `route.ts:137` checks `hasUnredactedSecret` only on `context`.
- **Fix**:
  - In both tests, seed a raw secret-shaped value (for example `JWT_SECRET` from `src/lib/relay/redact.corpus`) inside the legacy tool part output, then assert it is absent from the outbound body.
  - If that fails, it is a real source bug. Report it and fix it at the source, for example by redacting tool-part outputs in the outbound messages. Do not weaken the test.

### F4. Quality violations
1. `e2e/fixtures/relayE2eHelpers.ts:67-75`: `attachCurrentTab` was inserted between the JSDoc `/** Asserts the status banner is visible and contains `text`. */` and `expectBanner`. That leaves two stacked docblocks above `attachCurrentTab`, and `expectBanner` loses its doc. **Fix**: move the banner JSDoc back directly above `expectBanner`.
2. `e2e/qa/relay/relay-improvements-context-chip.spec.ts:21-26`: a local `attachCurrentTab` duplicates the shared helper in `relayE2eHelpers.ts` line for line, including the same doc comment. **Fix**: import the shared helper.
3. The attach-through-picker flow (trigger, kind filter, search, row click, picker hidden) is duplicated three times:
   - `e2e/qa/relay/relay-polish-ctx.spec.ts:64` (`attachFromPicker`)
   - `e2e/qa/relay/relay-improvements-context-payload.spec.ts:21` (`attachFromPicker`)
   - inline at `e2e/qa/relay/relay-chat.spec.ts:274-276`

   CLAUDE.md makes extraction mandatory at three copies. **Fix**: add one `attachFromPicker(page, kind, search)` to `relayE2eHelpers.ts` and use it in all three places.
4. `src/components/relay/ContextChips.tsx:54`: `(chip) => chip.kind === "tab" || store.exists(chip.kind, chip.id)` repeats `isStillAttached` from `src/lib/relay/tools/workspaceRead.ts:336`. The dock filter and the payload filter must agree (AC-14), so they should share one predicate. **Fix**: import and call `isStillAttached(store, chip)`.
5. `src/lib/relay/suggestions.ts:8`: `export type StarterKey` is not used anywhere in `src` or `e2e`. **Fix**: delete it, or type the `EmptyState` key with it.

## Passing checks
- **P5.1**:
  - The payload is built only from attachedItems, and `redactDeep` is still the last step (contextBuilder.ts:98).
  - With nothing attached there is no activeTab, collection or environment key (unit tests plus e2e CTX-01/05/06).
  - Secret env values become `[redacted]` and `shareValues` still gates values (e2e CTX-10).
  - The removed symbols are gone.
- **P5.2**: the store symbols are removed; `newThread` sets `attachedItems: []`; `runTool` reads `attached: useRelayStore.getState().attachedItems` at call time (useRelayChat.ts:229-230).
- **P5.3**: ContextChips renders only attached items, with a tab kind and PanelTop icon, and returns null when empty. RelayComposer.tsx needed no change: HEAD had no "Using:" text and no callers of the removed actions; the label lived in AutoChipLabel. Browser proof: CTX-01 and CTX-02 pass x3.
- **P5.4**:
  - `get_active_context` returns `{attached: [], note: NOTHING_ATTACHED_NOTE}` for zero items, or the descriptions of the attached items (covered in unit tests).
  - `describeTab` reads `describeActiveContext` only to fill in details when the attached tab is the active one. This is the documented builder decision, since StoreAccess has only `activeTab()`. A tab attached earlier and then left keeps only its identity. That is acceptable for the interim but worth knowing.
- **P5.5**: the `ATTACHED_CONTEXT_RULES` prompt rule is present; both tool descriptions now say "attached"; brandGuard passes; schemas.ts has no store import. The audit sits only in the builder report and in events, not in a Log line (see F1).
- **P5.6**: en, fr and ja have the same key sets (parity passes). `autoChip` and the old `suggestions.*` keys are removed. `seeWhat` is kept for P10, as P5.6 allows.
- **P5.7**: STARTER_KEYS is a constant and EmptyState has no tab input. Browser proof: CTX-07 passes x3. followUps.ts changed only in a comment and reads no tab state.
- **P5.8**: the pinned Current tab Button is disabled with "No tab open". Browser proof: CTX-03 and CTX-04 pass x3.
- **P5.9 and P5.10 coverage**: the lowest figure is useRelayChat.ts branches at 94.69%. That is in the 80-94 band, and the uncovered lines 268 and 283 are listed and justified. Both are a defensive throw and catch-logging that already existed in HEAD (old line 276). This passes, apart from the vacuous replay case in F3.
- **P5.11**: 8/8 x3. ICTX-01/02/06/07/08 now attach through the Current tab row, the ids are unchanged, and no scenario asserts an implicit chip or payload key.
- **P5.12, deletion judged ALLOWED.** The Scenarios line reads "if the whole suggestions spec is obsolete both files are deleted and check-ids.sh stays green". All three deleted scenarios (REL-ICTX-03/09/10) tested tab-derived suggestions, and P10 (TASKS.md:1985) expects the files to be gone already. Pills runs 5/5 x3, and the pills files contain no `relay-see-what` or tab-derived suggestion references. Only the Log is missing (F1).
- **P5.13**: 27/27 x3. The picker test asserts the Current tab row sits above the results. relay-chat CTX-01/02/04 and privacy PRIV-03 now attach first.
- **P5.14**:
  - 10/10 x3; each test has one id, `@qa` plus a priority tag and `seededPage`; there is no `waitForTimeout`.
  - **CTX-08, scripted reply judged ACCEPTABLE.** The scenario text, the task Do and the SPEC AC all say "scripted stream". The prompt rule itself is proven in systemPrompt.spec.
  - CTX-09 fails, see F3.
- **P5.15**: every checkpoint command exits 0 (see the table above). The Checkpoint 5 behaviour holds: nothing reaches the model unless attached, and the empty state does not depend on the open tab. The gate cannot pass while F1-F4 remain open.

## Out-of-Files edits (judged)
- These were needed to fix stale consumers of removed symbols, which typecheck, the specs and the gate greps would otherwise flag: OpenInRelayButton.tsx (a comment that named computeContextChips and would fail the gate grep), OpenInRelayButton.spec, openInRelay.spec, RelayDock.spec, RelayConversation.spec, and RelayPickerRow.tsx (needed by `satisfies Record<ContextChipKind>`). Accepted.
- `registry.ts` is listed in P5.4 Files; the builder report wrongly called it out-of-Files.
- `relay-chat.feature.md` was edited to keep the REL-CTX-04 title in parity with the spec. Accepted.
- `relayE2eHelpers.ts` (new helper) is accepted, apart from the misplaced docblock in F4.1.
