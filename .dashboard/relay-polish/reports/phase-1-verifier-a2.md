# Phase 1 verifier report (attempt 2): Rendering bug fixes and feedback removal

VERDICT: FAIL. The app code is correct. The remaining blockers are in the tests:
- P1.8: MSG-08 never asserts the error bubble. MSG-09's spec and Gherkin disagree. One a1 quality nit is still unfixed.
- P1.7: one required case is missing, plus dead or vacuous test code.
- P1.4: the design Log claims a change that never happened.
- P1.10: every command is green, but the gate is held. It must be re-run after the P1.7/P1.8 spec fixes.

Environment: the dev server was already listening on :3000 (pid 20168); I did not start or stop one. bash is 3.2. `e2e/fixtures/` is unmodified (empty `git status --short e2e/fixtures/`), so the qa.ts console guard is intact.
Scratch files are in /private/tmp/claude-502/-Users-deepakdewani1-Documents-Programs-react-requestly/342ecf66-8a1b-4bb1-a838-53223cbbd226/scratchpad/:
- `pw/proof.spec.ts` and `pw/pw.config.ts`: the order/glue proof and the error-bubble probe.
- `check-ids-old.sh` and `check-ids-new.sh`: the HEAD and current id scripts.

-------------------------------------------------------------------
## Status of the a1 issues
| a1 issue | Status | Evidence |
|---|---|---|
| MSG-01/03 order checks vacuous | FIXED | `expectBefore` uses getByText(exact) handles and FOLLOWING without CONTAINS or CONTAINED_BY. The scratch proof runs the same predicate on the live app DOM. Real order gives [true,true]. Every reversed arrangement fails at least one pair: tool,t2,t1 gives [false,true]; tool,t1,t2 gives [false,true]; t2,tool,t1 gives [false,false]. |
| MSG-01 glue check could never fail | FIXED | The texts are "I'm looking at." and "Here's the result.". `getByText("at.Here's")` counts 0 on the real DOM and 1 after I injected the glued `<p>` (the old-code form). |
| MSG-02 had no ask_user part | FIXED | The spec streams `tool-input-available` for ask_user with question and options, then asserts `relay-ask-card` contains "Do you approve?". Proof: the order predicate gives real true; after moving the text below the tool group it gives false. |
| MSG-04 never exercised joinTextParts | FIXED | The spec streams text, tool, text and asserts the exact clipboard string "First paragraph.\n\nSecond paragraph." with expect.poll. No test.fail. The finish-step/start-step boundary (NEXT_STEP_CHUNKS) matches what a real server emits. |
| MSG-06 was not a persistence test | FIXED | It seeds a thread with step-start, text, tool-web_search (output-available), step-start, text into IDB `relay_threads`, reloads, selects the thread from the list and asserts order with expectBefore. The texts can only come from the seed. |
| Error and empty cases missing | PARTIAL | MSG-08 and MSG-09 were added, but see the P1.8 failures. |
| P1.7 step-start, stable-keys and compareDocumentPosition cases | FIXED | MessageParts.spec.tsx has: "stream order with compareDocumentPosition" (3 tests), "step-start parts" (2 tests), and "stable keys across streaming updates", which rerenders the same message id with an appended part and checks the earlier nodes are `toBe` the same nodes. |
| P1.7 MessageParts branch gaps | FIXED | MessageParts.tsx is now at 100/100/100/100. |
| P1.3/P1.4 per-skill Log lines | P1.3 FIXED, P1.4 INACCURATE | Both lines exist (TASKS.md L86, L103). The P1.4 line claims a change that never happened (see P1.4). |
| MessageParts callIdOf DRY | FIXED | MessageParts.tsx:29 `callIdOf` is used at :123 and :199. |
| Spec quality: unused `original`, magic 4/2, `as any`, `text=` locators | FIXED | None remain in relay-polish-msg.spec.ts. |
| Spec quality: magic `timeout: 5000` | NOT FIXED | It is still at relay-polish-msg.spec.ts:343. |

-------------------------------------------------------------------
## P1.1 check-ids accepts REL-POL-<AREA>-nn: PASS
- The diff changes only the `id_re` line.
- Verify 1, run literally, prints 0 under bash 3.2: it cannot `source <(...)`, and no bash 5 is installed. The eval form prints REL-POL-MSG-01, REL-SHELL-02 and REL-IA11Y-05 (3 matches).
- Verify 2: the hash is now e0a1591c..., because relay-polish-msg has 9 ids.
  - I ran the HEAD and current scripts against the same tree. The only diff is `relay-polish-msg: feature ids: 1 test ids: 0` (old) vs `9 / 9` (new).
  - With polish lines excluded, both hash to fc13ee53e7bf3a6ae1d86c9434048f9f3f4d7466. Existing counts are unchanged.
- Verify 3: `bash e2e/scenarios/relay/check-ids.sh` exits 0 with "OK: scenario IDs consistent".

## P1.2 Message text join helper: PASS
- biome on the 4 files: exit 0.
- `bunx vitest run RelayConversation.spec.tsx RelayDock.spec.tsx`: 2 files, 62 passed.
- The `join("")` grep exits 0.
- messageText.ts: `TEXT_PART_SEPARATOR="\n\n"`.
- RelayDock.lastUserMessageText and RelayConversation MessageItem (Copy markdown and edit text) use `messageText`.

## P1.3 Render message parts in stream order: PASS
- biome: exit 0.
- vitest RelayConversation plus RelayMarkdown: 2 files, 75 passed.
- The p1-msg-parts-*.png screenshots exist (4).
- RelayConversation.spec "stream order" covers text->tool->text, text->ask_user and step-start->tool->text with DOCUMENT_POSITION_FOLLOWING.
- Browser proof: MSG-01/02/03 are now real (proof above). The Log line names each skill.
- Keys are part indexes: `t{i}` and `g{i}`. RelayMarkdown is memoized. MSG-07 (isConnected on the retained handle) passes.

## P1.4 Remove thumbs from message actions and telemetry: FAIL (Log accuracy)
- biome: exit 0.
- vitest MessageActions plus telemetry: 17 passed.
- The `relay_feedback|RelayFeedbackRating|relay-thumbs|handleRate` grep over src exits 0.
- p1-actions-*.png: 4 files present. I viewed 320-light: only the Copy and Regenerate icons are shown.
- FAIL: the TASKS.md L103 Log says "impeccable removed the leftover gap/divider that separated the thumbs group".
  - `git show HEAD:src/components/relay/MessageActions.tsx | grep -iE "separator|divider|gap|border|className"` returns nothing, so no such divider or gap ever existed.
  - The diff only removes the buttons, the state and the imports. The Log claims a change that did not happen.
  - FIX: rewrite the impeccable clause to say what actually happened, e.g. "impeccable: no further change needed; the row keeps the existing MessageActions spacing".

## P1.5 Remove thumbs i18n keys: PASS
- biome on 3 json files: exit 0.
- Parity specs: 2 files, 872 passed.
- The `thumbsUp|thumbsDown` grep over src and messages exits 0.

## P1.6 Annotate relay-improvements docs as superseded: PASS
- `grep -c "Superseded by relay-polish RP-226"`: SPEC 3, PLAN 4, TASKS 14.
- No thumb or relay_feedback line lacks the note.
- TASKS.md word-diff shows only 14 copies of `+(Superseded by relay-polish RP-226 (removed))`.
- SPEC and PLAN are untracked, so "no other text changed" cannot be diffed (accepted in a1).

## P1.7 Unit: message text and parts: FAIL
Command (the task Verify, verbatim): exit 0, 5 files, 99 tests passed. I re-ran it with json-summary for per-file figures (the text reporter hides 100% rows):

| File | Lines | Branch | Funcs | Stmts |
|---|---|---|---|---|
| messageText.ts | 100 | 100 | 100 | 100 |
| MessageParts.tsx | 100 | 100 | 100 | 100 |
| MessageActions.tsx | 100 | 100 | 100 | 100 |
| telemetry.ts | 100 | 100 | 100 | 100 |
| RelayMarkdown.tsx | 97.14 | 80 | 100 | 97.43 |

- Lowest figure: RelayMarkdown at 80% branches, line 25 (`isValidElement` false branch in pre-existing `nodeText`). Justified; accepted in a1.
- The skip/only/fixme/fails/todo grep over the 5 unit specs and the 3 e2e specs: no hits.
- The happy-dom header is present on the component specs.

Failures:
1. A required case is missing: "telemetry event map has no feedback event".
   - telemetry.spec.ts has no feedback assertion (`grep -i feedback` returns nothing). P1.7-unit-a3.md nevertheless ticks it, which is a false claim.
   - FIX: add a type-level case, e.g. `// @ts-expect-error relay_feedback was removed (RP-226)` above `trackRelayEvent("relay_feedback", { rating: "up" })`, or an `expectTypeOf<RelayEventName>()` check that excludes "relay_feedback".
2. MessageParts.spec.tsx:362 "returns null for ask_user with invalid input schema" is mis-shaped.
   - It uses `type: "tool-call"`, so `promptCard` derives name "call" and the ask_user branch never runs. It passes via the awaitsUser=false fallthrough.
   - It duplicates the correct test at :1347, which uses `type: "tool-ask_user"`.
   - FIX: delete :362, or change its type to `tool-ask_user` and merge it with :1347.
3. Dead code in MessageParts.spec.tsx:
   - Lines 8-11 (`const awaitsUserMock/isCloseTabsToolMock/previewConfirmationMock/readChangeOutputMock = vi.fn()`) are never referenced; only the `mocks.*` hoisted copies are used. FIX: delete them.
   - Lines 1138 and 1166 destructure `const { container } = render(...)` and never use `container`. FIX: drop the destructure.
4. Vacuous tests in RelayMarkdown.spec.tsx (added in this phase):
   - "renders RelayMarkdown as memoized component and handles prop changes" never checks memoization; it only rerenders with new text.
   - "handles text containing only whitespace" asserts `expect(container).toBeTruthy()`, which cannot fail.
   - "handles very long text without performance issues" is only not.toThrow.
   - The describe title has the typo "contenthandling".
   - FIX: either assert memo, e.g. a render-count spy on a ReactMarkdown mock that stays unchanged when rerendered with the same `text`, or delete these cases. Replace `toBeTruthy()` with a real assertion (e.g. no `<p>` rendered).

## P1.8 E2E: message order, Copy and actions: FAIL
Commands:
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts --repeat-each=3 --reporter=line`: 27 passed (20.3s), exit 0.
- `bash e2e/scenarios/relay/check-ids.sh`: exit 0, `relay-polish-msg: feature ids: 9 test ids: 9`.
- No test.fail, skip, only or fixme.
- MSG-01 through MSG-07 are now real; see the a1 status table and the scratch proof.

Failures:
1. MSG-08 never asserts the error bubble (spec lines 491-534).
   - Its title and Gherkin say "shows error bubble" / "an error bubble appears below the text". The test asserts only that the text and `relay-message-assistant` are visible.
   - My scratch probe on the same stream shows the app is correct: `relay-banner` is visible (count 1, "Relay is unavailable right now. Try again.") and comes after the text (predicate true). So the test can pass while the bubble is missing.
   - FIX: add `const banner = page.getByTestId("relay-banner"); await expect(banner).toBeVisible(); await expectBefore(page, textPart, banner);`.
   - Also correct the comment at lines 516-517 ("stream errors are handled as finish-step failures"): it is an `error` chunk.
2. MSG-09's spec and Gherkin disagree, and its second half is weak.
   - Gherkin: "Given a stored Relay thread containing only a user message ... Then no action buttons ... And the user message is displayed". The spec instead opens a fresh empty dock with no thread.
   - FIX: seed a user-only thread with the existing `putStoredThread`, reload, select it, then assert `relay-answer-actions` has count 0 and the user message is visible. Or rewrite the Gherkin to match a fresh empty conversation.
   - Lines 565-567: `expect(await count()).toBeGreaterThanOrEqual(1)`, with the comment "may render differently", is a non-retrying check. It can race the settle (actions appear only once the turn is settled), and the comment is wrong because `relay-answer-actions` is one group.
   - FIX: `await expect(page.getByTestId("relay-answer-actions")).toHaveCount(1)`, then `toHaveCount(2)` on its buttons, or drop this half.
3. MSG-06's Gherkin wording does not match.
   - It says "navigates to the thread via deep-link". No thread deep-link exists: grep of src/components/relay and useRelayStore for searchParams or thread routes finds none. The spec selects the thread from the thread list after reload, which is correct.
   - FIX: change the Gherkin to "selects the thread from the thread list".
4. Quality in e2e/qa/relay/relay-polish-msg.spec.ts:
   - Line 343: magic `{ timeout: 5000 }` (an a1 nit, still unfixed). Use a named constant or the default timeout.
   - Line 79: the comment "Named constants for timeouts and expected counts" names timeout constants that do not exist. Fix the comment.
   - The project convention requires web-first assertions. Lines 149, 172, 183, 273, 379, 383, 527 and 555 use `expect(await locator.count()).toBe(n)` (non-retrying). FIX: `await expect(locator).toHaveCount(n)`.
5. False claims in engineer reports (not code blockers):
   - P1.8-e2e-a2.md still says MSG-04 is `test.fail()`, MSG-06 is a close/reopen, and `WAIT_FOR_CLIPBOARD_MS` exists. None of these is true in the current spec.
   - phase-1-builder-gate-a2.md shows the gate builder (an implementer) edited the e2e spec. The convention says test authors are never the feature authors. The orchestrator should route the fixes above to the e2e engineer.

## P1.9 E2E: migrate thumbs scenarios: PASS
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-actions.spec.ts e2e/qa/relay/relay-chat.spec.ts --repeat-each=3 --reporter=line`: 57 passed (51.9s), exit 0.
- The `relay-thumbs|thumbsUp|thumbsDown|relay_feedback` grep over e2e exits 0.
- check-ids.sh exits 0.
- Diff: REL-QOL-05 and its telemetry and storage helpers are removed, and the feature header is updated.
- qol-rewrite.feature.md and relay-chat.spec have no stale references.

## P1.10 Checkpoint 1: HELD (all commands green, re-run required)
Results:

| Command | Result |
|---|---|
| `bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n` | 110 files, 2953 passed, exit 0 |
| polish-msg `--repeat-each=2` | 18 passed, exit 0 |
| qol-actions plus relay-chat | 19 passed, exit 0 |
| check-ids.sh | OK, exit 0 |
| `bun run lint:check` | 723 files clean, exit 0 |
| `bun run typecheck` | tsc --noEmit, exit 0 |
| brandGuard | 12 passed |
| feedback grep over src, e2e and messages | exit 0 |

- AC1 (no A7/A8 glue, cards in stream order, old thread renders in order) is now backed by the real MSG-01/02/03/05/06.
- The gate cannot be marked verified while P1.4, P1.7 and P1.8 above are open. Re-run it after their spec and Log fixes.

-------------------------------------------------------------------
## Code quality (source files changed this phase)
- messageText.ts, MessageParts.tsx (callIdOf, toBlocks, stable `t{i}`/`g{i}` keys, memo), RelayConversation.tsx, RelayDock.tsx, RelayMarkdown.tsx (memo), MessageActions.tsx, telemetry.ts and the locale json: no concrete violations.
- `promptCard`'s length is pre-existing, moved verbatim (accepted in a1).
- The test-file violations are listed under P1.7 and P1.8.
