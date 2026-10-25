# Phase 4 builder report (P4.1-P4.5)

- P4.1: added `closeTabs.*` and `confirm.deleteDirty/deleteMore` to messages/{en,fr,ja}/relay.json. biome ok, relayMessages.parity.spec 690 pass, brand grep clean.
- P4.2: new src/lib/relay/tools/tabs.ts (close_tab, close_all_tabs; pinned skipped unless includePinned; result {closed, saved, pinnedKept, needsDestination}); schemas.ts adds tools and `registerConfirmGate` so an auto tool can await the user when a target is dirty (schemas stays store-free); registry.ts registers tabTools and adds ConfirmPreview.dirtyTabs. Dirty targets without selection save-all|discard fail closed.
- P4.3: CloseTabsConfirmCard.tsx (Cancel focused on mount, Save all & close / Discard & close / Cancel); RelayConversation routes close tools to it: choices map to answer(save-all|discard) or decline ("user declined").
- P4.4: destructive.ts adds delete_requests, delete_requests_in_collection (kind confirm, severity danger; existing delete_request behaviour kept, shared helpers). ConfirmCard shows dirty-tab warning; count/first names/"and n more" via existing TargetList.
- P4.5: all delete previews (request, bulk, collection) list dirty open tabs; store still closes tabs for clean case. collectionWrite.ts untouched (no delete logic there).
- Existing specs updated: gating.spec (sample inputs), schemas.spec (counts/list).
- Known red until Unit P4.6: coverage.spec.ts audit (needs success/invalid/undo test names for the 4 new tools).
- Evidence: biome clean; 949 tests across relay tools/cards/i18n pass; `bun run typecheck` clean.
- Decisions: see dashboard questions (kind confirm instead of new destructive kind; delete decision = Approve/Decline; saveTab mirrors useSaveRequest).
