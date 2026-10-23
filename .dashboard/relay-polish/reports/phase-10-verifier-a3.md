# Phase 10 verifier a3: FAIL

Server: http://127.0.0.1:4221 (used in place of :3000). The verifier ran every command below itself. No files changed except this report.

## Commands run, with key output
- biome on all P10 Files paths (3 relayDock.json + 20 src files): exit 0, "Checked 17 files ... No fixes applied".
- vitest parity + messages parity + brandGuard + useRelayStore + RelayComposer + RelayHeader + EmptyState + RelayConversation + launcherItems + RelayLauncher: 10 files, 1438 passed.
- Screenshots: p10-panel 4, p10-popover 5, p10-empty 4, p10-launcher 4.
- Greps (all exit 0 / empty): `SUGGESTION_KEYS|relay-see-what|lib/relay/suggestions` in src; `emptyState.starters` in src+messages; `relay-see-what` in e2e; gate grep incl. `deriveSuggestions|useSuggestionContext` in src e2e. suggestions.ts, suggestions.spec.ts and relay-improvements-context-suggestions.spec.ts do not exist.
- P10.9 task coverage command: 3 files, 184 passed. json-summary: capabilities.ts, useCapabilityStarter.ts, useRelayStore.ts = 100/100/100/100 (lines/branches/funcs/stmts).
- P10.10 task coverage command: 5 files, 113 passed. All files 100/96.29/100/100; only RelayHeader.tsx 94.73% branches (line 78, the justified `cancelled` race guard). Lowest 94.73% branches.
- Banned markers grep (`test.fail|it.fails|.skip|.only|.fixme|waitForTimeout`) over all P10 unit specs + caps/chat/axe/ctx e2e specs: no matches (exit 1).
- happy-dom header present on useCapabilityStarter, CapabilitiesPanel, CapabilitySeeList, CapabilitiesPopover specs.
- P10.12 `relay-polish-caps.spec.ts --repeat-each=3`: 36 passed (25.0s).
- P10.11 `relay-chat + a11y-axe + polish-ctx --repeat-each=3`: 93 passed (1.3m).
- check-ids.sh: "OK: scenario IDs consistent".
- P10.13 gate, every command run in full:
  - `bunx vitest run src/lib/relay src/hooks src/stores src/components/relay src/i18n`: 143 files / 4370 passed, exit 0.
  - caps+shield+ctx+launcher `--repeat-each=2`: 82 passed, exit 0.
  - chat+axe: 21 passed, exit 0.
  - check-ids: OK, exit 0.
  - `bun run lint:check`: exit 0 (742 files).
  - `bun run typecheck`: exit 0.
  - brandGuard: 12 passed.
  - gate grep: empty, exit 0.

## a2 findings: status
- F1 CAPS-03/04 (already fixed in a2): still real. OK.
- F1 CAPS-05: RESOLVED (five see items asserted individually, a static pill in attached, settings link + "Share variable values" in envValues). Minor: secrets item text not asserted.
- F1 CAPS-06: NOT RESOLVED (see F1 below). Review mode and the bulk "Asks first when more than 10 items" badge are never exercised.
- F1 CAPS-07: RESOLVED. Starts in skip (all runs), clicks shield, picks always-ask, reopens, asserts 10 `asks`. Consistent with the Q17 reword (TASKS P10.5 AC L1935, P10.12 L2040 + Log L2053, feature L25).
- F1 CAPS-08: RESOLVED. Clicks `relay-capability-change-mode`, asserts caps hidden and `relay-permission-popover` visible.
- F1 CAPS-10: NOT RESOLVED (see F2 below). Still opens no tab.
- F1 CAPS-01: PARTIAL. aria-label asserted, focus-in and Esc refocus asserted; the tooltip text named in the scenario title is still not asserted, and `popover` (L80) is an unused local.
- F1 CAPS-12: RESOLVED. Exactly 4 sections in order recent/attach/actions/settings, exactly 2 settings rows starting "Permission mode" and "What Relay can do".
- F1 hygiene: PARTIAL. `DOCK`, `CAPABILITY_SEE_LIST` removed and `CAPABILITY_CHANGE_MODE` now used, but `CAPABILITY_TAB_CAN` (L14) is unused, `Record<string, any>` / `(m: any)` remain at L143-147, and what-comments remain throughout.
- F1b feature titles: RESOLVED. CAPS-01/06/12 titles in relay-polish-caps.feature.md and the spec test names match TASKS wording.
- Q2 CapabilitiesPopover "skips focus when handing off": RESOLVED (typed mentionRequest, asserts `trigger` not focused).
- Q2 CapabilitiesPanel live update: RESOLVED (asserts 13 runs in skip, then `act(setState always-ask)` with no rerender, asserts 10 asks / 3 runs).
- Q3 CAUTION_BADGE_CLASS: RESOLVED (CapabilitiesPanel.tsx L37, L42-43).
- Q3 CapabilitySeeList comment: RESOLVED (now on `samples`, L48).
- Q3 relay-chat filter: RESOLVED (`filter({ hasText: /Summarize my collections/ })`, L361-363).

## Failures (fix needed)

### F1: CAPS-06 does not prove its @critical scenario (e2e/qa/relay/relay-polish-caps.spec.ts L219-254)
Scenario: badges read "Runs directly" or "Asks first" per the current mode, AND bulk tools read "Asks first when more than 10 items".
- Review mode is never seeded, so `data-badge="asksBulk"` / "Asks first when more than 10 items" is never asserted anywhere in the e2e spec (`grep -n "asksBulk\|Asks first when\|review"` on the spec: only the test title).
- No visible badge text is ever read; only `data-badge` attributes.
- L236 `badgeValues.every((v) => v === "runs")` is vacuous if zero badges render; there is no count check in the skip half.
Fix:
- In skip: `await expect(badges).toHaveCount(13)`, then assert every badge is `runs` and the first reads "Runs directly".
- Add a review-mode pass (seed `rq_relay_permission_mode` = `review`, reload, reopen): the write-3 action row badge has `data-badge="asksBulk"` and text "Asks first when more than 10 items"; run-1, run-2, organize-2 read "Asks first"; the rest "Runs directly" (table in capabilities.spec.ts L215-240).
- In always-ask: keep the 10 `asks` count, and assert one badge's text is "Asks first".

### F2: CAPS-10 still opens no tab (L350-384)
The scenario is "identical whichever tab is open and shows no tab-derived text". The test opens the + launcher (not a tab) and compares starters while it is open. `expect(text).not.toContain("\t")` is not a tab check.
Fix: capture the 15 starter texts, `openSavedRequest(page, <seeded request>)` (as relay-polish-ctx CTX-07 and relay-chat REL-CTX-04 do), assert `toHaveText(initialTexts)`, and assert `relay-empty` does not contain the opened request's name. Drop the `\t` loop and the recent seed if no longer needed.

### F3: CAPS-01 tooltip not asserted (L67-94)
Title says tooltip "What Relay can do". Only aria-label is checked. Hover or focus the button and assert `page.getByRole("tooltip")` has text "What Relay can do". Remove or use the unused `popover` local at L80.

### F4: spec hygiene (same file)
- L14 `CAPABILITY_TAB_CAN` is declared and never used. Remove or use it.
- L143-147 `Record<string, any>` and `(m: any)`. Type the body (e.g. `{ messages: { role: string; parts: { text?: string }[] }[] }`).
- What-comments remain, e.g. L10 "// Test IDs for ...", L38 "// Helper to open capabilities popover", L103 "// Verify five categories exist", L323, L327, L331, L336, L340, L393, L397, L403, L407, L410, L414. Delete them.

## Task statuses
- P10.1 PASS: biome exit 0; parity + messages parity + brandGuard green.
- P10.2 PASS: biome exit 0; every-tool-one-category and badge parity proven by P10.9 at 100%.
- P10.3 FAIL: code, unit tests, screenshots and Design Log OK, but its AC browser proof cites CAPS-06, which still does not check the bulk badge (F1).
- P10.4 PASS: biome + store/composer specs green; CAPS-03 asserts one chat body with the prompt; CAPS-04 asserts mention menu, hint, prefilled draft, 0 bodies.
- P10.5 PASS: header spec green; screenshots x5; CAPS-01 (focus in, Esc refocus, aria-label), CAPS-07 (reworded, real mode change) and CAPS-08 (Change approval mode) now prove it; tooltip covered at unit level. The CAPS-01 tooltip gap is tracked under P10.12 F3.
- P10.6 PASS: greps empty; EmptyState/RelayConversation specs green; screenshots x4; "identical on every tab" proven in-browser by relay-polish-ctx CTX-07 and relay-chat REL-CTX-04 (both open a saved request and compare starters, green x3). CAPS-10 itself is fixed under P10.12 F2.
- P10.7 PASS: parity green; emptyState.starters grep empty.
- P10.8 PASS: launcherItems + RelayLauncher specs green; CAPS-11 and CAPS-12 assert the row, order and popover.
- P10.9 PASS: 184 tests; 100/100/100/100 on all three files.
- P10.10 PASS: 113 tests; lowest 94.73% branches (RelayHeader.tsx:78, justified race guard); Q2 fixed.
- P10.11 PASS: 93/93 at x3; axe scans the popover; relay-see-what absent in e2e; check-ids OK.
- P10.12 FAIL: F1, F2, F3, F4. Spec passes 36/36 x3 but CAPS-06 and CAPS-10 do not assert their scenarios.
- P10.13 FAIL: every gate command exits 0 (numbers above), but its AC "behave per the RP ACs" relies on P10.12, which still does not prove CAPS-06/10. After fixing, re-run P10.12 x3 and the gate x2 caps command.

## Additional checks (after the first draft)
- The review-mode table in F1 was checked against src/lib/relay/capabilities.spec.ts L215-240. In review: write-3 = asksBulk; run-1, run-2, organize-2 = asks; the other 9 = runs.
- Engineer reports P10.9-unit-a2 and P10.11-e2e-a2 were read. They claim no app bugs, no test.fail and no uncovered-line excuses, and that matches what was measured (100% coverage, axe green).
- Untracked repo-root files to keep out of the phase commit (orchestrator note):
  - `700` and `900` are 87 kB PNGs dated 2026-10-20 21:28, during Phase 9 work, so they are not P10 output.
  - `portless.json` (`{ "name": "requestly" }`, dated today) looks like the dev-server port tool's config.
  - None of these are in any P10 Files list.
