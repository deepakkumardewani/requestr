# Data model

Requestr keeps workspace data in the browser. Structured records live in IndexedDB; small UI and Relay preferences live in `localStorage`. Every claim cites a path.

![Data model](diagrams/data-model.svg)

## IndexedDB

`src/lib/idbSchema.ts` is the single source of truth for the schema: `IDB_VERSION` (currently 6), `IDB_STORES`, key paths and indexes. `src/lib/idb.ts` opens the real database from it, and the QA seed fixture (`e2e/fixtures/qaSeed.ts`) and generator (`scripts/build-qa-seed-js.ts`) derive from the same file. Change the stores and bump `IDB_VERSION` together.

| Object store | Key path | Index | Shape (file) | Owning store |
| --- | --- | --- | --- | --- |
| `collections` | `id` | none | `CollectionModel` (`src/types/index.ts`) | `src/stores/useCollectionsStore.ts` |
| `requests` | `id` | `by-collection` on `collectionId` | `RequestModel` (`src/types/index.ts`) | `src/stores/useCollectionsStore.ts` |
| `folders` | `id` | `by-collection` on `collectionId` | `CollectionFolderModel` (`src/types/index.ts`) | `src/stores/useCollectionsStore.ts` |
| `environments` | `id` | none | `EnvironmentModel`, `EnvVariable` (`src/types/index.ts`) | `src/stores/useEnvironmentsStore.ts` |
| `history` | `id` | `by-timestamp` on `timestamp` | `HistoryEntry` (`src/types/index.ts`) | `src/stores/useHistoryStore.ts` |
| `tabs` | `tabId` | none | `TabState` (`src/types/index.ts`) | `src/stores/useTabsStore.ts` |
| `settings` | out-of-line | none | `AppSettings` stored under the key `"app"` (`src/stores/useSettingsStore.ts`) | `src/stores/useSettingsStore.ts` |
| `chainConfigs` | `collectionId` | none | legacy (pre-v5) per-collection chain config | `src/lib/chainMigration.ts` (migrates it into `chains`) |
| `chains` | `id` | none | `Chain` (`src/types/chain.ts`), `schemaVersion` is `CHAIN_SCHEMA_VERSION` (5) | `src/stores/useChainStore.ts` |
| `chainRuns` | `id` | `by-chain` on `chainId` | run records; see `src/stores/useChainRunStore.ts` | `src/stores/useChainRunStore.ts` |
| `relay_threads` | `id` | `by-workspace` on `[workspaceId, updatedAt]` | `RelayThread` (`src/lib/relay/threadDb.ts`) | `src/lib/relay/threadDb.ts` |
| `relay_changes` | `id` | `by-thread` on `threadId` | `RelayChangeRecord` (`src/lib/relay/threadDb.ts`) | `src/lib/relay/changeLog.ts` |

Notes:

- History is trimmed to `MAX_HISTORY_ENTRIES` (200, `src/lib/constants.ts`) in `src/stores/useHistoryStore.ts`.
- Relay keeps at most `RELAY_MAX_THREADS` (50) threads (`src/lib/relay/constants.ts`). Every thread belongs to `RELAY_WORKSPACE_ID` (`"local"`) in the same file, because no workspace entity exists yet.
- `relay_changes` rows link back to a thread through `threadId`; a thread delete is undoable through `ThreadSnapshot` (`src/lib/relay/threadDb.ts`).
- Chain types (`ChainNodeType`, `ChainEdge`, `ChainBlock`, `ChainRunState`) are in `src/types/chain.ts`.

## Settings shape

`AppSettings` (`src/types/index.ts`) is what is saved to the `settings` store: `theme`, `proxyUrl`, `sslVerify`, `followRedirects`, `showHealthMonitor`, `showCodeGen`, `codeGenLang`, `autoExpandExplainer`, `locale` (`en`, `fr`, `ja`), `globalBaseUrl`, `globalHeaders`, `pinnedRequestIds`, `accentColor`, `chainMigrationV5`, `confirmCloseUnsavedTabs`, `reducedMotion` (`system`, `on`, `off`). Defaults are `DEFAULT_SETTINGS` and the saved shape is built by `toAppSettings` in `src/stores/useSettingsStore.ts`. Saved settings are spread over the defaults on load, so a new field gets its default for existing users.

## localStorage

| Key | Owner | Holds |
| --- | --- | --- |
| `rq_relay_open`, `rq_relay_width`, `rq_relay_active_thread`, `rq_relay_enabled`, `rq_relay_onboarded`, `rq_relay_recent`, `rq_relay_permission_mode` | `RELAY_STORAGE_KEYS` in `src/lib/relay/constants.ts`, read by `src/stores/useRelayStore.ts`, `src/stores/useRelayPermissionStore.ts`, `src/stores/useRelayRecentStore.ts` | Dock open state and width, active thread id, feature toggle, onboarding flag, recent items, permission mode (`always-ask`, `review`, `skip` from `src/lib/relay/permission.ts`) |
| `rq_relay_share_values`, `rq_relay_speech_engine` | `SHARE_VALUES_KEY`, `SPEECH_ENGINE_KEY` in `src/stores/useRelayStore.ts` | Privacy and speech engine preferences |
| `rq_chain_run_log_height`, `rq_chain_run_log_auto_open`, `rq_chain_run_log_collapsed`, `rq_chain_run_log_list_width`, `rq_chain_run_log_detail_ratio`, `rq_chain_concurrency`, `rq_chain_picker_tab`, `rq_chain_snap_to_grid`, `rq_chain_hints_dismissed` | `src/stores/useUIStore.ts` | Chain canvas and run-log layout preferences; concurrency is bounded by `MIN_CHAIN_CONCURRENCY` and `MAX_CHAIN_CONCURRENCY` (1 to 8) |
| `rq_collapsed_folders` | `src/stores/useFolderExpandStore.ts` | Collapsed sidebar folder ids |
| `requestly_active_env_id` | `src/stores/useEnvironmentsStore.ts` | Active environment id |

See `docs/PERSISTENCE.md` for how each store reads and writes these.

## Backup

`./src/lib/backup` exports and imports the workspace. `BACKUP_SECTIONS` in `src/lib/backup/constants.ts` lists `collections`, `environments`, `chains`, `history`, `settings`, `preferences`, `relayThreads`; secrets are replaced by `REDACTED_VALUE` in the same file (`src/lib/backup/secrets.ts`).
