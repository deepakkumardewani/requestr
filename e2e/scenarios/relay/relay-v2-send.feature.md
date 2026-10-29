# Feature: Relay v2 send, bubble parity and persistence (the sent bubble mirrors the composer's pills; the model gets resolved detail for the latest turn only)

Tests in `e2e/qa/relay/relay-v2-send.spec.ts`. Covers COMP-04 (bubble parity), COMP-05 (persisted layout) and COMP-06 (attachments are exactly the pills). The model is always mocked through `installRelayRoutes`; outbound payloads are read from `requestBodies`.

---

@critical
## Scenario: [REL-V2-SEND-01] type text, insert an attachment and a slash command, send: the bubble shows the pills inline in the same order and the composer is empty
# evidence: RelayComposer.tsx handleSubmit, AttachmentPillRow.tsx SegmentedText, segments.ts segmentMetadata

@critical
## Scenario: [REL-V2-SEND-02] after reload the persisted bubble still shows the same pills in order
# evidence: useRelayChat.ts submit (segments metadata), segments.ts readSegmentMetadata

@high
## Scenario: [REL-V2-SEND-03] the mocked request body has resolved detail on the last user message only and no segments on older messages
# evidence: outgoingMessages.ts prepareOutgoingMessages, toHistoryMessage, withoutSegmentMetadata

@high
## Scenario: [REL-V2-SEND-04] a draft opened through an Open-in-Relay entry keeps its pills and clears on send
# evidence: openInRelay.ts draftSegments, RelayComposer.tsx composerDraft effect

@medium
## Scenario: [REL-V2-SEND-05] a legacy text-only message seeded in IDB renders as plain text
# evidence: AttachmentPillRow.tsx UserMessageBody (no segments branch), segments.ts readSegmentMetadata
