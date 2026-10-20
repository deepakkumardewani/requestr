# Feature: Relay Shell - Toggle, Tooltips, and Keyboard Chords

As a user
I want the Relay toggle button to be positioned correctly, show helpful tooltips, and respond to keyboard shortcuts
So that I can quickly access Relay from the main interface without confusion

---

## Background

Given the app is loaded at the workspace route `/app`

---

## Scenario: [REL-POL-SHELL-01] the toggle is at the far right of the tab bar, right of the tab-list chevron, and not in the left sidebar

@critical

When the page loads and I open a new tab via the create button (so the tab-list chevron shows)
Then the toggle button is visible in the tab bar
And the toggle's bounding box right edge aligns with the tab bar's right edge (accounting for padding)
And the toggle is positioned right of the tab-list chevron button
And the toggle sits to the right of the left sidebar navigation, not inside it

---

## Scenario: [REL-POL-SHELL-02] with zero tabs the toggle is still at the far right and does not jump when a tab opens

@high @empty

Given I close every open tab
Then the toggle is visible and positioned at the far right of the tab bar
When a new tab is opened via the create button
Then the toggle remains at the far right and does not shift position

---

## Scenario: [REL-POL-SHELL-03] with many tabs (overflow) the toggle stays visible

@high

Given I open enough tabs (20) that the tab strip overflows horizontally
Then the tab strip's scroll width exceeds its client width
And the toggle is not inside the scrolling tab strip
And the toggle is visible and within the viewport
And the toggle's right edge still aligns with the tab bar's right edge

---

## Scenario: [REL-POL-SHELL-04] clicking the toggle opens and closes the dock and aria-expanded flips; state survives a reload

@critical @persistence

Given the dock is initially closed and the toggle's aria-expanded attribute is "false"
When I click the toggle button
Then the Relay dock appears
And the toggle's aria-expanded attribute is "true"
When I click the toggle button again
Then the Relay dock closes
And the toggle's aria-expanded attribute is "false"
When I click the toggle button to open the dock again
Then the Relay dock appears and aria-expanded is "true"
When I reload the page
Then the dock is still open and aria-expanded is "true"

---

## Scenario: [REL-POL-SHELL-05] header tooltips appear on hover and on keyboard focus within 700 ms, show keycaps, and Esc dismisses

@high

Given the Relay dock is open
When I hover over each header button (new chat, close, conversations trigger)
Then its tooltip appears within 700 ms with its label
And the tooltip keycaps match the platform (new chat: Cmd+Shift+O on Mac, Ctrl+Shift+O elsewhere; close: Cmd+I on Mac, Ctrl+Shift+L elsewhere; conversations trigger: none)
When I press Escape
Then the tooltip dismisses
When I reach each header button with Shift+Tab from the composer
Then its tooltip appears within 700 ms on keyboard focus with the same keycaps
And Escape dismisses it

---

## Scenario: [REL-POL-SHELL-06] no header button lacks an accessible name

@medium

Given the Relay dock is open
Then every button in the dock header has a non-empty aria-label, title or text

---

## Scenario: [REL-POL-SHELL-07] the new-chat chord pressed in the composer starts an empty focused chat with attachments cleared and is default-prevented; the toggle chord closes an open dock

@critical

When I open the Relay dock via the toggle
And I send a message and get an assistant reply
And I attach "Request B" through the picker so its context chip shows
And I type "draft" in the composer
When I press the new-chat chord (Cmd+Shift+O on Mac, Ctrl+Shift+O elsewhere) in the composer
Then the keyboard event is default-prevented
And the thread is empty (no messages, the empty state shows)
And the attached request chip is gone
And the composer is focused
And the dock stays open (the browser's default action does not fire)
When the dock is open and I press the toggle chord (Cmd+I on Mac, Ctrl+Shift+L elsewhere)
Then the dock closes

---

## Scenario: [REL-POL-SHELL-08] the chords do nothing on the landing route

@medium

Given the app is loaded at the landing route `/` instead of the Background route
When I press the new-chat chord (Cmd+Shift+O on Mac, Ctrl+Shift+O elsewhere)
Then nothing happens
And the dock does not open
When I press the toggle chord (Cmd+I on Mac, Ctrl+Shift+L elsewhere)
Then nothing happens
And the dock does not open

---

## Scenario: [REL-POL-SHELL-09] toggle, header and empty state each render the logo test id and the toggle glyph contrasts in light and dark

@high

When the toggle button is visible
Then the toggle contains an element with data-testid="relay-logo"
When I open the Relay dock
Then the header contains an element with data-testid="relay-logo"
And the empty state (no chat selected) contains an element with data-testid="relay-logo"
When I set the stored theme to light, then to dark, reloading each time
Then in each theme the toggle, header and empty-state logos meet a 3:1 contrast ratio against their nearest opaque background

---

## Scenario: [REL-POL-SHELL-10] the shortcuts dialog lists "New Relay chat" with platform keycaps

@medium

When I press Ctrl+/ (Cmd+/ on Mac) to open the keyboard shortcuts dialog
Then the shortcuts list includes an entry for "New Relay chat"
And the keycaps match the current platform (Cmd+Shift+O on Mac, Ctrl+Shift+O elsewhere)

---

## Scenario: [REL-POL-SHELL-11] with Relay enabled but a failing dock chunk the toggle still renders and shows an error state instead of crashing

@medium @error

Given the Relay dock chunk request is aborted
When I load `/app`
Then the toggle is visible
When I click the toggle
Then the dock shows an error message (relay-dock-error)
And the toggle is still visible
And the dock chunk request was attempted and aborted
