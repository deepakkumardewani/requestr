# Phase 9 builder a1 (P9.1-P9.5)
- P9.1: history section in messages/{en,fr,ja}/common.json. biome ok, messages.parity.spec 25 pass, BRAND_GREP exit 0.
- P9.2: src/lib/history/exportHar.ts buildHar (HAR 1.2, filter by request.type http/graphql, excludedCount).
- P9.3: exportHistory.ts, clearHistory.ts; historyExport.ts filename now requestr-history-<date>, ExportFormat adds har and is exported. useHistoryStore.spec 10 pass; no 'requestly-history' in src.
- P9.4: HistoryActionsMenu.tsx, ClearHistoryDialog.tsx, HistoryList.tsx (old dropdown replaced; menu also shown for empty history, not compact), HistoryList.spec.tsx extended (3 tests). vitest history + LeftPanel pass; typecheck ok. Strings use useTranslations("common") + "history.*" keys (test mock does not support dotted namespaces).
- P9.5: tools/history.ts (clear_history kind confirm = destructive, export_history auto), registered, schemas added, gating.spec VALID_INPUT + schemas.spec counts updated (auto 27, 49 total, confirm list).
- Known: coverage.spec.ts audit fails for clear_history/export_history until Unit P9.6 writes tools/history.spec.ts with [success]/[invalid] tags (expected).
- Decisions: clear_history preview targets ["history"] only when count==1 (else count-based title); relay.json tool-row labels not added (outside Files).
