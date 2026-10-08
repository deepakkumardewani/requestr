# Feature: Realistic end-to-end chain flows

As a user running production-style workflows
I want large chains with branching, loops, subchains, failures and cancellation to behave predictably
So that I can rely on the results bar, run history and canvas states together

Seeds are the "qa-e2e-cx-*" chains. The results bar is checked from Running to its final state in each scenario.

---

## Scenario: [CHN-C-01] An authenticated data pipeline passes end to end

Given the seeded chain "qa-e2e-cx-auth-pipeline" runs token, Display, users, Validate, Evaluate and echo requests
When I run the chain
Then all seven nodes pass and the bar reports Passed
And the Display and Evaluate Extracted tabs show the chained aliases

---

## Scenario: [CHN-C-02] Fan-out, merge and branching show the right lanes and skips

Given the seeded chain "qa-e2e-cx-fanout-merge" branches on a Start input into a parallel-then-merge path and a delay path
When I run it twice, flipping the input between runs
Then each run shows its lanes and its skipped branch
And the Passed and Skipped filters match the visible rows

---

## Scenario: [CHN-C-03] A loop with per-item validation and one failing item completes with a warning

Given the seeded chain "qa-e2e-cx-loop-validate-partial" validates each item and one item fails
When I run the chain
Then the Loop passes with a warning and the Collect handles the result
And the Failed filter shows the nested failed row and the bar shows the failed count

---

## Scenario: [CHN-C-04] Nested loops with a Condition and a Subchain run to completion

Given the seeded chain "qa-e2e-cx-nested-loops-sub" loops over three users, each running a child loop of two tags
When I run the chain
Then every node passes and no depth banner is shown
And the log nests three outer iterations, each with a subchain holding two inner iterations
And the search for the echo request returns six rows
And the outer Collect output has three items

---

## Scenario: [CHN-C-05a] A failed request recovers through its fail handle

Given the seeded chain "qa-e2e-cx-recovery" has a 500 request with a fail path to a recovery request, merged with a success path
When I run the chain
Then the first request fails, the recovery and success paths pass and the Merge resolves
And the Failed filter lists only the first request
And the page header shows the Failed status

---

## Scenario: [CHN-C-05b] The same flow skips recovery when the first request passes

Given the seeded chain "qa-e2e-cx-recovery-ok" has a first request that passes
When I run the chain
Then the recovery branch is skipped and the Merge resolves via the success path
And the page header shows the Passed status

---

## Scenario: [CHN-C-06] Stopping a wide parallel run and re-running it

Given the seeded chain "qa-e2e-cx-wide-cancel" has four slow parallel lanes, a Condition, a Loop and a Merge
When I run the chain and see at least two lanes running at once
And I stop the run
Then running nodes are aborted, unstarted ones skipped, and the bar and header show Stopped
And re-running from the run card produces a new Passed run
And the run list shows Stopped then Passed

---

## Scenario: [CHN-C-07] Every kind of failure at once is listed and searchable

Given the seeded chain "qa-e2e-cx-gauntlet" has six parallel branches each ending in a different error code
When I run the chain
Then the Failed filter lists all six failures with their error lines
And searching for an error code narrows the list to that step
And the run is Failed

---

## Scenario: [CHN-C-08] Composed subchains with bound inputs and subset re-runs

Given the seeded chain "qa-e2e-cx-sub-compose" runs two bound subchains, a Delay and a request
When I run it, re-run from the second Subchain and run the last request alone
Then the bindings flow from the Start input through both subchains
And three runs are listed with distinct trigger labels

---

## Scenario: [CHN-C-09] A complex run's history survives a reload and can be cleared

Given the seeded chain "qa-e2e-cx-fanout-merge" has been run twice with flipped inputs
When I reload the page
Then both runs are restored with trigger labels and expandable nested groups
And the filter resets to All, the latest run is selected and canvas badges are restored
And clearing run results removes badges but keeps both runs
And clearing all runs empties the list and leaves the graph intact

---

## Scenario: [CHN-C-10] Structural edits around a complex run are reflected in later runs

Given the seeded chain "qa-e2e-cx-auth-pipeline" has run with seven passed steps
When I delete the Evaluate node and run again
Then the log marks the removed node and the second run's counts differ
And undoing the deletion and running again restores the original counts
And three runs are listed each with the right status and repeated undo and redo cause no console error
