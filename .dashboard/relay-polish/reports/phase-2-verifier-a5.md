# Phase 2 verifier report (a5): Shell identity — VERDICT: FAIL (P2.12 Gherkin fidelity; P2.13 by dependency)

Scope came from `node ~/.claude/scripts/dashboard.mjs scope agent_docs/relay-polish/TASKS.md "phase 2"`: P2.1-P2.13 at L217-425, plus Checkpoint 2 at L426. I ran every command myself from the repo root. The only repo file I wrote is this report. A temporary mutation of TabBar.tsx was made for the SHELL-03 probe and restored byte-for-byte (shasum OK).

Files changed since the a4 report (find -newer): relay-polish-shell.spec.ts, relay-polish-shell.feature.md, OpenInRelayButton.spec.tsx, EmptyState.spec.tsx (plus TabBar.tsx, touched only by my restore).

## Commands run (key output)
- biome check on all 23 non-spec phase files (messages x9, src, RelayRoot/RelayLoadError, polish-shell spec): "Checked 23 files. No fixes applied."
- vitest P2.1-P2.8 Verify specs + parity + brandGuard (14 files): 1040 passed, exit 0.
- Greps (all exit 0): no Sparkles in RelayToggleButton.tsx; none under src/components/relay; none in relay + TabBar.tsx; no RelayToggleButton in LeftPanel.tsx; `next/dynamic` at TabBar.tsx:4.
- Screenshots present: p2-logo x2, p2-identity x2, p2-shortcuts x4, p2-tabbar x2, p2-tooltips x3.
- Banned markers (test.fail|it.fails|.skip|.only|.fixme|waitForTimeout) across all phase unit specs + relay-polish-shell, relay-shell, relay-a11y: no matches (grep exit 1).
- P2.9 coverage (Verify command verbatim, plus json-summary): 6 files / 191 passed.
  - lines/branches/functions/statements: TabBar.tsx 100/90.47/100/95.77 (uncovered 74, 93-100, 273, justified in P2.9-unit-a3.md as defensive null-ref/always-true guards; a4 independently justified L100); RelayHeader.tsx 100/96/100/100 (L69 `?? null`); constants.ts, useRelayShortcut.ts, RelayToggleButton.tsx 100 on all four.
- P2.10 coverage (Verify command verbatim): 4 files / 47 passed; RelayLogo, EmptyState, KeyboardShortcutsModal, OpenInRelayButton all 100/100/100/100.
- P2.11: relay-shell + relay-a11y + improvements-pills + improvements-context-payload `--repeat-each=3`: 57 passed (47.8s), exit 0. check-ids.sh: "OK: scenario IDs consistent". No sidebar-toggle reference in e2e outside the polish-shell Gherkin "not visible in the left sidebar" line.
- P2.12: relay-polish-shell `--repeat-each=3`: 33 passed (25.9s), exit 0, no flaky. check-ids: relay-polish-shell feature ids 11 / test ids 11.
- P2.13 gate (every command exit 0):
  - scoped vitest: 124 files / 3099 passed
  - polish-shell + polish-msg `--repeat-each=2`: 40 passed
  - relay-shell + relay-a11y: 11 passed
  - check-ids OK; `bun run lint:check` 725 files clean; `bun run typecheck` (tsc --noEmit) clean; brandGuard 12 passed
  - both greps OK
- i18n: relayDock `header.newChatShortcut` en/fr/ja (used at RelayHeader.tsx:172); shortcuts `relayNewChat` + `relayNewChatNote` en/fr/ja; relay `dockLoadError` en/fr/ja.

## SHELL-03 mutation probe
- Backed up TabBar.tsx, moved `<TooltipProvider><RelayToggleButton/></TooltipProvider>` from the fixed `div.shrink-0` into the `.overflow-x-auto` scroll strip, ran `relay-polish-shell.spec.ts --grep SHELL-03`.
- Result: 1 failed, `expect(insideScrollArea).toBe(false)` — Expected false, Received true. The test now discriminates.
- Restored from backup; `shasum -c` on the pre-mutation hash: "TabBar.tsx: OK". The gate e2e run after the restore was 40/40 green.

## a4 FAIL items: status
1. Gherkin mismatch (relay-polish-shell.feature.md): the five lines a4 named are FIXED (Background `/app`; SHELL-02 "Given I close every open tab"; SHELL-05 three header buttons, hover + Shift+Tab, per-button keycaps; SHELL-07 message + Request B chip + "draft" then chord; SHELL-09 3:1). **But the same class of defect remains in other scenarios — NOT fully fixed** (see P2.12 below).
2. SHELL-03 weak assertions: FIXED. OVERFLOW_TAB_COUNT constant, overflow polled (scrollWidth > clientWidth), `closest(".overflow-x-auto")` is null, toBeInViewport, right-edge gap 0..RIGHT_EDGE_TOLERANCE_PX. Mutation-proven (above).
3. OpenInRelayButton.spec.tsx:119: FIXED. Finds the bare text node and asserts `logo.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING`.
4. EmptyState.spec.tsx:186: FIXED. The comment no longer claims "only SVG"; it says the logo replaces the sparkle glyph, matching the assertions.

## Per-task results
- P2.1 PASS — newChatShortcut in en/fr/ja, parity + brandGuard green; `logo.label` dropped by logged decision (P2.3 Log), as accepted by a3/a4.
- P2.2 PASS — relayNewChat + relayNewChatNote en/fr/ja, parity green.
- P2.3 PASS — specs green, no Sparkles, screenshots + Log present.
- P2.4 PASS — specs green (incl. both a4 fixes), no Sparkles under relay, screenshots present.
- P2.5 PASS — constants + useRelayShortcut specs green, 100% coverage.
- P2.6 PASS — modal, ShortcutsSection, settings constants specs green; SHELL-10 green; screenshots present.
- P2.7 PASS — LeftPanel has no toggle/dynamic import; TabBar dynamic ssr:false after TabListDropdown, outside tabs.length>0; specs green.
- P2.8 PASS — RelayHeader spec green; screenshots present.
- P2.9 PASS — lowest 90.47% branches (TabBar.tsx), uncovered lines listed and justified.
- P2.10 PASS — 100% on all four files, 47 tests; a4 quality items fixed.
- P2.11 PASS — 57/57 x3, check-ids OK.
- **P2.12 FAIL** — 33/33 x3 green and SHELL-03 now strong, but the Gherkin still does not describe what the spec does (a4 required "describe exactly what the spec does"):
  1. SHELL-06, feature L91: "And the accessible names are descriptive (not empty or "button")". The spec (L278-290) only asserts that aria-label || title || textContent is non-empty after trim; it never rejects "button". Overclaimed assertion, same class as a4's SHELL-07 "empty value" item.
     Fix (either): delete L91 and change L90 to "Then every button in the dock header has a non-empty aria-label, title or text"; OR add `expect(name.toLowerCase()).not.toBe("button")` to the spec and re-run `relay-polish-shell.spec.ts --repeat-each=3`.
  2. SHELL-04, feature L58-62: Gherkin closes the dock, then "When I reload the page / Then the dock state is restored". The spec (L206-216) reopens the dock before reloading and asserts dock visible + aria-expanded "true" after reload.
     Fix: after L60 add "When I click the toggle button to open the dock again"; change L61-62 to "And I reload the page / Then the dock is still open and aria-expanded is "true"".
  3. SHELL-11, feature L160-164: "When the page loads / Then ... the dock shows an error state". The spec (L512-526) loads, sees the toggle, clicks it to trigger the dock chunk, then asserts relay-dock-error visible, toggle still visible, and the aborted chunk was requested.
     Fix: "Given the Relay dock chunk request is aborted / When I load `/app` / Then the toggle is visible / When I click the toggle / Then the dock shows an error message (relay-dock-error) / And the toggle is still visible / And the dock chunk request was attempted and aborted".
  4. SHELL-01, feature L19: "When the page loads". The spec (L71-74) opens a new tab first so the tab-list chevron renders.
     Fix: "When the page loads and I open a new tab via the create button (so the tab-list chevron shows)".
  5. "the chat route" (feature L54, L70, L87, L99, L133, L149) is undefined and conflicts with the Background (`/app`); every such spec test goes to WORKSPACE_PATH `/app`.
     Fix: delete those "Given the app is loaded at the chat route" lines (the Background covers it) or replace with "at the workspace route `/app`".
  6. SHELL-10, feature L150: "When I open the shortcuts dialog (via settings or help)". The spec (L471-475) opens it with Ctrl/Cmd+/.
     Fix: "When I press Ctrl+/ (Cmd+/ on Mac) to open the keyboard shortcuts dialog".
  After editing, run `bash e2e/scenarios/relay/check-ids.sh` (ids must stay 11/11). If the spec is changed for item 1, re-run `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-shell.spec.ts --repeat-each=3`.
- **P2.13 FAIL by dependency** — every gate command exits 0 and AC 1 holds (no Sparkles, toggle not in sidebar, dynamic import kept); fails only because P2.12 fails.

## Code quality
- No new violations in the files changed since a4. The SHELL-03 rewrite uses named constants and web-first assertions; the two unit-spec edits are correct.
- Prior non-blocking items carried unchanged (already ruled on by a3/a4): RelayRoot `.catch(() => RelayLoadError)` discards the error without a log; RelayRoot/RelayLoadError/relay.json changes sit outside the P2.7 Files list (recorded in the P2.7 Log); TabBar L100 mislabel in the P2.9 report; RelayHeader `thread?.title ?? null` fallback uncovered (96%, above the band).

## Required fixes for the retry
1. Rewrite relay-polish-shell.feature.md items 1-6 above (SHELL-01, -04, -06, -10, -11 and the "chat route" lines), then run check-ids.sh.
2. Only if SHELL-06 is strengthened in the spec instead of the Gherkin: re-run relay-polish-shell `--repeat-each=3`.
