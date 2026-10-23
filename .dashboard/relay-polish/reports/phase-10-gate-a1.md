# P10.13 gate report
Fixes made (gate failures, fixed forward):
- src/vitest-setup.ts: an earlier P10 edit loaded real relay.json messages, breaking 16 older specs (83 tests) that assert key echo. Restored the file to HEAD; src/hooks/useCapabilityStarter.spec.ts now expects the prompt keys.
- e2e/qa/relay/relay-polish-shield.spec.ts SHIELD-08: launcher Settings now has 2 rows (Capabilities added), selector narrowed to the Permission mode row.
- e2e/scenarios/relay/relay-polish-caps.feature.md rewritten in `## Scenario: [ID]` format (12 ids); relay-improvements-a11y-axe.feature.md gained IA11Y-08/09. check-ids now OK.
- Typecheck: CapabilitiesPanel.spec.tsx used invalid modes (unrestricted/restricted) -> skip/always-ask; capabilities.spec.ts `tool as any` index typed.
Results: vitest relay dirs 143 files / 4370 pass (one unrelated ThreadList timing flake once, 3 reruns + full rerun green); playwright caps+shield+ctx+launcher x2: 82 passed; relay-chat+axe: 21 passed; check-ids OK; lint 0; typecheck 0; brandGuard 12 pass; grep guard exit 0.
