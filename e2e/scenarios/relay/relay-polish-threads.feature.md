# Feature: Relay thread rows and overlay polish

As a user reviewing my conversation history
I want the thread list to be polished and responsive
So that I can quickly find and manage conversations

Tests live in `e2e/qa/relay/relay-polish-threads.spec.ts`. The chat endpoint is scripted by `e2e/fixtures/relayRoutes.ts`; no real model is called. Threads are seeded at runtime with explicit `updatedAt` timestamps to test relative time display. The overlay positioning uses fixed insets and side offsets to avoid layout shifts.

---

## Scenario: [REL-POL-THREADS-01] no pencil or trash at rest; hover and keyboard focus reveal "..." in place of the time with no layout shift
@critical
# evidence: ThreadList.tsx REVEAL_HIDE_CLASS/REVEAL_SHOW_CLASS; RelayHeader.tsx overlay geometry

Given the thread list is open with multiple threads
When I view a thread row at rest
Then the thread's time is visible with opacity 1
And the "..." menu trigger is hidden with opacity 0
And the time and trigger share a reserved width with no layout shift
When I hover over the row
Then the time becomes opacity 0
And the "..." trigger becomes opacity 1
And the layout does not shift
When I press Tab to focus the row's title
Then the "..." trigger becomes opacity 1
And the time is opacity 0
When I move the mouse away and blur the focus
Then the "..." trigger becomes opacity 0
And the time becomes opacity 1

---

## Scenario: [REL-POL-THREADS-02] rows seeded 30 s, 5 min, 3 h, 2 d, 8 d, 100 d, 400 d old show now, 5m, 3h, 2d, 1w, 3mo, 1y and hovering the time shows the full date
@critical
# evidence: relativeTime.ts formatRelativeTime() buckets; ThreadList.tsx FULL_DATE_FORMAT title attribute

Given the thread list holds threads with ages: 30 seconds, 5 minutes, 3 hours, 2 days, 8 days, 100 days, 400 days old
When I open the thread list
Then I see the times displayed as: "now", "5m", "3h", "2d", "1w", "3mo", "1y"
When I hover over each thread's time
Then I see a title showing the full date and time in medium date short time format

---

## Scenario: [REL-POL-THREADS-03] the menu has exactly Rename and Delete; Rename saves on Enter, cancels on Esc, saves on blur and rejects empty
@high
# evidence: ThreadList.tsx DropdownMenuItem Rename/Delete; ThreadRow finishRename logic

Given the thread list is open
When I click the "..." menu trigger on a thread
Then the dropdown menu shows exactly two items: "Rename" and "Delete"
When I click Rename
Then the thread title becomes an editable input with the current title
And the input is focused and selected
When I type a new title and press Enter
Then the rename is saved
And the input closes
And the list shows the new title
When I click Rename again
And I press Escape
Then the rename is cancelled without saving
When I click Rename once more
And I type a new title and click elsewhere
Then the rename is saved on blur
When I click Rename again
And I clear the input completely
And I press Enter
Then the empty title is rejected
And the input stays open with the old title

---

## Scenario: [REL-POL-THREADS-04] Delete removes the row at once; Undo restores it at the same position with the same title
@critical
# evidence: ThreadList.tsx handleDelete; threadDb deleteThread/restoreThread; sonner toast Undo

Given the thread list holds three threads: Alpha, Beta, Gamma (in that order)
And I have not deleted any thread
When I open the "..." menu on Beta
And I click Delete
Then Beta's row disappears immediately
And only Alpha and Gamma remain in the list
And a toast appears with text containing "Undo"
When I click the Undo button
Then Beta is restored to the list at the same position between Alpha and Gamma
And the toast closes
And Beta's title is unchanged

---

## Scenario: [REL-POL-THREADS-05] without Undo the delete is final after 5 s and survives a reload
@high
# evidence: ThreadList.tsx RELAY_UNDO_TOAST_MS; sonner auto-dismiss; threadDb persistence

Given a thread exists with a specific title
When I delete the thread from the menu
Then a toast with Undo appears
When I wait 5 seconds without clicking Undo
Then the toast disappears
And the deletion is committed to IndexedDB
When I reload the page
Then the deleted thread does not reappear
And the list shows the remaining threads

---

## Scenario: [REL-POL-THREADS-06] deleting the active thread starts a fresh empty thread
@high
# evidence: ThreadList.tsx handleDelete wasActive logic; useRelayStore setActiveThreadId(null)

Given the thread list holds two threads
And I have selected and read the first thread
When I delete the active thread from the menu
Then the thread row disappears
And the conversation area shows empty (no messages, no previous title)
And the list still shows the second thread (not automatically selected)

---

## Scenario: [REL-POL-THREADS-07] opening the overlay leaves the composer box and message scroll position unchanged and the overlay floats with shadow and a distinct surface in light and dark
@critical
# evidence: RelayHeader.tsx PopoverContent shadow-lg bg-popover; ThreadList.tsx fixture setupper; RelayDock layout

Given the conversation area has messages and the composer is visible
And the message scroll position is partway down
When I click the thread trigger to open the overlay
Then the composer box stays in its original position
And the message scroll position is unchanged
And the overlay appears with a shadow
And the overlay background is distinct from the panel background in light theme
And the overlay background is distinct from the panel background in dark theme

---

## Scenario: [REL-POL-THREADS-08] Esc, outside click and selecting a thread close the overlay and focus returns to the trigger
@high
# evidence: RelayHeader.tsx closeList onOpenChange; ThreadList.tsx onSelected; Popover open state

Given the thread list overlay is open
When I press Escape
Then the overlay closes
And focus returns to the thread trigger button
When I open the overlay again
And I click outside the overlay
Then the overlay closes
And focus returns to the thread trigger button
When I open the overlay once more
And I click on a thread to select it
Then the overlay closes
And focus returns to the thread trigger button

---

## Scenario: [REL-POL-THREADS-09] at the 320px panel width the overlay has no horizontal scroll
@high
# evidence: RelayHeader.tsx w-76 width constraint; PopoverContent max-w-(--available-width); ThreadList.tsx search input

Given the dock is resized to exactly 320px width
When I open the thread list overlay
Then the overlay content fits within the available width
And there is no horizontal scrollbar

---

## Scenario: [REL-POL-THREADS-10] a thread list with no threads shows the empty state and search with no match shows no-results
@medium
# evidence: ThreadList.tsx threads.length === 0 empty/noResults rendering; relay-threads-empty testid

Given there are no threads in the active workspace
When I open the thread list
Then an empty state message is shown
And the search input is present
When I type a search term that matches no thread
Then the no-results message is shown
And no thread rows are visible

---

## Scenario: [REL-POL-THREADS-11] a deep link to a thread route restores that thread and the overlay lists it as current
@medium
# evidence: useRelayStore setActiveThreadId; RelayHeader.tsx useActiveThreadTitle; ThreadList.tsx data-active

Given I have multiple threads saved
When I navigate directly to the thread route for a specific thread
Then that thread's messages are displayed in the conversation area
And the header shows that thread's title
When I open the thread list overlay
Then that thread is marked as the active/current thread
