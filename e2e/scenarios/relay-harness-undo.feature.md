# Feature: Relay undo fidelity and open-request edits

Tests in `e2e/qa/relay-harness-hardening/undo.spec.ts` (task T3.11). Undo scenarios compare the IndexedDB entity state (ignoring the re-stamped `updatedAt`) to the pre-action state.

# evidence: src/lib/relay/tools/{requestWrite,tabs,destructive,backupTools}.ts, src/lib/relay/changeLog.ts

---

@critical
## Scenario: Relay edits the URL of a clean open request: tab shows it, stays clean, Save keeps it, Undo restores request and tab (HH-H07)

---

@critical
## Scenario: dirty tab: the gate appears in Review and in Skip; save-all, discard and decline each leave the expected request and tab state (HH-H07)

---

@critical
## Scenario: delete a seeded collection with a chain, Undo: collection and chain are both back (HH-H09)

---

@high
## Scenario: import a backup whose ids collide with existing ones (merge-only import renames the colliding entities), Undo: exactly the merged entities, including the renamed copies, are removed and the pre-existing entities are untouched (HH-M11)
# note: import is merge-only; a colliding id is stored as a renamed " (imported)" copy, so the test checks the added copy is removed and the original untouched.

---

@high
## Scenario: delete the active environment, Undo: it is active again (HH-M13)

---

@medium
## Scenario: multi-delete with one bad id deletes nothing and reports the id (HH-M10)

---

@medium
## Scenario: Save all & close keeps assertions (HH-M14)

---
