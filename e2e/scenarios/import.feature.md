# Feature: Import

As a user
I want to import requests from external formats
So that I can migrate existing work into Requestly

---

## Background

Given the app is loaded

# Mapping of the four previously documented scenarios (no e2e/import.spec.ts exists yet; to be created):
#   "Import a Postman collection"                    -> E-COL-01
#   "Import dialog shows an error for invalid file"  -> E-COL-02
#   "Import an Insomnia export"                      -> E-COL-06
#   "Import from a cURL command"                     -> E-COL-06
# Import is a two-step flow: Scan, then "Review import", then Import (src/components/import/ImportDialog.tsx).
# Fixture requests point at MOCK_BASE_URL; any send uses a unique x-test-id header (e2e/fixtures/README.md).

---

@critical
# evidence: src/components/import/ImportDialog.tsx, src/lib/importScanner.ts, src/lib/postmanParser.ts (parsePostmanCollection), src/stores/useCollectionsStore.ts (importParsedPostmanCollection)
# NOTE: no e2e/import.spec.ts exists yet; test to be created.
## Scenario: E-COL-01 Import a nested Postman v2.1 collection

Given a Postman v2.1 file with nested folders and requests targeting the mock server
When I open Import from the "+" menu, choose the file and click "Scan"
Then the "Review import" step summarises the collection, folders and requests
When I click "Import"
Then the collection, its folders and its requests appear in the sidebar with the original nesting
And a success toast names the imported file

---

@high
# evidence: src/lib/importScanner.ts (scanFileContent error "Unrecognized format. Supported: OpenAPI 3 / Swagger 2, Postman v2.1, Insomnia v4/v5."), src/components/import/ImportDialog.tsx (scanError)
# NOTE: no e2e/import.spec.ts exists yet; test to be created.
## Scenario: E-COL-02 Import dialog rejects a file that cannot be parsed

Given the Import dialog is open
When I choose a file with unrecognised content and click "Scan"
Then an error message says the format is unrecognised
And the dialog stays on the input step
And the sidebar contents are unchanged

---

@high
# evidence: src/lib/insomniaParser.ts, src/lib/openapiParser.ts, src/lib/curlParser.ts, src/lib/importScanner.ts (scanFileContent, scanCurlText), src/components/import/ImportDialog.tsx (handleImport: openapi creates a collection, cURL opens a tab)
# NOTE: no e2e/import.spec.ts exists yet; test to be created. Parametrized over the rows below.
## Scenario Outline: E-COL-06 Import Insomnia, OpenAPI and cURL through the dialog

Given the Import dialog is open
When I provide <source> and complete Scan and Import
Then <outcome>

Examples:
| source                 | outcome                                                             |
| an Insomnia v4 export  | its collection and requests appear in the sidebar                   |
| an OpenAPI 3 JSON file | a collection named after the API lists one request per operation    |
| an OpenAPI 3 YAML file | a collection named after the API lists one request per operation    |
| a pasted cURL command  | a new tab opens with method, URL, headers and body from the command |
