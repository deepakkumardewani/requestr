# Phase 7 builder a1 (P7.2, P7.3, P7.4)

P7.2: added `apply.*` keys (button labels, disabled reasons, confirm copy) to messages/{en,fr,ja}/relay.json. biome + relayMessages.parity.spec pass; package.json/bun.lock unchanged.
P7.3: src/lib/relay/codeHighlight.ts (dynamic imports of lang-json/lang-javascript, legacy-modes shell/xml, @lezer/highlight; html maps to xml mode; graphql/unknown = plain), src/components/relay/CodeBlock.tsx (plain text first, Copy, Apply), RelayMarkdown.tsx wired (FencedCode extracts label/text), RelayMarkdown.spec.tsx extended (22 pass).
P7.4: src/lib/relay/applyCode.ts (resolveApplyAction, buildApplyPatch, buildApplyBefore), ApplyCodeAction.tsx (inline confirm, change log entity tabRequest, ChangeCard shows Undo).
Checks: biome clean (spec files are biome-ignored by config, so Verify biome on RelayMarkdown.spec.tsx reports "no files processed"), bun run typecheck clean, vitest src/components/relay src/i18n tabRequests = 29 files / 1265 pass, BRAND_GREP exit 0. A throwaway spec verified HTTP apply+Undo, GraphQL invalid JSON disabled, no-tab disabled with title, WS draft (deleted afterwards).
Decisions: dynamic import in effect instead of React.lazy (file list limits); HTTP undo has no edited-since check (snapshotTabRequest returns null for http, changeLog.ts out of scope).
