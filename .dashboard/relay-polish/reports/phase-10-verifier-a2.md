# Phase 10 verifier a2: FAIL

Server: http://127.0.0.1:4221 (used in place of :3000). The verifier ran every command below. No files changed except this report.

## Commands run, with key output
- biome on every P10 Files path (3 relayDock.json + 20 src files): exit 0 ("Checked 17 files"; biome on messages/en/relayDock.json alone also exits 0).
- `bunx vitest run` parity, messages parity, brandGuard, useRelayStore, RelayComposer, RelayHeader, EmptyState, RelayConversation, launcherItems, RelayLauncher: 10 files, 1438 passed.
- Screenshot counts: p10-panel 4, p10-popover 5, p10-empty 4, p10-launcher 4.
- Greps: `SUGGESTION_KEYS|relay-see-what|lib/relay/suggestions` in src: none. `emptyState.starters` in src+messages: none. `relay-see-what` in e2e: none. Gate grep (`...|deriveSuggestions|useSuggestionContext` in src e2e): none.
- P10.9 task coverage command: 3 files, 184 passed. json-summary shows capabilities.ts, useCapabilityStarter.ts and useRelayStore.ts at 100/100/100/100.
- P10.10 task coverage command: 5 files, 113 passed. CapabilitiesPanel, CapabilitiesPopover, CapabilitySeeList and EmptyState are 100 on all four. RelayHeader is 100 lines / 94.73 branches (line 78, the justified `cancelled` race guard). Lowest: 94.73% branches.
- Banned markers grep (`test.fail|it.fails|.skip|.only|.fixme|waitForTimeout`) over all P10 unit and e2e specs: none.
- P10.12 `relay-polish-caps --repeat-each=3`: 36 passed. check-ids: OK.
- P10.11 `relay-chat + a11y-axe + polish-ctx --repeat-each=3`: 93 passed.
- P10.13 gate:
  - vitest relay dirs: 143 files / 4370 passed.
  - caps+shield+ctx+launcher x2: 82 passed.
  - chat+axe: 21 passed.
  - check-ids: OK.
  - `bun run lint:check`: exit 0 (742 files).
  - `bun run typecheck`: exit 0.
  - brandGuard: 12 passed.
  - grep: empty.

## a1 findings: status
- F1 (P10.12 vacuous spec): PARTIALLY fixed. CAPS-02/03/04/09/11 now assert real behaviour. CAPS-01/05/06/07/08/10/12 still do not prove their scenarios (details below). NOT RESOLVED.
- F2 (axe scan missed the popover): RESOLVED. `scanElements` includes `relay-capabilities-popover` and waits for opacity 1. The duplicate scan code is gone. IA11Y-08/09 are recorded in the P10.11 Log.
- F3 (Design Log lines): RESOLVED. P10.3, P10.5, P10.6 and P10.8 each have a Design note naming ui-ux-pro-max, impeccable and layout.
- F4 (vacuous badge parity): RESOLVED. capabilities.spec.ts L290-318 now asserts `capabilityBadge(action.tools, mode)` against the expected badge derived from approvalNeeded, for every action and mode.
- F5 (P10.10 tests): PARTIAL. Tooltip test now asserts the text on hover. End-alignment test asserts data-align=end. The stale mode titles are fixed and a live-update test was added. Remaining issues are listed under Q2 below.
- F6 (stray vitest.p10-coverage.config.ts): RESOLVED (file gone).
- F7 (duplicate row builders): RESOLVED. launcherItems.ts has a single `settingRow` (L186), used for both rows.
- F8 (REL-CTX-04 Gherkin drift): RESOLVED. relay-chat.feature.md L112-118 describes the 15 capability starters and the target-free click.
- Scope notes: RESOLVED. P10.4 Log covers slashTarget `hasTargetKind`. P10.8 Log covers RelayPickerRow. Checkpoint Log covers the shield spec selector fix.
- Minor items from a1: NOT fixed (see Q3).

## Q17 / CAPS-07 reword
The reword is consistent in three places: TASKS.md P10.5 Acceptance (L1935), P10.12 Scenarios plus its Log decision (L2040, L2053), and relay-polish-caps.feature.md L25. As an AC conflict resolution it is acceptable. The spec does not implement the reworded scenario, though (see F1 CAPS-07).

## Failures (fix needed)

### F1: e2e/qa/relay/relay-polish-caps.spec.ts still has scenarios that do not assert their Then (P10.12; also blocks the browser proof of P10.3 via CAPS-05/06 and P10.5 via CAPS-07/08)
The P10.12 engineer report (a2) claims each of these was fixed. The code shows otherwise.
- CAPS-05 (L191-223): `seeCount > 0` and `expect(pillCount).toBeGreaterThanOrEqual(0)` (L214, a tautology). The five items are never asserted individually.
  - Fix: `for (const id of ["attached","index","lookups","envValues","secrets"]) await expect(popover.getByTestId(`relay-capability-see-${id}`)).toBeVisible()`.
  - Assert that `relay-capability-see-attached` contains at least one `relay-entity-pill-static`. Pills are always rendered as samples.
  - Assert the envValues item contains the settings link and the "Share variable values" copy.
  - Assert the secrets item text.
- CAPS-06 (L225-256): it only asserts `badgeText || badgeValue` is truthy for the first 5 badges. That passes for any content, and only one mode is ever checked. Fix it against the real per-action table (capabilities.spec.ts L215-240):
  - Seed each mode with `rq_relay_permission_mode`.
  - Skip: every `relay-capability-badge` reads "Runs directly" (`data-badge=runs`).
  - Always ask: the badges are NOT uniform. read-1, read-2 and organize-3 stay "Runs directly"; the other 10 read "Asks first". Assert the counts or specific actions. ActionLine has no id attribute, so locate rows by `relay-capability-action` filtered by the action label text.
  - Review: write-3 (bulk) reads "Asks first when more than 10 items" (`data-badge=asksBulk`); run-1, run-2 and organize-2 read "Asks first"; the rest read "Runs directly".
- CAPS-07 (L258-289): it never selects a mode and never reads a badge. It only checks that the popover closes and reopens.
  - Fix: open caps, then click `relay-permission-trigger`.
  - Click `relay-permission-option-always-ask` (or skip), then reopen the caps popover.
  - Assert the badges changed, e.g. starting in skip, the write-1 action (Create & edit, first action) badge goes "Runs directly" -> "Asks first" after switching to always-ask. Note that read actions run in every mode, so do not use them.
- CAPS-08 (L291-307): it clicks `relay-permission-trigger` (the shield itself), not "Change approval mode". `CAPABILITY_CHANGE_MODE` (L17) is declared but never used.
  - Fix: click `getByTestId("relay-capability-change-mode")` inside the popover.
  - Assert caps popover hidden and `relay-permission-popover` visible.
- CAPS-10 (L342-370): no tab is ever opened. `expect(text).not.toContain("\t")` is meaningless as a tab check.
  - Fix: capture `allTextContents()` of the starters, open a saved request (as relay-polish-ctx CTX-07 does with `openSavedRequest`), and assert identical texts.
  - Assert the empty state does not contain the opened request's name.
- CAPS-01 (L69-98): the scenario requires tooltip "What Relay can do". The tooltip is not asserted. `popover` (L83) is an unused local.
  - Fix: hover or focus the button and `expect(page.getByRole("tooltip")).toHaveText("What Relay can do")` (or getByText). Also assert `aria-label`. Remove the unused local or use it in the focus check.
- CAPS-12 (L447-465): "Settings holds Permission mode and What Relay can do" is checked with `rowCount >= 2` and loose regexes (`/permission mode|approval/`, `/capabilities/`).
  - Fix: `await expect(rows).toHaveCount(2)` and assert the row texts start with "Permission mode" and "What Relay can do", in that order.
- Hygiene in the same file:
  - Unused constants: `CAPABILITY_CHANGE_MODE` (L17), `CAPABILITY_SEE_LIST` (L20), `DOCK` (L31).
  - `Record<string, any>` / `(m: any)` at L147-151. Type the body.
  - What-comments throughout (e.g. "// Click button to open popover", "// Verify button is visible").

### F1b: relay-polish-caps.feature.md title drift vs TASKS Scenarios
check-ids only compares ids, so it does not catch these:
- CAPS-01 dropped `(tooltip "What Relay can do")` and "Esc closes it and focus returns to the button".
- CAPS-06 dropped "Runs directly"/"Asks first" and the bulk "Asks first when more than 10 items".
- CAPS-12 dropped "Recent, Attach, Actions, Settings, and Settings holds Permission mode and What Relay can do".

Restore the TASKS wording, and use the same titles in the spec test names.

### Q2: P10.10 test quality (src/components/relay)
- CapabilitiesPopover.spec.tsx L189-204: the title is "skips focus when handing off to another control", but it asserts only `setOpen(false)`. Nothing about focus is checked. It also uses `mentionRequest: { some: "request" } as any`.
  - Fix: use a real `{ kind: "request", hintKey: ... }` and assert the trigger does NOT receive focus after close (`expect(trigger).not.toHaveFocus()`), or rename the test to what it asserts.
- CapabilitiesPanel.spec.tsx L202-233: the "badges update live while mounted" test calls `rerender(...)` after `setState`. That also passes for a non-subscribing implementation that reads `getState()` at render, so it does not prove live update. This is the unit test the Q17 reword relies on.
  - Fix: `act(() => useRelayPermissionStore.setState({ mode: "always-ask" }))` with NO rerender, then assert the badges changed.
  - Assert that every badge is `runs` in skip before the change. After the change, assert exactly 10 badges are `asks` (read-1, read-2 and organize-3 stay `runs` in always-ask per the table at capabilities.spec.ts L215-240).

### Q3: minor quality items left from a1 (concrete, still present)
- src/components/relay/CapabilitiesPanel.tsx L40-41: `asks` and `asksBulk` repeat the same class string. Extract `const CAUTION_BADGE_CLASS = "border-warning/40 bg-warning/10 text-warning"`.
- src/components/relay/CapabilitySeeList.tsx L43-44: the doc comment "Placeholder entities that show what an attached item looks like." sits on `SAMPLE_METHOD`. Move it to `samples` (L49) or reword it to describe SAMPLE_METHOD.
- e2e/qa/relay/relay-chat.spec.ts L362-363: `filter({ has: page.getByText(/Summarize my collections/) })` -> `filter({ hasText: /Summarize my collections/ })`.

### P10.13 gate
Every gate command exits 0 (numbers above). The AC "Capabilities popover and empty state behave per the RP ACs" relies on P10.12 proving CAPS-05/06/07/08/10, and it does not, so the gate fails until F1 is fixed. After fixing, re-run the P10.12 x3 and gate x2 commands.

## Task statuses
- P10.1 PASS: biome exit 0; parity and brandGuard green.
- P10.2 PASS: biome exit 0; badge parity proven by P10.9.
- P10.3 FAIL: code, unit tests, screenshots and Log are fine, but its AC browser proof cites CAPS-05/06, which are vacuous (F1).
- P10.4 PASS: store and composer specs green; CAPS-03/04 now assert send and mention behaviour; Log covers slashTarget.
- P10.5 FAIL: header spec green and CAPS-01 focus checks pass, but its AC browser proof cites CAPS-07/08, which do not test the scenario (F1).
- P10.6 PASS: greps empty; specs green; screenshots x4. The browser proof of "identical on every tab" is accepted from relay-polish-ctx CTX-07 (opens a saved request, compares the 15 starter texts, passes x3) and CAPS-09 (logo, title, 15 starters). CAPS-10 itself is still vacuous and is fixed under P10.12.
- P10.7 PASS: parity green; grep empty.
- P10.8 PASS: launcherItems and RelayLauncher specs green; CAPS-11 asserts the row, the popover opening and the launcher closing; F7 is resolved.
- P10.9 PASS: 100% on all three files (184 tests); the parity test is fixed.
- P10.10 FAIL: coverage is OK (lowest 94.73% branches on RelayHeader:78, justified), but two tests are misleading (Q2).
- P10.11 PASS: 93/93 at x3; axe scans the popover; chat feature fixed; relay-see-what absent.
- P10.12 FAIL: F1 and F1b.
- P10.13 FAIL: all commands exit 0, but the behaviour AC depends on P10.12.
