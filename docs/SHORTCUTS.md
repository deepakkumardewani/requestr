# Keyboard shortcuts

The shortcut registry is the single source of truth for bindings, the Settings page, the shortcuts modal and the table below. Every claim cites a path.

## Registry

`SHORTCUT_GROUPS` in `src/app/settings/constants.ts` lists groups (`general`, `request`, `workspace`, `tabs`, `chain`) of `Shortcut` entries. Fields:

- `actionKey`: stable identity and the key into `messages/*/shortcuts.json` for the label.
- `key`, `shift`, `ctrlOnly` (always Ctrl, even on Mac, to avoid macOS conflicts), `noModifier` (no Cmd or Ctrl).
- `aliases`: extra chords for the same action.
- `noteKey`: caveat text shown beside the row.
- `handler`: chain bindings only; the name the hook must call, asserted by the registry parity test.

Relay rows are kept out of the static registry because the chord differs per platform and the rows vanish with the feature flag. `getShortcutGroups(onMac, relayAvailable)` adds them to the `general` group; `findShortcut(actionKey, onMac)` returns one binding and throws on an unknown key; `getRelayToggleShortcut` returns the Relay chord (`src/app/settings/constants.ts`, `RELAY_SHORTCUTS` in `src/lib/relay/constants.ts`).

## Formatting

- `src/lib/shortcutFormat.ts`: `getShortcutKeyParts` and `getAliasKeyParts` return key caps (Cmd on Mac, `Ctrl` elsewhere); `formatShortcutMarkdown` and `buildShortcutsMarkdownTable` produce platform-neutral Markdown using `CMD_OR_CTRL_LABEL`.
- `src/lib/formatShortcut.ts`: `formatShortcut(entry)` gives one label such as `Ctrl+T`; `formatShortcutByAction(actionKey)` looks it up from the registry. `NEW_TAB_ACTION` names the new-tab binding.

## Consumers

| Surface | Path |
| --- | --- |
| Key handling | `src/hooks/useKeyboardShortcuts.ts` |
| Chain canvas | `src/components/chain/canvas/hooks/useChainCanvasShortcuts.ts` |
| Settings section | `src/components/settings/ShortcutsSection.tsx` (balances two columns from the `lg` breakpoint) |
| Modal | `src/components/layout/KeyboardShortcutsModal.tsx` |
| Empty state hints | `src/components/layout/EmptyStateShortcuts.tsx` |
| Tab bar labels | `src/components/layout/TabBar.tsx` |
| Shortcut table | this file, between the `shortcuts:start` and `shortcuts:end` comment markers |

## Keeping the table in sync

The table is generated from the registry and English messages (`buildShortcutsMarkdownTable`). `src/lib/shortcutFormat.spec.ts` (describe "shortcut table") compares the block in `docs/SHORTCUTS.md` with the generated table, so a registry change without a table update fails `bun run test`.

## Adding a shortcut

1. Add the entry to `SHORTCUT_GROUPS` in `src/app/settings/constants.ts`.
2. Add its label (and `noteKey` text) to `messages/en/shortcuts.json` and the `fr` and `ja` files.
3. Bind it in `src/hooks/useKeyboardShortcuts.ts` (or the chain canvas hook).
4. Update the table block and run the specs `src/app/settings/constants.spec.ts`, `src/lib/shortcutFormat.spec.ts` and `src/hooks/useKeyboardShortcuts.spec.ts`.

Browser coverage: `e2e/qa/polish-and-landing/p1-shortcuts.spec.ts`.

## Shortcut table

Press `?` on the chain canvas, or `⌘/Ctrl`+`/` anywhere, to open the full shortcut overlay. `⌘` is shown on macOS, `Ctrl` elsewhere.

<!-- shortcuts:start -->
| Group | Action | Shortcut |
| --- | --- | --- |
| General | Keyboard Shortcuts | `⌘/Ctrl` `/` |
| General | Command Palette | `⌘/Ctrl` `K` |
| Request | Send Request | `⌘/Ctrl` `Enter` |
| Request | Save Current | `⌘/Ctrl` `S` |
| Workspace | New Request | `Ctrl` `N` |
| Workspace | New tab | `Ctrl` `T` |
| Workspace | New Collection | `Ctrl` `Shift` `N` |
| Workspace | Manage Environments | `Ctrl` `E` |
| Workspace | Open Settings | `Ctrl` `,` |
| Workspace | Import Collection | `Ctrl` `I` |
| Workspace | Transform Playground | `Ctrl` `Shift` `T` |
| Workspace | Compare JSON | `Ctrl` `J` |
| Tabs | Close Tab | `Ctrl` `W` |
| Tabs | Close All Tabs | `Ctrl` `Shift` `W` |
| Tabs | Previous Tab | `Ctrl` `[` |
| Tabs | Next Tab | `Ctrl` `]` |
| Chain canvas | Run chain | `⌘/Ctrl` `Enter` |
| Chain canvas | Stop chain | `⌘/Ctrl` `.` |
| Chain canvas | Undo | `⌘/Ctrl` `Z` |
| Chain canvas | Redo | `⌘/Ctrl` `Shift` `Z` |
| Chain canvas | Delete selection | `Delete` / `Backspace` |
| Chain canvas | Duplicate selection | `⌘/Ctrl` `D` |
| Chain canvas | Copy selection | `⌘/Ctrl` `C` |
| Chain canvas | Paste | `⌘/Ctrl` `V` |
| Chain canvas | Select all | `⌘/Ctrl` `A` |
| Chain canvas | Open block menu | `⌘/Ctrl` `Shift` `K` / `/` |
| Chain canvas | Auto-layout | `L` |
| Chain canvas | Fit view | `F` |
| Chain canvas | Find node | `⌘/Ctrl` `F` |
| Chain canvas | Keyboard shortcuts (canvas) | `?` |
<!-- shortcuts:end -->
