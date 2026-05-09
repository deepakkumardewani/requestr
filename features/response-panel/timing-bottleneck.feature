Feature: Timing Tab — TTFB Bottleneck Highlight
  As an API developer
  I want the timing panel to call out when TTFB dominates the total request time
  So that I can immediately identify slow server response without mentally doing the maths

  Background:
    Given I have a request tab open
    And the response includes timing breakdown data
    And I am viewing the "Timing" tab

  # ── No bottleneck ─────────────────────────────────────────────────────────

  Scenario: No row is highlighted when timing is evenly distributed
    Given the timing breakdown is DNS 20ms, TCP 20ms, TLS 20ms, TTFB 20ms, Download 20ms (total 100ms)
    Then no row is highlighted in amber
    And no "bottleneck" label is shown

  Scenario: No row is highlighted when TTFB is exactly 80% of total time
    Given the timing breakdown shows TTFB at exactly 80ms out of 100ms total
    Then the TTFB row is not highlighted in amber

  # ── Bottleneck detected ───────────────────────────────────────────────────

  Scenario: TTFB row is highlighted amber when it exceeds 80% of total time
    Given the timing breakdown shows TTFB at 85ms out of 100ms total
    Then the TTFB row is highlighted in amber
    And the TTFB row displays a "bottleneck" label

  Scenario: Only the TTFB row is highlighted — not DNS, TCP, TLS, or Download
    Given the timing breakdown shows TTFB at 90ms out of 100ms total
    Then only the TTFB row is highlighted
    And the DNS, TCP, TLS, and Download rows have normal styling

  Scenario: TTFB bottleneck is visible at a glance without hovering
    Given the timing breakdown shows TTFB at 90ms out of 100ms total
    Then the amber highlight and "bottleneck" label are visible without any interaction

  # ── Edge cases ────────────────────────────────────────────────────────────

  Scenario: No bottleneck highlight when TTFB data is null
    Given the server did not return a TTFB measurement
    Then the TTFB row shows "N/A"
    And no amber highlight is applied

  Scenario: Timing waterfall still renders all five segments regardless of bottleneck
    Given the timing breakdown shows TTFB at 90ms out of 100ms total
    Then I see five rows: DNS, TCP, TLS, TTFB, and Download

  Scenario: Total row at the bottom always shows the overall request time
    Given any valid timing breakdown
    Then a "Total" row is shown below the five segments
    And it displays the sum of all measured segments

  # ── No timing data ────────────────────────────────────────────────────────

  Scenario: A message is shown when no timing data is available
    Given the response did not include timing breakdown data
    Then I see a "No timing data available" message in the Timing tab

  # ── Waterfall bar chart ───────────────────────────────────────────────────

  Scenario: The waterfall bar at the top reflects the amber colour for a TTFB bottleneck
    Given the timing breakdown shows TTFB at 85ms out of 100ms total
    Then the TTFB segment in the horizontal waterfall bar at the top of the panel is rendered in amber
