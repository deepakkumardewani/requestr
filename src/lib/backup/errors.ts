import type { BackupSection } from "./constants";

/** Where a foreign file (Postman, Insomnia, OpenAPI) is sent instead. */
export const IMPORT_PAGE_PATH = "/import";

export type BackupErrorCode =
  | "invalidJson"
  | "invalidFile"
  | "foreignFile"
  | "newerVersion"
  | "unsupportedVersion"
  | "damagedSection";

export type BackupError = {
  code: BackupErrorCode;
  /** Set for `newerVersion`: the file's schema version, shown as `{n}`. */
  schemaVersion?: number;
  /** Set for `damagedSection`: shown as `{section}`. */
  section?: BackupSection;
};

/** Keys in the `settings` message namespace; the copy lives in `settings.json`. */
export const BACKUP_ERROR_MESSAGE_KEYS: Record<BackupErrorCode, string> = {
  invalidJson: "backup.errors.invalidJson",
  invalidFile: "backup.errors.invalidFile",
  foreignFile: "backup.errors.foreignFile",
  newerVersion: "backup.errors.newerVersion",
  unsupportedVersion: "backup.errors.unsupportedVersion",
  damagedSection: "backup.errors.damagedSection",
};

export type BackupErrorMessage = {
  key: string;
  values: { n?: number; section?: string };
};

/** The i18n key and ICU values for an error, ready for `t(key, values)`. */
export function describeBackupError(error: BackupError): BackupErrorMessage {
  return {
    key: BACKUP_ERROR_MESSAGE_KEYS[error.code],
    values: { n: error.schemaVersion, section: error.section },
  };
}
