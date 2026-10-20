# Phase 2 verifier report (a1): Shell identity — VERDICT: FAIL

Scope loaded via `dashboard.mjs scope` (P2.1-P2.13, L209-423). All commands run from repo root by the verifier.

## Commands run and key output
- biome check (all 26 phase src/messages files): exit 0. NOTE: biome.json excludes `**/*.spec.*`, so every spec file in the Verify lines is ignored ("These paths were provided but ignored") — biome proves nothing for spec files.
- Targeted vitest (parity x2 + 11 P2.1-P2.8 specs): 13 files / 1012 tests passed.
- Greps: Sparkles in RelayToggleButton.tsx none (exit 0); Sparkles under src/components/relay none (exit 0); RelayToggleButton in LeftPanel.tsx none (exit 0); Sparkles in relay+TabBar none (exit 0); `next/dynamic` in TabBar.tsx L4 match, RelayToggleButton dynamic import L36-39, rendered L250 after `TabListDropdown`, outside `tabs.length > 0`.
- Screenshots present: p2-logo-{320-light,1440-dark}, p2-identity-{320-light,1440-dark}, p2-shortcuts-1440-light (only), p2-tabbar-{320-light,1440-dark}, p2-tooltips-{320-light,1440-dark,close-1440-dark}.
- P2.9 coverage (json-summary, lines/branches/functions/statements):
  - TabBar.tsx 89.23 / **64.28** / **78.26** / 85.71  <-- BELOW 80
  - RelayHeader.tsx 100 / 93.1 / 100 / 100
  - RelayToggleButton.tsx, useRelayShortcut.ts, constants.ts 100 across
  - 6 files / 174 tests passed
- P2.10 coverage: RelayLogo, EmptyState, KeyboardShortcutsModal, OpenInRelayButton all 100/100/100/100; 4 files / 48 tests passed.
- happy-dom header present on all component/hook specs.
- grep test.fail|it.fails|.skip|.only|.fixme|waitForTimeout on all phase specs: no matches.
- P2.11: playwright relay-shell + relay-a11y + pills + context-payload --repeat-each=3: 57 passed. check-ids.sh exit 0 (relay-polish-shell 11/11, relay-polish-msg 9/9).
- P2.12: playwright relay-polish-shell --repeat-each=3: 33 passed — BUT the assertions are vacuous (see below), so green is not evidence.
- P2.13 gate: vitest dirs 122 files / 3080 tests passed (exit 0); polish-shell + polish-msg x2: 40 passed; relay-shell + a11y: 11 passed; lint:check exit 0 (724 files); typecheck exit 0; brandGuard 12 passed; both greps OK.

## Per-task results
- P2.1 PASS-ish: `logo.label`, `header.newChatShortcut` in en/fr/ja, parity green, no vendor names. BUT `logo.label` has zero consumers (see P2.3).
- P2.2 PASS: `relayNewChat`, `relayNewChatNote` in en/fr/ja; parity green.
- P2.3 FAIL:
  - Do requires "aria-label from `logo.label` when it is the only content". `RelayLogo` exposes a `label` prop but NO production call site passes it (grep: RelayHeader L152, RelayToggleButton L35, OpenInRelayButton L61, EmptyState L81 — none pass `label`). `logo.label` (all 3 locales) is a dead string. Builder must either use it (and justify vs. the toggle Button's own aria-label — toggle reads the `relay` namespace, key lives in lazy `relayDock`) or remove the key + record the decision.
  - No `**Log**` design line in TASKS.md (Conventions: verifier rejects a UI task without it; Phase 1 tasks have them at L86/L103). Builder report has one combined line that does not name what each skill changed per task.
- P2.4 FAIL: no Log line. Also vacuous absence tests: `EmptyState.spec.tsx:183-189` and `OpenInRelayButton.spec.tsx:109-113` assert `sparkles-icon` testid absent — that testid exists nowhere in src, so they can never fail; EmptyState's "Only the RelayLogo SVG should be present" asserts `svgs.length > 0`. Fix: assert no `svg.lucide-sparkles` / every svg in the element has `data-testid="relay-logo"`.
- P2.5 FAIL (Log only): code correct (toggle/new-chat branches, capture phase, cm/monaco skip, preventDefault, `enabled` false on `/` via RelayRoot L73-75, setOpen bumps focusRequest, newThread clears attachedItems). Missing Design Log line.
- P2.6 FAIL: no Log line. Screenshot set `p2-shortcuts-*` only 1440-light (Conventions ask 1440 + 320, light + dark).
- P2.7 FAIL (Log only): LeftPanel import removed; TabBar dynamic ssr:false; placement correct. Missing Log line.
- P2.8 FAIL: no Log line. Quality: `src/components/relay/RelayHeader.tsx:38-44` `chordKeyParts` duplicates `chordParts` in `src/lib/shortcutFormat.ts:19-26` and hard-codes `"Shift"` (SHIFT_LABEL exists there). Fix: convert the chord with the same `toShortcut` used in `src/app/settings/constants.ts` (export it) and call `getShortcutKeyParts`, or render `ShortcutKeys`, so tooltip and dialog keycaps cannot drift (P2.6 AC "matching the tooltip" depends on this).
- P2.9 FAIL: TabBar.tsx branches 64.28%, functions 78.26% < 80% floor. Engineer report labels it "ACCEPTABLE" — not allowed. Justification for L234 ("would require CSS overflow simulation") is wrong: stub `scrollWidth`/`clientWidth` + ResizeObserver callback in happy-dom to hit `isOverflowing` new-tab button. Also the added test "shows new tab button when not overflowing" contradicts source (button only renders when `isOverflowing`). Raise TabBar to >=80% on all four metrics.
- P2.10 FAIL: coverage 100% but tests weak: `KeyboardShortcutsModal.spec.tsx` Mac test asserts only `keycaps.length > 0` (must assert `["⌘","Shift","O"]`); the first two added Windows tests are identical (duplicate); "does not render Sparkles icon in the modal" uses nonexistent `sparkles-icon` testid (vacuous).
- P2.11 PASS: 57/57 x3 clean; no files needed changing; no sidebar-toggle reference in e2e (only `sidebar-settings-btn` as a focus anchor); check-ids OK.
- P2.12 FAIL — spec `e2e/qa/relay/relay-polish-shell.spec.ts` passes but does not prove its scenarios:
  - No per-test priority tags anywhere (grep @critical|@high|@medium in spec: 0). AC requires `@qa` plus priority tag per test.
  - SHELL-01 (L28-58): never compares with the chevron or the left sidebar; `tabListChevron` and `leftPanel` helpers are unused. Fix: assert toggle.x > chevron.x+width and toggle not inside the sidebar element.
  - SHELL-02 (L60-83): never reaches zero tabs and never opens a tab; compares two identical states. Fix: close all tabs (assert tab count 0), measure, open a tab, measure, compare.
  - SHELL-03 (L85-110): `.click(...).catch(() => {})` swallows failures; overflow never asserted. Fix: create tabs via a reliable path, assert overflow (e.g. `new-tab-btn` visible / scrollWidth > clientWidth), then toggle in viewport.
  - SHELL-04 (L112-139): reloads only in the closed default state; persistence of open never proven. Fix: open, reload, assert dock visible + aria-expanded=true.
  - SHELL-05 (L141-183): hovers the tab-bar toggle, not the header buttons; try/catch fallback matches `/Relay/i` on aria-label so it always passes; Esc dismissal never asserted; regex expects "Cmd+I" text whereas Kbd renders separate caps. Fix: for relay-thread-trigger, relay-new-thread, relay-close: hover and Tab-focus, assert tooltip visible with expected kbd caps (["⌘"/"Ctrl","Shift","O"] for new chat, toggle chord for close), press Escape and assert hidden. Note `HEADER_TOOLTIP_DELAY_MS = 700` cannot satisfy a strict "<700 ms" — builder must choose tolerance or shorter delay.
  - SHELL-07 (L217-269): presses the TOGGLE chord (`Meta+i`/`Control+Shift+l`), never Shift+Mod+O. New thread, composer focus after chord, attachments cleared are not asserted. Fix: attach a chip/type text, press `ControlOrMeta+Shift+O` in composer, assert defaultPrevented, empty composer focused, attachments gone, new/empty thread; then toggle chord closes dock.
  - SHELL-08 (L271-290): only the toggle chord; also press the new-chat chord.
  - SHELL-09 (L292-334): contrast only `color` truthy (no ratio vs background); empty-state logo never asserted (`emptyStateLogo` unused; count>=2 satisfied by toggle+header). Fix: compute contrast ratio >= 3:1 vs computed background in light and dark; assert `relay-empty` contains `relay-logo`.
  - SHELL-10 (L336-360): `.catch` around dialog visibility; assertion inside `if (count > 0)` so it can pass with no entry; regex checks toggle chord. Fix: open dialog deterministically, assert "New Relay chat" row visible with platform kbd caps.
  - SHELL-11 (L362-383): route `**/relay/**chunk**` likely matches no Next chunk URL; nothing asserted after click. Fix: abort the actual dock chunk request (match the dynamic chunk URL) and assert an error state is visible and no page error.
  - Spec hygiene: unused imports `closeRelay`, `pressRelayShortcut` (L3,L5); unused `leftPanel` (L21), `emptyStateLogo` (L310); `tabListChevron` (L19-20) uses `||` on locators so the second branch is dead.
- P2.13 FAIL by dependency (all its own commands exit 0, but P2.3-P2.10, P2.12 fail; "shell specs green" is not meaningful while P2.12 is vacuous).

## Required fixes (summary)
1. Add Design **Log** lines to P2.3, P2.4, P2.5, P2.6, P2.7, P2.8 in TASKS.md naming what ui-ux-pro-max, impeccable and layout each changed.
2. Resolve `logo.label` (use it or drop it, with a recorded decision).
3. Reuse `shortcutFormat` in RelayHeader instead of `chordKeyParts`.
4. TabBar.tsx unit coverage >= 80% branches and functions.
5. Strengthen P2.10 Mac keycap test, drop duplicate test, fix vacuous Sparkles-absence tests.
6. Rewrite P2.12 tests per the list above, add priority tags, remove unused helpers/imports; re-run --repeat-each=3.
7. (Secondary) add p2-shortcuts 320 + dark screenshots.
