# Feature: Chain Condition, Display, Evaluate and Validate blocks

As a user building an API chain
I want logic blocks to branch, extract, transform and validate data
So that I can route and check responses without writing glue code

Condition chains are Start(score) feeding a Condition whose branches lead to different requests, so the taken branch shows as passed and the others as skipped.

---

## Condition block

## Scenario: [CHN-S-CND-01] An equality branch is taken when its expression matches

Given the seeded chain "qa-e2e-cond-eq" is open
When I run the chain
Then the matching branch's request is passed and the others are skipped
And the Condition step names the taken branch
And the non-taken steps show as skipped because their upstream was skipped

---

## Scenario: [CHN-S-CND-02] A not-equal branch is taken for a different value

Given the seeded chain "qa-e2e-cond-neq" is open
When I run the chain
Then the not-equal branch's request passes and the others are skipped

---

## Scenario: [CHN-S-CND-03] A greater-than branch compares numbers

Given the seeded chain "qa-e2e-cond-gt" is open
When I run the chain
Then the greater-than branch's request passes and the others are skipped

---

## Scenario: [CHN-S-CND-04] A less-than branch compares numbers

Given the seeded chain "qa-e2e-cond-lt" is open
When I run the chain
Then the less-than branch's request passes and the others are skipped

---

## Scenario: [CHN-S-CND-05] A contains branch matches on substrings

Given the seeded chain "qa-e2e-cond-contains" is open
When I run the chain
Then the contains branch's request passes and the others are skipped

---

## Scenario: [CHN-S-CND-06] Adding and removing branches updates the node handles

Given the seeded chain "qa-e2e-cond-multi" is open
When I add a branch, remove another and save the Condition panel
Then the node shows one output handle per branch plus the else handle

---

## Scenario: [CHN-S-CND-07] The else path is taken when no branch matches

Given the seeded chain "qa-e2e-cond-else" is open
When I run the chain
Then the else path's request passes
And the Condition step shows the else outcome

---

## Scenario: [CHN-S-CND-08] A numeric value and its string form give the same outcome

Given the seeded chain "qa-e2e-cond-eq" is open
When I run it once with the input 7 and once with the input "7"
Then both runs take the same branch

---

## Scenario: [CHN-S-CND-09] An unresolved variable is flagged on the Condition

Given the seeded chain "qa-e2e-cond-eq" is open and the input the condition reads is absent
When I run the chain
Then the node footer lists the unresolved variable
And the run log step lists it as unresolved

---

## Scenario: [CHN-S-CND-10] No matching branch and no else fails the Condition

Given the seeded chain "qa-e2e-cond-nomatch" is open
When I run the chain
Then the Condition shows as failed and its descendants are skipped
And the step shows the no-branch-matched error code
And the run is Failed

---

## Scenario: [CHN-S-CND-11a] A greater-than-or-equal comparison takes its branch on equality

Given the seeded chain "qa-e2e-cond-ge" has the expression ">= 5" and the input 5
When I run the chain
Then the greater-or-equal branch passes and the other is skipped
And the Condition step names the taken branch

---

## Scenario: [CHN-S-CND-11b] A less-than-or-equal comparison takes its branch on equality

Given the seeded chain "qa-e2e-cond-ge" has the expression "<= 5" and the input 5
When I run the chain
Then the less-or-equal branch passes and the other is skipped

---

## Scenario: [CHN-S-CND-12] A non-numeric operand never causes an uncaught error

Given the seeded chain "qa-e2e-cond-badnum" compares the text "abc" with ">"
When I run the chain
Then the outcome is the else path or a no-branch-matched failure
And no console error occurs

---

## Scenario: [CHN-S-CND-13] The first listed matching branch wins and labels can be edited

Given the seeded chain "qa-e2e-cond-multi" has two overlapping branches
When I edit the branch labels and run the chain
Then the handle labels show the edits
And the first listed branch is taken and the second is skipped

---

## Display block

## Scenario: [CHN-S-DSP-01] Display extracts a token into a header alias

Given the seeded chain "qa-e2e-disp-header" is open
When I run the chain
Then every node is passed
And the Display step's Extracted tab shows the value

---

## Scenario: [CHN-S-DSP-02] Display can target the URL

Given the seeded chain "qa-e2e-disp-url" is open
When I run the chain
Then the downstream URL contains the extracted value

---

## Scenario: [CHN-S-DSP-03] Display can target the path

Given the seeded chain "qa-e2e-disp-path" is open
When I run the chain
Then the downstream path contains the extracted value

---

## Scenario: [CHN-S-DSP-04] Display can target a header

Given the seeded chain "qa-e2e-disp-header" is open
When I run the chain
Then the downstream request carries the extracted header

---

## Scenario: [CHN-S-DSP-05] Display can target the body

Given the seeded chain "qa-e2e-disp-body" is open
When I run the chain
Then the downstream body contains the extracted value

---

## Scenario: [CHN-S-DSP-06] A Display alias resolves downstream without warnings

Given the seeded chain "qa-e2e-disp-header" uses its alias as a variable downstream
When I run the chain
Then the alias resolves
And no unresolved-variable warning is shown

---

## Scenario: [CHN-S-DSP-07] A Display with several inputs blocks the run

Given the seeded chain "qa-e2e-disp-multi-in" has two sources feeding one Display
Then the multiple-inputs banner is shown
And the Run button is disabled

---

## Scenario: [CHN-S-DSP-08] A Display without a source fails

Given the seeded chain "qa-e2e-disp-nosrc" has a Display with no inbound edge
When I run the chain
Then the run is blocked or the Display fails with the no-source error code

---

## Scenario: [CHN-S-DSP-09] A Display with an empty path fails

Given the seeded chain "qa-e2e-disp-nopath" is open
When I run the chain
Then the Display shows as failed with the no-path error code

---

## Scenario: [CHN-S-DSP-10] A Display whose path misses fails and skips downstream

Given the seeded chain "qa-e2e-disp-nopath" has a path that matches nothing
When I run the chain
Then the Display shows as failed with the extract-failed error code
And the downstream request is skipped

---

## Scenario: [CHN-S-DSP-11] The extractor picker builds a path from the upstream response

Given the seeded chain "qa-e2e-disp-header" is open
When I pick a field from the upstream response in the Display panel and save
Then the node shows the chosen path
And a run extracts the picked value

---

## Scenario: [CHN-S-DSP-12] A Display after a failed request is skipped, not failed

Given the seeded chain "qa-e2e-disp-after-fail" is open
When I run the chain
Then the request fails and the Display is skipped
And the run is Failed

---

## Evaluate block

## Scenario: [CHN-S-EVL-01] The default code passes upstream data through

Given the seeded chain "qa-e2e-eval-data" is open
When I run the chain
Then the Evaluate passes
And its Output equals the upstream body

---

## Scenario: [CHN-S-EVL-02] Custom code transforms upstream data

Given the seeded chain "qa-e2e-eval-ok" is open
When I edit the code to transform the data and run the chain
Then the Evaluate passes
And its Extracted tab shows the transformed value

---

## Scenario: [CHN-S-EVL-03] A custom output alias is usable downstream

Given the seeded chain "qa-e2e-eval-ok" is open
When I set a custom output alias and run the chain
Then the downstream header holds the alias value

---

## Scenario: [CHN-S-EVL-04a] The panel Test shows a successful result

Given the seeded chain "qa-e2e-eval-ok" is open
When I press Test in the Evaluate panel
Then the panel shows the computed output

---

## Scenario: [CHN-S-EVL-04b] The panel Test shows an error for failing code

Given the seeded chain "qa-e2e-eval-throw" is open
When I press Test in the Evaluate panel
Then the panel shows the error message

---

## Scenario: [CHN-S-EVL-05] An Evaluate alias is usable in a downstream URL query

Given the seeded chain "qa-e2e-eval-ok" uses its alias in a downstream query
When I run the chain
Then the downstream URL contains the value

---

## Scenario: [CHN-S-EVL-06] Code returning undefined fails

Given the seeded chain "qa-e2e-eval-undef" is open
When I run the chain
Then the Evaluate shows as failed with the undefined-output error code

---

## Scenario: [CHN-S-EVL-07] Code that throws fails and skips downstream

Given the seeded chain "qa-e2e-eval-throw" is open
When I run the chain
Then the Evaluate fails with the thrown message
And the downstream request is skipped

---

## Scenario: [CHN-S-EVL-08] Code that never finishes times out

Given the seeded chain "qa-e2e-eval-timeout" is open
When I run the chain
Then the Evaluate shows as failed with a timeout or terminated error code

---

## Scenario: [CHN-S-EVL-09] An output alias that collides with an existing alias is rejected

Given the seeded chain "qa-e2e-eval-alias-clash" is open
When I set the alias to one already in use
Then an alert is shown and saving is blocked

---

## Scenario: [CHN-S-EVL-10] A syntax error is reported in the panel and at run time

Given the seeded chain "qa-e2e-eval-syntax" is open
When I press Test and then run the chain
Then the panel shows the syntax error
And the Evaluate step fails with the same message

---

## Scenario: [CHN-S-EVL-11] Evaluate code cannot reach browser or network globals

Given the seeded chain "qa-e2e-eval-throw" calls window, fetch or process in its code
When I run the chain
Then the Evaluate fails naming the missing global
And no network request is made

---

## Validate block

## Scenario: [CHN-S-VAL-01] A body matching the default schema passes

Given the seeded chain "qa-e2e-val-pass" is open
When I run the chain
Then the Validate passes

---

## Scenario: [CHN-S-VAL-02] A body matching a typed schema with required fields passes

Given the seeded chain "qa-e2e-val-pass" has a schema with types and required fields
When I run the chain
Then the Validate passes

---

## Scenario: [CHN-S-VAL-03] A source path scopes what is validated

Given the seeded chain "qa-e2e-val-path-ok" validates only a sub-section of the body
When I run the chain
Then the Validate passes
And the step input shows the validated subset

---

## Scenario: [CHN-S-VAL-04] A Validate without upstream fails

Given the seeded chain "qa-e2e-val-noup" is open
When I run the chain
Then the run is blocked or the Validate fails with the no-upstream error code

---

## Scenario: [CHN-S-VAL-05] A source path that matches nothing fails

Given the seeded chain "qa-e2e-val-nomatch" is open
When I run the chain
Then the Validate fails with the no-match error code

---

## Scenario: [CHN-S-VAL-06] A non-JSON upstream body fails validation

Given the seeded chain "qa-e2e-val-badjson" is open
When I run the chain
Then the Validate fails with the invalid-JSON error code

---

## Scenario: [CHN-S-VAL-07] An invalid JSONPath fails validation

Given the seeded chain "qa-e2e-val-badpath" is open
When I run the chain
Then the Validate fails with the invalid-path error code

---

## Scenario: [CHN-S-VAL-08a] Schema text that is not JSON is flagged

Given the seeded chain "qa-e2e-val-badschema" has schema text that is not valid JSON
When I open the Validate panel and run the chain
Then the panel shows an alert
And the Validate fails with the invalid-schema-JSON error code

---

## Scenario: [CHN-S-VAL-08b] A JSON document that is not a valid schema is flagged

Given the seeded chain "qa-e2e-val-badschema" has JSON that is not a valid schema
When I run the chain
Then the Validate fails with the invalid-schema error code

---

## Scenario: [CHN-S-VAL-09] A failed validation lists at most three errors and counts the rest

Given the seeded chain "qa-e2e-val-fail" violates the schema in more than three places
When I run the chain
Then the Validate fails
And the Assertions tab shows three errors followed by a count of the remaining ones
