# Feature: Chain request, Start and Delay blocks

As a user building an API chain
I want request, Start and Delay blocks to run, inject values and fail predictably
So that I can trust each simple chain's canvas state and run log

Seeds live in `e2e/fixtures/seed/chain-e2e.json`. Network is mocked by the chain route fixtures. Each scenario states its own starting chain and is independent of the others.

---

## Request block

## Scenario: [CHN-S-API-01] A single request passes and shows its status

Given the seeded chain "qa-e2e-api-single" is open
When I run the chain
Then the request node shows as passed
And the run log lists one passed step with HTTP status 200 and a duration
And the results bar reports Passed

---

## Scenario: [CHN-S-API-02] Two chained requests run in order

Given the seeded chain "qa-e2e-api-inject-hdr" is open with its injection removed
When I run the chain
Then both request nodes show as passed
And the run log lists the two steps in execution order

---

## Scenario: [CHN-S-API-03] A value is injected into a downstream header

Given the seeded chain "qa-e2e-api-inject-hdr" is open
When I run the chain
Then the downstream request is passed
And its step input shows the header carrying the upstream token value
And its extracted values list the source path

---

## Scenario: [CHN-S-API-04] A value is injected into a downstream query parameter

Given the seeded chain "qa-e2e-api-inject-url" is open
When I run the chain
Then the downstream step input shows the URL with the encoded query parameter

---

## Scenario: [CHN-S-API-05a] A path injection replaces the named placeholder

Given the seeded chain "qa-e2e-api-inject-path" is open and its URL contains a ":id" placeholder
When I run the chain
Then the downstream step URL shows the placeholder replaced by the extracted value

---

## Scenario: [CHN-S-API-05b] A path injection appends the value when there is no placeholder

Given the seeded chain "qa-e2e-api-inject-path" is open and its URL has no placeholder
When I run the chain
Then the downstream step URL ends with the extracted value as a new path segment

---

## Scenario: [CHN-S-API-06a] A value is injected into a JSON body

Given the seeded chain "qa-e2e-api-inject-body" is open
When I run the chain
Then the downstream request is passed
And its step input body contains the injected value

---

## Scenario: [CHN-S-API-06b] Injecting into a non-JSON body fails the downstream request

Given the seeded chain "qa-e2e-api-inject-badbody" is open and its target uses a form body
When I run the chain
Then the downstream node shows as failed
And the run log step shows the body-injection error code

---

## Scenario: [CHN-S-API-07a] Concurrency of 1 runs independent requests one at a time

Given the seeded chain "qa-polish-parallel-lanes" is open
And the chain concurrency setting is 1
When I run the chain
Then the independent requests run sequentially
And the run log shows their steps in ordered, non-overlapping lanes

---

## Scenario: [CHN-S-API-07b] Concurrency of 4 runs independent requests together

Given the seeded chain "qa-polish-parallel-lanes" is open
And the chain concurrency setting is 4
When I run the chain
Then the independent requests overlap in time
And the run log shows them in distinct parallel lanes

---

## Scenario: [CHN-S-API-08] A missing JSONPath fails the target and the run ends Failed

Given the seeded chain "qa-e2e-api-inject-miss" is open
When I run the chain
Then the target node shows as failed with an extraction-failed message
And the run log shows the step failed with its error line
And the run summary is Failed with one passed and one failed step

---

## Scenario: [CHN-S-API-09] A non-JSON response is shown as raw text

Given the seeded chain "qa-e2e-api-text" is open
When I run the chain
Then the node is passed
And the step Output shows the raw response text without error

---

## Scenario: [CHN-S-API-10] An empty-array response is a valid pass

Given the seeded chain "qa-e2e-api-empty-list" is open
When I run the chain
Then the node is passed
And the step Output shows an empty array

---

## Scenario: [CHN-S-API-11] A 404 response fails the request with an HTTP status error

Given the seeded chain "qa-e2e-api-404" is open
When I run the chain
Then the node shows as failed with an error strip
And the run log step shows HTTP status 404 and the HTTP status error code
And the results bar reports Failed

---

## Scenario: [CHN-S-API-12] A proxied failure envelope fails as an HTTP status error

Given the seeded chain "qa-e2e-api-unmocked" targets a host with no mock
When I run the chain
Then the node shows as failed
And the run log step shows HTTP status 599 with the HTTP status error code
And the results bar reports Failed

---

## Scenario: [CHN-S-API-13] A failing assertion fails the request

Given the seeded chain "qa-e2e-api-assert-fail" is open
When I run the chain
Then the node shows as failed
And the Assertions tab lists each assertion as passed or failed
And the step shows the assertions-failed error code

---

## Scenario: [CHN-S-API-14] A network-level failure is reported as a request failure

Given the seeded chain "qa-e2e-api-abort" targets an endpoint that drops the connection
When I run the chain
Then the node shows as failed
And the run log step has no HTTP status and shows the request-failed error code

---

## Scenario: [CHN-S-API-15a] Assertions can target status, header, body path and duration

Given the seeded chain "qa-e2e-api-assert-pass" is open
When I author one assertion per source on the request
And I run the chain
Then the node is passed
And the Assertions tab lists one passed row for each source

---

## Scenario: [CHN-S-API-15b] Assertions support the equality, comparison, contains and exists operators

Given the seeded chain "qa-e2e-api-assert-pass" is open
When I author one assertion per operator on the request
And I run the chain
Then the node is passed
And the Assertions tab lists one passed row for each operator

---

## Scenario: [CHN-S-API-16] A disabled assertion is not evaluated

Given the seeded chain "qa-e2e-api-assert-fail" is open
When I disable the failing assertion
And I run the chain
Then the node is passed
And the Assertions tab shows that assertion as not evaluated
And no assertions-failed error appears

---

## Scenario: [CHN-S-API-17] An edge can be switched between success and fail routing and the choice persists

Given the seeded chain "qa-e2e-med-fail-handle" is open
When I change an edge from success to fail routing
And I reload the page
Then the edge still shows the fail type
And the next run routes according to the fail type

---

## Scenario: [CHN-S-API-18a] Removing one injection leaves the rest of the edge intact

Given the seeded chain "qa-e2e-api-inject-hdr" has an edge with a header injection
When I remove that injection from the edge configuration
Then the edge shows one fewer injection
And a later run's downstream input no longer has the header

---

## Scenario: [CHN-S-API-18b] An edge can be deleted from its configuration

Given the seeded chain "qa-e2e-api-inject-hdr" is open
When I delete the edge from its configuration
Then the edge disappears from the canvas

---

## Scenario: [CHN-S-API-19] Two injections into the same header resolve to a single value

Given the seeded chain "qa-e2e-api-inject-hdr" has a second injection into the same header
When I run the chain
Then the downstream request is passed
And its step input shows one resolved header value
And its extracted values list both source paths

---

## Scenario: [CHN-S-API-20] A request with an empty URL cannot produce a silent pass

Given the seeded chain "qa-e2e-api-nourl" is open
Then the node indicates it is invalid or the Run action is disabled
And no run is recorded unless the run fails with an explicit error

---

## Scenario: [CHN-S-API-21] An extracted value is promoted to an environment variable after a run

Given the seeded chain "qa-e2e-api-promote-env" has an edge promoting a value to an environment variable
When I run the chain
Then the run passes
And the Extracted tab shows the promoted variable
And the environment now holds the extracted value

---

## Scenario: [CHN-S-API-22] A stopped run does not promote values to the environment

Given the seeded chain "qa-e2e-api-promote-env" has a slow downstream request
When I run the chain and stop it before it finishes
Then the run is Stopped
And the environment variable keeps its previous value

---

## Start block

## Scenario: [CHN-S-STR-01] A Start default feeds a downstream request

Given the seeded chain "qa-e2e-start-literal" is open
When I run the chain
Then the Start node lists its input
And the downstream request passes
And its step input uses the default value

---

## Scenario: [CHN-S-STR-02] A Start input can be switched to an environment variable

Given the seeded chain "qa-e2e-start-literal" is open
When I change the input source to an environment variable and save
Then the Start node shows the environment source
And a run uses the environment variable's value downstream

---

## Scenario: [CHN-S-STR-03] Added Start inputs persist across reload

Given the seeded chain "qa-e2e-start-multi" is open
When I add an input with a key and default and save
And I reload the page
Then the Start node lists all inputs
And a run uses every input's value

---

## Scenario: [CHN-S-STR-04] Run-with-inputs overrides environment and default values

Given the seeded chain "qa-e2e-start-env" is open
When I override one input in the run-with-inputs popover and run
Then the downstream step shows the override, not the environment value or default

---

## Scenario: [CHN-S-STR-05a] A single Start input can be deleted

Given the seeded chain "qa-e2e-start-multi" is open
When I delete one input in the Start panel and save
Then that input no longer appears on the Start node

---

## Scenario: [CHN-S-STR-05b] The Start block can be deleted from its panel

Given the seeded chain "qa-e2e-start-multi" is open
When I delete the Start block from its panel
Then the Start node is removed
And earlier runs remain in the run log

---

## Scenario: [CHN-S-STR-06] Cancelling the Start panel discards edits

Given the seeded chain "qa-e2e-start-literal" is open
When I edit an input and cancel the panel
Then the Start node is unchanged

---

## Scenario: [CHN-S-STR-07a] A Start input with an empty key is rejected

Given the seeded chain "qa-e2e-start-dup" is open
When I try to save an input with an empty key
Then saving is blocked with a validation message
And the Start node is unchanged

---

## Scenario: [CHN-S-STR-07b] A Start input with a duplicate key is rejected

Given the seeded chain "qa-e2e-start-dup" is open
When I try to save two inputs with the same key
Then saving is blocked with a validation message
And the Start node is unchanged

---

## Scenario: [CHN-S-STR-08] A missing environment variable falls back to the default or flags it

Given the seeded chain "qa-e2e-start-env" is open and the referenced environment variable does not exist
When I run the chain
Then the default is used when one exists
And otherwise the node footer and step show the unresolved variable

---

## Scenario: [CHN-S-STR-09] A second Start block is refused

Given the seeded chain "qa-e2e-start-literal" is open
When I try to add another Start block
Then a toast explains only one Start is allowed
And the canvas still has one Start

---

## Scenario: [CHN-S-STR-10] A Start block cannot be the target of a connection

Given the seeded chain "qa-e2e-start-literal" has a Delay block
When I drag the Delay output onto the Start block
Then no edge is created

---

## Scenario: [CHN-S-STR-11] Resetting run-with-inputs drops stale overrides after the default changes

Given the seeded chain "qa-e2e-start-multi" is open
When I override an input, reset the overrides and change that input's default
And I reopen the run-with-inputs popover
Then the popover shows the new default
And a run uses the new default

---

## Delay block

## Scenario: [CHN-S-DLY-01] A Delay runs for its configured time

Given the seeded chain "qa-e2e-delay-short" is open with a 200 ms delay
When I run the chain
Then the Delay and the following request pass in order
And the Delay step duration is at least 200 ms

---

## Scenario: [CHN-S-DLY-02] The delay value can be edited inline

Given the seeded chain "qa-e2e-delay-short" is open
When I change the delay to 300 ms inline
Then the node shows 300 ms
And the next run's Delay step lasts at least 300 ms

---

## Scenario: [CHN-S-DLY-03a] An edited delay persists across reload

Given the seeded chain "qa-e2e-delay-short" is open
When I change the delay value and reload the page
Then the node still shows the new value

---

## Scenario: [CHN-S-DLY-03b] Undo restores the previous delay value

Given the seeded chain "qa-e2e-delay-short" has an edited delay
When I undo the edit
Then the node shows the original delay value

---

## Scenario: [CHN-S-DLY-04] A zero-millisecond delay passes immediately

Given the seeded chain "qa-e2e-delay-zero" is open
When I run the chain
Then the Delay passes
And its step duration is near zero

---

## Scenario: [CHN-S-DLY-05] Invalid delay input is rejected

Given the seeded chain "qa-e2e-delay-short" is open
When I enter an empty, negative or non-numeric delay
Then the stored value is not changed to an invalid number
And no console error occurs

---

## Scenario: [CHN-S-DLY-06] Stopping a run during a Delay aborts it

Given the seeded chain "qa-e2e-delay-long" is open with a 5000 ms delay
When I run the chain and stop it while the Delay is running
Then the Delay shows as aborted
And the downstream request is skipped
And the run is Stopped
