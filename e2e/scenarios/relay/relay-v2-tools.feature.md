# Feature: Relay v2 tool deny-list and capability list

Tests in `e2e/qa/relay/relay-v2-tools.spec.ts`. Covers TOOL-05, TOOL-07 and EMPTY-03 in a real browser: the agent has no tool to change the approval mode or wipe all data, so a mocked reply points the user to Settings and no tool row or approval card appears. The deny-list itself (no tool or schema targets the approval mode or a wipe-all operation) is proven at unit level by `src/lib/relay/tools/registryGuarantees.spec.ts`, and that the client sends no tool definitions by `src/app/api/relay/chat/route.spec.ts` ("passes every read tool to the model"), because the chat route is mocked here; and the capabilities popover lists the settings, navigation and backup areas with asks-first markers only where a confirm-kind tool applies. No real provider is called.

---

@critical
## Scenario: [REL-V2-TOOLS-01] asked to change the approval mode, the mocked reply tells the user to do it in Settings and no tool row or approval card appears
# evidence: src/lib/relay/server/systemPrompt.ts, src/lib/relay/tools/registryGuarantees.spec.ts

@critical
## Scenario: [REL-V2-TOOLS-02] asked to wipe all data, the mocked reply says it cannot and no tool call is made
# evidence: src/lib/relay/server/systemPrompt.ts, src/lib/relay/tools/registryGuarantees.spec.ts (WIPE_ALL)

@high
## Scenario: [REL-V2-TOOLS-03] the capabilities popover lists settings, navigation and backup areas with asks-first markers only on confirm kinds
# evidence: src/lib/relay/capabilities.ts CAPABILITY_CATEGORIES, approvalNeeded

@high
## Scenario: [REL-V2-TOOLS-04] the capabilities popover offers no permission-mode or wipe-all area, and a turn shows no tool row or approval card
# evidence: src/lib/relay/tools/registryGuarantees.spec.ts (deny-list), src/lib/relay/capabilities.ts CAPABILITY_CATEGORIES
