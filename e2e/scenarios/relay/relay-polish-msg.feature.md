# Relay: message order, Copy and actions

Feature: Message rendering order and clipboard operations
  As a user interacting with Relay
  I want messages to render in the correct order when they contain mixed content
  So that I can read responses clearly and copy complete outputs

  # evidence: src/components/relay/MessageParts.tsx, src/lib/relay/messageText.ts

  @critical
## Scenario: [REL-POL-MSG-01] text, tool, text renders two paragraphs with the tool row between and never glues at.Here's
    Given a Relay conversation with a message containing three sequential parts: text "I'm looking at.", a tool execution, and text "Here's the result."
    When the message is rendered in the conversation
    Then the text "I'm looking at." appears as the first block
    And the tool execution row appears as the middle block
    And the text "Here's the result." appears as the final block
    And the text blocks are never concatenated with "at.Here's"

  @critical
## Scenario: [REL-POL-MSG-02] text then ask_user shows the question above the AskUser card
    Given a Relay conversation with a message containing text "Check this item." followed by an ask_user request
    When the message is rendered in the conversation
    Then the text "Check this item." appears above the AskUser card
    And the AskUser card is positioned directly below the text
    And the card displays the question "Do you approve?"

  @high
## Scenario: [REL-POL-MSG-03] tool then text shows the tool row above the text
    Given a Relay conversation with a message containing a tool execution followed by text "Tool completed successfully."
    When the message is rendered in the conversation
    Then the tool execution row appears before the text
    And the text "Tool completed successfully." appears below the tool row

  @high
## Scenario: [REL-POL-MSG-04] Copy returns the two texts separated by a blank line
    Given a Relay conversation with a message containing three parts: text "First paragraph.", a tool execution, and text "Second paragraph."
    When the user copies the entire message to clipboard
    Then the clipboard contains the text blocks separated by a blank line
    And the clipboard output is "First paragraph.\n\nSecond paragraph." (tool output omitted)

  @high
## Scenario: [REL-POL-MSG-05] assistant message exposes only Copy and Regenerate actions
    Given a Relay conversation with an assistant message
    When the message row is hovered or focused
    Then only Copy and Regenerate action buttons are exposed
    And no data-testid contains thumbs references

  @high
## Scenario: [REL-POL-MSG-06] an old persisted thread (text, tool, text with step-start parts) renders in order after reload
    Given a stored Relay thread with a message containing step-start, text, tool execution, and text (from before the message order fix)
    When the user reloads the page and selects the thread from the thread list
    Then the message renders in the correct order: text, tool, text
    And no migration or format conversion is required

  @medium
## Scenario: [REL-POL-MSG-07] a long streamed reply keeps earlier blocks mounted
    Given a Relay conversation where a long reply is being streamed
    And the first text block has been received and rendered
    When additional content chunks arrive (tool execution, more text)
    Then the first text block remains mounted in the DOM
    And new blocks are appended without unmounting earlier blocks

  @high
## Scenario: [REL-POL-MSG-08] stream error after first text keeps earlier text and shows error bubble
    Given a Relay conversation with a message that starts streaming text
    And the first text part "Retrieved data." has been rendered
    When the stream encounters an error before completion
    Then the earlier text "Retrieved data." remains visible
    And an error bubble appears below the text

  @high
## Scenario: [REL-POL-MSG-09] thread with no messages shows no actions
    Given a stored Relay thread containing only a user message
    And no assistant response messages exist
    When the thread is loaded in Relay
    Then no action buttons (Copy, Regenerate) are visible
    And the user message is displayed
    And when a new message is sent to the assistant
    Then the Copy and Regenerate action buttons appear
