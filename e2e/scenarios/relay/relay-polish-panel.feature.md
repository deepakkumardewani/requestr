# Feature: Relay dock width limits (polish)

As a user with a wide workspace
I want the Relay dock to respect viewport-aware width constraints (30vw..40vw, 320px floor)
So that the content beside the dock remains usable even on smaller screens

Tests live in `e2e/qa/relay/relay-polish-panel.spec.ts`.

---

## Scenario: [REL-POL-PANEL-01] at 1440px with no saved width the open dock is 30vw (432px)

Given the viewport is 1440x900 and no saved dock width
When I open Relay
Then the dock width is 432px (30vw of 1440)
And it stays at 432px during the open animation

---

## Scenario: [REL-POL-PANEL-02] at 1100px the dock is 330px and at 900px it is 320px; at 780px the 320px floor wins over 40vw; never below 320px after drag-to-minimum or after shrinking the window with the dock open

Given the viewport is 1100x900 and no saved width
When I open Relay
Then the dock width is 330px (30vw of 1100)
And a fresh load at 900x900 with no saved width opens at 320px (30vw=270px, clamped to floor)
And resizing from 1100px to 900px keeps the dock at 330px (still in range [320, 360])
And dragging the handle to the right edge at 900px makes it 320px (minimum)
And resizing to 780x900 keeps the dock at 320px (the floor, not 312px = 40vw of 780)
And after dragging the handle to the right edge and resizing the window, the dock never goes below 320px

---

## Scenario: [REL-POL-PANEL-03] dragging the handle clamps between 30vw (432px) and 40vw (576px) at 1440px

Given the viewport is 1440x900 and the dock is open at 432px
When I drag the resize handle far to the left
Then the dock width is 576px (40vw, the maximum)
And dragging further left does not expand it
And dragging the handle far to the right makes the dock 432px (30vw, the minimum)
And dragging further right does not shrink it

---

## Scenario: [REL-POL-PANEL-04] reload keeps the clamped width; a saved 700px (rq_relay_width) is clamped to 576px on reload and after a window resize

Given the viewport is 1440x900 and rq_relay_width is set to 700px
When I open Relay
Then the dock width is 576px (clamped to the max 40vw)
And after a page reload the dock is still 576px
And resizing the window to 900x900 clamps the dock to the new max 360px (40vw of 900)
And after a full reload at 900x900 the dock respects the new bounds

---

## Scenario: [REL-POL-PANEL-05] keyboard: the focused handle resizes with ArrowLeft/ArrowRight in 16px steps, stops at the bounds, and aria-valuemin/aria-valuemax match the effective range

Given the viewport is 1440x900 and the dock is open at 432px
When I focus the resize handle
Then aria-valuemin matches 432px (30vw minimum)
And aria-valuemax matches 576px (40vw maximum)
And pressing ArrowLeft increases width by 16px
And pressing ArrowRight decreases width by 16px
And pressing ArrowLeft at 576px does nothing (already at max)
And pressing ArrowRight at 432px does nothing (already at min)

---

## Scenario: [REL-POL-PANEL-06] page content is not covered: the body reserve tracks the dock width, the content stays visible beside the dock and the page has no horizontal scroll

Given the viewport is 1440x900 with a long-width page and the dock is open at 432px
Then document.body has padding-right of 432px
And the page content fits beside the dock without horizontal scroll
And resizing the dock to 576px updates padding-right to 576px
And the content still fits beside it
And closing the dock removes the padding-right and the content spans the full width

---

## Scenario: [REL-POL-PANEL-07] closing the dock releases the reserved space and reopening restores the saved width

Given the viewport is 1440x900 and the dock is open at 500px
And I close the dock
Then document.body padding-right is 0
And when I reopen the dock
Then it restores to 500px

---

## Scenario: [REL-POL-PANEL-08] below 768px the sheet variant opens at the full viewport width and is unchanged

Given the viewport is 600x800
When I open Relay
Then the dock appears as a full-width sheet (600px)
And resizing the window to 400x800 makes the sheet 400px wide
And dragging the handle does not resize the sheet (it is read-only)
And resizing the window back to 600x800 keeps it at 600px

---

## Scenario: [REL-POL-PANEL-09] a corrupt rq_relay_width value ("abc", empty) falls back to the 30vw default

Given the viewport is 1440x900 and rq_relay_width is set to "abc"
When I open Relay
Then the dock width is 432px (the 30vw default, fallback)
And when rq_relay_width is set to an empty string
And I reload the page
Then the dock width is again 432px (the 30vw default)
