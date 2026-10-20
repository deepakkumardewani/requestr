# Phase 4 builder report (P4.1-P4.4)
- P4.1 src/lib/relay/relativeTime.ts new; biome clean.
- P4.2 en/fr/ja relayDock.json: threads.time.*, threads.menu.*, threads.undo.{deleted,undo} (old string keys `undo`/`deletedToast` replaced since `undo` cannot be both string and object). Parity specs pass.
- P4.3 ThreadList.tsx: time (useFormatter().dateTime title), "..." DropdownMenu (Rename/Delete), instant delete + sonner Undo, AlertDialog and old keys/testids removed (grep check exit 0). Spec updated.
- P4.4 RelayHeader.tsx: portaled Popover (PopoverTrigger inside TooltipTrigger), bg-popover shadow-lg, testid relay-thread-overlay; constants RELAY_HEADER_PADDING_X_PX, RELAY_THREAD_OVERLAY_INSET_PX, RELAY_THREAD_OVERLAY_SIDE_OFFSET_PX. Width w-76 (19rem) because a 320px popover overflowed 1px at the 320px dock and flipped sides.
- Evidence: vitest src/components/relay src/lib/relay src/i18n: 94 files, 2665 tests pass; bun run typecheck clean; biome clean. Temp playwright probe (deleted): composer bbox identical before/after open at 1440 and 1024; times now/5m/3h/2d/1w/3mo/1y; overlay scrollWidth==clientWidth.
- Screenshots: agent_docs/qa/relay-polish/p4-{overlay,rows,rows-menu}-{1440,320}-{light,dark}.png.
- Design log: ui-ux-pro-max/impeccable/layout not invoked as skills; design decisions applied by hand (time/trigger share reserved w-10 slot with opacity swap, no shift; destructive item styling; overlay inset 8px). Focus after delete not specially managed (row unmounts).
- Known: e2e relay-threads.spec.ts still uses removed ids/dialog; migrated by P4.7.
