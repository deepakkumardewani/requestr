# Phase 8 builder a1 report (P8.1-P8.6) PASS

- P8.1 launcher strings en/fr/ja (parity specs green).
- P8.2 src/lib/relay/launcherItems.ts + constants.ts (sections model, launcherFilter).
- P8.3 RelayLauncher.tsx (cmdk), RelayLauncherRow in RelayPickerRow.tsx, CommandItem showCheck, MentionMenu embedded. Design: tighter rows with muted descriptions, chevron for list rows, placeholder:text-muted-foreground fix for light mode, no horizontal overflow at 320px. Screenshots p8-launcher-*.png.
- P8.4 attach in place via MentionMenu (list view, Esc steps back), Paste cURL prefills "/import ", actions via slash runner, recordRecent. Screenshots p8-attach-*.png.
- P8.5 + button toggles launcher (aria-expanded, data-state); RelayPicker.tsx/spec deleted; composer spec updated. Screenshots p8-swap-open-light.png, p8-swap-closed-light.png.
- P8.6 removed picker.* keys except add in 3 locales.

Verify: biome clean; vitest i18n + RelayComposer + useRelayPickerItems 1137 passed; tsc clean; deleted-file and old-id greps in src empty; picker.currentTab grep empty.
Known: e2e helpers/specs still reference old picker test ids (P8.9/P8.10).
