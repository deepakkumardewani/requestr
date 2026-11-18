# Feature: Relay v2 settings tools (get_app_settings, set_theme, set_language, update_proxy_settings, set_global_variables, set_relay_preferences)

Tests in `e2e/qa/relay/relay-v2-tools-settings.spec.ts`. Covers TOOL-01 and CONV-05 in a real browser: a mocked agent turn calls the real client settings tools, then the tool result sent back to the model, the changes summary, the Settings page and Undo are asserted. Settings are seeded per test; no real provider is called.

---

@critical
## Scenario: [REL-V2-TOOLSET-01] a mocked agent calls get_app_settings and the reply masks proxy credentials and, with shareValues off, header values
# evidence: src/lib/relay/tools/appSettings.ts

@critical
## Scenario: [REL-V2-TOOLSET-02] a mocked set_theme changes the theme, the summary offers Open Settings, and Undo restores the previous theme
# evidence: src/lib/relay/tools/settingsWrite.ts setTheme, src/lib/relay/changesSummary.ts

@high
## Scenario: [REL-V2-TOOLSET-03] set_language and update_proxy_settings apply the same way as the Settings UI
# evidence: src/lib/relay/changeLog.ts SETTINGS_ACCESS (writes through setSetting)

@high
## Scenario: [REL-V2-TOOLSET-04] set_global_variables updates the Global section and Undo restores it
# evidence: src/lib/relay/tools/settingsWrite.ts setGlobalVariables

@critical
## Scenario: [REL-V2-TOOLSET-05] set_relay_preferences with enabled false shows an approval card and applies only after the turn ends
# evidence: src/lib/relay/tools/schemas.ts requiresDisableApproval, src/hooks/useRelayChat.ts disableRelayAfterTurn

@high
## Scenario: [REL-V2-TOOLSET-06] set_relay_preferences rejects permissionMode and speechEngine grok when status reports unconfigured
# evidence: src/lib/relay/tools/schemas.ts (strict input), settingsWrite.ts GROK_NOT_CONFIGURED
