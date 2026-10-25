P9.3 retry: dropped `export` from `type ExportFormat` in src/lib/historyExport.ts (grep: only used locally at line 73; no imports in src or specs; HistoryExportFormat in exportHistory.ts is separate).
Evidence: biome check clean; tsc --noEmit no output; `bun run test -- historyExport history`: 15 files, 111 tests passed.
