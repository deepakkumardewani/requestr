# P8.11 Checkpoint 8 - PASS

## Fixes (fix forward)
- REL-IA11Y-05: the test was stale, not the app. P6's unified composer puts "+", mic and send on one toolbar row BELOW the textarea (relay-composer-toolbar). The old assertion expected "+" left of the textarea. Rewrote expectRowOrder (toolbar below field, + < mic < send, one row, inside dock), removed test.fail(), updated title and e2e/scenarios/relay/relay-improvements-a11y-layout.feature.md. Passes at 320px, 409px and 375px mobile sheet (2 passed). Launcher swap did not regress 320px layout.
- e2e/fixtures/relayE2eHelpers.ts attachFromPicker: scoped the kind row to relay-launcher-section-attach. After reload, a Recent row matched /environment/ and attached directly, so the typed search text was sent as a chat message (REL-POL-CTX-10 failed 3 vs 2 bodies).
- e2e/scenarios/relay/relay-polish-launcher.feature.md: headings converted to "## Scenario: [ID] title" so check-ids.sh matches.
- src/lib/relay/launcherItems.spec.ts: typed mockSlashCommand (SlashCommand/SlashCommandId), fixed translate key to slash.explain.description.
- src/components/relay/RelayLauncher.spec.tsx: createRef<HTMLButtonElement>().

## Verify results
- vitest relay/lib/hooks/stores/i18n: exit 0, 135 files, 3881 tests passed
- playwright polish launcher/mention/slash/ctx/composer --repeat-each=2: 112 passed (after helper fix; first run had 2 CTX-10 failures)
- playwright picker + a11y-keyboard + a11y-layout: 10 passed
- check-ids.sh: exit 0 "OK: scenario IDs consistent"
- lint:check: exit 0 (4 pre-existing warnings)
- typecheck: exit 0
- brandGuard.spec: 12 passed
- grep RelayPicker\b|relay-picker-kind-: empty (exit 0)
