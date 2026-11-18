# Feature: Chain Merge, Loop, Collect and Subchain blocks

As a user building an API chain
I want to join parallel lanes, iterate arrays and nest chains
So that I can model fan-in, per-item work and reusable workflows

---

## Merge block

## Scenario: [CHN-S-MRG-01] Merge in "all" mode passes after both lanes pass

Given the seeded chain "qa-e2e-merge-all-ok" is open
When I run the chain
Then the Merge passes after both lanes finish
And the run log shows the two lanes and the Merge last

---

## Scenario: [CHN-S-MRG-02] Merge in "any" mode resolves on the first lane and skips the other

Given the seeded chain "qa-e2e-merge-any-ok" has a fast lane and a slow lane
When I run the chain
Then the slow lane is skipped
And the log shows the already-resolved skip

---

## Scenario: [CHN-S-MRG-03] The Merge mode can be toggled and persists

Given the seeded chain "qa-e2e-merge-all-ok" is open
When I switch the Merge to "any" mode and reload the page
Then the node label shows "any"
And the next run honours that mode

---

## Scenario: [CHN-S-MRG-04] "Any" mode still passes when the first lane fails

Given the seeded chain "qa-e2e-merge-any-first-fail" is open
When I run the chain
Then the Merge passes via the second lane
And the log shows one failed lane and one passed lane

---

## Scenario: [CHN-S-MRG-05] A Merge with one inbound edge blocks the run

Given the seeded chain "qa-e2e-merge-single-in" is open
Then the merge validation banner is visible
And the Run action is disabled and the run shortcut does nothing
And no run is created

---

## Scenario: [CHN-S-MRG-06] "All" mode fails when a lane fails

Given the seeded chain "qa-e2e-merge-all-fail" is open
When I run the chain
Then the Merge fails and its downstream is skipped
And the log names the cause

---

## Scenario: [CHN-S-MRG-07] A lane cut off by "any" mode is not counted as a result

Given the seeded chain "qa-e2e-merge-any-ok" is open
When I run the chain
Then the in-flight lane is shown as skipped or aborted
And the canvas and the run log agree on that state

---

## Scenario: [CHN-S-MRG-08] A Merge exposes combined lane results downstream

Given the seeded chain "qa-e2e-merge-all-ok" feeds a downstream request
When I run the chain
Then the Merge Output lists both lane bodies
And the downstream input resolves from them

---

## Loop block

## Scenario: [CHN-S-LOP-01] A three-item array iterates three times

Given the seeded chain "qa-e2e-loop-ok" is open
When I run the chain
Then the body and the Collect pass
And the run log shows three iterations

---

## Scenario: [CHN-S-LOP-02] A custom item alias is usable in the loop body

Given the seeded chain "qa-e2e-loop-ok" is open
When I set the item alias to "user" and use it in the body
And I run the chain
Then each iteration's input shows the current item

---

## Scenario: [CHN-S-LOP-03] A maximum lower than the array length truncates iterations

Given the seeded chain "qa-e2e-loop-ok" is open
When I set the maximum iterations to 2 and run
Then two iterations run
And a truncated warning is shown

---

## Scenario: [CHN-S-LOP-04] A source path selects a nested array

Given the seeded chain "qa-e2e-loop-ok" reads from an endpoint with a nested array
When I set the source path to that array and run
Then the number of iterations equals the nested array length

---

## Scenario: [CHN-S-LOP-05] The iteration index is available in the body

Given the seeded chain "qa-e2e-loop-alias-index" uses the index variable in the body
When I run the chain
Then the iterations see index 0, 1 and 2

---

## Scenario: [CHN-S-LOP-06] An empty array runs zero iterations

Given the seeded chain "qa-e2e-loop-empty" is open
When I run the chain
Then the Loop passes with no iterations
And the flow continues from the done output

---

## Scenario: [CHN-S-LOP-07a] A maximum above the cap is clamped or rejected

Given the seeded chain "qa-e2e-loop-max-cap" is open
When I enter a maximum of 5000
Then the panel clamps the value or shows an alert

---

## Scenario: [CHN-S-LOP-07b] A maximum of zero is clamped or rejected

Given the seeded chain "qa-e2e-loop-max-cap" is open
When I enter a maximum of 0
Then the panel clamps the value or shows an alert
And a run with that value fails with the invalid-maximum error code

---

## Scenario: [CHN-S-LOP-08] A source that is not an array fails the Loop

Given the seeded chain "qa-e2e-loop-notarray" is open
When I run the chain
Then the Loop fails with the not-an-array error code

---

## Scenario: [CHN-S-LOP-09a] The panel rejects a reserved item alias

Given the seeded chain "qa-e2e-loop-alias-bad" is open
When I enter "index" as the item alias
Then an alert is shown and saving is blocked

---

## Scenario: [CHN-S-LOP-09b] A seeded invalid alias fails at run time

Given the seeded chain "qa-e2e-loop-alias-bad" already contains the alias "index"
When I run the chain
Then the Loop fails with the invalid-alias error code
And the body is skipped

---

## Scenario: [CHN-S-LOP-10] A failing iteration leaves the Loop passed with a warning

Given the seeded chain "qa-e2e-loop-iter-fail" has one failing item
When I run the chain
Then the Loop shows as passed with a failed-iterations warning
And the log shows a mix of passed and failed iteration rows

---

## Scenario: [CHN-S-LOP-11] A Loop without upstream fails

Given the seeded chain "qa-e2e-loop-noup" is open
When I run the chain
Then the Loop fails with the no-upstream error code

---

## Scenario: [CHN-S-LOP-12] A Loop without a paired Collect blocks the run

Given the seeded chain "qa-e2e-loop-unpaired" is open
Then the unpaired-loop banner is visible
And the Run action is disabled and no run is created

---

## Scenario: [CHN-S-LOP-13] Loops nested three deep run normally

Given the seeded chain "qa-e2e-loop-nested3" is open
When I run the chain
Then no nesting banner is shown and every node passes
And the log shows iterations at three levels

---

## Scenario: [CHN-S-LOP-14] Loops nested four deep show a banner and block the run

Given the seeded chain "qa-e2e-loop-nested4" is open
Then the nesting-depth banner is visible
And the Run action is disabled and no run is created

---

## Scenario: [CHN-S-LOP-15] The default maximum is shown for an untouched Loop

Given the seeded chain "qa-e2e-loop-ok" is open
When I open the Loop panel
Then the maximum iterations field shows the default value

---

## Scenario: [CHN-S-LOP-16] The done output continues after the Collect

Given the seeded chain "qa-e2e-loop-ok" has a request after the Collect
When I run the chain
Then the tail request passes after the Collect
And its input uses the collected array

---

## Scenario: [CHN-S-LOP-17] Re-running a Loop shows only the new run's iterations

Given the seeded chain "qa-e2e-loop-ok" is open
When I run the chain twice
Then each run card shows its own three iterations and no stale ones

---

## Collect block

## Scenario: [CHN-S-COL-01] Collect gathers every iteration output

Given the seeded chain "qa-e2e-loop-ok" is open
When I run the chain
Then the Collect passes after the Loop
And its Output is an array of three items

---

## Scenario: [CHN-S-COL-02] Duplicating a Loop duplicates and pairs its Collect

Given the seeded chain "qa-e2e-loop-ok" is open
When I select the Loop and duplicate it
Then the canvas has two Loops and two Collects
And each Loop is paired with its own Collect

---

## Scenario: [CHN-S-COL-03] Collect of an empty loop returns an empty list

Given the seeded chain "qa-e2e-loop-empty" is open
When I run the chain
Then the Collect passes
And its Output is an empty array

---

## Scenario: [CHN-S-COL-04] A Collect with no loop result is skipped

Given the seeded chain "qa-e2e-loop-ok" has its Loop-to-Collect link removed
When I run the chain
Then the Collect is skipped with the no-loop-result code

---

## Scenario: [CHN-S-COL-05] An unresolved Collect blocks the run

Given the seeded chain "qa-e2e-loop-ok" has an extra, unpaired Collect
Then the unresolved-collect banner is visible
And the Run action is disabled and no run is created

---

## Scenario: [CHN-S-COL-06a] The Collect panel shows its paired Loop

Given the seeded chain "qa-e2e-loop-ok" is open
When I open the Collect panel
Then it names the paired Loop

---

## Scenario: [CHN-S-COL-06b] Deleting the Loop also removes its paired Collect

Given the seeded chain "qa-e2e-loop-ok" is open
When I delete the Loop
Then its paired Collect is removed with it
And no unresolved-collect banner appears

---

## Subchain block

## Scenario: [CHN-S-SUB-01] A parent runs its child chain inline

Given the seeded chain "qa-e2e-sub-parent-ok" is open
When I run the chain
Then the Subchain passes
And the log shows the child's steps nested under it

---

## Scenario: [CHN-S-SUB-02] An input binding can be a literal

Given the seeded chain "qa-e2e-sub-parent-bind" binds a literal to a child input
When I run the chain
Then the child's Start input equals the literal

---

## Scenario: [CHN-S-SUB-03] An input binding can come from an upstream alias

Given the seeded chain "qa-e2e-sub-parent-bind" binds an alias from an upstream block
When I run the chain
Then the child receives the resolved alias value

---

## Scenario: [CHN-S-SUB-04] The referenced chain can be changed from the picker

Given the seeded chain "qa-e2e-sub-parent-ok" is open
When I pick a different chain in the Subchain picker
Then the node shows the new chain name
And the next run executes the new child

---

## Scenario: [CHN-S-SUB-05] A child chain with nothing to run is flagged

Given the seeded chain "qa-e2e-sub-parent-empty" references an empty chain
Then the invalid-subchain banner is visible or the run fails with an explicit error

---

## Scenario: [CHN-S-SUB-06] A deleted child chain is reported as unresolved

Given the seeded chain "qa-e2e-sub-parent-missing" references a chain that no longer exists
When I open it and try to run
Then the run is blocked or fails with the reference-unresolved code

---

## Scenario: [CHN-S-SUB-07] Subchains nested beyond five levels fail

Given the seeded chain "qa-e2e-sub-parent-deep6" is open
When I run the chain
Then the deepest Subchain fails with the depth-exceeded code

---

## Scenario: [CHN-S-SUB-08] A failing child step fails the parent

Given the seeded chain "qa-e2e-sub-parent-fail" is open
When I run the chain
Then the Subchain fails and its downstream is skipped
And the nested failed step is visible in the log

---

## Scenario: [CHN-S-SUB-09] A chain cannot reference itself

Given the seeded chain "qa-e2e-sub-parent-self" references itself
Then the run is blocked by a banner or fails with a circular-dependency code

---

## Scenario: [CHN-S-SUB-10] The picker excludes the current chain and filters by name

Given the seeded chain "qa-e2e-sub-parent-ok" is open
When I open the Subchain picker and search by name
Then the current chain is not listed
And the list is narrowed by the search

---

## Scenario: [CHN-S-SUB-11] A failing child surfaces as a subchain failure on the parent step

Given the seeded chain "qa-e2e-sub-parent-fail" is open
When I run the chain
Then the parent step shows the subchain-failed error code
And the nested failed step is visible
