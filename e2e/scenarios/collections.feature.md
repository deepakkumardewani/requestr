# Feature: Collections

As a user
I want to organise my requests into collections
So that I can manage and reuse them easily

---

## Background

Given the app is loaded
And the Collections panel is visible in the sidebar

---

@critical
# evidence: src/components/layout/CreateNewDropdown.tsx, src/components/collections/CollectionTree.tsx (new-collection-name-input), src/stores/useCollectionsStore.ts
## Scenario: Create a new collection

When I click the "Create" dropdown and select "New Collection"
Then a new collection appears in the sidebar with a default name in edit mode
When I type a name and press Enter
Then the collection is saved with the given name

---

@high
# evidence: src/components/collections/CollectionTree.tsx (collection-rename-btn, collection-rename-input)
## Scenario: Rename a collection

Given a collection named "My API" exists in the sidebar
When I right-click on the collection
And I select "Rename"
Then the collection name becomes editable
When I type a new name and press Enter
Then the collection is updated with the new name

---

@critical
# evidence: src/components/collections/CollectionTree.tsx (collection-delete-btn), src/components/common/ConfirmDeleteDialog.tsx
## Scenario: Delete a collection

Given a collection exists in the sidebar
When I right-click on the collection
And I select "Delete"
Then a confirmation dialog appears
When I confirm deletion
Then the collection and all its requests are removed from the sidebar

---

@critical
# evidence: src/components/collections/SaveRequestModal.tsx (collection-picker, collection-picker-item-*), src/stores/useCollectionsStore.ts
## Scenario: Save a new request to a collection

Given I have a configured request in an open tab
When I click the Save button (or press Cmd/Ctrl+S)
And the Save Request modal appears
And I enter a request name
And I select an existing collection
And I click Save
Then the request appears inside the selected collection in the sidebar
And the tab is no longer dirty

---

@high
# evidence: src/components/collections/SaveRequestModal.tsx (create-new-collection-link)
## Scenario: Save a request to a new collection from the save modal

Given the Save Request modal is open
When I enter a request name
And I click "+ Create new collection" (create-new-collection-link) and provide a collection name
And I save
Then the new collection is created
And the request is saved inside it

---

@critical
# evidence: src/components/collections/RequestItem.tsx (request-item)
## Scenario: Open a saved request from the sidebar

Given a collection with at least one saved request is visible in the sidebar
When I click on the request name
Then the request opens in a new tab
And the tab shows the request's name, method, and URL

---

@critical
# evidence: src/components/collections/RequestItem.tsx, src/stores/useCollectionsStore.ts
# NOTE: spec test is titled "Update a saved request shows dirty indicator and saves" (e2e/collections.spec.ts:362); titles differ, rename one to match
## Scenario: Update a saved request

Given a saved request is open in an active tab
When I modify the URL or any field
Then the tab shows the dirty indicator
When I press Cmd/Ctrl+S
Then the changes are saved to the collection
And the dirty indicator disappears

---

@high
# evidence: src/components/collections/RequestItem.tsx (request-delete-btn)
## Scenario: Delete a request from a collection

Given a collection has at least one saved request
When I right-click on the request in the sidebar
And I select "Delete"
Then a confirmation dialog appears
When I confirm deletion
Then the request is removed from the collection
And if the request was open in a tab, the tab is also closed

---

@medium
# evidence: src/components/collections/CollectionTree.tsx (collection-name-*, accordion)
# NOTE: spec test is titled "Collection collapses and expands" (e2e/collections.spec.ts:458); titles differ, rename one to match
## Scenario: Collection is collapsed and expanded

Given a collection is visible in the sidebar
When I click the collection header to collapse it
Then the requests inside are hidden
When I click again to expand
Then the requests are visible again

---

# Mock server: where a scenario sends a request it targets MOCK_BASE_URL (e2e/fixtures/README.md)
# with a unique `x-test-id` header per test so parallel workers stay isolated.

@high
# evidence: src/components/collections/CollectionRequestTree.tsx (FolderNode menu: New Folder, Rename, Duplicate, Delete; ConfirmDeleteDialog "Delete folder?"), src/stores/useCollectionsStore.ts (createFolder, renameFolder, duplicateFolder, deleteFolder)
# NOTE: the folder menu has no "Add request" item and SaveRequestModal has no folder picker; requests only land in a folder via import or by duplicating a request inside it (RequestItem keeps request.folderId), so the "add request" step is seeded via that route.
## Scenario: E-COL-03 Manage folders inside a collection

Given a collection with a request exists
When I open the collection menu and choose "New Folder"
Then a new folder appears in edit mode inside the collection
When I name it "Auth" and press Enter
Then the folder "Auth" is listed under the collection
When I rename the folder to "Auth v2" from its menu
Then the folder shows the name "Auth v2"
Given the folder contains a request that sends to the mock server
When I choose "Duplicate" from the folder menu
Then a folder "Auth v2 (copy)" appears with a copy of the request
When I choose "Delete" on the original folder and confirm "Delete folder?"
Then the folder and its requests disappear from the sidebar
And "Auth v2 (copy)" with its request remains

---

@high
# evidence: src/components/layout/SidebarSearch.tsx (SidebarSearchInput, SidebarSearchResults, handleOpenRequest), src/components/layout/LeftPanel.tsx, messages/en/navigation.json (search, clearSearch), messages/en/common.json (noResults)
## Scenario: E-COL-04 Search the sidebar for requests, environments and chains

Given saved requests, an environment and a chain exist
When I type part of a request name or URL into the "Search..." field
Then results are grouped under "Requests", "Environments" and "Chains" and only matches are listed
When I click a request result
Then its tab opens, or the existing tab becomes active if already open
And the search is cleared
When I search for text that matches nothing
Then 'No results for "<query>"' is shown
When I click the "Clear search" (X) button
Then the field is emptied and the normal sidebar returns

---

@high
# evidence: src/components/layout/CreateNewDropdown.tsx (create-new-dropdown-trigger, create-collection-item, create-chain-item), messages/en/navigation.json (newHttp, newGraphql, newWebSocket, newSocketIO, newCollection, newEnvironment, newChain), messages/en/common.json (import)
## Scenario Outline: E-COL-05 Create new items from the "+" menu

Given the app is loaded
When I open the "+" menu and choose "<item>"
Then <outcome>

Examples:
| item        | outcome                                               |
| HTTP        | a new HTTP request tab opens                          |
| GraphQL     | a new GraphQL tab opens                               |
| WebSocket   | a new WebSocket tab opens                             |
| Socket.IO   | a new Socket.IO tab opens                             |
| Collection  | a new collection appears in the sidebar in edit mode  |
| Environment | a new environment appears in edit mode in the sidebar |
| Chain       | a new chain is created and opened                     |
| Import      | the Import dialog opens                               |

---

@high
# evidence: src/stores/useFolderExpandStore.ts (localStorage "rq_collapsed_folders"), src/components/layout/SidebarMainTab.tsx (SIDEBAR_SECTIONS_STORAGE_KEY "rq_sidebar_open_sections"), src/stores/useCollectionsStore.ts (IndexedDB), src/lib/idbSchema.ts
## Scenario: E-COL-07 Sidebar state survives a page reload

Given a collection with a folder and a request exists
And I collapse the folder and collapse the "Collections" section
When I reload the page
Then the folder is still collapsed
And the "Collections" section is still collapsed
When I expand the section
Then the collection, folder and request are still listed

---

@high
# evidence: src/components/collections/RequestItem.tsx (handleDuplicate "(copy)", handleCopyAsCurl clipboard, handleExportPostman, request-rename-btn, request-item-more-btn), src/lib/postmanExporter.ts (downloadPostmanRequest), src/lib/curlGenerator.ts, messages/en/common.json (copyAsCurl)
## Scenario Outline: E-COL-08 Run request actions from the sidebar menu

Given a saved request targeting MOCK_BASE_URL exists
When I open its menu and choose "<action>"
Then <outcome>

Examples:
| action            | outcome                                                                        |
| Rename            | the name becomes editable and the new name is saved on Enter                   |
| Duplicate         | a request named "<name> (copy)" appears next to it                             |
| Export as Postman | a download event fires for a "<name>.postman_collection.json" file             |
| Copy as cURL      | the clipboard holds a cURL command with the request URL and a toast confirms   |

---

@high
# evidence: src/components/collections/CollectionTree.tsx ("Export as Postman" menu items), src/lib/postmanExporter.ts (downloadPostmanCollection, exportToPostmanCollection)
## Scenario: E-COL-09 Export a collection as Postman

Given a collection with a folder and requests exists
When I choose "Export as Postman" from the collection menu
Then a download named "<collection>.postman_collection.json" is produced
And the file is valid JSON in Postman v2.1 shape
And it contains the folder and each request
