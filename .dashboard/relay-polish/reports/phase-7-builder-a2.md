# Phase 7 builder report (a2) — verifier fix-forward

## Summary

Addressed all P7 verifier FAIL items: TASKS Log lines, design screenshots, code quality Q1–Q6, e2e flake hardening, P7.11 gate green.

## P7.2 — Log

- Added **Log** line to `agent_docs/relay-polish/TASKS.md` with RELAY_TOOL_SCHEMAS audit (from builder-a1).

## P7.4 / P7.5 — Design evidence

- Added **Log** lines to TASKS.md for grouped slash menu and target/hint UX.
- Captured 8 PNGs: `agent_docs/qa/relay-polish/p7-slash-{1440,320}-{light,dark}.png`, `p7-target-{1440,320}-{light,dark}.png` via `e2e/qa/relay/capture-p7-design.spec.ts` (helper spec, not scenario-gated).
- Theme set via `localStorage` + `html` class before capture (no flaky full reload).

## Code quality

| ID | Fix |
|----|-----|
| Q1 | Dropped unused `attached` param from `isRedundantRequestAttach`; added unit tests in `chips.spec.ts`. |
| Q2 | `completeTargetPick()` clears pending state only (no redundant draft rewrite). |
| Q3 | `SlashTargetResolution` discriminated union; removed dead else branch in runner. |
| Q4 | Removed duplicate `/import` branch (handled by `requiresTarget: null`). |
| Q5 | Removed dead `export`/`env` and `tab` branches in `slashTarget.ts`. |
| Q6 | `RelayComposer.attach` uses exported `findTab` from `tabRequests.ts`. |

## P7.11 — Flake + gate

- **Root cause:** `toHaveValue` raced attach completion (SLASH-04, MENTION-03 Tab path).
- **Fix:** Assert pill count before composer value; pin Get Users row before Tab in MENTION-03.
- **Evidence:** `144 passed` slash+mention `--repeat-each=6` (log: `reports/logs/p7.11-a2-pw-x6.log`).

### P7.11 verify (all exit 0)

| Command | Result |
|---------|--------|
| `bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n` | 3320 passed (`p7.11-a2-vitest.log`) |
| playwright slash+mention x2 | 48 passed (`p7.11-a2-pw-slash-mention.log`) |
| playwright improvements x4 | 15 passed (`p7.11-a2-pw-improvements.log`) |
| `check-ids.sh` | OK |
| `bun run lint:check` | 0 warnings |
| `bun run typecheck` | exit 0 |
| `brandGuard.spec.ts` | 12 passed |

## Decision (P7.5 UX)

After target pick, draft stays literal `/run` (not `t(promptKey)`), per P7.5 AC “leaves the command text ready to send”. No send-time expansion. Dashboard `question` subcommand unavailable; logged here for orchestrator.

## Files touched

- `agent_docs/relay-polish/TASKS.md`
- `src/lib/relay/chips.ts`, `chips.spec.ts`
- `src/lib/relay/slashTarget.ts`, `slashTarget.spec.ts`
- `src/hooks/useSlashCommandRunner.ts`, `useSlashCommandRunner.spec.ts`
- `src/components/relay/RelayComposer.tsx`
- `src/lib/relay/tools/tabRequests.ts` (export `findTab`)
- `e2e/qa/relay/relay-polish-slash.spec.ts`, `relay-polish-mention.spec.ts`
- `e2e/qa/relay/capture-p7-design.spec.ts` (new)
- `agent_docs/qa/relay-polish/p7-*.png` (8 files)
