# Persistence and storage keys

Where each piece of state is saved and how it is read back. Schemas are in `docs/DATA_MODEL.md`. Every claim cites a path.

## Two tiers

| Tier | Used for | Access |
| --- | --- | --- |
| IndexedDB | Collections, requests, folders, environments, history, tabs, settings, chains, chain runs, Relay threads and changes | `getDB` in `src/lib/idb.ts`, schema in `src/lib/idbSchema.ts` |
| `localStorage` | UI, chain layout and Relay preferences, collapsed folders, active environment id | Direct calls inside each store |
| Memory only | Responses, connections, schema and JSON tool state, playground | Nothing persisted |

Per-store assignment is the table in `docs/ARCHITECTURE.md` (section Stores); the keys are in `docs/DATA_MODEL.md`.

## IndexedDB behaviour

- `getDB` returns `null` on the server (no `window`), so stores guard every use with `if (!db) return`.
- A failed open is not cached: `dbPromise` is cleared so the next call retries (`src/lib/idb.ts`). Open handlers show a toast when another tab blocks an upgrade.
- Stores write after each change, for example `persistTabs` in `src/stores/useTabsStore.ts`, `persistCollection` in `src/stores/useCollectionsStore.ts`, and `persistSettings` in `src/stores/useSettingsStore.ts`, which shows a toast on failure.
- `runInTransaction` (`src/lib/idb.ts`) runs several stores in one readwrite transaction so either all writes land or none; `getLooseDB` and `readAllRecords` serve backup code and reject when IndexedDB is unavailable.
- Upgrading: add or edit entries in `IDB_STORES` and bump `IDB_VERSION` together (`src/lib/idbSchema.ts`). The QA seed derives from the same file (see `docs/TESTING.md`).

## localStorage behaviour

`localStorage` can throw (private mode, quota, disabled storage). `readPreference` and `writePreference` in `src/stores/useUIStore.ts` catch, fall back to defaults and log the key with `console.warn`. Relay stores follow the same pattern in `src/stores/useRelayStore.ts`, `src/stores/useRelayPermissionStore.ts` and `src/stores/useRelayRecentStore.ts`, using `RELAY_STORAGE_KEYS` from `src/lib/relay/constants.ts`.

## Hydration

Stores load from storage at startup. Settings spread saved values over `DEFAULT_SETTINGS` so new fields get defaults (`src/stores/useSettingsStore.ts`). Chains migrate from the legacy `chainConfigs` shape once, guarded by `chainMigrationV5` and a per-record `schemaVersion` (`src/lib/chainMigration.ts`).

## Backup and restore

`./src/lib/backup` exports sections (`BACKUP_SECTIONS` in `src/lib/backup/constants.ts`) and restores them in transactions (`src/lib/backup/replace.ts`, `src/lib/backup/importer.ts`). After a restore, other open tabs reload through a `BroadcastChannel` (`src/lib/backup/broadcast.ts`) so they cannot write stale state over the restored data.
