# Feature: Chain cross-cutting behaviour

As a user of the chain feature
I want persistence, undo, responsiveness, keyboard use and deep links to work across every block
So that the editor feels reliable regardless of which blocks I use

---

## Scenario: [CHN-X-01] Every block type keeps its configuration after reload

Given the seeded chain "qa-polish-blocks" contains one block of each type with custom settings
When I reload the page
Then each block shows the same settings as before

---

## Scenario: [CHN-X-02] Each configuration edit can be undone and redone

Given the seeded chain "qa-polish-blocks" is open
When I edit the settings of each block and undo then redo each edit
Then every block returns to its earlier and then later values in turn

---

## Scenario: [CHN-X-03] The run log stays usable on a phone-width screen

Given the seeded chain "qa-e2e-cx-fanout-merge" has been run
When the viewport is 390 px wide
Then the run log is readable and scrolls without horizontal page overflow

---

## Scenario: [CHN-X-04] The core flow works with the keyboard alone

Given the seeded chain "qa-e2e-api-single" is open
When I add a block, connect it, configure it, run the chain and open a step using only the keyboard
Then each action completes and the step detail is shown

---

## Scenario: [CHN-X-05] Clearing nodes after a run removes the canvas badges

Given the seeded chain "qa-e2e-api-single" has been run
When I clear all nodes
Then the canvas is empty and no status badges remain

---

## Scenario: [CHN-X-06] Opening an unknown chain address does not crash

Given no chain exists with the id in the address
When I open that chain address directly
Then the page shows a fallback title without errors in the console
