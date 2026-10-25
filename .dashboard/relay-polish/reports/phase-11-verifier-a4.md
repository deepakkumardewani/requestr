# Phase 11 verifier report (attempt 4, narrow: P11.4 + P11.9): PASS

Host: PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost

## P11.4: PASS
- DRY fix: src/components/common/ShortcutRow.tsx now has an optional `note?: string` prop and renders `<p data-testid="shortcut-note" class="-mt-1.5 px-4 pb-2.5 text-xs text-muted-foreground">` when the prop is set.
  - Both callers pass `note={shortcut.noteKey ? tShortcuts(shortcut.noteKey) : undefined}`: ShortcutsSection.tsx (inside the divide-y list) and KeyboardShortcutsModal.tsx:83-95.
  - The copied wrapper div and conditional are gone. `grep -rn "shortcut-note\|-mt-1.5 px-4" src` shows the markup only in ShortcutRow.tsx; the other hits are specs. ShortcutRow has only these 2 callers.
- ShortcutRow.spec.tsx adds 2 cases: "renders the note under the row when provided" and "renders no note element when omitted".
- Behaviour, checked in agent-browser (seeded with qa-seed.init.js):
  - /app, Meta+/ dialog: exactly 1 shortcut-note, "Firefox may reserve this shortcut for its Library window. Use the New chat button in the Relay header instead.", directly under "New Relay chat⌘ShiftO". Screenshot: scratchpad/p11-a4-dialog-note.png
  - /settings, nav-shortcuts: exactly 1 shortcut-note with the same text under the same row. Screenshot: scratchpad/p11-a4-settings-note.png
- Log line: present at TASKS.md:2136. It is accurate:
  - It records the caveat check in both surfaces.
  - It lists the SPEC id corrections. All of relay-capabilities-popover, relay-capabilities-panel, relay-capability-category-, relay-capability-starter and relay-permission-notice exist in src and in SPEC.md.
  - It states 148 screenshots, which matches.
- Verify:
  - `test -s INDEX.md` exits 0.
  - The png count matches the INDEX count: 148 = 148, exit 0.
- `bun run lint:check`: exit 0 (742 files, no fixes).
- `bun run typecheck`: exit 0.
- `bunx vitest run src/components/layout src/components/settings src/components/common src/i18n`: 19 files, 1301 passed.
- `bunx playwright test e2e/qa/relay/relay-polish-shell.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts -g "REL-POL-SHELL-10|overlay lists aliases|CANVAS-21: tips are contextual" --repeat-each=2`: 6 passed (5.9s).
- Quality: no violations found in ShortcutRow.tsx, ShortcutsSection.tsx or the KeyboardShortcutsModal.tsx diff.
  - The one-line `noteKey ? t(noteKey) : undefined` in each caller is the call shape the attempt-3 report prescribed. It is not a duplicated block.

## P11.9: PASS
- DoD grep (`\.(skip|only|fixme)\(|it\.fails|test\.fail` over the polish specs, src/lib/relay, src/components/relay, src/stores, src/hooks) is empty, exit 0.
- `bash e2e/scenarios/relay/check-ids.sh`: "OK: scenario IDs consistent", exit 0.
- P11.1-P11.8 were verified in earlier attempts. This attempt's change is limited to ShortcutRow and its 2 callers and specs, and is covered by the re-runs above.
