# Feature: Relay v2 phase 1 bugs (attachments per turn, picker search, question card)

Tests in `e2e/qa/relay/relay-v2-bugs.spec.ts`. Covers BUG-01 (per-turn attachments), BUG-02 (picker search and per-action header), BUG-03 (no tool names in cards), BUG-04 and CONV-09 (question card). The oversized-attachment overflow case is covered by unit T1.26; the empty case is the second-turn scenario. The model is always mocked through `installRelayRoutes`.

---

@critical
## Scenario: [REL-V2-BUGS-01] attach a request and send: the composer is empty, the bubble shows the pill, the mocked /api/relay/chat body has resolved detail on the last user message only, and the reply references the request with no question card
# evidence: AttachmentPillRow.tsx, attachments.ts, outgoingMessages.ts

@critical
## Scenario: [REL-V2-BUGS-02] a second turn sent without re-attaching carries no attachments and no turn-1 detail
# evidence: outgoingMessages.ts (detail only on the latest user message)

@high
## Scenario: [REL-V2-BUGS-03] an attached request that is deleted before send is sent as a "no longer exists" note and the bubble pill renders muted with the tooltip
# evidence: AttachmentPillRow.tsx DeletedPill, composer.pill.stale

@high
## Scenario: [REL-V2-BUGS-04] after reload the persisted bubble still shows the attachment pill
# evidence: message.metadata.attachments persisted with the thread

@critical
## Scenario: [REL-V2-BUGS-05] the "Export a request as cURL" starter shows the header "Pick a request to export as cURL"
# evidence: relayDock.json slash.hint.transfer-2

@critical
## Scenario: [REL-V2-BUGS-06] typing "user" in the picker search narrows the list to matching items only and arrow keys plus Enter select
# evidence: MentionMenu.tsx relay-mention-search

@medium
## Scenario: [REL-V2-BUGS-07] a query with no match shows the no-match text and Escape returns focus to the composer
# evidence: MentionMenu.tsx relay-mention-empty, mention.noMatch

@critical
## Scenario: [REL-V2-BUGS-08] a mocked ask_user call: select an option, then Send; the tool result sent back equals the option
# evidence: AskUserCard.tsx, askUserState.ts

@critical
## Scenario: [REL-V2-BUGS-09] a mocked ask_user call: type your own answer, then Send; the tool result equals the typed value
# evidence: AskUserCard.tsx relay-ask-input

@high
## Scenario: [REL-V2-BUGS-10] a composer message sent while a question card is pending is recorded as its answer and the bubble still renders
# evidence: useRelayChat.ts settlePendingForMessage

@high
## Scenario: [REL-V2-BUGS-11] stopping the turn while a card is pending leaves the muted skipped line; no registered tool name appears in any rendered card
# evidence: useRelayChat.ts stopTurn, ConfirmCard DeclinedNote
