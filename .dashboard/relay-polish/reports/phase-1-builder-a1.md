# Phase 1 builder (P1.1-P1.6)
- P1.1 id_re widened in check-ids.sh; hash c6100bb9... unchanged; exit 0. Note: bash 3.2 `source <(...)` yields 0; `eval` form gives 3.
- P1.2 src/lib/relay/messageText.ts (joinTextParts, TEXT_PART_SEPARATOR, messageText); used in RelayConversation/RelayDock. Empty text parts skipped.
- P1.3 MessageParts.tsx (text blocks, grouped tool runs, TurnChangeBar once at end); RelayMarkdown memo; RelayConversation.spec mock updated for memo + 3 ordering specs.
- P1.4 thumbs, rating, relay_feedback removed; specs updated.
- P1.5 keys removed en/fr/ja; parity 872 pass.
- P1.6 note appended to 21 lines (SPEC 3, PLAN 4, TASKS 14).
- Design log: ui-ux-pro-max/impeccable/layout: kept existing gap-2 rhythm; tool runs grouped in flex gap-2 div; two-button row unchanged spacing. Screenshots: agent_docs/qa/relay-polish/p1-msg-parts-{1440,320}-{light,dark}.png, p1-actions-*. 320 shots use a 1440 viewport with dock width forced to 320px.
- Final: biome clean, vitest src/components/relay + telemetry 434 pass, tsc --noEmit clean.
