# Phase 2 verifier report (a4): Shell identity — VERDICT: FAIL

Scope came from `node ~/.claude/scripts/dashboard.mjs scope agent_docs/relay-polish/TASKS.md "phase 2"`: P2.1-P2.13 at L217-425, plus Checkpoint 2 at L426. I ran every command myself from the repo root. One browser probe ran from the scratchpad (probe/probe.mjs, plain playwright plus qa-seed.init.js against :3000) and wrote no repo files. The only repo file I wrote is this report.

## Commands run (key output)
- `bunx biome check` on all phase message, src and e2e files: "Checked 23 files. No fixes applied." Exit 0. biome.json ignores specs.
- Vitest, P2.1-P2.8 Verify specs plus parity, brandGuard, RelayLoadError and RelayRootChunkFailure: 16 files, 1043 passed.
- Greps, all exit 0:
  - no Sparkles in RelayToggleButton.tsx
  - no Sparkles under src/components/relay
  - no RelayToggleButton in LeftPanel.tsx
  - no Sparkles in relay or TabBar
  - `next/dynamic` found at TabBar.tsx:4
- Screenshots present in agent_docs/qa/relay-polish/: p2-logo x2, p2-identity x2, p2-shortcuts x4, p2-tabbar x2, p2-tooltips x3.
- P2.9 coverage (Verify command verbatim): 6 files / 191 passed.
  - TabBar.tsx 95.77 / 90.47 / 100 / 100 (stmts / branches / funcs / lines). Uncovered: 74, 93-100, 273.
  - RelayHeader.tsx 100 / 96 / 100 / 100. Uncovered: 69.
  - constants.ts, useRelayShortcut.ts and RelayToggleButton.tsx are 100 on all four metrics (json report).
- P2.10 coverage (Verify command verbatim): 4 files / 47 passed, all 100/100/100/100 (json-summary).
- Banned markers: `test.fail|it.fails|.skip|.only|.fixme|waitForTimeout|: any|as any` over every phase unit spec plus relay-polish-shell, relay-shell and relay-a11y. No matches (grep exit 1).
- happy-dom header present on all component and hook specs.
- P2.11: relay-shell, relay-a11y, improvements-pills and improvements-context-payload at `--repeat-each=3`: **57 passed**. check-ids.sh: "OK: scenario IDs consistent" (relay-polish-shell 11/11).
- P2.12: relay-polish-shell at `--repeat-each=3`: **33 passed** (26.1s).
- P2.13 gate:
  - Scoped vitest exit 0: 124 files / 3099 tests.
  - polish-shell + polish-msg at `--repeat-each=2`: 40 passed, exit 0.
  - relay-shell + relay-a11y: 11 passed, exit 0.
  - check-ids exit 0. `lint:check` exit 0 (725 files). `typecheck` exit 0. brandGuard 12 passed.
  - Both greps OK.
- Coverage json (scratchpad/cov29) for RelayHeader.tsx line 69:
  - branch 2, `if (!cancelled)`, is [6, 1]: **both arms covered**.
  - branch 3, binary-expr `thread?.title ?? null` (69:35-57), is [6, 0]. This `?? null` fallback is the uncovered branch.
- Coverage json for TabBar.tsx, uncovered:
  - L74 `if (!el) return` (checkOverflow)
  - L93 `if (!el) return` (ResizeObserver effect)
  - L100 `if (!pendingBulkClose) return`
  - L273 `if (pendingCloseTabId)` false arm
- Probe for SHELL-03, at 1280x720 with 20 new tabs:
  - Tab scroll area: scrollWidth 2814 > clientWidth 927, so overflow does happen.
  - Toggle right edge is at 1276.
  - The last tab sits at left=2930, outside the 1280 viewport and clipped by the scroll area, and Playwright `isVisible()` still returns **true**.

## Prior a3 findings: status
1. P2.12 waitForTimeout: FIXED. There are 0 occurrences. SHELL-11 waits for relay-dock-error, then `expect.poll(() => chunkAborted)`.
2. SHELL-01 far-right: FIXED. It asserts `0 <= tabBarRight - toggleRight <= 8`, plus the chevron and sidebar checks.
3. SHELL-02: FIXED.
   - It is scoped to `tabBar.getByTestId("tab")`, closes every tab and asserts toHaveCount(0).
   - It checks the right edge is within 8px, opens one tab, asserts toHaveCount(1), and checks the x delta is <= 1px.
4. SHELL-05: FIXED.
   - All three buttons are covered (new-thread, close, thread-trigger).
   - There are hover and real Shift+Tab legs, each with a <700ms bound.
   - Keycaps are tooltip-scoped and exact via `toHaveText(keycaps)`, and Escape is followed by `toBeHidden`.
5. SHELL-07: FIXED.
   - It sends a message (assistant visible, >=2 messages) and attaches Request B through the picker (chip visible).
   - After the chord: defaultPrevented is polled true, relay-empty is visible, messages toHaveCount(0), the chip toHaveCount(0), and the composer is focused. The toggle chord then closes the dock.
6. SHELL-09: FIXED. Real themes are set via localStorage + reload, the html class is asserted, and contrast is polled.
7. P2.9 RelayHeader stale-read test: FIXED in substance. It is typed (RelayThread), has no `any`, and uses a deferred promise. Coverage now hits the cancelled arm of the `if` (count 1).
8. P2.9 TabBar "fixed area" test: FIXED.
   - It asserts "+" is inside the scroll area before overflow and outside it after.
   - It checks the "+" is in the same div.shrink-0 as relay-toggle and that exactly one exists.
9. P2.10 EmptyState accessible-name test: FIXED. It asserts aria-hidden="true", size-12 and text-foreground.
10. **Gherkin drift (a3 required fix #3): NOT FIXED** (see P2.12).

## Per-task results
- **P2.1 PASS.**
  - `header.newChatShortcut` is in en/fr/ja relayDock.json, and parity plus brandGuard are green.
  - `logo.label` was dropped by a logged decision (P2.3 Log): no call site needs it. AC "new keys exist ... identical key sets" holds for the keys that ship.
- **P2.2 PASS.** `relayNewChat` and `relayNewChatNote` are in en/fr/ja, and parity is green.
- **P2.3 PASS.**
  - The toggle renders relay-logo with no Sparkles.
  - RelayLogo is aria-hidden without `label`, and gets role=img + aria-label + `<title>` with it.
  - Specs and screenshots are present, and the Log line is there.
- **P2.4 PASS.**
  - The header (no active thread) and the empty state render relay-logo, and OpenInRelayButton uses RelayLogo.
  - There is no Sparkles under relay. Specs and screenshots are present.
- **P2.5 PASS.**
  - RELAY_NEW_CHAT_SHORTCUTS is correct (mac meta+shift+o, other ctrl+shift+o).
  - The capture listener skips code editors and key repeat, and calls preventDefault.
  - `startNewChat` calls setOpen(true) then newThread() with a logged catch, and RelayRoot gates it with `enabled: active`.
  - Specs are green.
- **P2.6 PASS.**
  - getShortcutGroups appends both Relay rows through the shared `toShortcutAlias`.
  - ShortcutsSection shows the noteKey note.
  - Modal unit tests check exact keycaps on both platforms, and SHELL-10 is green.
- **P2.7 PASS.**
  - LeftPanel has no toggle or dynamic import.
  - TabBar uses `dynamic(..., {ssr:false})`, after TabListDropdown and outside `tabs.length > 0`.
  - The TOOLTIP_DELAY_MS constant is used, and specs are green.
- **P2.8 PASS.**
  - The three header buttons are wrapped in Tooltip with HeaderTooltipContent (shared getAliasKeyParts).
  - aria-labels are kept, HEADER_TOOLTIP_DELAY_MS = 500 is documented, and unit tests check exact keycaps for every button.
- **P2.9 PASS (with a report correction).**
  - Lowest figure is 90.47% branches on TabBar.tsx. Its uncovered lines are listed and are defensive guards (null scrollRef at L74/L93, null pendingBulkClose at L100, an always-true check at L273).
    - The builder labels 93-100 as "drag index null", which is wrong: L100 is the `pendingBulkClose` guard.
    - I justified L100 independently. confirmBulkClose is wired only to the AlertDialogAction (L299) of a dialog with `open={!!pendingBulkClose}` (L285), so the guard cannot be reached false from the UI. It is defensive and the justification holds.
    - Not blocking. The builder should correct the label in the next report.
  - RelayHeader is 96%, which is above the justification band.
  - The builder's claim that "v8 reports the L69 `if` as uncovered" is **false**: the `if` is [6,1]. The real uncovered branch is the `thread?.title ?? null` fallback.
    - Non-blocking. Suggested: add a test where getThread resolves null and the title falls back.
  - All required cases are present:
    - chord matcher on both platforms
    - cm/monaco skip
    - opens and starts a new chat when closed
    - disabled no-op
    - collision tests in useKeyboardShortcuts.spec for Meta and Ctrl+Shift+O, asserting defaultPrevented false
    - toggle rendered with 0 tabs and with tabs
    - tooltip on every header button
- **P2.10 FAIL (quality).**
  - Coverage passes: 100 on all four metrics for all four files, 47 tests.
  - Two concrete spec-quality violations fail it; see Code quality. Both are cheap fixes.
- **P2.11 PASS.**
  - 57/57 at x3, check-ids OK.
  - No sidebar-toggle reference remains in e2e (grep).
  - The helper and specs needed no change (engineer report a1).
- **P2.12 FAIL.** 33/33 at x3 green, but two items fail:
  1. **Gherkin out of sync with the spec and AC** (`e2e/scenarios/relay/relay-polish-shell.feature.md`). This was a3 required fix #3 and it was not done.
     - L72-79 (SHELL-05) says "hover over the toggle button", keycaps "Cmd+I on Mac, Ctrl+Shift+L", and "navigate to the toggle button with Tab". The scenario and spec are about the header buttons: new chat (⌘/Ctrl Shift O), close (⌘I / Ctrl Shift L) and the conversations trigger.
     - L138 (SHELL-09) says "WCAG AA contrast requirements (4.5:1)". The task AC (P2.3: ">= 3:1") and the spec (`MIN_CONTRAST_RATIO = 3`) use 3:1.
     - L102 (SHELL-07) says "Then the composer is focused and has an empty value" after sending. The spec types "draft" before the chord and never asserts an empty value. Rewrite it to match: message sent + request chip attached + draft typed, then chord, then empty thread, chip gone, composer focused, default-prevented.
     - L11 (Background) says the route is `/app/relay`, but the spec uses `/app` (WORKSPACE_PATH).
     - L31-32 (SHELL-02) says "loaded with zero open tabs / When the page loads". The spec closes the seeded tabs first. Reword to "Given I close every open tab".
     - Fix: edit the Gherkin to describe exactly what the spec does. Keep the ids, then re-run check-ids.
  2. **SHELL-03 is vacuous** (`e2e/qa/relay/relay-polish-shell.spec.ts:146-167`).
     - It asserts only `toBeVisible()` plus width/height > 0. Playwright's toBeVisible does not check the viewport or clipping.
     - My probe showed a tab scrolled out of the overflow container (x=2930 in a 1280 viewport) still reports visible. So if the toggle moved back into the scrolling area, it would scroll off and this test would still pass.
     - It also never asserts that overflow happened.
     - Fix:
       - Assert overflow, e.g. `expect.poll(() => scrollArea.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)`.
       - Assert the toggle is NOT a descendant of the `.overflow-x-auto` scroll container, or set `scrollLeft = 0` before measuring.
       - Then `await expect(toggle(page)).toBeInViewport()`, plus the SHELL-01 right-edge check (`tabBarRight - toggleRight` within RIGHT_EDGE_TOLERANCE_PX).
       - The right-edge check is what discriminates. The app scrolls to each new tab, so a regressed toggle sitting after the last tab could still be in the viewport. The probe shows the scroll area's right edge at 1184 against the tab bar's 1280, a ~96px miss that the 8px tolerance catches.
       - Replace the literal `20` with a named constant.
- **P2.13 FAIL by dependency.**
  - Every gate command exits 0 (see above).
  - AC 1 holds: no Sparkles, toggle not in the sidebar, dynamic import kept.
  - "Shell specs green" is technically true, but it depends on P2.12, which fails on scenario fidelity.

## Code quality (phase-changed files)
- `src/components/relay/OpenInRelayButton.spec.tsx:119`: "renders text label after the logo" asserts only `textContent` contains "openInRelay", never the order.
  - Fix: assert `logo.compareDocumentPosition(textNode) & Node.DOCUMENT_POSITION_FOLLOWING`, or rename it to "renders the text label".
- `src/components/relay/EmptyState.spec.tsx:186`: the comment "Verify RelayLogo is the only SVG present" does not match the assertion (it only checks the logo exists).
  - Fix: assert that exactly one svg is inside relay-empty's icon slot, or correct the comment.
- Non-blocking, carried from a3:
  - `RelayRoot.tsx` `.catch(() => RelayLoadError)` discards the error object with no log. Consider `console.info("[relay] dock chunk failed to load", { error })`; the console guard only fails on error and warn.
  - `RelayRootChunkFailure.spec.tsx` calls `vi.unstubAllGlobals()` inside the test body instead of afterEach.
- Scope check:
  - These files are outside every task's Files list:
    - `src/components/relay/RelayRoot.tsx`
    - `src/components/relay/RelayLoadError.tsx` (new UI, no design note or screenshot)
    - `RelayLoadError.spec.tsx` and `RelayRootChunkFailure.spec.tsx`
    - `messages/*/relay.json` (`dockLoadError`)
  - They exist to satisfy SHELL-11's error state, and the P2.7 Log records them.
  - Non-blocking, consistent with a3. Recommend adding them to the P2.7 Files/Log formally.
- Clean:
  - RelayHeader.tsx: the HeaderTooltipContent helper and the named delay constant.
  - TabBar.tsx: TOOLTIP_DELAY_MS.
  - settings/constants.ts: toShortcutAlias/toShortcut are shared and DRY.
  - useRelayShortcut.ts: an early return for repeat and editor, and a logged catch.
  - RelayLogo.tsx and RelayLoadError.tsx: tokens only, role=alert, testids.

## Required fixes for the retry
1. Rewrite relay-polish-shell.feature.md, scenarios SHELL-05 (L72-79), SHELL-09 (L138, 3:1), SHELL-07 (L102), Background (L11) and SHELL-02 (L31-32), so each matches the spec. Run check-ids.
2. Strengthen SHELL-03:
   - assert overflow happened
   - `toBeInViewport()`
   - right edge within tolerance
   - a named constant for the tab count
   Re-run `relay-polish-shell.spec.ts --repeat-each=3`.
3. Fix the two unit-spec nits (OpenInRelayButton.spec.tsx:119, EmptyState.spec.tsx:186).
4. Optional: cover the RelayHeader `thread?.title ?? null` fallback, and correct the P2.9 report's L69 explanation.
