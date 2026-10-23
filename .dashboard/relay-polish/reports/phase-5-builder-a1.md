# Phase 5 builder report (P5.1-P5.8)

Result: PASS (implementation tasks only).

- P5.1 chips.ts / contextBuilder.ts: `tab` chip kind; payload built only from `attachedItems`; auto-chip code removed. contextBuilder+chips specs rewritten.
- P5.2 useRelayStore / useRelayChat: draftChips, removedChipKeys, dismissedAutoChipTabId and their actions removed; `attachedItems` sole source; `runTool` passes `attached`.
- P5.3 ContextChips: renders attached chips only, kind icons, tab kind; testids kept.
- P5.4 workspaceRead / registry: `get_active_context` returns attached items only (0 -> note); `ToolContext.attached`.
- P5.5 schemas / systemPrompt: descriptions + ATTACHED_CONTEXT_RULES ("ask user to attach Current tab"); audit: no tool defaults to the active tab.
- P5.6 messages en/fr/ja: starters, picker.currentTab, context.kindTab; autoChip strings and old suggestions removed; parity specs pass.
- P5.7 suggestions.ts -> STARTER_KEYS; EmptyState tab-independent; followUps audit (comment only).
- P5.8 RelayPicker: pinned "Current tab" Button (disabled "No tab open"); useRelayPickerItems returns `currentTab`; RelayPickerRow tab label key.

Out-of-Files edits (stale consumers): OpenInRelayButton.tsx (comment), OpenInRelayButton.spec, openInRelay.spec, RelayDock.spec, RelayConversation.spec (memo test rewritten to attach flow), registry.ts.

Evidence: `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n` -> 130 files, 3434 tests passed. `bunx biome check src` clean. `bun run typecheck`: only errors in e2e/qa/relay/relay-improvements-context-suggestions.spec.ts (removed `suggestions.*` keys; owned by P5.11-P5.14 e2e tasks). Removed-symbol grep over src+e2e clean.
Screenshots: agent_docs/qa/relay-polish/p5-{chips,empty,picker}-{1440,320}-{light,dark}.png (verified chip attach live in browser).

Decisions: first tab/collection/env in dedicated payload fields, rest in `attached`; non-active tab chip described by identity only (StoreAccess unchanged); picker row is a pinned Button outside the cmdk list; `seeWhat` strings kept for P10.

Ownership of remaining typecheck errors: e2e/qa/relay/relay-improvements-context-suggestions.spec.ts is owned by P5.12 (Files list). Removed `data-context` (EmptyState list) is asserted in relay-chat.spec.ts lines 345/353, owned by P5.13. Removed testids: only `data-context`; `relay-context-chip-label` was restored. Spec `toEqual` for useRelayPickerItems now asserts `currentTab: null`.
