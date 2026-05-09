Feature: Response Body View Mode Toggle
  As an API developer
  I want to switch between formatted, raw, and preview views of the response body
  So that I can inspect the data in the format most useful to me

  Background:
    Given I have a request tab open
    And I am viewing the "Response" tab

  # ── Toggle button group ───────────────────────────────────────────────────

  Scenario: Three view mode buttons appear in the top-right corner of the Response tab
    Given a response has been received
    Then I see "Pretty", "Raw", and "Preview" toggle buttons in the top-right of the response body area

  Scenario: Only one view mode button is active at a time
    Given a response has been received
    When I click the "Raw" view mode button
    Then "Raw" is highlighted as the active mode
    And "Pretty" and "Preview" are not highlighted

  # ── Auto-detection ────────────────────────────────────────────────────────

  Scenario: Pretty mode is selected automatically for JSON responses
    Given I send a request that returns a Content-Type of "application/json"
    Then the "Pretty" view mode button is active
    And the response body is displayed with syntax highlighting

  Scenario: Pretty mode is selected automatically for XML responses
    Given I send a request that returns a Content-Type of "application/xml"
    Then the "Pretty" view mode button is active

  Scenario: Raw mode is selected automatically for plain text responses
    Given I send a request that returns a Content-Type of "text/plain"
    Then the "Raw" view mode button is active
    And the response body is displayed as unformatted text

  Scenario: Preview mode is selected automatically for HTML responses
    Given I send a request that returns a Content-Type of "text/html"
    Then the "Preview" view mode button is active
    And the response body is rendered as an HTML preview

  # ── Manual switching ──────────────────────────────────────────────────────

  Scenario: User can manually switch to Raw mode from Pretty
    Given a JSON response is displayed in Pretty mode
    When I click the "Raw" view mode button
    Then the response body is displayed as unformatted text

  Scenario: User can manually switch to Preview mode from Pretty
    Given a JSON response is displayed in Pretty mode
    When I click the "Preview" view mode button
    Then the response body is rendered in the HTML preview frame

  Scenario: Switching back to Pretty re-applies syntax formatting
    Given I have manually selected Raw mode
    When I click the "Pretty" view mode button
    Then the response body is displayed with syntax highlighting again

  # ── Auto-detection resets on new response ─────────────────────────────────

  Scenario: Auto-detection runs again when a new response arrives
    Given I manually switched to Raw mode while viewing a JSON response
    When I send a new request that returns a Content-Type of "text/html"
    Then the view mode automatically switches to "Preview"

  Scenario: View mode toggle is not visible when no response has been received
    Given no request has been sent yet
    Then the view mode toggle buttons are not visible
