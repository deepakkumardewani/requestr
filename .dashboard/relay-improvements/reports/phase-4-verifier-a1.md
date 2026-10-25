# Phase 4 verifier a1: FAIL
Confirmed app bug: messages/{en,fr,ja}/relay.json `tools` has no close_tab, close_all_tabs, delete_requests, delete_requests_in_collection entries (only delete_request). ToolRow.tsx:89 calls t(`${key}.${phase}`) with useTranslations("relay.tools") -> MISSING_MESSAGE, console guard fails. e2e spec relay-improvements-tabs.spec.ts has 5 test.fail() (lines 136,169,203,235,337), which is a failure per rules.
Fix: add running/done keys for the four tools in en/fr/ja, then remove the 5 test.fail() markers and rerun the e2e at --repeat-each=5.
Observed green: vitest src/lib/relay/tools src/components/relay src/i18n 41 files / 1493 passed; biome clean.
Not fully re-run: per-task coverage tables, e2e, quality review (stopped after confirmed blocker).
P4.9 gate not built (expected).
