# Relay: unified composer box

Feature: Composer layout, interactions, and attached context
  As a Relay user
  I want the composer to be responsive, accessible, and clearly show attached items
  So that I can effectively draft messages with the right context at any viewport size

# evidence: src/components/relay/RelayComposer.tsx, src/components/relay/ComposerPills.tsx, src/lib/relay/constants.ts

@critical
## Scenario: [REL-POL-COMPOSER-01] one rounded border wraps the textarea and the toolbar inside relay-composer-box
  Given the Relay dock is open with the composer ready
  When the page is rendered
  Then the composer box (relay-composer-box) has a single rounded border wrapping both the textarea and the toolbar
  And the textarea inside the box has no border of its own
  And the box shows a focus ring when the textarea is focused

@critical
## Scenario: [REL-POL-COMPOSER-02] at panel widths 320, 400 and 480px nothing overlaps or overflows and pills wrap above the toolbar
  Given the Relay dock is open with the composer ready
  And multiple context items (requests, collections, environments, chains) are attached as pills
  When the dock is resized to 320px, 400px, and 480px widths
  Then pills wrap above the toolbar without overlapping any controls
  And the textarea, pills, + button, mic button, and send button do not overflow the box width
  And pills remain visible and fully contained within the composer box

@high
## Scenario: [REL-POL-COMPOSER-03] the textarea grows from 2 rows up to the maximum height then scrolls
  Given the Relay dock is open with the composer ready
  And the composer box is visible
  When the user types text into the textarea
  Then the textarea starts at 2 rows (minimum height)
  And as text is added, the textarea grows taller up to 160px maximum height
  And once the text exceeds the maximum height, the textarea scrolls internally without growing further
  And the rest of the composer layout remains stable

@high
## Scenario: [REL-POL-COMPOSER-04] the placeholder equals "Ask anything, @ to mention, / for actions" in en, and keeps @ and / in fr and ja
  Given the Relay dock is open
  And the user's locale is set to English
  When the composer textarea is empty and focused
  Then the placeholder text reads "Ask anything, @ to mention, / for actions"
  And when the locale is changed to French
  Then the placeholder contains "@ pour mentionner" and "/ pour les actions"
  And when the locale is changed to Japanese
  Then the placeholder contains "メンション" and "アクション"

@high
## Scenario: [REL-POL-COMPOSER-05] send is disabled when empty and while offline, and becomes stop while streaming
  Given the Relay dock is open
  When the composer textarea is empty
  Then the send button is disabled
  And when text is typed into the composer
  Then the send button becomes enabled
  And when the user sends a message and the assistant is streaming a reply
  Then the send button changes to a stop button
  And when the browser is offline
  Then the send button is disabled and the offline notice is visible

@high
## Scenario: [REL-POL-COMPOSER-06] tab order is textarea, +, shield, pill remove buttons, mic, send
  Given the Relay dock is open with the composer ready
  And the composer textarea has focus and contains text
  And at least one context pill is attached
  When the user presses Tab
  Then focus moves through: textarea → + (add context) → approval shield → pill remove button(s) → mic button → send button

@medium
## Scenario: [REL-POL-COMPOSER-07] the AI caption is visible at all times
  Given the Relay dock is open
  When the composer is first displayed with an empty textarea
  Then the footer caption "Relay is AI and can make mistakes. Check important changes." is visible
  And when text is typed into the composer
  Then the caption remains visible
  And when the assistant is streaming a reply
  Then the caption remains visible
  And when the browser goes offline
  Then the caption remains visible

@high
## Scenario: [REL-POL-COMPOSER-08] tooltips appear on focus for +, mic and send/stop
  Given the Relay dock is open with the composer ready
  When the user focuses the + (add context) button
  Then a tooltip appears with the label "Attach context"
  And when the user focuses the mic button
  Then a tooltip appears with the label "Dictate"
  And when the user focuses the send button
  Then a tooltip appears with the label "Send message"
  And when a message is streaming and the stop button is visible
  Then the tooltip shows "Stop generating"

@medium
## Scenario: [REL-POL-COMPOSER-09] touch targets are at least the mobile minimum in the sheet at 390px
  Given the Relay dock is rendered as a full-height sheet at 390px viewport width
  When the composer controls (+, mic, send) are rendered
  Then each control has a minimum size of at least 44px in both height and width
  And all controls remain tappable without accidental misses

@critical
## Scenario: [REL-POL-COMPOSER-10] an attached item shows a pill inside the box; the X removes the pill and its @token from the draft
  Given the Relay dock is open with the composer ready
  When a user selects a context item (request, collection, environment, or chain) via the mention menu or picker
  Then a pill appears inside the composer box displaying the item's name
  And the pill shows a remove button (X)
  And the draft text contains an @ reference token for the item
  And when the user clicks the X on the pill
  Then the pill is removed from the composer box
  And the @ token is removed from the draft text
  And the item is no longer attached to the next message

@high
## Scenario: [REL-POL-COMPOSER-11] a pill for a deleted workspace item is struck and muted and is dropped from the sent payload
  Given an item (request, collection, etc.) is attached as a pill in the composer
  When the item is deleted from the workspace
  And the composer still displays the pill for that deleted item
  Then the pill text appears struck-through
  And the pill text color is muted (appears grayed out)
  And when the user sends the message with the deleted item still attached
  Then the deleted item is excluded from the payload and never sent to the API

@medium
## Scenario: [REL-POL-COMPOSER-12] a new chat clears the pills and the attached items
  Given the Relay conversation has messages and attached context pills
  When the user selects the / command and chooses "Start a new conversation"
  Then a confirmation dialog appears asking "Start a new conversation?"
  And when the user confirms
  Then all pills are removed from the composer
  And all attached context items are cleared
  And the composer draft is cleared
  And the next send payload contains no attached items
