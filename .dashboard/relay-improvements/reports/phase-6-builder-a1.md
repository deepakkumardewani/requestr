# Phase 6 builder a1 (P6.1-P6.6)
- P6.1 pill.open / pill.kind.* in en/fr/ja; biome + parity (734) pass.
- P6.2 src/lib/relay/entityLinks.ts: parseRelayHref (strict regex), resolveEntity.
- P6.3 src/lib/relay/openEntity.ts shared by open_item (ui.ts); ui.spec 7 pass. Non-request kinds return {href}.
- P6.4 EntityPill.tsx, RelayMarkdown a-renderer + urlTransform allowing relay://; 15 specs pass.
- P6.5 tokenize.ts, colorize in p/li/td/th/strong/em; file-like inline code accent.
- P6.6 ENTITY_LINK_RULES appended to prompt + spec.
- Checks: vitest (relay components, tools, i18n, systemPrompt, brandGuard) 1615 pass; bun run typecheck clean; BRAND_GREP exit 0; biome clean.
- Decision: exported getStatusClasses from src/components/common/StatusBadge.tsx (outside Files) to reuse status colours instead of duplicating.
