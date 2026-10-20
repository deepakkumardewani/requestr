# P8.11 gate a2
Spec fixes (e2e/qa/relay/relay-polish-launcher.spec.ts): LAUNCHER-01 seeds rq_relay_recent via addInitScript; Recent/Attach/Actions visibility + order asserted unconditionally. LAUNCHER-03 asserts Request row data-selected=true then presses Enter (no click). No other conditional assertions remain (grep clean; a2 report lists none).
Verify results (all exit 0): vitest 135 files/3884 tests; playwright 112 passed (--repeat-each=2); picker/a11y specs 10 passed; check-ids OK; lint:check 0 warnings; typecheck; brandGuard 12 passed; RelayPicker grep exit 0.
