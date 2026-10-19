# Phase 1 verifier report (attempt 1): Rendering bug fixes and feedback removal

VERDICT: FAIL. The blocking issues are in P1.8 (vacuous or missing e2e assertions), P1.7 (required unit cases missing, branch gaps not justified), and the P1.3/P1.4 design Log. P1.10 fails because it depends on P1.8.

Environment: dev server already listening on :3000 (pid 20168); I did not start or stop one. bash is 3.2.57.

---------------------------------------------------------------------
## P1.1 check-ids accepts REL-POL-<AREA>-nn: PASS (with notes)
- `git diff e2e/scenarios/relay/check-ids.sh`: only the `id_re` line changed, to `REL-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[0-9]+[a-z]?`.
- Verify 1, run literally (`source <(grep ...)`): prints 0. bash 3.2 cannot `source` a process substitution; `bash -c 'source <(echo x=1); echo $x'` prints an empty value. The `eval` form prints all 3 ids: REL-POL-MSG-01, REL-SHELL-02, REL-IA11Y-05. So the AC holds and the Verify command is an environment artifact.
- Verify 2: the current hash is 39d80df9..., not the logged c6100bb9 (events.jsonl). The only difference is the new relay-polish-msg feature added by P1.8.
  - I ran the HEAD (old-regex) script and the new script against the same tree.
  - The only diff is `relay-polish-msg: feature ids: 1` (old) vs `7` (new).
  - With polish-msg excluded, both hash to fc13ee53e7bf3a6ae1d86c9434048f9f3f4d7466. Existing per-feature counts are unchanged.
- Verify 3: `bash e2e/scenarios/relay/check-ids.sh` exits 0 with "OK: scenario IDs consistent".

## P1.2 Message text join helper: PASS
- biome check on the 4 files: exit 0.
- `bunx vitest run RelayConversation.spec.tsx RelayDock.spec.tsx` (run together with the RelayMarkdown, MessageActions and telemetry specs): 5 files, 101 tests passed.
- The `join("")` grep over RelayConversation.tsx and RelayDock.tsx exits 0.
- `messageText.ts`: `TEXT_PART_SEPARATOR = "\n\n"`; `joinTextParts` uses flatMap over text parts and skips empty ones. `RelayDock.lastUserMessageText` and `RelayConversation.MessageItem` (Copy markdown, edit text) use `messageText`.

## P1.3 Render message parts in stream order: FAIL (design Log; browser proof depends on P1.8)
- biome check: exit 0.
- vitest RelayConversation.spec plus RelayMarkdown.spec: pass.
- 8 screenshots exist in agent_docs/qa/relay-polish/p1-msg-parts-*.png and p1-actions-*.png. I viewed p1-msg-parts-320-dark.png: the intro text, the "Read request" row, then the result text, in order.
- The new `describe("stream order")` in RelayConversation.spec.tsx uses `getByText` and `Node.DOCUMENT_POSITION_FOLLOWING` correctly. It covers text->tool->text, text->ask_user and step-start->tool->text. This satisfies the unit part of AC2.
- AC1/AC2 browser proof is cited to REL-POL-MSG-01/02/03. Those tests are vacuous; see P1.8. Not proven in the browser.
- Design Log: the Conventions require one line in the task Log naming what each skill changed, and say the verifier rejects a UI task without it.
  - The P1.3 `task_built` events in events.jsonl carry no design note.
  - The only note is in phase-1-builder-a1.md: "ui-ux-pro-max/impeccable/layout: kept existing gap-2 rhythm; ...". It lumps all three skills together and does not say what each one changed.
  - FIX: record a per-skill one-line design note in the P1.3 task Log.

## P1.4 Remove thumbs from message actions and telemetry: FAIL (design Log only)
- biome check: exit 0.
- vitest MessageActions.spec plus telemetry.spec: pass.
- The `relay_feedback|RelayFeedbackRating|relay-thumbs|handleRate` grep over src exits 0.
- p1-actions-*.png: 4 files present.
- The diff removes ThumbsUp/Down, `rating`, `handleRate`, `relay_feedback` and `RelayFeedbackRating`. Copy and Regenerate keep their order.
- Design Log: same issue as P1.3. FIX: add a per-skill design note to the P1.4 task Log.

## P1.5 Remove thumbs i18n keys: PASS
- The diff removes `actions.thumbsUp` and `actions.thumbsDown` from en, fr and ja, at the same position.
- `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`: 2 files, 872 passed.
- The `thumbsUp|thumbsDown` grep over src and messages exits 0.
- Note: biome ignores json under its config, and its "Checked 10 files" count excludes json and spec files.

## P1.6 Annotate relay-improvements docs as superseded: PASS (one sub-check unverifiable)
- grep -c "Superseded by relay-polish RP-226": SPEC 3, PLAN 4, TASKS 14.
- No thumb, relay_feedback or RelayFeedback mention lacks the note in any of the three files.
- TASKS.md word diff shows only `+(Superseded by relay-polish RP-226 (removed))` additions, 14 times.
- SPEC.md and PLAN.md are untracked in git, so "no other text changed" cannot be verified for them.
- Non-blocking: the TASKS.md traceability row `| FR-192 | ... | REL-QOL-05 |` (line ~2165) points at a removed scenario and carries no note. It does not literally mention thumbs.

## P1.7 Unit: message text and parts: FAIL
Command (the task's own Verify): `bunx vitest run <5 specs> --coverage --coverage.include=<5 files> --coverage.reporter=text`. Exit 0, 5 files, 84 tests passed.

| File | Lines | Branch | Funcs | Stmts |
|---|---|---|---|---|
| MessageParts.tsx | 100 | 92 | 100 | 96.77 |
| RelayMarkdown.tsx | 97.14 | 80 | 100 | 97.43 |
| messageText.ts | 100 | 100 | 100 | 100 |
| MessageActions.tsx | 100 | 100 | 100 | 100 |
| telemetry.ts | 100 | 100 | 100 | 100 |

- Uncovered lines: MessageParts 55, 118, 143, 194; RelayMarkdown 25.
- The three 100% files are confirmed by a separate json-summary run.
- Lowest figure: RelayMarkdown at 80% branches. It is justified (line 25, `isValidElement` false branch, pre-existing code).
- The skip/only/fixme/fails/todo grep over the 5 specs and the 3 e2e specs finds nothing.

Failures:
1. MessageParts.tsx is at 92% branches (the 80-94 band) and the uncovered lines are not justified. The P1.7-unit-a2.md report says "Uncovered: none".
   - FIX: cover these branches or justify each one:
     - 55: ask_user safeParse failure
     - 118: tool part without a toolCallId
     - 143: non-text, non-tool part (step-start, reasoning)
     - 194: key fallback to index
2. Required cases from the Do have no real assertion:
   - "step-start renders nothing": MessageParts.spec.tsx has no step-start case at all (`grep step-start` returns nothing).
   - "stable keys across a streaming update": none.
     - The "uses toolCallId as key" test (line 539) only asserts that a tool-row exists.
     - The "renders component as memo" test (line 595) swaps to a different message id and asserts the new text. Neither checks node identity across a rerender with appended parts.
   - "renders text and tool parts in stream order" (line 239) asserts only counts (2 markdown, 1 group), not order.
   - FIX: add a step-start-only and a step-start-between-tools case. Add a rerender case with the same message id and appended parts that asserts the earlier markdown/tool node is the same element (or that the RelayMarkdown mock mount count is unchanged). Add `compareDocumentPosition` order assertions for text->ask_user, tool->text and text->tool->text in MessageParts.spec.
3. Not blocking: RelayMarkdown.spec.tsx was not extended (Do says "extends"), and its coverage passes. MessageParts.spec uses unrealistic `type: "tool-call"` plus `toolName` shapes, and `isToolPart` is mocked.

## P1.8 E2E: message order, Copy and actions: FAIL
Commands:
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts --repeat-each=3 --reporter=line`: 21 passed (16.6s), exit 0.
- `bash e2e/scenarios/relay/check-ids.sh`: OK, 7 feature ids and 7 test ids.

The run is green, but most assertions cannot fail.

1. REL-POL-MSG-01 order check is vacuous (lines 65-86).
   - `Array.from(document.querySelectorAll("p, div")).find(el => el.textContent.includes(...))` returns the OUTERMOST div that contains the text, an ancestor of the tool group.
   - `first.compareDocumentPosition(tool) & 4` is then true via CONTAINED_BY/FOLLOWING, and `tool.compareDocumentPosition(second) & 2` is true via CONTAINS/PRECEDING. The comments mislabel 4 and 2: 4 is FOLLOWING and 2 is PRECEDING.
   - Proof: scratch script /private/tmp/claude-502/.../scratchpad/vacuity.cjs runs the exact evaluate bodies on a deliberately REVERSED DOM (second text, tool, first text) and prints `MSG-01 order check on reversed DOM: true | MSG-03 order check on reversed DOM: true`.
2. The REL-POL-MSG-01 glue check `not.toContain("at.Here's")` can never fail.
   - The texts are "Here's the first part." and "Here's the second part.", so the glued form would be "part.Here's".
   - The scenario's "at.Here's" requires a first text ending in "...at." (e.g. "I'm looking at.").
3. REL-POL-MSG-02 has no ask_user part. It uses a plain `kind: "text"` script and asserts only that the text is visible: no AskUser card and no order.
4. REL-POL-MSG-03: same vacuous order check as item 1 (line 152-163).
5. REL-POL-MSG-04 never exercises `joinTextParts`.
   - It uses a single text part that already contains "\n\n".
   - It asserts only `toContain("First paragraph")` and `toContain("Second paragraph")`, not the blank-line separator.
6. REL-POL-MSG-06 is not a persistence or deep-link test.
   - It streams a live reply. There is no seeded stored thread, no step-start parts, and no reload or deep-link.
   - The "order" evaluate checks presence only (hasFirst && hasTool && hasSecond).
7. The Do requires an error case (a stream errors after the first text: the earlier text is kept and the error bubble shows below) and an empty case (a thread with no messages shows no actions). Neither exists.
8. The engineer report P1.8-e2e-a1.md claims "Tests 01-03, 06 ... verify order via compareDocumentPosition". That is false for 02 and 06, and ineffective for 01 and 03.
9. MSG-05 and MSG-07 are real.
   - MSG-05: Copy and Regenerate are visible, and no data-testid contains "thumb". It does not assert that only two actions exist; consider counting buttons in `relay-answer-actions`.
   - MSG-07: tags the node and re-finds it.

FIX:
- Use `page.getByText(<exact>, { exact: true })` and `page.getByTestId(...)` element handles, and assert `a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING`.
- Make text 1 end in "at." and text 2 start with "Here's", and assert that `"at.Here's"` is absent.
- MSG-02: script text then a `tool-input-available` for `ask_user` with question/options, and assert the text precedes `relay-ask-card`.
- MSG-04: stream text, tool, text and assert `toBe("<t1>\n\n<t2>")`.
- MSG-06: seed a stored thread with step-start, text, tool, text parts via the existing thread-seeding helper, reload or deep-link to it, and assert order.
- Add the error and empty cases.

Quality violations (e2e/qa/relay/relay-polish-msg.spec.ts):
- line 201: `const original = ...` is unused (dead code).
- lines 83 and 160: magic `4` and `2` with wrong comments. Use `Node.DOCUMENT_POSITION_FOLLOWING`.
- line 212: magic `timeout: 5000`.
- `as any` is repeated at lines 78, 79, 159, 200, 203, 215, 357, 373, 397. Type a `window` augmentation once instead.
- Uses `page.locator("text=...")` throughout instead of `getByText`/`getByTestId` first, contrary to the project convention.
- Note: biome excludes `**/*.spec.*`, so a green `lint:check` says nothing about spec files.

## P1.9 E2E: migrate thumbs scenarios: PASS
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-actions.spec.ts e2e/qa/relay/relay-chat.spec.ts --repeat-each=3 --reporter=line`: 57 passed (50.8s), exit 0, 0 failed or flaky lines.
- The `relay-thumbs|thumbsUp|thumbsDown|relay_feedback` grep over e2e exits 0.
- check-ids.sh exits 0.
- The diff removes REL-QOL-05 and its telemetry and storage helpers. The remaining imports (Page, openRelay, sendMessage, installRelayRoutes, startRelayGate, RelayScript) are still used. The feature header was updated.
- `qol-rewrite.feature.md` has no thumb, feedback or QOL-05 reference (nothing stale to remove). relay-chat.spec has none either.

## P1.10 Checkpoint 1: FAIL (AC unproven, depends on P1.8)
Every Verify command exits 0:
- `bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n`: 110 files, 2938 tests passed.
- polish-msg `--repeat-each=2`: 14 passed.
- qol-actions plus relay-chat: 19 passed.
- check-ids.sh: OK.
- `bun run lint:check`: 723 files clean.
- `bun run typecheck` (tsc --noEmit): exit 0.
- brandGuard: 12 passed.
- The feedback grep over src, e2e and messages exits 0.

AC1 ("A7/A8 repros no longer reproduce; ... an old persisted thread renders in order with no migration") is not proven in the browser. The browser evidence comes from MSG-01/02/03/06, which are vacuous or missing (see P1.8). Unit-level ordering is proven by RelayConversation.spec. FIX: re-run the gate after P1.8 is fixed.

---------------------------------------------------------------------
## Code quality (files changed this phase)
- src/components/relay/MessageParts.tsx:118 and :194: `"toolCallId" in part ? String(part.toolCallId) : ...` is repeated. Extract a `callIdOf(part)` helper (DRY).
- `MessageParts.tsx promptCard` (~60 lines) was moved verbatim from RelayConversation.tsx and is pre-existing. Noted, not counted as a violation.
- Everything else reviewed (messageText.ts, RelayConversation.tsx, RelayDock.tsx, RelayMarkdown.tsx, MessageActions.tsx, telemetry.ts, locale json, qol-actions spec): no concrete violations found.
