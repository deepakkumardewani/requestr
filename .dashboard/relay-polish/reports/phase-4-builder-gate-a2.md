# P4.9 gate a2
- vitest relay/lib/i18n: 95 files, 2727 tests pass (exit 0)
- playwright polish-threads+panel --repeat-each=2: 40 passed (exit 0)
- relay-threads.spec: 5 passed (exit 0)
- check-ids.sh: OK (exit 0)
- lint:check: initially exit 1 (biome format only, e2e/fixtures/relayE2eHelpers.ts, src/vitest-setup.ts); fixed with `biome format --write` on those two files; rerun exit 0
- typecheck: exit 0
- brandGuard.spec: 12 passed (exit 0)
