# P11.4 builder a4
- ShortcutRow gained optional `note` prop (renders data-testid="shortcut-note"); KeyboardShortcutsModal and ShortcutsSection now pass it, duplicate blocks removed.
- ShortcutRow.spec.tsx: 2 new tests (note shown / omitted).
- TASKS.md P11.4 Log line added.
- lint:check clean, typecheck clean, vitest 19 files/1301 tests pass, e2e SHELL-10 + `?` overlay + CANVAS-21 (x2 specs) 8/8 passed with --repeat-each=2 (run before a biome whitespace-only reformat).
