# P8.11 Checkpoint 8 gate (a3)
All Verify commands run fresh; no source changes needed.
1. vitest relay/hooks/stores/i18n: exit 0 (135 files, 3886 tests passed)
2. playwright 5 polish specs --repeat-each=2: exit 0 (112 passed)
3. playwright picker + a11y keyboard + a11y layout: exit 0 (10 passed)
4. check-ids.sh: exit 0 (OK: scenario IDs consistent)
5. bun run lint:check: exit 0, 0 warnings (biome: 733 files, no fixes)
6. bun run typecheck: exit 0
7. brandGuard.spec.ts: exit 0 (12 passed)
8. test -z grep RelayPicker|relay-picker-kind-: exit 0
