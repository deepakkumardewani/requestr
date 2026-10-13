# Coverage audit: Request tabs + Opened-tabs dropdown

## 1) Files inspected
Source: src/components/layout/{TabBar,Tab,TabContextMenu,TabListDropdown,MainLayout}.tsx, src/stores/useTabsStore.ts, src/hooks/useCloseTabGuard.ts, src/hooks/useKeyboardShortcuts.ts, src/components/collections/RequestItem.tsx (sidebar open/dedupe).
Specs: src/stores/useTabsStore.spec.ts, src/components/layout/{TabBar,TabContextMenu,MainLayout}.spec.tsx, src/hooks/{useCloseTabGuard,useKeyboardShortcuts}.spec.ts, e2e/tabs.spec.ts, e2e/scenarios/tabs.feature.md.
Confirmed: **TabListDropdown.tsx has NO spec file** (and TabListDropdown is not rendered-tested in TabBar.spec either; TabBar.spec never opens the popover). Tab.tsx has no spec of its own (only indirectly via TabBar.spec). RequestBreadcrumb.tsx not tab-behavior related (not covered here).

Code facts that shape the audit:
- Tab types with icons in Tab.tsx: http (Globe), graphql (Braces), websocket (ArrowLeftRight), socketio (Zap). **No chain/env tab type exists** in the tab store/bar.
- NOT implemented in code (so nothing to test, but note vs. expected UX): middle-click close, "Close to the right", reopen closed tab, preview/italic tab, dropdown arrow-key navigation (rows are tabIndex=0 with Enter/Space only), scroll-active-tab-into-view on select (only scrolls to end when tab count grows).
- Sidebar dedupe: RequestItem finds existing tab by requestId and activates it, else openTab.
- Persistence: persistTabs on open/close/reorder/label; updateTabState (dirty edits) is NOT persisted; hydrate activates tabs[0], not last-active.

## 2) Coverage matrix
| Behavior | Unit | E2E | Notes |
|---|---|---|---|
| openTab http/graphql/ws/socketio defaults, becomes active | useTabsStore.spec: "opens HTTP tab and sets active", "opens GraphQL tab with defaults", "opens WebSocket tab with wss default URL", "opens Socket.IO tab" | e2e "open a new tab" | OK. E2E asserts active via CSS class `span.bg-method-accent` (brittle) |
| "+" button opens tab | TabBar.spec "new tab button opens an additional tab when not overflowing" | e2e "open a new tab" (falls back to Ctrl+T if button hidden) | Overflow variant of "+" (right-side, isOverflowing) untested in unit (jsdom no layout) |
| Ctrl+N / Ctrl+T new tab | useKeyboardShortcuts.spec "falls back to openTab when Ctrl+N..." | none (Ctrl+T used only as helper fallback) | Ctrl+T path untested explicitly |
| Open from sidebar: dedupe existing tab | none found (RequestItem.spec not checked for this) | none | GAP |
| Preview tab | n/a not in code | n/a | documented nowhere |
| Switch tab (click) | useTabsStore "setActiveTab updates only active id"; TabBar.spec "selecting a tab updates the active tab" | e2e "switch between tabs" | E2E weak: only asserts URL input empty |
| Switch via Enter/Space on tab | none | none | Tab.tsx onKeyDown untested |
| Next/prev tab Ctrl+] / Ctrl+[ | useKeyboardShortcuts.spec "activates previous tab on Ctrl+[", "...next tab on Ctrl+]" | none | Boundary (first/last tab no wrap) untested; no tabs untested |
| Active styling / accent bar | TabBar.spec "active tab shows accent underline" | e2e open-tab checks accent | OK |
| Close via X, clean tab | TabBar.spec "closes a clean tab immediately"; useCloseTabGuard.spec "closes clean tab immediately" | e2e "close a tab with no unsaved changes" | E2E uses force click (X is opacity-0 on hover); does not assert adjacent becomes active (scenario says it should) |
| Close neighbor activation | useTabsStore "closeTab activates neighbor...", "...previous when closing last", "clears state when closing the last tab" | none | scenario step "adjacent tab becomes active" not asserted in e2e |
| Close X keyboard (Enter/Space) | none | none | Tab.tsx |
| Close X on inactive tab (hover-only) | none | none | |
| Middle-click close | not implemented | n/a | gap vs. expected UX |
| Close shortcut Ctrl+W (guarded) | useKeyboardShortcuts.spec "prefers onCloseTab over store closeTab", "closes active tab via store when onCloseTab is omitted" | none | MainLayout wiring to guard (handleCloseActiveTab) mocked in MainLayout.spec; no test it opens dialog. Without handler, hook fallback closes dirty tab with NO confirm |
| Ctrl+Shift+W close all | useKeyboardShortcuts.spec "invokes onCloseAllTabs"; MainLayout.handleCloseAllTabs (dirty check) untested | none | |
| Close dirty tab -> dialog | TabBar.spec "opening close guard for dirty tab shows unsaved dialog"; useCloseTabGuard.spec "sets pending close id when tab is dirty" | e2e "close a dirty tab — discard changes" | |
| Dirty close: confirm (Close) | TabBar.spec "confirm close in dialog removes dirty tab" | e2e discard | |
| Dirty close: cancel | none in unit | e2e "close a dirty tab — cancel keeps tab intact" | no unit for AlertDialogCancel |
| Save option in dirty dialog | not in code (only Cancel/Close = discard) | n/a | Task expected save/discard/cancel; there is no Save |
| Dirty dot on tab (orange) | none direct (Tab not rendered with isDirty in spec) | e2e "dirty indicator appears on modified tab" | store: "updateTabState marks dirty and merges patch" |
| Dirty dot persistence after save clears | none | none | |
| Connection dot (ws/socketio connected) | none | none | Tab.tsx showConnectionDot |
| Tab color dot / group separator / label | useTabsStore "setTabLabel updates group and color", "clears...", "groups adjacent tabs with same label" | none | Tab color dot & separator render untested; Set Label dialog untested |
| Context menu: Duplicate | TabContextMenu.spec "Duplicate Tab adds a second tab..." | none | only HTTP; graphql/ws duplicate untested |
| Context menu: Rename | TabContextMenu.spec "Rename updates tab name after committing blur" | none | Escape cancel, empty name untested |
| Context menu: Set Label dialog | none | none | |
| Context menu: Delete request (ConfirmDeleteDialog) | none | none | destructive path untested |
| Context menu: Close Tab (dirty -> guard) | TabContextMenu.spec "Close Tab defers to guard when tab is dirty" | none | |
| Context menu: Close Other Tabs | TabContextMenu.spec "Close Other Tabs is disabled when only one tab exists", "...two clean tabs keeps the tab the menu was opened for"; store "closeOtherTabs keeps one tab"; guard specs | e2e "close other tabs via context menu" | E2E does not assert remaining tab is active nor the disabled state |
| Close Other with dirty -> bulk dialog | useCloseTabGuard.spec "sets pending bulk close for others..." | none | TabBar bulk dialog render + confirmBulkClose + dirty count text (one/many) untested |
| Close All Tabs (ctx) | store "closeAllTabs clears state"; guard "closes all tabs when none are dirty" | e2e "close all tabs via context menu" | |
| Close All with dirty -> bulk dialog | guard "sets pending bulk close for all when any tab is dirty" | none | dialog confirm/cancel untested e2e+unit |
| Close to the right | not implemented | n/a | |
| Reopen closed tab | not implemented | n/a | |
| Drag reorder | useTabsStore "reorderTabs swaps tab positions", "is no-op when fromIndex equals toIndex" | none | TabBar drag/drop handlers (dragIndexRef, drop indicator) untested |
| Tab overflow / scroll right on add / "+" moves to right actions | none | none | ResizeObserver/scrollWidth logic untested |
| Opened-tabs dropdown: open & header count "Opened tabs · N" | **none** | e2e "view all tabs via overflow dropdown" (counts 5 rows; does not assert header text) | |
| Dropdown chevron shown only when tabs.length>0 | none | none | empty state after close all untested |
| Dropdown search filter (case-insens., trim, fallback name) | **none** | e2e "search tabs in overflow dropdown" (matches all 3 / no match) | Never tests partial/case-insensitive or a subset result (all tabs share a name) |
| Dropdown no-results "No tabs found" | **none** | e2e same | |
| Dropdown select row -> activates + closes popover | **none** | none | e2e never clicks a row |
| Dropdown select scrolls tab into view | not implemented | n/a | |
| Dropdown active-row highlight | **none** | none | |
| Dropdown blue dirty dot / hover shows X | **none** | none | |
| Dropdown per-row X (stopPropagation, guard) | **none** | none | |
| Dropdown "Close all" (clean / dirty -> bulk dialog) | **none** (hook covered by guard spec) | none | |
| Dropdown search reset on close | **none** | none | BUG: handleSelectTab/Close-all call setOpen(false) directly, bypassing handleOpenChange, so search text persists after select/close-all; only outside-click/Esc clears it |
| Dropdown keyboard: Enter/Space on row; Esc closes; autoFocus search | **none** | none | No arrow-key nav in code |
| Duplicate names ("New Request" x5) | none | e2e uses 5 identical names (count) | keys use tabId so ok; active-row among duplicates untested |
| Persistence across reload | useTabsStore hydrate specs ("hydrate loads tabs and sets first active", "normalizes legacy HTTP tab shape", "clears state when no saved tabs", "shows toast and clears on failure", "persist failure shows toast") | none (e2e only clears IDB) | No e2e reload test; active tab not restored (always tabs[0]); dirty flag/edits lost |
| beforeunload guard with dirty tabs | MainLayout.spec? (not verified to cover) | none | MainLayout.tsx lines ~60-71 |
| closeTabsForRequest(s) (request deleted) | store specs ("closeTabsForRequest removes matching", "...Requests...", "activates neighbor") | none | |
| Empty state after close all | none in tab specs | e2e close-all only asserts 0 tabs, not empty-state UI | |

## 3) Missing unit tests
High
- src/components/layout/TabListDropdown.tsx (new TabListDropdown.spec.tsx): count header, filter case-insensitive/trimmed/fallback "New Request" name, "No tabs found", select row activates + closes, Enter/Space on row, active highlight, dirty dot, row X calls handleCloseTab and does not select (stopPropagation), Close all -> handleCloseAll (dirty -> pendingBulkClose), search cleared on reopen (will expose the setOpen bypass bug).
- src/components/layout/TabBar.tsx bulk-close dialog: confirmBulkClose for kind "others"/"all", dirty count one vs many text, cancel.
- src/components/layout/TabBar.tsx single-close dialog: Cancel keeps tab, pendingCloseTabId cleared.
- src/components/layout/MainLayout.tsx handleCloseActiveTab / handleCloseAllTabs dirty branch / beforeunload handler.
Medium
- Tab.tsx (new Tab.spec.tsx): icon per type (http/graphql/ws/socketio), dirty dot, connection dot only when ws/socketio connected, color dot, Enter/Space select, X keyboard close, X stopPropagation.
- TabContextMenu: Set Label dialog apply/clear, Delete request confirm, rename Escape/empty, Duplicate for graphql/ws.
- TabBar drag/drop: dragstart/drop calls reorderTabs(from,to); same-index no call; dragend resets.
- TabBar overflow: "+" moves to right actions when scrollWidth>clientWidth (mock sizes); auto-scroll on tab add.
- RequestItem: click existing requestId activates instead of opening duplicate.
- useKeyboardShortcuts: Ctrl+[ at first / Ctrl+] at last tab no-op; no tabs; Ctrl+T.
Low
- useTabsStore: openTab with dirty initial, closeOtherTabs with unknown id (empties tabs!), reorderTabs out-of-range indexes, hydrate activeTabId choice.

## 4) Missing e2e scenarios (prioritized)
1. (High) Given 3 tabs, one with distinct name, When I open dropdown and click a row, Then that tab is active and popover closes.
2. (High) Given dirty + clean tabs, When I click dropdown "Close all", Then bulk-close dialog shows count; Cancel keeps all, Confirm clears all.
3. (High) Given tabs with distinct names (rename via ctx menu), When I search lowercase partial text, Then only matching rows appear (case-insensitive).
4. (High) Given a dirty tab and another tab, When I Close Other Tabs from ctx menu, Then bulk dialog appears (both Cancel and Close All).
5. (High) Given open tabs, When I reload the page, Then the same tabs are restored (and dirty edits are lost / active tab = first).
6. (Med) Given a dirty tab, When I press Ctrl+W, Then the unsaved dialog appears.
7. (Med) Given a saved request open in a tab, When I click it again in the sidebar, Then no second tab is created and it is activated.
8. (Med) Given tabs, When I press Ctrl+[ / Ctrl+], Then the active tab changes.
9. (Med) Given 3 tabs, When I drag tab 1 onto tab 3, Then order changes.
10. (Med) Given a dirty tab in dropdown, Then blue dot shows and hover shows X that closes with guard.
11. (Med) Given the last tab closed, Then empty state is shown and the chevron disappears.
12. (Med) Given Duplicate / Rename / Set Label from ctx menu, Then tab reflects it.
13. (Low) GraphQL/WS/Socket.IO tab icons; many tabs at narrow viewport -> "+" relocates to right, chevron lists all.

## 5) Weak tests and doc/impl mismatches
- e2e "switch between tabs": only asserts empty URL input; scenario also requires editor content of selected tab; does not verify tab 2 retains its URL when switched back.
- e2e "close other tabs": scenario says remaining tab becomes active; not asserted. Right-clicks `.last()` which is already active, so doesn't prove the clicked tab is the kept one.
- e2e "close a tab with no unsaved changes": scenario says adjacent tab becomes active; not asserted. Uses `force: true` on a hover-only button, so it bypasses visibility.
- e2e "view all tabs via overflow dropdown": title/scenario assume tab bar overflow (viewport resize commented out); chevron is actually always visible when tabs>0, so it passes without overflow. Does not check header "Opened tabs · N", active highlight, or dirty dot, so the described UI is largely unasserted.
- e2e "search tabs": all tabs are named identically so filter never narrows a subset; case-insensitivity unproven.
- e2e open-tab helper falls back to Ctrl+T silently when button not visible; masks button regression.
- e2e relies on CSS classes (`span.bg-method-accent`, `span.bg-orange-400`) instead of testids (Tab has `tab-dirty-indicator` testid unused).
- TabBar.spec "renders tab bar root for layout tests" is a smoke test with little value; "opening close guard for dirty tab..." partly asserts store state, and a `tabId toBeDefined` assertion is vacuous.
- Scenario doc lacks: dropdown select, Close all in dropdown, dirty bulk-close, rename/duplicate/label, drag reorder, shortcuts, reload persistence, dropdown row dirty dot. All 10 documented scenarios are implemented (1:1 title match); doc "Close a dirty tab" lists only Cancel/Close (no Save option exists in code).
