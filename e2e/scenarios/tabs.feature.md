# Feature: Tab Management

As a user
I want to manage multiple request tabs
So that I can work on multiple requests simultaneously

---

@critical
# evidence: src/components/layout/TabBar.tsx (new-tab-btn), Tab.tsx (data-testid=tab); spec: "open a new tab"
## Scenario: Open a new tab

Given the app is loaded
When I click the "+ New Request" button in the tab bar
Then a new untitled tab is opened
And the new tab becomes the active tab

---

@high
# evidence: src/components/layout/TabBar.tsx (setActiveTab on Tab onSelect); spec: "switch between tabs"
## Scenario: Switch between tabs

Given I have two or more tabs open
When I click on an inactive tab
Then that tab becomes the active tab
And the request editor shows the content of the selected tab

---

@high
# evidence: src/hooks/useCloseTabGuard.ts (handleCloseTab), Tab.tsx (tab-close-btn); spec: "close a tab with no unsaved changes"
## Scenario: Close a tab with no unsaved changes

Given I have a tab open with no changes
When I click the close (×) button on the tab
Then the tab is removed from the tab bar
And the adjacent tab becomes active

---

@high
# evidence: src/components/layout/TabBar.tsx (close-tab-dialog), src/hooks/useCloseTabGuard.ts; spec: "close a dirty tab — discard changes"
## Scenario: Close a dirty tab — close anyway (discard changes)

Given I have a tab open with unsaved changes (dirty state)
When I click the close (×) button on the tab
Then the "Unsaved changes" dialog (close-tab-dialog) appears with only "Cancel" and "Close" actions (no Save option)
When I click "Close"
Then the tab is closed and its changes are discarded

---

@high
# evidence: src/components/layout/TabBar.tsx (close-tab-dialog); spec: "close a dirty tab — cancel keeps tab intact"
## Scenario: Close a dirty tab — cancel

Given I have a tab open with unsaved changes
When I click the close (×) button on the tab
And the "Unsaved changes" dialog appears
When I click "Cancel"
Then the tab remains open with its changes intact

---

@high
# evidence: src/components/layout/TabContextMenu.tsx (Close Other Tabs), stores/useTabsStore.ts closeOtherTabs; spec: "close other tabs via context menu"
## Scenario: Close other tabs via context menu

Given I have three or more tabs open
When I right-click on one tab
And I select "Close Other Tabs"
Then all tabs except the right-clicked one are closed
And the remaining tab becomes active

---

@high
# evidence: TabContextMenu.tsx (Close All Tabs); spec: "close all tabs via context menu"
## Scenario: Close all tabs via context menu

Given I have multiple tabs open
When I right-click on any tab
And I select "Close All Tabs"
Then all tabs are closed
And no tabs remain in the tab bar

---

@medium
# evidence: Tab.tsx (tab-dirty-indicator, bg-orange-400); spec: "dirty indicator appears on modified tab"
## Scenario: Dirty indicator shown on modified tab

Given I have an open tab with a saved request
When I modify the URL or any request field
Then an orange dot (dirty indicator) appears on the tab

---

@high
# evidence: src/components/layout/TabListDropdown.tsx (tabs-overflow-btn, tabs-popover-content, tab-list-item); spec: "view all tabs via overflow dropdown"
## Scenario: View all tabs via overflow dropdown

Given I have one or more tabs open (the chevron is shown whenever at least one tab exists, not only on overflow)
When I click the chevron (tabs-overflow-btn) on the right of the tab bar
Then a popover appears headed "Opened tabs · N" listing all open tabs
And I can click any tab name to switch to it

---

@high
# evidence: TabListDropdown.tsx (tabs-search-input, noTabsFound); spec: "search tabs in overflow dropdown"
## Scenario: Search tabs in the overflow dropdown

Given the overflow dropdown is open with multiple tabs listed
When I type a keyword in the search box
Then only matching tabs are shown in the list

---

@high
# evidence: src/components/layout/TabListDropdown.tsx (handleSelectTab, tab-list-item)
## Scenario: E-TAB-01: Select a tab from the overflow dropdown

Given I have three tabs open and the first is active
When I open the overflow dropdown
And I click the row of the third tab
Then the third tab becomes the active tab
And the popover closes

---

@high
# evidence: src/components/layout/TabListDropdown.tsx ("Close all"), TabBar.tsx (bulk-close-dialog, unsavedChangesBulkMany), useCloseTabGuard.ts handleCloseAll
## Scenario: E-TAB-02: Close all from the dropdown with a dirty tab shows a bulk dialog

Given I have one dirty tab and one clean tab open
When I open the overflow dropdown and click "Close all"
Then the popover closes
And the bulk-close-dialog appears saying "1 tab has unsaved changes. Close anyway?"
When I click "Cancel"
Then both tabs remain open
When I repeat "Close all" and click "Close All"
Then all tabs are closed

---

@high
# evidence: src/components/layout/TabListDropdown.tsx (filteredTabs, toLowerCase), TabContextMenu.tsx (Rename)
## Scenario: E-TAB-03: Dropdown search is case-insensitive partial match

Given I have three tabs renamed via the context menu to distinct names (for example "Alpha users", "Beta orders", "Gamma users")
When I open the overflow dropdown
And I type "users" in tabs-search-input
Then only "Alpha users" and "Gamma users" are listed
When I type "BETA"
Then only "Beta orders" is listed
When I type a term that matches nothing
Then "No tabs found" is shown

---

@high
# evidence: src/hooks/useCloseTabGuard.ts handleCloseOthers, TabBar.tsx (bulk-close-dialog, confirmBulkClose), TabContextMenu.tsx
## Scenario: E-TAB-04: Close Other Tabs with a dirty tab shows a bulk dialog

Given I have a dirty tab and a second tab open
When I right-click the second tab and select "Close Other Tabs"
Then the bulk-close-dialog appears with "Cancel" and "Close All" actions
When I click "Cancel"
Then both tabs remain open and the dirty tab keeps its changes
When I repeat the action and click "Close All"
Then only the right-clicked tab remains

---

@high
# evidence: src/stores/useTabsStore.ts (persistTabs, hydrate: activeTabId = tabs[0], no persistence on dirty edits)
## Scenario: E-TAB-05: Reload restores open tabs

Given I have several saved-request tabs open and the last one is active
And one tab has unsaved edits
When I reload the page
Then the same tabs are restored in the same order
And the first tab is the active tab
And the unsaved edits are lost (the tab is no longer dirty)

---

@medium
# evidence: src/hooks/useKeyboardShortcuts.ts (case "w"), MainLayout.tsx handleCloseActiveTab, TabBar.tsx (close-tab-dialog)
## Scenario: E-TAB-06: Ctrl+W on a dirty tab shows the unsaved dialog

Given the active tab is dirty
When I press Ctrl+W
Then the close-tab-dialog appears
When I click "Close"
Then the tab is closed

---

@medium
# evidence: src/components/collections/RequestItem.tsx (openTabForRequest -> setActiveTab)
## Scenario: E-TAB-07: Opening the same saved request twice reuses its tab

Given a saved request exists in the sidebar
When I click it
And I switch to another tab
And I click the same request in the sidebar again
Then only one tab exists for that request
And that tab is the active tab

---

@medium
# evidence: src/hooks/useKeyboardShortcuts.ts (cases "[" and "]")
## Scenario: E-TAB-08: Ctrl+[ and Ctrl+] move between tabs

Given I have three tabs open and the second is active
When I press Ctrl+]
Then the third tab is active
When I press Ctrl+[ twice
Then the first tab is active and does not wrap past the start

---

@medium
# evidence: src/components/layout/TabBar.tsx (draggable, onDrop -> reorderTabs)
## Scenario: E-TAB-09: Reorder tabs by drag and drop

Given I have three tabs with distinct names in order A, B, C
When I drag tab A onto tab C
Then the tab order changes (A is no longer first)

---

@medium
# evidence: src/components/layout/TabListDropdown.tsx (bg-blue-400 dirty dot, hover close button)
## Scenario: E-TAB-10: Dropdown shows dirty dot and guards close

Given one tab is dirty
When I open the overflow dropdown
Then the dirty tab's row shows a blue dot
When I hover the row and click its close (X) button
Then the close-tab-dialog appears
When I click "Close"
Then that tab is removed from the list

---

@medium
# evidence: src/components/layout/TabBar.tsx (`tabs.length > 0 && <TabListDropdown />`), useTabsStore.ts closeTab
## Scenario: E-TAB-11: Closing the last tab empties the bar

Given I have exactly one clean tab open
When I close it
Then no tab elements remain in the tab bar
And the overflow chevron (tabs-overflow-btn) is no longer shown
And the "+ New Request" button is still available

---

@medium
# evidence: src/components/layout/TabContextMenu.tsx (Rename, Duplicate Tab, Set Label, applyLabel), Tab.tsx (tab-color-dot)
## Scenario: E-TAB-12: Rename, duplicate and label a tab from the context menu

Given an HTTP tab is open
When I right-click it, choose "Rename", type a new name and press Enter
Then the tab shows the new name
When I right-click it and choose "Duplicate Tab"
Then a second tab opens
When I right-click a tab, choose "Set Label", pick a color and apply
Then a tab-color-dot with that color appears on the tab
