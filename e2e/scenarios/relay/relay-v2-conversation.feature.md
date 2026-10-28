# Feature: Relay v2 conversation (live header, Worked group, timing, step-limit notice)

Tests in `e2e/qa/relay/relay-v2-conversation.spec.ts`. Covers CONV-01 (turn timing), CONV-02 (live header), CONV-03 (collapsed group), CONV-04 (grouped reads), CONV-06 (step-limit notice), CONV-09 (stale cards in the group) and CONV-11 (Stopped and Failed labels). Interrupted-after-reload and legacy labels need hand-built persisted state and are covered by unit T3.15 and T3.16. The model is always mocked through `installRelayRoutes`; streamed turns use `startRelayGate` so the spec decides when each chunk arrives.

---

@critical
## Scenario: [REL-V2-CONV-01] a slow scripted turn shows "Working for Ns" ticking beneath step rows, then folds into a collapsed "Worked for Ns" row
# evidence: WorkingHeader.tsx, RelayActivityIndicator.tsx, WorkedGroup.tsx

@critical
## Scenario: [REL-V2-CONV-02] after the fold only the final answer and the changes summary are visible
# evidence: MessageParts.tsx (folded branch), TurnChangeBar.tsx

@critical
## Scenario: [REL-V2-CONV-03] after reload the "Worked for" duration equals the value before the reload
# evidence: timing.ts withTurnTiming, message.metadata.turn persisted with the thread

@high
## Scenario: [REL-V2-CONV-04] a pending question card shows "Waiting for you" and the timer pauses
# evidence: WorkingHeader.tsx isWaiting, timing.ts waitingMs

@high
## Scenario: [REL-V2-CONV-05] expanding the group shows ordered steps, grouped read summaries and per-step durations
# evidence: MessageParts.tsx GroupBlocks, stepSummary.ts

@high
## Scenario: [REL-V2-CONV-06] a turn with no tool steps shows the answer and no "Worked for" row
# evidence: MessageParts.tsx folded requires a tools block

@high
## Scenario: [REL-V2-CONV-07] Stop shows "Stopped after Ns" and a stale card inside the group shows the skipped line
# evidence: timing.ts resolveTurnLabel, ConfirmCard.tsx DeclinedNote

@high
## Scenario: [REL-V2-CONV-08] a scripted error shows "Failed after Ns" and keeps the error message visible
# evidence: timing.ts resolveTurnLabel, ErrorBubble.tsx

@critical
## Scenario: [REL-V2-CONV-09] no "Show details" or "Step N of" text appears and the step-limit notice appears only when the scripted turn hits the cap
# evidence: RelayConversation.tsx hitStepLimit, relayDock.json turn.stepLimit

@medium
## Scenario: [REL-V2-CONV-10] the group toggle is keyboard accessible with aria-expanded
# evidence: WorkedGroup.tsx
