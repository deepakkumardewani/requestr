# P6.16 gate report
- vitest src/components/relay src/lib/relay src/hooks src/stores src/i18n: 132 files / 3576 tests pass
- composer+mention e2e --repeat-each=2: 52 passed; legacy 9-spec set: 49 passed; ctx+shell specs: 21 passed; composer --repeat-each=3 passed
- check-ids exit 0; lint:check clean; typecheck clean (fixed Mock typing in MentionMenu.spec.tsx and chains:{} in ComposerPills.spec.tsx); brandGuard 12 pass; final grep exit 0
Fixes: relay-context-chip -> relay-composer-pill in ctx/shell specs. Composer spec rewritten for 05 (real offline assertions), 06 (real tab order incl. 2 pill X + mic), 08 (real tooltips on keyboard focus; MIC testid was wrong "relay-mic-button" -> "relay-mic"), 10 (real mention attach + X strips token), 11 (real sidebar delete, data-stale, line-through, payload chips empty; previously referenced undefined deleteFromDatabase), 12 (real attach + new-chat chord). waitForTimeout removed.
Note: relay-polish-mention.spec.ts scenarios 05/06/07 are still conditional/weak (P6.15); not touched.
