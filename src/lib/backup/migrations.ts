import { BACKUP_SCHEMA_VERSION } from "./constants";

type RawBackup = Record<string, unknown>;

/** Upgrades a raw file from schema version `key` to `key + 1`. Empty while only v1 exists. */
const MIGRATIONS: Record<number, (raw: RawBackup) => RawBackup> = {};

/**
 * Walks an older file up to the supported version. Returns null when a step
 * is missing, which validation reports as an unsupported version.
 */
export function migrateBackup(
  raw: RawBackup,
  fromVersion: number,
): RawBackup | null {
  let current = raw;
  for (let version = fromVersion; version < BACKUP_SCHEMA_VERSION; version++) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return null;
    current = { ...migrate(current), schemaVersion: version + 1 };
  }
  return current;
}
