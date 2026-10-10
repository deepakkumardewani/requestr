# Feature: Settings

As a user
I want to configure app preferences
So that the app behaves according to my workflow

Settings has six sections (nav testids `nav-general`, `nav-global`, `nav-appearance`, `nav-proxy`, `nav-shortcuts`, `nav-language`); General is the default section. Scenarios that must reach a server target the local mock server (`MOCK_BASE_URL` `/echo`, `MOCK_HTTPS_URL` self-signed listener) with a unique `x-test-id` header for isolation (see `e2e/fixtures/README.md`, `e2e/README.md`).

Chain concurrency (`chain-concurrency-input` in General) is owned by the chain scenarios (E-SET-06 is a pointer to E-CHN-01, intentionally not duplicated here).

---

## Background

Given the app is loaded

---

@high
# evidence: src/components/settings/AppearanceSection.tsx (theme-light/theme-dark/theme-system); spec: "toggles between dark, light, and system themes"
## Scenario: Toggle dark mode

Given I open the Settings page
When I select "Dark" as the theme
Then the app switches to dark mode

When I select "Light" as the theme
Then the app switches to light mode

When I select "System" as the theme
Then the app follows the OS theme preference

---

@high
# evidence: src/components/settings/ProxySection.tsx (ssl-verification-switch); spec: "disables SSL verification for self-signed certs"; superseded by E-SET-11 (real self-signed mock HTTPS target)
## Scenario: Toggle SSL verification

Given I open the Settings page
When I toggle the "SSL Verification" option off
And I send a request to a server with a self-signed certificate
Then the request is sent without SSL errors

---

@medium
# evidence: src/components/settings/ProxySection.tsx (follow-redirects-switch); spec: "disables follow redirects to see 3xx status codes" (target: mock `/redirect`)
## Scenario: Toggle follow redirects

Given I open the Settings page
When I disable the "Follow Redirects" option
And I send a request that returns a 3xx redirect
Then the response shows the redirect status code (not the final destination)

---

@medium
# evidence: src/components/settings/ProxySection.tsx (proxy-url-input); spec: "sets a custom proxy URL" (input value only; payload covered by E-SET-09)
## Scenario: Set a custom proxy URL

Given I open the Settings page
When I enter a custom proxy URL in the Proxy URL field
Then subsequent requests are routed through the specified proxy

---

@medium
# evidence: src/components/settings/ShortcutsSection.tsx (shortcut-group, shortcut-group-label); spec: "displays categorized keyboard shortcuts"
## Scenario: View keyboard shortcuts

Given I open the Settings page
When I click on the "Shortcuts" section
Then a list of all available keyboard shortcuts is displayed
And shortcuts are grouped into 5 categories, in order: General, Request, Workspace, Tabs, Chain canvas

---

@high
# evidence: src/components/settings/GeneralSection.tsx (Health indicators switch, general.healthIndicators), src/components/collections/HealthDot.tsx, src/stores/useSettingsStore.ts (showHealthMonitor)
## Scenario: E-SET-01: Health indicators toggle hides and restores the health dot

Given a collection containing a request that has history entries
And the sidebar collection row shows a health dot with success rate and response time
When I open Settings > General (the default section)
And I turn the "Health indicators" switch off
And I return to the sidebar
Then the collection request row shows no health dot

When I turn the "Health indicators" switch on again
And I return to the sidebar
Then the health dot is shown again

---

@high
# evidence: src/components/settings/GeneralSection.tsx (Code generation panel switch), src/components/request/CodeGenPanel.tsx (code-gen-panel, code-gen-lang-select), src/stores/useSettingsStore.ts (showCodeGen); shares the code-gen helper with E-REQ-12
## Scenario: E-SET-02: Code generation panel toggle shows and hides the panel

Given a request tab is open with a mock-server URL (`MOCK_BASE_URL/echo`)
And the "Code generation panel" switch is off in Settings > General
Then the request tab has no code-gen panel

When I turn the "Code generation panel" switch on
And I open the request tab
Then the code-gen panel is visible
And it defaults to the cURL snippet containing the request method and URL

When I choose "Python" in the language select
Then the snippet changes to a Python snippet for the same request

When I turn the "Code generation panel" switch off
Then the code-gen panel is hidden again

---

@high
# evidence: src/components/settings/AppearanceSection.tsx (theme-*, accent-*), src/components/settings/GeneralSection.tsx, src/stores/useSettingsStore.ts (persisted settings)
## Scenario: E-SET-03: Theme, accent colour and feature toggles persist after reload

Given I open the Settings page
When I select the "Dark" theme
And I pick a non-default accent colour
And I switch the "Health indicators" and "Code generation panel" toggles to the opposite of their defaults
And I reload the page
Then the app is still in dark mode
And the chosen accent swatch is shown as active in Appearance
And both toggles in General keep their changed state

---

@high
# evidence: src/components/settings/GeneralSection.tsx (clear-history-btn), src/components/settings/ClearHistoryDialog.tsx (confirm-clear-history-btn, Cancel), src/components/history/HistoryList.tsx (history-list), src/components/layout/LeftPanel.tsx (sidebar-tab-history)
## Scenario: E-SET-04: Clear History confirms to empty the History tab and Cancel keeps entries

Given at least one request has been sent so the History tab lists entries
When I click "Clear History" in Settings > General
Then a dialog titled "Clear History" warns the deletion is permanent
When I click "Cancel"
Then the dialog closes
And the History tab still lists the same entries

When I click "Clear History" again
And I click the confirm button (confirm-clear-history-btn)
Then the dialog closes
And the History tab shows no history items

---

@high
# evidence: src/components/settings/LanguageSection.tsx (locale select: English, Francais, Japanese), src/components/layout/HtmlLangSetter.tsx (document.documentElement.lang), messages/fr/*.json
## Scenario: E-SET-05: Switching language to Francais persists after reload with html lang="fr"

Given I open Settings > Language
When I choose "Français" in the language select
And I reload the page
Then the document root has lang="fr"
And the Settings navigation and title show French strings (for example "Paramètres", "Général")

---

@medium
# evidence: src/components/settings/GeneralSection.spec.tsx ("does not render a Restart Tour button"), src/components/settings/GeneralSection.tsx
## Scenario: E-SET-07: Settings General does not show a Restart Tour button

Given I open Settings > General
Then no "Restart Tour" button or `restart-tour-btn` element exists on the page
And the General section shows only the Features, Chain execution and Data Management groups

---

@medium
# evidence: src/components/settings/GlobalSection.tsx (global-base-url-input, default headers KVTable), src/stores/useSettingsStore.ts (globalBaseUrl, globalHeaders)
## Scenario: E-SET-08: Global base URL and header apply to a relative-URL request

Given I open Settings > Global
When I enter the mock server origin (`MOCK_BASE_URL`) as the Base URL
And I add the default header "x-test-id" with a unique value
And I open a request tab with the relative URL "/echo" and send it
Then the mock server receives the request at `/echo`
And the echoed headers include the global "x-test-id" value

When the request sets its own "x-test-id" header with a different value
And I send it again
Then the echoed value is the request-level one (request headers override global, case-insensitive)

---

@medium
# evidence: src/components/settings/ProxySection.tsx (proxy-url-input), src/app/api/proxy/route.ts (proxyUrl in payload)
## Scenario: E-SET-09: Custom proxy URL is included in the /api/proxy payload

Given I open Settings > Proxy & SSL
When I enter a custom proxy URL in the Proxy URL field
And I send a request to the mock server (`MOCK_BASE_URL/echo` with a unique `x-test-id`)
Then the intercepted `/api/proxy` request body contains `proxyUrl` equal to the entered value

---

@medium
# evidence: src/components/layout/LeftPanel.tsx (icon links with aria-label for transformPlayground, jsonVisualize, jsonCompare), src/components/transform/TransformPage.tsx, src/components/json-visualize/JsonVisualizePage.tsx, src/components/json-compare/*
## Scenario: E-SET-10: Sidebar utility icons navigate to the JSON tools and render pasted JSON

Given the app is loaded on the main workspace
When I click the Transform playground sidebar icon
Then the URL is "/transform"
And pasting valid JSON into the input shows a result

When I return and click the JSON visualize sidebar icon
Then the URL is "/json-visualize"
And pasting valid JSON renders the node graph

When I return and click the JSON compare sidebar icon
Then the URL is "/json-compare"
And pasting JSON into both sides renders the diff tree (diff-tree)

---

@medium
# evidence: src/components/settings/ProxySection.tsx (ssl-verification-switch), src/app/api/proxy/route.ts (sslVerify), e2e/README.md (MOCK_HTTPS_URL self-signed listener on :3334)
## Scenario: E-SET-11: SSL verification fails against a self-signed HTTPS server when on and succeeds when off

Given the mock server's self-signed HTTPS listener (`MOCK_HTTPS_URL/echo`)
And "SSL Verification" is on in Settings > Proxy & SSL (default)
When I send a request to `MOCK_HTTPS_URL/echo` with a unique `x-test-id`
Then the response shows an SSL/certificate error and no 2xx status

When I turn "SSL Verification" off
And I send the same request again
Then the response status is 200
And the echoed body reflects the request
