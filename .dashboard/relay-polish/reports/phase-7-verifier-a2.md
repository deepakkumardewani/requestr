# Phase 7 verifier report (a2): Slash actions and target handling

**Verdict: FAIL, on one scope and hygiene item.** Every Verify command and the Checkpoint 7 gate passed when the verifier ran them, and all a1 issues are fixed. The only blocker is the new, untracked `e2e/qa/relay/capture-p7-design.spec.ts` (see Q7).

## Commands run (by the verifier; logs in `reports/logs/p7v2-*.log`)

| Task | Command | Result |
|---|---|---|
| P7.1-P7.5 + a2 files | `bunx biome check` over the locales, slashCommands, slashTarget, SlashMenu, constants, the runner, RelayComposer, MentionMenu, chips, tabRequests and their specs | exit 0, "Checked 12 files, No fixes applied" |
| P7.1/2/4/5 | `bunx vitest run` relayMessages parity + messages parity + brandGuard + slashCommands + SlashMenu + RelayComposer + chips specs | 7 files, 1063 passed |
| P7.4 | `ls agent_docs/qa/relay-polish/p7-slash-*.png` | 4 files: {1440,320}-{light,dark} |
| P7.5 | `ls agent_docs/qa/relay-polish/p7-target-*.png` | 4 files: {1440,320}-{light,dark} |
| P7.4/5 | Viewed `p7-slash-320-light.png` and `p7-target-1440-dark.png` | Themes are correct (light is light, dark is dark). The slash menu shows group headings, icons and descriptions; the target shot shows the hint "Pick a request to run", the pinned Current tab (Get Users) and `/run` in the draft |
| P7.6 | the task's coverage command | 115 passed; slashCommands.ts + slashTarget.ts at **100%** on stmts/branches/funcs/lines |
| P7.7 | the task's coverage command | 58 passed; MentionMenu.tsx 98.82/93.84/100/100 (uncovered 132,153-156,267); useSlashCommandRunner.ts 100/**92.85**/100/100 (uncovered 95); SlashMenu.tsx 100% |
| P7.8 | `playwright test relay-improvements-layout + smart-tests --repeat-each=3` | **21 passed** |
| P7.9 | `playwright test relay-improvements-a11y-keyboard + picker --repeat-each=3` | **24 passed** |
| P7.10 | `playwright test relay-polish-slash --repeat-each=3` | **30 passed** |
| P7.8-11 | `bash e2e/scenarios/relay/check-ids.sh` | OK: scenario IDs consistent |
| all | `grep -rnE "test\.fail\|it\.fails\|\.skip\|\.only\|\.fixme"` over every phase spec (unit + e2e + capture) | no matches |
| P7.11 | `bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n` | 117 files, **3320 passed** |
| P7.11 | `playwright test relay-polish-slash + relay-polish-mention --repeat-each=2`, run **3 times** | 48/48, 48/48, 48/48 (144 total, no flake) |
| P7.11 | `playwright test` with the 4 improvements specs | **15 passed** |
| P7.11 | `bun run lint:check` | exit 0, "Checked 732 files", **no warnings** |
| P7.11 | `bun run typecheck` | exit 0 |
| P7.11 | `bunx vitest run src/lib/relay/brandGuard.spec.ts` | 12 passed |

## a1 issues: re-check

- **P7.2 Log**: fixed. The TASKS.md P7.2 Log line now records the RELAY_TOOL_SCHEMAS audit.
- **P7.4/P7.5 design evidence**: fixed. All 8 PNGs exist, the themes are correct, and both tasks have a Log line naming what each skill changed.
- **P7.11 flake**: fixed. The mention spec diff only **adds** assertions (menu visible, Get Users row visible before Tab, pill count 1 before `toHaveValue`), so nothing was weakened. SLASH-04 asserts the pill count before the value. The verifier's own 3x(x2) runs were 144/144.
- **Lint warning**: fixed (0 warnings).
- **Q1**: fixed. `isRedundantRequestAttach(chip, requestIdsFromAttachedTabs)` no longer has an unused parameter, and it is tested in chips.spec.ts (the chips spec is in the green run).
- **Q2**: fixed. `completeTargetPick()` takes no parameter and only clears pending state.
- **Q3**: fixed. `SlashTargetResolution` is now a discriminated union and the dead else branch is gone.
- **Q4**: fixed. The duplicate `/import` branch was removed from the runner, which now only special-cases `clear`.
- **Q5**: fixed. The dead `export`/`env` and `tab` branches were removed from slashTarget.ts.
- **Q6**: fixed. `RelayComposer.attach` uses the exported `findTab` from `tabRequests.ts`.

## Per task

- **P7.1 PASS**: biome is clean; parity and brandGuard are green.
- **P7.2 PASS**: the spec is green and the Log line is present.
- **P7.3 PASS**: biome is clean, and coverage of slashTarget.ts is 100% (P7.6).
- **P7.4 PASS**: biome and the spec are green, the screenshots are present and correct, and the Log line is present. SLASH-01/02/08 are green.
- **P7.5 PASS**: biome and the specs are green, the screenshots are present, and the Log line is present. SLASH-03 to 07 are green.
- **P7.6 PASS**: both files are at 100%.
- **P7.7 PASS**: the lowest figure is 92.85% branches in useSlashCommandRunner.ts. The uncovered line 95 is the `needKind === "tab" ? null` mapping. It is required by the types (`SlashTargetKind` includes `tab` per P7.2, while the picker kind has no `tab`), but no command declares `requiresTarget: "tab"`. The verifier accepts this justification. MentionMenu's 93.84% is unchanged from a1 and was justified there. Note that the P7.7 engineer report's figures are stale.
- **P7.8 PASS**: e2e 21/21 at x3.
- **P7.9 PASS**: e2e 24/24 at x3.
- **P7.10 PASS**: e2e 30/30 at x3.
- **P7.11 PASS on commands**: every gate command exits 0, and slash plus mention passed 144/144 across 3 gate runs. It is blocked only by Q7.

## Quality violation (needs a fix)

- **Q7 `e2e/qa/relay/capture-p7-design.spec.ts` (new, untracked): scope and hygiene.**
  - The file is not listed in any P7 task's Files.
  - It sits in the seeded QA spec dir with a `@qa` describe tag (`test.describe("P7 design captures @qa", …)` at L76), but it has no feature file and no `REL-POL-*` ids. It breaks the Conventions naming (`relay-polish-<area>.spec.ts` with Gherkin).
  - Its only "assertions" are visibility checks before `page.screenshot({ path: "agent_docs/qa/relay-polish/p7-*.png" })`. Any `@qa` or e2e-dir run will therefore silently **overwrite the committed evidence PNGs** and dirty the git tree.
  - Conventions say design screenshots come from agent-browser and are "visual evidence only", not a committed spec.
  - It also repeats the inline type `import("@playwright/test").Page` four times (L14, L31, L39, L53, L65).
  - **Fix**: delete the file. The 8 PNGs are already captured and stay as evidence. If a reusable capture is really wanted, move it out of `e2e/qa` (for example `scripts/` or `e2e/tools/`) without the `@qa` tag and with a single `type Page` import, and list it in a task's Files.

## Observation (carried from a1; not blocking)

After a target is picked, the draft stays the literal `/run`, and sending submits "/run" rather than `t(slash.run.prompt)`. This matches the P7.5 AC ("leaves the command text ready to send") and SLASH-04. The builder logged it as a decision for the orchestrator.
