# Feature: Relay layout fixes and Home breadcrumb

As a user of the Relay dock and the tool pages
I want the Jump pill, composer row and footer to lay out cleanly and the Home breadcrumb to take me to the workspace
So that nothing overlaps, the send button is always within reach and I can get back to the app

Tests live in `e2e/qa/relay/relay-improvements-layout.spec.ts`. The chat endpoint is scripted by `e2e/fixtures/relayRoutes.ts`; no real model is called. The long thread is written into IndexedDB by the spec at runtime, because a long thread in the global seed would be restored into every other Relay spec. The "+" and mic positions are asserted in REL-IA11Y-05 once those controls exist.

---

## Scenario: [REL-LAYOUT-01] The jump pill is opaque with a border and shadow in light and dark (FR-110, AC-02)

Given Relay holds a long saved conversation and I have scrolled up
When the "Jump to latest" pill appears
Then its background is fully opaque, it has a visible border and a box shadow
And the pill is the topmost element at its own centre, so no message text shows through it
And this holds in the light theme and in the dark theme

---

## Scenario: [REL-LAYOUT-02] Send sits in the textarea row on its right at 320px, 409px and mobile sheet width (FR-111, AC-03)

Given the viewport is 1024x800 and the dock is open at its 320px minimum
When it is dragged to the 409px maximum, then shown as a mobile sheet
Then at each width the send button is in the composer toolbar row under the textarea
And it sits on the right of that toolbar without overlapping the textarea
And it stays inside the dock

---

## Scenario: [REL-LAYOUT-03] The footer stays visible and onboarding mentions it once (FR-112, AC-04)

Given I open Relay for the first time
When I step through the three onboarding steps
Then the footer line under the composer is visible on every step
And the AI-can-make-mistakes note appears in the onboarding on the last step only, exactly once
And after I finish the tour the footer is still visible

---

## Scenario: [REL-LAYOUT-04] The Home breadcrumb on the tool pages links to the workspace (FR-160, AC-14)

Given I open /transform, /json-compare or /json-visualize directly
When I look at the breadcrumb
Then "Home" links to /app
And clicking it opens the workspace

---

## Scenario: [REL-LAYOUT-05] After a reload with a long thread the composer row and footer are unchanged (persistence)

Given Relay holds a long saved conversation and the dock is open
When I reload the page and open Relay again
Then the textarea, send button and footer have the same position and size as before
