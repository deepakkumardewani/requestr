Feature: Grouped Response Headers
  As an API developer
  I want response headers organised by category
  So that I can quickly find CORS, content, or general headers without scrolling through a flat list

  Background:
    Given I have a request tab open
    And I have sent a request that returned response headers
    And I am viewing the "Headers" tab

  # ── Group rendering ───────────────────────────────────────────────────────

  Scenario: Headers are grouped into labelled sections
    Given the response includes Content-Type, cache-control, and Access-Control-Allow-Origin headers
    Then I see three labelled groups: "Response Headers", "Content Headers", and "CORS Headers"

  Scenario: Each group label shows the number of headers it contains
    Given the response includes two content-related headers
    Then the "Content Headers" group label shows "(2)"

  Scenario: Only groups with at least one header are rendered
    Given the response contains no CORS headers
    Then the "CORS Headers" group is not visible

  Scenario: Content headers group contains content-type and content-length
    Given the response includes "content-type: application/json" and "content-length: 512"
    Then both headers appear under the "Content Headers" group

  Scenario: CORS headers group contains all access-control-* headers
    Given the response includes "access-control-allow-origin: *" and "access-control-allow-methods: GET, POST"
    Then both headers appear under the "CORS Headers" group

  Scenario: All remaining headers appear under Response Headers
    Given the response includes "cache-control: no-cache" and "x-request-id: abc123"
    Then both headers appear under the "Response Headers" group

  # ── Header count in tab label ──────────────────────────────────────────────

  Scenario: Total header count is shown in the Headers tab label
    Given the response returned 8 headers in total
    Then the "Headers" tab label reads "Headers (8)"

  # ── Collapsible groups ────────────────────────────────────────────────────

  Scenario: All groups are expanded by default
    Then all header group sections are expanded and their rows are visible

  Scenario: Clicking a group header collapses that group
    When I click the "Content Headers" group label
    Then the content header rows are hidden
    And the other groups remain expanded

  Scenario: Clicking a collapsed group header expands it again
    Given I have collapsed the "Content Headers" group
    When I click the "Content Headers" group label again
    Then the content header rows are visible again

  Scenario: Collapsing one group does not affect other groups
    When I collapse the "CORS Headers" group
    Then the "Response Headers" group rows are still visible
    And the "Content Headers" group rows are still visible

  # ── Copy on hover ─────────────────────────────────────────────────────────

  Scenario: Copy button appears when hovering over a header row
    When I hover over a response header row
    Then a copy icon button appears on that row

  Scenario: Copy button is not visible when not hovering
    Then no copy icon button is visible on any header row by default

  Scenario: Clicking the copy button copies the header as "name: value"
    When I hover over the "content-type: application/json" header row
    And I click the copy button
    Then the clipboard contains "content-type: application/json"
    And a success toast appears

  # ── Empty state ───────────────────────────────────────────────────────────

  Scenario: Empty state is shown when the response returned no headers
    Given the response returned no headers
    Then I see a message indicating no headers are available
