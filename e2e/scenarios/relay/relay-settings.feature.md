# Feature: Relay v2 Settings, Relay section (Enable off, Position removed)

Tests in `e2e/qa/relay/relay-settings.spec.ts`. Covers BUG-05, BUG-06 and BUG-07 in a real browser: the Enable switch gates every Relay surface reactively and across reloads, and the removed Position control is gone. The "Stopped" label for an aborted turn is asserted in Phase 3, not here.

---

@critical
## Scenario: [REL-V2-SETTINGS-01] with Enable off the dock, toggle, launcher, palette entry and Open-in-Relay are hidden and the shortcut does nothing
# evidence: src/hooks/useRelayAvailable.ts, RelayRoot.tsx, RelayToggleButton.tsx, OpenInRelayButton.tsx, CommandPalette.tsx, useRelayShortcut.ts

@critical
## Scenario: [REL-V2-SETTINGS-02] after reload with Enable off none of those surfaces appear
# evidence: useRelayStore.hydrate reads rq_relay_enabled

@critical
## Scenario: [REL-V2-SETTINGS-03] turning Enable on restores them without a reload
# evidence: useRelayAvailable subscribes to the store

@high
## Scenario: [REL-V2-SETTINGS-04] no Position control is present in Settings, Relay
# evidence: src/components/settings/RelaySection.tsx (position control removed)

@high
## Scenario: [REL-V2-SETTINGS-05] disabling while a mocked turn is streaming aborts it, and re-enabling restores the last active thread
# evidence: src/hooks/useRelayChat.ts unmount cleanup (stop + thread save)

@medium
## Scenario: [REL-V2-SETTINGS-06] the Settings, Relay section stays visible while disabled
# evidence: SettingsPageClient.tsx gates only on the build flag
