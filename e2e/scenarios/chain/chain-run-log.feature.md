# Feature: Chain run log and results bar

As a user running chains
I want the run log and results bar to show every state, filter, detail and history action clearly
So that I can understand what happened in each run and manage past runs

Seeds are the shared "qa-polish-*" chains or the "qa-e2e-*" chains named in each scenario.

---

## Scenario: [CHN-LOG-01] A never-run chain shows the idle empty state

Given the seeded chain "qa-polish-never-run" is open
Then the run log shows its never-run empty state
And the results bar says there are no runs

---

## Scenario: [CHN-LOG-02] A running chain shows live progress

Given the seeded chain "qa-e2e-api-slow" is open
When I run the chain
Then the bar shows Running with step progress and a running indicator
And the running step has a running badge and the Stop action is visible
And the Run action is disabled

---

## Scenario: [CHN-LOG-03] A passing run shows Passed everywhere

Given the seeded chain "qa-e2e-api-single" is open
When I run the chain
Then the run card, the page header count and the results bar all show Passed

---

## Scenario: [CHN-LOG-04] A failing run shows Failed with its failed count

Given the seeded chain "qa-e2e-api-fail500" is open
When I run the chain
Then the run card, the page header and the results bar all show Failed with the failed count

---

## Scenario: [CHN-LOG-05] Skipped steps are styled and counted

Given the seeded chain "qa-e2e-bug-cond-ge" is open
When I run the chain
Then the skipped row is styled as skipped
And the Skipped tab shows its count

---

## Scenario: [CHN-LOG-06] A stopped run shows aborted steps

Given the seeded chain "qa-e2e-delay-long" is open
When I run the chain and stop it
Then the aborted step is shown with a Stopped tone
And the Failed filter includes the aborted step

---

## Scenario: [CHN-LOG-07] Filter tab counts match the rows they show

Given the seeded chain "qa-polish-run-log" has a failed run selected
When I switch between the All, Passed, Failed and Skipped tabs
Then each tab shows exactly as many rows as its count

---

## Scenario: [CHN-LOG-08] Tabs with no rows are hidden

Given the seeded chain "qa-polish-run-log" has a fully passed run selected
Then no Failed tab is shown

---

## Scenario: [CHN-LOG-09] The active filter falls back to All when it empties

Given the seeded chain "qa-e2e-api-fail500" has the Failed filter active
When a passing re-run replaces the failure
Then the All tab becomes active

---

## Scenario: [CHN-LOG-10] The filter follows the selected run

Given the seeded chain "qa-polish-run-log" has several runs
When I switch between runs with different outcomes
Then the filter and rows reflect the selected run

---

## Scenario: [CHN-LOG-11] Search finds steps by label

Given the seeded chain "qa-e2e-cx-auth-pipeline" has been run
When I search for a step's label
Then only matching steps are shown and the tab counts are unchanged

---

## Scenario: [CHN-LOG-12a] Search finds steps by error code

Given the seeded chain "qa-e2e-cx-gauntlet" has been run
When I search for an error code
Then only steps with that error code are shown

---

## Scenario: [CHN-LOG-12b] Search finds steps by HTTP status

Given the seeded chain "qa-e2e-cx-gauntlet" has been run
When I search for the status 500
Then only steps with that status are shown

---

## Scenario: [CHN-LOG-13] A search with no results shows a message and Escape clears it

Given the seeded chain "qa-e2e-cx-auth-pipeline" has been run
When I search for text that matches nothing and then press Escape
Then a no-results message appears
And Escape clears the search and shows all rows

---

## Scenario: [CHN-LOG-14] A step's Input tab shows what was sent

Given the seeded chain "qa-e2e-api-inject-hdr" has been run
When I open the downstream step's Input tab
Then it shows the request URL and headers

---

## Scenario: [CHN-LOG-15] A step's Output tab shows JSON or raw text

Given the seeded chain "qa-e2e-api-text" has been run
When I open the step's Output tab
Then the raw response text is shown

---

## Scenario: [CHN-LOG-16] A step's Assertions tab shows passed and failed labels

Given the seeded chain "qa-e2e-api-assert-fail" has been run
When I open the step's Assertions tab
Then each assertion is labelled passed or failed

---

## Scenario: [CHN-LOG-17] A step's Extracted tab lists injected values

Given the seeded chain "qa-e2e-api-inject-hdr" has been run
When I open the downstream step's Extracted tab
Then the injected value is listed

---

## Scenario: [CHN-LOG-18] Loop iterations can be expanded and collapsed

Given the seeded chain "qa-e2e-loop-ok" has been run
When I toggle an iteration group
Then its rows expand and collapse
And a nested step's detail can be selected

---

## Scenario: [CHN-LOG-19] Subchain steps can be expanded and collapsed

Given the seeded chain "qa-e2e-sub-parent-ok" has been run
When I toggle the subchain group
Then its nested rows expand and collapse

---

## Scenario: [CHN-LOG-20] Unresolved variables are listed on the step and the node footer

Given the seeded chain "qa-e2e-cond-eq" has an absent input
When I run the chain
Then the step lists the unresolved variables
And the node footer shows the same variables

---

## Scenario: [CHN-LOG-21] A deleted run can be restored within the undo window

Given the seeded chain "qa-polish-run-log" is open
When I delete a run and undo within six seconds
Then the run is restored

---

## Scenario: [CHN-LOG-22] A deleted run stays deleted after reload

Given the seeded chain "qa-polish-run-log" is open
When I delete a run without undoing and reload
Then the run is still gone

---

## Scenario: [CHN-LOG-23a] Cancelling the clear-all confirmation keeps the runs

Given the seeded chain "qa-polish-run-log" has several runs
When I choose to clear all runs and then cancel
Then all runs remain

---

## Scenario: [CHN-LOG-23b] Confirming clear-all removes every run and keeps the graph

Given the seeded chain "qa-polish-run-log" has several runs
When I choose to clear all runs and confirm
Then the run list shows its empty state
And the graph is intact and pending deletions are finalised

---

## Scenario: [CHN-LOG-24] Clearing run results resets canvas badges but keeps history

Given the seeded chain "qa-e2e-api-single" has been run
When I clear the run results from the header menu
Then the canvas badges disappear
And the run list still contains the run

---

## Scenario: [CHN-LOG-25] The Stop button cancels a running chain

Given the seeded chain "qa-e2e-api-slow" is running
When I press Stop
Then the run is Stopped
And no late response changes node states

---

## Scenario: [CHN-LOG-26] The cancel shortcut stops a running chain

Given the seeded chain "qa-e2e-api-slow" is running
When I press the cancel shortcut
Then the run is Stopped as if Stop had been pressed

---

## Scenario: [CHN-LOG-27] Running again right after cancelling works

Given the seeded chain "qa-e2e-api-slow" was just stopped
When I run the chain again immediately
Then a new run starts and the stopped run stays Stopped

---

## Scenario: [CHN-LOG-28] A full re-run from the run card menu creates a new run

Given the seeded chain "qa-polish-run-log" has a completed run
When I choose Re-run from the run card menu
Then a new run appears with the same trigger

---

## Scenario: [CHN-LOG-29a] Re-running an "up to" run keeps the same subset

Given the seeded chain "qa-e2e-med-three-requests" has a run triggered "up to" the middle node
When I re-run it from the run card menu
Then the new run contains the same steps

---

## Scenario: [CHN-LOG-29b] Re-running a "from here" run keeps the same subset

Given the seeded chain "qa-e2e-med-three-requests" has a run triggered "from here" at the middle node
When I re-run it from the run card menu
Then the new run contains the same steps

---

## Scenario: [CHN-LOG-29c] Re-running a "single" run keeps the same node

Given the seeded chain "qa-e2e-med-three-requests" has a single-node run
When I re-run it from the run card menu
Then the new run contains only that node

---

## Scenario: [CHN-LOG-30] Re-run is disabled when its anchor node was deleted

Given the seeded chain "qa-polish-run-log" has a run whose anchor node no longer exists
When I open the run card menu
Then Re-run is disabled

---

## Scenario: [CHN-LOG-31] The page header status follows each run state

Given the seeded chains "qa-e2e-api-single" and "qa-e2e-api-fail500" are run in turn
Then the page header status text and tone reflect Passed then Failed

---

## Scenario: [CHN-LOG-32] The run log tolerates a node deleted after the run

Given the seeded chain "qa-e2e-api-single" has been run
When I delete the node
Then the run log shows a removed-node marker for its step
And nothing crashes

---

## Scenario: [CHN-LOG-33a] The collapsed state of the dock persists across reload

Given the seeded chain "qa-e2e-api-single" has been run
When I collapse the run log and reload
Then the dock is still collapsed and its bar shows the run status

---

## Scenario: [CHN-LOG-33b] The dock height persists across reload

Given the seeded chain "qa-e2e-api-single" has been run
When I resize the run log and reload
Then the dock keeps its new height

---

## Scenario: [CHN-LOG-34] Switching runs from the run selector replaces the details

Given the seeded chain "qa-polish-run-log" has several runs with a step detail open
When I pick an older run from the run selector
Then the summary and rows swap to that run
And no stale step detail remains

---

## Scenario: [CHN-LOG-35a] A full run card shows its trigger and duration

Given the seeded chain "qa-e2e-med-three-requests" is open
When I run the whole chain
Then the run card shows the full trigger label and a duration

---

## Scenario: [CHN-LOG-35b] A single-node run card shows its trigger

Given the seeded chain "qa-e2e-med-three-requests" is open
When I run a single node
Then the run card shows the single trigger label

---

## Scenario: [CHN-LOG-35c] A "from here" run card shows its trigger

Given the seeded chain "qa-e2e-med-three-requests" is open
When I run from a node
Then the run card shows the from-here trigger label

---

## Scenario: [CHN-LOG-35d] An "up to" run card shows its trigger

Given the seeded chain "qa-e2e-med-three-requests" is open
When I run up to a node
Then the run card shows the up-to trigger label

---

## Scenario: [CHN-LOG-36] A run with over fifty rows stays searchable and scrollable

Given the seeded chain "qa-e2e-loop-large" iterates over sixty items
When I run the chain and search for the last item
Then that row is reachable
And the run shows sixty iterations

---

## Scenario: [CHN-LOG-37] Only the newest fifty runs are kept per chain

Given the seeded chain "qa-e2e-api-single" already has fifty runs
When I run it once more
Then the list still holds fifty runs with the newest first
And the oldest is gone

---

## Scenario: [CHN-LOG-38] Step detail values can be copied and Escape closes the pane

Given the seeded chain "qa-e2e-api-inject-hdr" has been run
When I open a step's detail, copy a value and press Escape
Then the clipboard holds the value
And the detail pane closes

---

## Scenario: [CHN-LOG-39] The failed-run summary links to the first failing step

Given the seeded chain "qa-e2e-api-fail500" is open
When I run it and follow the failure link in the run summary
Then the failing step is selected and scrolled into view
