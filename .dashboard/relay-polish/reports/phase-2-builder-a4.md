# Phase 2 builder a4

## P2.9
- TabBar.spec.tsx: "moves the new tab button from the scroll area to the fixed actions when overflowing" now asserts the single "+" is inside the scroll area before overflow, outside it after, and in the same `div.shrink-0` as `relay-toggle`. Mutation check: forcing the inline "+" always makes it fail.
- RelayHeader.spec.tsx: stale-read test rewritten (typed `RelayThread`, no `any`, deferred promise for t1, `act`). Mutation check: removing `if (!cancelled)` fails it ("Stale Title"). v8 still reports L69 branch as uncovered for this single-line `if` without else; the behavior is proven by the mutation, not by the coverage number (96% branch).
- Other items from the earlier list (vacuous asserts, magic 400 -> TOOLTIP_DELAY_MS) were already fixed in a3.
- Verify command: 6 files / 191 tests pass. TabBar.tsx 95.77/90.47/100/100, uncovered 74, 93-100 (defensive ref guards: scrollRef null / drag index null), 273 (always-true branch inside the dialog). RelayHeader 100/96/100/100, uncovered 69 (see above).

## P2.10
- EmptyState test already asserts `aria-hidden="true"` (logo sits next to text). Verify: 47 tests, 100/100/100/100 for all four files.

## P2.12 (relay-polish-shell.spec.ts)
- Root cause of SHELL-02 never reaching zero: `getByRole("tablist")` matched the sidebar tablist (Collections/History/API Hub). Now `tabBar.getByTestId("tab")`; the test closes all seeded tabs, asserts count 0, toggle right edge near tab-bar right edge, opens one tab, asserts toggle x delta <= 1px.
- 0 `waitForTimeout`. SHELL-11 now waits on `relay-dock-error` then `expect.poll(() => chunkAborted)`.
- SHELL-01 asserts chevron, sidebar and tab-bar right-edge alignment.
- SHELL-05: all three header buttons (new chat, close, thread trigger), hover and Shift+Tab focus legs, <700ms, exact keycaps scoped to the tooltip, Esc dismisses (open tooltip count 0). Finding: Relay's two-step Esc (first hands focus out, second closes the dock), so each leg re-enters the dock via the composer first.
- SHELL-07: sends a message, attaches Request B via the picker, types a draft, presses chord; asserts defaultPrevented via page listener, relay-empty visible, 0 messages, attached chip gone, composer focused; then the toggle chord closes the dock.
- SHELL-09: real light and dark via next-themes `localStorage.theme` + reload (class removal gets re-added by next-themes); contrast polled to avoid the colour transition.
- Run: `relay-polish-shell.spec.ts --repeat-each=3`: 33 passed. check-ids OK. tsc exit 0.

DECISIONS
- Used localStorage theme + reload for SHELL-09 instead of toggling the html class.
