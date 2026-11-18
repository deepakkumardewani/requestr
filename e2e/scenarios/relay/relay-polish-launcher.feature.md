# Relay Polish Launcher

Feature: Relay Polish Launcher
  As a user, I want to quickly attach context (requests, collections, environments, chains, or the current tab) to my chat message using a searchable launcher panel
  So that I can efficiently compose messages with the necessary context

## Scenarios

## Scenario: [REL-POL-LAUNCHER-01] Clicking + opens a box-wide panel above the composer with Recent, Attach and Actions in that relative order (later phases append Settings after Actions, so the assertion is relative, not an exact section count)
@critical
# evidence: RelayLauncher.tsx, launcherItems.ts (buildLauncherSections returns sections in order: recent, attach, actions)
Given the Relay dock is open with the composer focused and no items attached
When the user clicks the + button above the composer
Then the launcher panel appears box-wide above the composer with Recent items first, followed by Attach rows, followed by Actions

## Scenario: [REL-POL-LAUNCHER-02] Typing "run" filters to matching rows across sections
@critical
# evidence: RelayLauncher.tsx, launcherItems.ts (launcherFilter matches words across name and description)
Given the launcher is open
When the user types "run" in the search box
Then only rows whose name or description contains "run" are shown (e.g., "Run chain" in Actions matches)

## Scenario: [REL-POL-LAUNCHER-03] Enter on Request shows a request search list; selecting one attaches a pill
@critical
# evidence: RelayLauncher.tsx (list attachment opens list view), MentionMenu embedded in launcher (returns ContextChip), RelayComposerPill for rendering
Given the launcher is open in the root view
When the user presses Enter on the "Request" attach row (or clicks it)
Then a searchable list of requests appears; selecting one attaches it as a pill in the composer

## Scenario: [REL-POL-LAUNCHER-04] Current tab attaches a pill and closes the panel
@critical
# evidence: RelayLauncher.tsx handleSelect for attach:currentTab, RelayComposerPill
Given the Relay dock is open with a tab open (Request A visible in the app)
When the user clicks the + button and selects "Current tab" in the Attach section
Then a pill showing the tab name (Request A) appears in the composer and the launcher closes

## Scenario: [REL-POL-LAUNCHER-05] Esc closes the panel and focus returns to +
@high
# evidence: RelayLauncher.tsx (Escape key handler calls onClose with restoreFocus=true, focus restored to triggerRef)
Given the launcher is open
When the user presses Escape
Then the launcher closes and the + button regains focus

## Scenario: [REL-POL-LAUNCHER-06] A search with no match shows "No results"
@high
# evidence: RelayLauncher.tsx (CommandEmpty with "launcher.empty" message)
Given the launcher is open
When the user types text that matches no rows (e.g., "xyzno-match-xyz")
Then the "No results" message appears

## Scenario: [REL-POL-LAUNCHER-07] Paste cURL puts "/import " in the composer and focuses it
@high
# evidence: RelayLauncher.tsx (pasteCurl target calls onPasteCurl), RelayComposer paste handler inserts "/import "
Given the launcher is open
When the user clicks the "Paste cURL" row in the Attach section
Then the composer text becomes "/import " with the cursor positioned after it

## Scenario: [REL-POL-LAUNCHER-08] An attached item appears under Recent after a reload and re-attaches on select
@high
# evidence: useRelayRecentStore (tracks recent attachments), buildLauncherSections (recent items loaded from store), RelayLauncher.tsx onSelectChip
Given the user has attached a request from Attach > Request section
And the user reloads the page
When the launcher is opened
Then the recently attached request appears in the Recent section; clicking it attaches it again

## Scenario: [REL-POL-LAUNCHER-09] At the 320px panel width nothing is clipped and there is no horizontal scroll
@high
# evidence: RelayLauncher.tsx (className with overflow-hidden, Command layout, relayE2eHelpers expectDockWidth pattern)
Given the Relay dock is resized to 320px width
When the user opens the launcher
Then all row content (icon, name, description, chevron) is visible without truncation and no horizontal scrollbar appears

## Scenario: [REL-POL-LAUNCHER-10] Opening, typing and selecting produce zero /api/relay/* or other-host requests
@critical
# evidence: RelayLauncher reads only in-app stores (useRelayRecentStore, useRelayStore, useTabsStore, SLASH_COMMANDS), buildLauncherSections is pure, no network calls until onSelectChip/onRunCommand/onPasteCurl handlers are invoked
Given the Relay dock is open
When the user opens the launcher, types to filter rows, and selects an item (Request from Attach > Request, or Recent item, etc.)
Then no network requests to /api/relay/* or external hosts are made (until Send button is pressed)
