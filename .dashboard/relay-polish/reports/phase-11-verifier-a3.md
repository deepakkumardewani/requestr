# Phase 11 verifier report (attempt 3): FAIL

Host: PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost (used in place of 127.0.0.1:3000).

## Failures (fix list for the builder)

1. **Quality, DRY: src/components/layout/KeyboardShortcutsModal.tsx:84-98.** This attempt's Firefox-note fix copied a block that is byte-identical to src/components/settings/ShortcutsSection.tsx:34-48. Both files have the same wrapper `<div key=…>`, the same `<ShortcutRow …/>`, the same `shortcut.noteKey ? <p …> : null` conditional, the same class string `-mt-1.5 px-4 pb-2.5 text-xs text-muted-foreground`, and the same `data-testid="shortcut-note"`.
   - Fix: move the note into the shared component.
     - Either give `src/components/common/ShortcutRow.tsx` an optional `note?: string` prop that renders the `<p data-testid="shortcut-note">` under the row, or add a small `ShortcutListItem` in `src/components/common/` that wraps ShortcutRow and the note.
     - Both callers pass `note={shortcut.noteKey ? tShortcuts(shortcut.noteKey) : undefined}` and drop their copied wrapper and conditional.
     - Add a "renders the note when given / omits it otherwise" case to `src/components/common/ShortcutRow.spec.tsx`.
   - Scope: this touches files outside P11.4's Files list. That follows from the out-of-scope fix prescribed in the attempt-2 report (the P2.6 gap), so it is not a separate scope failure.
   - Re-run after the fix:
     - `bun run lint:check`
     - `bun run typecheck`
     - `bunx vitest run src/components/layout src/components/settings src/components/common`
     - `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost bunx playwright test e2e/qa/relay/relay-polish-shell.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts -g "REL-POL-SHELL-10|overlay lists aliases|CANVAS-21: tips are contextual" --repeat-each=2`
2. **P11.4 Do (1): Log line missing.** The check is recorded at agent_docs/qa/relay-polish/INDEX.md:186, but TASKS.md has no `- **Log**:` line under P11.4 (`grep -n "P11.4" TASKS.md` shows only the heading, the deps line and the traceability rows). Add a Log line under P11.4 recording that the caveat is shown in Settings > Shortcuts and in the Cmd+/ dialog. This is not an AC, so it would not block by itself.
3. **P11.9 DoD: blocked** by item 1 (P11.4 not passing).

## P11.1 Removed-symbol sweep: PASS
- The three Verify greps (symbols over src/e2e/messages, Sparkles in src/components/relay, RelayPicker\b) all exit 0.

## P11.2: PASS (attempt 2, nothing in scope changed)
- messages/* were not touched since attempt 2.
- Parity and brand guard pass again inside the scoped vitest run below (src/i18n + brandGuard).

## P11.3 Final bundle check: PASS (verdict line)
- `grep -nE '^P11\.3 verdict: PASS$' BUNDLE.md` gives line 34.
- The spec run passed in attempt 2 (90 passed). The bundle is unaffected, since this attempt's change is a small JSX edit outside the lazy chunk.

## P11.4 Docs: Verify passes; FAIL on quality (item 1) and Log (item 2)
- `test -s agent_docs/qa/relay-polish/INDEX.md` exits 0. There are 148 png files and 148 index lines.
- Browser check (agent-browser, seeded with e2e/fixtures/qa-seed.init.js, https://requestly.localhost/app, Meta+/):
  - The dialog is open, and a single `[data-testid=shortcut-note]` is visible under the row "New Relay chat⌘ShiftO".
  - Its text: "Firefox may reserve this shortcut for its Library window. Use the New chat button in the Relay header instead."
  - Screenshot: /private/tmp/claude-502/-Users-deepakdewani1-Documents-Programs-react-requestly/bca6d0ce-353e-4428-9c36-d48997231906/scratchpad/p11-shortcuts-dialog-note.png
- KeyboardShortcutsModal.spec.tsx adds "shows the Firefox caveat note under New Relay chat". It asserts exactly 1 note matching /firefox/i, and it passes.
- Non-blocking: the RelayHeader "New chat" tooltip still has no caveat. This was optional in attempt 2.

## P11.5 E2E accessibility: PASS
- `bunx playwright test e2e/qa/relay/relay-polish-a11y.spec.ts --repeat-each=3`: 24 passed (34.9s).
- `bash e2e/scenarios/relay/check-ids.sh`: OK, scenario IDs consistent.
- grep for test.fail|it.fails|.skip|.only|.fixme in the spec: no hits.
- A11Y-02 now includes `[role="menu"]` and `[data-slot="dropdown-menu-content"]`. That slot is on the portaled popup (src/components/ui/dropdown-menu.tsx:42), and the scan runs after `relay-thread-menu-rename` is visible, so the menu is scanned.
- A11Y-06 asserts `relay-permission-option-${mode}` has `aria-checked="true"` for each of review, always-ask and skip before scanning. PermissionShield.tsx:184-186 carries aria-checked and the testid.
- A11Y-07 removes the dead branch. It unconditionally asserts `relay-empty` is visible and then scans it.

## P11.6 Targeted run: PASS (attempt 2)
- Re-checked the specs that touch the shortcuts dialog after the modal change:
  - relay-polish-shell SHELL-10, chaining-ui-overhaul "`?` overlay lists aliases" and CANVAS-21 "tips…Show tips lives in the ? overlay": 6 passed at --repeat-each=2.

## P11.7 Whole-project checks (re-run after the modal change): PASS
- `bun run lint:check`: exit 0 (biome checked 742 files).
- `bun run typecheck`: exit 0.
- `bunx vitest run src/components/layout src/i18n src/lib/relay/brandGuard.spec.ts`: 10 files, 1269 passed.

## P11.8 Walkthrough: PASS (attempt 2 spec evidence; no relevant change since)

## P11.9 DoD: blocked
- The DoD grep (skip/only/fixme/it.fails/test.fail across polish specs, src/lib/relay, src/components/relay, src/stores, src/hooks) exits 0.
- check-ids OK.
- Blocked only by the P11.4 failure.
