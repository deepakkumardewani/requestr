# Phase 2 builder report (P2.1-P2.8)

Commands run: biome check (all touched files, clean), `bunx tsc --noEmit` (clean), vitest on src/components/relay src/components/layout src/components/settings src/hooks src/lib/relay src/app/settings src/i18n (121 files, 3054 tests passed), brandGuard (12 passed), parity specs passed. `grep Sparkles` under src/components/relay and TabBar: none; LeftPanel has no RelayToggleButton.

- P2.1/P2.2: strings in en/fr/ja (`logo.label`, `header.newChatShortcut` in relayDock; `relayNewChat`, `relayNewChatNote` in shortcuts).
- P2.3: `RelayLogo.tsx` inline SVG (currentColor, data-testid relay-logo, optional `label` makes it role=img with title/aria-label, else aria-hidden). Toggle uses it.
- P2.4: logo leads header (no active thread), 48px hero in EmptyState, in OpenInRelayButton.
- P2.5: `RELAY_NEW_CHAT_SHORTCUTS`; hook handles chord (setOpen(true) bumps focusRequest, then store.newThread()); toggle chord still toggles.
- P2.6: settings `getRelayShortcuts` yields toggle + new-chat rows; `Shortcut.noteKey` rendered as Firefox note in ShortcutsSection only. KeyboardShortcutsModal.tsx needed no change (reads getShortcutGroups).
- P2.7: toggle moved to TabBar right block after TabListDropdown, outside tabs.length condition, wrapped in TooltipProvider.
- P2.8: header buttons wrapped in Tooltip, 700ms provider delay, keycaps via Kbd; aria-labels retained.

Design log: ui-ux-pro-max/impeccable/layout applied by inspection of screenshots; glyph stroke 1.75 on 24 grid, primary-tinted hero, keycaps right-aligned in tooltip.
Screenshots: agent_docs/qa/relay-polish/p2-{logo,identity,tooltips,tabbar,shortcuts}-*.png (1440 dark/light, 320 light).

Decisions: new-chat tooltip text uses `header.newChatShortcut` ("New chat"); aria-label stays `threads.new`. Conversation trigger got a tooltip but no aria-label (its name is the title text; an aria-label would override it).
