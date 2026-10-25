# Phase 5 builder report (P5.2-P5.7)

Evidence: `bun run typecheck` clean; `bunx biome check` on all touched source files clean (spec files are biome-ignored); `bunx vitest run src/lib/relay src/components/request src/components/relay src/stores/useTabsStore.spec.ts` = 77 files, 1224 tests passed; BRAND_GREP on touched non-spec files empty.

- P5.2: `src/types/index.ts` adds optional `draft` (WS, SIO) and `eventName` (SIO). `WebSocketTabs.tsx` compose draft now `tab.draft ?? ""` + `updateTabState`.
- P5.3: `SocketIOTabs.tsx` eventName/draft from tab; `DEFAULT_EVENT_NAME = "message"` when absent.
- P5.4: `schemas.ts` adds create_graphql_request, create_websocket_request, create_socketio_request, update_tab_request (flat strict object, `kind` discriminator + superRefine), get_tab_request (read). Invalid variables JSON / bad url scheme give structured zod errors. `schemas.spec.ts` counts updated, new cases added.
- P5.5/P5.6: new `tools/tabRequests.ts`, registered in `registry.ts`. Undo via a new `tabRequest` change entity in `changeLog.ts` (adapter reads tab snapshot from useTabsStore; null before closes the tab, else restores fields). get_tab_request redacts via redact.ts, caps messageLog at `RELAY_MESSAGE_LOG_CAP` (20), marks messages untrusted. `redact.corpus.ts` gains `TAB_REQUEST_CORPUS`. `registry.spec.ts` gains tagged tests ([success]/[invalid]/[undo]) so coverage.spec audit is green.
- P5.7: `REQUEST_KINDS` section appended to system prompt; spec asserts it.

## Decisions / out-of-Files edits (needed to satisfy the ACs)
- `changeLog.ts`: new `tabRequest` ChangeEntity, adapter and exported `snapshotTabRequest` (existing "tab" adapter is keyed by requestId; created tabs have none). `ChangeCard.tsx`: icon map entry for `tabRequest` (Record<ChangeEntity> typecheck).
- `requestWrite.ts`: only added `export` to `urlProblem`, `secretPairProblem`, `toAuthConfig`, `toPair`, `AuthInput` to reuse secret validation (no duplication). `workspaceRead.ts`: added `export` to `redactPairs`, `redactAuth`.
- Tab id is unknown until `openTab` runs, so the create ChangeSpec uses a getter for `entityId` (read after mutate).
- Update tool: `headers` replaces the whole list; `kind` input must match the tab's type.
