# Phase 2 verifier report (a2): Shell identity — VERDICT: FAIL

Scope loaded via `node ~/.claude/scripts/dashboard.mjs scope agent_docs/relay-polish/TASKS.md "phase 2"` (P2.1-P2.13 L217-425, Checkpoint 2 L426). Every command below was run by the verifier from the repo root. Scratch probes live in the session scratchpad (probe.cjs, probe7.cjs, probe7b.cjs); no repo files were modified.

## Commands run and key output
- biome check on all 18 non-spec phase files (messages x6 + 12 src): exit 0 ("Checked 18 files"). biome.json ignores `*.spec.*`, so spec files get no lint.
- vitest (2 parity specs + 11 specs named by P2.3-P2.8 Verify): 13 files, 1027 tests passed.
- Greps: Sparkles in RelayToggleButton.tsx none (exit 0); Sparkles under src/components/relay none (exit 0); RelayToggleButton in LeftPanel.tsx none (exit 0); Sparkles in relay + TabBar none (exit 0); `next/dynamic` at TabBar.tsx:4.
- Screenshots: p2-logo-{320-light,1440-dark}, p2-identity-{320-light,1440-dark}, p2-shortcuts-{320,1440}-{light,dark} (4, fixed), p2-tabbar-{320-light,1440-dark}, p2-tooltips-{320-light,1440-dark,close-1440-dark}.
- P2.9 coverage (json-summary, lines/branches/functions/statements), 6 files / 192 tests passed:
  - TabBar.tsx 98.46 / 85.71 / 95.65 / 94.28 (was 64.28 branches, now >= 80: fixed)
  - RelayHeader.tsx 100 / 92 / 100 / 100 (uncovered branch L69)
  - RelayToggleButton.tsx, useRelayShortcut.ts, constants.ts 100 across
- P2.10 coverage: RelayLogo, EmptyState, KeyboardShortcutsModal, OpenInRelayButton 100/100/100/100; 4 files / 47 tests passed.
- grep `test.fail|it.fails|.skip|.only|.fixme` over all 13 phase unit specs + relay-polish-shell/relay-shell/relay-a11y e2e specs: no match (exit 1). The a2b-era `test.fail()` on SHELL-09 is gone.
- P2.11: playwright relay-shell + relay-a11y + improvements-pills + improvements-context-payload --repeat-each=3: 57 passed. check-ids.sh: "OK: scenario IDs consistent", exit 0.
- P2.12: playwright relay-polish-shell --repeat-each=3: 33 passed. Green, but several tests do not prove their scenarios (see P2.12).
- P2.13 gate: vitest relay/layout/settings/hooks/lib-relay/app-settings/i18n exit 0, 122 files / 3095 tests; polish-shell + polish-msg --repeat-each=2: 40 passed; relay-shell + relay-a11y: 11 passed; check-ids exit 0; lint:check exit 0 (724 files); typecheck exit 0; brandGuard 12 passed; both greps OK.
- Browser probe (Playwright library, seeded via e2e/fixtures/qa-seed.init.js, server :3000):
  - `document.documentElement.className` at load = "motion-safe:scroll-smooth dark" with prefers-color-scheme: dark = false. The seeded app loads in DARK.
  - `page.route("**/relay/**chunk**")`: 0 hits when the dock opens. The real dock chunk URL is `/_next/static/chunks/12c8d_react_requestly_src_components_relay_RelayDockWithMessages_tsx_9f30e8f1._.js`.
  - Header tooltip: `[role="tooltip"]` count 0, `[data-slot="tooltip-content"]` count 1, visible about 797 ms after hover, kbd = ["⌘","Shift","O"], gone after Escape.
  - Contrast (glyph vs first opaque ancestor): forced light: toggle 18.1, header 19.9, empty 19.9. Dark: toggle 14.27, header 19.06, empty 19.06. So the app meets >= 3:1 in both themes, and the EmptyState `text-foreground` fix is correct.
  - Meta+Shift+O in the composer (Mac): defaultPrevented true, composer still focused, typed draft "hello world" kept. Clicking the header New chat button also keeps the draft, so that matches existing behaviour and is not a phase regression.

## Prior a1 findings: status
1. Log lines P2.3-P2.8: FIXED. Each names what ui-ux-pro-max, impeccable and layout changed.
2. logo.label: FIXED (dropped from en/fr/ja; decision recorded in the P2.3 Log; `label` prop kept on RelayLogo, which satisfies the "accessible name only when sole content" contract and is unit-tested).
3. chordKeyParts duplication: FIXED. RelayHeader uses `getAliasKeyParts(toShortcutAlias(chord), isMac())`; `toShortcutAlias` is exported from src/app/settings/constants.ts and also used by the dialog/settings path.
4. P2.6 screenshots: FIXED (320/1440 x light/dark).
5. TabBar coverage: FIXED (85.71 branches, 95.65 functions).
6. Non-vacuous Sparkles-absence tests: FIXED. They now query `svg.lucide-sparkles`; lucide-react 0.577 emits `lucide-${kebab}` classes (createLucideIcon.js:20-21), so the tests would fail if Sparkles rendered.
7. Exact Mac keycaps: FIXED. KeyboardShortcutsModal.spec asserts ["⌘","Shift","O"]; the duplicate Windows test was removed.
8. P2.12 real assertions/tags: PARTIAL. Tags fixed (11/11) and SHELL-03/04/08 fixed. SHELL-01, 02, 05, 07, 09, 10, 11 are still vacuous or unsound, and there are 11 waitForTimeout calls (details below).
9. Unused helpers: PARTIAL. closeRelay, pressRelayShortcut, leftPanel and emptyStateLogo were removed, but `isOnMac` is still unused in SHELL-05 (L191-193).

## Per-task results
- P2.1 PASS: `header.newChatShortcut` in en/fr/ja (used by RelayHeader L172); parity specs green; brandGuard green. `logo.label` was removed by a recorded decision.
- P2.2 PASS: `relayNewChat` and `relayNewChatNote` in en/fr/ja; parity green.
- P2.3 PASS: toggle renders relay-logo; no Sparkles; aria-expanded, testid and flag gate are unchanged; Log present; screenshots present. Browser contrast confirmed >= 3:1 by the verifier probe, not by the spec (see P2.12).
- P2.4 PASS: header (no thread) and empty state render relay-logo; no Sparkles under relay; EmptyState logo is `size-12 text-foreground`; specs green; Log present.
- P2.5 PASS: RELAY_NEW_CHAT_SHORTCUTS mac/other; capture listener; cm/monaco skip; preventDefault; startNewChat = setOpen(true) + newThread() with a logged catch; unit specs cover closed->open, textarea, code editor, disabled, no-Shift.
- P2.6 PASS: dialog + Settings list "New Relay chat" with exact caps (unit-asserted on both platforms); Firefox note shown in Settings (`shortcut-note`); screenshots x4. Observation: at a 320px viewport the Settings page clips the keycap column for every row. This also happens on the existing Toggle Relay row, so it is not a phase regression.
- P2.7 PASS: LeftPanel import removed; TabBar `dynamic(..., {ssr:false})` L36-42; rendered L249-251 after `TabListDropdown`, outside `tabs.length > 0`; specs green.
- P2.8 PASS: thread trigger, new chat and close are each wrapped in a Tooltip (delay 700), keycaps via shared shortcutFormat; RelayHeader.spec asserts label + exact caps per button and Mac caps; aria-labels kept.
- P2.9 FAIL (minor):
  - RelayHeader.tsx is 92% branches with uncovered L69 (`if (!cancelled)` in useActiveThreadTitle). It is not listed or justified in P2.9-unit-a2.md, which still quotes the a1 figure 93.1. The 80-94 band needs listed and justified lines. Fix: add a test that unmounts or changes activeThreadId before getThread resolves, or list and justify L69.
  - P2.9-unit-a2.md says a test "exercises line 284" (onOpenChange) and also says L284 is uncovered. The coverage table confirms L284 is uncovered, so remove the contradictory claim.
  - src/components/layout/TabBar.spec.tsx:249-284: the test "shows new tab button only in fixed area when overflowing" asserts `length >= 1` and never checks location or uniqueness. Fix: assert exactly one `new-tab-btn` and that it sits in the fixed right block (for example its closest `.shrink-0` container also holds `relay-toggle`).
- P2.10 FAIL (minor quality): src/components/relay/EmptyState.spec.tsx, the test "renders the RelayLogo with accessible name for screen readers", asserts only `size-12`/`text-foreground` classes, and the EmptyState logo is in fact aria-hidden. Fix: rename it (for example "renders the large decorative logo in the foreground colour") and assert `aria-hidden="true"`. Coverage itself is 100/100/100/100.
- P2.11 PASS: 57/57 x3 clean, check-ids OK, no sidebar-toggle reference in e2e specs/helpers.
- P2.12 FAIL: e2e/qa/relay/relay-polish-shell.spec.ts passes 33/33 x3 but does not prove these scenarios:
  - AC "no waitForTimeout": 11 occurrences (L70, 92, 120, 199, 215, 221, 229, 297, 302, 433, 518). Replace them with web-first assertions (`toHaveCount`, `toBeVisible`, `toBeHidden`, `expect.poll`).
  - SHELL-01 (L22-51): never measures the tab-list chevron or the left sidebar, though the Gherkin (feature L22-23) promises both. The chevron only renders with >= 1 tab. Fix: open a tab, assert `toggle.x >= chevron.x + chevron.width` (chevron = TabListDropdown trigger), and assert the toggle is not a descendant of the left panel (and that the left panel has no relay-toggle).
  - SHELL-02 (L53-108): zero tabs is never asserted (`toBeGreaterThanOrEqual(0)` at L81 is vacuous). The close loop's guard at L73 (`tabCount === await tabs.count()`) is always true, so it breaks after one iteration. Fix: close tabs until `await expect(tabs).toHaveCount(0)`, measure, open one tab, `toHaveCount(1)`, then compare x.
  - SHELL-05 (L179-231): the locator `[role='tooltip'], [data-radix-popover-content]` matches nothing (verifier probe: role=tooltip count 0; the app renders `[data-slot="tooltip-content"]`). The try/catch at L203-211 therefore always takes the fallback, which only checks aria-label. Keycaps, Esc dismissal, keyboard-focus tooltip and relay-thread-trigger are never asserted, and `isOnMac` is unused. Fix: for relay-thread-trigger, relay-new-thread and relay-close, hover and expect `[data-slot="tooltip-content"]` visible with the exact kbd caps (["⌘"|"Ctrl","Shift","O"] for new chat, the toggle chord for close). Then press Escape and expect it hidden. Repeat via keyboard Tab focus. Pick and document a tolerance for "within 700 ms": the delay is exactly 700, and the probe measured about 797 ms to visible.
  - SHELL-07 (L263-329): only defaultPrevented, composer focus and dock visibility are asserted. Nothing shows a new chat started or attachments cleared. "test message" is typed and never checked, and `evaluateHandle` is used for a side effect (leaked handle; use `evaluate`). Fix: attach a context chip (or open a thread with a message) before the chord, then assert the chips are gone and the thread/message list is empty (e.g. `relay-empty` visible / title back to default) after `ControlOrMeta+Shift+O`.
  - SHELL-09 (L361-449): the "Light theme" half never runs in light. The seeded app loads with `<html class="... dark">` (probe; snaps 01-03 "-light" are visibly dark). The "dark" step then adds `dark` to an already-dark page, so both halves measure dark. Fix: set light explicitly first (`page.emulateMedia({ colorScheme: "light" })` plus seeding the theme preference, or remove the `dark` class and assert `html` lacks it), measure, then switch to dark and assert `html` has `dark` before measuring. The canvas-normalising contrast helper itself is sound: the probe reproduced 14-20:1 with the same algorithm, and the EmptyState `text-foreground` fix is real.
  - SHELL-10 (L451-491): keycaps are matched against the whole dialog text (`dialogText` contains ⌘/Shift/O). Other rows already contain ⌘ and Shift, so this cannot fail. Fix: scope to the "New Relay chat" row and assert its `kbd` texts equal ["⌘","Shift","O"] / ["Ctrl","Shift","O"].
  - SHELL-11 (L493-535): `page.route("**/relay/**chunk**")` matches 0 requests (probe), so nothing is aborted and no error state is asserted. Fix: route `**/*RelayDock*` (or `**/_next/static/chunks/**relay_RelayDock**`) before the first toggle click, assert the route was hit, and assert a visible error state. If the app lacks one, that is an app bug: report it per the test rules instead of passing. The local consoleErrors filter duplicates the auto console guard.
  - P2.12-e2e-a2b.md is stale or inaccurate. It claims SHELL-01 checks "not inside sidebar" and "No waitForTimeout without purpose", and still describes SHELL-09 as test.fail().
- P2.13 FAIL by dependency: every gate command exits 0 (listed above), but "shell specs green" means nothing while P2.12 scenarios 01/02/05/07/09/10/11 are vacuous, and P2.9/P2.10 have open items.

## Required fixes
1. Rewrite P2.12 SHELL-01, 02, 05, 07, 09 (real light mode), 10 (row-scoped caps) and 11 (real chunk abort + error state) as above; remove all 11 waitForTimeout calls and unused `isOnMac`; re-run --repeat-each=3.
2. P2.9: justify or cover RelayHeader.tsx L69; fix the TabBar "only in fixed area" test; correct the report's L284 contradiction.
3. P2.10: fix the misnamed EmptyState "accessible name" test.

## Addendum (follow-up checks after first draft)
- P2.11 focus-order: relay-a11y.spec.ts and relayE2eHelpers.ts are unmodified. grep shows relay-a11y has no toggle focus-order assertion: it clicks `relay-toggle` (L199) and tabs backwards from the composer (L51-56, L166-168), and neither depends on where the toggle sits. `sidebar-settings-btn` appears only in relay-shell.spec.ts L50/L77, as a "focus returns to the previous element" anchor, and that check doesn't depend on position either. So there was nothing to migrate, and the P2.11 PASS holds.
- P2.6 Files: KeyboardShortcutsModal.tsx is unmodified. The dialog gets the "New Relay chat" row from the shared `getShortcutGroups(onMac)` (src/app/settings/constants.ts), and KeyboardShortcutsModal.spec proves it with exact caps on both platforms. That is acceptable.
- P2.9 TabBar zero-hit branches (json coverage `branchMap`, verifier run): L72 `if (!el) return` (checkOverflow), L91 `if (!el) return` (ResizeObserver effect), L98 `if (!pendingBulkClose) return` (confirmBulkClose), L284 both arms of `!open && setPendingBulkClose(null)` plus its arrow fn (onOpenChange). Only L284 is listed in P2.9-unit-a2.md. L72/L91/L98 must be listed and justified, or covered. RelayHeader: L69 `if (!cancelled)` false arm (unjustified, see above).
- P2.9 vacuous tests added to src/components/layout/TabBar.spec.tsx (padding, not proof):
  - L508-527 "renders drop indicator when dragging over a tab": `expect(indicators.length).toBeGreaterThanOrEqual(0)` can never fail. Assert the indicator exists (`> 0`, or the exact element) after dragOver.
  - L529-535 "early returns in checkOverflow when ref is null": a normal render never makes the ref null, and coverage confirms L72's early return stays at 0 hits. Delete it, or justify L72 in the report.
  - L552-584 "closes bulk-close dialog via onOpenChange when Escape is pressed": the test sets `pendingBulkClose: null` itself (L577) and then asserts the dialog is gone, so it proves nothing about onOpenChange (L284 is still 0 hits). Either trigger the real close path (e.g. the dialog's Cancel button, which goes through onOpenChange) and assert the store, or delete it and justify L284.
- Quality: src/components/layout/TabBar.tsx:249 adds a third `TooltipProvider delay={400}` in the same file (L197, L227, L249). That is a magic number repeated three times, and the project DRY rule says extraction is mandatory at three. Fix: a named constant (e.g. `TAB_BAR_TOOLTIP_DELAY_MS = 400`) used at all three sites.
