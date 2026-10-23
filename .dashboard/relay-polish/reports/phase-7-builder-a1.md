# Phase 7 builder report (P7.1–P7.5)

## P7.1 Slash strings
- **Files:** `messages/en/relayDock.json`, `messages/fr/relayDock.json`, `messages/ja/relayDock.json`
- **Changes:** Added `slash.group.*`, nested `slash.hint.{request,collection,chain,tab}`, 10 new commands + prompts; renamed legacy top-level `slash.hint` string to `slash.composerHint` to avoid JSON key collision.
- **Verify:** biome check (3 locales) exit 0; vitest parity + brandGuard — 948 tests passed.

## P7.2 Slash command metadata
- **Files:** `src/lib/relay/slashCommands.ts`, `src/lib/relay/slashCommands.spec.ts`
- **Changes:** 15 commands with icons, groups, `requiresTarget`, `filterSlashCommands` + description matching, `orderSlashCommands`, `SLASH_GROUP_ORDER`.
- **Tool audit (prompts → RELAY_TOOL_SCHEMAS):** All referenced capabilities exist (`get_active_context`, `get_last_response`, `get_request`, `get_collection`, `get_chain`, `generate_docs`, `create_*`, `import_curl`, chain tools, env tools, `generate_tests`, `set_request_scripts`, `send_request`, `run_chain`, `update_*`, `diff_responses`, `export_curl`, `export_history`, `ask_user` via prompt wording). No new tools required; `generate_docs` remains schema-backed (phase 11 UX).
- **Verify:** biome exit 0; `slashCommands.spec.ts` — 15 tests passed.

## P7.3 Slash target matching
- **Files:** `src/lib/relay/slashTarget.ts`, `src/lib/relay/slashCommands.ts` (import path only)
- **Changes:** Pure `resolveSlashTarget` with `/run`, `/summarize`, `/clear`, `/import`, `/export`, `/env` rules.
- **Verify:** biome exit 0.

## P7.4 Grouped slash menu
- **Files:** `SlashMenu.tsx`, `SlashMenu.spec.tsx`, `constants.ts` (`RELAY_SLASH_MENU_MAX_HEIGHT_PX`)
- **Design:** Group headings, icon column, truncated descriptions, scroll at max height (ui-ux-pro-max + layout: density for 15 rows at narrow width).
- **Screenshots:** `agent_docs/qa/relay-polish/p7-slash-1440-light.png`
- **Verify:** biome exit 0; SlashMenu spec — 17 tests passed; `p7-slash-*.png` present.

## P7.5 Run slash commands
- **Files:** `useSlashCommandRunner.ts`, `RelayComposer.tsx`, `RelayComposer.spec.tsx`, `MentionMenu.tsx` (hint already supported), `SlashMenu.tsx`
- **Changes:** Single runner for clear/import/target flows; slash-driven mention menu with hints; `/run` without attachment keeps `/run` draft.
- **Design:** Hint line via existing MentionMenu border-b styling; draft stays in textarea after attach.
- **Screenshots:** `agent_docs/qa/relay-polish/p7-target-1440-light.png`
- **Verify:** biome exit 0; RelayComposer + SlashMenu specs — 77 tests passed; `p7-target-*.png` present.

## Decisions
- **P7.1:** Renamed `slash.hint` (composer tip) → `slash.composerHint` so `slash.hint.request|…` can exist (unused in UI today).
