# Feature: Chain

As a user
I want to orchestrate multiple API requests in a sequential chain
So that I can test complex workflows and data flows between dependent requests

---

## Background

Given the app is loaded at the home page

---

## Scenario: Create a standalone chain via the Create New dropdown

When I click the Create New dropdown
And I select "Chain"
Then a name input appears in the Chains section of the sidebar
When I type a name and press Enter
Then the new chain appears in the sidebar
And I am navigated to the chain page showing that name in the breadcrumb

---

## Scenario: Chain list shows empty state when no chains exist

Given no standalone chains exist
When the app loads
Then the Chains section in the sidebar shows a "no chains" empty state

---

## Scenario: Rename a standalone chain from the sidebar

Given a standalone chain named "My Chain" exists in the sidebar
When I hover the chain item and open its more menu
And I select "Rename"
Then the chain name becomes an editable input
When I type a new name and press Enter
Then the chain is updated with the new name in the sidebar

---

## Scenario: Delete a standalone chain from the sidebar

Given a standalone chain exists in the sidebar
When I hover the chain item and open its more menu
And I select "Delete"
Then the chain is immediately removed from the sidebar

---

## Scenario: An empty chain shows the empty-canvas overlay (EMPTY-1, EMPTY-2, EMPTY-9)

Given a standalone chain with no nodes exists
When I am on the chain page
Then the canvas stays mounted with a compact "chain-empty-state" overlay
And the overlay offers an "Add API" button and an "Add Start block" button
And the old "no APIs" placeholder text and the quick-add card grid are gone
And the footer shows no "Drag nodes" or edge hints (CANVAS-22)

---

## Scenario: Chain page header shows the chain title in the breadcrumb

Given a standalone chain named "Auth Flow" exists
When I am on the chain page
Then the page breadcrumb shows "Auth Flow"

---

## Scenario: Run Chain button is disabled when the chain has no requests

Given I am on a chain page with no API nodes
When the page loads
Then the "Run Chain" button is present but disabled

---

## Scenario: Clear edges is in the header overflow menu and disabled with no edges

Given I am on a chain page whose nodes have no edges
When I open the header overflow menu
Then "Clear edges" is listed and marked disabled

---

## Scenario: Open the API picker dialog from the empty state

Given I am on a chain page with no API nodes
When I click the "Add API" button
Then the "Add API Request" dialog opens

---

## Scenario: API picker dialog has Collections and History tabs

Given the API picker dialog is open
When I view the dialog
Then I see a "Collections" tab
And I see a "History" tab

---

## Scenario: API picker Collections tab shows empty state when no collections exist

Given no collections exist
And the API picker dialog is open on the Collections tab
When I view the tab
Then I see a "No collections yet" message

---

## Scenario: API picker History tab shows empty state when no history exists

Given no history entries exist
And the API picker dialog is open
When I click the "History" tab
Then I see a "No history yet" message

---

## Scenario: Dismiss the API picker without adding anything

Given the API picker dialog is open
When I press Escape
Then the dialog closes
And no node is added to the chain

---

## Scenario: Add an API from a collection to the chain

Given a collection with a saved request exists
And I am on a chain page with no API nodes
When I open the API picker
And I click a request in the Collections tab
Then the dialog closes
And the chain header shows "1 node"
And the "Run Chain" button becomes enabled

---

## Scenario: Add multiple API nodes and verify request count updates

Given a chain with one API node
When I open the API picker and add a second request
Then the chain header shows "2 nodes"
When I open the API picker and add a third request
Then the chain header shows "3 nodes"

---

## Scenario: Run a chain with a single API node and see the response

Given a chain with one API node pointing to a reachable endpoint
When I click "Run Chain"
Then the node shows a loading/running state
And the node panel shows the response status and body after completion
And the chain run summary shows 1 passed, 0 failed

---

## Scenario: Run a chain with multiple API nodes sequentially

Given a chain with three API nodes connected in sequence
When I click "Run Chain"
Then each node executes in order
And each node displays its own response status
And the chain run summary shows the total pass/fail counts

---

## Scenario: Pass response data from one node to the next via variable binding

Given a chain with two API nodes
And the first node extracts a value from its response into a variable "authToken"
And the second node uses "{{authToken}}" in its Authorization header
When I click "Run Chain"
Then the second node's request is sent with the resolved Authorization header value
And the second node shows a successful response

---

## Scenario: Add a Condition block between two API nodes

Given a chain with two API nodes
When I add a Condition block between them
Then the condition block appears on the canvas between the two nodes
And the condition block has a configurable expression input
And two output edges appear: one labeled "True" and one labeled "False"

---

## Scenario: Condition block routes to the success branch when the expression is true

Given a chain with a Condition block whose expression evaluates to true at runtime
And the True branch leads to a second API node
When I click "Run Chain"
Then the Condition block shows a "True" result badge
And the second API node on the True branch executes
And the False branch node is skipped

---

## Scenario: Condition block routes to the failure branch when the expression is false

Given a chain with a Condition block whose expression evaluates to false at runtime
And the False branch leads to a third API node
When I click "Run Chain"
Then the Condition block shows a "False" result badge
And the third API node on the False branch executes
And the True branch node is skipped

---

## Scenario: Add a Delay block and verify it pauses execution

Given a chain with two API nodes
When I add a Delay block between them and set the delay to 2000 ms
Then the Delay block appears on the canvas with "2000 ms" displayed
When I click "Run Chain"
Then execution pauses at the Delay block for approximately 2 seconds before proceeding to the next node

---

## Scenario: Add a Display block and verify it shows a message

Given a chain with one API node followed by a Display block
And the Display block is configured with the message "Request complete"
When I click "Run Chain"
Then after the API node completes, the Display block activates
And the canvas or panel shows the message "Request complete"

---

## Scenario: Display block shows a dynamic value from a previous node's response

Given a chain with one API node followed by a Display block
And the Display block message is set to "Status: {{node1.response.status}}"
When I click "Run Chain"
Then the Display block renders the actual response status from node1 in its message

---

## Scenario: API node shows a failure state when the request returns an error status

Given a chain with an API node whose endpoint returns a 4xx or 5xx status
When I click "Run Chain"
Then the API node shows a failure/error badge
And the chain run summary reflects 0 passed, 1 failed

---

## Scenario: Success branch of an API node connects to the next step on 2xx

Given a chain where the first API node's success edge connects to a second API node
And the first API node returns a 2xx response
When I click "Run Chain"
Then the second API node executes
And both nodes show success states

---

## Scenario: Failure branch of an API node connects to an alternate node on error

Given a chain where the first API node has a failure edge connecting to a fallback API node
And the first API node returns a 5xx response
When I click "Run Chain"
Then the failure edge is traversed
And the fallback API node executes
And the main success-path node is skipped

---

## Scenario: Clear edges removes all connections but keeps nodes on the canvas

Given a chain with three connected nodes
When I click "Clear edges" in the header
Then all edges between nodes are removed
And all three nodes remain on the canvas
And the "Run Chain" button becomes disabled (no valid path)

---

## Scenario: Reorder nodes by reconnecting edges and verify new execution order

Given a chain with nodes A → B → C
When I delete the edge between A and B
And I connect A → C → B instead
Then clicking "Run Chain" executes in the order A, C, B

---

## Scenario: Chain with a mix of block types runs end to end

Given a chain: API node → Condition block → (True) Delay block → Display block
When I click "Run Chain" and the condition evaluates to true
Then all four blocks execute in sequence
And each block shows its completed state
And the chain run summary shows the full execution path

---

## Scenario: Toolbar stays reachable on a delay block and on a condition block

Given a chain with one API node and a Delay block (then a Condition block) placed on the canvas
When I hover the block card and move the pointer up onto its toolbar
Then the toolbar stays visible along the whole pointer path
And clicking "Remove from chain" removes the block

---

## Scenario: Two stacked nodes: the upper node's body is still clickable

Given two nodes stacked so the lower node's hover strip overlaps the upper node's top edge
When I click the body of the upper node
Then the upper node is selected rather than the lower node's hover strip intercepting the click

---

## Scenario: Start default output handle connects to a Delay

Given a chain with a Start block and a Delay block
When I drag from the Start block's single default output handle to the Delay block
Then an edge connects Start to the Delay block

---

## Scenario: Clear all nodes then undo/redo in one step each, header follows node count

Given a chain with two nodes and a persisted last run
Then the header shows "2 nodes"
When I choose "Clear all nodes" from the header overflow menu
Then a confirmation dialog mentions that Cmd+Z undoes it
When I confirm
Then the header shows "No nodes"
And the last-run status is hidden
And "Clear all nodes" is disabled
When I press Cmd+Z once (the canvas stays mounted and shows the empty overlay)
Then both nodes are restored and the header shows "2 nodes" again
When I press Cmd+Shift+Z once
Then the chain is empty again and the header shows "No nodes"

---

## Scenario: Clear edges confirmation says the action is undoable

Given a chain with at least one edge
When I choose "Clear edges" from the header overflow menu
Then the confirmation copy says the action can be undone
And Cmd+Z brings the edges back

---

## Scenario: Header shows the persisted last run and the node count

Given a chain whose last run finished with 2 passed, 1 failed and 1 skipped steps
When I open the chain page
Then the header shows "Last run" with a relative time such as "5 seconds ago"
And hovering the time shows the absolute date and time
And the counts read "2 passed", "1 failed" and "1 skipped" with no check or cross glyphs
And the node count reads "N nodes" including block nodes, or "No nodes" when empty
When I click the last-run label
Then the run opens in the run log

---

## Scenario: Run results are cleared without losing history

Given a chain that has just been run so nodes show success badges
When I choose "Clear run results" from the header overflow menu
Then all node badges reset to idle
And the persisted run history rows remain
And deleting a node then pressing Cmd+Z restores it idle, not with its old badge

---

## Scenario: Toolbar tooltips show the registry shortcut

Given a chain node on the canvas
When I hover its "Duplicate" and "Remove from chain" toolbar buttons
Then each tooltip shows its label and keyboard shortcut, such as "Duplicate (Cmd+D)"

---

## Scenario: Right-clicking the empty pane adds a block (CANVAS-10)

Given I am on a chain page
When I right-click an empty spot on the pane
Then the add-block menu opens at the cursor and the native menu is suppressed
When I choose "Delay"
Then a Delay node is placed at that spot and the empty overlay disappears
When I open the menu again and press Escape
Then the menu closes, focus returns to the canvas, and nothing is created
And right-clicking a node still opens the node menu, not the pane menu

---

## Scenario: Dropping a connection on empty space adds and connects a block (CANVAS-11)

Given a chain with a Start block
When I drag from its default output handle and release over empty pane
Then the add-block menu opens at the drop point without a Start entry
When I choose "Delay"
Then a Delay node is created there with an edge from the handle
And a single Cmd+Z removes both the node and the edge
When I press Escape in the menu instead, no node or edge is created
And dragging from a Loop body handle that already has an edge opens no menu

---

## Scenario: A Start-only chain shows a hint banner (EMPTY-7)

Given a chain whose only node is a Start block
When I am on the chain page
Then no empty overlay is shown and the "Only a Start block so far" banner is visible
When I add a Delay block
Then the banner disappears

---

## Scenario: Run is gated on a runnable node (CANVAS-13)

Given an empty chain, or a chain with only a Start block
Then the "Run Chain" button is disabled and Cmd+Enter does not start a run
Given a chain with a single Delay block and no API nodes
Then the "Run Chain" button is enabled
When I clear all nodes and press Cmd+Z once
Then the empty overlay returns after the clear and the nodes are restored by the undo

---

## Scenario: Collapsed run log bar summarizes the last run and expands on click (RUNLOG-1, RUNLOG-2)

Given a chain with a failed last run and the run log collapsed
Then the 32px bar reads the chain name, "Last run failed", "1 passed, 2 failed", the duration and a relative time, with no check or cross glyphs
And on a narrow screen the relative time truncates before the title and status
Given a chain that has never run, the bar reads "No runs yet"
When I click anywhere on the bar, or focus it and press Enter or Space
Then the dock expands and the bar is replaced by the header
And a run that is in progress reads "Running" in the bar

---

## Scenario: Run log header shows the run count and collapses from its title (RUNLOG-3)

Given an expanded run log with nine runs
Then the header shows "Run Log (9 runs)" and an options menu, with no inline Clear all runs button
When I click the title area
Then the dock collapses to the bar

---

## Scenario: Run cards show trigger, counts and duration on two lines (RUNLOG-4, RUNLOG-8)

Given an expanded run log with full, from-here, up-to, single, stopped and zero-step runs
Then each card shows its status, its trigger ("Full run", From "node", Up to "node", Only "node") and counts in words such as "1 passed, 2 failed"
And a run whose anchor node was deleted reads "a deleted node"
And a zero-step run reads "No steps recorded"
And no card, tab or header contains a check or cross glyph

---

## Scenario: Run card menu re-runs, copies and deletes with an undo toast (RUNLOG-5, RUNLOG-25)

Given an expanded run log
When I open a card's options menu and choose Delete run
Then the card disappears and a "Run deleted" toast offers Undo, which restores it
And Re-run same subset is disabled when the run's anchor node no longer exists
When I choose Re-run same subset on a from-here run
Then a new live run with the same subset appears at the top, is selected, and holds keyboard focus

---

## Scenario: Run list is a keyboard-navigable listbox (RUNLOG-6)

Given an expanded run log with the first card focused
When I press ArrowDown, ArrowUp, End and Home
Then focus moves between cards, and Enter selects the focused run
When I press Delete
Then the run is removed and focus lands on a neighbouring card with a visible focus ring

---

## Scenario: Relative times tick and carry an absolute tooltip (RUNLOG-7)

Given a run that started five seconds ago
Then the card, the summary header and the bar show "N seconds ago"
When two minutes pass
Then all three read "2 minutes ago" without a reload
And hovering a time shows its absolute date and time in a tooltip

---

## Scenario: Latest run and its first failed step are auto-selected (RUNLOG-9)

Given a chain whose latest run failed
When I expand the run log
Then the latest run is selected, its first failed step is selected, and the Error tab is active
When I choose another run, collapse and re-expand the dock
Then my selection is kept

---

## Scenario: Run summary header names trigger, time, duration and steps (RUNLOG-10)

Given a selected run
Then the header shows its trigger, "Started" with a relative time, its duration and its step count, plus Re-run same subset
And for a run whose anchor node was deleted the button is disabled and its tooltip says "Can't re-run"

---

## Scenario: Count tabs filter the steps timeline (RUNLOG-11, RUNLOG-12)

Given a run with 3 steps (1 passed, 2 failed)
Then the tabs read "All 3", "Passed 1" and "Failed 2", and Skipped is absent
When I click "Failed 2"
Then only the two failed steps are listed and the tab is pressed
When I select a run with no failures
Then the Failed tab disappears and the filter resets to All
When I type in the filter input
Then steps narrow by node label and the match count is announced
And Escape clears the filter first, then collapses the dock

---

## Scenario: Step rows show method, status, duration and an inline error (RUNLOG-13, RUNLOG-14)

Given a run with a 404 step and an assertion-failed step
Then each row aligns index, method, label, HTTP status badge and duration, with no node-type icon or lane dot
And the 404 row shows "HTTP 404 Not Found" and the assertion row shows "1 assertion failed"
When I click a failed step
Then the Error tab opens, and a passed step opens the Output tab

---

## Scenario: Run log empty states are specific (RUNLOG-15)

Given a chain that has never run
Then the run list says "No runs yet" with a Run flow button
Given a run with zero steps
Then the steps pane says "This run recorded no steps." and the detail pane asks me to select a step
Given a filter that matches nothing
Then the pane says "No steps match this filter." with a Clear filter button that restores the list

---

## Scenario: Run log columns resize and persist (RUNLOG-16, RUNLOG-17, PERSIST-1, PERSIST-2)

Given an expanded run log at its default 288px list width and 50% detail ratio
When I drag the vertical separator, or use ArrowLeft, ArrowRight, Home and End on it
Then the list width changes within 200 to 420px and is saved
When I reload
Then the width is restored, and double-clicking the separator resets it
And the horizontal separator resizes steps against detail between 25% and 75%
And corrupt or out-of-range stored values clamp or fall back to the defaults
And below a 560px dock width the list is replaced by a run Select

---

## Scenario: Copy error and Copy response use the clipboard (RUNLOG-18)

Given a failed step with the Error tab open
When I click Copy error
Then the raw error text is on the clipboard and "Copied" is announced
When I open a passed step and click Copy response
Then the raw response body is on the clipboard

---

## Scenario: Selecting a step focuses its canvas node (RUNLOG-19)

Given an expanded run log and a canvas with the run's nodes
When I select a step
Then its node is selected on the canvas and the view pans to it
When the step's node was removed
Then the row shows a "Node removed" chip and no node is selected

---

## Scenario: Run log dock height resizes and collapses (RUNLOG-20)

Given an expanded run log
When I use Home and End on the height handle
Then the dock is at least 160px and at most 60% of the viewport
When I collapse it
Then it is 32px tall

---

## Scenario: Footer hints are hidden while the run log is expanded (RUNLOG-21)

Given a chain with unresolved variables and a collapsed run log
Then the footer shows the canvas hints and the unresolved-variables warning
When I expand the run log
Then the hints are hidden and the warning stays
When I collapse it
Then the hints return

---

## Scenario: Run log options menu toggles auto-open and clears all runs (RUNLOG-22)

Given an expanded run log
When I open Run Log options
Then Auto-open on run is a checkbox that toggles in place
When I choose Clear all runs
Then a confirmation dialog appears, Cancel keeps every run, and confirming shows the "No runs yet" state

---

## Scenario: Run log text is legible (RUNLOG-23)

Given an expanded run log
Then no text in the dock is smaller than 12px
And the collapsed bar's status word and muted summary meet 4.5:1 contrast and the bar shows an icon besides colour

---

## Scenario: Run with 120 steps stays virtualized (RUNLOG-24)

Given a run with 120 steps
Then the tab reads "All 120" and fewer than 50 rows are mounted
When I scroll to the end
Then the last step is reachable and the mounted rows stay bounded

---

## Scenario: Stopped run reads Stopped with a distinct icon (RUNLOG-26)

Given a run that was stopped
Then its card has "Stopped" text, an amber icon different from the failed icon, and its header renders
When it is the latest run
Then the collapsed bar reads "Last run stopped"

---

## Scenario: Run log collapsed state persists and a run auto-opens it (RUNLOG-27)

Given an expanded run log
When I reload
Then it is still expanded
When I collapse it and reload
Then it is still collapsed
When I run the chain with auto-open on
Then the dock expands

---

## Scenario: Run log is a named region with a logical order (RUNLOG-28)

Given an expanded run log
Then it is a region named "Run Log" with separators named "Resize runs list" and "Resize step detail"
And the DOM order is header, run list, filters, steps, detail with no positive tabindex

---

## Scenario: Collapsed bar click-to-expand and footer hidden while expanded

Given a chain with a completed run
When I collapse the run log
Then the bar shows "Last run passed" and "1 passed" with no glyphs
When I click the bar
Then the dock expands and the footer hints are hidden until I collapse again

---

## Scenario: Clear all runs is in the run log options menu and confirms first

Given a chain with runs
Then the header has no Clear all runs button
When I open Run Log options and choose Clear all runs
Then an "Clear all runs?" dialog appears and confirming shows the no-runs state

---

## Scenario: PICKER-1: A long URL truncates with a tooltip and never scrolls horizontally

Given an open picker with a 400-character URL row
When I view it at 360px and 1440px
Then the URL truncates with a title tooltip and neither the dialog nor the tree scrolls horizontally

---

## Scenario: PICKER-2: Tabs are labelled, arrow keys switch them and the last tab persists

Given the open picker
When I press the arrow keys on the tab list and reload
Then the tabs Collections, History and New request are labelled and the last tab is restored

---

## Scenario: PICKER-3: Search ANDs tokens, highlights matches and suggests a cURL import

Given the Collections tab
When I type multiple tokens, then a cURL command or URL
Then matches are highlighted, no results offers Clear search, and a cURL query opens New request prefilled

---

## Scenario: PICKER-4: Method filter chips show counts and combine with search

Given the Collections tab
When I toggle a method chip and type a search
Then chips show counts, combine with search, disable at zero matches and Clear filters resets them

---

## Scenario: PICKER-5: Nested folders keep their hierarchy

Given a collection with nested folders, a corrupt parent and an empty collection
When I browse the tree
Then hierarchy follows aria-level, the corrupt parent becomes a root and the empty collection cannot expand

---

## Scenario: PICKER-6: Collections start collapsed and Collapse all works

Given the Collections tab
When I search, clear, expand and collapse all
Then everything starts collapsed, search auto-expands and clearing restores the previous expansion

---

## Scenario: PICKER-7: Large collections stay virtualized

Given a 150, 600 or 1,500 request collection
When I open the tree and Expand all
Then fewer than 80 request rows exist in the DOM and the tree scrolls without blocking

---

## Scenario: PICKER-8: A keyboard-only user can search, select a range, add and Esc in order

Given the open picker
When I search, press Down, Space, Shift+Down, then Enter
Then the requests are added; Esc first clears the search and then closes the dialog

---

## Scenario: PICKER-9: Request rows show checkbox, method, name and path with an active-row indicator

Given the Collections tab
When I click and arrow through rows
Then the row toggles selection and the active row is exposed through aria-activedescendant

---

## Scenario: PICKER-10: Requests already in the chain show In chain and Show on canvas

Given a chain containing a request
When I open the picker
Then the row shows In chain, cannot be added twice and Show on canvas centers the node

---

## Scenario: PICKER-11: Multi-select add survives tab switches and caps at 100

Given the open picker
When I select several requests across tabs
Then the footer shows a live count, selection survives tab switches and rows disable at 100 with a tooltip

---

## Scenario: PICKER-12: A multi-add places nodes in selection order as one undo

Given a chain with nodes
When I add several requests and press Cmd+Z once, and separately close without confirming
Then nodes stack right of the canvas, one undo removes all and closing adds nothing

---

## Scenario: PICKER-13: History groups by day and dedupes

Given history entries across days with duplicates
When I open the History tab
Then day headers appear, identical method and URL are deduped and an empty history shows an empty state

---

## Scenario: PICKER-14: New request from cURL, blank and without collections

Given the New request tab
When I submit valid cURL, invalid cURL, a blank URL, and use zero collections
Then valid cURL creates a request with Ctrl/Cmd+Enter, invalid cURL shows an error, and Add without saving creates an unsaved node

---

## Scenario: PICKER-15: Target collection and folder selection

Given the New request tab
When I change the target collection and folder
Then the full path is shown, the folder resets with the collection, the request saves in the chosen folder and folder search appears above 8 folders

---

## Scenario: PICKER-16: Every entry point opens the same dialog

Given the chain canvas
When I use Add API, node after this, the pane menu and the empty overlay
Then the same dialog opens and closing resets search and selection but keeps the last tab

---

## Scenario: PICKER-17: Connect-drop adds and the empty overlay

Given a dragged connection or an empty chain
When I confirm or cancel the picker
Then the first new node joins the connection at the drop point, cancel discards it and the empty overlay disappears after adding

---

## Scenario: PICKER-18: Collections hydrate behind a skeleton

Given delayed collection loading
When I open the picker
Then a skeleton shows and settles without an error row

---

## Scenario: PICKER-19: Recent group lists recently run requests

Given recent run history
When I open the Collections tab, then search or filter
Then Recent lists up to 5 entries, and is hidden while filtering and when empty

---

## Scenario: PICKER-20: Footer hints keyboard use and tints selected rows

Given the open picker on first open
When I select rows and reopen
Then the hint shows once, selected rows are tinted and the hint stays dismissed

---

## Scenario: PICKER-21: Opening a 1,500 request picker is quick

Given 1,500 requests
When I open and type
Then the first render and search do not block

---

## Scenario: PICKER-22: The dialog is named and announces counts

Given the open picker
When I inspect it
Then it has a name, description and live regions for result and selection counts

---

## Scenario: PICKER-23: Every documented test id is present

Given the open picker
When I inspect its test ids
Then all documented picker test ids exist

---

## Scenario: PICKER-24: A New request draft survives tab switches

Given a half-typed New request draft
When I switch tabs and back, then close
Then the draft is kept across tabs and resets when the dialog closes

---

## Scenario: Marquee selects nodes and Align left lines them up

Given a chain with several nodes at different x positions
When I drag a marquee over the nodes and choose Align left
Then the marquee selects them and their left edges line up in one undo step

---

## Scenario: Cmd+F with canvas focus opens Find node and Enter selects the node

Given a chain with several nodes and the canvas focused
When I press Cmd/Ctrl+F, type a label and press Enter
Then Find node opens, the node is selected and centered, and the dialog closes

---

## Scenario: Arrow nudge moves the selection and one undo reverts the whole burst

Given a selected node on the canvas
When I press an arrow key several times quickly and then undo once
Then the node moves in 16px steps and one undo restores its original position

---

## Scenario: Hide tips persists after reload and Show tips restores them

Given a chain with the footer tips visible
When I hide the tips, reload, then choose Show tips in the ? overlay
Then the tips stay hidden after reload and return after Show tips

---

## Scenario: CANVAS-14: left-drag marquee selects, middle-drag pans, right-drag opens no menu

Given a chain with several nodes
When I left-drag the pane, middle-drag the pane and right-drag the pane
Then left-drag selects a marquee, middle-drag pans the viewport and right-drag opens no menu

---

## Scenario: CANVAS-15: snap toggle persists across reload and snaps drops to multiples of 16

Given snap to grid is off
When I drag a node, turn snap on, reload and drag again
Then the first drop is unsnapped, the toggle persists and the second drop lands on multiples of 16

---

## Scenario: CANVAS-16: Cmd/Ctrl+F opens Find node only with canvas focus; empty state; 60 nodes virtualize

Given a chain with 60 nodes
When I press Cmd/Ctrl+F with canvas focus and with focus elsewhere
Then Find node opens only with canvas focus and the 60-row list is virtualized

---

## Scenario: CANVAS-16: Find node stays inert on an empty chain (the canvas is unmounted)

Given an empty chain
When I press Cmd/Ctrl+F
Then Find node does not open

---

## Scenario: CANVAS-17: F fits the selection when nodes are selected, otherwise fits everything

Given a chain with nodes spread across the canvas
When I press F with a selection and again with none
Then F fits the selection first and then fits all nodes

---

## Scenario: CANVAS-18: arrows nudge 16px, Shift+arrow 160px, and a burst is one undo entry

Given a selected node
When I press Arrow and Shift+Arrow, bursting presses
Then the node moves 16px and 160px and a burst is a single undo entry

---

## Scenario: CANVAS-18: arrows do nothing without a selection or while typing in an input

Given no selection, or focus inside an input
When I press arrow keys
Then no node moves

---

## Scenario: CANVAS-19: align and distribute from the selection menu, distribute disabled for 2, one undo

Given a multi-node selection
When I open the selection menu and align or distribute
Then distribute is disabled for two nodes and each operation is one undo

---

## Scenario: CANVAS-20: a self-connection is muted and refused, and Success/Fail labels hide below 0.6 zoom

Given a chain with API nodes and Success/Fail edges
When I drag a connection onto its own node and zoom out below 0.6
Then the invalid target is muted and refused and the edge labels hide at low zoom

---

## Scenario: CANVAS-21: tips are contextual, dismiss persists across reload, warnings stay, Show tips lives in the ? overlay

Given a chain with footer tips and an unresolved variable
When I dismiss the tips and reload
Then only the unresolved-variables warning remains and Show tips in the ? overlay restores the tips

---

## Scenario: CANVAS-21: dismissed tips with nothing to warn about render no footer

Given dismissed tips and no warnings
When I view the chain page
Then no footer is rendered
