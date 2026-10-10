# Feature: Socket.IO Connections

As a user
I want to connect to a Socket.IO server and emit events
So that I can debug Socket.IO APIs

New scenarios target the local mock Socket.IO server (`MOCK_BASE_URL`, which echoes any event back under the same name; `?fail=1` forces a connect error) with a unique `x-test-id` (query param) for isolation; connect/disconnect are visible via `/__requests` (see `e2e/fixtures/README.md`).

---

@high
# evidence: src/components/request/ConnectButton.tsx, src/stores/useConnectionStore.ts (socket.on connect)
## Scenario: Connect

Given the app is loaded
And I open a Socket.IO tab
When I enter a valid Socket.IO server URL
And I click Connect
Then the UI shows a connected state (Disconnect is available)

---

@high
# evidence: src/components/request/tabs/SocketIOTabs.tsx (socketio-event-input, ws-message-input, socketio-send-btn), src/stores/useConnectionStore.ts (emitSocketIoMessage)
## Scenario: Emit event with data

Given I am connected via Socket.IO
When I set an event name and payload
And I click Send
Then the message log records an outbound (sent) entry

---

@high
# evidence: src/stores/useConnectionStore.ts (socket.on "message", appendWsLog)
## Scenario: Receive event in log

Given I am connected to a server that echoes or pushes events
When an event is received
Then the message log records an inbound (received) entry

---

@high
# evidence: src/components/request/ConnectButton.tsx (disconnect-btn), src/stores/useConnectionStore.ts (disconnect)
## Scenario: Disconnect

Given I am connected via Socket.IO
When I click Disconnect
Then the UI returns to a disconnected state (Connect is available)

---

@high
# evidence: src/stores/useConnectionStore.ts (connect_error -> setError, socket.disconnect), src/components/request/tabs/SocketIOTabs.tsx (socketio-error), e2e/support/mock-server/socketIoServer.ts (?fail=1)
## Scenario: E-RT-02: Socket.IO to an unreachable URL shows an error and re-enables Connect

Given I open a Socket.IO tab
When I enter a URL on an unreachable local port (nothing listening)
And I click Connect
Then an error message is visible in the tab
And the button does not remain on "Connecting…"
And the Connect button is enabled again

---

@high
# evidence: src/stores/useTabsStore.ts (closeTab -> disconnectSocketTabs), e2e/support/mock-server/socketIoServer.ts (disconnect event recorded)
## Scenario: E-RT-04b: Closing a connected Socket.IO tab makes the server see a disconnect

Given I am connected to the mock Socket.IO server with my `x-test-id`
And the mock server request log shows a `socketio` connect entry for my id
When I close the Socket.IO tab
Then the mock server request log shows a `socketio` disconnect entry for my id

---

@medium
# evidence: src/components/request/tabs/SocketIOTabs.tsx (socketio-event-input), src/stores/useConnectionStore.ts (emitSocketIoMessage, socket.on "message")
## Scenario: E-RT-11: A custom event name is emitted and the server echo is received

Given I am connected to the mock Socket.IO server
And the event name input defaults to "message"
When I send a text payload with the default event name
Then the message log shows a sent entry with that payload
And the message log shows a received entry with the echoed payload
When I change the event name to a custom name (for example "custom:ping") and send another payload
Then the message log shows a sent entry with that payload
And the connection stays connected
# note: the client only subscribes to the "message" event (useConnectionStore), so the server's echo under a custom event name is not logged as received; assert only the sent entry for custom names
