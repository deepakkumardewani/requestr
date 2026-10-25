# Phase 4 builder a3 (P4.5 FR-133 fix)

Dirty-tab deletes now route through the FR-131 decision card.

Flow: delete tool preview (`describe`) lists `dirtyTabs` (DirtyTab[]) -> RelayConversation renders CloseTabsConfirmCard (`deleting: true`) instead of ConfirmCard -> Save all/Discard resolves `{kind:"answer", choice, approve:true}` (useRelayChat grants approval + selection); Cancel -> decline -> "user declined". Tool `run` calls `settleDirtyTabsForDelete(requestIds, selection)`: no/invalid decision -> fail DECISION_REQUIRED; save-all -> saveDirtyTabs (reused saveTab) before the request snapshot is read (so Undo restores saved edits); discard -> proceed. Clean tabs: unchanged.

Files changed
- src/lib/relay/tools/tabs.ts (DirtyTab, dirtyTabsAmongRequests replaces dirtyTabNamesForRequests, saveDirtyTabs extracted + reused by closeTabs, settleDirtyTabsForDelete, CloseTabsPreview.deleting)
- src/lib/relay/tools/destructive.ts (4 delete tools settle before delete)
- src/lib/relay/tools/registry.ts (ConfirmPreview.dirtyTabs: DirtyTab[])
- src/hooks/useRelayChat.ts (ToolResolution answer.approve)
- src/components/relay/RelayConversation.tsx (route dirty delete to CloseTabsConfirmCard)
- src/components/relay/CloseTabsConfirmCard.tsx (deleteTitle when preview.deleting)
- src/components/relay/ConfirmCard.tsx (removed obsolete DirtyTabsWarning)
- messages/{en,fr,ja}/relay.json (+closeTabs.deleteTitle, -confirm.deleteDirty/deleteMore)
- specs: ConfirmCard.spec.tsx (removed 3 warning tests), tabs.spec.ts (rename), destructive.spec.ts (new FR-133 decision block, dirtyTabs shape; push cast), collectionWrite.spec.ts (push cast, fixed pre-existing typecheck error)

New branches needing coverage: settleDirtyTabsForDelete (no dirty / invalid selection / save-all / discard), saveDirtyTabs unsaved path, RelayConversation dirty-delete card route + approve:true answer, CloseTabsConfirmCard deleteTitle, useRelayChat answer+approve grant.

Evidence: biome clean (101 files); `bun run typecheck` clean; vitest src/lib/relay src/components/relay src/hooks 82 files/1417 tests pass; i18n 834 pass.
