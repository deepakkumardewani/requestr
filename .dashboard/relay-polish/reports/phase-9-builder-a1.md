# Phase 9 builder report (P9.1-P9.12)

Status: all 12 tasks built. Final checks: `bun run lint:check` clean, `bun run typecheck` clean,
`bunx vitest run src/lib/relay src/hooks src/stores src/components/relay src/components/settings src/i18n` = 138 files, 3970 tests passed.

## Per task
- P9.1/P9.2: permission.* in relay.json, confirm.change.*, launcher.settings.permission.* in relayDock.json (en/fr/ja). Parity specs pass. During P9.6 the en/fr change.description became an ICU plural ("1 item will change") - P9.2 Verify should be re-run.
- P9.3: permission.ts, useRelayPermissionStore.ts, constants key. P9.4: approvalNeeded/awaitsUser in schemas.ts. P9.5: registry mode support, describeGeneric.ts.
- P9.6: ConfirmCard change variant; awaiting-decision record in useRelayChat.ts (isToolAwaiting). promptCard lives in MessageParts.tsx (outside Files).
- P9.7: --warning tokens. P9.8: PermissionShield (radiogroup, roving tabindex). P9.9: shield after +, skip notice. P9.10: Settings Select. P9.11: launcher Settings section, RelayPickerRow edited for value and icon (outside Files), composer hands off via permissionPopoverOpen.
- P9.12: relay_permission_mode_changed telemetry.

## Design notes (honest)
Only `ui-ux-pro-max` was invoked, as a final checklist pass over the screenshots (touch targets, icon+text not colour-only for skip, light/dark contrast, one icon family). It surfaced no concrete issue. `impeccable` and `layout` were NOT invoked; the spacing, value alignment and handoff tuning was done by hand against screenshots. The verifier or orchestrator may want those skills run.

## Screenshot disclosures
- p9-confirm-change-* came from the live dev-server model (always-ask mode, a rename prompt). The agent-browser `network route` mock did not take effect, so no scripted stream was used. A real run exposed "1 items will change", fixed with an ICU plural.
- p9-settings-320-* are clipped: the Settings page sidebar does not collapse at 320px. Pre-existing, outside P9.10 Files; not proof of the 320px design.
- Launcher handoff verified in-browser: focus lands on the checked radio (relay-permission-option-skip).

## Decisions
- Skip mode with a dirty tab: delete returns DECISION_REQUIRED to the model, no card.
- ConfirmCard.spec local mock gained plural resolution (spec outside P9.6's list? it is in it).
