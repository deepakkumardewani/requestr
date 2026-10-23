# Phase 10 verifier a4: FAIL

Server: http://127.0.0.1:4221 (used in place of :3000). Every command below was run by this verifier. The only file changed is this report.

## Blocking failure: the P10.13 gate's `bun run typecheck` exits 2 (13 errors, all in e2e/qa/relay/relay-polish-caps.spec.ts)
The a4 rewrite of CAPS-06 introduced this. a3 measured typecheck exit 0, and the a4 engineer report does not mention running typecheck.
```
e2e/qa/relay/relay-polish-caps.spec.ts(246,5): error TS2322: Type '{ badge: string | null; text: string; }[]' is not assignable to type '(string | null)[]'.
e2e/qa/relay/relay-polish-caps.spec.ts(256,49): error TS18047: 'b' is possibly 'null'.
e2e/qa/relay/relay-polish-caps.spec.ts(256,51): error TS2339: Property 'badge' does not exist on type 'string'.
... (257, 258, 261 x4)
e2e/qa/relay/relay-polish-caps.spec.ts(272,5): error TS2322: same as 246
e2e/qa/relay/relay-polish-caps.spec.ts(280,54/56), (282,31): same family
```
Root cause: L230 `let badgeValues = await badges.evaluateAll(... => el.getAttribute("data-badge"))` gives the type `(string|null)[]`. L246 and L272 then reassign it with `{badge,text}[]`.
Fix: add one helper, e.g. `async function readBadges(panel: Locator): Promise<{ badge: string | null; text: string }[]>`, and use it in all three CAPS-06 passes and both CAPS-07 reads. That fixes the types and removes the evaluateAll block that is now copied 5 times (L230, L246, L272, L300, L319). Use `const` per pass instead of reusing a `let`. Re-run `bun run typecheck` and get exit 0.

## Commands run, with key output
- biome on all P10 Files paths plus the caps spec (24 paths): "Checked 17 files ... No fixes applied", no diagnostics.
- vitest: relayMessages parity, messages parity, brandGuard, useRelayStore, RelayComposer, RelayHeader, EmptyState, RelayConversation, launcherItems, RelayLauncher: 10 files, 1438 passed, exit 0.
- Screenshots: p10-panel 4, p10-popover 5, p10-empty 4, p10-launcher 4.
- Greps, all empty: `SUGGESTION_KEYS|relay-see-what|lib/relay/suggestions` in src; `emptyState.starters` in src and messages; `relay-see-what` in e2e; the gate grep (adds `deriveSuggestions|useSuggestionContext`) over src and e2e. These do not exist: suggestions.ts, suggestions.spec.ts, relay-improvements-context-suggestions spec and feature.
- P10.9 coverage command: 3 files, 184 passed. Total 100/100/100/100.
- P10.10 coverage command: 5 files, 113 passed. All 100% except RelayHeader.tsx at 94.73% branches (L78, the `cancelled` guard; pre-existing code outside the P10 diff, justified in P10.10-unit-a3).
- json-summary over all 8 unit-target files: every file 100 lines/funcs/stmts; branches 100 except RelayHeader 94.73. Lowest is 94.73% branches.
- Banned-marker grep (`test.fail|it.fails|.skip(|.only(|.fixme|waitForTimeout`) over the caps/chat/axe/ctx e2e specs and all P10 unit specs: no matches (exit 1).
- P10.12 `relay-polish-caps.spec.ts --repeat-each=3`: 36 passed (26.6s), exit 0.
- P10.11 `chat + axe + ctx --repeat-each=3`: 93 passed (1.3m), exit 0.
- check-ids.sh: "OK: scenario IDs consistent".
- P10.13 gate, every command run in full:
  - vitest src/lib/relay src/hooks src/stores src/components/relay src/i18n: 143 files / 4370 passed, exit 0
  - caps+shield+ctx+launcher --repeat-each=2: 82 passed, exit 0
  - chat+axe: 21 passed, exit 0
  - check-ids: OK, exit 0
  - bun run lint:check: 742 files, exit 0 (note: biome does not catch TS type errors)
  - **bun run typecheck: exit 2, 13 errors (above): FAIL**
  - brandGuard: 12 passed
  - gate grep: empty, exit 0

## Status of the a3 findings
- F1 CAPS-06: PARTIAL.
  - Fixed: skip mode asserts `toHaveCount(13)`, all `runs`, and the first badge's text "Runs directly". Review mode is now seeded and asserts an `asksBulk` badge with text "Asks first when more than 10 items", plus exactly 3 `asks` badges reading "Asks first". Always-ask asserts 10 `asks` and the text "Asks first".
  - Still open: the code fails typecheck (above).
  - Still open: in review mode, nothing asserts that the other 9 badges are `runs`.
  - Still open: `find(asksBulk)` does not prove there is exactly one, or that it sits in the write category.
  - Fix, while adding the helper: assert counts `{asksBulk:1, asks:3, runs:9}`. Scope one check to `relay-capability-category-write` and confirm it contains the `asksBulk` badge.
- F2 CAPS-10: PARTIAL.
  - Fixed: it now calls `openSavedRequest(page, "Request A")` and compares the 15 starters. It also asserts the empty state does not contain "Request A".
  - Still open: `openSavedRequest` ends at `item.click()` without waiting for the tab to open (e2e/fixtures/relayImprovements.ts L38-39). The test then reads `allTextContents()` right away (L397), which does not retry. The comparison can therefore run before the tab exists and pass without testing anything.
  - Fix: after opening, wait for the tab to be active with a web-first check (e.g. the request tab or editor showing "Request A" is visible). Then use `await expect(startersAfterOpen).toHaveText(initialTexts)` and `await expect(emptyState).not.toContainText(SEEDED_REQUEST_NAME)`.
- F3 CAPS-01 tooltip: NOT RESOLVED. The check passes without testing anything.
  - Evidence: agent_docs/qa/relay-polish-caps/09-empty-state.png (seededPage, this run) shows the onboarding card "Step 1 of 3 / What Relay can do" visible in the Relay panel at load. `steps.can.title` = "What Relay can do" (messages/en/relayDock.json L434).
  - L76-80 `page.getByText("What Relay can do", { exact: false }).filter({ hasText: "What Relay can do" }).first()` therefore matches the onboarding title whether or not the tooltip renders. The `.filter` is a no-op, and `timeout: 10000` (L80, also L136) is a magic number.
  - Fix: after `button.hover()`, `await expect(page.getByRole("tooltip")).toHaveText("What Relay can do")`. If the tooltip has no role, scope to the tooltip popup element instead. Optionally assert that it is hidden before the hover. The unused `popover` local has been removed (OK).
- F4 hygiene: RESOLVED. `CAPABILITY_TAB_CAN` was removed, the request body is typed (L141-143), and the what-comments are gone. The new typecheck errors replace it as a hygiene problem.
- CAPS-07 (Q17 reword): consistent across TASKS P10.5 AC, P10.12 scenario and Log, feature L25 and the spec title. It is a real mode change via the shield. Minor: the skip-mode read at L300-303 has no count check, so `every()` passes even with zero badges. Add `toHaveCount(13)`.

## Quality violations (all in e2e/qa/relay/relay-polish-caps.spec.ts)
- L230/L246/L272: reusing one `let` across incompatible types causes the typecheck failure. Fix as above.
- L230, L246, L272, L300, L319: the badge-reading evaluateAll block appears 5 times. Extract a `readBadges` helper.
- L76-80: the tooltip assertion matches the onboarding "What Relay can do" title, so it proves nothing. It also has a no-op `.filter` and the magic `timeout: 10000` at L80 and L136.
- L397: `allTextContents()` without waiting for the tab (the CAPS-10 race).

## Task statuses
- P10.1 PASS: biome clean; parity, messages parity and brandGuard green.
- P10.2 PASS: biome clean; P10.9 proves each tool maps to exactly one category and badge parity, with capabilities.ts at 100%.
- P10.3 PASS: biome clean; screenshots x4; CAPS-02/05/06 pass in the browser, and CAPS-06 now shows the asksBulk badge.
- P10.4 PASS: biome clean; store and composer specs green; CAPS-03 captures 1 body containing the prompt; CAPS-04 shows the mention menu, the hint and the draft, with 0 bodies.
- P10.5 PASS: header spec green; screenshots x5; CAPS-01/07/08 green.
- P10.6 PASS: greps empty; EmptyState and RelayConversation green; screenshots x4. "Identical on every tab" is also proven by relay-polish-ctx CTX-07 and relay-chat REL-CTX-04.
- P10.7 PASS: parity green; emptyState.starters grep empty.
- P10.8 PASS: launcherItems and RelayLauncher green; screenshots x4; CAPS-11 and CAPS-12 green.
- P10.9 PASS: 184 tests; 100/100/100/100 on all 3 files.
- P10.10 PASS: 113 tests; lowest 94.73% branches (RelayHeader L78, justified).
- P10.11 PASS: 93/93 at x3; axe IA11Y-08/09 scan the popover; check-ids OK; no relay-see-what in e2e.
- P10.12 FAIL: 36/36 at x3, but the spec does not typecheck (13 TS errors). The CAPS-01 tooltip check matches the onboarding title and passes without testing the tooltip. CAPS-10 has an unawaited tab-open race. CAPS-06 review mode does not assert the 9 runs.
- P10.13 FAIL: `bun run typecheck` exits 2. Every other gate command exits 0.

## After fixing
Re-run `bun run typecheck`, the caps spec at --repeat-each=3, the gate caps/shield/ctx/launcher run at x2, and check-ids.

## Orchestrator notes
- The working tree also holds uncommitted Phase 9-era files outside the P10 Files lists: ConfirmCard, MessageParts, useRelayChat, tools/schemas, registry, telemetry, RelaySection, globals.css, next.config.ts, package.json, bun.lock, relay.json, and the untracked PermissionShield, permission.ts, useRelayPermissionStore, describeGeneric, perm/shield specs. They were not reviewed as P10 changes.
- The untracked repo-root files `700`, `900` and `portless.json` should stay out of the phase commit.
