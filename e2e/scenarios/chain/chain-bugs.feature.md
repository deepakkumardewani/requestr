# Feature: Chain defect verification

As a maintainer of the chain feature
I want known suspected defects pinned by scenarios that assert the desired behaviour
So that confirmed bugs get regression coverage and intentional behaviour is documented

Seeds are the "qa-e2e-bug-*" chains. Items whose desired behaviour is still undecided are marked as pending a product decision.

---

## Scenario: [CHN-BUG-01a] A greater-than-or-equal condition takes its branch on equality

Given the seeded chain "qa-e2e-bug-cond-ge" has ">= 5" and the input 5
When I run the chain
Then its branch is taken instead of failing silently with no match

---

## Scenario: [CHN-BUG-01b] A less-than-or-equal condition takes its branch on equality

Given the seeded chain "qa-e2e-bug-cond-le" has "<= 5" and the input 5
When I run the chain
Then its branch is taken instead of failing silently with no match

---

## Scenario: [CHN-BUG-02a] Duplicating a Condition behaves the same from the menu and the shortcut

Given the seeded chain "qa-e2e-bug-duplicate" has a Condition selected
When I open its context menu and use the duplicate shortcut
Then the menu offers duplicate exactly when the shortcut duplicates (pending a product decision)

---

## Scenario: [CHN-BUG-02b] Duplicating a Delay behaves the same from the menu and the shortcut

Given the seeded chain "qa-e2e-bug-duplicate" has a Delay selected
When I open its context menu and use the duplicate shortcut
Then the menu offers duplicate exactly when the shortcut duplicates (pending a product decision)

---

## Scenario: [CHN-BUG-03] Duplicating a lone Collect does not leave an orphan

Given the seeded chain "qa-e2e-bug-collect-dup" has only a Collect selected
When I duplicate it
Then no orphan Collect appears, or a banner explains it
And the Run action state matches the banner

---

## Scenario: [CHN-BUG-04] Deleting only the Collect unpairs the Loop and can be undone

Given the seeded chain "qa-e2e-bug-collect-delete" is open
When I delete the Collect
Then the unpaired-loop banner appears and Run is disabled
And undoing the delete restores the Collect and enables Run

---

## Scenario: [CHN-BUG-05a] Blocks that cannot be copied are refused with a toast

Given the seeded chain "qa-e2e-bug-clipboard" contains Loop, Merge, Subchain, Collect and request blocks
When I copy and paste each of them
Then a toast says the block cannot be copied and no node is added

---

## Scenario: [CHN-BUG-05b] Supported blocks paste slightly offset

Given the seeded chain "qa-e2e-bug-clipboard" contains Delay, Condition, Display, Evaluate and Validate blocks
When I copy and paste each of them
Then each pasted copy appears offset from the original

---

## Scenario: [CHN-BUG-06] A loop with a failing iteration is documented as passed with a warning

Given the seeded chain "qa-e2e-bug-loop-iter-fail" has one failing item
When I run the chain
Then the Loop is passed with a failed-iterations warning on the canvas and in the log
And the failed iteration row is visible

---

## Scenario: [CHN-BUG-07] Loop nesting across a subchain stays bounded (pending a product decision)

Given the seeded chain "qa-e2e-bug-loop-sub-depth" nests loops partly inside a child chain
When I run the chain
Then the nesting limit is enforced by a failed step or banner and never runs unbounded

---

## Scenario: [CHN-BUG-08] A bad JSONPath edge leaves a visible explanation on the skipped step (pending a product decision)

Given the seeded chain "qa-e2e-bug-bad-jsonpath" is open
When I run the chain
Then the target is skipped
And the step shows a visible warning or error line even though the run ends Passed

---

## Scenario: [CHN-BUG-09] A Display with two inbound edges is consistent between gating and execution (pending a product decision)

Given the seeded chain "qa-e2e-bug-display-two-inputs" is open
When I try to run the chain
Then the run is blocked, or only the first source is used with a visible notice

---

## Scenario: [CHN-BUG-10] A single-node run on an injected edge is documented to ignore the injection

Given the seeded chain "qa-e2e-bug-single-injected" is open
When I run only the downstream node
Then the injection is ignored
And the step input shows an unresolved-variable warning

---

## Scenario: [CHN-BUG-11a] Pressing Escape cancels block placement

Given the seeded chain "qa-e2e-api-single" is open with a block waiting to be placed
When I press Escape
Then the placement is cancelled and the node count is unchanged

---

## Scenario: [CHN-BUG-11b] Clicking toolbar UI does not place a pending block

Given the seeded chain "qa-e2e-api-single" is open with a block waiting to be placed
When I click a toolbar control
Then no stray node is placed

---

## Scenario: [CHN-BUG-12] A Merge in "any" mode shows its in-flight lane consistently (pending a product decision)

Given the seeded chain "qa-e2e-bug-merge-any-slow" has a slow lane still running when the Merge resolves
When I run the chain
Then the lane is shown as skipped or aborted the same way on the canvas and in the log

---

## Scenario: [CHN-BUG-13] A dismissed banner reappears after the graph changes

Given the seeded chain "qa-e2e-bug-banner-dismiss" shows a dismissible banner
When I dismiss it and then edit the graph so its signature changes
Then the banner appears again

---

## Scenario: [CHN-BUG-14a] A run deleted without undo stays deleted after reload

Given the seeded chain "qa-polish-run-log" is open
When I delete a run, let the undo window pass and reload
Then the run is gone
And undo is no longer offered

---

## Scenario: [CHN-BUG-14b] Clearing runs finalises pending deletions

Given the seeded chain "qa-polish-run-log" has a run awaiting an undo window
When I clear all runs and reload
Then the run list is empty

---

## Scenario: [CHN-BUG-15] A second Start block is refused with a toast and nothing changes after reload

Given the seeded chain "qa-e2e-start-literal" is open
When I try to add a second Start block and reload
Then the toast explained the limit
And the chain still has a single Start

---

## Scenario: [CHN-BUG-16a] The Loop panel rejects the alias "index"

Given the seeded chain "qa-e2e-loop-alias-bad" is open
When I enter "index" as the item alias
Then an alert is shown and saving is blocked

---

## Scenario: [CHN-BUG-16b] The Loop panel rejects an alias starting with a digit

Given the seeded chain "qa-e2e-loop-alias-bad" is open
When I enter "1abc" as the item alias
Then an alert is shown and saving is blocked

---

## Scenario: [CHN-BUG-17] The Failed filter falls back to All after a passing re-run

Given the seeded chain "qa-e2e-api-fail500" is open with the Failed filter active
When the request is fixed and the chain re-runs successfully
Then the filter falls back to All
And the passing rows are visible rather than an empty list

---

## Scenario: [CHN-BUG-18a] Nudging and auto-layout are ignored during a run

Given the seeded chain "qa-e2e-api-slow" is running
When I press the nudge and auto-layout keys
Then no node moves

---

## Scenario: [CHN-BUG-18b] Canvas shortcuts are ignored while typing in an input

Given the seeded chain "qa-e2e-api-single" is open with an input focused
When I type text that includes shortcut keys
Then no canvas shortcut fires

---

## Scenario: [CHN-BUG-19] Nudging a node right after load does not trigger a canvas warning

Given the seeded chain "qa-e2e-api-single" has just finished loading
When I nudge a node with the arrow keys once the canvas is ready
Then the node moves
And no canvas warning appears in the console
