# Feature: Chains combining two or three block types

As a user composing small workflows
I want combined blocks to pass data, branch and recover correctly
So that typical multi-step flows behave as designed on the canvas and in the run log

Every scenario checks both the canvas state and the run log. Seeds are the "qa-e2e-med-*" chains.

---

## Scenario: [CHN-M-01] A list response feeds a detail request through a path injection

Given the seeded chain "qa-e2e-med-users-detail" injects the first user id into the detail path
When I run the chain
Then both requests pass
And the detail step URL contains id 1 and its Extracted tab lists the source path

---

## Scenario: [CHN-M-02] One token feeds a header and a query parameter

Given the seeded chain "qa-e2e-med-token-echo" has header and query injections
When I run the chain
Then the request passes
And its step input shows both injected values

---

## Scenario: [CHN-M-03] A failed request skips its success-routed follower

Given the seeded chain "qa-e2e-med-fail-echo" connects a failing request to a follower by a success edge
When I run the chain
Then the first request fails and the follower is skipped
And the log shows the upstream-skipped reason and a bar of one failed, one skipped

---

## Scenario: [CHN-M-04a] A fail handle routes to a recovery request

Given the seeded chain "qa-e2e-med-fail-recovery" connects a failing request to a recovery request by a fail edge
When I run the chain
Then the recovery request passes
And the edge labels show the fail routing

---

## Scenario: [CHN-M-04b] A success edge from a failed request is skipped

Given the seeded chain "qa-e2e-med-fail-recovery" also has a success-routed follower
When I run the chain
Then the success-routed follower is skipped
And the log shows its skipped reason

---

## Scenario: [CHN-M-05] A fail handle on a passing request is not taken

Given the seeded chain "qa-e2e-med-success-vs-fail" has a success follower A and a fail follower B
When I run the chain
Then A passes and B is skipped

---

## Scenario: [CHN-M-06] Independent requests report their own outcomes

Given the seeded chain "qa-e2e-med-parallel-mixed" has one failing and one passing independent request
When I run the chain
Then one node is failed and the other is passed
And the run is Failed with counts of one passed and one failed
And the Passed and Failed filters each show the matching step

---

## Scenario: [CHN-M-07] A high score takes the first branch

Given the seeded chain "qa-e2e-med-score-branch" has the score input 9 and a greater-than-5 condition
When I run the chain
Then branch A passes and branch B is skipped
And the Condition step names branch A

---

## Scenario: [CHN-M-08] Overriding the input at run time takes the other branch

Given the seeded chain "qa-e2e-med-score-branch" is open
When I run it with the score input overridden to 1
Then branch B passes and branch A is skipped
And the log shows the overridden input and distinguishes the two runs

---

## Scenario: [CHN-M-09] A Delay between requests keeps the order

Given the seeded chain "qa-e2e-med-delay-chain" has a 300 ms Delay between two requests
When I run the chain
Then all three nodes pass in order
And the Delay step lasts at least 300 ms

---

## Scenario: [CHN-M-10] A Display alias drives a Condition

Given the seeded chain "qa-e2e-med-display-condition" extracts a score into an alias used by the Condition
When I run the chain
Then the branch for score 7 is taken
And the Display Extracted tab shows the alias value

---

## Scenario: [CHN-M-11a] A Condition with three branches and an else takes the first for score 1

Given the seeded chain "qa-e2e-med-three-branch" is open
When I run it with score 1
Then the first branch's node passes and the rest are skipped
And the run card lists the first branch

---

## Scenario: [CHN-M-11b] The same Condition takes the second branch for score 5

Given the seeded chain "qa-e2e-med-three-branch" is open
When I run it with score 5
Then the second branch's node passes and the rest are skipped

---

## Scenario: [CHN-M-11c] The same Condition takes the third branch for score 9

Given the seeded chain "qa-e2e-med-three-branch" is open
When I run it with score 9
Then the third branch's node passes and the rest are skipped

---

## Scenario: [CHN-M-11d] The same Condition falls to the else path for score 99

Given the seeded chain "qa-e2e-med-three-branch" is open
When I run it with score 99
Then the else node passes and the branch nodes are skipped

---

## Scenario: [CHN-M-12] Two Conditions in parallel lanes decide independently

Given the seeded chain "qa-e2e-med-two-conditions" is open
When I run the chain
Then each lane takes its own branch
And the log shows lanes 0 and 1 with their respective branches

---

## Scenario: [CHN-M-13] A Merge joins the taken Condition branch

Given the seeded chain "qa-e2e-med-condition-merge" merges two branches in "any" mode before a request
When I run the chain
Then the Merge passes via the taken branch and the other branch is skipped
And the final request passes

---

## Scenario: [CHN-M-14] A Display alias is resolved in a downstream header

Given the seeded chain "qa-e2e-med-display-header" is open
When I run the chain
Then every node passes
And the downstream header holds the token and no unresolved warning shows

---

## Scenario: [CHN-M-15] Two Displays from one response feed two requests

Given the seeded chain "qa-e2e-med-two-displays" is open
When I run the chain
Then both requests pass
And each step input contains its own alias value

---

## Scenario: [CHN-M-16] Evaluate maps a list for a downstream request

Given the seeded chain "qa-e2e-med-eval-map" is open
When I run the chain
Then the Evaluate and request pass
And the Evaluate Extracted array appears in the request input

---

## Scenario: [CHN-M-17] An Evaluate result drives a Condition

Given the seeded chain "qa-e2e-med-eval-condition" doubles a score before a Condition
When I run the chain
Then the branch for 14 is taken
And the Evaluate Output shows 14

---

## Scenario: [CHN-M-18a] A passing Validate lets the next request run

Given the seeded chain "qa-e2e-med-validate-pass" is open
When I run the chain
Then the Validate and the following request pass

---

## Scenario: [CHN-M-18b] A failing Validate skips the next request

Given the seeded chain "qa-e2e-med-validate-fail" is open
When I run the chain
Then the Validate fails with an error list and the following request is skipped
And the run is Failed

---

## Scenario: [CHN-M-19] A Merge waits for the slower lane before continuing

Given the seeded chain "qa-e2e-med-merge-all-echo" has a fast and a medium-speed lane
When I run the chain
Then the final request starts only after the Merge passes
And the log order shows the Merge before the final request

---

## Scenario: [CHN-M-20] Aliases propagate across several requests

Given the seeded chain "qa-e2e-med-alias-relay" relays aliases through two Displays and three requests
When I run the chain
Then every node passes
And there are no unresolved variables

---

## Scenario: [CHN-M-21] Collected loop results feed a later request

Given the seeded chain "qa-e2e-med-loop-collect-echo" is open
When I run the chain
Then every node passes
And the final request input holds three collected items

---

## Scenario: [CHN-M-22] A Condition inside a Loop branches per iteration

Given the seeded chain "qa-e2e-med-loop-condition" branches on the iteration index
When I run the chain
Then the Loop passes
And the iteration rows show the branch each iteration took

---

## Scenario: [CHN-M-23] An Evaluate inside a Loop computes a value per iteration

Given the seeded chain "qa-e2e-med-loop-evaluate" multiplies the index by ten
When I run the chain
Then iteration outputs are 0, 10 and 20
And the Collect output is that array

---

## Scenario: [CHN-M-24] A Delay inside a Loop runs the iterations one after another

Given the seeded chain "qa-e2e-med-loop-delay" is open with concurrency 1
When I run the chain
Then the total duration is at least three delays
And the iterations appear in sequential order

---

## Scenario: [CHN-M-25] A Subchain returns an alias to its parent

Given the seeded chain "qa-e2e-med-sub-alias" runs a child that returns an alias before a request
When I run the chain
Then every node passes
And the request input holds the returned alias and nested rows are shown

---

## Scenario: [CHN-M-26] A Subchain whose child contains a Loop nests two levels in the log

Given the seeded chain "qa-e2e-med-sub-loop" is open
When I run the chain
Then every node passes
And the log shows subchain and iteration groups nested two levels

---

## Scenario: [CHN-M-27] A failed Validate blocks only its own branch

Given the seeded chain "qa-e2e-med-validate-recovery" has users feeding a failing Validate then main, and users also feeding a parallel recovery request
When I run the chain
Then the Validate is shown as failed and the main request is skipped
And the recovery request passes
And the run status is Failed

---

## Scenario: [CHN-M-28] Running from a node skips earlier nodes

Given the seeded chain "qa-e2e-med-three-requests" is open
When I run from the middle request
Then the first request is not re-run
And the new run is labelled "from here" and contains only the middle and last steps

---

## Scenario: [CHN-M-29] Running up to a node skips later nodes

Given the seeded chain "qa-e2e-med-three-requests" is open
When I run up to the middle request
Then the last request is not run
And the new run is labelled "up to" and contains only the first two steps

---

## Scenario: [CHN-M-30] Running a single node ignores upstream injection

Given the seeded chain "qa-e2e-med-token-echo" is open
When I run only the downstream request
Then it runs alone without the injected value
And its step input shows an unresolved-variable warning and the run is labelled "single"

---

## Scenario: [CHN-M-31] Stopping during a Delay aborts it and skips the rest

Given the seeded chain "qa-e2e-med-delay-long" has a 5000 ms Delay between two requests
When I run the chain and stop it while the Delay runs
Then the first request is passed, the Delay is aborted and the last request is skipped
And the bar shows Stopped with one passed, one aborted and one skipped

---

## Scenario: [CHN-M-32] Changing the Start value between runs changes the branch

Given the seeded chain "qa-e2e-cond-eq" is open
When I run it, change the Start value and run again
Then the second run takes the other branch
And the first run card is unchanged

---

## Scenario: [CHN-M-33] A stopped run followed by a re-run passes cleanly

Given the seeded chain "qa-e2e-med-delay-merge" is open
When I run it, stop it during the Delay and run again
Then the first run is Stopped and the second Passed
And no stale running badge remains

---

## Scenario: [CHN-M-34] Run history and iteration groups survive a reload

Given the seeded chain "qa-e2e-med-loop-collect-echo" is open
When I run it twice and reload the page
Then both runs are listed again
And their iteration groups can still be expanded

---

## Scenario: [CHN-M-35] A renamed child chain is reflected on the parent Subchain

Given the seeded chain "qa-e2e-med-request-sub-request" references a child chain
When I run it, rename the child and run again
Then the Subchain node and picker show the new name
And both runs are listed
