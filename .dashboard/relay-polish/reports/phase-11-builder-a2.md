# P11.5 attempt 2

- A11Y-03 (app fix): MentionMenu scroll region keeps role="presentation" (tabIndex on it broke the presentational role and caused aria-required-children). Options now have tabIndex={-1} (same pattern as SlashMenu), which satisfies axe scrollable-region-focusable. Focus stays in the textarea (activedescendant pattern, mousedown preventDefault kept).
- SlashMenu: aria-label removal kept (axe label-content-name-mismatch: "/x: desc" vs visible "/x desc"). Accessible name is now computed from content. SlashMenu.spec.tsx expectation updated to "/explain slash.explain.description". Vitest Mention+Slash 45/45.
- A11Y-06: spec problem, not app bug. Dock open state persists across reload; openRelay/shortcut toggle assumed a fresh open (composer is focused on open, not on reload; shortcut would toggle it closed). Spec now clicks toggle only if aria-expanded != true and no longer asserts composer focus.
- A11Y-08: spec problem. Per SPEC RP-110 min width = max(30vw, 320px), so 320 is the supported min but only reachable at viewport <= ~1066px. Spec uses 900px viewport (named constants); scenario note added. Dock min unchanged.
- All FIXME markers removed. a11y spec --repeat-each=3: 24 passed. check-ids.sh OK.
- Other relay-polish specs (mention, slash, panel, composer, shield): 50 passed, 4 failed, all environment-related and untouched code: COMPOSER-05/07/08 "route.continue: New URL must have same protocol" and MENTION-09 counts https://requestly.localhost asset requests as other-host (spec assumes http 127.0.0.1). Slash spec + a11y re-run: 18 passed.
- Files: src/components/relay/MentionMenu.tsx, SlashMenu.tsx, SlashMenu.spec.tsx, e2e/qa/relay/relay-polish-a11y.spec.ts, e2e/scenarios/relay/relay-polish-a11y.feature.md.
