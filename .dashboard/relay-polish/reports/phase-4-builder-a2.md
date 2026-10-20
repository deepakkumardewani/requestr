# Phase 4 builder report a2 (P4.2, P4.3, P4.4)

- P4.2: messages/fr/relayDock.json `threads.time.years` -> `{count, plural, one {# an} other {# ans}}`. intl-messageformat check (fr): 1 -> "1 an", 2 -> "2 ans". Other units (min, h, j, sem., mois, ja) are invariable: no change.
- P4.3: ThreadList.tsx time slot `w-10` -> `min-w-10`, `<time>` gets `whitespace-nowrap`. Trigger stays absolute right-0.
  Browser probe (temporary Playwright spec, deleted; 900px viewport = 320px dock; real fr/ja strings injected into the DOM since locale is fixed to en in src/i18n/request.ts): "à l'instant", "11 mois", "11か月", "23時間", "12 min", "2 ans", "now" all 16px tall (single line), overlap=false vs title button, hover shift=false (title box and row height identical before/after hover once the popover animation settled). Widest "à l'instant" = 56.8px.
  Screenshot: agent_docs/qa/relay-polish/p4-rows-i18n-900-dark.png
- P4.4: no code change; design Log line added.
- Design skills ui-ux-pro-max, impeccable, layout invoked; Log lines added to P4.3 and P4.4 in agent_docs/relay-polish/TASKS.md.
- Tests: vitest parity x2 + ThreadList.spec + RelayHeader.spec: 4 files, 961 passed. biome ThreadList.tsx clean.

Not addressed (out of my scope, listed in verifier): P4.6 spec renames, P4.7 title, P4.8 rewrites.
