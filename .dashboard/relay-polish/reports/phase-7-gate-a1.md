# Phase 7 gate — P7.11 (Checkpoint 7)

## Task P7.11 — gate verification

### Fix-forward (gate failures)

1. **`REL-POL-MENTION-05` flaky (2 pills on re-select)**  
   - Root cause: two seeded requests named "Get Users" (`qa-req-users`, `qa-e2e-mention-get-users`); default mention highlight picked a different row on second Enter; tab vs request chips could also double-count.  
   - Changes: `MentionMenu` prefers already-attached option when resetting highlight; `isRedundantTabAttach` / `isRedundantRequestAttach` in `chips.ts`; `RelayComposer.attach` skips redundant cross-kind attaches.

2. **Infinite re-render (dev server melt)**  
   - `useRelayStore` selector returned `new Set()` each read → fixed with `useMemo` on `attachedItems`.

3. **`bun run typecheck`**  
   - `useSlashCommandRunner`: map `SlashTargetKind` `"tab"` to `null` picker kind (tab is pinned row, not a filter kind).

### Verify commands (final — all exit 0)

| Step | Command | Result |
|------|---------|--------|
| vitest | `bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n` | EXIT 0 (log: `.dashboard/relay-polish/reports/logs/p7.11-v3-vitest-relay.log`) |
| pw slash+mention | `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-slash.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts --repeat-each=2` | EXIT 0, 48 passed (log: `p7.11-v3-pw-slash-mention.log`) |
| pw improvements | `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-smart-tests.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts` | EXIT 0 (log: `p7.11-v3-pw-improvements.log`) |
| check-ids | `bash e2e/scenarios/relay/check-ids.sh` | EXIT 0 |
| lint | `bun run lint:check` | EXIT 0 |
| typecheck | `bun run typecheck` | EXIT 0 (after tab kind fix) |
| brandGuard | `bunx vitest run src/lib/relay/brandGuard.spec.ts` | EXIT 0, 12 passed |

### Files touched (gate fix-forward)

- `src/lib/relay/chips.ts`, `src/lib/relay/chips.spec.ts`
- `src/components/relay/RelayComposer.tsx`
- `src/components/relay/MentionMenu.tsx`
- `src/hooks/useSlashCommandRunner.ts`

### Outcome

**PASS** — all P7.11 verify commands green with evidence in logs under `.dashboard/relay-polish/reports/logs/p7.11-v3-*`.
