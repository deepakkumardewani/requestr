# Feature: Relay v2 Phase 1 UI bug fixes (env menu, History button, method menu, chevrons, folder icons)

Tests in `e2e/qa/relay/relay-v2-bugs-ui.spec.ts`. Covers BUG-08 to BUG-12 in a real browser: layout is asserted with bounding boxes and `scrollWidth`/`clientWidth`. Error and deep-link cases do not apply to these static controls.

---

@critical
## Scenario: [REL-V2-BUGSUI-01] the env menu "..." has no arrow, opens the actions, and clicking it does not select the environment
# evidence: src/components/environment/EnvSelector.tsx (standalone nested DropdownMenu for the "..." trigger)

@high
## Scenario: [REL-V2-BUGSUI-02] the History "..." button bounding box is at least 28 px in both dimensions and the export submenu has a separator before the redaction note
# evidence: src/components/history/HistoryActionsMenu.tsx (size="icon", history-export-separator)

@critical
## Scenario: [REL-V2-BUGSUI-03] at 100% zoom every method badge has scrollWidth <= clientWidth and does not intersect the check mark
# evidence: src/components/request/UrlBar.tsx METHOD_MENU_CLASS

@high
## Scenario: [REL-V2-BUGSUI-04] at 125% zoom the same method-menu checks hold

@high
## Scenario: [REL-V2-BUGSUI-05] sidebar section headers show a right chevron closed and a down chevron open
# evidence: src/components/ui/accordion.tsx chevronLeft variant

@high
## Scenario: [REL-V2-BUGSUI-06] a collection folder shows the open-folder icon when expanded, in the tree and in a subfolder
# evidence: CollectionTree.tsx Folder/FolderOpen, CollectionRequestTree.tsx FolderIcon

@medium
## Scenario: [REL-V2-BUGSUI-07] the expanded or collapsed state persists after reload
# evidence: SidebarMainTab.tsx rq_sidebar_open_sections, useFolderExpandStore rq_collapsed_folders
