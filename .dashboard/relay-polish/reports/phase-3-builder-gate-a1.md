# P3.6 Checkpoint 3 report
- vitest relay/stores/hooks/lib/i18n: 129 files, 3431 tests passed
- polish panel+shell --repeat-each=2: 40 passed on rerun (first run: SHELL-08 failed once under load; 6x isolated reruns passed, flaky, no source change)
- layout/a11y/keyboard/shell/chat specs: 31 passed
- check-ids.sh OK; lint:check clean; typecheck clean; brandGuard 12 passed
- RELAY_DEFAULT_WIDTH_PX grep empty; RELAY_MAX_WIDTH_VW = 40 at constants.ts:5
- Screenshots (none existed; generated via a temporary spec, deleted after): agent_docs/qa/relay-polish/p3-dock-{1440,1100,780,320}-light.png. Dock widths measured 432, 330, 320, 320 (the 320 shot uses a 1000px viewport since <768px is the mobile sheet).
