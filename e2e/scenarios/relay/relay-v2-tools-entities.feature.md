# Feature: Relay v2 entity tools (duplicate, folder, Postman export, API catalog)

Tests in `e2e/qa/relay/relay-v2-tools-entities.spec.ts`. Covers TOOL-04 and CONV-05 in a real browser: a mocked agent calls the real entity tools, the summary, change cards, approval cards and Hub tab are driven, and the stores are checked.

---

@critical
## Scenario: [REL-V2-TOOLENT-01] duplicate_collection, duplicate_chain and duplicate_environment create copies, appear in the summary with Open, and Undo removes them
# evidence: src/lib/relay/tools/duplicateTools.ts, src/components/relay/ChangesSummary.tsx

@high
## Scenario: [REL-V2-TOOLENT-02] create_folder and rename_folder apply and Undo reverts
# evidence: src/lib/relay/tools/folderTools.ts, src/components/relay/ChangeCard.tsx

@critical
## Scenario: [REL-V2-TOOLENT-03] delete_folder asks first and declining deletes nothing
# evidence: src/lib/relay/tools/destructive.ts deleteFolder

@high
## Scenario: [REL-V2-TOOLENT-04] export_postman downloads a Postman file for one collection
# evidence: src/lib/relay/tools/catalogTools.ts exportPostman, src/lib/postmanExporter.ts

@high
## Scenario: [REL-V2-TOOLENT-05] import_api_catalog asks first, then imports the provider and the Hub tab shows it as imported
# evidence: src/lib/relay/tools/catalogTools.ts importApiCatalog, src/components/hub/HubProviderCard.tsx

@high
## Scenario: [REL-V2-TOOLENT-06] every step row and card shows plain-language labels and no tool name
# evidence: messages/en/relayDock.json relay.tools, src/components/relay/ToolRow.tsx
