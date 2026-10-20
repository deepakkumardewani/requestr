# Phase 9 verifier a1

Independent re-run 2026-10-20. TASKS.md not marked (phase not fully green).

## P9.1 PASS
- biome check en/fr/ja relay.json: exit 0
- `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts src/lib/relay/brandGuard.spec.ts` included in impl batch: 17 files, 1519 tests, exit 0
- en `permission.*` matches SPEC strings; `{name}` kept; key sets equal across en/fr/ja

## P9.2 PASS
- biome relayDock.json x3: exit 0
- parity specs in the same 1519-test run
- `confirm.change.*` and launcher settings keys exist; `{count}`/`{targets}` preserved (ICU plural in en/fr). `composer.shield.valueLabel` absent; launcher shows the mode from `permission.option.*.label`, so the conditional key is not required.

## P9.3 PASS
- biome permission.ts, useRelayPermissionStore.ts, constants.ts: exit 0
- constants.spec.ts in the 1519-test run
- coverage (extra include): permission.ts + store inside 100% (59/59 stmts, 28/28 branches)

## P9.4 PASS
- biome schemas + spec: exit 0
- schemas.spec.ts green inside 1519
- `grep from "(@/stores|react)" schemas.ts` empty, exit 0

## P9.5 PASS
- biome registry, describeGeneric, registry/gating/hardening specs: exit 0
- those specs green inside 1519

## P9.6 FAIL · design log
- biome + `useRelayChat.spec.ts` `ConfirmCard.spec.tsx` `RelayConversation.spec.tsx` green inside 1519
- screenshots `p9-confirm-change-{320,1440}-{light,dark}.png` exist
- Conventions: UI task has no `**Log**` design line in TASKS.md (ui-ux-pro-max / impeccable / layout). Add that one line.

## P9.7 FAIL · design log
- `grep -c --warning src/app/globals.css` = 6
- `bun run lint:check`: 737 files, exit 0
- No `**Log**` line on the task. Add it.

## P9.8 FAIL · design log
- biome + useRelayStore.spec.ts green; `p9-shield-*.png` exist
- No `**Log**` line. Add it.

## P9.9 FAIL · design log
- biome + RelayComposer.spec.tsx green; `p9-composer-*.png` exist
- No `**Log**` line. Add it.

## P9.10 FAIL · design log
- biome + RelaySection.spec.tsx green; `p9-settings-*.png` exist
- No `**Log**` line. Add it.

## P9.11 FAIL · design log
- biome + launcherItems/RelayLauncher/RelayComposer specs green; `p9-launcher-*.png` exist
- No `**Log**` line. Add it.

## P9.12 PASS
- biome telemetry + store: exit 0
- telemetry.spec.ts green; telemetry.ts inside the 100% extra coverage run

## P9.13 PASS
Command: the task coverage vitest. 5 files, 142 tests, exit 0.
- permission.ts, useRelayPermissionStore.ts, describeGeneric.ts: 100% (hidden as skip-full; combined extra run 100% lines/branches/functions/statements)
- schemas.ts: stmts 99.14, branches 97.77, funcs 100, lines 100. Uncovered L167 `isJsonObjectText` JSON.parse catch (pre-existing parser, not the mode table).
- registry.ts: stmts 100, branches 93.33, funcs 100, lines 100. Uncovered L178 `describeIssues` zod path join; L256 `previewConfirmation` null when parse fails. Both are pre-existing error branches, not the RP-221 mode path.
- Lowest: registry branches 93.33%. No skip/only/fixme in these specs.

## P9.14 FAIL · unit coverage
Command exit 0, 5 files, 129 tests, but RelaySection.tsx is under 80:
- lines 87.87 (uncovered 82-84, 120)
- branches 75
- functions 94.73
- statements 90.47
Uncovered: `handleClear` catch (82-84) and position `Select` `onValueChange` (120). Cover those branches or the file stays under the unit bar.
Others: ConfirmCard lines 100 / branches 93.5; PermissionShield 100 / 96.87 (L194); useRelayChat lines 98.88 / branches 93.16 (L305, L320); telemetry 100.

## P9.15 PASS
`playwright test relay-confirm.spec.ts relay-write.spec.ts --repeat-each=3`: 57 passed (54.9s), exit 0.
`check-ids.sh`: OK.

## P9.16 FAIL · flake
`--repeat-each=3` exit non-zero: 41 passed, 1 failed.
`[REL-POL-COMPOSER-08]` repeat 2: `tooltip.filter({ hasText: 'Stop generating' })` not visible after `stopBtn.focus()` (5s). e2e/qa/relay/relay-polish-composer.spec.ts:426.
Fix the stop-button tooltip so it opens on focus reliably, then re-run `--repeat-each=3`. check-ids.sh itself was OK.

## P9.17 PASS
`--repeat-each=3`: 36 passed (30.9s). 12 tests, one per REL-POL-PERM-01..12. No waitForTimeout, skip, only, fixme.

## P9.18 PASS
`--repeat-each=3`: 27 passed (23.7s). 9 tests, REL-POL-SHIELD-01..09. No waitForTimeout/skip/only/fixme.

## P9.19 PASS (commands)
- vitest src/lib/relay src/hooks src/stores src/components/relay src/components/settings src/i18n: 142 files, 4097 tests, exit 0
- playwright perm+shield+composer+launcher `--repeat-each=2`: 86 passed (1.2m)
- playwright confirm+write+a11y-keyboard: 21 passed (20.0s)
- check-ids.sh OK
- lint:check exit 0
- typecheck exit 0
- brandGuard included in the 4097 run
- permissionMode input/schema grep on schemas.ts: no match, exit 0

Gate commands are green. The phase is still FAIL because P9.16 flaked and P9.14/P9.6–P9.11 miss their own bars. Do not mark Checkpoint 9 until those are fixed.

## Quality
- Missing task Log lines are the convention violation for P9.6–P9.11.
- No test.fail/it.fails/.skip/.only/.fixme in the phase specs searched.
