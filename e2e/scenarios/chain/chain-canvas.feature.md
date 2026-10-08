# Feature: Chain canvas editing and graph validation

As a user editing a chain graph
I want edits to be undoable, persistent and guarded by clear warnings
So that I never lose work or start a run that cannot succeed

---

## Scenario: [CHN-GR-01] Undo and redo restore adds, deletes and connections

Given the seeded chain "qa-e2e-api-single" is open
When I add a Delay, delete it and connect two nodes
And I undo three times and redo three times
Then the node and edge counts follow each step
And a run after the redo lists the redone graph's steps

---

## Scenario: [CHN-GR-02] Positions, edges and configuration persist across reload

Given the seeded chain "qa-e2e-api-inject-hdr" is open
When I drag a node to a new position and reload the page
Then the node position and edges are unchanged
And the previous run is still listed

---

## Scenario: [CHN-GR-03] A renamed node keeps its name on the canvas, in the log and after reload

Given the seeded chain "qa-e2e-api-single" is open
When I rename the node, run the chain and reload
Then the canvas shows the new name
And the run log row uses it and searching for it finds the step

---

## Scenario: [CHN-GR-04] The block picker filters by search and adds the top match on Enter

Given the seeded chain "qa-e2e-api-single" is open
When I open the block picker, type "loop" and press Enter
Then only matching blocks are listed
And a Loop is added at the placement position

---

## Scenario: [CHN-GR-05] Copying and pasting a block keeps its settings and offsets it

Given the seeded chain "qa-e2e-delay-short" is open
When I copy the Delay and paste it
Then a second Delay appears slightly offset with the same value
And undoing removes the copy
And a run lists both Delay steps

---

## Scenario: [CHN-GR-06] A node cannot be connected to itself

Given the seeded chain "qa-e2e-api-single" is open
When I drag a node's output onto its own input
Then no edge is created
And a status message says "This connection isn't allowed" while dragging

---

## Scenario: [CHN-GR-07] A duplicate connection is refused

Given the seeded chain "qa-e2e-api-inject-hdr" already has an edge between two nodes
When I connect the same pair of handles again
Then the edge count is unchanged
And a toast says the connection already exists

---

## Scenario: [CHN-GR-08] A Loop output that is already connected refuses a second connection

Given the seeded chain "qa-e2e-loop-ok" has its Loop body output connected
When I connect another node to that same output
Then the edge count is unchanged
And a toast says the handle already has a connection

---

## Scenario: [CHN-CV-01] A cycle shows a banner and blocks the run

Given the seeded chain "qa-e2e-cycle" is open
Then the cycle banner is visible
And the Run action is disabled and the run shortcut does nothing
And no run is created

---

## Scenario: [CHN-CV-02] A chain with only a Start block shows an informational banner

Given the seeded chain "qa-e2e-start-only" is open
Then the start-only banner is visible
And the Run action is disabled
And the run log shows its never-run empty state

---

## Scenario: [CHN-CV-03] A Loop body that is not connected shows a banner

Given the seeded chain "qa-e2e-loop-body-unconnected" is open
Then the loop-body-unconnected banner is visible
And the Run action is disabled and no run is created

---

## Scenario: [CHN-CV-04] A Loop body that never reaches its Collect shows a banner

Given the seeded chain "qa-e2e-loop-body-misses-collect" is open
Then the loop-body-misses-collect banner is visible
And the Run action is disabled and no run is created

---

## Scenario: [CHN-CV-05] An invalid Subchain reference shows a banner

Given the seeded chain "qa-e2e-sub-parent-empty" is open
Then the invalid-subchain banner is visible
And the Run action is disabled and no run is created

---

## Scenario: [CHN-CV-06] Engine-only circular and depth errors are stopped by the run gate

Given the seeded chains "qa-e2e-cycle" and a very deep chain are opened in turn
Then each is blocked by a banner before any run starts
And no run is created for either

---

## Scenario: [CHN-CV-07] Banners clear once their cause is fixed

Given the seeded chains "qa-e2e-cycle" and "qa-e2e-loop-unpaired" are opened in turn
When I delete the cycle edge and add the missing paired Collect
Then each banner disappears
And the Run action is enabled and the run passes
