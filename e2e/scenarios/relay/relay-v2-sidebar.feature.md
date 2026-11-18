# Feature: Relay v2 sidebar bounds and row truncation (240 px minimum, 50% maximum, no overflow)

Tests in `e2e/qa/relay/relay-v2-sidebar.spec.ts`. Covers SB-01 to SB-03 in a real browser: the resize handle is dragged with the mouse and layout is asserted with bounding boxes and `scrollWidth`/`clientWidth`. Long names and URLs come from `e2e/fixtures/seed/relay-v2-sidebar.json`; Hub providers are mocked with `page.route`. Error and deep-link cases do not apply to these layout checks.

---

@critical
## Scenario: [REL-V2-SIDEBAR-01] dragging the handle fully left gives a sidebar width of 240 plus or minus 1 px
# evidence: src/components/layout/MainLayout.tsx SIDEBAR_MIN_SIZE

@critical
## Scenario: [REL-V2-SIDEBAR-02] at 240 px no tab (Collections, History, Hub) has scrollWidth greater than clientWidth
# evidence: src/components/layout/LeftPanel.tsx tab contents

@critical
## Scenario: [REL-V2-SIDEBAR-03] at a 1440 px viewport dragging fully right puts the sidebar within 2 px of 50% of the layout width and the URL bar is still visible
# evidence: src/components/layout/MainLayout.tsx SIDEBAR_MAX_SIZE, MAIN_MIN_SIZE

@high
## Scenario: [REL-V2-SIDEBAR-04] at 240 px seeded long names and URLs truncate with an ellipsis in Collections and History
# evidence: CollectionTree.tsx, CollectionRequestTree.tsx, RequestItem.tsx, HistoryItem.tsx

@high
## Scenario: [REL-V2-SIDEBAR-05] at 240 px method badges and action buttons are fully visible and their bounding boxes do not intersect
# evidence: HistoryItem.tsx (badge, status badge, delete button), RequestItem.tsx

@medium
## Scenario: [REL-V2-SIDEBAR-06] at 240 px the Hub card footer buttons wrap and stay visible
# evidence: src/components/hub/HubProviderCard.tsx footer flex-wrap
