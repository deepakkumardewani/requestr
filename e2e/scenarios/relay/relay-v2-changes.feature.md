# Feature: Relay v2 changes summary (one row per changed entity, Open, Undo all)

Tests in `e2e/qa/relay/relay-v2-changes.spec.ts`. Covers CONV-05 in a real browser: a mocked agent turn writes a request, a chain, a collection and an environment through the real client tools, then the summary after the answer is asserted. Names are unique per test. Settings-change Open is covered in Phase 7. Error and persistence cases do not apply beyond the undone and deleted states below.

---

@critical
## Scenario: [REL-V2-CHANGES-01] a mocked agent creates a request, chain, collection and environment; the summary shows one row per entity with an Open button
# evidence: src/components/relay/ChangesSummary.tsx, src/lib/relay/changesSummary.ts

@critical
## Scenario: [REL-V2-CHANGES-02] each Open navigates to the right route
# evidence: src/lib/relay/openEntity.ts routeForTarget, src/components/relay/ChangeCard.tsx useOpenTarget

@critical
## Scenario: [REL-V2-CHANGES-03] Undo all reverts them and the summary shows them as undone with Open disabled and a tooltip
# evidence: src/components/relay/TurnChangeBar.tsx, ChangesSummary.tsx openDisabled.undone

@high
## Scenario: [REL-V2-CHANGES-04] a deleted entity shows a disabled Open with the Deleted reason
# evidence: src/lib/relay/changesSummary.ts resolveOpen

@medium
## Scenario: [REL-V2-CHANGES-05] per-change cards appear only inside the expanded Worked group
# evidence: src/components/relay/MessageParts.tsx WorkedGroup, WorkedGroup.tsx
