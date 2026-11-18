# Feature: Relay permission mode matrix

Tests in `e2e/qa/relay/relay-polish-perm.spec.ts`. Scripted tool streams; mode via `rq_relay_permission_mode`.

---

@critical
## Scenario: [REL-POL-PERM-01] Always ask: a scripted create_collection shows an Approve card and does not run until Approve

@critical
## Scenario: [REL-POL-PERM-02] Always ask: delete_request shows a confirm card

@critical
## Scenario: [REL-POL-PERM-03] Always ask: get_request (read) runs with no card

@high
## Scenario: [REL-POL-PERM-04] Always ask: ask_user shows its question card

@critical
## Scenario: [REL-POL-PERM-05] Review: create_collection runs with no confirm card and shows the change summary with Undo all; delete_request shows a card

@high
## Scenario: [REL-POL-PERM-06] Review: get_request and ask_user behave as before

@critical
## Scenario: [REL-POL-PERM-07] Skip: create_collection, delete_request and get_request produce no confirm card and the items change; ask_user still shows

@critical
## Scenario: [REL-POL-PERM-08] Skip: the create is undoable from the change summary Undo all

@critical
## Scenario: [REL-POL-PERM-09] a card pending in Review stays pending after switching to Skip and only runs on Approve

@critical
## Scenario: [REL-POL-PERM-10] model text and a tool input carrying a permission field cannot change the mode; the stored mode is unchanged

@high
## Scenario: [REL-POL-PERM-11] Always ask does not gate open_item (navigation)

@high
## Scenario: [REL-POL-PERM-12] closing a tab with unsaved edits still shows the save/discard gate in Skip
