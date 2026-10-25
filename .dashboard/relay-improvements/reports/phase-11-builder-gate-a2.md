# Phase 11 gate (a2)
Bug fix: assertions persist through save+reload. Cause was twofold: RequestModel lacked `assertions` (useSaveRequest, addRequest, requestModelToHttpTab, RequestItem open/duplicate, SidebarSearch, CommandPalette now copy it), and useTabsStore.updateTabState never persisted tabs on Save (patch isDirty:false now calls persistTabs), so the restored tab was stale.
Files: src/types/index.ts, src/hooks/useSaveRequest.ts (+spec), src/stores/useCollectionsStore.ts, src/stores/useTabsStore.ts, src/lib/requestModelToTab.ts, src/components/collections/RequestItem.tsx, src/components/layout/SidebarSearch.tsx, src/components/common/CommandPalette.tsx, e2e/qa/relay/relay-improvements-smart-tests.spec.ts (test.fail removed).
Evidence: smart-tests spec x5: 10 passed; vitest stores+useSaveRequest 421 passed; tsc exit 0.
P11.16 exits: vitest src/lib/relay 0 (1139 passed); 4 smart specs x2: 16 passed; relay-write+confirm 19 passed, 0; check-ids 0; lint:check 0; BRAND_GREP 0.
