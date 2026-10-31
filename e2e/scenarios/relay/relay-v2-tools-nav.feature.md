# Feature: Relay v2 navigation tools

Tests in `e2e/qa/relay/relay-v2-tools-nav.spec.ts`. Covers TOOL-02: `open_page`, `show_sidebar_tab` and `open_item` (folder) run from scripted agent turns. Navigation changes no data, so no approval card appears.

---

@critical
## Scenario: [REL-V2-TOOLNAV-01] open_page navigates to each of /settings, /import, /environments, /json-compare, /json-visualize and /transform

@high
## Scenario: [REL-V2-TOOLNAV-02] open_page with the workspace home target lands on /app

@critical
## Scenario: [REL-V2-TOOLNAV-03] show_sidebar_tab switches to collections, history and hub

@high
## Scenario: [REL-V2-TOOLNAV-04] open_item opens a folder's collection and expands it

@high
## Scenario: [REL-V2-TOOLNAV-05] navigation tools run without an approval card in every permission mode
