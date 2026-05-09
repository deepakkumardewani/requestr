Feature: Response Panel Tab Structure
  As an API developer
  I want the response panel to surface the most-used tabs immediately
  So that I spend less time hunting for information after each request

  Background:
    Given I have a request tab open
    And I have sent a request that returns a 200 JSON response

  # ── Primary tabs ──────────────────────────────────────────────────────────

  Scenario: Three primary tabs are visible after a successful request
    Then I see exactly three primary tabs: "Response", "Headers", and "Timing"
    And I do not see "Console" or "Tests" as standalone tabs in the tab bar

  Scenario: Response tab is active by default after a request completes
    Then the "Response" tab is selected
    And the response body viewer is visible

  Scenario: Clicking the Headers tab shows the response headers
    When I click the "Headers" tab
    Then the response headers panel is visible
    And the "Headers" tab label shows the total header count in parentheses

  Scenario: Clicking the Timing tab shows the timing waterfall
    When I click the "Timing" tab
    Then the timing waterfall chart is visible

  # ── "More" dropdown ───────────────────────────────────────────────────────

  Scenario: More button is visible in the tab bar
    Then a "More" button with a chevron icon is visible at the end of the tab bar

  Scenario: Clicking More reveals Console and Tests options
    When I click the "More" button
    Then a dropdown appears containing "Console" and "Tests" options

  Scenario: Selecting Console from More switches to the Console panel
    When I click the "More" button
    And I select "Console" from the dropdown
    Then the Console panel is visible
    And the "More" button appears highlighted to indicate it is the active section

  Scenario: Selecting Tests from More switches to the Tests panel
    Given the request tab has at least one assertion defined
    When I click the "More" button
    And I select "Tests" from the dropdown
    Then the Assertions panel is visible

  Scenario: Tests option is not shown in More when the tab has no assertions configured
    Given the request tab type does not support assertions
    When I click the "More" button
    Then the dropdown does not contain a "Tests" option

  # ── Dot indicator on More ─────────────────────────────────────────────────

  Scenario: More button shows a dot indicator when the console has script output
    Given a pre-request or post-response script has logged output
    When the response panel renders
    Then the "More" button displays a dot indicator

  Scenario: More button shows a dot indicator when at least one assertion has failed
    Given the request has assertions defined
    And the last response caused one or more assertion failures
    When the response panel renders
    Then the "More" button displays a dot indicator

  Scenario: More button shows no dot indicator when console is empty and all assertions pass
    Given no scripts have produced console output
    And all assertions passed on the last response
    When the response panel renders
    Then the "More" button has no dot indicator
