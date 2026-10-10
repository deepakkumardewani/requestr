# Feature: Response Viewing

As a user
I want to inspect the response after sending a request
So that I can understand what the API returned

---

## Background

Given the app is loaded
And a request has been sent successfully

---

## Scenario: View response status code

Then the response panel shows the HTTP status code
And the status badge is colour-coded (green for 2xx, red for 4xx/5xx)

---

## Scenario: View pretty-printed response body

Given the response body is valid JSON
When I click the "Pretty" tab in the response panel
Then the JSON is formatted and syntax-highlighted

---

## Scenario: View raw response body

When I click the "Raw" tab in the response panel
Then the response body is shown as plain unformatted text

---

## Scenario: View response headers

When I click the "Headers" tab in the response panel
Then a table of response header key-value pairs is displayed
And I can copy an individual header value

---

## Scenario: View response timing

When I click the "Timing" tab in the response panel
Then a waterfall chart is shown breaking down: TTFB, download, and total time
And individual timing values are listed below the chart

---

## Scenario: Preview HTML response

Given the response body is HTML
When I click the "Preview" tab in the response panel
Then a rendered preview of the HTML is shown

---

## Scenario: Copy response body to clipboard

When I click the "Copy" action button in the response panel
Then the response body is copied to the clipboard

---

## Scenario: Download response body

When I click the "Download" action button in the response panel
Then a file containing the response body is downloaded

---

## Scenario: Response size and duration are shown

After receiving a response
Then the response panel shows the response size in KB/MB
And the total request duration in milliseconds

---

## Scenario: Error response is displayed

Given the server returns a 4xx or 5xx status code
Then the response panel shows the error status code
And the response body is displayed with the error details

---

## Scenario: Network error is shown

Given the URL is unreachable or the network is unavailable
When I send the request
Then an error message is displayed in the response panel

---

@high
# evidence: src/components/response/RawViewer.tsx ("truncated" message, MAX_RESPONSE_DISPLAY_BYTES = 10 MB in src/lib/constants.ts), src/components/response/ResponsePanel.tsx (response-download-btn), mock-server GET /large?bytes=
## Scenario: E-REQ-15: Oversized response is truncated in view but downloadable in full

Requests target `{MOCK_BASE_URL}/large?bytes=<n>` with a unique `x-test-id` header (see `e2e/fixtures/README.md`).

Given the URL is `/large?bytes=` with a size above the 10 MB display limit
When I send the request
Then the raw viewer shows "Response truncated at 10 MB. Download full response"
When I click Download (`response-download-btn`)
Then the downloaded file size equals the requested byte count
And a smaller `/large?bytes=` response shows no truncation message
