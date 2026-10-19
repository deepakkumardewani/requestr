# Phase 1 verifier report (attempt 3): Rendering bug fixes and feedback removal

VERDICT: FAIL. The app code is correct, and every gate command is green. P1.7 is still blocked.
- Its required case "telemetry event map has no feedback event" is now vacuous; it can never fail.
- Two RelayMarkdown cases test a different input from the one their titles describe.
- P1.10 is HELD and must be re-run after the P1.7 fix.
- All a2 issues for P1.4 and P1.8 are fixed.

Environment:
- The dev server was already listening on :3000 (pid 20168). I did not start or stop one.
- bash is 3.2.57.
- `git status --short e2e/fixtures` is empty, so the qa.ts console guard is untouched.
- Scratch proofs are in /private/tmp/claude-502/-Users-deepakdewani1-Documents-Programs-react-requestly/342ecf66-8a1b-4bb1-a838-53223cbbd226/scratchpad/a3/:
  - vacuous.ts: the telemetry pattern proof.
  - jsx.tsx: the JSX escape proof.
  - old-ids-rooted.sh: the HEAD check-ids script, run against the current tree.

-------------------------------------------------------------------
## Status of the a2 issues
| a2 issue | Status | Evidence |
|---|---|---|
| P1.4 Log claims a gap/divider removal that never happened | FIXED | TASKS.md L103 now says impeccable "found no leftover gap, divider or className ... so no further change was needed". This matches `git diff src/components/relay/MessageActions.tsx`, which only removes the thumbs imports, rating state, handleRate and the two buttons. |
| P1.7 telemetry "no feedback event" case missing | NOT FIXED (vacuous) | See P1.7 failure 1. The case exists but cannot fail. |
| P1.7 mis-shaped ask_user test at :362 | FIXED | The "invalid input schema" tool-call test is gone. The ask_user safeParse case at :1314 uses `type: "tool-ask_user"` and asserts tool-row present and ask-user-card absent. |
| P1.7 dead vi.fn() consts at lines 8-11 | FIXED | They now exist only inside `vi.hoisted` and are used (mocks at :37/:98/:102/:126, resets at :136-139). The askUserCardProps/confirmCardProps/closeTabsCardProps fields are read in assertions (:709, :811, :949 and more). |
| P1.7 unused `{ container }` destructures | FIXED | grep `const { container }` in MessageParts.spec.tsx: no hits. |
| P1.7 vacuous RelayMarkdown cases and typo | PARTIAL | Memo is now asserted (`$$typeof === Symbol.for("react.memo")`), the typo is fixed, and the long-text case asserts content. The whitespace and nested-list cases are mis-shaped; see P1.7 failure 2. |
| P1.8 MSG-08 never asserts the error bubble | FIXED | spec:566-568 has `relay-banner` toBeVisible and `expectBefore(textPart, banner)`. The comment at :553 now says "error chunk". |
| P1.8 MSG-09 spec vs Gherkin mismatch, non-retrying count | FIXED | The spec seeds USER_ONLY_THREAD via `seedAndOpenThread` (put to IDB, reload, select from the thread list). It asserts the user message is visible, then `relay-answer-actions` toHaveCount(0) and assistant toHaveCount(0). Positive control: answer-actions toHaveCount(1) and buttons toHaveCount(2). |
| P1.8 MSG-06 "deep-link" Gherkin wording | FIXED | The feature file now says "selects the thread from the thread list". TASKS.md L159 still says "deep-link"; that is orchestrator-owned. |
| P1.8 magic `timeout: 5000`, stale comment at :79 | FIXED | grep `timeout:` in the spec: no hits. The :100 comment reads "Named constants for expected counts". |
| P1.8 non-web-first `expect(await x.count())` | FIXED | grep `expect(await` in the spec: no hits. Every count uses toHaveCount. The remaining `expect(result/isStillConnected).toBe(true)` are evaluated predicates on handles, not locator counts. |

-------------------------------------------------------------------
## P1.1 check-ids accepts REL-POL-<AREA>-nn: PASS
- The diff changes only `id_re`, to `'REL-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[0-9]+[a-z]?'`.
- Verify 1, run literally, prints 0, because bash 3.2 cannot `source <(...)` (an environment issue).
  - The eval equivalent `eval "$(grep '^id_re=' ...)"; printf ... | grep -oE "$id_re" | wc -l` prints 3.
- Verify 2: the current hash is e0a1591c775b948071ca11172f6eba2358b713a4, which includes the new relay-polish-msg 9/9 line.
  - I ran the HEAD script against the same tree. The only diff line is `relay-polish-msg: feature ids: 1 test ids: 0` (old) vs `9 / 9` (new).
  - With the polish line excluded, both hash to fc13ee53e7bf3a6ae1d86c9434048f9f3f4d7466. Existing counts are unchanged.
- Verify 3: `bash e2e/scenarios/relay/check-ids.sh` exits 0 with "OK: scenario IDs consistent".
- Non-blocking: P1.1 has no Log line with the hash, which its AC references. Suggested Log entry: "pre-edit hash fc13ee53e7bf3a6ae1d86c9434048f9f3f4d7466 (excluding relay-polish lines)".

## P1.2 Message text join helper: PASS
- biome on the 4 files: exit 0.
- `bunx vitest run RelayConversation.spec.tsx RelayDock.spec.tsx`: 2 files, 62 passed.
- The `join("")` grep: exit 0.
- messageText.ts: `TEXT_PART_SEPARATOR = "\n\n"`, and joinTextParts skips empty and non-text parts.
- RelayDock.lastUserMessageText calls `messageText(last)`.

## P1.3 Render message parts in stream order: PASS
- biome: exit 0.
- vitest RelayConversation plus RelayMarkdown: 2 files, 75 passed.
- 4 p1-msg-parts-*.png present (320/1440 x light/dark).
- The Log line at L86 names all three skills.
- MessageParts.tsx was re-read, and its mtime (21:02) predates the a2 review:
  - Keys are `t{i}` and `g{i}`, and the tool key is `callIdOf(part) ?? index`.
  - Both MessageParts and RelayMarkdown are memoized.
  - step-start renders nothing.
  - TurnChangeBar renders once.
- Browser proof: MSG-01/02/03/06/07 pass (see P1.8).

## P1.4 Remove thumbs from message actions and telemetry: PASS
- biome: exit 0.
- vitest MessageActions plus telemetry: 2 files, 18 passed.
- The `relay_feedback|RelayFeedbackRating|relay-thumbs|handleRate` grep over src: exit 0.
- 4 p1-actions-*.png present.
- The Log line is now accurate (see the table).
- MSG-05 proves Copy and Regenerate only in the browser.

## P1.5 Remove thumbs i18n keys: PASS
- biome on 3 json files: exit 0.
- Parity: 2 files, 872 passed.
- The thumbsUp/thumbsDown grep over src and messages: exit 0.

## P1.6 Annotate relay-improvements docs as superseded: PASS
- grep -c: SPEC 3, PLAN 4, TASKS 14.
- No thumb or relay_feedback line lacks the note.
- The TASKS.md porcelain word-diff shows only 14 copies of `+(Superseded by relay-polish RP-226 (removed))`.
- SPEC.md and PLAN.md are untracked, so no diff is possible (accepted in a1 and a2).

## P1.7 Unit: message text and parts: FAIL
The task Verify command, verbatim plus a json-summary reporter: exit 0, 5 files, 99 passed.

| File | Lines | Branch | Funcs | Stmts |
|---|---|---|---|---|
| messageText.ts | 100 | 100 | 100 | 100 |
| MessageParts.tsx | 100 | 100 | 100 | 100 |
| MessageActions.tsx | 100 | 100 | 100 | 100 |
| telemetry.ts | 100 | 100 | 100 | 100 |
| RelayMarkdown.tsx | 97.14 | 80 | 100 | 97.43 |

- Lowest figure: RelayMarkdown at 80% branches. The gap is the pre-existing `nodeText` isValidElement false branch (L25), which is justified.
- grep `test.fail|it.fails|.skip|.only|.fixme|.todo` over the 5 unit specs and the 3 e2e specs: no hits (exit 1).
- The happy-dom header is present on MessageParts, MessageActions and RelayMarkdown specs.

Failures:

1. src/lib/relay/telemetry.spec.ts:130-136, "telemetry event map has no feedback event", is vacuous.
   - Current code:
     ```
     const removedEventName = ["relay", "feedback"].join("_");
     // @ts-expect-error a removed event name is not assignable to the event map keys
     trackRelayEvent(removedEventName, { rating: "up" });
     ```
   - `.join()` returns plain `string`. Plain `string` is never assignable to `RelayEventName` (a union of literals), so the `@ts-expect-error` is satisfied whatever the map contains. There is also no runtime assertion.
   - Proof: scratchpad/a3/vacuous.ts declares a map that STILL contains `relay_feedback` and repeats this exact pattern. `tsc --noEmit --strict` reports nothing for it, so the directive is "used" and the check passes even though the event exists.
   - The suggested pattern on the same map reports `TS2578: Unused '@ts-expect-error' directive`, so that pattern does detect a re-added event.
   - Spec files are type-checked: `bunx tsc --noEmit --listFilesOnly | grep -c telemetry.spec` gives 1, and `bun run typecheck` covers them.
   - FIX (keeps the P1.10 grep gate clean without weakening it):
     ```
     const removedEventName = `relay_${"feedback"}` as const; // literal type "relay_feedback"
     // @ts-expect-error relay_feedback was removed from the event map (RP-226)
     trackRelayEvent(removedEventName, { rating: "up" });
     ```
     Optionally add a runtime assertion that the sink is never called with it.
   - Provenance: phase-1-builder-gate-a3.md shows the gate builder (an implementer) rewrote this unit spec to dodge the grep, and that edit made it vacuous. P1.7-unit-a4.md's snippet (literal "relay_feedback") is stale. Route this fix to the unit-test engineer, not the gate builder.

2. src/components/relay/RelayMarkdown.spec.tsx (added this phase): two cases do not test what their titles say.
   - The cause: JSX attribute string literals do not process escape sequences, so `text="...\n..."` passes a literal backslash and the letter n.
   - Proof: scratchpad/a3/jsx.tsx under bun. `<P text="   \n\n   " />` gives props.text `"   \\n\\n   "` with trimmed length 4. `<P text="1. first\n   - nested bullet\n2. second" />` gives `"1. first\\n   - nested bullet\\n2. second"`.
   - "renders whitespace-only text and does not throw" renders the visible characters `\n\n`, not whitespace. Its `<p>` assertion only holds because of those characters.
   - "handles nested lists with mixed types" renders a single `<ol>` item with no nesting, and asserts only `lists.length > 0`.
   - FIX: use JS expressions, `text={"   \n\n   "}` and `text={"1. first\n   - nested bullet\n2. second"}`.
     - Run them, then assert the real rendered output: for whitespace-only, whatever RelayMarkdown actually renders (likely no `<p>`); for nested lists, a `ul` nested inside the `ol`, e.g. `container.querySelector("ol ul")` not null.
     - Or delete both cases.
   - The P1.7-unit-a4.md claim of "real assertions" for these cases is false.

## P1.8 E2E: message order, Copy and actions: PASS
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts --repeat-each=3 --reporter=line`: 27 passed (21.8s), exit 0.
- `bash e2e/scenarios/relay/check-ids.sh`: exit 0, `relay-polish-msg: feature ids: 9 test ids: 9`.
- No test.fail, skip, only or fixme.
- One test() per scenario. Every test uses `seededPage` and `snap`, and the describe carries `@qa` and a priority tag per title.
- No waitForTimeout and no magic timeouts. All counts are web-first.
- The Scenarios match TASKS L154-160 (01-07), plus 08 (error) and 09 (empty) for the Do-mandated error and empty cases.
- Non-blocking wording nits for the e2e engineer, if touching the file anyway:
  - MSG-09's title "thread with no messages shows no actions" contradicts its Given ("containing only a user message"). Rename it in both spec and feature, e.g. "a thread with no assistant reply shows no actions".
  - The MSG-09 Gherkin uses "And when ... Then" mid-scenario.
  - The MSG-05 Gherkin says "hovered or focused", but the spec does neither (the actions are visible once settled).

## P1.9 E2E: migrate thumbs scenarios: PASS
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-actions.spec.ts e2e/qa/relay/relay-chat.spec.ts --repeat-each=3 --reporter=line`: 57 passed (51.4s), exit 0.
- The `relay-thumbs|thumbsUp|thumbsDown|relay_feedback` grep over e2e: exit 0.
- check-ids.sh: exit 0.
- `grep -rn REL-QOL-05 e2e src`: no hits.
- The qol-actions feature drops REL-QOL-05 and its feedback header text, and the spec drops that test and its helpers.
- qol-rewrite.feature.md is unmodified. `git show HEAD:` of it, grepped for `QOL-05|rate|feedback|thumb`, matches only "regenerate", so there was never a stale reference to remove.
- relay-chat.spec.ts needed no change.
- The P1.9-e2e-a1.md claims match what I observed.

## P1.10 Checkpoint 1: HELD (all commands green; re-run after the P1.7 fix)
| Command | Result |
|---|---|
| `bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n` | 110 files, 2953 passed, exit 0 |
| polish-msg `--repeat-each=2` | 18 passed, exit 0 |
| qol-actions plus relay-chat | 19 passed, exit 0 |
| check-ids.sh | exit 0 |
| `bun run lint:check` | 723 files, exit 0 |
| `bun run typecheck` | tsc --noEmit, exit 0 |
| brandGuard | 12 passed |
| feedback grep over src, e2e and messages | exit 0 |

- AC1 is backed by MSG-01/02/03/05/06: no A7/A8 glue, cards render in stream order, only Copy and Regenerate remain, and an old thread renders in order.
- The gate cannot pass while P1.7 holds a vacuous required case. That case only went green because the gate builder edited it.
- After the unit engineer applies the P1.7 fixes, re-run telemetry.spec, the P1.7 coverage command, typecheck and the feedback grep.

-------------------------------------------------------------------
## Code quality (source files)
- The source files are unchanged since the a2 review (mtimes 20:24-21:02, a2 report 21:29). I re-read MessageParts.tsx and messageText.ts and reviewed the RelayDock, RelayMarkdown, MessageActions and telemetry diffs. No concrete violations.
- The test-file violations are listed under P1.7.
