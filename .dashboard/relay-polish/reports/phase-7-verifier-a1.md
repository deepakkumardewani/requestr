# Phase 7 verifier report (a1): Slash actions and target handling

**Verdict: FAIL.** Behaviour is largely correct and every functional Verify command exits 0, but the phase fails on three counts:
- the gate's Playwright run was flaky (1 failure in 4 runs);
- the design evidence required by Conventions is missing for P7.4 and P7.5, and the P7.2 Log is missing;
- there are concrete code-quality violations, one of which is the only lint warning in the repo.

## Commands run (all by the verifier, 2026-10-20)

| Task | Command | Result |
|---|---|---|
| P7.1-P7.5 | `bunx biome check` on all 13 P7.1-P7.5 files | exit 0, "Checked 10 files, No fixes applied" |
| P7.1/P7.2/P7.4/P7.5 | `bunx vitest run` parity + messages parity + brandGuard + slashCommands + SlashMenu + RelayComposer specs | 6 files, 1052 passed |
| P7.4/P7.5 | `ls agent_docs/qa/relay-polish/p7-*.png` | only `p7-slash-1440-light.png`, `p7-target-1440-light.png` |
| P7.6 | the task's coverage command | 115 passed; slashTarget.ts stmts 91.3 / br 96.42 / funcs 80 / lines 95.23 (uncovered L19); slashCommands.ts 100% (hidden as full) |
| P7.7 | the task's coverage command | exit 0; MentionMenu.tsx 98.82 / 93.84 / 100 / 100 (uncovered 132,153-156,267); useSlashCommandRunner.ts 100 / 94.44 / 100 / 100 (uncovered 106); SlashMenu.tsx 100% |
| P7.6/P7.7 | `grep -rnE "test\.fail\|it\.fails\|\.skip\|\.only\|\.fixme"` over all phase unit and e2e specs | no matches |
| P7.7 | happy-dom header check | present in useSlashCommandRunner.spec.ts, SlashMenu.spec.tsx, MentionMenu.spec.tsx |
| P7.8 | `playwright test relay-improvements-layout + smart-tests --repeat-each=3` | 21 passed |
| P7.9 | `playwright test relay-improvements-a11y-keyboard + picker --repeat-each=3` | 24 passed |
| P7.9 | grep `e2e/` for an old 5-command flat list | none |
| P7.10 | `playwright test relay-polish-slash.spec.ts --repeat-each=3` | 30 passed |
| P7.8/9/10/11 | `bash e2e/scenarios/relay/check-ids.sh` | OK: scenario IDs consistent |
| P7.11 | `bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n` | 117 files, 3319 passed |
| P7.11 | `playwright test relay-polish-slash + relay-polish-mention --repeat-each=2` | **run 1: 1 failed, 47 passed** (`expect(locator).toHaveValue(expected) failed`); run 2: 48 passed; run 3 (x4): 96 passed |
| P7.11 | `playwright test` with the 4 improvements specs | 15 passed |
| P7.11 | `bun run lint:check` | exit 0, **1 warning**: `src/lib/relay/chips.ts:38:3 lint/correctness/noUnusedFunctionParameters` |
| P7.11 | `bun run typecheck` | exit 0 |
| P7.11 | brandGuard spec | 12 passed |

Locale check (node script over the en, fr and ja `relayDock.json` files): all 15 ids have a `description`, and every id except `clear` has a `prompt`. `clear.prompt` is absent. All six groups and all four `slash.hint.{request,collection,chain,tab}` keys are present. `slash.hint.request` = "Pick a request to run".

## Per task

- **P7.1 PASS.** Keys are complete and identical across locales, and parity plus brandGuard are green. The legacy `slash.hint` was renamed to `slash.composerHint`, which is unreferenced in src (it was unused before too).
- **P7.2 FAIL (Log).** The metadata matches SPEC section 6: 15 unique ids, correct groups, `/explain` request (tab satisfies it), `/run` request or chain, `/summarize` any attached (special-cased), `/docs` collection, `/export`, `/new`, `/import`, `/chain`, `/env` and `/clear` none. `/ru` filters to `/run`, `findSlashQuery` is unchanged, and the spec is green. However, the Do step requires the tool audit to be recorded in the task **Log**, and Phase 7 in TASKS.md (L1214-1381) has no `- **Log**:` lines; the audit exists only in `phase-7-builder-a1.md`. Fix: add the Log line to P7.2 in TASKS.md.
- **P7.3 PASS (behaviour).** `/run` with nothing attached returns needKind `request`; `/clear` and `/import` are satisfied. Two quality items are listed below.
- **P7.4 FAIL (design evidence).** Behaviour is proven by the green SLASH-01, 02 and 08 tests. Conventions require screenshots at 1440px and 320px in both light and dark, plus a one-line design Log in the task, and the verifier must reject a UI task without the Log line. Only `p7-slash-1440-light.png` exists, and it is visibly **dark-themed** despite its `-light` name. There are no 320px or dark files and no Log line. Phase 6 has the full p6-*-{1440,320}-{light,dark} set, so this is the established bar. Fix: capture `p7-slash-{1440,320}-{light,dark}.png` with the right themes and add the Log line.
- **P7.5 FAIL (design evidence).** Same problem: only `p7-target-1440-light.png` exists, it is dark-themed, and there is no Log line. Behaviour is fine: the screenshot shows the hint "Pick a request to run" with the Current tab section pinned, and SLASH-03 to 07 are green. Fix: as for P7.4, using `p7-target-*`.
- **P7.6 PASS.** Every file is at or above 80%; the lowest figure is 80% functions in slashTarget.ts. The engineer's justification (L18-19, the `tab` kind branch is unreachable because no command requires `tab`) is accurate, but the code is dead and is listed below.
- **P7.7 PASS (coverage).** Every file is at or above 80%; the lowest figure is 93.84% branches in MentionMenu.tsx. The engineer report's figures are stale (it claims runner branches 100%, but they are now 94.44%) because the gate fix-forward edited the files afterwards.
- **P7.8 PASS.** e2e 21/21 at x3; check-ids OK.
- **P7.9 PASS.** e2e 24/24 at x3; no old flat-list assertion remains.
- **P7.10 PASS.** e2e 30/30 at x3. The spec has 10 tests for 10 ids, and check-ids reports 10/10.
- **P7.11 FAIL.**
  1. The slash plus mention gate command was **flaky**: the first run failed 1 of 48 on a composer `toHaveValue`, and subsequent runs passed 48/48 and 96/96. Candidates are the one `toHaveValue` in relay-polish-slash.spec.ts and the four in relay-polish-mention.spec.ts. The gate report already root-caused a MENTION-05 flake (duplicate "Get Users" seeds) and patched highlight selection, so that flake may not be fully closed. Fix: run `--repeat-each=6 --reporter=list`, identify the test, and fix the root cause (make the seed or highlight deterministic, or wait on the pill before asserting the value), not by weakening the assertion.
  2. `lint:check` exits 0 but reports a warning in a file this phase changed (see Q1).

## Scope notes (accepted)

- `RelayConversation.tsx` drops its `ContextChips` import and usage. This was required: the Phase 6 commit (HEAD) deleted `ContextChips.tsx` but left the import.
- The `RelayPicker.tsx` constants were moved to the shared `RELAY_PICKER_*` constants, and the two polish specs had a testid rename to `relay-composer-pill`. These are small follow-ups.
- `chips.ts`, `chips.spec.ts` and the MentionMenu highlight were changed as gate fix-forward, as documented in `phase-7-gate-a1.md`.

## Quality violations (each needs a fix)

- **Q1** `src/lib/relay/chips.ts:36-43`: `isRedundantRequestAttach` takes an unused `attached` parameter, which is the only biome warning in the repo. It also has no unit test in `chips.spec.ts`, which only covers `isRedundantTabAttach`. Fix: drop the parameter, update the caller in `RelayComposer.tsx:162`, and add a test.
- **Q2** `src/hooks/useSlashCommandRunner.ts:131-141`: `completeTargetPick(chip)` silences an unused parameter with `void chip;`, and lines 134-135 re-set the draft and caret to `pendingCommand.name`, which `runSlashCommand` already wrote at L101-102. Fix: remove the parameter (or use it) and the redundant draft write.
- **Q3** `src/hooks/useSlashCommandRunner.ts:104-118`: the `else` branch is unreachable because `resolveSlashTarget` always returns a non-null `needKind` when it is unsatisfied. The `needKind === "tab" ? null` mapping at L106 is the uncovered line, since no command requires `tab`. Fix: type `SlashTargetResolution` as a discriminated union (`{satisfied:true} | {satisfied:false; needKind}`) and delete the dead branch.
- **Q4** `src/hooks/useSlashCommandRunner.ts:82-87`: the `/import` branch duplicates the satisfied path at L94-98, and `resolveSlashTarget` already returns satisfied for `import`. This is a DRY violation. Fix: delete the branch.
- **Q5** `src/lib/relay/slashTarget.ts:48-50`: the `export`/`env` special case is dead because both have `requiresTarget: null`, which L52 already handles. The `tab` branch at L18-20 is also dead, since no command declares `requiresTarget: "tab"`; it only matters if that stays in the type. Fix: remove L48-50.
- **Q6** `src/components/relay/RelayComposer.tsx:149-158`: the tab to requestId lookup `tabs.find((tab) => tab.tabId === X)?.requestId` is written twice inline. A tab-by-id helper already exists in `src/lib/relay/tools/tabRequests.ts:33`. Fix: extract or reuse one helper.

## Observation (no action required by this phase's AC)

After a target is picked, the draft is the literal `/run`. Sending it submits "/run" rather than `t(slash.run.prompt)`; there is no send-time expansion in src. This matches the P7.5 wording ("leaves the command text ready to send") and SLASH-04, but RP-217 says "selecting fills the prompt from t(promptKey)". The orchestrator should confirm this is the intended UX.
