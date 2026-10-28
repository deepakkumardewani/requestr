# Feature: Relay v2 chain live updates without navigation

Tests in `e2e/qa/relay/relay-v2-chain-live.spec.ts`. Covers CONV-08: a chain created or edited by Relay appears live, and the user is never navigated away until they click Open. The model is always mocked through `installRelayRoutes`; chain tools run for real against the seeded workspace.

---

@critical
## Scenario: [REL-V2-CHAINLIVE-01] creating a chain via the mocked agent does not change the URL, and an Open button appears in the live step row
# evidence: ToolRow.tsx created target Open button, openEntity.ts createdTarget

@critical
## Scenario: [REL-V2-CHAINLIVE-02] with the chain page open, a mocked agent adding 3 nodes shows them without a reload
# evidence: chainWrite.ts add_chain_node / connect_chain_nodes write through the store the canvas reads

@high
## Scenario: [REL-V2-CHAINLIVE-03] clicking Open navigates to /chain/<id>
# evidence: openEntity.ts ENTITY_ROUTES.chain
