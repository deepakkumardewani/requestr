# Feature: WebSocket Connections

As a user
I want to connect to a WebSocket endpoint and exchange messages
So that I can debug real-time APIs

New scenarios target the local mock WebSocket server (`MOCK_WS_URL`, path `/ws`, echoes every frame) with a unique `x-test-id` (query param `?x-test-id=...`) for isolation; connect/message/close are visible via `/__requests` (see `e2e/fixtures/README.md`).

---

@high
# evidence: src/components/request/ConnectButton.tsx (connect-btn, disconnect-btn), src/stores/useConnectionStore.ts (connect)
## Scenario: Connect

Given the app is loaded
And I open a WebSocket tab
When I enter a valid WebSocket URL
And I click Connect
Then the UI shows a connected state (Disconnect is available)

---

@high
# evidence: src/components/request/tabs/WebSocketTabs.tsx (ws-message-input, ws-send-btn), src/components/request/MessageLog.tsx (ws-log-entry data-direction)
## Scenario: Send message

Given I am connected to a WebSocket
When I type a message and click Send
Then the message log records an outbound (sent) entry with that payload

---

@high
# evidence: src/stores/useConnectionStore.ts (ws.onmessage, appendWsLog), src/components/request/MessageLog.tsx
## Scenario: Receive message in log

Given I am connected to an echo WebSocket server
When I send a message
Then the message log records an inbound (received) entry with the echoed payload

---

@high
# evidence: src/components/request/ConnectButton.tsx (disconnect-btn), src/stores/useConnectionStore.ts (disconnect)
## Scenario: Disconnect

Given I am connected to a WebSocket
When I click Disconnect
Then the UI returns to a disconnected state (Connect is available)

---

@high
# evidence: src/stores/useConnectionStore.ts (connect try/catch -> setError, isConnecting false), src/components/request/ConnectButton.tsx (Connecting state), src/components/request/tabs/WebSocketTabs.tsx (note: conn.error is not rendered in this tab today)
## Scenario: E-RT-03: Invalid WebSocket URL shows an error and does not stay "Connecting"

Given I open a WebSocket tab
When I enter an invalid URL (for example `not a url`) in the URL bar
And I click Connect
Then an error is shown to the user
And the button does not remain on "Connecting…"
And the Connect button is enabled again
And the mock server request log for my `x-test-id` has no `ws` connect entry

---

@high
# evidence: src/stores/useTabsStore.ts (closeTab -> disconnectSocketTabs), e2e/support/mock-server/wsServer.ts (close event recorded)
## Scenario: E-RT-04a: Closing a connected WebSocket tab makes the server see a close

Given I am connected to the mock WebSocket server at `MOCK_WS_URL` with my `x-test-id`
And the mock server request log shows a `ws` connect entry for my id
When I close the WebSocket tab
Then the mock server request log shows a `ws` close entry for my id

---

@medium
# evidence: src/components/request/MessageLog.tsx (message-log-clear-btn, "No messages yet"), src/components/request/tabs/WebSocketTabs.tsx (handleClearLog)
## Scenario: E-RT-10: Clearing the message log empties it

Given I am connected to the mock WebSocket server
And I have sent a message so the log has a sent entry and an echoed received entry
When I click Clear in the message log
Then the log contains no entries
And "No messages yet" is shown
And I can still send a new message afterwards
